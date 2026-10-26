'use client';

import { useMemo } from 'react';
import type { Health } from '@/lib/types';

/** 기획서 6.7 항해 진척도: 배=실제, 부표=계획 위치, 깃발=목표일, 물결=상태 */
export default function Voyage({
  progress,
  expected,
  color,
  health,
  width = 240,
  height = 40,
}: {
  progress: number;
  expected: number;
  color: string;
  health: Health;
  width?: number;
  height?: number;
}) {
  const chop = health === 'ok' ? 1.0 : health === 'warn' ? 1.8 : 2.6;
  const d = useMemo(() => {
    const w = width;
    const h = height;
    const s = h / 40;
    const amp = chop * s;
    const wy = h * 0.7;
    const x0 = 4 * s + 4;
    const x1 = w - 10 * s - 4;
    const X = (pct: number) => x0 + ((x1 - x0) * Math.max(0, Math.min(100, pct))) / 100;
    const period = 16;
    const wave = (from: number, to: number, y: number, a: number, phase: number) => {
      let p = '';
      for (let x = from; x <= to; x += 1) {
        const yy = y + Math.sin(((x + phase) / period) * Math.PI * 2) * a;
        p += (p ? ' L' : 'M') + x.toFixed(1) + ' ' + yy.toFixed(2);
      }
      return p;
    };
    const bx = X(progress);
    const ex = X(expected);
    const by = wy + Math.sin((bx / period) * Math.PI * 2) * amp - 1;
    return {
      back: wave(-period, w + period * 2, wy + 3.5 * s, amp * 0.7, 5),
      front: wave(0, w, wy, amp, 0),
      wake: wave(0, Math.max(1, Math.round(bx)), wy, amp, 0),
      bx,
      by,
      ex,
      wy,
      s,
      fx: x1 + 4 * s,
    };
  }, [width, height, chop, progress, expected]);
  const behind = progress < expected - 3;
  const buoy = behind ? '#E8775A' : '#98A0B3';
  const s = d.s;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`진척도 ${progress}%, 지금 계획 위치 ${expected}%`} className="voyage">
      <style>{`.voyage .back{animation:vy-drift 7s linear infinite}.voyage .boat{animation:vy-bob 2.6s ease-in-out infinite}@keyframes vy-drift{to{transform:translateX(-16px)}}@keyframes vy-bob{50%{transform:translateY(-1.4px)}}@media (prefers-reduced-motion: reduce){.voyage .back,.voyage .boat{animation:none}}`}</style>
      <path className="back" d={d.back} fill="none" stroke={color} strokeOpacity={0.28} strokeWidth={1.2} strokeLinecap="round" />
      <path d={d.front} fill="none" stroke="#2A3142" strokeWidth={1.6} strokeLinecap="round" />
      <path d={d.wake} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      {expected > 0 && (
        <g>
          <line x1={d.ex} y1={d.wy - 8 * s} x2={d.ex} y2={d.wy} stroke={buoy} strokeWidth={1.2} />
          <rect x={d.ex - 1.5 * s} y={d.wy - 8 * s} width={3 * s} height={3 * s} fill={buoy} />
        </g>
      )}
      <g transform={`translate(${d.fx},${d.wy - 10 * s - 1})`}>
        <line x1={0} y1={0} x2={0} y2={10 * s + 1} stroke="#98A0B3" strokeWidth={1.2} />
        <path d={`M0 0 L${6 * s} ${2 * s} L0 ${4 * s} Z`} fill={color} />
      </g>
      <g transform={`translate(${d.bx},${d.by})`}>
        <g className="boat">
          <path d={`M${-6 * s} 0 L${6 * s} 0 L${4 * s} ${3 * s} L${-4 * s} ${3 * s} Z`} fill="#ECE6DA" />
          <line x1={0} y1={-11 * s} x2={0} y2={0} stroke="#ECE6DA" strokeWidth={1} />
          <path d={`M0.6 ${-11 * s} L0.6 ${-1.5 * s} L${7 * s} ${-1.5 * s} Z`} fill={color} />
        </g>
      </g>
    </svg>
  );
}
