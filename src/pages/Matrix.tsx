import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, query, where } from 'firebase/firestore';
import clsx from 'clsx';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';
import { ArrowLeftRight } from 'lucide-react';
import { Team, Process, Task, UserTaskLevel, Criterion, TrainingAction } from '../types';
import Modal from '../components/Modal';

export default function Matrix() {
  const { user, dbUser, isAdmin, isSupervisor, activeCompanyId, isGlobalAdmin } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [userTaskLevels, setUserTaskLevels] = useState<UserTaskLevel[]>([]);
  const [trainingActions, setTrainingActions] = useState<TrainingAction[]>([]);
  const [teamTargets, setTeamTargets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => localStorage.getItem('matrix_selectedTeamId') || '');
  const [selectedProcessId, setSelectedProcessId] = useState<string>(() => localStorage.getItem('matrix_selectedProcessId') || '');
  const [showTargets, setShowTargets] = useState<boolean>(() => localStorage.getItem('matrix_showTargets') === 'true');
  const [isSelfAssessment, setIsSelfAssessment] = useState<boolean>(() => localStorage.getItem('matrix_isSelfAssessment') === 'true');
  const [isPivoted, setIsPivoted] = useState<boolean>(() => localStorage.getItem('matrix_isPivoted') === 'true');
  const [loading, setLoading] = useState(true);

  const [selectedCell, setSelectedCell] = useState<{ userId: string, userName: string, task: Task } | null>(null);
  const [selectedTaskDoc, setSelectedTaskDoc] = useState<Task | null>(null);

  const [pendingTarget, setPendingTarget] = useState<{
    targetLevel: number;
    currentData: any;
    userId: string;
    taskId: string;
    userName: string;
  } | null>(null);
  const [trainerId, setTrainerId] = useState<string>('');
  const [plannedDate, setPlannedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');

  useEffect(() => {
    localStorage.setItem('matrix_selectedTeamId', selectedTeamId);
  }, [selectedTeamId]);

  useEffect(() => {
    localStorage.setItem('matrix_selectedProcessId', selectedProcessId);
  }, [selectedProcessId]);

  useEffect(() => {
    localStorage.setItem('matrix_showTargets', String(showTargets));
  }, [showTargets]);

  useEffect(() => {
    localStorage.setItem('matrix_isSelfAssessment', String(isSelfAssessment));
  }, [isSelfAssessment]);

  useEffect(() => {
    localStorage.setItem('matrix_isPivoted', String(isPivoted));
  }, [isPivoted]);

  const isCurrentUser = (uid: string) => {
    if (!dbUser) return false;
    return uid === dbUser.uid || uid.toLowerCase() === dbUser.email.toLowerCase();
  };

  useEffect(() => {
    if (!dbUser) return;

    const companyId = activeCompanyId || dbUser.companyId;

    const getQuery = (colName: string) => {
      const colRef = collection(db, colName);
      if (isGlobalAdmin && !activeCompanyId) return colRef;
      if (!companyId) return null;
      return query(colRef, where('companyId', '==', companyId));
    };

    const teamsQuery = getQuery('teams');
    const unsubTeams = teamsQuery ? onSnapshot(teamsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      if (isAdmin) {
        setTeams(data);
      } else if (isSupervisor) {
        setTeams(data.filter(t => isCurrentUser(t.supervisorId) || t.members.some(m => isCurrentUser(m.uid))));
      } else {
        setTeams(data.filter(t => t.members.some(m => isCurrentUser(m.uid))));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    }) : () => {};

    const processesQuery = getQuery('processes');
    const unsubProcesses = processesQuery ? onSnapshot(processesQuery, (snapshot) => {
      setProcesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'processes');
    }) : () => {};

    const tasksQuery = getQuery('tasks');
    const unsubTasks = tasksQuery ? onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    }) : () => {};

    const criteriaQuery = getQuery('criteria');
    const unsubCriteria = criteriaQuery ? onSnapshot(criteriaQuery, (snapshot) => {
      setCriteria(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Criterion)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'criteria');
    }) : () => {};

    const levelsQuery = getQuery('userTaskLevels');
    const unsubLevels = levelsQuery ? onSnapshot(levelsQuery, (snapshot) => {
      setUserTaskLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserTaskLevel)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'userTaskLevels');
    }) : () => {};

    const trainingQuery = getQuery('trainingActions');
    const unsubTraining = trainingQuery ? onSnapshot(trainingQuery, (snapshot) => {
      setTrainingActions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrainingAction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'trainingActions');
    }) : () => {};

    const teamTargetsQuery = getQuery('teamTargets');
    const unsubTeamTargets = teamTargetsQuery ? onSnapshot(teamTargetsQuery, (snapshot) => {
      setTeamTargets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teamTargets');
    }) : () => { setLoading(false); };

    return () => {
      unsubTeams(); unsubProcesses(); unsubTasks(); unsubCriteria(); unsubLevels(); unsubTraining(); unsubTeamTargets(); 
    };
  }, [dbUser, isAdmin, isSupervisor, user?.email, activeCompanyId, isGlobalAdmin]);

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;

    const getQuery = (colName: string) => {
      const colRef = collection(db, colName);
      if (isGlobalAdmin && !activeCompanyId) return colRef;
      if (!companyId) return null;
      return query(colRef, where('companyId', '==', companyId));
    };

    const isAnyTeamSupervisor = teams.some(t => isCurrentUser(t.supervisorId));
    if (isAdmin || isSupervisor || isAnyTeamSupervisor) {
      const usersQuery = getQuery('users');
      if (usersQuery) {
        const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
          setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'users');
        });
        return () => unsubUsers();
      }
    }
  }, [dbUser, isAdmin, isSupervisor, teams, user?.email, activeCompanyId, isGlobalAdmin]);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const sortedMembers = [...(selectedTeam?.members || [])].sort((a, b) => a.name.localeCompare(b.name));
  const isTeamSupervisor = isCurrentUser(selectedTeam?.supervisorId || '');
  const selectedProcess = processes.find(p => p.id === selectedProcessId);
  const filteredTasks = tasks.filter(t => t.processId === selectedProcessId);

  const getLevelData = (userId: string, taskId: string) => {
    return userTaskLevels.find(l => l.userId === userId && l.taskId === taskId) || {
      currentLevel: 0,
      targetLevel: 0,
      plannedLevel: 0,
      completedItems: [],
      selfLevel: 0,
      selfCompletedItems: []
    };
  };

  const getTrainingAction = (userId: string, taskId: string) => {
    return trainingActions.find(a => a.userId === userId && a.taskId === taskId && a.status !== 'verificada');
  };

  const handleSetTeamTarget = async (taskId: string, level: number, count: number) => {
    if (!isAdmin && !isSupervisor) return;
    
    const docId = `${selectedTeamId}_${selectedProcessId}_${taskId}`;
    const docRef = doc(db, 'teamTargets', docId);
    
    const currentTarget = teamTargets.find(t => t.id === docId) || { targetCounts: {} };
    const newCounts = { ...currentTarget.targetCounts, [level]: count };
    
    if (count === 0) {
      delete newCounts[level];
    }

    const companyId = activeCompanyId || dbUser?.companyId;
    try {
      await setDoc(docRef, {
        teamId: selectedTeamId,
        processId: selectedProcessId,
        taskId,
        targetCounts: newCounts,
        companyId: companyId || ''
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `teamTargets/${docId}`);
    }
  };

  const handleSetTarget = async (targetLevel: number, currentData: any, userId: string, taskId: string, userName: string) => {
    if (!isAdmin && !isSupervisor && !isTeamSupervisor) return;

    const companyId = activeCompanyId || dbUser?.companyId;
    if (targetLevel > (currentData.currentLevel || 0)) {
      setPendingTarget({ targetLevel, currentData, userId, taskId, userName });
      setTrainerId(dbUser?.uid || '');
      setPlannedDate(new Date().toISOString().split('T')[0]);
    } else {
      const docId = `${userId}_${taskId}`;
      try {
        await setDoc(doc(db, 'userTaskLevels', docId), {
          userId: userId,
          userName: userName,
          taskId: taskId,
          currentLevel: currentData.currentLevel || 0,
          completedItems: currentData.completedItems || [],
          selfLevel: currentData.selfLevel || 0,
          selfCompletedItems: currentData.selfCompletedItems || [],
          targetLevel: targetLevel,
          plannedLevel: currentData.plannedLevel || 0,
          teamId: selectedTeamId,
          companyId: companyId || ''
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `userTaskLevels/${docId}`);
      }
    }
  };

  const confirmSetTarget = async () => {
    if (!pendingTarget) return;
    if (!isAdmin && !isSupervisor && !isTeamSupervisor) return;

    const { targetLevel, currentData, userId, taskId, userName } = pendingTarget;
    const docId = `${userId}_${taskId}`;
    const companyId = activeCompanyId || dbUser?.companyId;
    
    try {
      await setDoc(doc(db, 'userTaskLevels', docId), {
        userId: userId,
        userName: userName,
        taskId: taskId,
        currentLevel: currentData.currentLevel || 0,
        completedItems: currentData.completedItems || [],
        selfLevel: currentData.selfLevel || 0,
        selfCompletedItems: currentData.selfCompletedItems || [],
        targetLevel: targetLevel,
        plannedLevel: currentData.plannedLevel || 0,
        teamId: selectedTeamId,
        companyId: companyId || ''
      }, { merge: true });

      const trainer = users.find(u => u.id === trainerId);

      await setDoc(doc(collection(db, 'trainingActions')), {
        userId: userId,
        userName: userName,
        taskId: taskId,
        targetLevel: targetLevel,
        trainerId: trainerId,
        trainerName: trainer ? trainer.name : '',
        plannedDate: plannedDate,
        description: description,
        status: 'planificada',
        companyId: companyId || ''
      });

      setPendingTarget(null);
      setDescription('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'userTaskLevels/trainingActions');
    }
  };

  const canVerify = (action: TrainingAction) => {
    if (!action.endDate) return false;
    if (isAdmin) return true;
    if (!isSupervisor && !isTeamSupervisor) return false;
    
    const task = tasks.find(t => t.id === action.taskId);
    if (!task) return false;
    
    return teams.some(team => isCurrentUser(team.supervisorId) && team.processIds.includes(task.processId));
  };

  const handleVerifyAction = async (action: TrainingAction, currentData: any, criterion: Criterion) => {
    if (!canVerify(action)) return;
    try {
      const { runTransaction } = await import('firebase/firestore');
      
      const docId = `${action.userId}_${action.taskId}`;
      const docRef = doc(db, 'userTaskLevels', docId);
      const actionRef = doc(db, 'trainingActions', action.id);

      const companyId = activeCompanyId || dbUser?.companyId;

      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        const latestData = docSnap.exists() ? docSnap.data() : currentData;
        
        // Grant the target level
        const newLevel = action.targetLevel;
        
        // Mark all items up to the target level as completed
        let newCompletedItems = [...(latestData.completedItems || [])];
        for (const level of criterion.levels) {
          if (level.level <= newLevel) {
            for (const item of (level.items || [])) {
              if (!newCompletedItems.includes(item.id)) {
                newCompletedItems.push(item.id);
              }
            }
          }
        }

        transaction.set(docRef, {
          userId: action.userId,
          userName: action.userName,
          taskId: action.taskId,
          currentLevel: newLevel,
          completedItems: newCompletedItems,
          selfLevel: latestData.selfLevel || 0,
          selfCompletedItems: latestData.selfCompletedItems || [],
          targetLevel: latestData.targetLevel || 0,
          plannedLevel: latestData.plannedLevel || 0,
          teamId: selectedTeamId,
          companyId: companyId || ''
        }, { merge: true });

        transaction.update(actionRef, {
          status: 'verificada',
          verifierId: dbUser?.uid,
          verifierName: dbUser?.name,
          verificationDate: new Date().toISOString().split('T')[0]
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `trainingActions/${action.id}/verification`);
    }
  };

  const handleUpdateActionDescription = async (actionId: string, newDescription: string) => {
    try {
      await updateDoc(doc(db, 'trainingActions', actionId), { description: newDescription });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `trainingActions/${actionId}`);
    }
  };

  const renderCell = (userId: string, taskId: string, userName: string) => {
    const data = getLevelData(userId, taskId);
    const training = getTrainingAction(userId, taskId);

    const maxLevel = 4;
    const levelToShow = isSelfAssessment ? (data.selfLevel || 0) : data.currentLevel;
    const currentPct = (levelToShow / maxLevel) * 100;
    const targetPct = (data.targetLevel / maxLevel) * 100;
    
    let background = 'bg-gray-100';
    if (levelToShow > 0 || data.targetLevel > 0) {
      background = `conic-gradient(${isSelfAssessment ? '#3b82f6' : '#22c55e'} 0% ${currentPct}%, #eab308 ${currentPct}% ${targetPct}%, #f3f4f6 ${targetPct}% 100%)`;
    }

    let borderClass = 'border-4 border-transparent';
    let animationClass = '';
    if (training && !isSelfAssessment) {
      const today = new Date().toISOString().split('T')[0];
      const isRetrasada = training.status === 'retrasada' || (!training.endDate && training.plannedDate < today);

      if (training.status === 'completada') {
        borderClass = 'border-4 border-blue-500';
        animationClass = 'animate-border-blink';
      } else if (isRetrasada) {
        borderClass = 'border-4 border-red-500';
      } else {
        borderClass = 'border-4 border-blue-500';
      }
    }

    const hasLevel = levelToShow > 0 || data.targetLevel > 0;
    const isOwnCell = isCurrentUser(userId);

    const tooltip = [
      `${userName}`,
      `${isSelfAssessment ? 'Autoevaluación' : 'Nivel'}: ${levelToShow} / Objetivo: ${data.targetLevel}`,
      training ? `Formación: ${training.status}${training.description ? ` - ${training.description}` : ''}` : '',
      isOwnCell ? '(Tú)' : ''
    ].filter(Boolean).join('\n');

    return (
      <div 
        onClick={() => setSelectedCell({ userId, userName, task: tasks.find(t => t.id === taskId)! })}
        className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer bg-origin-border ${borderClass} ${animationClass} ${!hasLevel ? 'bg-gray-100' : ''} hover:opacity-80 transition`}
        style={{ backgroundImage: hasLevel ? background : undefined }}
        title={tooltip}
      >
        <div className="w-8 h-8 shrink-0 bg-white rounded-full flex items-center justify-center text-gray-800">
          {levelToShow}
        </div>
      </div>
    );
  };

  const handleToggleItem = async (itemId: string, currentData: any, criterion: Criterion) => {
    const isOwnCell = isCurrentUser(selectedCell!.userId);
    
    // If it's self-assessment mode, only the owner can toggle their self-assessment items
    if (isSelfAssessment) {
      if (!isOwnCell) return;
    } else {
      // If it's evaluation mode, only admins, supervisors and team supervisors can toggle items
      if (!isAdmin && !isSupervisor && !isTeamSupervisor) return;
    }
    
    const docId = `${selectedCell!.userId}_${selectedCell!.task.id}`;
    const docRef = doc(db, 'userTaskLevels', docId);

    const companyId = activeCompanyId || dbUser?.companyId;

    try {
      const { runTransaction } = await import('firebase/firestore');
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(docRef);
        const latestData = docSnap.exists() ? docSnap.data() : currentData;
        
        const itemsKey = isSelfAssessment ? 'selfCompletedItems' : 'completedItems';
        const levelKey = isSelfAssessment ? 'selfLevel' : 'currentLevel';
        
        const completedItems = latestData[itemsKey] || [];
        const newItems = completedItems.includes(itemId) 
          ? completedItems.filter((id: string) => id !== itemId)
          : [...completedItems, itemId];

        let newLevel = 0;
        for (const level of criterion.levels) {
          const items = level.items || [];
          const allItemsCompleted = items.length === 0 || items.every(item => newItems.includes(item.id));
          if (allItemsCompleted) {
            newLevel = level.level;
          } else {
            break;
          }
        }

        transaction.set(docRef, {
          userId: selectedCell!.userId,
          userName: selectedCell!.userName,
          taskId: selectedCell!.task.id,
          currentLevel: isSelfAssessment ? (latestData.currentLevel || 0) : newLevel,
          completedItems: isSelfAssessment ? (latestData.completedItems || []) : newItems,
          selfLevel: isSelfAssessment ? newLevel : (latestData.selfLevel || 0),
          selfCompletedItems: isSelfAssessment ? newItems : (latestData.selfCompletedItems || []),
          targetLevel: latestData.targetLevel || 0,
          plannedLevel: latestData.plannedLevel || 0,
          teamId: selectedTeamId,
          companyId: companyId || ''
        }, { merge: true });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `userTaskLevels/${docId}/toggleItem`);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-6 items-end bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Equipo</label>
          <select
            value={selectedTeamId}
            onChange={(e) => {
              setSelectedTeamId(e.target.value);
              setSelectedProcessId('');
            }}
            className="rounded-lg border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 min-w-[200px]"
          >
            <option value="">Seleccionar equipo...</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Proceso</label>
          <select
            value={selectedProcessId}
            onChange={(e) => setSelectedProcessId(e.target.value)}
            className="rounded-lg border-gray-300 shadow-sm p-2.5 border focus:border-blue-500 focus:ring-blue-500 min-w-[200px]"
          >
            <option value="">Seleccionar proceso...</option>
            {selectedTeam?.processIds.map(pid => {
              const p = processes.find(proc => proc.id === pid);
              return p ? <option key={p.id} value={p.id}>{p.name}</option> : null;
            })}
          </select>
        </div>

        {(isAdmin || isSupervisor) && (
          <div className="flex items-center h-[42px]">
            <label className="flex items-center cursor-pointer">
              <div className="relative">
                <input 
                  type="checkbox" 
                  className="sr-only" 
                  checked={showTargets}
                  onChange={(e) => setShowTargets(e.target.checked)}
                />
                <div className={`block w-12 h-7 rounded-full transition-colors ${showTargets ? 'bg-yellow-400' : 'bg-gray-300'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${showTargets ? 'transform translate-x-5' : ''}`}></div>
              </div>
              <div className="ml-3 text-sm font-medium text-gray-700">Mostrar objetivo</div>
            </label>
          </div>
        )}

        <div className="flex items-center h-[42px]">
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={isSelfAssessment}
                onChange={(e) => setIsSelfAssessment(e.target.checked)}
              />
              <div className={`block w-12 h-7 rounded-full transition-colors ${isSelfAssessment ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${isSelfAssessment ? 'transform translate-x-5' : ''}`}></div>
            </div>
            <div className="ml-3 text-sm font-medium text-gray-700">Autoevaluación</div>
          </label>
        </div>

        <div className="flex items-center h-[42px]">
          <label className="flex items-center cursor-pointer">
            <div className="relative">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={isPivoted}
                onChange={(e) => setIsPivoted(e.target.checked)}
              />
              <div className={`block w-12 h-7 rounded-full transition-colors ${isPivoted ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
              <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${isPivoted ? 'transform translate-x-5' : ''}`}></div>
            </div>
            <div className="ml-3 text-sm font-medium text-gray-700">Pivotar ejes</div>
          </label>
        </div>
      </div>

      {selectedTeam && selectedProcess ? (
        <div className="space-y-6">
          {showTargets && !isPivoted && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-4 border-r sticky left-0 bg-gray-50 z-10 w-48">Resumen</th>
                    {filteredTasks.map(task => (
                      <th key={task.id} className="px-4 py-4 text-center min-w-[120px]">
                        {task.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 border-r sticky left-0 bg-white">
                      Objetivo
                    </td>
                    {filteredTasks.map(task => {
                      const teamTarget = teamTargets.find(t => t.id === `${selectedTeamId}_${selectedProcessId}_${task.id}`);
                      const counts = teamTarget?.targetCounts || {};
                      
                      const maxLevel = 4;
                      const levels = [4, 3, 2, 1];

                      return (
                        <td key={task.id} className="px-4 py-3 text-center align-top">
                          <div className="flex flex-col items-center gap-2">
                            {levels.map(level => {
                              const count = counts[level] || 0;
                              if (!isAdmin && !isSupervisor && count === 0) return null;
                              
                              const targetPct = (level / maxLevel) * 100;
                              const background = `conic-gradient(#eab308 0% ${targetPct}%, #f3f4f6 ${targetPct}% 100%)`;
                              
                              const actualCount = selectedTeam.members.filter(m => {
                                const data = getLevelData(m.uid, task.id);
                                return data.currentLevel >= level;
                              }).length;
                              
                              const gap = actualCount - count;
                              const isDeficit = count > 0 && gap < 0;
                              const isSurplus = count > 0 && gap >= 0;
                              
                              const containerClass = `flex flex-col gap-1.5 px-2 py-1.5 rounded-lg border w-full min-w-[110px] ${
                                isDeficit ? 'bg-red-50 border-red-200' : 
                                isSurplus ? 'bg-green-50 border-green-200' : 
                                'bg-gray-50 border-gray-100'
                              }`;

                              return (
                                <div key={level} className={containerClass}>
                                  <div className="flex items-center justify-between">
                                    <div 
                                      className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold bg-origin-border"
                                      style={{ backgroundImage: background }}
                                      title={`Nivel: ${level}`}
                                    >
                                      <div className="w-3.5 h-3.5 shrink-0 bg-white rounded-full flex items-center justify-center text-gray-800 text-[9px]">
                                        {level}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center text-gray-700 font-medium">
                                      <span className="text-[10px] text-gray-500 mr-1 uppercase">Obj:</span>
                                      {isAdmin || isSupervisor ? (
                                        <input 
                                          type="number" 
                                          min="0" 
                                          max={selectedTeam.members.length}
                                          value={count || ''}
                                          placeholder="0"
                                          onChange={(e) => handleSetTeamTarget(task.id, level, parseInt(e.target.value) || 0)}
                                          className="w-10 h-5 text-center text-xs border rounded bg-white focus:ring-1 focus:ring-blue-500 focus:outline-none ml-1"
                                        />
                                      ) : (
                                        <span className="text-sm ml-1">{count}</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {count > 0 && (
                                    <div className="flex items-center justify-between text-[10px] mt-0.5 border-t border-gray-200/50 pt-1">
                                      <span className="text-gray-500">Hay: <strong className="text-gray-700">{actualCount}</strong></span>
                                      <span className={`font-bold ${isDeficit ? 'text-red-600' : 'text-green-600'}`}>
                                        Gap: {gap > 0 ? `+${gap}` : gap}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {!isAdmin && !isSupervisor && Object.keys(counts).length === 0 && (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              {!isPivoted ? (
                <>
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4 border-r sticky left-0 bg-gray-50 z-10 w-48">Usuarios</th>
                {filteredTasks.map(task => (
                  <th key={task.id} className="px-4 py-4 text-center min-w-[120px]">
                    <div 
                      className="font-medium cursor-pointer hover:text-blue-600 flex items-center justify-center gap-1" 
                      title="Ver documentación"
                      onClick={() => setSelectedTaskDoc(task)}
                    >
                      {task.name}
                      {task.attachments && task.attachments.length > 0 && (
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map(member => {
                // Try to get the latest photoURL from the users array if available (for admins/supervisors),
                // otherwise fallback to the denormalized photoURL in the member object.
                const userObj = users.find(u => u.uid === member.uid);
                const photoURL = userObj?.photoURL || (member as any).photoURL;
                
                const isOwnRow = isCurrentUser(member.uid);
                
                return (
                <tr key={member.uid} className={`border-b hover:bg-gray-50 ${isOwnRow ? 'bg-gray-100/50' : ''}`}>
                  <td className={`px-6 py-4 font-medium text-gray-900 border-r sticky left-0 z-10 ${isOwnRow ? 'bg-gray-100' : 'bg-white'}`}>
                    <div className="flex items-center gap-3">
                      {photoURL ? (
                        <img 
                          src={photoURL} 
                          alt={member.name} 
                          className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate">{member.name}</span>
                    </div>
                  </td>
                  {filteredTasks.map(task => (
                    <td key={task.id} className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        {renderCell(member.uid, task.id, member.name)}
                      </div>
                    </td>
                  ))}
                </tr>
                )})}
              </tbody>
            </>
          ) : (
            <>
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 border-r sticky left-0 bg-gray-50 z-10 w-48">Tareas</th>
                  {showTargets && (
                    <th className="px-4 py-4 text-center min-w-[80px] border-r bg-yellow-50/50">
                      Objetivo
                    </th>
                  )}
                  {sortedMembers.map(member => {
                    const userObj = users.find(u => u.uid === member.uid);
                    const photoURL = userObj?.photoURL || (member as any).photoURL;
                    return (
                      <th key={member.uid} className="px-4 py-4 text-center min-w-[120px]">
                        <div className="flex flex-col items-center space-y-1">
                          {photoURL ? (
                            <img 
                              src={photoURL} 
                              alt={member.name} 
                              className="w-8 h-8 rounded-full object-cover border border-gray-200 mb-1"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-200 mb-1">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-gray-900 truncate max-w-[100px]">{member.name}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => (
                  <tr key={task.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 border-r sticky left-0 z-10 bg-white">
                      <div 
                        className="flex flex-col space-y-1 cursor-pointer hover:text-blue-600"
                        onClick={() => setSelectedTaskDoc(task)}
                      >
                        <div className="flex items-center gap-1">
                          <span className="truncate max-w-[140px]">{task.name}</span>
                          {task.attachments && task.attachments.length > 0 && (
                            <svg className="w-3 h-3 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </td>
                    {showTargets && (
                      <td className="px-4 py-4 text-center border-r bg-yellow-50/30 font-bold text-yellow-700">
                        {(() => {
                          const teamTarget = teamTargets.find(t => t.id === `${selectedTeamId}_${selectedProcessId}_${task.id}`);
                          const counts = teamTarget?.targetCounts || {};
                          return Object.values(counts).reduce((acc, val) => (acc as number) + (val as number), 0) as number;
                        })()}
                      </td>
                    )}
                    {sortedMembers.map(member => (
                      <td key={member.uid} className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          {renderCell(member.uid, task.id, member.name)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
        </div>

        {/* Leyenda */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">Leyenda</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-green-500 shrink-0"></div>
              <span>Nivel actual de competencia</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-yellow-500 shrink-0"></div>
              <span>Nivel objetivo requerido</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border-4 border-blue-500 shrink-0"></div>
              <span>Formación planificada</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border-4 border-red-500 shrink-0"></div>
              <span>Formación retrasada</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full border-4 border-blue-500 animate-border-blink shrink-0"></div>
              <span>Formación completada (Pendiente de verificación)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-gray-100 border border-gray-200 shrink-0"></div>
              <span>Tu fila (Usuario actual)</span>
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <p className="text-lg">Selecciona un equipo y un proceso para ver la matriz.</p>
        </div>
      )}

      {/* Task Documentation Modal */}
      {selectedTaskDoc && (
        <Modal
          isOpen={!!selectedTaskDoc}
          onClose={() => setSelectedTaskDoc(null)}
          title={`Documentación: ${selectedTaskDoc.name}`}
        >
          <div className="space-y-4">
            <p className="text-gray-600">{selectedTaskDoc.description}</p>
            
            {selectedTaskDoc.attachments && selectedTaskDoc.attachments.length > 0 ? (
              <div className="mt-4">
                <h4 className="font-bold text-gray-800 mb-3">Archivos adjuntos</h4>
                <ul className="space-y-2">
                  {selectedTaskDoc.attachments.map((att: any, idx) => {
                    const url = typeof att === 'string' ? att : att.url;
                    const name = typeof att === 'string' ? att : att.name;
                    return (
                    <li key={idx} className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <svg className="w-5 h-5 text-gray-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium truncate max-w-full">
                        {name}
                      </a>
                    </li>
                  )})}
                </ul>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                No hay documentación adjunta para esta tarea.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Cell Detail Modal */}
      {selectedCell && (
        <Modal
          isOpen={!!selectedCell}
          onClose={() => setSelectedCell(null)}
          title={`Evaluación: ${selectedCell.userName} - ${selectedCell.task.name}`}
        >
          <div className="space-y-6">
            {(() => {
              const criterion = criteria.find(c => c.id === selectedCell.task.criteriaId);
              const currentData = getLevelData(selectedCell.userId, selectedCell.task.id);
              
              if (!criterion) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">Criterio no encontrado para esta tarea.</div>;

              const training = getTrainingAction(selectedCell.userId, selectedCell.task.id);
              const isOwnCell = isCurrentUser(selectedCell.userId);
              const canEdit = isSelfAssessment 
                ? isOwnCell 
                : (isAdmin || isSupervisor || isTeamSupervisor);

              return (
                <div className="space-y-6">
                  {training && !isSelfAssessment && (
                    <div className={clsx(
                      "rounded-xl p-4 border",
                      training.status === 'completada' ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className={clsx(
                            "font-bold",
                            training.status === 'completada' ? "text-blue-800" : "text-gray-800"
                          )}>
                            Acción Formativa: {training.status.charAt(0).toUpperCase() + training.status.slice(1)}
                          </h4>
                          <p className={clsx(
                            "text-sm",
                            training.status === 'completada' ? "text-blue-600" : "text-gray-600"
                          )}>
                            Objetivo: Nivel {training.targetLevel} | Formador: {training.trainerName}
                          </p>
                        </div>
                        {training.status === 'completada' && canVerify(training) && (
                          <button
                            onClick={() => handleVerifyAction(training, currentData, criterion)}
                            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            Verificar y Otorgar Nivel
                          </button>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Descripción</label>
                        {canEdit && (isAdmin || isSupervisor || isTeamSupervisor || dbUser?.uid === training.trainerId) ? (
                          <textarea
                            value={training.description || ''}
                            onChange={(e) => handleUpdateActionDescription(training.id, e.target.value)}
                            className="w-full text-sm rounded-lg border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 bg-white"
                            rows={2}
                            placeholder="Añadir detalles..."
                          />
                        ) : (
                          <p className="text-sm text-gray-700 bg-white p-2 rounded-lg border border-gray-100 italic">
                            {training.description || 'Sin descripción.'}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <div className="text-center">
                      <span className="text-sm text-gray-500 block mb-1 uppercase tracking-wider font-semibold">Nivel Actual</span>
                      <span className="text-4xl font-bold text-green-600">{currentData.currentLevel}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm text-gray-500 block mb-1 uppercase tracking-wider font-semibold">Autoeval.</span>
                      <span className="text-4xl font-bold text-blue-600">{currentData.selfLevel || 0}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-sm text-gray-500 block mb-1 uppercase tracking-wider font-semibold">Nivel Objetivo</span>
                      {canEdit && (isAdmin || isSupervisor || isTeamSupervisor) && !isSelfAssessment ? (
                        <select 
                          value={currentData.targetLevel}
                          onChange={(e) => handleSetTarget(Number(e.target.value), currentData, selectedCell.userId, selectedCell.task.id, selectedCell.userName)}
                          className="text-4xl font-bold text-yellow-500 bg-transparent border-b-2 border-yellow-300 focus:outline-none focus:border-yellow-500 text-center w-16"
                        >
                          <option value="0">0</option>
                          {criterion.levels.map(l => <option key={l.level} value={l.level}>{l.level}</option>)}
                        </select>
                      ) : (
                        <span className="text-4xl font-bold text-yellow-500">{currentData.targetLevel}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-center mb-4">
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest shadow-sm border ${isSelfAssessment ? 'bg-blue-600 text-white border-blue-700' : 'bg-green-600 text-white border-green-700'}`}>
                      Modo: {isSelfAssessment ? 'Autoevaluación' : 'Evaluación Oficial'}
                    </span>
                  </div>

                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {criterion.levels.map(level => {
                      const levelValue = isSelfAssessment ? (currentData.selfLevel || 0) : currentData.currentLevel;
                      const isLevelCompleted = levelValue >= level.level;
                      
                      return (
                        <div key={level.level} className={`border-2 rounded-xl p-5 transition-colors ${isLevelCompleted ? (isSelfAssessment ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50') : 'border-gray-200 bg-white'}`}>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-lg text-gray-800">Nivel {level.level}</h4>
                            {isLevelCompleted && (
                              <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase tracking-wide ${isSelfAssessment ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>Completado</span>
                            )}
                          </div>
                          <div className="space-y-3">
                            {(level.items || []).map(item => {
                              const isCompleted = isSelfAssessment 
                                ? (currentData.selfCompletedItems || []).includes(item.id)
                                : (currentData.completedItems || []).includes(item.id);
                              
                              return (
                                <label key={item.id} className={`flex items-start space-x-3 p-3 rounded-lg transition-colors ${isCompleted ? 'bg-white shadow-sm' : 'hover:bg-gray-50'}`}>
                                  <div className="flex-shrink-0 mt-0.5">
                                    <input
                                      type="checkbox"
                                      checked={isCompleted}
                                      onChange={() => handleToggleItem(item.id, currentData, criterion)}
                                      disabled={!canEdit}
                                      className={`w-5 h-5 rounded border-gray-300 focus:ring-offset-2 disabled:opacity-50 cursor-pointer ${isSelfAssessment ? 'text-blue-600 focus:ring-blue-500' : 'text-green-600 focus:ring-green-500'}`}
                                    />
                                  </div>
                                  <span className={`text-sm leading-relaxed ${isCompleted ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                                    {item.description}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </Modal>
      )}

      {pendingTarget && (
        <Modal
          isOpen={true}
          onClose={() => setPendingTarget(null)}
          title="Asignar Formador y Fecha"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Se ha asignado un nivel objetivo mayor al actual. Por favor, asigna un formador y una fecha prevista para la acción formativa.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Formador</label>
              <select
                value={trainerId}
                onChange={(e) => setTrainerId(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar formador...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Prevista</label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (Opcional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500"
                rows={3}
                placeholder="Detalles sobre la acción formativa..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setPendingTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSetTarget}
                disabled={!trainerId || !plannedDate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
