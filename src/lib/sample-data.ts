import type { Project } from './types';

/** 단계 0 검증용 예시 데이터. 실제 저장소(Supabase) 연결은 단계 1에서 한다. */
export const SAMPLE_TODAY = '2026-10-26';

export const sampleProjects: Project[] = [
  {
    id: 'p-sidetown',
    title: '사이드타운 첫 버전 출시',
    building: 'workshop',
    color: '#F4B03E',
    plotId: 'plot-a',
    definitionOfDone: '공개 가입이 열리고, 실제 배너 광고에서 첫 수익이 확인된다',
    start: '2026-10-01',
    target: '2027-01-31',
    baselineTarget: '2027-01-31',
    status: 'active',
    condition: 'normal',
    milestones: [
      { id: 'm1', title: '범위 확정', criteria: '필수 기능과 제외 기능을 문서로 정리', weight: 1, status: 'completed', start: '2026-10-01', target: '2026-10-09', baselineStart: '2026-10-01', baselineTarget: '2026-10-09', evidence: '기획서 v1.0' },
      { id: 'm2', title: '시각 방향 확정', criteria: 'Higgsfield 기준 시안과 실제 렌더 시험', weight: 1, status: 'completed', start: '2026-10-10', target: '2026-10-25', baselineStart: '2026-10-10', baselineTarget: '2026-10-25', evidence: 'UI 초안 캔버스' },
      { id: 'm3', title: '개인 사용 흐름 구현', criteria: '가입→계획→완료 기록 E2E 실행 결과', weight: 1, status: 'active', start: '2026-10-26', target: '2026-11-30', baselineStart: '2026-10-26', baselineTarget: '2026-11-30' },
      { id: 'm4', title: '친구와 베타', criteria: '실제 참여 피드백과 수정 목록', weight: 1, status: 'planned', start: '2026-12-01', target: '2026-12-24', baselineStart: '2026-12-01', baselineTarget: '2026-12-24' },
      { id: 'm5', title: '공개 서비스 운영', criteria: '공개 주소, 가입·권한·복구 점검', weight: 1, status: 'planned', start: '2026-12-26', target: '2027-01-15', baselineStart: '2026-12-26', baselineTarget: '2027-01-15' },
      { id: 'm6', title: '광고 첫 수익', criteria: '송출 확인과 광고 보고서 수익 기록', weight: 1, status: 'planned', start: '2027-01-16', target: '2027-01-31', baselineStart: '2027-01-16', baselineTarget: '2027-01-31' },
    ],
    quests: [
      { id: 'q1', milestoneId: 'm3', title: 'Supabase 프로젝트·마이그레이션 세팅', estimatedMinutes: 60, status: 'done', due: '2026-10-25', baselineDue: '2026-10-25' },
      { id: 'q2', milestoneId: 'm3', title: '가입 → 계획 확정 흐름 연결하기', estimatedMinutes: 45, status: 'doing', scheduledStart: '2026-10-26', due: '2026-10-30', baselineDue: '2026-10-30' },
      { id: 'q3', milestoneId: 'm3', title: '퀘스트 완료 API에 멱등 키 적용', estimatedMinutes: 30, status: 'todo', scheduledStart: '2026-10-27', due: '2026-10-31', baselineDue: '2026-10-31' },
      { id: 'q4', milestoneId: 'm3', title: '공방 1종 실제 크기 렌더 확인', estimatedMinutes: 20, status: 'todo', scheduledStart: '2026-10-29', due: '2026-11-02', baselineDue: '2026-11-02' },
      { id: 'q5', milestoneId: 'm4', title: '베타 초대 메시지 쓰기', estimatedMinutes: 15, status: 'todo', due: '2026-12-02', baselineDue: '2026-12-02' },
      { id: 'q6', milestoneId: 'm5', title: '복구 시험 체크리스트', estimatedMinutes: 40, status: 'todo', due: '2027-01-05', baselineDue: '2027-01-05' },
    ],
  },
  {
    id: 'p-essay',
    title: '첫 에세이집 독립출판',
    building: 'bookstore',
    color: '#E8775A',
    plotId: 'plot-b',
    definitionOfDone: '인쇄본 100부를 받아 첫 독자 10명에게 전달한다',
    start: '2026-10-20',
    target: '2027-03-27',
    baselineTarget: '2027-03-15',
    status: 'active',
    condition: 'normal',
    milestones: [
      { id: 'e1', title: '원고 구성 확정', criteria: '목차 24편 확정본', weight: 1, status: 'active', start: '2026-10-20', target: '2026-11-20', baselineStart: '2026-10-20', baselineTarget: '2026-11-08' },
      { id: 'e2', title: '초고 완성', criteria: '24편 모두 초고 상태', weight: 2, status: 'planned', start: '2026-11-21', target: '2027-01-22', baselineStart: '2026-11-09', baselineTarget: '2027-01-10' },
      { id: 'e3', title: '퇴고·외부 피드백', criteria: '독자 3명 피드백 반영', weight: 1, status: 'planned', start: '2027-01-23', target: '2027-02-22', baselineStart: '2027-01-11', baselineTarget: '2027-02-10' },
      { id: 'e4', title: '조판·표지·인쇄', criteria: '인쇄소 견적 확정, 샘플 수령', weight: 1, status: 'planned', start: '2027-02-23', target: '2027-03-27', baselineStart: '2027-02-11', baselineTarget: '2027-03-15' },
    ],
    quests: [
      { id: 'eq1', milestoneId: 'e1', title: '기존 원고 파일 한곳에 모으기', estimatedMinutes: 20, status: 'done', due: '2026-10-25', baselineDue: '2026-10-22' },
      { id: 'eq2', milestoneId: 'e1', title: '에세이 제목만으로 목차 초안 쓰기', estimatedMinutes: 40, status: 'todo', scheduledStart: '2026-10-31', due: '2026-11-05', baselineDue: '2026-10-28' },
      { id: 'eq3', milestoneId: 'e1', title: '독자 3명 섭외 메시지', estimatedMinutes: 15, status: 'todo', due: '2026-11-10', baselineDue: '2026-11-01' },
    ],
  },
  {
    id: 'p-cert',
    title: '정보처리기사 필기',
    building: 'lab',
    color: '#7FB2E5',
    plotId: 'plot-c',
    definitionOfDone: '필기 시험에 응시해 합격 기준 점수를 넘긴다',
    start: '2026-08-20',
    target: '2026-11-22',
    baselineTarget: '2026-09-26',
    status: 'active',
    condition: 'decayed',
    milestones: [
      { id: 'c1', title: '이론 1회독', criteria: '과목별 요약 노트 5개', weight: 1, status: 'completed', start: '2026-08-20', target: '2026-09-10', baselineStart: '2026-08-20', baselineTarget: '2026-09-10', evidence: '요약 노트 링크' },
      { id: 'c2', title: '기출 5회분', criteria: '회차별 점수 기록', weight: 1, status: 'active', start: '2026-09-11', target: '2026-11-15', baselineStart: '2026-09-11', baselineTarget: '2026-09-20' },
      { id: 'c3', title: '모의고사·약점 보완', criteria: '모의고사 2회 평균 70점 이상', weight: 1, status: 'planned', start: '2026-11-16', target: '2026-11-21', baselineStart: '2026-09-21', baselineTarget: '2026-09-25' },
    ],
    quests: [
      { id: 'cq1', milestoneId: 'c2', title: '기출 1회차 풀고 채점', estimatedMinutes: 15, status: 'todo', scheduledStart: '2026-10-26', due: '2026-10-28', baselineDue: '2026-09-12' },
      { id: 'cq2', milestoneId: 'c2', title: '데이터베이스 단원 오답 정리', estimatedMinutes: 40, status: 'todo', due: '2026-11-03', baselineDue: '2026-09-15' },
      { id: 'cq3', milestoneId: 'c3', title: '모의고사 1회', estimatedMinutes: 90, status: 'todo', due: '2026-11-17', baselineDue: '2026-09-22' },
    ],
  },
];

