import { Suspense } from 'react';
import FocusScreen from '@/components/FocusScreen';

export const metadata = { title: '집중 모드 — SideTown' };

export default function FocusPage() {
  return (
    <Suspense fallback={null}>
      <FocusScreen />
    </Suspense>
  );
}
