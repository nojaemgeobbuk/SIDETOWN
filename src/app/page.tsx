import TownApp from '@/components/TownApp';
import { hasSupabase } from '@/lib/supabase/env';
import { requireMember } from '@/lib/supabase/session';

export default async function Page() {
  // Supabase 키가 없으면 로그인 없이 데모 마을(브라우저 저장)
  if (!hasSupabase) return <TownApp mode="demo" />;
  const meId = await requireMember('/');
  return <TownApp mode="live" meId={meId} />;
}