/** 데모: 같은 마을 친구(지우)의 프로젝트 — 세부 일정까지 공개 */
export const sampleFriendProjects: Project[] = [
  {
    id: 'f-toeic',
    title: '토익 900점',
    building: 'lab',
    color: '#9CC4EE',
    plotId: 'plot-e',
    definitionOfDone: '12월 정기시험에서 900점 이상 성적표를 받는다',
    start: '2026-10-01',
    target: '2026-12-13',
    baselineTarget: '2026-12-13',
    status: 'active',
    condition: 'normal',
    ownerId: 'jiwoo',
    visibility: 'town',
    stage: 1,
    milestones: [
      { id: 'fm1', title: 'LC 파트 3·4 정리', criteria: '모의 LC 450 이상 2회', weight: 1, status: 'completed', start: '2026-10-01', target: '2026-10-25', baselineStart: '2026-10-01', baselineTarget: '2026-10-25', evidence: '모의고사 455·460' },
      { id: 'fm2', title: 'RC 파트 7 속도', criteria: '75분 안에 100문항', weight: 2, status: 'active', start: '2026-10-26', target: '2026-11-22', baselineStart: '2026-10-26', baselineTarget: '2026-11-22' },
      { id: 'fm3', title: '실전 모의 5회', criteria: '평균 880 이상', weight: 1, status: 'planned', start: '2026-11-23', target: '2026-12-12', baselineStart: '2026-11-23', baselineTarget: '2026-12-12' },
    ],
    quests: [
      { id: 'fq1', milestoneId: 'fm2', title: '파트 7 단일지문 30문항 타이머', estimatedMinutes: 30, status: 'done', scheduledStart: '2026-10-26', due: '2026-10-27', baselineDue: '2026-10-27' },
      { id: 'fq2', milestoneId: 'fm2', title: '이중지문 오답 노트', estimatedMinutes: 40, status: 'doing', scheduledStart: '2026-10-29', due: '2026-10-31', baselineDue: '2026-10-31' },
      { id: 'fq3', milestoneId: 'fm2', title: '어휘 300개 2회독', estimatedMinutes: 25, status: 'todo', scheduledStart: '2026-10-31', due: '2026-11-05', baselineDue: '2026-11-05' },
    ],
  },
];

