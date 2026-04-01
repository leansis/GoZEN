import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { Team, Process, Task, UserTaskLevel } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function Statistics() {
  const { dbUser, isAdmin, isSupervisor, activeCompanyId } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userTaskLevels, setUserTaskLevels] = useState<UserTaskLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbUser) return;
    const companyId = activeCompanyId || dbUser.companyId;
    if (!companyId) {
      setLoading(false);
      return;
    }

    const qTeams = query(collection(db, 'teams'), where('companyId', '==', companyId));
    const unsubTeams = onSnapshot(qTeams, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      if (isAdmin) {
        setTeams(data);
      } else if (isSupervisor) {
        setTeams(data.filter(t => 
          t.supervisorId === dbUser?.uid || 
          (t.supervisorId && dbUser?.email && t.supervisorId.toLowerCase() === dbUser.email.toLowerCase()) ||
          t.members.some(m => m.uid === dbUser?.uid)
        ));
      } else {
        setTeams(data.filter(t => t.members.some(m => m.uid === dbUser?.uid)));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    const qProcesses = query(collection(db, 'processes'), where('companyId', '==', companyId));
    const unsubProcesses = onSnapshot(qProcesses, (snapshot) => {
      setProcesses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Process)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'processes');
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
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'userTaskLevels');
    });

    return () => {
      unsubTeams(); unsubProcesses(); unsubTasks(); unsubLevels();
    };
  }, [dbUser, isAdmin, isSupervisor, activeCompanyId]);

  if (loading) return <div>Cargando...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Estadísticas</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {teams.length > 0 ? (
          teams.map(team => {
            // Calculate stats for each team
            const teamTasks = tasks.filter(t => team.processIds.includes(t.processId));
            const totalPossibleLevels = team.members.length * teamTasks.length * 4; // Assuming max level is 4
            
            let currentTotalLevels = 0;
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
              
              currentTotalLevels += taskCurrent;
              targetTotalLevels += taskTarget;
              // Cap the current levels at the target levels for this specific task
              cappedCurrentForCoverage += Math.min(taskCurrent, taskTarget);
            });

            const polivalenciaIndex = totalPossibleLevels > 0 ? Math.round((currentTotalLevels / totalPossibleLevels) * 100) : 0;
            const coberturaIndex = targetTotalLevels > 0 ? Math.round((cappedCurrentForCoverage / targetTotalLevels) * 100) : 0;

            const data = [
              { name: 'Completado', value: cappedCurrentForCoverage, color: '#3b82f6' },
              { name: 'Faltante', value: Math.max(0, targetTotalLevels - cappedCurrentForCoverage), color: '#e5e7eb' }
            ];

            return (
              <div key={team.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">{team.name}</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600 font-medium mb-1">Índice de Polivalencia</p>
                    <p className="text-3xl font-bold text-green-900">{polivalenciaIndex}%</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium mb-1">Cobertura (vs Objetivo)</p>
                    <p className="text-3xl font-bold text-blue-900">{coberturaIndex}%</p>
                  </div>
                </div>

                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center">
            <p className="text-gray-500">No hay datos disponibles para esta empresa.</p>
            <p className="text-sm text-gray-400 mt-1">Configura equipos, procesos y tareas para ver las estadísticas.</p>
          </div>
        )}
      </div>

      {teams.length > 0 && (
        <div className="mt-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Fórmulas de las Métricas</h3>
          <div className="space-y-4 text-sm text-gray-600">
            <div>
              <p className="font-semibold text-gray-800 mb-1">Índice de Polivalencia</p>
              <p>Mide el nivel general de capacitación del equipo respecto al máximo posible.</p>
              <div className="bg-gray-50 p-3 rounded-lg mt-2 font-mono text-xs overflow-x-auto">
                (∑ Niveles actuales de todos los miembros) / (Nº Miembros × Nº Tareas × Nivel Máximo [4]) × 100
              </div>
            </div>
            <div>
              <p className="font-semibold text-gray-800 mb-1">Cobertura (vs Objetivo)</p>
              <p>Mide cuánto se ha alcanzado de los objetivos de capacitación establecidos para el equipo. Se calcula por tarea, limitando el progreso al 100% del objetivo para no distorsionar la media si hay sobrecapacitación.</p>
              <div className="bg-gray-50 p-3 rounded-lg mt-2 font-mono text-xs overflow-x-auto">
                (∑ min(Suma niveles actuales, Suma niveles objetivo) por tarea) / (∑ Niveles objetivo totales) × 100
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
