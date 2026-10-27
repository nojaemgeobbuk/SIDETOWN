import { addDays, daysBetween } from './schedule';
import type { BuildingType, ISODate, Milestone, Project, Quest } from './types';

/** 새 프로젝트 초안 — AI 계획(단계 1)이 붙기 전 기본 템플릿 */
export const BUILDING_INFO: Record<BuildingType, { name: string; role: string; color: string; examples: string }> = {
  workshop: { name: '개발 공방', role: '메이커', color: '#F4B03E', examples: '앱·웹·게임·하드웨어' },
  bookstore: { name: '서점', role: '작가', color: '#E8775A', examples: '출판·글쓰기·뉴스레터' },
  lab: { name: '연구소', role: '학자', color: '#7FB2E5', examples: '자격증·어학·공부' },
};

export const STAGE_NAMES = ['착공', '첫 방', '확장', '랜드마크'] as const;

export const TEMPLATES: Record<BuildingType, { milestones: string[]; firstQuest: string; dod: string }> = {
  workshop: {
    milestones: ['만들 범위 정하기', '핵심 기능 동작', '친구에게 보여주기', '공개하기'],
    firstQuest: '꼭 필요한 기능 3개만 적기',
    dod: '누군가 실제로 써볼 수 있는 주소가 생긴다',
  },
  bookstore: {
    milestones: ['목차 확정', '초고 완성', '퇴고와 피드백', '인쇄·공개'],
    firstQuest: '흩어진 원고를 한 폴더에 모으기',
    dod: '완성본을 첫 독자에게 전달한다',
  },
  lab: {
    milestones: ['범위 파악', '이론 1회독', '기출·모의고사', '응시'],
    firstQuest: '시험 일정과 과목 구성 확인하기',
    dod: '시험에 응시해 결과를 확인한다',
  },
};

let seq = 1;
const id = (p: string) => `${p}-${Date.now().toString(36)}-${seq++}`;

export interface NewProjectInput {
  title: string;
  building: BuildingType;
  definitionOfDone: string;
  target: ISODate;
  milestones: string[];
  firstQuest: string;
  plotId: string;
  today: ISODate;
}

/** 입력을 기준선이 잡힌 프로젝트로 만든다. 중간 목표는 목표일까지 고르게 나눈다 */
export function createProject(input: NewProjectInput): Project {
  const titles = input.milestones.map((m) => m.trim()).filter(Boolean);
  const msTitles = titles.length ? titles : ['완료'];
  const span = Math.max(msTitles.length, daysBetween(input.today, input.target));
  const per = span / msTitles.length;
  const milestones: Milestone[] = msTitles.map((t, i) => {
    const start = addDays(input.today, Math.round(i * per));
    const target = addDays(input.today, Math.round((i + 1) * per) - (i === msTitles.length - 1 ? 0 : 1));
    return { id: id('m'), title: t, criteria: '완료 기준을 적어 주세요', weight: 1, status: i === 0 ? 'active' : 'planned', start, target, baselineStart: start, baselineTarget: target };
  });
  const quests: Quest[] = input.firstQuest.trim()
    ? [{ id: id('q'), milestoneId: milestones[0].id, title: input.firstQuest.trim(), estimatedMinutes: 20, status: 'todo', scheduledStart: input.today, due: addDays(input.today, 3), baselineDue: addDays(input.today, 3) }]
    : [];
  return {
    id: id('p'),
    title: input.title.trim(),
    building: input.building,
    color: BUILDING_INFO[input.building].color,
    plotId: input.plotId,
    definitionOfDone: input.definitionOfDone.trim() || TEMPLATES[input.building].dod,
    start: input.today,
    target: input.target,
    baselineTarget: input.target,
    status: 'active',
    condition: 'normal',
    milestones,
    quests,
  };
}
