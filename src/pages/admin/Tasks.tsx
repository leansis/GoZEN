import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { Task, Process, Criterion, Attachment, Activity } from '../../types';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus, Upload, Loader2 } from 'lucide-react';

export default function Tasks() {
  const { dbUser, activeCompanyId } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;

    const qTasks = query(collection(db, 'tasks'), where('companyId', '==', companyId || ''));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      setLoading(false);
    });

    const qProcesses = query(collection(db, 'processes'), where('companyId', '==', companyId || ''));
    const unsubProcesses = onSnapshot(qProcesses, (snapshot) => {
      setProcesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process)));
    });

    const qCriteria = query(collection(db, 'criteria'), where('companyId', '==', companyId || ''));
    const unsubCriteria = onSnapshot(qCriteria, (snapshot) => {
      setCriteria(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Criterion)));
    });

    const qActivities = query(collection(db, 'activities'), where('companyId', '==', companyId || ''));
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
    });

    return () => {
      unsubTasks();
      unsubProcesses();
      unsubCriteria();
      unsubActivities();
    };
  }, [dbUser, activeCompanyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!editingTask?.name || !editingTask?.processId || !editingTask?.criteriaId || !dbUser) return;

    const companyId = activeCompanyId || dbUser.companyId;

    try {
      const taskData: any = {
        name: editingTask.name,
        processId: editingTask.processId,
        criteriaId: editingTask.criteriaId,
        attachments: (editingTask.attachments || []).filter(att => {
          const url = typeof att === 'string' ? att : att.url;
          return url && url.trim() !== '';
        }),
        companyId: companyId || ''
      };

      if (editingTask.id) {
        await updateDoc(doc(db, 'tasks', editingTask.id), taskData);
      } else {
        const nextOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order || 0)) + 1 : 0;
        taskData.order = nextOrder;
        await addDoc(collection(db, 'tasks'), taskData);
      }
      setEditingTask(null);
    } catch (error: any) {
      console.error('Error saving task:', error);
      setSaveError(error.message || 'Error al guardar la tarea. Verifica los permisos.');
    }
  };

  const handleDelete = async () => {
    if (taskToDelete) {
      try {
        await deleteDoc(doc(db, 'tasks', taskToDelete.id));
      } catch (error: any) {
        console.error('Error deleting task:', error);
        setSaveError(error.message || 'Error al eliminar la tarea. Verifica los permisos.');
      }
    }
  };

  const handleReorder = async (reorderedTasks: Task[]) => {
    try {
      const batch = writeBatch(db);
      reorderedTasks.forEach((task, index) => {
        if (task.order !== index) {
          const ref = doc(db, 'tasks', task.id);
          batch.update(ref, { order: index });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error('Error reordering tasks:', error);
      setSaveError('Error al reordenar las tareas.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingIndex(index);
      const storageRef = ref(storage, `tasks/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const newAtts = [...(editingTask?.attachments || [])];
      const currentName = typeof newAtts[index] === 'string' ? newAtts[index] : (newAtts[index] as Attachment).name;
      
      newAtts[index] = { 
        name: currentName || file.name, 
        url 
      };
      
      setEditingTask({ ...editingTask!, attachments: newAtts });
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir el archivo. Asegúrate de que Firebase Storage está configurado y tienes permisos.');
    } finally {
      setUploadingIndex(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) return <div>Cargando...</div>;

  const sortedProcesses = [...processes].sort((a, b) => (a.order || 0) - (b.order || 0));
  const unassignedTasks = tasks.filter(t => !t.processId).sort((a, b) => (a.order || 0) - (b.order || 0));

  const filterTasks = (taskList: Task[]) => {
    if (!globalSearch) return taskList;
    const lower = globalSearch.toLowerCase();
    return taskList.filter(t => 
      t.name.toLowerCase().includes(lower)
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tareas</h1>
        <button
          onClick={() => setEditingTask({ attachments: [] })}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nueva Tarea
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
          placeholder="Buscar tareas..."
          value={globalSearch}
          onChange={(e) => setGlobalSearch(e.target.value)}
          className="w-full md:w-1/3 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="space-y-8">
        {sortedProcesses.map(process => {
          const processTasks = tasks
            .filter(t => t.processId === process.id)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          
          const filteredProcessTasks = filterTasks(processTasks);

          if (filteredProcessTasks.length === 0 && globalSearch) return null;

          const activity = activities.find(a => a.id === process.activityId);

          return (
            <div key={process.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-800">{process.name}</h2>
                  {activity && (
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                      {activity.name}
                    </span>
                  )}
                </div>
                {process.description && <p className="text-sm text-gray-500 mt-1">{process.description}</p>}
              </div>
              <Table<Task>
                data={filteredProcessTasks}
                columns={[
                  { header: 'Tarea', accessor: 'name', sortable: true },
                  { 
                    header: 'Criterio', 
                    accessor: (t) => criteria.find(c => c.id === t.criteriaId)?.name || 'Desconocido',
                    sortable: true,
                    sortAccessor: (t) => criteria.find(c => c.id === t.criteriaId)?.name || ''
                  },
                  { header: 'Adjuntos', accessor: (t) => t.attachments?.length || 0 },
                ]}
                onEdit={setEditingTask}
                onDelete={setTaskToDelete}
                onReorder={handleReorder}
                searchable={false}
              />
            </div>
          );
        })}

        {(unassignedTasks.length > 0 || (!globalSearch && tasks.length === 0)) && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-500">Sin Proceso Asignado</h2>
              <p className="text-sm text-gray-400 mt-1">Tareas que no pertenecen a ningún proceso</p>
            </div>
            <Table<Task>
              data={filterTasks(unassignedTasks)}
              columns={[
                { header: 'Tarea', accessor: 'name', sortable: true },
                { 
                  header: 'Criterio', 
                  accessor: (t) => criteria.find(c => c.id === t.criteriaId)?.name || 'Desconocido',
                  sortable: true,
                  sortAccessor: (t) => criteria.find(c => c.id === t.criteriaId)?.name || ''
                },
                { header: 'Adjuntos', accessor: (t) => t.attachments?.length || 0 },
              ]}
              onEdit={setEditingTask}
              onDelete={setTaskToDelete}
              onReorder={handleReorder}
              searchable={false}
            />
          </div>
        )}

        {processes.length === 0 && tasks.length === 0 && (
          <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
            No hay tareas ni procesos disponibles. Crea uno nuevo para comenzar.
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!taskToDelete}
        title="Eliminar Tarea"
        message={`¿Estás seguro de que deseas eliminar la tarea ${taskToDelete?.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setTaskToDelete(null)}
      />

      <Modal
        isOpen={!!editingTask}
        onClose={() => { setEditingTask(null); setSaveError(null); }}
        title={editingTask?.id ? "Editar Tarea" : "Nueva Tarea"}
      >
        {editingTask && (
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {saveError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre de la Tarea</label>
              <input
                type="text"
                required
                value={editingTask.name || ''}
                onChange={(e) => setEditingTask({ ...editingTask, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Proceso</label>
              <select
                required
                value={editingTask.processId || ''}
                onChange={(e) => setEditingTask({ ...editingTask, processId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Seleccionar proceso...</option>
                {processes.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Criterio de evaluación</label>
              <select
                required
                value={editingTask.criteriaId || ''}
                onChange={(e) => setEditingTask({ ...editingTask, criteriaId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Seleccionar criterio...</option>
                {criteria.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Documentos Adjuntos</label>
              <div className="space-y-2">
                {(editingTask.attachments || []).map((att, index) => {
                  // Handle legacy string attachments
                  const url = typeof att === 'string' ? att : att.url;
                  const name = typeof att === 'string' ? att : att.name;
                  
                  return (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        const newAtts = [...(editingTask.attachments || [])];
                        newAtts[index] = { name: e.target.value, url };
                        setEditingTask({ ...editingTask, attachments: newAtts });
                      }}
                      className="w-1/3 rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Nombre (ej: Manual)"
                    />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        const newAtts = [...(editingTask.attachments || [])];
                        newAtts[index] = { name, url: e.target.value };
                        setEditingTask({ ...editingTask, attachments: newAtts });
                      }}
                      className="flex-1 rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
                      placeholder="https://ejemplo.com/doc.pdf"
                    />
                    <div className="relative flex items-center">
                      <input
                        type="file"
                        className="hidden"
                        id={`file-upload-${index}`}
                        onChange={(e) => handleFileUpload(e, index)}
                        disabled={uploadingIndex === index}
                      />
                      <label
                        htmlFor={`file-upload-${index}`}
                        className={`p-2 rounded-md cursor-pointer flex items-center justify-center transition-colors ${
                          uploadingIndex === index 
                            ? 'bg-gray-100 text-gray-400' 
                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                        title="Subir archivo"
                      >
                        {uploadingIndex === index ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newAtts = [...(editingTask.attachments || [])];
                        newAtts.splice(index, 1);
                        setEditingTask({ ...editingTask, attachments: newAtts });
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )})}
                <button
                  type="button"
                  onClick={() => {
                    setEditingTask({ 
                      ...editingTask, 
                      attachments: [...(editingTask.attachments || []), { name: '', url: '' }] 
                    });
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center mt-2"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Añadir adjunto
                </button>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
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
