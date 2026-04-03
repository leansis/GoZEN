import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Activity, Process, Task, Team, UserTaskLevel } from '../types';
import { ChevronDown, ChevronRight, Users, Target } from 'lucide-react';
import clsx from 'clsx';

export default function ProcessMap() {
  const { dbUser, isAdmin, isSupervisor, activeCompanyId } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [userTaskLevels, setUserTaskLevels] = useState<UserTaskLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [expandedProcesses, setExpandedProcesses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!dbUser || !activeCompanyId) return;

    const qActivities = query(collection(db, 'activities'), where('companyId', '==', activeCompanyId));
    const qProcesses = query(collection(db, 'processes'), where('companyId', '==', activeCompanyId));
    const qTasks = query(collection(db, 'tasks'), where('companyId', '==', activeCompanyId));
    const qTeams = query(collection(db, 'teams'), where('companyId', '==', activeCompanyId));
    const qLevels = query(collection(db, 'userTaskLevels'), where('companyId', '==', activeCompanyId));

    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)).sort((a, b) => (a.order || 0) - (b.order || 0)));
    });

    const unsubProcesses = onSnapshot(qProcesses, (snapshot) => {
      setProcesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process)).sort((a, b) => (a.order || 0) - (b.order || 0)));
    });

    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)).sort((a, b) => (a.order || 0) - (b.order || 0)));
    });

    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      let fetchedTeams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      if (!isAdmin && isSupervisor) {
        fetchedTeams = fetchedTeams.filter(t => t.supervisorId === dbUser.uid);
      }
      setTeams(fetchedTeams);
    });

    const unsubLevels = onSnapshot(qLevels, (snapshot) => {
      setUserTaskLevels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserTaskLevel)));
      setLoading(false);
    });

    return () => {
      unsubActivities();
      unsubProcesses();
      unsubTasks();
      unsubTeams();
      unsubLevels();
    };
  }, [dbUser, isAdmin, isSupervisor, activeCompanyId]);

  const toggleProcess = (processId: string) => {
    setExpandedProcesses(prev => {
      const next = new Set(prev);
      if (next.has(processId)) {
        next.delete(processId);
      } else {
        next.add(processId);
      }
      return next;
    });
  };

  const getProcessStats = (processId: string) => {
    const processTasks = tasks.filter(t => t.processId === processId);
    
    let teamsToConsider = teams;
    if (selectedTeamId !== 'all') {
      teamsToConsider = teams.filter(t => t.id === selectedTeamId);
    }

    // Get all members from considered teams
    const members = new Set<string>();
    teamsToConsider.forEach(team => {
      team.members.forEach(m => members.add(m.uid));
    });

    let cappedCurrent = 0;
    let totalTarget = 0;
    let hasEvaluatedTasks = false;

    processTasks.forEach(task => {
      members.forEach(memberUid => {
        const level = userTaskLevels.find(l => l.taskId === task.id && l.userId === memberUid);
        if (level) {
          const current = level.currentLevel || 0;
          const target = level.targetLevel || 0;
          
          if (current > 0) {
            hasEvaluatedTasks = true;
          }

          cappedCurrent += Math.min(current, target);
          totalTarget += target;
        }
      });
    });

    const coverage = totalTarget > 0 ? Math.round((cappedCurrent / totalTarget) * 100) : 0;

    return { coverage, hasEvaluatedTasks, taskCount: processTasks.length };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Cargando mapa de procesos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Mapa de Procesos</h1>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
          <Users className="w-5 h-5 text-gray-500" />
          <select
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="border-none bg-transparent focus:ring-0 text-sm font-medium text-gray-700 cursor-pointer outline-none"
          >
            <option value="all">Todos los equipos</option>
            {teams.map(team => (
              <option key={team.id} value={team.id}>{team.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-8 pt-4 gap-4 snap-x">
        {activities.map((activity, index) => {
          const activityProcesses = processes.filter(p => p.activityId === activity.id);
          
          return (
            <div key={activity.id} className="flex-shrink-0 w-80 snap-start flex flex-col">
              {/* Chevron Header */}
              <div className="relative mb-6 drop-shadow-md">
                <div 
                  className="bg-blue-800 text-white p-4 font-bold text-center flex items-center justify-center min-h-[4rem]"
                  style={{
                    clipPath: activities.length === 1 ? 'none' : 
                              index === 0 ? 'polygon(0% 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 0% 100%)' :
                              index === activities.length - 1 ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 16px 50%)' :
                              'polygon(0% 0%, calc(100% - 16px) 0%, 100% 50%, calc(100% - 16px) 100%, 0% 100%, 16px 50%)'
                  }}
                >
                  <span className={clsx("relative z-20", index > 0 && "pl-2", index < activities.length - 1 && "pr-2")}>
                    {activity.name}
                  </span>
                </div>
              </div>

              {/* Processes List */}
              <div className="flex flex-col gap-3 flex-1">
                {activityProcesses.map(process => {
                  const stats = getProcessStats(process.id);
                  const isExpanded = expandedProcesses.has(process.id);
                  const processTasks = tasks.filter(t => t.processId === process.id);
                  
                  return (
                    <div 
                      key={process.id} 
                      className={clsx(
                        "rounded-lg border shadow-sm transition-all duration-200",
                        stats.hasEvaluatedTasks ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"
                      )}
                    >
                      <div 
                        className="p-4 cursor-pointer hover:bg-black/5 flex flex-col gap-2"
                        onClick={() => toggleProcess(process.id)}
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-gray-800 leading-tight">{process.name}</h3>
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs font-medium text-gray-500 bg-white/60 px-2 py-1 rounded">
                            {stats.taskCount} tareas
                          </span>
                          
                          <div className="flex items-center gap-1.5" title="Cobertura vs Objetivo">
                            <Target className={clsx("w-4 h-4", stats.coverage >= 100 ? "text-green-600" : stats.coverage >= 50 ? "text-yellow-600" : "text-red-500")} />
                            <span className={clsx(
                              "text-sm font-bold",
                              stats.coverage >= 100 ? "text-green-700" : stats.coverage >= 50 ? "text-yellow-700" : "text-red-600"
                            )}>
                              {stats.coverage}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tasks Dropdown */}
                      {isExpanded && processTasks.length > 0 && (
                        <div className="border-t border-gray-200/60 bg-white/50 p-3 flex flex-col gap-2 rounded-b-lg">
                          {processTasks.map(task => (
                            <div key={task.id} className="text-sm text-gray-700 bg-white p-2 rounded border border-gray-100 shadow-sm flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"></div>
                              <span>{task.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {activityProcesses.length === 0 && (
                  <div className="text-center p-4 text-sm text-gray-400 italic border-2 border-dashed border-gray-200 rounded-lg">
                    Sin procesos
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
