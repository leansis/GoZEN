import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { User, Company } from '../../types';
import { handleFirestoreError, OperationType } from '../../lib/firestore-utils';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus, Building2, ArrowLeft, LogOut, X } from 'lucide-react';
import clsx from 'clsx';

export default function MasterUsers() {
  const { isAdmin, logout, dbUser } = useAuth();
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
    companyId: ''
  });
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Filters state
  const [filters, setFilters] = useState({
    name: '',
    email: '',
    companyId: '',
    role: '',
    status: ''
  });

  useEffect(() => {
    // Fetch ALL users
    const q = query(collection(db, 'users'));
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
  }, []);

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

  const filteredUsers = users.filter(user => {
    const matchesName = user.name.toLowerCase().includes(filters.name.toLowerCase());
    const matchesEmail = user.email.toLowerCase().includes(filters.email.toLowerCase());
    const matchesCompany = !filters.companyId || user.companyId === filters.companyId;
    const matchesRole = !filters.role || user.role === filters.role;
    const matchesStatus = !filters.status || user.status === filters.status;
    return matchesName && matchesEmail && matchesCompany && matchesRole && matchesStatus;
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 rounded-lg"
            title="Volver al Menú Principal"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gestión Maestra de Usuarios</h1>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Administración Global</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900">{dbUser?.name}</p>
            <p className="text-xs text-blue-600 font-semibold uppercase">{dbUser?.role}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Todos los Usuarios</h2>
              <p className="text-sm text-gray-500">Gestiona usuarios de todas las empresas registradas en el sistema.</p>
            </div>
            <button
              onClick={() => setIsAddingUser(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
            >
              <Plus className="w-5 h-5 mr-2" />
              Nuevo Usuario
            </button>
          </div>

          <div className="p-6">
            {saveError && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                {saveError}
              </div>
            )}

            {/* Filters Section */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1">Nombre</label>
                <input
                  type="text"
                  value={filters.name}
                  onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                  placeholder="Filtrar por nombre..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1">Email</label>
                <input
                  type="text"
                  value={filters.email}
                  onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                  placeholder="Filtrar por email..."
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1">Empresa</label>
                <select
                  value={filters.companyId}
                  onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="">Todas las empresas</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1">Rol</label>
                <select
                  value={filters.role}
                  onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="">Todos los roles</option>
                  <option value="user">Usuario</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="lean_promotor">Lean Promotor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1 ml-1">Estado</label>
                <div className="flex gap-2">
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">Todos los estados</option>
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                  {(filters.name || filters.email || filters.companyId || filters.role || filters.status) && (
                    <button
                      onClick={() => setFilters({ name: '', email: '', companyId: '', role: '', status: '' })}
                      className="px-3 py-2 text-gray-400 hover:text-red-600 bg-white border border-gray-200 rounded-lg transition-colors"
                      title="Limpiar filtros"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <Table<User & { id: string }>
              data={filteredUsers}
              columns={[
                { header: 'Nombre', accessor: 'name' },
                { header: 'Email', accessor: 'email' },
                { 
                  header: 'Empresa', 
                  accessor: (user) => {
                    const company = companies.find(c => c.id === user.companyId);
                    return company ? (
                      <div className="flex items-center text-blue-600 font-medium">
                        <Building2 className="w-4 h-4 mr-1.5 text-blue-400" />
                        {company.name}
                      </div>
                    ) : <span className="text-gray-400 italic">Sin asignar</span>;
                  }
                },
                { 
                  header: 'Rol', 
                  accessor: (user) => (
                    <span className={clsx(
                      "px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider",
                      user.role === 'admin' ? "bg-purple-100 text-purple-700" :
                      user.role === 'lean_promotor' ? "bg-indigo-100 text-indigo-700" :
                      user.role === 'supervisor' ? "bg-blue-100 text-blue-700" :
                      "bg-gray-100 text-gray-700"
                    )}>
                      {user.role}
                    </span>
                  )
                },
                { 
                  header: 'Estado', 
                  accessor: (user) => (
                    <span className={clsx(
                      "flex items-center gap-1.5",
                      user.status === 'active' ? "text-green-600" : "text-red-600"
                    )}>
                      <span className={clsx(
                        "w-2 h-2 rounded-full",
                        user.status === 'active' ? "bg-green-600" : "bg-red-600"
                      )} />
                      {user.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  )
                },
              ]}
              onEdit={setEditingUser}
              onDelete={setUserToDelete}
            />
          </div>
        </div>
      </main>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                required
                value={isAddingUser ? newUser.name : editingUser?.name}
                onChange={(e) => isAddingUser 
                  ? setNewUser({ ...newUser, name: e.target.value })
                  : setEditingUser({ ...editingUser!, name: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                disabled={!isAddingUser}
                required={isAddingUser}
                value={isAddingUser ? newUser.email : editingUser?.email}
                onChange={(e) => isAddingUser && setNewUser({ ...newUser, email: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all ${!isAddingUser ? 'bg-gray-50' : ''}`}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
              <select
                value={isAddingUser ? newUser.companyId : editingUser?.companyId}
                onChange={(e) => isAddingUser
                  ? setNewUser({ ...newUser, companyId: e.target.value })
                  : setEditingUser({ ...editingUser!, companyId: e.target.value })
                }
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              >
                <option value="">Seleccionar Empresa...</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={isAddingUser ? newUser.role : editingUser?.role}
                  onChange={(e) => isAddingUser 
                    ? setNewUser({ ...newUser, role: e.target.value as any })
                    : setEditingUser({ ...editingUser!, role: e.target.value as any })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="user">Usuario</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="lean_promotor">Lean Promotor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={isAddingUser ? newUser.status : editingUser?.status}
                  onChange={(e) => isAddingUser
                    ? setNewUser({ ...newUser, status: e.target.value as any })
                    : setEditingUser({ ...editingUser!, status: e.target.value as any })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6">
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setIsAddingUser(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
              >
                {isAddingUser ? 'Crear Usuario' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
