import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Building2, Users, ArrowRight, LogOut, Plus, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Company } from '../types';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function Home() {
  const { user, dbUser, isAdmin, isLeanPromotor, logout, setActiveCompanyId, company } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAddingCompany, setIsAddingCompany] = React.useState(false);
  const [newCompanyName, setNewCompanyName] = React.useState('');
  const [companyToDelete, setCompanyToDelete] = React.useState<Company | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const isGlobalAdmin = user?.email === 'migcormar@gmail.com';

  React.useEffect(() => {
    if (isAdmin) {
      let q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
      
      // If lean promotor, only show their company
      if (isLeanPromotor && dbUser?.companyId) {
        q = query(collection(db, 'companies'), where('__name__', '==', dbUser.companyId));
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setCompanies(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Company)));
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'companies');
      });
      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, [isAdmin, isLeanPromotor, dbUser?.companyId]);

  const handleAccessCompany = (id: string) => {
    setActiveCompanyId(id);
    navigate('/matrix');
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    try {
      await addDoc(collection(db, 'companies'), {
        name: newCompanyName,
        createdAt: new Date().toISOString()
      });
      setNewCompanyName('');
      setIsAddingCompany(false);
    } catch (err: any) {
      console.error("Error adding company:", err);
      setError("Error al añadir la empresa: " + err.message);
    }
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;
    try {
      await deleteDoc(doc(db, 'companies', companyToDelete.id));
      setCompanyToDelete(null);
    } catch (err: any) {
      console.error("Error deleting company:", err);
      setError("Error al eliminar la empresa: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">GoZEN</h1>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{dbUser?.name}</p>
            <p className="text-xs text-gray-500 uppercase">{dbUser?.role}</p>
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

      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        {isAdmin ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-gray-900">Panel de Administración</h2>
              <div className="flex gap-3">
                {isGlobalAdmin && (
                  <>
                    <button
                      onClick={() => setIsAddingCompany(true)}
                      className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      <Plus size={20} />
                      <span>Nueva Empresa</span>
                    </button>
                    <button
                      onClick={() => navigate('/admin/master-users')}
                      className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <Users size={20} className="text-blue-600" />
                      <span>Gestión Maestra de Usuarios</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all group cursor-pointer relative"
                  onClick={() => handleAccessCompany(company.id)}
                >
                  {isGlobalAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompanyToDelete(company);
                      }}
                      className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 z-10 bg-white rounded-full shadow-sm border border-gray-100"
                      title="Eliminar empresa"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                      <Building2 size={24} />
                    </div>
                    <div className="text-gray-400 group-hover:text-blue-600 transition-colors pr-6">
                      <ArrowRight size={20} />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{company.name}</h3>
                  <p className="text-sm text-gray-500">ID: {company.id}</p>
                  
                  <div className="mt-6 pt-6 border-t border-gray-100 flex gap-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAccessCompany(company.id);
                      }}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Acceder
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveCompanyId(company.id);
                        navigate('/admin/teams');
                      }}
                      className="text-sm font-medium text-gray-600 hover:text-gray-700"
                    >
                      Configurar
                    </button>
                  </div>
                </div>
              ))}
              {companies.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                  No hay empresas registradas. Comienza creando una nueva.
                </div>
              )}
            </div>

            {/* Add Company Modal */}
            <Modal
              isOpen={isAddingCompany}
              onClose={() => setIsAddingCompany(false)}
              title="Añadir Nueva Empresa"
            >
              <form onSubmit={handleAddCompany} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Empresa</label>
                  <input
                    type="text"
                    required
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Ej: Mi Empresa S.L."
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddingCompany(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all font-medium"
                  >
                    Crear Empresa
                  </button>
                </div>
              </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
              isOpen={!!companyToDelete}
              onCancel={() => setCompanyToDelete(null)}
              onConfirm={handleDeleteCompany}
              title="Eliminar Empresa"
              message={`¿Estás seguro de que deseas eliminar la empresa "${companyToDelete?.name}"? Esta acción eliminará permanentemente la empresa y todos sus datos asociados. Esta acción no se puede deshacer.`}
            />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto text-center py-12">
            {!dbUser?.companyId ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users size={32} />
                </div>
                <h2 className="text-2xl font-bold text-amber-900 mb-4">Acceso Restringido</h2>
                <p className="text-amber-700 mb-8">
                  Tu cuenta aún no ha sido asignada a ninguna empresa. Por favor, contacta con el administrador o lean promotor del sistema para obtener acceso.
                </p>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-2 bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition"
                >
                  <LogOut size={20} />
                  Cerrar Sesión
                </button>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-3xl p-12 shadow-sm">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8">
                  <Building2 size={40} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido a GoZEN</h2>
                <p className="text-gray-500 mb-10 text-lg">
                  Has accedido como miembro de <span className="font-bold text-gray-900">{company?.name || 'tu empresa'}</span>.
                </p>
                
                <button
                  onClick={() => navigate('/matrix')}
                  className="w-full max-w-sm bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-3 mx-auto"
                >
                  Entrar a la Aplicación
                  <ArrowRight size={24} />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-gray-400 text-sm">
        &copy; {new Date().getFullYear()} GoZEN - Sistema de Gestión de Polivalencia
      </footer>
    </div>
  );
}
