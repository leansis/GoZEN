import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Matrix from './pages/Matrix';
import TrainingActions from './pages/TrainingActions';
import Statistics from './pages/Statistics';
import OHP from './pages/OHP';
import AdminTeams from './pages/admin/Teams';
import AdminUsers from './pages/admin/Users';
import AdminActivities from './pages/admin/Activities';
import AdminProcesses from './pages/admin/Processes';
import AdminTasks from './pages/admin/Tasks';
import AdminCriteria from './pages/admin/Criteria';
import MasterUsers from './pages/admin/MasterUsers';
import { AuthContext } from './AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

import Home from './pages/Home';

import ProcessMap from './pages/ProcessMap';

const ProtectedRoute = ({ children, requireAdmin = false, requireSupervisor = false, requireGlobalAdmin = false }: { children: React.ReactNode, requireAdmin?: boolean, requireSupervisor?: boolean, requireGlobalAdmin?: boolean }) => {
  const { user, dbUser, loading, isAdmin, isSupervisor, isGlobalAdmin } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  
  if (!user || !dbUser) {
    return <Navigate to="/login" />;
  }

  if (requireGlobalAdmin && !isGlobalAdmin) {
    return <Navigate to="/" />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" />;
  }

  if (requireSupervisor && !isSupervisor && !isAdmin) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

const Login = () => {
  const { login, loginWithEmail, registerWithEmail, resetPassword, logout, user, dbUser } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [mode, setMode] = React.useState<'login' | 'register' | 'reset'>('login');
  
  // Form states
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [preRegisteredUser, setPreRegisteredUser] = React.useState<any | null>(null);

  // Check for pre-registered user when typing email in register mode
  React.useEffect(() => {
    if (mode === 'register' && email.includes('@') && email.includes('.')) {
      const checkPreRegistration = async () => {
        try {
          const docRef = doc(db, 'users', email.toLowerCase().trim());
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPreRegisteredUser(data);
            setName(data.name);
          } else {
            setPreRegisteredUser(null);
          }
        } catch (e) {
          setPreRegisteredUser(null);
        }
      };
      const timer = setTimeout(checkPreRegistration, 500);
      return () => clearTimeout(timer);
    } else {
      setPreRegisteredUser(null);
    }
  }, [email, mode]);
  
  if (user && dbUser) return <Navigate to="/" />;
  
  const handleGoogleLogin = async (useRedirect = false) => {
    try {
      setError(null);
      setSuccess(null);
      setIsLoggingIn(true);
      await login(useRedirect);
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError("Este dominio no está autorizado para iniciar sesión. Por favor, contacta al administrador para que añada este dominio en Firebase Console.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        // User intentionally closed the popup, no need to show a scary error
        setError(null);
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError("Ya hay una ventana de inicio de sesión abierta. Por favor, complétala o ciérrala.");
      } else {
        setError("Error al iniciar sesión: " + (err.message || "Error desconocido"));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoggingIn(true);
    
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'register') {
        if (!name) throw new Error("El nombre es obligatorio");
        await registerWithEmail(email, password, name);
      } else if (mode === 'reset') {
        await resetPassword(email);
        setSuccess("Se ha enviado un correo para restablecer tu contraseña.");
        setMode('login');
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Credenciales incorrectas. Por favor, inténtalo de nuevo.");
      } else if (err.code === 'auth/email-already-in-use') {
        setError("Este correo electrónico ya está registrado y activado. Por favor, usa la pestaña de 'Entrar' con tu contraseña.");
        setMode('login'); // Auto-switch to login mode to help the user
      } else if (err.code === 'auth/weak-password') {
        setError("La contraseña es demasiado débil (mínimo 6 caracteres).");
      } else if (err.code === 'auth/invalid-email') {
        setError("El formato del correo electrónico no es válido.");
      } else {
        setError("Error: " + (err.message || "Ocurrió un error inesperado"));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="p-8 bg-white rounded-xl shadow-md text-center max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">GoZEN</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm text-left">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm text-left">
            {success}
          </div>
        )}

        {user && !dbUser ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm text-left">
              <p className="font-bold mb-2">Acceso no autorizado</p>
              <p>Tu cuenta ({user.email}) no ha sido pre-registrada por un administrador o lean promotor.</p>
              <p className="mt-2 text-xs">Por favor, contacta con tu responsable, administrador o lean promotor de GoZEN para que te den de alta en el sistema.</p>
              <p className="mt-2 text-xs font-semibold">Nota: Si acabas de registrarte, asegúrate de que el administrador o lean promotor usó exactamente este correo.</p>
            </div>
            <button 
              onClick={logout}
              className="w-full bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition"
            >
              Cerrar Sesión
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                  {preRegisteredUser ? (
                    <div className="w-full px-4 py-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 font-medium flex items-center justify-between">
                      <span>{preRegisteredUser.name}</span>
                      <span className="text-[10px] bg-blue-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Pre-registrado</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Tu nombre"
                      required
                    />
                  )}
                  {preRegisteredUser && (
                    <p className="mt-1 text-xs text-blue-600 italic">
                      Tu cuenta ha sido pre-registrada. Solo necesitas elegir una contraseña.
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="tu@email.com"
                  required
                />
              </div>

              {mode !== 'reset' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition flex items-center justify-center"
              >
                {isLoggingIn ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  mode === 'login' ? 'Entrar' : mode === 'register' ? 'Activar mi cuenta' : 'Enviar correo'
                )}
              </button>
            </form>

            <div className="flex flex-col space-y-2 text-sm text-gray-600">
              {mode === 'login' ? (
                <>
                  <button onClick={() => setMode('register')} className="hover:text-blue-600 text-blue-500 font-medium">¿Es tu primera vez? Activa tu cuenta</button>
                  <button onClick={() => setMode('reset')} className="hover:text-blue-600">¿Olvidaste tu contraseña?</button>
                </>
              ) : (
                <button onClick={() => setMode('login')} className="hover:text-blue-600">Volver al inicio de sesión</button>
              )}
            </div>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">O continuar con</span>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => handleGoogleLogin(false)}
                disabled={isLoggingIn}
                className="w-full bg-white text-gray-700 border border-gray-300 px-6 py-2 rounded-lg hover:bg-gray-50 transition flex items-center justify-center"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 mr-2" alt="Google" />
                Google
              </button>
              <button 
                onClick={() => handleGoogleLogin(true)}
                disabled={isLoggingIn}
                className="w-full bg-white text-gray-500 px-6 py-1 rounded-lg hover:bg-gray-50 transition flex items-center justify-center text-xs"
              >
                ¿Problemas con el pop-up? Usar redirección
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            {/* Main Menu (No Sidebar) */}
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            
            {/* Master Admin Routes (No Sidebar) */}
            <Route path="admin/master-users" element={<ProtectedRoute requireGlobalAdmin><MasterUsers /></ProtectedRoute>} />
            
            {/* Application Layout (With Sidebar) */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="matrix" element={<Matrix />} />
              <Route path="process-map" element={<ProcessMap />} />
              <Route path="training" element={<TrainingActions />} />
              <Route path="statistics" element={<Statistics />} />
              <Route path="ohp" element={<OHP />} />
              
              {/* Admin Routes */}
              <Route path="admin/teams" element={<ProtectedRoute requireAdmin><AdminTeams /></ProtectedRoute>} />
              <Route path="admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
              <Route path="admin/activities" element={<ProtectedRoute requireAdmin><AdminActivities /></ProtectedRoute>} />
              <Route path="admin/processes" element={<ProtectedRoute requireAdmin><AdminProcesses /></ProtectedRoute>} />
              <Route path="admin/tasks" element={<ProtectedRoute requireAdmin><AdminTasks /></ProtectedRoute>} />
              <Route path="admin/criteria" element={<ProtectedRoute requireAdmin><AdminCriteria /></ProtectedRoute>} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
