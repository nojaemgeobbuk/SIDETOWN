import { redirect } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import { CreateTownForm } from '@/components/auth/TownForms';
import { hasSupabase } from '@/lib/supabase/env';
import { currentUserId, supabaseServer } from '@/lib/supabase/server';

export const metadata = { title: '마을 만들기 — SideTown' };

export default async function OnboardingPage() {
  if (!hasSupabase) redirect('/');
  const uid = await currentUserId();
  if (!uid) redirect('/login?next=/onboarding');
  const supabase = await supabaseServer();
  const { data } = await supabase.from('town_members').select('town_id').eq('user_id', uid).maybeSingle();
  if (data) redirect('/');
  return (
    <AuthShell kicker="NEW TOWN" title="내 마을을 지어요" sub="친구에게 초대 링크를 받았다면 그 링크를 열어 주세요. 처음이라면 여기서 마을을 만들어요.">
      <CreateTownForm />
      <form action="/auth/signout" method="post">
        <button className="btn btn-ghost btn-sm">다른 계정으로 로그인</button>
      </form>
    </AuthShell>
  );
}
