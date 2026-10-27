'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginForm({ next, error }: { next: string; error?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>(error ? 'error' : 'idle');
  const [msg, setMsg] = useState(error ? '로그인을 마치지 못했어요. 다시 시도해 주세요.' : '');
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const google = async () => {
    const { error: e } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } });
    if (e) {
      setState('error');
      setMsg('Google 로그인을 시작하지 못했어요. Supabase에서 Google 공급자가 켜져 있는지 확인해 주세요.');
    }
  };

  const magic = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    setState('sending');
    const { error: e } = await supabaseBrowser().auth.signInWithOtp({ email, options: { emailRedirectTo: callback() } });
    if (e) {
      setState('error');
      setMsg(/rate/i.test(e.message) ? '잠시 뒤에 다시 보내 주세요.' : '메일을 보내지 못했어요. 주소를 확인해 주세요.');
      return;
    }
    setState('sent');
  };

  if (state === 'sent') {
    return (
      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }} role="status">
        <b style={{ fontSize: 14 }}>메일함을 확인해 주세요</b>
        <span className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>{email}로 로그인 링크를 보냈어요. 링크를 누르면 마을로 돌아와요.</span>
        <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setState('idle')}>다른 주소로 받기</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button className="btn" style={{ height: 46, justifyContent: 'center', gap: 10 }} onClick={google}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Google로 계속하기
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} aria-hidden>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span className="muted" style={{ fontSize: 11 }}>또는 이메일</span>
        <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <form onSubmit={magic} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>이메일 주소</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <button className="btn btn-primary" disabled={state === 'sending'} style={{ height: 44 }}>
          {state === 'sending' ? '보내는 중…' : '로그인 링크 받기'}
        </button>
        <span className="muted" style={{ fontSize: 11 }}>비밀번호 없이, 메일로 받은 링크로 로그인해요.</span>
      </form>
      {state === 'error' && <span role="alert" style={{ fontSize: 12, color: 'var(--coral)' }}>{msg}</span>}
    </div>
  );
}
