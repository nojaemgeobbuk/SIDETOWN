'use client';

import { useEffect, useRef } from 'react';
import { buildingStage } from '@/lib/schedule';
import { mapProjects, useApp } from '@/store/useApp';
import { useFocus } from '@/focus/useFocus';
import type { BuildingVM, TownRenderer } from '@/town/TownRenderer';

export default function TownCanvas({ panelOpen }: { panelOpen: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<TownRenderer | null>(null);
  const ready = useRef(false);
  const friendsKey = useRef('');
  const projects = useApp((s) => s.projects);
  const townProjects = useApp((s) => s.townProjects);
  const expansions = useApp((s) => s.expansions);
  const friends = useApp((s) => s.friends);
  const avatar = useApp((s) => s.me.avatar);
  const focusOpen = useFocus((s) => s.open);
  const focusRunning = useFocus((s) => s.timer.endsAt !== null);
  const focusMode = useFocus((s) => s.timer.mode);
  const focusProject = useFocus((s) => s.projectId);
  const workPlot = useApp((s) => s.projects.find((p) => p.id === focusProject)?.plotId);
  const phase: 'focus' | 'break' | 'idle' = !focusRunning ? 'idle' : focusMode === 'focus' ? 'focus' : 'break';
  const selectedId = useApp((s) => s.selectedId);
  const view = useApp((s) => s.view);

  // 생성·해제
  useEffect(() => {
    let alive = true;
    const el = host.current;
    if (!el) return;
    (async () => {
      try {
        const { TownRenderer } = await import('@/town/TownRenderer');
        const r = new TownRenderer(el, {
          // 집중 화면에서는 건물·친구를 눌러도 패널을 열지 않는다(구경만)
          onSelectProject: (id) => !useFocus.getState().open && useApp.getState().select(id),
          onSelectStatic: (id) => !useFocus.getState().open && useApp.getState().openView(id === 'home' ? { kind: 'home' } : id === 'hall' ? { kind: 'hall' } : { kind: 'cafe' }),
          onEmptyPlot: (plotId) => !useFocus.getState().open && useApp.getState().openView({ kind: 'new', plotId }),
          onSelectFriend: (friendId) => !useFocus.getState().open && useApp.getState().openView({ kind: 'inbox', friendId }),
          onExpand: () => !useFocus.getState().open && useApp.getState().setExpandOpen(true),
          onBackgroundTap: () => {
            useApp.getState().select(null);
          },
        });
        renderer.current = r;
        await r.init();
        if (!alive) {
          r.destroy();
          return;
        }
        ready.current = true;
        sync();
        const sel = useApp.getState().selectedId;
        r.setPanelOffset(sel && window.innerWidth >= 1024 ? 384 : 0);
        r.setSelected(sel);
        syncFriends();
        void r.setAvatar(useApp.getState().me.avatar);
        // 집중 화면으로 바로 들어온 경우(예: /focus 링크) 렌더러 준비 뒤에 적용
        const f = useFocus.getState();
        if (f.open) {
          const plot = useApp.getState().projects.find((p) => p.id === f.projectId)?.plotId;
          r.setFocusMode({ on: true, phase: f.timer.endsAt === null ? 'idle' : f.timer.mode === 'focus' ? 'focus' : 'break', workPlotId: plot });
        }
      } catch (err) {
        console.error(err);
        // 기획서 6.4: WebGL 불가 → 목록 화면으로 전환
        useApp.getState().setListMode(true);
        useApp.getState().notify('이 기기에서 마을을 그릴 수 없어 목록으로 보여드려요', 'warn');
      }
    })();
    return () => {
      alive = false;
      ready.current = false;
      friendsKey.current = '';
      renderer.current?.destroy();
      renderer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => {
    const r = renderer.current;
    if (!r || !ready.current) return;
    const s = useApp.getState();
    // 열린 땅 구역을 먼저 반영해야 그 부지의 건물이 놓인다
    r.setExpansions(s.expansions);
    const vms: BuildingVM[] = mapProjects(s).map((p) => ({
      projectId: p.id,
      plotId: p.plotId,
      type: p.building,
      // 친구 프로젝트는 중간 목표를 볼 수 없으므로 서버가 계산한 단계 캐시를 쓴다
      stage: s.townProjects.includes(p) ? (Math.min(3, Math.max(0, p.stage ?? 0)) as BuildingVM["stage"]) : buildingStage(p),
      condition: p.condition,
      title: p.title,
      color: p.color,
      paused: p.status === 'paused',
      demolishEndsAt: p.status === 'demolishing' && p.demolishEndsAt ? new Date(p.demolishEndsAt).getTime() : undefined,
    }));
    r.setBuildings(vms);
  };

  const syncFriends = () => {
    const r = renderer.current;
    if (!r || !ready.current) return;
    const fs = useApp.getState().friends;
    // 다시 불러오기마다 캐릭터가 제자리로 돌아가지 않도록, 보이는 내용이 바뀔 때만 다시 그린다
    const key = fs.map((f) => `${f.id}:${f.status}:${f.plotId ?? ''}:${f.name}:${JSON.stringify(f.avatar ?? {})}`).join('|');
    if (key === friendsKey.current) return;
    friendsKey.current = key;
    r.setFriends(fs.filter((f) => f.status !== 'offline').map((f) => ({ id: f.id, name: f.name, status: f.status === 'focus' ? 'focus' : 'online', projectPlotId: f.plotId, avatar: f.avatar })));
  };

  useEffect(() => {
    sync();
  }, [projects, townProjects, expansions]);

  useEffect(() => {
    syncFriends();
  }, [friends]);

  useEffect(() => {
    if (ready.current) void renderer.current?.setAvatar(avatar);
  }, [avatar]);

  // 집중 모드: 전체 화면으로 바뀐 뒤 마을 전체를 맞추고, 타이머 구간에 따라 내 캐릭터가 움직인다
  useEffect(() => {
    let raf = 0;
    const apply = () => renderer.current?.setFocusMode({ on: focusOpen, phase, workPlotId: workPlot });
    const t = setTimeout(() => {
      apply();
      raf = requestAnimationFrame(() => focusOpen && renderer.current?.refit());
    }, 120);
    if (!focusOpen) return () => clearTimeout(t);
    const onResize = () => renderer.current?.refit();
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize);
    };
  }, [focusOpen, phase, workPlot]);

  useEffect(() => {
    const r = renderer.current;
    if (!r || !ready.current) return;
    const desktop = window.innerWidth >= 1024;
    r.setPanelOffset(panelOpen && desktop ? 384 : 0);
    r.setSelected(selectedId);
    if (view?.kind === 'cafe' || view?.kind === 'home' || view?.kind === 'hall') r.focusStatic(view.kind);
    if (view?.kind === 'new') r.focusPlot(view.plotId);
  }, [selectedId, panelOpen, view]);

  return (
    <>
      <div ref={host} className="canvas-host" />
      <div className="hud bottom-right" style={{ left: 16, bottom: 16 }}>
        <button className="btn btn-sm" aria-label="확대" onClick={() => renderer.current?.zoomBy(1.2)} style={{ width: 40, height: 40, fontSize: 18 }}>+</button>
        <button className="btn btn-sm" aria-label="축소" onClick={() => renderer.current?.zoomBy(1 / 1.2)} style={{ width: 40, height: 40, fontSize: 18 }}>−</button>
      </div>
    </>
  );
}
