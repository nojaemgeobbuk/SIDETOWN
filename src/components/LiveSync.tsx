'use client';

import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useApp, type Mode, type Presence } from '@/store/useApp';

/**
 * 앱 시작(데모/서버 모드)과 실시간 동기화.
 *  - 쪽지·프로젝트 표 변화 → 다시 불러오기(RLS가 볼 수 있는 행만 보내 준다)
 *  - Presence: 접속·집중 상태와 작업 중인 건물. 저장하지 않는 휘발성 정보
 *  presence가 'focus'인 화면(집중 모드)에서는 쪽지 알림을 띄우지 않는다(기획서 13.5)
 */
export default function LiveSync({ mode, meId, presence }: { mode: Mode; meId?: string; presence: Presence }) {
  const townId = useApp((s) => s.townId);
  const presenceRef = useRef(presence);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    useApp.getState().boot({ mode, meId });
    // 철거 1시간이 끝났는지 30초마다 확인
    const t = setInterval(() => useApp.getState().tickClock(), 30_000);
    return () => clearInterval(t);
  }, [mode, meId]);

  useEffect(() => {
    if (mode !== 'live' || !townId || !meId) return;
    const sb = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reloadSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void useApp.getState().reload(), 300);
    };

    const db = sb
      .channel(`db:${townId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as { sender_id: string; recipient_id: string | null };
        reloadSoon();
        if (m.sender_id === meId || presenceRef.current.status === 'focus') return;
        const s = useApp.getState();
        const name = s.friends.find((f) => f.id === m.sender_id)?.name ?? '이웃';
        if (m.recipient_id === meId) s.notify(`${name}님이 쪽지를 남겼어요`, 'info');
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, reloadSoon)
      .subscribe();

    const pres = sb.channel(`presence:${townId}`, { config: { presence: { key: meId } } });
    pres
      .on('presence', { event: 'sync' }, () => {
        const state = pres.presenceState<Presence>();
        const byUser: Record<string, Presence> = {};
        for (const [uid, metas] of Object.entries(state)) {
          const last = metas.at(-1);
          if (last && uid !== meId) byUser[uid] = { status: last.status, plotId: last.plotId, since: last.since };
        }
        useApp.getState().applyPresence(byUser);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void pres.track(presenceRef.current);
      });
    channelRef.current = pres;

    return () => {
      if (timer) clearTimeout(timer);
      channelRef.current = null;
      void sb.removeChannel(db);
      void sb.removeChannel(pres);
    };
  }, [mode, meId, townId]);

  // 상태가 바뀌면(예: 집중 중인 건물 변경) 다시 알린다
  useEffect(() => {
    presenceRef.current = presence;
    void channelRef.current?.track(presence);
  }, [presence.status, presence.plotId, presence.since]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
