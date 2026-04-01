import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { Process } from '../../types';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus } from 'lucide-react';

export default function Processes() {
  const { dbUser, activeCompanyId } = useAuth();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [editingProcess, setEditingProcess] = useState<Partial<Process> | null>(null);
  const [processToDelete, setProcessToDelete] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;

    const q = query(collection(db, 'processes'), where('companyId', '==', companyId || ''));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process));
      setProcesses(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [dbUser, activeCompanyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!editingProcess?.name || !editingProcess?.description || !dbUser) return;

    const companyId = activeCompanyId || dbUser.companyId;

    try {
      if (editingProcess.id) {
        const ref = doc(db, 'processes', editingProcess.id);
        await updateDoc(ref, {
          name: editingProcess.name,
          description: editingProcess.description,
          companyId: companyId || ''
        });
      } else {
        await addDoc(collection(db, 'processes'), {
          name: editingProcess.name,
          description: editingProcess.description,
          companyId: companyId || ''
        });
      }
      setEditingProcess(null);
    } catch (error: any) {
      console.error('Error saving process:', error);
      setSaveError(error.message || 'Error al guardar el proceso. Verifica los permisos.');
    }
  };

  const handleDelete = async () => {
    if (processToDelete) {
      try {
        await deleteDoc(doc(db, 'processes', processToDelete.id));
      } catch (error: any) {
        console.error('Error deleting process:', error);
        setSaveError(error.message || 'Error al eliminar el proceso. Verifica los permisos.');
      }
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Procesos</h1>
        <button
          onClick={() => setEditingProcess({})}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Proceso
        </button>
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {saveError}
        </div>
      )}

      <Table<Process>
        data={processes}
        columns={[
          { header: 'Proceso', accessor: 'name' },
          { header: 'Descripción', accessor: 'description' },
        ]}
        onEdit={setEditingProcess}
        onDelete={setProcessToDelete}
      />

      <ConfirmModal
        isOpen={!!processToDelete}
        title="Eliminar Proceso"
        message={`¿Estás seguro de que deseas eliminar el proceso ${processToDelete?.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setProcessToDelete(null)}
      />

      <Modal
        isOpen={!!editingProcess}
        onClose={() => { setEditingProcess(null); setSaveError(null); }}
        title={editingProcess?.id ? "Editar Proceso" : "Nuevo Proceso"}
      >
        {editingProcess && (
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
                value={editingProcess.name || ''}
                onChange={(e) => setEditingProcess({ ...editingProcess, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                required
                value={editingProcess.description || ''}
                onChange={(e) => setEditingProcess({ ...editingProcess, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setEditingProcess(null)}
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
