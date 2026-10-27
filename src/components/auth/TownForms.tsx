'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { friendlyError } from '@/lib/live';

function Field({ label, hint, ...rest }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <input className="input" {...rest} />
      {hint && <span className="muted" style={{ fontSize: 11 }}>{hint}</span>}
    </label>
  );
}

/** 처음 온 사람: 닉네임 + 마을 이름 → 마을 만들기 */
export function CreateTownForm() {
  const [nickname, setNickname] = useState('');
  const [town, setTown] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ok = nickname.trim().length > 0 && town.trim().length > 0;
  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || busy) return;
        setBusy(true);
        const { error } = await supabaseBrowser().rpc('create_town', { p_name: town.trim(), p_nickname: nickname.trim() });
        if (error) {
          setErr(friendlyError(new Error(error.message)));
          setBusy(false);
          return;
        }
        window.location.assign('/');
      }}
    >
      <Field label="마을에서 불릴 이름" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="예: 재민" autoFocus required />
      <Field label="마을 이름" hint="친구 2~8명이 함께 살 수 있어요. 나중에 초대 링크를 보낼 수 있어요." value={town} onChange={(e) => setTown(e.target.value)} maxLength={30} placeholder="예: 새벽작업실 마을" required />
      <button className="btn btn-primary" disabled={!ok || busy} style={{ height: 44, opacity: ok ? 1 : 0.5 }}>{busy ? '마을을 짓는 중…' : '마을 만들기'}</button>
      {err && <span role="alert" style={{ fontSize: 12, color: 'var(--coral)' }}>{err}</span>}
    </form>
  );
}

/** 초대 링크로 온 사람: 닉네임 → 마을 들어가기 */
export function AcceptInviteForm({ token }: { token: string }) {
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ok = nickname.trim().length > 0;
  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || busy) return;
        setBusy(true);
        const { error } = await supabaseBrowser().rpc('accept_invite', { p_token: token, p_nickname: nickname.trim() });
        if (error) {
          setErr(friendlyError(new Error(error.message)));
          setBusy(false);
          return;
        }
        window.location.assign('/');
      }}
    >
      <Field label="마을에서 불릴 이름" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} placeholder="예: 지우" autoFocus required />
      <button className="btn btn-primary" disabled={!ok || busy} style={{ height: 44, opacity: ok ? 1 : 0.5 }}>{busy ? '들어가는 중…' : '이 마을에 들어가기'}</button>
      {err && <span role="alert" style={{ fontSize: 12, color: 'var(--coral)' }}>{err}</span>}
    </form>
  );
}
