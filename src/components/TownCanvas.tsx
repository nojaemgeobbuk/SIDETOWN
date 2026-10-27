'use client';

import { useEffect, useRef } from 'react';
import { buildingStage } from '@/lib/schedule';
import { useApp } from '@/store/useApp';
import type { BuildingVM, TownRenderer } from '@/town/TownRenderer';

export default function TownCanvas({ panelOpen }: { panelOpen: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<TownRenderer | null>(null);
  const ready = useRef(false);
  const friendsKey = useRef('');
  const projects = useApp((s) => s.projects);
  const townProjects = useApp((s) => s.townProjects);
  const friends = useApp((s) => s.friends);
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
          onSelectProject: (id) => useApp.getState().select(id),
          onSelectStatic: (id) => useApp.getState().openView(id === 'home' ? { kind: 'home' } : { kind: 'cafe' }),
          onEmptyPlot: (plotId) => useApp.getState().openView({ kind: 'new', plotId }),
          onSelectFriend: (friendId) => useApp.getState().openView({ kind: 'inbox', friendId }),
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
    const vms: BuildingVM[] = [...s.projects, ...s.townProjects].map((p) => ({
      projectId: p.id,
      plotId: p.plotId,
      type: p.building,
      // 친구 프로젝트는 중간 목표를 볼 수 없으므로 서버가 계산한 단계 캐시를 쓴다
      stage: s.townProjects.includes(p) ? (Math.min(3, Math.max(0, p.stage ?? 0)) as BuildingVM["stage"]) : buildingStage(p),
      condition: p.condition,
      title: p.title,
      color: p.color,
      paused: p.status === 'paused',
    }));
    r.setBuildings(vms);
  };

  const syncFriends = () => {
    const r = renderer.current;
    if (!r || !ready.current) return;
    const fs = useApp.getState().friends;
    // 다시 불러오기마다 캐릭터가 제자리로 돌아가지 않도록, 보이는 내용이 바뀔 때만 다시 그린다
    const key = fs.map((f) => `${f.id}:${f.status}:${f.plotId ?? ''}:${f.name}`).join('|');
    if (key === friendsKey.current) return;
    friendsKey.current = key;
    r.setFriends(fs.filter((f) => f.status !== 'offline').map((f) => ({ id: f.id, name: f.name, status: f.status === 'focus' ? 'focus' : 'online', projectPlotId: f.plotId })));
  };

  useEffect(() => {
    sync();
  }, [projects, townProjects]);

  useEffect(() => {
    syncFriends();
  }, [friends]);

  useEffect(() => {
    const r = renderer.current;
    if (!r || !ready.current) return;
    const desktop = window.innerWidth >= 1024;
    r.setPanelOffset(panelOpen && desktop ? 384 : 0);
    r.setSelected(selectedId);
    if (view?.kind === 'cafe' || view?.kind === 'home') r.focusStatic(view.kind);
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
