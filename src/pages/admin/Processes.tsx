import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { Process, Activity } from '../../types';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus } from 'lucide-react';

export default function Processes() {
  const { dbUser, activeCompanyId } = useAuth();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editingProcess, setEditingProcess] = useState<Partial<Process> | null>(null);
  const [processToDelete, setProcessToDelete] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;

    const qProcesses = query(collection(db, 'processes'), where('companyId', '==', companyId || ''));
    const unsubProcesses = onSnapshot(qProcesses, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process));
      setProcesses(data);
      setLoading(false);
    });

    const qActivities = query(collection(db, 'activities'), where('companyId', '==', companyId || ''));
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      setActivities(data);
    });

    return () => {
      unsubProcesses();
      unsubActivities();
    };
  }, [dbUser, activeCompanyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!editingProcess?.name || !editingProcess?.description || !dbUser) return;

    const companyId = activeCompanyId || dbUser.companyId;

    try {
      const processData: any = {
        name: editingProcess.name,
        description: editingProcess.description,
        companyId: companyId || ''
      };

      if (editingProcess.activityId) {
        processData.activityId = editingProcess.activityId;
      }

      if (editingProcess.id) {
        const ref = doc(db, 'processes', editingProcess.id);
        await updateDoc(ref, processData);
      } else {
        const nextOrder = processes.length > 0 ? Math.max(...processes.map(p => p.order || 0)) + 1 : 0;
        processData.order = nextOrder;
        await addDoc(collection(db, 'processes'), processData);
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

  const handleReorder = async (reorderedProcesses: Process[]) => {
    try {
      const batch = writeBatch(db);
      reorderedProcesses.forEach((process, index) => {
        if (process.order !== index) {
          const ref = doc(db, 'processes', process.id);
          batch.update(ref, { order: index });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error('Error reordering processes:', error);
      setSaveError('Error al reordenar los procesos.');
    }
  };

  const [globalSearch, setGlobalSearch] = useState('');

  if (loading) return <div>Cargando...</div>;

  const sortedActivities = [...activities].sort((a, b) => (a.order || 0) - (b.order || 0));
  const unassignedProcesses = processes.filter(p => !p.activityId).sort((a, b) => (a.order || 0) - (b.order || 0));

  const filterProcesses = (processList: Process[]) => {
    if (!globalSearch) return processList;
    const lower = globalSearch.toLowerCase();
    return processList.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      p.description.toLowerCase().includes(lower)
    );
  };

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

      <div className="mb-6">
        <input
          type="text"
          placeholder="Buscar procesos..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="space-y-8">
        {sortedActivities.map(activity => {
          const activityProcesses = processes
            .filter(p => p.activityId === activity.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          
          const filteredActivityProcesses = filterProcesses(activityProcesses);

          if (filteredActivityProcesses.length === 0 && globalSearch) return null;

          return (
            <div key={activity.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-800">{activity.name}</h2>
                {activity.description && <p className="text-sm text-gray-500 mt-1">{activity.description}</p>}
              </div>
              <Table<Process>
                data={filteredActivityProcesses}
                columns={[
                  { header: 'Proceso', accessor: 'name', sortable: true },
                  { header: 'Descripción', accessor: 'description', sortable: true },
                ]}
                onEdit={setEditingProcess}
                onDelete={setProcessToDelete}
                onReorder={handleReorder}
                searchable={false}
              />
            </div>
          );
        })}

        {(unassignedProcesses.length > 0 || (!globalSearch && processes.length === 0)) && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-500">Sin Actividad Asignada</h2>
              <p className="text-sm text-gray-400 mt-1">Procesos que no pertenecen a ninguna actividad</p>
            </div>
            <Table<Process>
              data={filterProcesses(unassignedProcesses)}
              columns={[
                { header: 'Proceso', accessor: 'name', sortable: true },
                { header: 'Descripción', accessor: 'description', sortable: true },
              ]}
              onEdit={setEditingProcess}
              onDelete={setProcessToDelete}
              onReorder={handleReorder}
              searchable={false}
            />
          </div>
        )}

        {activities.length === 0 && processes.length === 0 && (
          <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
            No hay procesos ni actividades disponibles. Crea uno nuevo para comenzar.
          </div>
        )}
      </div>

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
            <div>
              <label className="block text-sm font-medium text-gray-700">Actividad</label>
              <select
                value={editingProcess.activityId || ''}
                onChange={(e) => setEditingProcess({ ...editingProcess, activityId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Seleccionar actividad...</option>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
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
