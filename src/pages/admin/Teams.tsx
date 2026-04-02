import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteField, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../AuthContext';
import { Team, User, Process } from '../../types';
import Table from '../../components/Table';
import Modal from '../../components/Modal';
import ConfirmModal from '../../components/ConfirmModal';
import { Plus } from 'lucide-react';

export default function Teams() {
  const { dbUser, activeCompanyId } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [editingTeam, setEditingTeam] = useState<Partial<Team> | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;

    const qTeams = query(collection(db, 'teams'), where('companyId', '==', companyId || ''));
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      setLoading(false);
    });

    const qUsers = query(collection(db, 'users'), where('companyId', '==', companyId || ''));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User & { id: string })));
    });

    const qProcesses = query(collection(db, 'processes'), where('companyId', '==', companyId || ''));
    const unsubProcesses = onSnapshot(qProcesses, (snapshot) => {
      setProcesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process)));
    });

    return () => {
      unsubTeams();
      unsubUsers();
      unsubProcesses();
    };
  }, [dbUser, activeCompanyId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!editingTeam?.name || !editingTeam?.supervisorId || !dbUser) return;

    const companyId = activeCompanyId || dbUser.companyId;

    try {
      const teamData: any = {
        name: editingTeam.name,
        supervisorId: editingTeam.supervisorId,
        supervisorName: users.find(u => u.uid === editingTeam.supervisorId)?.name || '',
        members: (editingTeam.members || []).map(m => {
          const user = users.find(u => u.uid === m.uid);
          return {
            uid: m.uid,
            name: user ? user.name : m.name,
            photoURL: user?.photoURL || (m as any).photoURL || null
          };
        }),
        processIds: editingTeam.processIds || [],
        companyId: companyId || ''
      };

      if (editingTeam.parentTeamId) {
        teamData.parentTeamId = editingTeam.parentTeamId;
      } else if (editingTeam.id) {
        teamData.parentTeamId = deleteField();
      }

      if (editingTeam.id) {
        await updateDoc(doc(db, 'teams', editingTeam.id), teamData);
      } else {
        await addDoc(collection(db, 'teams'), teamData);
      }
      setEditingTeam(null);
    } catch (error: any) {
      console.error('Error saving team:', error);
      setSaveError(error.message || 'Error al guardar el equipo. Verifica los permisos.');
    }
  };

  const handleDelete = async () => {
    if (teamToDelete) {
      try {
        await deleteDoc(doc(db, 'teams', teamToDelete.id));
      } catch (error: any) {
        console.error('Error deleting team:', error);
        setSaveError(error.message || 'Error al eliminar el equipo. Verifica los permisos.');
      }
    }
  };

  const toggleMember = (uid: string, name: string, photoURL?: string) => {
    if (!editingTeam) return;
    const members = editingTeam.members || [];
    const exists = members.find(m => m.uid === uid);
    if (exists) {
      setEditingTeam({ ...editingTeam, members: members.filter(m => m.uid !== uid) });
    } else {
      setEditingTeam({ ...editingTeam, members: [...members, { uid, name, photoURL } as any] });
    }
  };

  const toggleProcess = (processId: string) => {
    if (!editingTeam) return;
    const processIds = editingTeam.processIds || [];
    if (processIds.includes(processId)) {
      setEditingTeam({ ...editingTeam, processIds: processIds.filter(id => id !== processId) });
    } else {
      setEditingTeam({ ...editingTeam, processIds: [...processIds, processId] });
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Equipos</h1>
        <button
          onClick={() => setEditingTeam({ members: [], processIds: [] })}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nuevo Equipo
        </button>
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {saveError}
        </div>
      )}

      <Table<Team>
        data={teams}
        columns={[
          { header: 'Equipo', accessor: 'name', sortable: true },
          { 
            header: 'Supervisor', 
            accessor: (t) => t.supervisorName || users.find(u => u.uid === t.supervisorId)?.name || 'Desconocido',
            sortable: true,
            sortAccessor: (t) => t.supervisorName || users.find(u => u.uid === t.supervisorId)?.name || ''
          },
          { header: 'Miembros', accessor: (t) => t.members?.length || 0, sortable: true },
          { header: 'Procesos', accessor: (t) => t.processIds?.length || 0, sortable: true },
        ]}
        onEdit={setEditingTeam}
        onDelete={setTeamToDelete}
      />

      <ConfirmModal
        isOpen={!!teamToDelete}
        title="Eliminar Equipo"
        message={`¿Estás seguro de que deseas eliminar el equipo ${teamToDelete?.name}? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setTeamToDelete(null)}
      />

      <Modal
        isOpen={!!editingTeam}
        onClose={() => { setEditingTeam(null); setSaveError(null); }}
        title={editingTeam?.id ? "Editar Equipo" : "Nuevo Equipo"}
      >
        {editingTeam && (
          <form onSubmit={handleSave} className="space-y-4">
            {saveError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {saveError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre del Equipo</label>
              <input
                type="text"
                required
                value={editingTeam.name || ''}
                onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Supervisor</label>
              <select
                required
                value={editingTeam.supervisorId || ''}
                onChange={(e) => setEditingTeam({ ...editingTeam, supervisorId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Seleccionar supervisor...</option>
                {users
                  .filter(u => u.role === 'supervisor' || u.role === 'admin' || u.role === 'lean_promotor')
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(u => (
                    <option key={u.uid} value={u.uid}>{u.name}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Miembros</label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {[...users].sort((a, b) => a.name.localeCompare(b.name)).map(u => (
                  <label key={u.uid} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editingTeam.members?.some(m => m.uid === u.uid) || false}
                      onChange={() => toggleMember(u.uid, u.name, u.photoURL)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Procesos</label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                {processes.map(p => (
                  <label key={p.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editingTeam.processIds?.includes(p.id) || false}
                      onChange={() => toggleProcess(p.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Equipo Padre (Opcional)</label>
              <select
                value={editingTeam.parentTeamId || ''}
                onChange={(e) => setEditingTeam({ ...editingTeam, parentTeamId: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="">Ninguno</option>
                {teams.filter(t => t.id !== editingTeam.id).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setEditingTeam(null)}
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
