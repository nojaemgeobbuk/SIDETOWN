/**
 * 집중 모드 소리 엔진 — 기획서 6.6.
 * 음원 파일 없이 Web Audio로 lo-fi BGM 3곡과 환경음 4종을 실시간 합성한다.
 * 첫 재생은 사용자 클릭 안에서 ensure()를 불러야 한다(브라우저 자동 재생 정책).
 */
export type Layer = 'bgm' | 'rain' | 'fire' | 'cafe' | 'wave';
export type Volumes = Record<Layer, number>;

export interface Track {
  name: string;
  bpm: number;
  chords: number[][];
}

export const TRACKS: Track[] = [
  { name: '새벽 공방', bpm: 72, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]] },
  { name: '비 오는 서점', bpm: 66, chords: [[57, 60, 64, 67], [50, 53, 57, 60, 64], [55, 59, 62, 65], [48, 52, 55, 59]] },
  { name: '연구소의 별', bpm: 78, chords: [[51, 55, 58, 62], [48, 51, 55, 58], [56, 60, 63, 67], [46, 50, 53, 56]] },
];

const BASE: Volumes = { bgm: 0.55, rain: 1, fire: 1, cafe: 1, wave: 1 };
const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface ShotOpts {
  peak: number;
  attack?: number;
  noise?: boolean;
  freq: number;
  freqEnd?: number;
  ftype?: BiquadFilterType;
  q?: number;
  wave?: OscillatorType;
  detune?: number;
}

export class AudioEngine {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private bus = {} as Record<Layer, GainNode>;
  private bgmIn!: BiquadFilterNode;
  private white!: AudioBuffer;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  vol: Volumes = { bgm: 55, rain: 70, fire: 0, cafe: 25, wave: 30 };
  bgmOn = true;
  track = 0;

  get started() {
    return !!this.ac;
  }

