import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { INVITE_COOKIE } from './invite-cookie';
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
  // 초대 링크로 들어왔다가 로그인 중 주소를 잃었으면, 내 마을보다 그 초대를 먼저 보여 준다
  const pending = (await cookies()).get(INVITE_COOKIE)?.value;
  if (pending && /^[A-Za-z0-9]{16,128}$/.test(pending)) redirect(`/invite/${pending}`);
  if (!(await hasAnyTown(uid))) redirect('/onboarding');
  return uid;
}

/**
 * 마을에 하나라도 속해 있는가. v1.3부터 여러 마을에 속할 수 있으므로 maybeSingle()을 쓰면 안 된다
 * (두 줄 이상이면 오류와 함께 null을 돌려줘 ‘마을 없음’으로 잘못 판정된다)
 */
export async function hasAnyTown(uid: string): Promise<boolean> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from('town_members').select('town_id').eq('user_id', uid).limit(1);
  if (error) throw new Error(`town_members: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
