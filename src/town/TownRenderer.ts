import {
  Application,
  Assets,
  ColorMatrixFilter,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
} from 'pixi.js';
import type { BuildingType, Condition } from '@/lib/types';
import { findPath, nearestWalkable, type Cell } from './astar';
import { cellCenter, facingFor, isoToScreen, screenToCell, TILE_H, TILE_W, type Facing } from './iso';
import {
  EMPTY_PLOTS,
  groundAt,
  isWalkable,
  isPlotFree,
  MAP_H,
  MAP_W,
  plotById,
  PROPS,
  setOccupiedPlots,
  STATIC_BUILDINGS,
  type Plot,
} from './map';

export interface BuildingVM {
  projectId: string;
  plotId: string;
  type: BuildingType;
  stage: 0 | 1 | 2 | 3;
  condition: Condition;
  title: string;
  color: string;
  paused: boolean;
}

export interface FriendVM {
  id: string;
  name: string;
  status: 'focus' | 'online';
  projectPlotId?: string;
}

export interface TownCallbacks {
  onSelectProject: (projectId: string) => void;
  onSelectStatic: (id: string, label: string) => void;
  onEmptyPlot: (plotId: string) => void;
  onSelectFriend: (friendId: string) => void;
  onBackgroundTap: () => void;
}

const ASSET_BASE = '/assets';
const TEXTURE_KEYS = [
  'workshop-s0', 'workshop-s1', 'workshop-s2', 'workshop-s3', 'workshop-decayed', 'workshop-repairing',
  'bookstore-s0', 'bookstore-s1', 'bookstore-s2', 'bookstore-s3',
  'lab-s0', 'lab-s1', 'lab-s2', 'lab-s3',
  'cafe', 'home', 'tree', 'lamp', 'bench', 'planter',
] as const;
const CHAR_KEYS: Facing[] = ['front-left', 'front-right', 'back-left', 'back-right'];

const COLORS = {
  bg: 0x0e111b,
  grass: [0x2c4428, 0x304a2b, 0x2a4126],
  paving: [0x6b5a47, 0x705e4a, 0x665543],
  water: [0x143040, 0x163446],
  dirt: 0x3a2a1e,
  dirtDark: 0x2c1f16,
  waterSide: 0x0f2230,
  amber: 0xf4b03e,
  coral: 0xe8775a,
  text: 0xece6da,
  panel: 0x121725,
  line: 0x2a3142,
};

const FONT = '"IBM Plex Sans KR", system-ui, sans-serif';