/** 데모: 두 번째 마을(친구 그룹) */
export const sampleTown2 = {
  id: 'demo-weekend',
  name: '주말 스터디 마을',
  friends: [{ id: 'harin', name: '하린' }],
  townProjects: [
    {
      id: 'h-portfolio',
      title: '포트폴리오 사이트',
      building: 'workshop',
      color: '#C9A0F0',
      plotId: 'plot-c',
      definitionOfDone: '작업물 6개가 올라간 사이트를 공개한다',
      start: '2026-10-10',
      target: '2026-12-20',
      baselineTarget: '2026-12-20',
      status: 'active',
      condition: 'normal',
      ownerId: 'harin',
      visibility: 'town',
      stage: 0,
      milestones: [
        { id: 'hm1', title: '작업물 고르기', criteria: '6개 선정·설명 한 줄', weight: 1, status: 'active', start: '2026-10-10', target: '2026-11-05', baselineStart: '2026-10-10', baselineTarget: '2026-11-05' },
        { id: 'hm2', title: '디자인·구현', criteria: '모바일까지 동작', weight: 2, status: 'planned', start: '2026-11-06', target: '2026-12-10', baselineStart: '2026-11-06', baselineTarget: '2026-12-10' },
        { id: 'hm3', title: '공개', criteria: '도메인 연결', weight: 1, status: 'planned', start: '2026-12-11', target: '2026-12-20', baselineStart: '2026-12-11', baselineTarget: '2026-12-20' },
      ],
      quests: [
        { id: 'hq1', milestoneId: 'hm1', title: '지난 작업 폴더 훑기', estimatedMinutes: 30, status: 'todo', scheduledStart: '2026-10-31', due: '2026-11-01', baselineDue: '2026-11-01' },
      ],
    },
  ] as Project[],
};
