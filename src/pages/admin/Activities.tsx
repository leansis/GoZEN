import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { Activity } from '../../types';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus, DatabaseBackup } from 'lucide-react';

export default function Activities() {
  const { dbUser, activeCompanyId } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editingActivity, setEditingActivity] = useState<Partial<Activity> | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;

    const q = query(collection(db, 'activities'), where('companyId', '==', companyId || ''));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      setActivities(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [dbUser, activeCompanyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!editingActivity?.name || !dbUser) return;

    const companyId = activeCompanyId || dbUser.companyId;

    try {
      if (editingActivity.id) {
        const ref = doc(db, 'activities', editingActivity.id);
        await updateDoc(ref, {
          name: editingActivity.name,
          description: editingActivity.description || '',
          companyId: companyId || ''
        });
      } else {
        const nextOrder = activities.length > 0 ? Math.max(...activities.map(a => a.order || 0)) + 1 : 0;
        await addDoc(collection(db, 'activities'), {
          name: editingActivity.name,
          description: editingActivity.description || '',
          order: nextOrder,
          companyId: companyId || ''
        });
      }
      setEditingActivity(null);
    } catch (error: any) {
      console.error('Error saving activity:', error);
      setSaveError(error.message || 'Error al guardar la actividad. Verifica los permisos.');
    }
  };

  const handleDelete = async () => {
    if (activityToDelete) {
      try {
        await deleteDoc(doc(db, 'activities', activityToDelete.id));
      } catch (error: any) {
        console.error('Error deleting activity:', error);
        setSaveError(error.message || 'Error al eliminar la actividad. Verifica los permisos.');
      }
    }
  };

  const handleReorder = async (reorderedActivities: Activity[]) => {
    try {
      const batch = writeBatch(db);
      reorderedActivities.forEach((activity, index) => {
        if (activity.order !== index) {
          const ref = doc(db, 'activities', activity.id);
          batch.update(ref, { order: index });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error('Error reordering activities:', error);
      setSaveError('Error al reordenar las actividades.');
    }
  };

  const handleMigrateProcesses = async () => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;
    setIsMigrating(true);
    setSaveError(null);

    try {
      // 1. Find or create "Test" activity
      let testActivityId = activities.find(a => a.name.toLowerCase() === 'test')?.id;
      
      if (!testActivityId) {
        const docRef = await addDoc(collection(db, 'activities'), {
          name: 'Test',
          description: 'Actividad por defecto para procesos migrados',
          companyId: companyId || ''
        });
        testActivityId = docRef.id;
      }

      // 2. Get all processes for the company
      const qProcesses = query(collection(db, 'processes'), where('companyId', '==', companyId || ''));
      const processesSnapshot = await getDocs(qProcesses);
      
      // 3. Update processes that don't have an activityId
      const batch = writeBatch(db);
      let updateCount = 0;

      processesSnapshot.forEach((processDoc) => {
        const processData = processDoc.data();
        if (!processData.activityId) {
          batch.update(processDoc.ref, { activityId: testActivityId });
          updateCount++;
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        alert(`Migración completada. Se actualizaron ${updateCount} procesos.`);
      } else {
        alert('No hay procesos que requieran migración (todos tienen ya una actividad asignada).');
      }
    } catch (error: any) {
      console.error('Error migrating processes:', error);
      setSaveError(error.message || 'Error al migrar los procesos.');
    } finally {
      setIsMigrating(false);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Actividades</h1>
        <div className="flex gap-3">
          <button
            onClick={handleMigrateProcesses}
            disabled={isMigrating}
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            title="Asigna la actividad 'Test' a todos los procesos que no tengan actividad asignada"
          >
            <DatabaseBackup className="w-5 h-5 mr-2" />
            {isMigrating ? 'Migrando...' : 'Migrar Procesos'}
          </button>
          <button
            onClick={() => setEditingActivity({})}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva Actividad
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {saveError}
        </div>
      )}

      <Table<Activity>
        data={[...activities].sort((a, b) => (a.order || 0) - (b.order || 0))}
        columns={[
          { header: 'Actividad', accessor: 'name', sortable: true },
          { header: 'Descripción', accessor: 'description', sortable: true },
        ]}
        onEdit={setEditingActivity}
        onDelete={setActivityToDelete}
        onReorder={handleReorder}
      />

      <ConfirmModal
        isOpen={!!activityToDelete}
        title="Eliminar Actividad"
        message={`¿Estás seguro de que deseas eliminar la actividad ${activityToDelete?.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setActivityToDelete(null)}
      />

      <Modal
        isOpen={!!editingActivity}
        onClose={() => { setEditingActivity(null); setSaveError(null); }}
        title={editingActivity?.id ? "Editar Actividad" : "Nueva Actividad"}
      >
        {editingActivity && (
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
                value={editingActivity.name || ''}
                onChange={(e) => setEditingActivity({ ...editingActivity, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                value={editingActivity.description || ''}
                onChange={(e) => setEditingActivity({ ...editingActivity, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
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
