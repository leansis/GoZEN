import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { Criterion, CriterionLevel, CriterionItem } from '../../types';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus, Trash2 } from 'lucide-react';

export default function Criteria() {
  const { dbUser, activeCompanyId } = useAuth();
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [editingCriterion, setEditingCriterion] = useState<Partial<Criterion> | null>(null);
  const [criterionToDelete, setCriterionToDelete] = useState<Criterion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;

    const q = query(collection(db, 'criteria'), where('companyId', '==', companyId || ''));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Criterion));
      setCriteria(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [dbUser, activeCompanyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!editingCriterion?.name || !editingCriterion?.levels || !dbUser) return;

    const companyId = activeCompanyId || dbUser.companyId;

    try {
      if (editingCriterion.id) {
        const ref = doc(db, 'criteria', editingCriterion.id);
        await updateDoc(ref, {
          name: editingCriterion.name,
          levels: editingCriterion.levels,
          companyId: companyId || ''
        });
      } else {
        await addDoc(collection(db, 'criteria'), {
          name: editingCriterion.name,
          levels: editingCriterion.levels,
          companyId: companyId || ''
        });
      }
      setEditingCriterion(null);
    } catch (error: any) {
      console.error('Error saving criterion:', error);
      setSaveError(error.message || 'Error al guardar el criterio. Verifica los permisos.');
    }
  };

  const handleDelete = async () => {
    if (criterionToDelete) {
      try {
        await deleteDoc(doc(db, 'criteria', criterionToDelete.id));
      } catch (error: any) {
        console.error('Error deleting criterion:', error);
        setSaveError(error.message || 'Error al eliminar el criterio. Verifica los permisos.');
      }
    }
  };

  const createNewCriterion = () => {
    setEditingCriterion({
      name: '',
      levels: [
        { level: 1, items: [] },
        { level: 2, items: [] },
        { level: 3, items: [] },
        { level: 4, items: [] },
      ]
    });
  };

  const addItem = (levelIndex: number) => {
    if (!editingCriterion?.levels) return;
    const newLevels = editingCriterion.levels.map((level, i) => 
      i === levelIndex ? { ...level, items: [...(level.items || []), { id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15), description: '' }] } : level
    );
    setEditingCriterion({ ...editingCriterion, levels: newLevels });
  };

  const updateItem = (levelIndex: number, itemIndex: number, desc: string) => {
    if (!editingCriterion?.levels) return;
    const newLevels = editingCriterion.levels.map((level, i) => {
      if (i === levelIndex) {
        const newItems = (level.items || []).map((item, j) => 
          j === itemIndex ? { ...item, description: desc } : item
        );
        return { ...level, items: newItems };
      }
      return level;
    });
    setEditingCriterion({ ...editingCriterion, levels: newLevels });
  };

  const removeItem = (levelIndex: number, itemIndex: number) => {
    if (!editingCriterion?.levels) return;
    const newLevels = editingCriterion.levels.map((level, i) => {
      if (i === levelIndex) {
        const newItems = (level.items || []).filter((_, j) => j !== itemIndex);
        return { ...level, items: newItems };
      }
      return level;
    });
    setEditingCriterion({ ...editingCriterion, levels: newLevels });
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Criterios</h1>
        <button
          onClick={createNewCriterion}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Criterio
        </button>
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {saveError}
        </div>
      )}

      <Table<Criterion>
        data={criteria}
        columns={[
          { header: 'Nombre', accessor: 'name' },
          { header: 'Niveles configurados', accessor: (c) => c.levels.length },
        ]}
        onEdit={setEditingCriterion}
        onDelete={setCriterionToDelete}
      />

      <ConfirmModal
        isOpen={!!criterionToDelete}
        title="Eliminar Criterio"
        message={`¿Estás seguro de que deseas eliminar el criterio ${criterionToDelete?.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setCriterionToDelete(null)}
      />

      <Modal
        isOpen={!!editingCriterion}
        onClose={() => { setEditingCriterion(null); setSaveError(null); }}
        title={editingCriterion?.id ? "Editar Criterio" : "Nuevo Criterio"}
      >
        {editingCriterion && (
          <form onSubmit={handleSave} className="space-y-6">
            {saveError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {saveError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre del Criterio</label>
              <input
                type="text"
                required
                value={editingCriterion.name || ''}
                onChange={(e) => setEditingCriterion({ ...editingCriterion, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
              {editingCriterion.levels?.map((level, levelIndex) => (
                <div key={levelIndex} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-2">Nivel {level.level}</h4>
                  
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-500">Ítems a cumplir</label>
                    {(level.items || []).map((item, itemIndex) => (
                      <div key={item.id} className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) => updateItem(levelIndex, itemIndex, e.target.value)}
                          className="flex-1 rounded-md border-gray-300 shadow-sm p-2 border text-sm"
                          placeholder="Descripción del ítem"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(levelIndex, itemIndex)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addItem(levelIndex)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Añadir ítem
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end pt-4 border-t">
              <button
                type="button"
                onClick={() => setEditingCriterion(null)}
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
