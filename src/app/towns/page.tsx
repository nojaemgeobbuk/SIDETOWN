import TownsApp from '@/components/TownsApp';
import { hasSupabase } from '@/lib/supabase/env';
import { requireMember } from '@/lib/supabase/session';

export const metadata = { title: '내 마을 — SideTown' };

export default async function TownsPage() {
  const meId = hasSupabase ? await requireMember('/towns') : undefined;
  return <TownsApp mode={meId ? 'live' : 'demo'} meId={meId} />;
}
