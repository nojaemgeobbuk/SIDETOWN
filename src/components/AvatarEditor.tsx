'use client';

import { useState } from 'react';
import { avatarKey, ORIGINAL_LABEL, PALETTE, PARTS, PRESETS } from '@/lib/avatar';
import type { Facing } from '@/lib/avatar-canvas';
import type { Avatar } from '@/lib/types';
import { useApp } from '@/store/useApp';
import AvatarImg from './AvatarImg';

const FACINGS: { f: Facing; label: string }[] = [
  { f: 'front-right', label: '앞' },
  { f: 'front-left', label: '왼쪽' },
  { f: 'back-left', label: '뒤' },
  { f: 'back-right', label: '오른쪽 뒤' },
];

/** 내 집 · 꾸미기: 머리·겉옷·바지·신발 색. 저장하면 마을의 내 캐릭터와 친구 화면에 반영된다 */
export default function AvatarEditor() {
  const saved = useApp((s) => s.me.avatar);
  const [draft, setDraft] = useState<Avatar>(saved ?? {});
  const [facing, setFacing] = useState<Facing>('front-right');
  const dirty = avatarKey(draft) !== avatarKey(saved);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="avatar-stage">
        <AvatarImg avatar={draft} facing={facing} height={180} alt="꾸민 캐릭터 미리보기" />
        <div className="seg" role="radiogroup" aria-label="보는 방향">
          {FACINGS.map((x) => (
            <button key={x.f} role="radio" aria-checked={facing === x.f} onClick={() => setFacing(x.f)}>{x.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="flabel">빠른 조합</span>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {PRESETS.map((p) => (
            <button key={p.name} className="preset" aria-pressed={avatarKey(p.avatar) === avatarKey(draft)} onClick={() => setDraft(p.avatar)}>
              <AvatarImg avatar={p.avatar} height={64} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {PARTS.map((part) => {
        const cur = draft[part.field] ?? Object.keys(PALETTE[part.key])[0];
        return (
          <div key={part.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="flabel">{part.label}</span>
            <div className="swatches" role="radiogroup" aria-label={part.label}>
              {Object.entries(PALETTE[part.key]).map(([key, tone]) => {
                const label = tone?.label ?? ORIGINAL_LABEL[part.key].label;
                const sw = tone?.swatch ?? ORIGINAL_LABEL[part.key].swatch;
                return (
                  <button key={key} role="radio" aria-checked={cur === key} aria-label={label} title={label} onClick={() => setDraft({ ...draft, [part.field]: key })}>
                    <span style={{ background: sw }} />
                    <em>{label}</em>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1, opacity: dirty ? 1 : 0.5 }} disabled={!dirty} onClick={() => useApp.getState().saveAvatar(draft)}>이 모습으로 저장</button>
        <button className="btn" disabled={!dirty} onClick={() => setDraft(saved ?? {})}>되돌리기</button>
      </div>
      <span className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>저장하면 마을을 걷는 내 캐릭터와, 같은 마을 친구들 화면의 내 모습이 바뀌어요.</span>
    </div>
  );
}
