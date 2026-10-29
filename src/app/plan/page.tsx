import { Suspense } from 'react';
import PlanApp from '@/components/plan/PlanApp';
import { hasSupabase } from '@/lib/supabase/env';
import { requireMember } from '@/lib/supabase/session';

export const metadata = { title: '계획 — SideTown' };

export default async function PlanPage() {
  const meId = hasSupabase ? await requireMember('/plan') : undefined;
  return (
    <Suspense fallback={null}>
      <PlanApp mode={meId ? 'live' : 'demo'} meId={meId} />
    </Suspense>
  );
}
