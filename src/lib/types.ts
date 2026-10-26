export type ISODate = string; // YYYY-MM-DD (사용자 시간대 기준 날짜)

export type BuildingType = 'workshop' | 'bookstore' | 'lab';
export type Condition = 'normal' | 'decayed' | 'repairing';
export type Health = 'ok' | 'warn' | 'late';

export interface Milestone {
  id: string;
  title: string;
  criteria: string;
  weight: number;
  status: 'planned' | 'active' | 'completed';
  start: ISODate;
  target: ISODate;
  baselineStart: ISODate;
  baselineTarget: ISODate;
  pinned?: boolean;
  evidence?: string;
}

export interface Quest {
  id: string;
  milestoneId: string;
  title: string;
  estimatedMinutes: number;
  status: 'todo' | 'doing' | 'done';
  scheduledStart?: ISODate;
  due?: ISODate;
  baselineDue?: ISODate;
  pinned?: boolean;
}

export interface Project {
  id: string;
  title: string;
  building: BuildingType;
  color: string;
  plotId: string;
  definitionOfDone: string;
  start: ISODate;
  target: ISODate;
  baselineTarget: ISODate;
  status: 'active' | 'paused' | 'completed';
  condition: Condition;
  milestones: Milestone[];
  quests: Quest[];
}

export type RescheduleScope = 'only' | 'cascade' | 'squeeze';

export interface RescheduleResult {
  project: Project;
  targetShiftDays: number;
  movedQuestIds: string[];
  movedMilestoneIds: string[];
  conflicts: string[];
}
