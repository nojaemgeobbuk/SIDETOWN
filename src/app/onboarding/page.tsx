import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { INVITE_COOKIE } from '@/lib/supabase/invite-cookie';
import AuthShell from '@/components/auth/AuthShell';
import { CreateTownForm } from '@/components/auth/TownForms';
import { hasSupabase } from '@/lib/supabase/env';
import { currentUserId } from '@/lib/supabase/server';
import { hasAnyTown } from '@/lib/supabase/session';

export const metadata = { title: '마을 만들기 — SideTown' };

export default async function OnboardingPage() {
  if (!hasSupabase) redirect('/');
  const uid = await currentUserId();
  // 초대 링크로 왔다가 로그인 중 주소를 잃은 경우: 마을 만들기 대신 그 초대로 돌려보낸다
  const pending = (await cookies()).get(INVITE_COOKIE)?.value;
  if (pending && /^[A-Za-z0-9]{16,128}$/.test(pending)) redirect(`/invite/${pending}`);
  if (!uid) redirect('/login?next=/onboarding');
  if (await hasAnyTown(uid)) redirect('/');
  return (
    <AuthShell kicker="NEW TOWN" title="내 마을을 지어요" sub="친구에게 초대 링크를 받았다면 그 링크를 열어 주세요. 처음이라면 여기서 마을을 만들어요.">
      <CreateTownForm />
      <form action="/auth/signout" method="post">
        <button className="btn btn-ghost btn-sm">다른 계정으로 로그인</button>
      </form>
    </AuthShell>
  );
}
