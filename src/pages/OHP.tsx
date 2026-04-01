import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Team, Task, UserTaskLevel, User } from '../types';
import { useAuth } from '../AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function OHP() {
  const { dbUser, isAdmin, activeCompanyId } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userTaskLevels, setUserTaskLevels] = useState<UserTaskLevel[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;
    if (!companyId) {
      setLoading(false);
      return;
    }

    let usersUnsub: (() => void) | undefined;

    const qTeams = query(collection(db, 'teams'), where('companyId', '==', companyId));
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
      if (!isAdmin) setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    const qTasks = query(collection(db, 'tasks'), where('companyId', '==', companyId));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    const qLevels = query(collection(db, 'userTaskLevels'), where('companyId', '==', companyId));
    const unsubLevels = onSnapshot(qLevels, (snapshot) => {
      setUserTaskLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserTaskLevel)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'userTaskLevels');
    });

    if (isAdmin) {
      const qUsers = query(collection(db, 'users'), where('companyId', '==', companyId));
      usersUnsub = onSnapshot(qUsers, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
        setLoading(false);
      });
    }

    return () => {
      unsubTeams(); 
      unsubTasks(); 
      unsubLevels(); 
      if (usersUnsub) usersUnsub();
    };
  }, [dbUser, isAdmin, activeCompanyId]);

  const calculateTeamGap = (team: Team) => {
    const teamTasks = tasks.filter(t => team.processIds.includes(t.processId));
    let gap = 0;

    team.members.forEach(member => {
      teamTasks.forEach(task => {
        const levelData = userTaskLevels.find(l => l.userId === member.uid && l.taskId === task.id);
        if (levelData && levelData.targetLevel > levelData.currentLevel) {
          gap += (levelData.targetLevel - levelData.currentLevel);
        }
      });
    });

    return gap;
  };

  const calculateCoverage = (team: Team) => {
    const teamTasks = tasks.filter(t => team.processIds.includes(t.processId));
    let cappedCurrentForCoverage = 0;
    let targetTotalLevels = 0;

    teamTasks.forEach(task => {
      let taskCurrent = 0;
      let taskTarget = 0;
      
      team.members.forEach(member => {
        const levelData = userTaskLevels.find(l => l.userId === member.uid && l.taskId === task.id);
        if (levelData) {
          taskCurrent += levelData.currentLevel;
          taskTarget += levelData.targetLevel;
        }
      });
      
      targetTotalLevels += taskTarget;
      cappedCurrentForCoverage += Math.min(taskCurrent, taskTarget);
    });

    return targetTotalLevels > 0 ? Math.round((cappedCurrentForCoverage / targetTotalLevels) * 100) : 0;
  };

  const handleDragStart = (e: React.DragEvent, user: User) => {
    e.dataTransfer.setData('application/json', JSON.stringify(user));
  };

  const handleDropLeader = async (e: React.DragEvent, team: Team) => {
    e.preventDefault();
    const userData = e.dataTransfer.getData('application/json');
    if (!userData) return;
    const user: User = JSON.parse(userData);
    
    await updateDoc(doc(db, 'teams', team.id), {
      supervisorId: user.uid,
      supervisorName: user.name
    });
  };

  const handleDropMember = async (e: React.DragEvent, team: Team) => {
    e.preventDefault();
    const userData = e.dataTransfer.getData('application/json');
    if (!userData) return;
    const user: User = JSON.parse(userData);
    
    if (!team.members.some(m => m.uid === user.uid)) {
      const newMembers = [...team.members, { uid: user.uid, name: user.name }];
      await updateDoc(doc(db, 'teams', team.id), {
        members: newMembers
      });
    }
  };

  const handleRemoveMember = async (team: Team, memberUid: string) => {
    const newMembers = team.members.filter(m => m.uid !== memberUid);
    await updateDoc(doc(db, 'teams', team.id), {
      members: newMembers
    });
  };

  const handleRemoveLeader = async (team: Team) => {
    await updateDoc(doc(db, 'teams', team.id), {
      supervisorId: '',
      supervisorName: ''
    });
  };

  const renderTeamNode = (team: Team, depth: number = 0) => {
    const childTeams = teams.filter(t => t.parentTeamId === team.id);
    const gap = calculateTeamGap(team);
    const coverage = calculateCoverage(team);
    const isExpanded = expandedTeams[team.id];
    const leaderName = team.supervisorName || users.find(u => u.uid === team.supervisorId)?.name;

    return (
      <div key={team.id} className="flex flex-col items-center">
        <div className={`p-4 rounded-xl border-2 ${gap > 0 ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50'} shadow-sm min-w-[240px] relative z-10 transition-all duration-300`}>
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-gray-800">{team.name}</h3>
            <button 
              onClick={() => setExpandedTeams(prev => ({ ...prev, [team.id]: !prev[team.id] }))}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              title={isExpanded ? "Contraer" : "Expandir"}
            >
              {isExpanded ? '-' : '+'}
            </button>
          </div>
          
          <div className="flex items-center justify-between mt-3">
            <div>
              <p className="text-sm text-gray-600">
                Gap: <span className={`font-bold ${gap > 0 ? 'text-red-600' : 'text-green-600'}`}>{gap} niveles</span>
              </p>
              <p className="text-xs text-gray-500">{team.members.length} miembros</p>
            </div>
            
            <div className="flex flex-col items-center ml-4">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold relative"
                style={{ background: `conic-gradient(#3b82f6 0% ${coverage}%, #e5e7eb ${coverage}% 100%)` }}
                title={`Cobertura: ${coverage}%`}
              >
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-[10px] text-gray-700 absolute">
                  {coverage}%
                </div>
              </div>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-200/50 text-sm">
              <div 
                className={`mb-3 p-2 rounded ${editMode ? 'border-2 border-dashed border-blue-300 bg-blue-50/50 min-h-[60px]' : ''}`}
                onDragOver={editMode ? (e) => e.preventDefault() : undefined}
                onDrop={editMode ? (e) => handleDropLeader(e, team) : undefined}
              >
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Líder</p>
                {leaderName ? (
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-gray-200 shadow-sm">
                    <span className="truncate font-medium text-gray-700">{leaderName}</span>
                    {editMode && (
                      <button onClick={() => handleRemoveLeader(team)} className="text-red-400 hover:text-red-600 ml-2 font-bold px-1">×</button>
                    )}
                  </div>
                ) : (
                  <span className="text-gray-400 italic text-xs block text-center py-1">
                    {editMode ? 'Arrastra un líder aquí' : 'Sin líder asignado'}
                  </span>
                )}
              </div>

              <div 
                className={`p-2 rounded ${editMode ? 'border-2 border-dashed border-green-300 bg-green-50/50 min-h-[80px]' : ''}`}
                onDragOver={editMode ? (e) => e.preventDefault() : undefined}
                onDrop={editMode ? (e) => handleDropMember(e, team) : undefined}
              >
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Miembros</p>
                {team.members.length > 0 ? (
                  <div className="space-y-1.5">
                    {team.members.map(member => (
                      <div key={member.uid} className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-gray-200 shadow-sm">
                        <span className="truncate text-gray-700">{member.name}</span>
                        {editMode && (
                          <button onClick={() => handleRemoveMember(team, member.uid)} className="text-red-400 hover:text-red-600 ml-2 font-bold px-1">×</button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400 italic text-xs block text-center py-1">
                    {editMode ? 'Arrastra miembros aquí' : 'Sin miembros'}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        
        {childTeams.length > 0 && (
          <div className="flex flex-col items-center">
            <div className="w-px h-8 bg-gray-300"></div>
            <div className="flex justify-center relative">
              {childTeams.map((child, index) => (
                <div key={child.id} className="flex flex-col items-center relative px-4">
                  {/* Horizontal line connecting to siblings */}
                  {childTeams.length > 1 && (
                    <div 
                      className="absolute top-0 h-px bg-gray-300"
                      style={{
                        left: index === 0 ? '50%' : '0',
                        right: index === childTeams.length - 1 ? '50%' : '0',
                      }}
                    />
                  )}
                  {/* Vertical line down to this node */}
                  <div className="w-px h-8 bg-gray-300"></div>
                  {renderTeamNode(child, depth + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div>Cargando...</div>;

  const rootTeams = teams.filter(t => !t.parentTeamId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">OHP - Mapa de Gaps</h1>
        {isAdmin && (
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              editMode 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {editMode ? 'Salir de Edición' : 'Modo Edición'}
          </button>
        )}
      </div>
      
      <div className="flex flex-1 gap-6 min-h-0">
        {editMode && isAdmin && (
          <div className="w-64 bg-white p-4 rounded-xl shadow-sm border border-gray-200 overflow-y-auto shrink-0 h-[calc(100vh-160px)] sticky top-6">
            <h3 className="font-bold text-gray-800 mb-4">Usuarios</h3>
            <p className="text-xs text-gray-500 mb-4">Arrastra los usuarios a los equipos para asignarlos como líder o miembros.</p>
            <div className="space-y-2">
              {users.map(user => (
                <div 
                  key={user.uid}
                  draggable
                  onDragStart={(e) => handleDragStart(e, user)}
                  className="p-2 bg-gray-50 border border-gray-200 rounded cursor-move hover:bg-white hover:shadow-sm hover:border-blue-300 transition-all flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-gray-800 text-sm truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate capitalize">{user.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 bg-white p-8 rounded-xl shadow-sm border border-gray-200 overflow-auto">
          <div className="flex justify-center gap-12 min-w-max">
            {rootTeams.length > 0 ? (
              rootTeams.map(team => renderTeamNode(team))
            ) : (
              <p className="text-gray-500">No hay equipos configurados.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