  ensure(): boolean {
    if (this.ac) {
      if (this.ac.state === 'suspended') void this.ac.resume();
      return true;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return false;
    const ac = new AC();
    this.ac = ac;
    this.master = ac.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ac.destination);
    const sr = ac.sampleRate;
    const len = sr * 2;
    this.white = ac.createBuffer(1, len, sr);
    const wd = this.white.getChannelData(0);
    for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1;
    const brown = ac.createBuffer(1, len, sr);
    const bd = brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      bd[i] = last * 3.5;
    }
    const loop = (buf: AudioBuffer) => {
      const s = ac.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    };
    const filt = (type: BiquadFilterType, f: number, q?: number) => {
      const b = ac.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      if (q) b.Q.value = q;
      return b;
    };
    const gain = (v: number) => {
      const g = ac.createGain();
      g.gain.value = v;
      return g;
    };
    const chain = (...nodes: AudioNode[]) => nodes.reduce((a, b) => (a.connect(b), b));
    (['bgm', 'rain', 'fire', 'cafe', 'wave'] as Layer[]).forEach((k) => {
      const g = gain(0);
      g.connect(this.master);
      this.bus[k] = g;
    });
    chain(loop(this.white), filt('bandpass', 2600, 0.4), gain(0.32), this.bus.rain);
    chain(loop(brown), filt('lowpass', 900), gain(0.5), this.bus.rain);
    chain(loop(brown), filt('lowpass', 380), gain(0.55), this.bus.fire);
    const wg = gain(0.28);
    chain(loop(brown), filt('lowpass', 520), wg, this.bus.wave);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoAmt = gain(0.24);
    lfo.connect(lfoAmt).connect(wg.gain);
    lfo.start();
    const cg = gain(0.22);
    chain(loop(this.white), filt('bandpass', 650, 0.9), cg, this.bus.cafe);
    [0.31, 0.53].forEach((f) => {
      const o = ac.createOscillator();
      o.frequency.value = f;
      const a = gain(0.07);
      o.connect(a).connect(cg.gain);
      o.start();
    });
    this.bgmIn = filt('lowpass', 2200);
    this.bgmIn.connect(this.bus.bgm);
    chain(loop(this.white), filt('highpass', 3500), gain(0.008), this.bgmIn);
    this.nextBeat = ac.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 50);
    this.apply();
    return true;
  }

  apply() {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    (Object.keys(BASE) as Layer[]).forEach((k) => {
      let v = Math.pow((this.vol[k] || 0) / 100, 2) * BASE[k];
      if (k === 'bgm' && !this.bgmOn) v = 0;
      this.bus[k].gain.setTargetAtTime(v, t, 0.2);
    });
  }

  setVolume(k: Layer, v: number) {
    this.vol = { ...this.vol, [k]: v };
    this.apply();
  }

  setBgm(on: boolean) {
    this.bgmOn = on;
    this.apply();
  }

  nextTrack() {
    this.track = (this.track + 1) % TRACKS.length;
    this.beat = 0;
  }

  chime() {
    if (!this.ac) return;
    const t = this.ac.currentTime + 0.05;
    [880, 1320, 1760].forEach((f, k) => this.shot(this.master, t + k * 0.12, 1.6, { freq: f, peak: 0.12 / (k + 1) }));
  }

  close() {
    if (this.timer) clearInterval(this.timer);
    void this.ac?.close();
    this.ac = null;
  }

  private shot(dest: AudioNode, t: number, dur: number, o: ShotOpts) {
    const ac = this.ac!;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.peak, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(dest);
    if (o.noise) {
      const src = ac.createBufferSource();
      src.buffer = this.white;
      const f = ac.createBiquadFilter();
      f.type = o.ftype ?? 'highpass';
      f.frequency.value = o.freq;
      if (o.q) f.Q.value = o.q;
      src.connect(f).connect(g);
      src.start(t, Math.random() * 1.5, dur + 0.05);
    } else {
      const src = ac.createOscillator();
      src.type = o.wave ?? 'sine';
      src.frequency.setValueAtTime(o.freq, t);
      if (o.freqEnd) src.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur * 0.6);
      if (o.detune) src.detune.value = o.detune;
      src.connect(g);
      src.start(t);
      src.stop(t + dur + 0.05);
    }
  }

  private tick() {
    const ac = this.ac;
    if (!ac) return;
    const now = ac.currentTime;
    const v = this.vol;
    if (v.fire > 0 && Math.random() < 0.22) this.shot(this.bus.fire, now + Math.random() * 0.05, 0.03 + Math.random() * 0.05, { noise: true, freq: 1200 + Math.random() * 3000, peak: 0.25 + Math.random() * 0.5 });
    if (v.cafe > 0 && Math.random() < 0.004) {
      const f = 2400 + Math.random() * 900;
      this.shot(this.bus.cafe, now + 0.02, 0.35, { freq: f, peak: 0.05 });
      this.shot(this.bus.cafe, now + 0.02, 0.25, { freq: f * 1.5, peak: 0.03 });
    }
    if (v.rain > 0 && Math.random() < 0.3) this.shot(this.bus.rain, now + Math.random() * 0.05, 0.02, { noise: true, freq: 3500, ftype: 'bandpass', q: 2, peak: 0.08 + Math.random() * 0.12 });
    if (!this.bgmOn) {
      this.nextBeat = now + 0.1;
      return;
    }
    const tr = TRACKS[this.track];
    const eighth = 60 / tr.bpm / 2;
    while (this.nextBeat < now + 0.25) {
      this.step(tr, this.beat, this.nextBeat, eighth);
      this.nextBeat += eighth;
      this.beat++;
    }
  }

  private step(tr: Track, i: number, t: number, eighth: number) {
    const step = i % 8;
    const ch = tr.chords[Math.floor(i / 8) % tr.chords.length];
    const tt = t + (step % 2 === 1 ? eighth * 0.16 : 0);
    const out = this.bgmIn;
    if (step === 0) {
      ch.forEach((m, k) => {
        this.shot(out, tt + k * 0.012, eighth * 7.6, { freq: mf(m), wave: 'sine', peak: 0.07, attack: 0.03 });
        this.shot(out, tt + k * 0.012, eighth * 3, { freq: mf(m + 12), wave: 'triangle', peak: 0.012, attack: 0.01, detune: 6 });
      });
      this.shot(out, tt, eighth * 3.5, { freq: mf(ch[0] - 12), peak: 0.16, attack: 0.01 });
    }
    if (step === 4) this.shot(out, tt, eighth * 3, { freq: mf(ch[0] - 12), peak: 0.1, attack: 0.01 });
    if ((step === 3 || step === 6) && Math.random() < 0.45) this.shot(out, tt, eighth * 2.5, { freq: mf(ch[Math.floor(Math.random() * ch.length)] + 12), wave: 'triangle', peak: 0.035, attack: 0.01 });
    if (step === 0 || step === 5) this.shot(out, tt, 0.32, { freq: 110, freqEnd: 42, peak: 0.55 });
    if (step === 4) this.shot(out, tt, 0.18, { noise: true, freq: 1700, ftype: 'bandpass', q: 0.7, peak: 0.16 });
    this.shot(out, tt, 0.04, { noise: true, freq: 7000, peak: step % 2 === 0 ? 0.035 : 0.02 });
  }
}
