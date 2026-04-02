export type Role = 'admin' | 'supervisor' | 'user' | 'lean_promotor';
export type Status = 'active' | 'inactive';

export interface Company {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  uid: string;
  id?: string;
  name: string;
  email: string;
  role: Role;
  status: Status;
  photoURL?: string;
  companyId?: string;
}

export interface TeamMember {
  uid: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  supervisorId: string;
  supervisorName?: string;
  members: TeamMember[];
  processIds: string[];
  parentTeamId?: string;
  companyId: string;
}

export interface Activity {
  id: string;
  name: string;
  description?: string;
  order?: number;
  companyId: string;
}

export interface Process {
  id: string;
  name: string;
  description: string;
  activityId?: string;
  order?: number;
  companyId: string;
}

export interface Attachment {
  name: string;
  url: string;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  activityId?: string;
  processId: string;
  criteriaId: string;
  attachments: Attachment[];
  companyId: string;
}

export interface CriterionItem {
  id: string;
  description: string;
}

export interface CriterionLevel {
  level: number;
  description?: string;
  items: CriterionItem[];
}

export interface Criterion {
  id: string;
  name: string;
  levels: CriterionLevel[];
  companyId: string;
}

export interface UserTaskLevel {
  id: string;
  userId: string;
  userName: string;
  taskId: string;
  currentLevel: number;
  targetLevel: number;
  plannedLevel: number;
  completedItems: string[];
  selfLevel?: number;
  selfCompletedItems?: string[];
  teamId?: string;
  companyId: string;
}

export interface TeamTarget {
  id: string;
  teamId: string;
  processId: string;
  taskId: string;
  targetCounts: Record<number, number>;
  companyId: string;
}

export type TrainingActionStatus = 'planificada' | 'retrasada' | 'completada' | 'verificada';

export interface TrainingAction {
  id: string;
  userId: string;
  userName: string;
  taskId: string;
  targetLevel: number;
  trainerId: string;
  trainerName?: string;
  plannedDate: string;
  endDate?: string;
  status: TrainingActionStatus;
  verifierId?: string;
  verifierName?: string;
  verificationDate?: string;
  description?: string;
  companyId: string;
}
