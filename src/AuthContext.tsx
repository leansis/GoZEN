import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, getDocFromServer, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, Role, Company } from './types';
import { handleFirestoreError, OperationType } from './lib/firestore-utils';

interface AuthContextType {
  user: FirebaseUser | null;
  dbUser: User | null;
  company: Company | null;
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  loading: boolean;
  login: (useRedirect?: boolean) => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isSupervisor: boolean;
  isLeanPromotor: boolean;
  isGlobalAdmin: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActiveCompany = async () => {
      if (activeCompanyId) {
        try {
          const companyDoc = await getDoc(doc(db, 'companies', activeCompanyId));
          if (companyDoc.exists()) {
            setCompany(companyDoc.data() as Company);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `companies/${activeCompanyId}`);
        }
      } else {
        setCompany(null);
      }
    };
    fetchActiveCompany();
  }, [activeCompanyId]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const isDefaultAdmin = firebaseUser.email === 'migcormar@gmail.com';
          let existingUser: User | null = null;

          const fetchUser = async () => {
            // 1. Try to find user by UID (correct document ID)
            try {
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists()) {
                existingUser = userDoc.data() as User;
                // Ensure uid field matches document ID
                if (existingUser.uid !== firebaseUser.uid) {
                  await updateDoc(doc(db, 'users', firebaseUser.uid), { uid: firebaseUser.uid });
                  existingUser.uid = firebaseUser.uid;
                }
                return;
              }
            } catch (error) {
              console.warn("Error fetching user by UID:", error);
            }

            // 2. Not found by UID, try to find by email as document ID (migration case)
            const emailDocId = firebaseUser.email?.toLowerCase().trim();
            if (emailDocId) {
              try {
                const { runTransaction } = await import('firebase/firestore');
                await runTransaction(db, async (transaction) => {
                  const emailDoc = await transaction.get(doc(db, 'users', emailDocId));
                  if (emailDoc.exists()) {
                    const data = emailDoc.data() as User;
                    console.log('Migrating user from email-ID to UID-ID via transaction');
                    
                    const migratedUser = { ...data, uid: firebaseUser.uid };
                    // Create new doc with correct UID
                    transaction.set(doc(db, 'users', firebaseUser.uid), migratedUser);
                    // Delete old doc (email-ID)
                    transaction.delete(doc(db, 'users', emailDocId));
                    
                    existingUser = migratedUser;
                  }
                });
                if (existingUser) return;
              } catch (error) {
                console.warn("Error migrating user by email-ID:", error);
              }
            }

            // 3. Still not found, try query by email field (fallback for random IDs)
            try {
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('email', '==', firebaseUser.email));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                const oldDoc = querySnapshot.docs[0];
                const oldId = oldDoc.id;
                const data = oldDoc.data() as User;
                console.log('Migrating user from random-ID to UID-ID');
                
                const migratedUser = { ...data, uid: firebaseUser.uid };
                
                // We use a transaction here too if possible, but we already have the data
                // To be safe and atomic:
                const { runTransaction } = await import('firebase/firestore');
                await runTransaction(db, async (transaction) => {
                  transaction.set(doc(db, 'users', firebaseUser.uid), migratedUser);
                  if (oldId !== firebaseUser.uid) {
                    transaction.delete(doc(db, 'users', oldId));
                  }
                });
                
                existingUser = migratedUser;
                return;
              }
            } catch (error) {
              console.error("Error querying user by email field:", error);
              handleFirestoreError(error, OperationType.GET, 'users');
            }
          };

          await fetchUser();

          if (existingUser) {
            let needsUpdate = false;
            if (isDefaultAdmin && existingUser.role !== 'admin') {
              existingUser.role = 'admin';
              needsUpdate = true;
            }
            if (needsUpdate) {
              try {
                await setDoc(doc(db, 'users', existingUser.uid), existingUser, { merge: true });
              } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `users/${existingUser.uid}`);
              }
            }
            setDbUser(existingUser);
            
            if (existingUser.companyId) {
              try {
                const companyDoc = await getDoc(doc(db, 'companies', existingUser.companyId));
                if (companyDoc.exists()) {
                  setCompany(companyDoc.data() as Company);
                  setActiveCompanyId(existingUser.companyId);
                }
              } catch (error) {
                handleFirestoreError(error, OperationType.GET, `companies/${existingUser.companyId}`);
              }
            }
          } else if (isDefaultAdmin) {
            // ONLY create a new user automatically if it's the default admin
            const newUser: User = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Admin',
              email: firebaseUser.email || '',
              role: 'admin',
              status: 'active',
              photoURL: firebaseUser.photoURL || undefined,
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
            setDbUser(newUser);
          } else {
            // User not pre-registered and not default admin
            setDbUser(null);
          }
        } catch (error) {
          console.error("Critical error in auth state change:", error);
        }
      } else {
        setDbUser(null);
        setCompany(null);
        setActiveCompanyId(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (useRedirect = false) => {
    const provider = new GoogleAuthProvider();
    if (useRedirect) {
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const registerWithEmail = async (email: string, pass: string, name: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(userCredential.user, { displayName: name });
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        dbUser,
        company,
        activeCompanyId,
        setActiveCompanyId,
        loading,
        login,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        isAdmin: dbUser?.role === 'admin' || dbUser?.role === 'lean_promotor' || user?.email === 'migcormar@gmail.com',
        isSupervisor: dbUser?.role === 'supervisor',
        isLeanPromotor: dbUser?.role === 'lean_promotor',
        isGlobalAdmin: dbUser?.role === 'admin' || user?.email === 'migcormar@gmail.com',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
