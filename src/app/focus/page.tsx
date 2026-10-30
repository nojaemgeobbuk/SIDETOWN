import { redirect } from 'next/navigation';

/** v1.4: 집중 모드는 마을 화면을 전체 화면으로 바꿔 연다. 예전 /focus 링크는 그쪽으로 보낸다 */
export default async function FocusPage({ searchParams }: { searchParams: Promise<{ project?: string; quest?: string }> }) {
  const sp = await searchParams;
  const q = new URLSearchParams({ focus: '1' });
  if (sp.project) q.set('project', sp.project);
  if (sp.quest) q.set('quest', sp.quest);
  redirect(`/?${q.toString()}`);
}
