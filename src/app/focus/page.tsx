import { Suspense } from 'react';
import FocusScreen from '@/components/FocusScreen';
import { hasSupabase } from '@/lib/supabase/env';
import { requireMember } from '@/lib/supabase/session';

export const metadata = { title: '집중 모드 — SideTown' };

export default async function FocusPage() {
  const meId = hasSupabase ? await requireMember('/focus') : undefined;
  return (
    <Suspense fallback={null}>
      <FocusScreen appMode={meId ? 'live' : 'demo'} meId={meId} />
    </Suspense>
  );
}
