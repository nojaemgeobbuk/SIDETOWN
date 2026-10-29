'use client';

import { useMemo, useState } from 'react';
import { daysBetween } from '@/lib/schedule';
import { BUILDING_INFO } from '@/lib/templates';
import type { Project } from '@/lib/types';
import { useApp } from '@/store/useApp';
import { IconClose, IconTrophy } from './icons';

const ymd = (iso?: string) => (iso ? iso.slice(0, 10).replace(/-/g, '.') : '');

/** 명예의 전당: 완공해 부지에서 옮긴 랜드마크와 그 기록. 같은 마을 친구의 것도 함께 전시 */
export default function HallOfFame({ onClose }: { onClose: () => void }) {
  const projects = useApp((s) => s.projects);
  const townProjects = useApp((s) => s.townProjects);
  const friends = useApp((s) => s.friends);
  const townName = useApp((s) => s.townName);
  const [open, setOpen] = useState<string | null>(null);
  const items = useMemo(
    () => [...projects.map((p) => ({ p, mine: true })), ...townProjects.map((p) => ({ p, mine: false }))]
      .filter(({ p }) => !!p.hallAt)
      .sort((a, b) => b.p.hallAt!.localeCompare(a.p.hallAt!)),
    [projects, townProjects],
  );
  const ready = projects.filter((p) => p.status === 'completed' && !p.hallAt);
  const nameOf = (p: Project) => friends.find((f) => f.id === p.ownerId)?.name ?? '이웃';

  return (
    <>
      <div className="panel-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chip" style={{ color: 'var(--amber)', borderColor: 'rgba(244,176,62,0.5)' }}>공용</span>
          <span className="muted" style={{ fontSize: 12 }}>{townName} · 완공 {items.length}</span>
          <div style={{ flex: 1 }} />
          <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="패널 닫기" onClick={onClose}><IconClose width={18} height={18} /></button>
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', display: 'flex', alignItems: 'center', gap: 8 }}><IconTrophy /> 명예의 전당</h1>
      </div>
      <div className="panel-scroll">
        <div className="hall-hero">
          <img src="/assets/town/hall.png" alt="명예의 전당 건물" />
          <span className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>끝까지 해낸 프로젝트가 랜드마크로 전시돼요. 완공한 건물을 여기로 옮기면 마을 부지가 비어 다음 프로젝트를 지을 수 있어요.</span>
        </div>

        {ready.length > 0 && (
          <div className="notice good" style={{ flexDirection: 'column', gap: 8 }}>
            <span>완공하고 아직 마을에 서 있는 건물이 {ready.length}개 있어요.</span>
            {ready.map((p) => (
              <button key={p.id} className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => useApp.getState().moveToHall(p.id)}>‘{p.title}’ 올리기</button>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div className="empty-panel" style={{ padding: 12 }}>
            <IconTrophy width={28} height={28} />
            <span>아직 전시된 랜드마크가 없어요.<br />첫 프로젝트를 완공하면 여기 올릴 수 있어요.</span>
          </div>
        )}

        <div className="hall-grid">
          {items.map(({ p, mine }) => {
            const days = Math.max(1, daysBetween(p.start, (p.hallAt ?? '').slice(0, 10) || p.target));
            const isOpen = open === p.id;
            return (
              <article key={p.id} className="hall-item card" style={{ ['--pc' as string]: p.color }}>
                <button className="hall-top" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
                  <img src={`/assets/town/${p.building}-s3.png`} alt="" />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <b className="ellipsis" style={{ fontSize: 14 }}>{p.title}</b>
                    <span className="muted" style={{ fontSize: 11 }}>{mine ? '나' : `${nameOf(p)}님`} · {BUILDING_INFO[p.building].role} · {days}일 항해</span>
                    <span className="mono muted" style={{ fontSize: 10 }}>{ymd(p.start)} → {ymd(p.hallAt)}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="hall-log">
                    {p.definitionOfDone && <span className="dod" style={{ fontSize: 12 }}>{p.definitionOfDone}</span>}
                    {p.milestones.length === 0 && <span className="muted" style={{ fontSize: 12 }}>세부 기록은 공개되지 않았어요.</span>}
                    {p.milestones.map((m, i) => (
                      <div key={m.id} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                        <span className="mono" style={{ color: 'var(--pc)' }}>{String(i + 1).padStart(2, '0')}</span>
                        <span style={{ flex: 1 }}>
                          <b style={{ fontWeight: 600 }}>{m.title}</b>
                          {m.evidence && <span className="muted" style={{ display: 'block' }}>{m.evidence}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
