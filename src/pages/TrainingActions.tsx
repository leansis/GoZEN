import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { TrainingAction, Task, User, Team } from '../types';
import Table from '../components/Table';
import { format } from 'date-fns';

export default function TrainingActions() {
  const { dbUser, isAdmin, isSupervisor, activeCompanyId } = useAuth();
  const [actions, setActions] = useState<TrainingAction[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<(User & { id: string })[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const isCurrentUser = (uid: string) => {
    if (!dbUser) return false;
    return uid === dbUser.uid || uid.toLowerCase() === dbUser.email.toLowerCase();
  };

  const availableStatuses = [
    { value: 'planificada', label: 'Planificada' },
    { value: 'retrasada', label: 'Retrasada' },
    { value: 'completada', label: 'Completada' },
    { value: 'verificada', label: 'Verificada' }
  ];

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;

    if (!companyId && !isAdmin) {
      setLoading(false);
      return;
    }

    const qActions = query(collection(db, 'trainingActions'), where('companyId', '==', companyId || ''));
    const unsubActions = onSnapshot(qActions, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingAction));
      
      // Auto-update status to 'retrasada' if needed
      if (isAdmin || isSupervisor) {
        const today = new Date().toISOString().split('T')[0];
        data.forEach(action => {
          let computedStatus = action.status;
          if (action.verificationDate) computedStatus = 'verificada';
          else if (action.endDate) computedStatus = 'completada';
          else if (action.plannedDate < today) computedStatus = 'retrasada';
          else computedStatus = 'planificada';

          if (action.status !== computedStatus) {
            updateDoc(doc(db, 'trainingActions', action.id), { status: computedStatus }).catch(console.error);
          }
        });
      }

      if (isAdmin) {
        setActions(data);
      } else if (isSupervisor) {
        // In a real app, filter by supervisor's team members
        setActions(data);
      } else {
        setActions(data.filter(a => a.userId === dbUser?.uid));
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trainingActions');
    });

    const qTasks = query(collection(db, 'tasks'), where('companyId', '==', companyId || ''));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    let unsubUsers: (() => void) | undefined;
    if (isAdmin || isSupervisor) {
      const qUsers = query(collection(db, 'users'), where('companyId', '==', companyId || ''));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User & { id: string })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    }

    const qTeams = query(collection(db, 'teams'), where('companyId', '==', companyId || ''));
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    return () => {
      unsubActions();
      unsubTasks();
      if (unsubUsers) unsubUsers();
      unsubTeams();
    };
  }, [dbUser, isAdmin, isSupervisor, activeCompanyId]);

  const getComputedStatus = (action: TrainingAction) => {
    if (action.verificationDate) return 'verificada';
    if (action.endDate) return 'completada';
    const today = new Date().toISOString().split('T')[0];
    if (action.plannedDate < today) return 'retrasada';
    return 'planificada';
  };

  const handleEndDateChange = async (action: TrainingAction, newDate: string) => {
    if (!isAdmin && !isSupervisor && dbUser?.uid !== action.trainerId) return;

    try {
      const updateData: any = {};
      if (newDate) {
        updateData.endDate = newDate;
        updateData.status = action.verificationDate ? 'verificada' : 'completada';
      } else {
        updateData.endDate = deleteField();
        const today = new Date().toISOString().split('T')[0];
        updateData.status = action.plannedDate < today ? 'retrasada' : 'planificada';
      }

      await updateDoc(doc(db, 'trainingActions', action.id), updateData);
    } catch (error) {
      console.error('Error updating end date:', error);
      alert('Error al actualizar la fecha de fin');
    }
  };

  const handleDescriptionChange = async (action: TrainingAction, newDescription: string) => {
    if (!isAdmin && !isSupervisor && dbUser?.uid !== action.trainerId) return;

    try {
      await updateDoc(doc(db, 'trainingActions', action.id), { description: newDescription });
    } catch (error) {
      console.error('Error updating description:', error);
      alert('Error al actualizar la descripción');
    }
  };

  const handleVerificationChange = async (action: TrainingAction, checked: boolean) => {
    try {
      const updateData: any = {};
      if (checked) {
        updateData.verifierId = dbUser?.uid;
        updateData.verifierName = dbUser?.name;
        updateData.verificationDate = new Date().toISOString().split('T')[0];
        updateData.status = 'verificada';
      } else {
        updateData.verifierId = deleteField();
        updateData.verifierName = deleteField();
        updateData.verificationDate = deleteField();
        updateData.status = 'completada';
      }
      await updateDoc(doc(db, 'trainingActions', action.id), updateData);
    } catch (error) {
      console.error('Error updating verification:', error);
      alert('Error al actualizar la verificación');
    }
  };

  const canVerify = (action: TrainingAction) => {
    if (!action.endDate) return false;
    if (isAdmin) return true;
    if (!isSupervisor) return false;
    
    // Check if user is supervisor of a team that has the process of this task
    const task = tasks.find(t => t.id === action.taskId);
    if (!task) return false;
    
    return teams.some(team => isCurrentUser(team.supervisorId) && team.processIds.includes(task.processId));
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const filteredAndSortedActions = actions
    .filter(action => {
      if (statusFilter.length === 0) return true;
      return statusFilter.includes(getComputedStatus(action));
    })
    .sort((a, b) => {
      if (!a.plannedDate) return 1;
      if (!b.plannedDate) return -1;
      return new Date(a.plannedDate).getTime() - new Date(b.plannedDate).getTime();
    });

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Acciones Formativas</h1>
        
        <div className="flex items-center space-x-3 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
          <span className="text-sm font-medium text-gray-700 ml-2">Estado:</span>
          <div className="flex flex-wrap gap-2">
            {availableStatuses.map(status => {
              const isSelected = statusFilter.includes(status.value);
              return (
                <button
                  key={status.value}
                  onClick={() => handleStatusFilterChange(status.value)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    isSelected 
                      ? 'bg-blue-100 text-blue-800 border-blue-200' 
                      : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                  } border`}
                >
                  {status.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Table<TrainingAction>
        data={filteredAndSortedActions}
        columns={[
          { header: 'Usuario', accessor: 'userName' },
          { 
            header: 'Tarea', 
            accessor: (a) => tasks.find(t => t.id === a.taskId)?.name || 'Desconocido'
          },
          { header: 'Nivel Objetivo', accessor: 'targetLevel' },
          { 
            header: 'Descripción', 
            accessor: (a) => (
              <input
                type="text"
                value={a.description || ''}
                onChange={(e) => handleDescriptionChange(a, e.target.value)}
                disabled={!isAdmin && !isSupervisor && dbUser?.uid !== a.trainerId}
                className="text-sm rounded-md border-gray-300 shadow-sm p-1 border focus:border-blue-500 focus:ring-blue-500 bg-transparent disabled:opacity-50 w-full min-w-[150px]"
                placeholder="Añadir descripción..."
              />
            )
          },
          { 
            header: 'Formador', 
            accessor: (a) => a.trainerName || users.find(u => u.id === a.trainerId)?.name || 'Desconocido'
          },
          { 
            header: 'Fecha Prevista', 
            accessor: (a) => a.plannedDate ? format(new Date(a.plannedDate), 'dd/MM/yyyy') : '-'
          },
          { 
            header: 'Fecha Fin', 
            accessor: (a) => (
              <input
                type="date"
                value={a.endDate || ''}
                onChange={(e) => handleEndDateChange(a, e.target.value)}
                disabled={!isAdmin && !isSupervisor && dbUser?.uid !== a.trainerId}
                className="text-sm rounded-md border-gray-300 shadow-sm p-1 border focus:border-blue-500 focus:ring-blue-500 bg-transparent disabled:opacity-50"
              />
            )
          },
          { 
            header: 'Estado', 
            accessor: (a) => {
              const status = getComputedStatus(a);
              return (
                <span className={`text-sm rounded-full px-3 py-1 font-medium
                  ${status === 'planificada' ? 'bg-blue-100 text-blue-800' : ''}
                  ${status === 'retrasada' ? 'bg-red-100 text-red-800' : ''}
                  ${status === 'completada' ? 'bg-yellow-100 text-yellow-800' : ''}
                  ${status === 'verificada' ? 'bg-green-100 text-green-800' : ''}
                `}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              );
            }
          },
          { 
            header: 'Verificada', 
            accessor: (a) => (
              <input
                type="checkbox"
                checked={!!a.verificationDate}
                onChange={(e) => handleVerificationChange(a, e.target.checked)}
                disabled={!canVerify(a)}
                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50 cursor-pointer"
              />
            )
          },
          { 
            header: 'Verificador', 
            accessor: (a) => a.verifierName || users.find(u => u.id === a.verifierId)?.name || '-'
          },
        ]}
      />
    </div>
  );
}
