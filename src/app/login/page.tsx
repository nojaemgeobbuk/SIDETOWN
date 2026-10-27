import { redirect } from 'next/navigation';
import AuthShell from '@/components/auth/AuthShell';
import LoginForm from '@/components/auth/LoginForm';
import { hasSupabase } from '@/lib/supabase/env';
import { currentUserId } from '@/lib/supabase/server';
import { safeNext } from '@/lib/supabase/session';

export const metadata = { title: '로그인 — SideTown' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!hasSupabase) redirect('/');
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await currentUserId()) redirect(next);
  return (
    <AuthShell kicker="WELCOME" title="사이드 프로젝트 마을에 들어가기" sub="퀘스트를 끝낼 때마다 내 건물이 자라고, 친구와 같은 마을에서 서로의 불빛을 봐요.">
      <LoginForm next={next} error={sp.error} />
    </AuthShell>
  );
}
