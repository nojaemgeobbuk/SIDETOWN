'use client';

import { useEffect, useRef } from 'react';
import { buildingStage } from '@/lib/schedule';
import { useApp } from '@/store/useApp';
import type { BuildingVM, TownRenderer } from '@/town/TownRenderer';

export default function TownCanvas({ panelOpen }: { panelOpen: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<TownRenderer | null>(null);
  const ready = useRef(false);
  const projects = useApp((s) => s.projects);
  const selectedId = useApp((s) => s.selectedId);

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
          onSelectStatic: (_id, label) => useApp.getState().notify(`${label} · 공용 공간은 단계 2(공동 마을)에서 열려요`),
          onEmptyPlot: () => useApp.getState().notify('빈 부지 · 새 프로젝트 만들기는 단계 1에서 연결돼요'),
          onBackgroundTap: () => useApp.getState().select(null),
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
        r.setFriends([{ name: '지우', status: 'focus', projectPlotId: 'plot-c' }, { name: '민', status: 'online' }]);
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
      renderer.current?.destroy();
      renderer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = () => {
    const r = renderer.current;
    if (!r || !ready.current) return;
    const s = useApp.getState();
    const vms: BuildingVM[] = s.projects.map((p) => ({
      projectId: p.id,
      plotId: p.plotId,
      type: p.building,
      stage: buildingStage(p),
      condition: p.condition,
      title: p.title,
      color: p.color,
      paused: p.status === 'paused',
    }));
    r.setBuildings(vms);
  };

  useEffect(sync, [projects]);

  useEffect(() => {
    const r = renderer.current;
    if (!r || !ready.current) return;
    const desktop = window.innerWidth >= 1024;
    r.setPanelOffset(panelOpen && desktop ? 384 : 0);
    r.setSelected(selectedId);
  }, [selectedId, panelOpen]);

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
