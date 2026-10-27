import { describe, expect, it } from 'vitest';
import { buildPrompt, DraftRequest, parseGemini, templateDraft } from './plan-draft';

const wrap = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });
const good = {
  definitionOfDone: '앱스토어에 출시한다',
  milestones: [
    { title: '범위 확정', criteria: '기능 3개 문서', weight: 1 },
    { title: '핵심 기능', criteria: '가입부터 기록까지 동작', weight: 3 },
    { title: '공개', criteria: '스토어 등록', weight: 2 },
  ],
  firstQuest: { title: '기능 3개 적기', estimatedMinutes: 15 },
};

describe('AI 계획 초안', () => {
  it('스키마를 통과한 응답만 받는다', () => {
    expect(parseGemini(wrap(JSON.stringify(good)))?.milestones).toHaveLength(3);
    expect(parseGemini(wrap('```json\n' + JSON.stringify(good) + '\n```'))).not.toBeNull();
  });

  it('형식이 어긋나면 null(→ 템플릿으로 대체)', () => {
    expect(parseGemini(wrap('계획: 열심히 하기'))).toBeNull();
    expect(parseGemini(wrap(JSON.stringify({ ...good, milestones: good.milestones.slice(0, 1) })))).toBeNull();
    expect(parseGemini(wrap(JSON.stringify({ ...good, firstQuest: { title: '책 한 권 다 읽기', estimatedMinutes: 300 } })))).toBeNull();
    expect(parseGemini({})).toBeNull();
  });

  it('입력 검증과 프롬프트에 기간이 들어간다', () => {
    expect(DraftRequest.safeParse({ title: '', building: 'lab', today: '2026-10-27', target: '2026-12-01' }).success).toBe(false);
    const r = DraftRequest.parse({ title: '정보처리기사', building: 'lab', today: '2026-10-27', target: '2026-12-06' });
    expect(buildPrompt(r)).toContain('40일');
  });

  it('템플릿 초안도 같은 모양', () => {
    const t = templateDraft({ building: 'bookstore' });
    expect(t.source).toBe('template');
    expect(t.milestones.length).toBeGreaterThanOrEqual(3);
  });
});
