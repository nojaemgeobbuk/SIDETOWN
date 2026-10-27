import { NextResponse } from 'next/server';
import { buildPrompt, DraftRequest, GEMINI_SCHEMA, parseGemini, SYSTEM_PROMPT, templateDraft, type DraftResponse } from '@/lib/plan-draft';
import { hasSupabase } from '@/lib/supabase/env';
import { currentUserId, supabaseServer } from '@/lib/supabase/server';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// 데모 모드(로그인 없음)일 때만 쓰는 간단한 IP 제한. 서버 모드는 DB의 ai_usage로 제한한다
const demoHits = new Map<string, number[]>();
function demoAllowed(ip: string) {
  const now = Date.now();
  const hits = (demoHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (hits.length >= 10) return false;
  hits.push(now);
  demoHits.set(ip, hits);
  return true;
}

async function callGemini(prompt: string, key: string, model: string): Promise<unknown> {
  const base = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };
  const post = (generationConfig: Record<string, unknown>) =>
    fetch(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ ...base, generationConfig: { temperature: 0.6, ...generationConfig } }),
      signal: AbortSignal.timeout(20_000),
    });
  // 현재 문서의 형식 → 거절되면 이전 형식으로 한 번 더
  let res = await post({ responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: GEMINI_SCHEMA } } });
  if (res.status === 400) res = await post({ responseMimeType: 'application/json', responseJsonSchema: GEMINI_SCHEMA });
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  return res.json();
}

export async function POST(request: Request) {
  let input: DraftRequest;
  try {
    const parsed = DraftRequest.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    input = parsed.data;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (hasSupabase) {
    if (!(await currentUserId())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const supabase = await supabaseServer();
    const { data: allowed, error } = await supabase.rpc('consume_ai_quota', { p_limit: 20 });
    if (error) return NextResponse.json(templateDraft(input));
    if (!allowed) return NextResponse.json({ ...templateDraft(input), limited: true }, { status: 200 });
  } else {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (!demoAllowed(ip)) return NextResponse.json({ ...templateDraft(input), limited: true });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json(templateDraft(input));

  try {
    const body = await callGemini(buildPrompt(input), key, process.env.GEMINI_MODEL || 'gemini-3.8-flash');
    const plan = parseGemini(body);
    if (!plan) return NextResponse.json(templateDraft(input));
    const out: DraftResponse = { source: 'ai', ...plan };
    return NextResponse.json(out);
  } catch (e) {
    console.error('plan draft failed', e instanceof Error ? e.message : e);
    return NextResponse.json(templateDraft(input));
  }
}
