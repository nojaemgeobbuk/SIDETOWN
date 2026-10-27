import Link from 'next/link';
import { redirect } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { AcceptInviteForm } from '@/components/auth/TownForms';
import { hasSupabase } from '@/lib/supabase/env';
import { currentUserId, supabaseServer } from '@/lib/supabase/server';

export const metadata = { title: '마을 초대 — SideTown' };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  if (!hasSupabase) redirect('/');
  const { token } = await params;
  const supabase = await supabaseServer();
  const { data: preview } = await supabase.rpc('invite_preview', { p_token: token });
  const p = preview as { town_name: string; members: number; valid: boolean } | null;

  if (!p || !p.valid || p.members >= 8) {
    return (
      <AuthShell kicker="INVITE" title="이 초대 링크는 쓸 수 없어요" sub={p && p.members >= 8 ? '마을 정원(8명)이 다 찼어요.' : '링크가 만료됐거나 취소됐어요. 친구에게 새 링크를 부탁해 주세요.'}>
        <Link href="/" className="btn btn-sm" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>처음으로</Link>
      </AuthShell>
    );
  }

  const uid = await currentUserId();
  const here = `/invite/${encodeURIComponent(token)}`;
  if (!uid) {
    return (
      <AuthShell kicker="INVITE" title={`‘${p.town_name}’에 초대받았어요`} sub={`지금 ${p.members}명이 살고 있어요. 로그인하면 바로 들어갈 수 있어요.`}>
        <Link href={`/login?next=${encodeURIComponent(here)}`} className="btn btn-primary" style={{ textDecoration: 'none', height: 44, justifyContent: 'center' }}>로그인하고 들어가기</Link>
      </AuthShell>
    );
  }

  const { data: member } = await supabase.from('town_members').select('town_id').eq('user_id', uid).maybeSingle();
  if (member) {
    return (
      <AuthShell kicker="INVITE" title="이미 다른 마을에 살고 있어요" sub="지금은 한 사람이 한 마을에만 살 수 있어요.">
        <Link href="/" className="btn btn-sm" style={{ textDecoration: 'none', alignSelf: 'flex-start' }}>내 마을로</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell kicker="INVITE" title={`‘${p.town_name}’에 들어가기`} sub={`지금 ${p.members}명이 살고 있어요. 들어가면 친구들의 건물이 보이고 쪽지를 주고받을 수 있어요.`}>
      <AcceptInviteForm token={token} />
    </AuthShell>
  );
}
