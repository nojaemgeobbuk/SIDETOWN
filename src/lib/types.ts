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
  note?: string;
}

/** 친구에게 보이는 범위: 비공개 · 겉모습만(이름·건물·단계) · 세부 일정까지 */
export type Visibility = 'private' | 'exterior' | 'town';

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
  /** demolishing: 철거 중(1시간), archived: 철거 끝(마을에서 사라짐) */
  status: 'active' | 'paused' | 'completed' | 'demolishing' | 'archived';
  condition: Condition;
  milestones: Milestone[];
  quests: Quest[];
  /** 서버 모드: 소유자 id, 서버가 계산한 단계 캐시, 일정 버전(동시 수정 확인용) */
  ownerId?: string;
  stage?: number;
  planVersion?: number;
  visibility?: Visibility;
  /** 철거가 끝나는 시각(ISO) */
  demolishEndsAt?: string;
  /** 명예의 전당에 올린 시각(ISO). 있으면 마을 부지에서 빠진다 */
  hallAt?: string;
  copiedFrom?: string;
  /** 철거를 취소하면 돌아갈 상태 */
  prevStatus?: 'active' | 'paused';
}

/** 캐릭터 외형(팔레트 키) */
export interface Avatar {
  hair?: string;
  skin?: string;
  top?: string;
  bottom?: string;
}

export interface TownSummary {
  id: string;
  name: string;
  members: number;
  myProjects: number;
  ownerId?: string;
}

export type RescheduleScope = 'only' | 'cascade' | 'squeeze';

export interface RescheduleResult {
  project: Project;
  targetShiftDays: number;
  movedQuestIds: string[];
  movedMilestoneIds: string[];
  conflicts: string[];
}
