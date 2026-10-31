'use client';

/**
 * 보상형 광고(웹). Google Ad Manager의 GPT ‘rewarded’ 형식을 쓴다.
 *  NEXT_PUBLIC_GAM_REWARDED_AD_UNIT = "/네트워크ID/광고단위" 를 넣으면 실제 광고, 없으면 앱 안 테스트 광고.
 * 흐름: 불러오기(rewardedSlotReady) → 사용자가 ‘광고 보기’를 누름(makeRewardedVisible) →
 *       끝까지 보면 rewardedSlotGranted → 닫힘(rewardedSlotClosed)에서 결과를 돌려준다.
 * 웹에는 서버 측 시청 확인이 없어서, 서버는 광고 시작 기록 + 최소 15초 + 하루 횟수로 막는다(마이그레이션 참고).
 */
export const REWARDED_UNIT = process.env.NEXT_PUBLIC_GAM_REWARDED_AD_UNIT ?? '';
export const hasRealAds = REWARDED_UNIT.length > 0;
export const TEST_AD_SECONDS = 16;

export type AdResult = 'granted' | 'closed' | 'unavailable';

/* eslint-disable @typescript-eslint/no-explicit-any */
type GT = any;
declare global {
  interface Window {
    googletag?: GT;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadGpt(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    window.googletag = window.googletag || { cmd: [] };
    const s = document.createElement('script');
    s.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('gpt load failed'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface LoadedAd {
  /** 사용자가 누른 순간에 불러야 한다 */
  show: () => Promise<AdResult>;
  dispose: () => void;
}

/** 광고를 불러온다. 지원하지 않거나 재고가 없으면 'unavailable' */
export async function loadRewardedAd(timeoutMs = 12_000): Promise<LoadedAd | 'unavailable'> {
  if (!hasRealAds) return 'unavailable';
  try {
    await loadGpt();
  } catch {
    return 'unavailable';
  }
  const gt = window.googletag!;
  return new Promise((resolve) => {
    let slot: GT = null;
    let ready: GT = null;
    let granted = false;
    let finish: ((r: AdResult) => void) | null = null;
    const pubads = () => gt.pubads();
    const onReady = (e: GT) => {
      if (e.slot !== slot) return;
      ready = e;
      clearTimeout(timer);
      resolve({ show, dispose });
    };
    const onGranted = (e: GT) => {
      if (e.slot === slot) granted = true;
    };
    const onClosed = (e: GT) => {
      if (e.slot !== slot) return;
      finish?.(granted ? 'granted' : 'closed');
      dispose();
    };
    const dispose = () => {
      try {
        pubads().removeEventListener('rewardedSlotReady', onReady);
        pubads().removeEventListener('rewardedSlotGranted', onGranted);
        pubads().removeEventListener('rewardedSlotClosed', onClosed);
        if (slot) gt.destroySlots([slot]);
      } catch {
        /* 이미 정리됨 */
      }
      slot = null;
    };
    const show = () =>
      new Promise<AdResult>((res) => {
        if (!ready) return res('unavailable');
        finish = res;
        ready.makeRewardedVisible();
      });
    const timer = setTimeout(() => {
      dispose();
      resolve('unavailable');
    }, timeoutMs);
    gt.cmd.push(() => {
      slot = gt.defineOutOfPageSlot(REWARDED_UNIT, gt.enums.OutOfPageFormat.REWARDED);
      // null이면 이 페이지·기기에서 보상형 광고를 쓸 수 없다
      if (!slot) {
        clearTimeout(timer);
        resolve('unavailable');
        return;
      }
      slot.addService(pubads());
      pubads().addEventListener('rewardedSlotReady', onReady);
      pubads().addEventListener('rewardedSlotGranted', onGranted);
      pubads().addEventListener('rewardedSlotClosed', onClosed);
      gt.enableServices();
      gt.display(slot);
    });
  });
}
