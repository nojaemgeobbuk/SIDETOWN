'use client';

import { useEffect, useRef, useState } from 'react';
import { hasRealAds, loadRewardedAd, TEST_AD_SECONDS, type LoadedAd } from '@/lib/ads';
import { DISTRICTS } from '@/town/map';
import { useApp } from '@/store/useApp';
import { IconClose, IconPlus } from './icons';

type Step = 'intro' | 'starting' | 'loading' | 'ready' | 'test' | 'claiming' | 'done' | 'failed';

const ORDER = ['e1', 's1', 'e2', 's2'];

/**
 * 땅 넓히기: 보상형 광고 한 편을 끝까지 보면 프로젝트 부지 2칸짜리 구역이 마을에 열린다.
 * 광고 계정이 없으면(환경 변수 없음) 앱 안 테스트 광고로 같은 흐름을 시험한다.
 */
export default function LandExpandDialog() {
  const open = useApp((s) => s.expandOpen);
  const expansions = useApp((s) => s.expansions);
  const townName = useApp((s) => s.townName);
  const [step, setStep] = useState<Step>('intro');
  const [msg, setMsg] = useState('');
  const [left, setLeft] = useState(TEST_AD_SECONDS);
  const [opened, setOpened] = useState<string | null>(null);
  const session = useRef<string | null>(null);
  const ad = useRef<LoadedAd | null>(null);
  const nextId = ORDER.find((x) => !expansions.includes(x));
  const next = DISTRICTS.find((d) => d.id === nextId);

  const close = () => {
    ad.current?.dispose();
    ad.current = null;
    session.current = null;
    setStep('intro');
    setMsg('');
    useApp.getState().setExpandOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step !== 'claiming') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // 테스트 광고 카운트다운
  useEffect(() => {
    if (step !== 'test') return;
    const t = setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [step]);
  useEffect(() => {
    if (step === 'test' && left === 0) void claim();
  }, [step, left]); // eslint-disable-line react-hooks/exhaustive-deps

  const claim = async () => {
    if (!session.current) return;
    setStep('claiming');
    const slot = await useApp.getState().claimExpansion(session.current);
    session.current = null;
    if (slot) {
      setOpened(slot);
      setStep('done');
    } else {
      setStep('failed');
      setMsg('땅을 열지 못했어요. 잠시 뒤에 다시 시도해 주세요.');
    }
  };

  const begin = async () => {
    setStep('starting');
    const s = await useApp.getState().startExpansionAd();
    if (!s) {
      setStep('intro');
      return;
    }
    session.current = s.session;
    if (!hasRealAds) {
      setLeft(TEST_AD_SECONDS);
      setStep('test');
      return;
    }
    setStep('loading');
    const loaded = await loadRewardedAd();
    if (loaded === 'unavailable') {
      setStep('failed');
      setMsg('지금 볼 수 있는 광고가 없어요. 잠시 뒤에 다시 시도해 주세요.');
      return;
    }
    ad.current = loaded;
    setStep('ready');
  };

  const watch = async () => {
    const a = ad.current;
    if (!a) return;
    const r = await a.show();
    ad.current = null;
    if (r === 'granted') await claim();
    else {
      setStep('failed');
      setMsg(r === 'closed' ? '광고를 끝까지 보지 않아 땅이 열리지 않았어요.' : '광고를 재생하지 못했어요.');
    }
  };

  if (!open) return null;
  const openedName = DISTRICTS.find((d) => d.id === opened)?.label;

  return (
    <div className="modal-back" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && step !== 'claiming' && step !== 'test' && close()}>
      <section className="modal land-modal" role="dialog" aria-modal="true" aria-label="땅 넓히기">
        <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="chip" style={{ color: 'var(--amber)', borderColor: 'rgba(244,176,62,0.5)' }}>땅 넓히기</span>
          <span className="muted" style={{ fontSize: 12, flex: 1 }}>{townName} · {expansions.length}/{ORDER.length} 구역</span>
          {step !== 'claiming' && <button className="icon-btn" style={{ width: 34, height: 34 }} aria-label="닫기" onClick={close}><IconClose width={18} height={18} /></button>}
        </header>

        {step === 'test' ? (
          <div className="test-ad" aria-live="polite">
            <span className="test-ad-tag">테스트 광고 · 실제 광고 연결 전</span>
            <div className="test-ad-body">
              <img src="/assets/town/hall.png" alt="" />
              <b>SideTown</b>
              <span>퀘스트를 끝낼 때마다 마을이 자라요</span>
            </div>
            <div className="test-ad-bar"><span style={{ width: `${((TEST_AD_SECONDS - left) / TEST_AD_SECONDS) * 100}%` }} /></div>
            <span className="muted mono" style={{ fontSize: 12 }}>{left > 0 ? `${left}초 뒤 보상` : '보상 받는 중…'}</span>
            <button className="btn btn-ghost btn-sm" onClick={close}>그만 보기 (땅이 열리지 않아요)</button>
          </div>
        ) : step === 'done' ? (
          <div className="land-done" role="status">
            <div className="land-plots big" aria-hidden><span /><span /></div>
            <h2>‘{openedName}’이 열렸어요!</h2>
            <p className="muted">프로젝트 부지 2칸이 생겼어요. 마을 사람 모두 이 땅에 착공할 수 있어요.</p>
            <button className="btn btn-primary" onClick={close}>마을에서 보기</button>
          </div>
        ) : !next ? (
          <div className="land-done">
            <h2>이 마을은 다 넓혔어요</h2>
            <p className="muted">더 넓힐 땅이 없어요. 철거하거나 완공 건물을 명예의 전당에 올리면 부지가 비어요.</p>
            <button className="btn" onClick={close}>닫기</button>
          </div>
        ) : (
          <>
            <div className="land-intro">
              <div className="land-plots" aria-hidden><span /><span /><i><IconPlus /></i></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 19 }}>‘{next.label}’ 열기</h2>
                <span className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                  광고 한 편(15~30초)을 끝까지 보면 프로젝트 부지 <b style={{ color: 'var(--text)' }}>2칸</b>짜리 땅이 마을 옆에 붙어요. 마을 사람 모두 함께 써요.
                </span>
              </div>
            </div>
            <ul className="land-rules">
              <li>한 사람이 하루에 3번까지 넓힐 수 있어요</li>
              <li>마을마다 4구역까지(부지 최대 13칸)</li>
              <li>광고를 중간에 닫으면 땅이 열리지 않아요</li>
            </ul>
            {msg && <span role="alert" style={{ fontSize: 12, color: 'var(--coral)' }}>{msg}</span>}
            <div style={{ display: 'flex', gap: 8 }}>
              {step === 'ready' ? (
                <button className="btn btn-primary" style={{ flex: 1, height: 46 }} onClick={watch}>광고 보기</button>
              ) : (
                <button className="btn btn-primary" style={{ flex: 1, height: 46 }} disabled={step !== 'intro' && step !== 'failed'} onClick={begin}>
                  {step === 'starting' || step === 'loading' ? '광고 불러오는 중…' : step === 'claiming' ? '땅을 여는 중…' : '광고 보고 땅 넓히기'}
                </button>
              )}
              <button className="btn" onClick={close} disabled={step === 'claiming'}>나중에</button>
            </div>
            {!hasRealAds && <span className="muted" style={{ fontSize: 11 }}>광고 계정이 아직 연결되지 않아 테스트 광고가 나와요.</span>}
          </>
        )}
      </section>
    </div>
  );
}
