'use client';

import { useEffect, useRef } from 'react';
import { windAt, type SceneId } from '@/focus/scenes';

/**
 * 영상 위에 얹는 살아 있는 날씨 — 바람 세기에 따라 기울어지는 비·눈, 돌풍에 날리는 낙엽,
 * 가끔 지나가는 새 떼, 물가의 반딧불. 모션 줄이기 설정이면 그리지 않는다.
 */
export default function AmbientLayer({ scene, onWind }: { scene: SceneId; onWind?: (w: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let W = 0;
    let H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; ph: number };
    const drops: P[] = [];
    const flakes: P[] = [];
    const leaves: P[] = [];
    const flies: P[] = [];
    const n = Math.round((W * H) / 9000);
    if (scene === 'rain') for (let i = 0; i < n; i++) drops.push({ x: rnd(0, W), y: rnd(0, H), vx: 0, vy: rnd(0.7, 1.1), r: rnd(8, 16), a: rnd(0.12, 0.3), ph: 0 });
    if (scene === 'snow') for (let i = 0; i < n * 0.7; i++) flakes.push({ x: rnd(0, W), y: rnd(0, H), vx: 0, vy: rnd(0.02, 0.06), r: rnd(1, 2.6), a: rnd(0.4, 0.9), ph: rnd(0, 6.28) });
    if (scene === 'evening') for (let i = 0; i < 26; i++) flies.push({ x: rnd(W * 0.25, W * 0.85), y: rnd(H * 0.55, H * 0.95), vx: 0, vy: 0, r: rnd(1.2, 2.2), a: 0, ph: rnd(0, 6.28) });

    type Bird = { x: number; y: number; v: number; flap: number; dy: number };
    let flock: Bird[] = [];
    let nextFlock = performance.now() + rnd(6000, 14000);
    let lastWindReport = 0;

    const draw = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const wind = windAt(now);
      if (onWind && now - lastWindReport > 1000) {
        onWind(wind);
        lastWindReport = now;
      }
      ctx.clearRect(0, 0, W, H);

      // 비: 바람이 셀수록 기울고 빨라진다
      if (drops.length) {
        ctx.strokeStyle = '#9cc4ee';
        ctx.lineWidth = 1;
        const slant = 0.15 + wind * 0.6;
        for (const d of drops) {
          d.y += d.vy * dt * (1 + wind * 0.4);
          d.x += d.vy * dt * slant;
          if (d.y > H) { d.y = -d.r; d.x = rnd(-W * 0.3, W); }
          if (d.x > W) d.x -= W;
          ctx.globalAlpha = d.a;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - d.r * slant, d.y - d.r);
          ctx.stroke();
        }
      }
      // 눈: 흔들리며 바람 쪽으로 흐른다
      if (flakes.length) {
        ctx.fillStyle = '#f4f1ea';
        for (const f of flakes) {
          f.ph += dt * 0.002;
          f.y += f.vy * dt;
          f.x += (Math.sin(f.ph) * 0.02 + wind * 0.09) * dt;
          if (f.y > H) { f.y = -4; f.x = rnd(-W * 0.2, W); }
          if (f.x > W + 4) f.x = -4;
          ctx.globalAlpha = f.a;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, 6.283);
          ctx.fill();
        }
      }
      // 낙엽: 맑은 저녁의 돌풍 때만
      if (scene === 'evening' && wind > 0.55 && Math.random() < 0.08) {
        leaves.push({ x: -10, y: rnd(H * 0.15, H * 0.7), vx: rnd(0.12, 0.22), vy: rnd(-0.02, 0.03), r: rnd(3, 5), a: 0.9, ph: rnd(0, 6.28) });
      }
      for (const l of leaves) {
        l.ph += dt * 0.006;
        l.x += l.vx * dt * (0.6 + wind);
        l.y += (l.vy + Math.sin(l.ph) * 0.03) * dt;
        ctx.globalAlpha = l.a;
        ctx.fillStyle = l.r > 4 ? '#d9822b' : '#c8a13a';
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.ph);
        ctx.fillRect(-l.r, -l.r / 2, l.r * 2, l.r);
        ctx.restore();
      }
      for (let i = leaves.length - 1; i >= 0; i--) if (leaves[i].x > W + 20) leaves.splice(i, 1);

      // 반딧불
      for (const f of flies) {
        f.ph += dt * 0.0012;
        f.x += Math.cos(f.ph * 1.3) * 0.015 * dt + wind * 0.01 * dt;
        f.y += Math.sin(f.ph) * 0.012 * dt;
        if (f.x > W * 0.9) f.x = W * 0.25;
        const glow = 0.35 + 0.65 * Math.max(0, Math.sin(f.ph * 2.2));
        ctx.globalAlpha = glow * 0.8;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 5);
        g.addColorStop(0, 'rgba(255,224,140,1)');
        g.addColorStop(1, 'rgba(255,224,140,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 5, 0, 6.283);
        ctx.fill();
      }

      // 새 떼: 가끔 하늘을 가로지른다(눈 오는 밤에는 드물게)
      if (now > nextFlock && !flock.length) {
        const count = scene === 'snow' ? 2 : Math.round(rnd(3, 6));
        const y0 = rnd(H * 0.06, H * 0.28);
        flock = Array.from({ length: count }, (_, i) => ({ x: -30 - i * rnd(18, 30), y: y0 + (i % 2 ? 1 : -1) * i * 7, v: rnd(0.07, 0.1), flap: rnd(0, 6.28), dy: rnd(-0.004, 0.004) }));
        nextFlock = now + rnd(25000, 50000);
      }
      ctx.strokeStyle = '#1b1f2a';
      ctx.lineWidth = 1.6;
      for (const b of flock) {
        b.x += (b.v + wind * 0.03) * dt;
        b.y += b.dy * dt;
        b.flap += dt * 0.014;
        const wing = 3 + Math.sin(b.flap) * 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(b.x - 7, b.y - wing);
        ctx.quadraticCurveTo(b.x - 3, b.y - 1, b.x, b.y);
        ctx.quadraticCurveTo(b.x + 3, b.y - 1, b.x + 7, b.y - wing);
        ctx.stroke();
      }
      if (flock.length && flock.every((b) => b.x > W + 30)) flock = [];
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else {
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [scene, onWind]);

  return <canvas ref={ref} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
