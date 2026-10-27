import 'server-only';
import { redirect } from 'next/navigation';
import { currentUserId, supabaseServer } from './server';

/** 안전한 이동 경로만 허용(외부 주소·프로토콜 상대 주소 차단) */
export function safeNext(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return fallback;
  return raw;
}

/** 로그인 + 마을 소속을 요구한다. 아니면 로그인·마을 만들기로 보낸다 */
export async function requireMember(next: string): Promise<string> {
  const uid = await currentUserId();
  if (!uid) redirect(`/login?next=${encodeURIComponent(next)}`);
  const supabase = await supabaseServer();
  const { data } = await supabase.from('town_members').select('town_id').eq('user_id', uid).maybeSingle();
  if (!data) redirect('/onboarding');
  return uid;
}