interface BuildingNode {
  vm: BuildingVM;
  plot: Plot;
  root: Container;
  sprite: Sprite;
  overlay: Container;
  label: Container;
  labelText: Text;
  labelBg: Graphics;
  highlight: Graphics;
  pop: number; // 0..1 성장 연출 진행
}

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export class TownRenderer {
  private app = new Application();
  private world = new Container();
  private ground = new Container();
  private objects = new Container();
  private labels = new Container();
  private tex: Record<string, Texture> = {};
  private buildings = new Map<string, BuildingNode>();
  private character!: Sprite;
  private charShadow!: Graphics;
  private charCell: { x: number; y: number } = { x: 11, y: 13 };
  private charPos = cellCenter(11, 13);
  private facing: Facing = 'front-right';
  private path: Cell[] = [];
  private marker!: Graphics;
  private friendNodes: Container[] = [];
  private emptyPlotNodes = new Map<string, Container>();
  private walkers: { node: Container; sprite: Sprite; label: Container; cell: Cell; pos: { x: number; y: number }; path: Cell[]; facing: Facing; wait: number }[] = [];
  private bursts: { g: Graphics; beam: Graphics; cx: number; baseY: number; parts: { x: number; y: number; vx: number; vy: number; c: number; s: number }[]; life: number; text?: Container }[] = [];
  private camTarget: { x: number; y: number; scale: number } | null = null;
  private dragging = false;
  private down: { x: number; y: number; wx: number; wy: number } | null = null;
  private consumed = false;
  private panelOffset = 0;
  private time = 0;
  private reduced = false;
  private destroyed = false;
  private selectedId: string | null = null;
  private onVisibility = () => {
    if (document.hidden) this.app.ticker.stop();
    else this.app.ticker.start();
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    const rect = this.el.getBoundingClientRect();
    this.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
  };

  constructor(private el: HTMLElement, private cb: TownCallbacks) {}

  async init(): Promise<void> {
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    await this.app.init({
      resizeTo: this.el,
      background: COLORS.bg,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
    });
    if (this.destroyed) return;
    this.el.appendChild(this.app.canvas);
    this.app.canvas.setAttribute('aria-label', '마을 지도. 건물을 눌러 프로젝트를 열 수 있어요. 목록 보기로도 같은 기능을 쓸 수 있어요.');
    this.app.canvas.setAttribute('role', 'img');
    this.app.ticker.maxFPS = 45;

    const urls: Record<string, string> = {};
    for (const k of TEXTURE_KEYS) urls[k] = `${ASSET_BASE}/town/${k}.png`;
    for (const k of CHAR_KEYS) urls[`char-${k}`] = `${ASSET_BASE}/character/${k}.png`;
    const loaded = await Assets.load(Object.entries(urls).map(([alias, src]) => ({ alias, src })));
    this.tex = loaded as Record<string, Texture>;
    try {
      await document.fonts.ready;
    } catch {
      /* 글꼴 없이도 동작 */
    }
    if (this.destroyed) return;

    this.objects.sortableChildren = true;
    this.world.addChild(this.ground, this.objects, this.labels);
    this.app.stage.addChild(this.world);

    this.drawGround();
    this.drawEmptyPlots();
    this.drawStatic();
    this.drawProps();
    this.createCharacter();
    this.setupInput();
    this.fitInitial();

    this.app.ticker.add((t) => this.tick(t.deltaMS));
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  destroy() {
    this.destroyed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.el.removeEventListener('wheel', this.onWheel);
    try {
      this.app.destroy({ removeView: true }, { children: true });
    } catch {
      /* 초기화 전에 해제된 경우 */
    }
  }

  // ───────── 지면 ─────────
  private diamond(g: Graphics, x: number, y: number, w = 1, h = 1) {
    const a = isoToScreen(x, y);
    const b = isoToScreen(x + w, y);
    const c = isoToScreen(x + w, y + h);
    const d = isoToScreen(x, y + h);
    return g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]);
  }

  private drawGround() {
    const g = new Graphics();
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const t = groundAt(x, y);
        const v = hash(x, y);
        const palette = t === 'grass' ? COLORS.grass : t === 'paving' ? COLORS.paving : COLORS.water;
        this.diamond(g, x, y).fill({ color: palette[Math.floor(v * palette.length) % palette.length] });
        if (t === 'paving') this.diamond(g, x, y).stroke({ width: 1, color: 0x000000, alpha: 0.12 });
        if (t === 'water' && v > 0.7) {
          const c = cellCenter(x, y);
          g.moveTo(c.x - 10, c.y).lineTo(c.x + 6, c.y - 3).stroke({ width: 1.5, color: COLORS.amber, alpha: 0.25 });
        }
      }
    }
    // 섬 가장자리(앞쪽 두 면)
    const depth = 22;
    for (let i = 0; i < MAP_W; i++) {
      // 오른쪽 아래 면 (y = MAP_H 가장자리)
      {
        const a = isoToScreen(i, MAP_H);
        const b = isoToScreen(i + 1, MAP_H);
        const water = groundAt(i, MAP_H - 1) === 'water';
        g.poly([a.x, a.y, b.x, b.y, b.x, b.y + depth, a.x, a.y + depth]).fill({ color: water ? COLORS.waterSide : COLORS.dirtDark });
      }
      // 왼쪽 아래 면 (x = MAP_W 가장자리)
      {
        const a = isoToScreen(MAP_W, i);
        const b = isoToScreen(MAP_W, i + 1);
        const water = groundAt(MAP_W - 1, i) === 'water';
        g.poly([a.x, a.y, b.x, b.y, b.x, b.y + depth, a.x, a.y + depth]).fill({ color: water ? COLORS.waterSide : COLORS.dirt });
      }
    }
    this.ground.addChild(g);

    // 가로등 빛 웅덩이
    const glow = new Graphics();
    for (const p of PROPS.filter((p) => p.kind === 'lamp')) {
      const c = cellCenter(p.x, p.y);
      for (let r = 4; r >= 1; r--) glow.ellipse(c.x, c.y + 4, r * 22, r * 11).fill({ color: COLORS.amber, alpha: 0.035 });
    }
    glow.blendMode = 'add';
    this.ground.addChild(glow);

    this.marker = new Graphics();
    this.marker.visible = false;
    this.ground.addChild(this.marker);
  }

  private drawEmptyPlots() {
    for (const p of EMPTY_PLOTS) {
      const holder = new Container();
      const g = new Graphics();
      const pts = [isoToScreen(p.x, p.y), isoToScreen(p.x + p.w, p.y), isoToScreen(p.x + p.w, p.y + p.h), isoToScreen(p.x, p.y + p.h)];
      this.diamond(g, p.x, p.y, p.w, p.h).fill({ color: 0x000000, alpha: 0.12 });
      for (let i = 0; i < 4; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % 4];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.floor(len / 10);
        for (let k = 0; k < n; k += 2) {
          const t0 = k / n;
          const t1 = Math.min(1, (k + 1) / n);
          g.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0).lineTo(a.x + (b.x - a.x) * t1, a.y + (b.y - a.y) * t1);
        }
      }
      g.stroke({ width: 1.5, color: COLORS.amber, alpha: 0.7 });
      const c = isoToScreen(p.x + p.w / 2, p.y + p.h / 2);
      const plus = new Text({ text: '+ 새 프로젝트', style: { fontFamily: FONT, fontSize: 13, fill: COLORS.amber, fontWeight: '600' } });
      plus.resolution = 2;
      plus.anchor.set(0.5);
      plus.position.set(c.x, c.y);
      g.eventMode = 'static';
      g.cursor = 'pointer';
      g.on('pointertap', (e: FederatedPointerEvent) => {
        if (this.dragging) return;
        this.consumed = true;
        e.stopPropagation();
        this.walkTo(p.entrance);
        this.cb.onEmptyPlot(p.id);
      });
      holder.addChild(g, plus);
      this.ground.addChild(holder);
      this.emptyPlotNodes.set(p.id, holder);
    }
  }

  private placeSprite(sprite: Sprite, plot: { x: number; y: number; w: number; h: number }, widthFit = 1) {
    const baseW = ((plot.w + plot.h) * TILE_W) / 2;
    const s = (baseW * widthFit) / sprite.texture.width;
    sprite.scale.set(s);
    sprite.anchor.set(0.5, 1);
    const bottom = isoToScreen(plot.x + plot.w, plot.y + plot.h);
    sprite.position.set(bottom.x, bottom.y + TILE_H * 0.45);
    sprite.zIndex = plot.x + plot.w + plot.y + plot.h;
  }

  private drawStatic() {
    for (const s of STATIC_BUILDINGS) {
      const sp = new Sprite(this.tex[s.kind]);
      this.placeSprite(sp, s.plot, s.kind === 'home' ? 0.95 : 1.02);
      sp.eventMode = 'static';
      sp.cursor = 'pointer';
      sp.on('pointertap', (e: FederatedPointerEvent) => {
        if (this.dragging) return;
        this.consumed = true;
        e.stopPropagation();
        this.walkTo(s.plot.entrance);
        this.cb.onSelectStatic(s.id, s.label);
      });
      this.objects.addChild(sp);
      const lbl = this.makeLabel(s.label, false);
      lbl.c.position.set(sp.x, sp.y - sp.height + 6);
      this.labels.addChild(lbl.c);
    }
  }

  private drawProps() {
    for (const p of PROPS) {
      const sp = new Sprite(this.tex[p.kind]);
      sp.anchor.set(0.5, 1);
      const w = p.w ?? 1;
      const h = p.h ?? 1;
      const targetH = p.kind === 'tree' ? 104 : p.kind === 'lamp' ? 84 : p.kind === 'bench' ? 44 : 96;
      sp.scale.set(targetH / sp.texture.height);
      const base = isoToScreen(p.x + w / 2 + 0.25, p.y + h / 2 + 0.25);
      sp.position.set(base.x, base.y + (p.kind === 'planter' ? 14 : 4));
      sp.zIndex = p.x + w + p.y + h - 0.2;
      this.objects.addChild(sp);
    }
  }

  private makeLabel(text: string, strong: boolean, dot?: number) {
    const c = new Container();
    const t = new Text({ text, style: { fontFamily: FONT, fontSize: 12, fill: strong ? 0x1a1206 : COLORS.text, fontWeight: strong ? '700' : '500' } });
    t.resolution = 2;
    const padX = 9;
    const dotW = dot !== undefined ? 12 : 0;
    const w = t.width + padX * 2 + dotW;
    const h = 22;
    const bg = new Graphics();
    const draw = (isStrong: boolean) => {
      bg.clear();
      bg.roundRect(-w / 2, -h, w, h, 5).fill({ color: isStrong ? COLORS.amber : COLORS.panel, alpha: isStrong ? 1 : 0.92 });
      if (!isStrong) bg.roundRect(-w / 2, -h, w, h, 5).stroke({ width: 1, color: COLORS.line });
      if (dot !== undefined) bg.circle(-w / 2 + padX + 3, -h / 2, 3.5).fill({ color: dot });
      t.style.fill = isStrong ? 0x1a1206 : COLORS.text;
      t.style.fontWeight = isStrong ? '700' : '500';
    };
    draw(strong);
    t.position.set(-w / 2 + padX + dotW, -h + (h - t.height) / 2);
    c.addChild(bg, t);
    return { c, t, bg, setStrong: draw };
  }

  // ───────── 프로젝트 건물 ─────────
  private textureFor(vm: BuildingVM): { tex: Texture; needsOverlay: boolean } {
    if (vm.condition !== 'normal' && vm.type === 'workshop') {
      return { tex: this.tex[vm.condition === 'decayed' ? 'workshop-decayed' : 'workshop-repairing'], needsOverlay: false };
    }
    return { tex: this.tex[`${vm.type}-s${vm.stage}`], needsOverlay: vm.condition !== 'normal' };
  }

  setBuildings(vms: BuildingVM[]) {
    if (!this.app.renderer) return;
    setOccupiedPlots(vms.map((v) => v.plotId));
    for (const [id, node] of this.emptyPlotNodes) node.visible = isPlotFree(id);
    for (const vm of vms) {
      const plot = plotById(vm.plotId);
      if (!plot) continue;
      let node = this.buildings.get(vm.projectId);
      const { tex, needsOverlay } = this.textureFor(vm);
      if (!node) {
        const root = new Container();
        root.sortableChildren = false;
        const highlight = new Graphics();
        this.diamond(highlight, plot.x - 0.15, plot.y - 0.15, plot.w + 0.3, plot.h + 0.3)
          .fill({ color: COLORS.amber, alpha: 0.16 })
          .stroke({ width: 2, color: COLORS.amber, alpha: 0.9 });
        highlight.visible = false;
        this.ground.addChild(highlight);
        const sprite = new Sprite(tex);
        sprite.eventMode = 'static';
        sprite.cursor = 'pointer';
        sprite.on('pointertap', (e: FederatedPointerEvent) => {
          if (this.dragging) return;
          this.consumed = true;
          e.stopPropagation();
          this.cb.onSelectProject(vm.projectId);
        });
        const overlay = new Container();
        root.addChild(sprite, overlay);
        this.objects.addChild(root);
        const lbl = this.makeLabel(vm.title, false, parseInt(vm.color.slice(1), 16));
        this.labels.addChild(lbl.c);
        node = { vm, plot, root, sprite, overlay, label: lbl.c, labelText: lbl.t, labelBg: lbl.bg, highlight, pop: 1 };
        (node as BuildingNode & { setStrong?: (s: boolean) => void }).setStrong = lbl.setStrong;
        this.buildings.set(vm.projectId, node);
      }
      const prev = node.vm;
      node.vm = vm;
      if (node.sprite.texture !== tex) {
        node.sprite.texture = tex;
        if (prev.stage !== vm.stage || prev.condition !== vm.condition) node.pop = 0;
      }
      const grew = vm.stage > prev.stage;
      const restored = prev.condition !== 'normal' && vm.condition === 'normal';
      this.placeSprite(node.sprite, plot, 1.02);
      node.root.zIndex = node.sprite.zIndex;
      node.label.position.set(node.sprite.x, node.sprite.y - node.sprite.height + 4);
      this.applyCondition(node, needsOverlay);
      if (grew || restored) this.celebrate(node, grew ? `${['착공', '첫 방', '확장', '랜드마크'][vm.stage]}!` : '불이 다시 켜졌어요', grew ? vm.stage : 1);
    }
  }

  /** 성장·복구 연출: 빛기둥 + 불꽃 입자 + 떠오르는 글자 (기획서 11절) */
  private celebrate(node: BuildingNode, text: string, power: number) {
    if (this.reduced) return;
    const cx = node.sprite.x;
    const top = node.sprite.y - node.sprite.height;
    const g = new Graphics();
    g.zIndex = 9999;
    const parts = Array.from({ length: 26 + power * 14 }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 0.12 + Math.random() * 0.22;
      return { x: cx + (Math.random() - 0.5) * 50, y: top + node.sprite.height * 0.45, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.1, c: [COLORS.amber, 0xffe0a0, COLORS.coral, 0x9cc4ee][Math.floor(Math.random() * 4)], s: 3 + Math.random() * 3 };
    });
    const beam = new Graphics();
    beam.blendMode = 'add';
    beam.zIndex = 9998;
    this.objects.addChild(beam, g);
    const lbl = this.makeLabel(text, true);
    lbl.c.position.set(cx, top - 20);
    this.labels.addChild(lbl.c);
    this.bursts.push({ g, beam, cx, baseY: node.sprite.y, parts, life: 0, text: lbl.c });
  }

  private tickBursts(dt: number) {
    for (const b of this.bursts) {
      b.life += dt;
      const t = b.life / 1800;
      b.g.clear();
      b.beam.clear();
      const beamA = Math.max(0, 1 - t * 1.4);
      if (beamA > 0) {
        // 바닥에서 솟는 빛기둥: 가운데가 밝은 세 겹
        for (const [w, a] of [[70, 0.08], [40, 0.14], [16, 0.22]] as const) {
          b.beam.rect(b.cx - w / 2, b.baseY - 420, w, 420).fill({ color: COLORS.amber, alpha: a * beamA });
        }
        b.beam.ellipse(b.cx, b.baseY - 6, 90 * (0.6 + t), 34 * (0.6 + t)).fill({ color: COLORS.amber, alpha: 0.25 * beamA });
      }
      for (const p of b.parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.00035 * dt;
        b.g.rect(p.x, p.y, p.s, p.s).fill({ color: p.c, alpha: Math.max(0, 1 - t) });
      }
      if (b.text) {
        b.text.y -= dt * 0.02;
        b.text.alpha = Math.max(0, 1 - Math.max(0, t - 0.5) * 2);
      }
    }
    const done = this.bursts.filter((b) => b.life > 1800);
    for (const b of done) {
      b.g.destroy();
      b.beam.destroy();
      b.text?.destroy({ children: true });
    }
    this.bursts = this.bursts.filter((b) => b.life <= 1800);
  }

  focusStatic(kind: 'cafe' | 'home') {
    const s = STATIC_BUILDINGS.find((x) => x.kind === kind);
    if (!s) return;
    this.walkTo(s.plot.entrance);
    const c = isoToScreen(s.plot.x + s.plot.w / 2, s.plot.y + s.plot.h / 2);
    this.focusWorldPoint(c.x, c.y - 50);
  }

  focusPlot(plotId: string) {
    const p = plotById(plotId);
    if (!p) return;
    this.walkTo(p.entrance);
    const c = isoToScreen(p.x + p.w / 2, p.y + p.h / 2);
    this.focusWorldPoint(c.x, c.y - 30);
  }

  private applyCondition(node: BuildingNode, needsOverlay: boolean) {
    node.overlay.removeChildren().forEach((c) => c.destroy());
    const vm = node.vm;
    if (needsOverlay) {
      // 전용 그림이 없는 건물은 ‘불 끄기 + 채도 낮춤 + 비구름’ 오버레이로 낡음을 표현(기획서 11절 상태 레이어)
      const f = new ColorMatrixFilter();
      if (vm.condition === 'decayed') {
        f.desaturate();
        f.brightness(0.55, true);
      } else {
        f.saturate(-0.35, false);
        f.brightness(0.8, true);
      }
      node.sprite.filters = [f];
      if (vm.condition === 'decayed') node.overlay.addChild(this.makeRainCloud(node));
    } else {
      node.sprite.filters = [];
    }
    if (vm.paused) node.sprite.alpha = 0.85;
    else node.sprite.alpha = 1;
  }

  private makeRainCloud(node: BuildingNode) {
    const c = new Container();
    const top = node.sprite.y - node.sprite.height;
    const cx = node.sprite.x + 10;
    const cloud = new Graphics();
    for (const [dx, dy, r] of [[-18, 0, 13], [0, -7, 16], [18, 0, 12], [6, 4, 12]]) cloud.circle(cx + dx, top - 8 + dy, r).fill({ color: 0x5b6273 });
    const drops = new Graphics();
    c.addChild(drops, cloud);
    (c as Container & { tick?: (t: number) => void }).tick = (t: number) => {
      drops.clear();
      for (let i = 0; i < 9; i++) {
        const x = cx - 22 + i * 5.5;
        const phase = ((t / 600 + i * 0.37) % 1) * 34;
        drops.moveTo(x, top + 4 + phase).lineTo(x - 1.5, top + 10 + phase).stroke({ width: 1.2, color: 0x9cc4ee, alpha: 0.6 });
      }
    };
    return c;
  }

  setSelected(projectId: string | null) {
    this.selectedId = projectId;
    for (const [id, node] of this.buildings) {
      const on = id === projectId;
      node.highlight.visible = on;
      (node as BuildingNode & { setStrong?: (s: boolean) => void }).setStrong?.(on);
    }
    if (projectId) {
      const node = this.buildings.get(projectId);
      if (node) {
        this.walkTo(node.plot.entrance);
        const center = isoToScreen(node.plot.x + node.plot.w / 2, node.plot.y + node.plot.h / 2);
        this.focusWorldPoint(center.x, center.y - 60);
      }
    }
  }

  setFriends(friends: FriendVM[]) {
    this.friendNodes.forEach((n) => n.destroy({ children: true }));
    this.friendNodes = [];
    this.walkers = [];
    friends.forEach((f, i) => {
      const plot = f.projectPlotId ? plotById(f.projectPlotId) : undefined;
      const cell = plot ? { x: plot.entrance.x, y: plot.entrance.y + 1 } : { x: 12 + i, y: 15 };
      const p = cellCenter(cell.x, cell.y);
      const c = new Container();
      const sh = new Graphics().ellipse(0, 0, 12, 5).fill({ color: 0x000000, alpha: 0.35 });
      const sp = new Sprite(this.tex['char-back-left']);
      sp.anchor.set(0.5, 0.96);
      sp.scale.set(46 / sp.texture.height);
      sp.tint = i % 2 ? 0xc8dcff : 0xffd9c8;
      c.addChild(sh, sp);
      c.position.set(p.x, p.y);
      c.zIndex = cell.x + cell.y + 1.5;
      c.eventMode = 'static';
      c.cursor = 'pointer';
      c.hitArea = new Rectangle(-16, -50, 32, 56);
      c.on('pointertap', (e: FederatedPointerEvent) => {
        if (this.dragging) return;
        this.consumed = true;
        e.stopPropagation();
        this.cb.onSelectFriend(f.id);
      });
      this.objects.addChild(c);
      const lbl = this.makeLabel(`${f.name} · ${f.status === 'focus' ? '집중 중' : '산책 중'}`, false, f.status === 'focus' ? COLORS.coral : 0x6cc3a0);
      lbl.c.position.set(p.x, p.y - 52);
      lbl.c.eventMode = 'static';
      lbl.c.cursor = 'pointer';
      lbl.c.on('pointertap', (e: FederatedPointerEvent) => {
        this.consumed = true;
        e.stopPropagation();
        this.cb.onSelectFriend(f.id);
      });
      this.labels.addChild(lbl.c);
      this.friendNodes.push(c, lbl.c);
      // 접속 중(집중 아님)인 친구는 광장·카페 사이를 천천히 돌아다닌다
      if (f.status === 'online') this.walkers.push({ node: c, sprite: sp, label: lbl.c, cell, pos: { ...p }, path: [], facing: 'back-left', wait: 1500 + i * 700 });
    });
  }

  private static WANDER: Cell[] = [
    { x: 10, y: 9 }, { x: 13, y: 9 }, { x: 15, y: 12 }, { x: 13, y: 14 }, { x: 10, y: 13 }, { x: 9, y: 11 }, { x: 14, y: 17 }, { x: 8, y: 7 },
  ];

  private tickWalkers(dt: number) {
    for (const w of this.walkers) {
      if (!w.path.length) {
        w.wait -= dt;
        if (w.wait > 0) continue;
        const goal = TownRenderer.WANDER[Math.floor(Math.random() * TownRenderer.WANDER.length)];
        const path = findPath(w.cell, goal, isWalkable, MAP_W, MAP_H);
        if (path) w.path = path.slice(1);
        w.wait = 2500 + Math.random() * 4000; // 도착하면 잠시 머문다(커피·구경)
        continue;
      }
      const next = w.path[0];
      const target = cellCenter(next.x, next.y);
      const dx = target.x - w.pos.x;
      const dy = target.y - w.pos.y;
      const dist = Math.hypot(dx, dy);
      const speed = 0.06 * dt;
      const f = facingFor(next.x - w.cell.x, next.y - w.cell.y, w.facing);
      if (f !== w.facing) {
        w.facing = f;
        w.sprite.texture = this.tex[`char-${f}`];
      }
      if (dist <= speed) {
        w.pos = target;
        w.cell = next;
        w.path.shift();
      } else {
        w.pos = { x: w.pos.x + (dx / dist) * speed, y: w.pos.y + (dy / dist) * speed };
      }
      const bob = this.reduced ? 0 : Math.abs(Math.sin(this.time / 140)) * 2;
      w.node.position.set(w.pos.x, w.pos.y);
      w.sprite.y = -bob;
      w.node.zIndex = w.cell.x + w.cell.y + 1.5;
      w.label.position.set(w.pos.x, w.pos.y - 52);
    }
  }

  setPanelOffset(px: number) {
    this.panelOffset = px;
  }

  // ───────── 캐릭터 ─────────
  private createCharacter() {
    this.charShadow = new Graphics().ellipse(0, 0, 13, 5.5).fill({ color: 0x000000, alpha: 0.4 });
    this.character = new Sprite(this.tex[`char-${this.facing}`]);
    this.character.anchor.set(0.5, 0.96);
    this.character.scale.set(50 / this.character.texture.height);
    this.objects.addChild(this.charShadow, this.character);
    this.syncCharacter(0);
  }

  walkTo(target: Cell) {
    let goal = target;
    if (!isWalkable(goal.x, goal.y)) {
      const n = nearestWalkable(goal, isWalkable, MAP_W, MAP_H);
      if (!n) return;
      goal = n;
    }
    const path = findPath(this.charCell, goal, isWalkable, MAP_W, MAP_H);
    if (!path) return;
    this.path = path.slice(1);
    this.marker.clear();
    this.diamond(this.marker, goal.x + 0.15, goal.y + 0.15, 0.7, 0.7).stroke({ width: 2, color: COLORS.amber, alpha: 0.9 });
    this.marker.visible = true;
  }

  private syncCharacter(bob: number) {
    this.character.position.set(this.charPos.x, this.charPos.y - bob);
    this.charShadow.position.set(this.charPos.x, this.charPos.y);
    // 깊이: 기본은 위치 합, 건물 앞/뒤 영역이면 그 건물 기준으로 보정
    const a = screenToCell(this.charPos.x, this.charPos.y);
    let z = a.x + a.y + 1.6;
    for (const node of this.buildings.values()) {
      const p = node.plot;
      const bz = node.root.zIndex;
      const behind = a.x < p.x + p.w && a.y < p.y + p.h;
      if (behind) z = Math.min(z, bz - 0.5);
      else if (a.x >= p.x - 1 && a.y >= p.y - 1) z = Math.max(z, bz + 0.5);
    }
    this.character.zIndex = z;
    this.charShadow.zIndex = z - 0.01;
  }

  // ───────── 카메라·입력 ─────────
  private fitInitial() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    // 섬 전체(건물 높이 포함) 경계: x ∈ [−MAP_H·32, MAP_W·32], y ∈ [−180, (MAP_W+MAP_H)·16 + 측면]
    const contentW = ((MAP_W + MAP_H) * TILE_W) / 2;
    const top = -180;
    const bottom = ((MAP_W + MAP_H) * TILE_H) / 2 + 24;
    const narrow = w < 700;
    const scale = narrow
      ? Math.max(0.36, Math.min(0.6, w / 900))
      : Math.max(0.45, Math.min(1.2, (w / contentW) * 0.96, (h / (bottom - top)) * 0.96));
    const cx = 0;
    const cy = narrow ? isoToScreen(11, 10).y : (top + bottom) / 2;
    this.world.scale.set(scale);
    this.world.position.set(w / 2 - cx * scale, (narrow ? h * 0.42 : h / 2) - cy * scale);
  }

  private focusWorldPoint(wx: number, wy: number) {
    const s = this.world.scale.x;
    const visibleW = this.app.screen.width - this.panelOffset;
    const isSheet = this.app.screen.width < 1024;
    const vy = isSheet ? this.app.screen.height * 0.3 : this.app.screen.height / 2;
    const target = { x: visibleW / 2 - wx * s, y: vy - wy * s, scale: s };
    if (this.reduced) {
      this.world.position.set(target.x, target.y);
      this.camTarget = null;
    } else this.camTarget = target;
  }

  zoomBy(factor: number) {
    this.zoomAt(this.app.screen.width / 2, this.app.screen.height / 2, factor);
  }

  private zoomAt(sx: number, sy: number, factor: number) {
    const old = this.world.scale.x;
    const next = Math.max(0.5, Math.min(1.8, old * factor));
    const wx = (sx - this.world.x) / old;
    const wy = (sy - this.world.y) / old;
    this.world.scale.set(next);
    this.world.position.set(sx - wx * next, sy - wy * next);
    this.camTarget = null;
  }

  private setupInput() {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = new Rectangle(-1e5, -1e5, 2e5, 2e5);
    stage.on('pointerdown', (e: FederatedPointerEvent) => {
      this.down = { x: e.global.x, y: e.global.y, wx: this.world.x, wy: this.world.y };
      this.dragging = false;
      this.consumed = false;
    });
    stage.on('globalpointermove', (e: FederatedPointerEvent) => {
      if (!this.down) return;
      const dx = e.global.x - this.down.x;
      const dy = e.global.y - this.down.y;
      if (!this.dragging && Math.hypot(dx, dy) > 6) this.dragging = true;
      if (this.dragging) {
        this.world.position.set(this.down.wx + dx, this.down.wy + dy);
        this.camTarget = null;
      }
    });
    const up = (e: FederatedPointerEvent) => {
      if (!this.down) return;
      const wasDrag = this.dragging;
      this.down = null;
      setTimeout(() => (this.dragging = false), 0);
      if (wasDrag || this.consumed) return;
      const local = this.world.toLocal(e.global);
      const cell = screenToCell(local.x, local.y);
      if (cell.x < 0 || cell.y < 0 || cell.x >= MAP_W || cell.y >= MAP_H) {
        this.cb.onBackgroundTap();
        return;
      }
      this.walkTo(cell);
    };
    stage.on('pointerup', up);
    stage.on('pointerupoutside', up);
    this.el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  // ───────── 프레임 ─────────
  private tick(dt: number) {
    this.time += dt;
    // 이동
    let moving = false;
    if (this.path.length) {
      moving = true;
      const next = this.path[0];
      const target = cellCenter(next.x, next.y);
      const dx = target.x - this.charPos.x;
      const dy = target.y - this.charPos.y;
      const dist = Math.hypot(dx, dy);
      const speed = 0.14 * dt; // px/ms
      const gdx = next.x - this.charCell.x;
      const gdy = next.y - this.charCell.y;
      const f = facingFor(gdx, gdy, this.facing);
      if (f !== this.facing) {
        this.facing = f;
        this.character.texture = this.tex[`char-${f}`];
      }
      if (dist <= speed) {
        this.charPos = target;
        this.charCell = next;
        this.path.shift();
        if (!this.path.length) this.marker.visible = false;
      } else {
        this.charPos = { x: this.charPos.x + (dx / dist) * speed, y: this.charPos.y + (dy / dist) * speed };
      }
    }
    const bob = this.reduced ? 0 : moving ? Math.abs(Math.sin(this.time / 110)) * 3 : Math.sin(this.time / 700) * 0.6;
    this.syncCharacter(bob);

    if (!this.reduced) this.tickWalkers(dt);
    this.tickBursts(dt);

    // 이름표는 확대·축소와 관계없이 읽을 수 있는 크기로 유지
    const k = Math.min(2.2, Math.max(0.85, 0.95 / this.world.scale.x));
    for (const c of this.labels.children) c.scale.set(k);

    // 카메라
    if (this.camTarget) {
      const k = 1 - Math.pow(0.001, dt / 600);
      this.world.x += (this.camTarget.x - this.world.x) * k;
      this.world.y += (this.camTarget.y - this.world.y) * k;
      if (Math.abs(this.camTarget.x - this.world.x) < 0.5 && Math.abs(this.camTarget.y - this.world.y) < 0.5) this.camTarget = null;
    }

    // 성장·상태 변화 연출, 오버레이
    for (const node of this.buildings.values()) {
      if (node.pop < 1) {
        node.pop = this.reduced ? 1 : Math.min(1, node.pop + dt / 700);
        const e = 1 - Math.pow(1 - node.pop, 3);
        const full = node.vm.paused ? 0.85 : 1;
        node.sprite.alpha = node.pop >= 1 ? full : 0.3 + (full - 0.3) * e;
        // 바닥 기준으로 살짝 늘었다 줄어드는 성장 연출
        const squash = node.pop >= 1 ? 1 : 1 + Math.sin(e * Math.PI) * 0.06;
        node.root.pivot.set(node.sprite.x, node.sprite.y);
        node.root.position.set(node.sprite.x, node.sprite.y);
        node.root.scale.set(squash, 2 - squash);
      }
      if (node.highlight.visible && !this.reduced) node.highlight.alpha = 0.75 + Math.sin(this.time / 380) * 0.25;
      for (const c of node.overlay.children) (c as Container & { tick?: (t: number) => void }).tick?.(this.reduced ? 0 : this.time);
    }
  }
}
