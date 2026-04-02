import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, Company } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-utils';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus, Building2, Users as UsersIcon, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Users() {
  const { isAdmin, isLeanPromotor, isGlobalAdmin, activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [editingUser, setEditingUser] = useState<(User & { id: string }) | null>(null);
  const [userToDelete, setUserToDelete] = useState<(User & { id: string }) | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '',
    email: '',
    role: 'user',
    status: 'active',
    companyId: activeCompanyId || ''
  });
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeCompanyId) {
      setNewUser(prev => ({ ...prev, companyId: activeCompanyId }));
    }
  }, [activeCompanyId]);

  useEffect(() => {
    let q = query(collection(db, 'users'));
    if (activeCompanyId) {
      q = query(collection(db, 'users'), where('companyId', '==', activeCompanyId));
    }

    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User & { id: string }));
      setUsers(usersData);
      setLoading(false);
    });

    const unsubscribeCompanies = onSnapshot(collection(db, 'companies'), (snapshot) => {
      const companiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company));
      setCompanies(companiesData);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeCompanies();
    };
  }, [activeCompanyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    
    try {
      if (isAddingUser) {
        if (!newUser.name || !newUser.email) {
          setSaveError('Por favor, completa todos los campos obligatorios.');
          return;
        }
        
        // Use email as document ID for pending users to facilitate migration on first login
        const docId = newUser.email.toLowerCase().trim();
        
        const userToSave: User = {
          uid: docId, // Use email as temporary UID until first login
          name: newUser.name,
          email: newUser.email,
          role: newUser.role as any || 'user',
          status: newUser.status as any || 'active',
          companyId: newUser.companyId || ''
        };
        
        await setDoc(doc(db, 'users', docId), userToSave);
        setIsAddingUser(false);
        setNewUser({ name: '', email: '', role: 'user', status: 'active', companyId: '' });
      } else if (editingUser) {
        const userRef = doc(db, 'users', editingUser.id);
        await updateDoc(userRef, {
          name: editingUser.name,
          role: editingUser.role,
          status: editingUser.status,
          companyId: editingUser.companyId || ''
        });
        setEditingUser(null);
      }
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, isAddingUser ? `users/${newUser.email}` : `users/${editingUser?.id}`);
      setSaveError(error.message || 'Error al guardar el usuario. Verifica los permisos.');
    }
  };

  const handleDelete = async () => {
    if (userToDelete) {
      try {
        await deleteDoc(doc(db, 'users', userToDelete.id));
      } catch (error: any) {
        handleFirestoreError(error, OperationType.DELETE, `users/${userToDelete.id}`);
        setSaveError(error.message || 'Error al eliminar el usuario. Verifica los permisos.');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setSaveError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const batch = writeBatch(db);
      let count = 0;

      for (const row of jsonData as any[]) {
        const name = row['Nombre'] || row['Name'] || row['nombre'] || row['name'];
        const email = row['Email'] || row['Correo'] || row['email'] || row['correo'];
        let role = (row['Rol'] || row['Role'] || row['rol'] || row['role'] || 'user').toString().toLowerCase();

        if (!name || !email) continue;

        // Map roles
        if (role === 'administrador') role = 'admin';
        if (role === 'promotor' || role === 'lean promotor') role = 'lean_promotor';
        if (!['admin', 'supervisor', 'user', 'lean_promotor'].includes(role)) {
          role = 'user';
        }

        // Only global admin can create admins via excel, otherwise fallback to lean_promotor or user
        if (role === 'admin' && !isGlobalAdmin) {
          role = 'lean_promotor';
        }

        const docId = email.toLowerCase().trim();
        const userRef = doc(db, 'users', docId);
        
        batch.set(userRef, {
          uid: docId,
          name: name.toString().trim(),
          email: docId,
          role: role,
          status: 'active',
          companyId: activeCompanyId || ''
        });
        count++;
      }

      if (count > 0) {
        await batch.commit();
        alert(`Se han importado ${count} usuarios correctamente.`);
      } else {
        setSaveError('No se encontraron usuarios válidos en el archivo. Asegúrate de que tenga las columnas Nombre, Email y Rol.');
      }
    } catch (error: any) {
      console.error('Error importing users:', error);
      setSaveError('Error al importar usuarios: ' + error.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Volver al Menú Principal"
          >
            <Plus className="w-6 h-6 rotate-45" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
        </div>
        <div className="flex gap-3">
          <input
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            title="Importar usuarios desde Excel (Columnas: Nombre, Email, Rol)"
          >
            <Upload className="w-5 h-5 mr-2" />
            {isImporting ? 'Importando...' : 'Importar Excel'}
          </button>
          <button
            onClick={() => setIsAddingUser(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {saveError}
        </div>
      )}

      <Table<User & { id: string }>
        data={users}
        columns={[
          { header: 'Nombre', accessor: 'name', sortable: true },
          { header: 'Email', accessor: 'email', sortable: true },
          { 
            header: 'Empresa', 
            accessor: (user) => {
              const company = companies.find(c => c.id === user.companyId);
              return company ? (
                <div className="flex items-center">
                  <Building2 className="w-4 h-4 mr-1 text-gray-400" />
                  {company.name}
                </div>
              ) : <span className="text-gray-400 italic">Sin asignar</span>;
            },
            sortable: true,
            sortAccessor: (user) => companies.find(c => c.id === user.companyId)?.name || ''
          },
          { header: 'Rol', accessor: 'role', sortable: true },
          { header: 'Estado', accessor: 'status', sortable: true },
        ]}
        onEdit={setEditingUser}
        onDelete={setUserToDelete}
      />

      <ConfirmModal
        isOpen={!!userToDelete}
        title="Eliminar Usuario"
        message={`¿Estás seguro de que deseas eliminar al usuario ${userToDelete?.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setUserToDelete(null)}
      />

      <Modal
        isOpen={!!editingUser || isAddingUser}
        onClose={() => {
          setEditingUser(null);
          setIsAddingUser(false);
          setSaveError(null);
        }}
        title={isAddingUser ? "Añadir Usuario" : "Editar Usuario"}
      >
        {(editingUser || isAddingUser) && (
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {saveError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre</label>
              <input
                type="text"
                required
                value={isAddingUser ? newUser.name : editingUser?.name}
                onChange={(e) => isAddingUser 
                  ? setNewUser({ ...newUser, name: e.target.value })
                  : setEditingUser({ ...editingUser!, name: e.target.value })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                disabled={!isAddingUser}
                required={isAddingUser}
                value={isAddingUser ? newUser.email : editingUser?.email}
                onChange={(e) => isAddingUser && setNewUser({ ...newUser, email: e.target.value })}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border ${!isAddingUser ? 'bg-gray-50' : ''}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Empresa</label>
              <select
                disabled={!isGlobalAdmin}
                value={isAddingUser ? newUser.companyId : editingUser?.companyId}
                onChange={(e) => isAddingUser
                  ? setNewUser({ ...newUser, companyId: e.target.value })
                  : setEditingUser({ ...editingUser!, companyId: e.target.value })
                }
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border ${!isGlobalAdmin ? 'bg-gray-50' : ''}`}
              >
                <option value="">Seleccionar Empresa...</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Rol</label>
              <select
                value={isAddingUser ? newUser.role : editingUser?.role}
                onChange={(e) => isAddingUser 
                  ? setNewUser({ ...newUser, role: e.target.value as any })
                  : setEditingUser({ ...editingUser!, role: e.target.value as any })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              >
                <option value="user">Usuario</option>
                <option value="supervisor">Supervisor</option>
                <option value="lean_promotor">Lean Promotor</option>
                {isGlobalAdmin && <option value="admin">Admin</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Estado</label>
              <select
                value={isAddingUser ? newUser.status : editingUser?.status}
                onChange={(e) => isAddingUser
                  ? setNewUser({ ...newUser, status: e.target.value as any })
                  : setEditingUser({ ...editingUser!, status: e.target.value as any })
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setIsAddingUser(false);
                }}
                className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
              >
                Guardar
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
