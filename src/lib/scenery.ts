/**
 * Pastel top-down scenery of the racing zone (spec-v2 §3). Everything here is pure geometry:
 * the same seed and the same page width give the same map. Pieces are placed by seeded
 * Poisson-disc sampling (dart throwing per 400 px band, so a block that grows only reshuffles
 * the bands it touches), away from the content blocks, the road and the water.
 *
 * To get a different map, change SCENERY_SEED. To change what grows where, edit `ZONES`.
 */
import type { BlockRect, Track } from './track';

export const SCENERY_SEED = 20261118;
/** Whole map SVG must stay under 650 elements (spec-v2 §9): this caps the placed pieces. */
export const MAX_PIECES = 400;
const BAND = 400;
const NAV_H = 64;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PieceId =
  | 'palm'
  | 'palm2'
  | 'tree'
  | 'tree2'
  | 'pine'
  | 'dense'
  | 'bush'
  | 'house'
  | 'house-v'
  | 'church'
  | 'fence'
  | 'rock'
  | 'rock2'
  | 'umbrella'
  | 'umbrella2'
  | 'boat'
  | 'flowers';

export interface Piece {
  id: PieceId;
  x: number;
  y: number;
  /** Scale. */
  s: number;
  /** Rotation in degrees (only pieces without a baked shadow rotate). */
  r: number;
  /** Belongs to the last stretch, which breaks up after the finish. */
  tail: boolean;
}

export interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface Scenery {
  sand: string;
  seaTop: string;
  seaDeep: string;
  foam: string;
  cove: string | null;
  coveFoam: string | null;
  patches: (Ellipse & { tail: boolean })[];
  cliff: string | null;
  plaza: Ellipse | null;
  river: { d: string; width: number } | null;
  bridge: { x: number; y: number; angle: number; w: number; h: number } | null;
  stand: { x: number; y: number; w: number; h: number };
  stars: { x: number; y: number; r: number; o: number }[];
  pieces: Piece[];
}

export interface SceneryInput {
  width: number;
  /** Height of the map (the road ends a little above it). */
  height: number;
  /** Where the last stretch (the part that breaks up) starts. */
  breakY: number;
  blocks: BlockRect[];
  track: Track;
  contentLeft: number;
}

type Mix = [PieceId, number][];

/** Zones from the top of the map down, as fractions of its height (spec-v2 §3.3). */
const ZONES: { until: number; pieces: Mix; keep: number }[] = [
  { until: 0.22, keep: 0.9, pieces: [['palm', 22], ['palm2', 14], ['tree', 26], ['bush', 22], ['rock', 16]] },
  { until: 0.42, keep: 1, pieces: [['tree', 30], ['tree2', 18], ['rock', 12], ['rock2', 10], ['bush', 18], ['pine', 8], ['flowers', 4]] },
  { until: 0.66, keep: 1, pieces: [['house', 20], ['house-v', 14], ['tree', 16], ['tree2', 8], ['fence', 12], ['flowers', 14], ['bush', 12], ['rock', 4]] },
  { until: 0.9, keep: 1, pieces: [['dense', 38], ['pine', 34], ['tree2', 14], ['bush', 9], ['rock2', 5]] },
  { until: 2, keep: 0.6, pieces: [['bush', 40], ['tree2', 30], ['pine', 30]] }
];
const SAND_PIECES: Mix = [['palm', 30], ['palm2', 18], ['umbrella', 16], ['umbrella2', 14], ['rock', 8], ['bush', 14]];
const VILLAGE_RING: Mix = [['house', 44], ['house-v', 34], ['fence', 12], ['flowers', 10]];

function pick(list: Mix, u: number): PieceId {
  const total = list.reduce((sum, item) => sum + item[1], 0);
  let acc = u * total;
  for (const [id, weight] of list) {
    acc -= weight;
    if (acc <= 0) return id;
  }
  return list[list.length - 1][0];
}

const fmt = (value: number) => value.toFixed(1);
const smooth = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

export function buildScenery(input: SceneryInput): Scenery {
  const { width: W, height: H, breakY, blocks, track, contentLeft } = input;
  const desktop = W >= 1100;
  const hero = blocks[0];
  const wr = Math.round(W / 50) * 50;
  const rng = mulberry32(SCENERY_SEED ^ Math.imul(wr, 0x85ebca6b));
  const roadW = track.roadW;
  const bandEnd = breakY + 220;

  const inBlock = (x: number, y: number, pad: number) =>
    blocks.some(b => x > b.left - pad && x < b.right + pad && y > b.top - pad && y < b.bottom + pad);

  /* ---------- shore: sand, sea along the top, a cove on the left edge ---------- */
  const sandR = desktop ? Math.max(hero.right + 90, W * 0.6) : W * 1.5;
  const sandB = Math.min(hero.bottom + 40, H * 0.3);
  const p1 = rng() * 6.28;
  const p2 = rng() * 6.28;
  const sandRadius = (theta: number) => {
    const c = Math.abs(Math.cos(theta)) / sandR;
    const s = Math.abs(Math.sin(theta)) / sandB;
    const base = 1 / Math.cbrt(c * c * c + s * s * s);
    return base * (1 + 0.035 * Math.sin(theta * 9 + p1) + 0.025 * Math.sin(theta * 17 + p2));
  };
  const inSand = (x: number, y: number) => Math.hypot(x, y) < sandRadius(Math.atan2(y, x));
  let sand = 'M0 0';
  for (let i = 0; i <= 40; i += 1) {
    const theta = (i / 40) * (Math.PI / 2);
    const r = sandRadius(theta);
    sand += `L${fmt(Math.cos(theta) * r)} ${fmt(Math.sin(theta) * r)}`;
  }
  sand += 'Z';

  const seaR = desktop ? sandR * 0.9 : W * 0.72;
  const seaMax = Math.max(48, hero.top - 26);
  const seaDepth = (x: number) => {
    if (x >= seaR) return 0;
    const wave = NAV_H + 40 + 26 * Math.sin(x / 97 + p1) + 12 * Math.sin(x / 41 + p2);
    return Math.min(seaMax, wave) * smooth((seaR - x) / (seaR * 0.34));
  };
  const inSea = (x: number, y: number, pad = 0) => x < seaR + pad && y < seaDepth(x) + pad;
  let seaTop = `M0 0L${fmt(seaR)} 0`;
  let seaDeep = `M0 0L${fmt(seaR * 0.86)} 0`;
  let foam = '';
  for (let x = seaR; x >= -24; x -= 24) {
    const depth = seaDepth(Math.max(0, x));
    seaTop += `L${fmt(x)} ${fmt(depth)}`;
    foam += `${foam ? 'L' : 'M'}${fmt(x)} ${fmt(depth)}`;
    if (x <= seaR * 0.86) seaDeep += `L${fmt(x)} ${fmt(Math.max(0, depth * 0.58 - 8))}`;
  }
  seaTop += 'Z';
  seaDeep += 'Z';

  let cove: string | null = null;
  let coveFoam: string | null = null;
  const coveW = Math.min(contentLeft - 16, W * 0.09);
  const coveTop = hero.top + (hero.bottom - hero.top) * 0.5;
  const coveBottom = hero.bottom + 60;
  const coveX = (y: number) => {
    const t = (y - coveTop) / (coveBottom - coveTop);
    return t <= 0 || t >= 1 ? 0 : coveW * Math.pow(Math.sin(Math.PI * t), 0.6) * (1 + 0.08 * Math.sin(t * 19 + p2));
  };
  const coveOk =
    coveW >= 44 && [0.2, 0.4, 0.6, 0.8].every(t => track.distance(coveW, coveTop + (coveBottom - coveTop) * t) > roadW / 2 + 24);
  const inCove = (x: number, y: number, pad = 0) => coveOk && y > coveTop - pad && y < coveBottom + pad && x < coveX(y) + pad;
  if (coveOk) {
    let edge = '';
    for (let i = 0; i <= 24; i += 1) {
      const y = coveTop + ((coveBottom - coveTop) * i) / 24;
      edge += `${i ? 'L' : 'M'}${fmt(coveX(y))} ${fmt(y)}`;
    }
    coveFoam = edge;
    cove = `${edge}Z`;
  }

  /* ---------- grass patches ---------- */
  const patches: Scenery['patches'] = [];
  const patchCount = Math.min(14, Math.round((W * H) / 420000));
  const patchScale = Math.max(0.45, Math.min(1, W / 1440));
  for (let i = 0; i < patchCount; i += 1) {
    const rx = (140 + rng() * 160) * patchScale;
    const ry = rx * (0.45 + rng() * 0.25);
    const cx = rng() * W;
    const cy = rng() * (H - 160);
    // Not across the seam between the map and its last stretch.
    if (cy + ry > breakY && cy - ry < bandEnd) continue;
    patches.push({ cx, cy, rx, ry, tail: cy > breakY });
  }

  /* ---------- cliff edge ---------- */
  let cliff: string | null = null;
  const cliffY = H * 0.4;
  const c1 = rng() * 6.28;
  const cliffWave = (x: number) => cliffY + 18 * Math.sin(x / 140 + c1) + 8 * Math.sin(x / 53 + p1);
  if (cliffY < breakY - 80) {
    cliff = '';
    for (let x = -20; x <= W + 20; x += 40) cliff += `${cliff ? 'L' : 'M'}${fmt(x)} ${fmt(cliffWave(x))}`;
  }
  const cliffDist = (x: number, y: number) => (cliff ? Math.abs(y - cliffWave(x)) : Infinity);

  /* ---------- village square with the church ---------- */
  let plaza: Ellipse | null = null;
  for (let i = 0; i < 80 && !plaza; i += 1) {
    const x = 110 + rng() * Math.max(1, W - 220);
    const y = H * (0.45 + rng() * 0.18);
    if (W < 420 || y > breakY - 150) continue;
    if (inBlock(x, y, 112) || track.distance(x, y) < roadW / 2 + 108) continue;
    plaza = { cx: x, cy: y, rx: 104, ry: 76 };
  }

  /* ---------- stream that crosses the page under a wooden bridge ---------- */
  let river: Scenery['river'] = null;
  let bridge: Scenery['bridge'] = null;
  const riverW = W >= 768 ? 34 : 22;
  const riverLo = H * 0.66;
  const riverHi = Math.min(H * 0.9, breakY - 70);
  let riverY = 0;
  let riverX = 0;
  let riverShift = 0;
  const r1 = rng() * 6.28;
  const r2 = rng() * 6.28;
  const riverWave = (x: number) => 14 * Math.sin(x / 170 + r1) + 7 * Math.sin(x / 67 + r2);
  {
    let lowest = Infinity;
    let crossAngle = 0;
    for (let y = riverLo; y <= riverHi; y += 12) {
      const point = track.at(track.lenAtY(y));
      const lean = Math.abs(Math.cos((point.angle * Math.PI) / 180));
      const cost = lean + Math.abs(y / H - 0.78) * 1.5 + (inBlock(point.x, y, 10) ? 1 : 0);
      if (lean < 0.55 && cost < lowest) {
        lowest = cost;
        riverY = y;
        riverX = point.x;
        crossAngle = point.angle;
      }
    }
    if (lowest < Infinity) {
      riverShift = riverWave(riverX);
      let d = '';
      for (let x = -30; x <= W + 30; x += 30) d += `${d ? 'L' : 'M'}${fmt(x)} ${fmt(riverY + riverWave(x) - riverShift)}`;
      river = { d, width: riverW };
      bridge = { x: riverX, y: riverY, angle: crossAngle - 90, w: roadW + 26, h: riverW + 26 };
    }
  }
  const riverDist = (x: number, y: number) => (river ? Math.abs(y - (riverY + riverWave(x) - riverShift)) : Infinity);

  /* ---------- grandstand by the finish line ---------- */
  const standH = W >= 768 ? 130 : 84;
  const standW = W >= 768 ? 30 : 18;
  const stand = { x: W / 2 + roadW / 2 + (W >= 768 ? 24 : 10), y: track.finishY - standH - 22, w: standW, h: standH };

  /* ---------- first stars, in the last 400 px before the finish ---------- */
  const stars: Scenery['stars'] = [];
  for (let i = 0; i < 26; i += 1) {
    const up = rng() * 400;
    stars.push({ x: rng() * W, y: track.finishY - up, r: 0.8 + rng() * 0.9, o: 0.2 + 0.7 * (1 - up / 400) });
  }

  /* ---------- pieces: seeded Poisson-disc sampling ---------- */
  const radius = W >= 1100 ? 79 : W >= 768 ? 86 : 125;
  const cell = radius;
  const grid = new Map<string, Piece[]>();
  const pieces: Piece[] = [];
  let boats = 0;
  const limitY = track.endY - 150;

  const tooClose = (x: number, y: number) => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    for (let ix = gx - 1; ix <= gx + 1; ix += 1) {
      for (let iy = gy - 1; iy <= gy + 1; iy += 1) {
        const bucket = grid.get(`${ix}|${iy}`);
        if (bucket?.some(p => (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y) < radius * radius)) return true;
      }
    }
    return false;
  };
  const add = (piece: Piece) => {
    pieces.push(piece);
    const key = `${Math.floor(piece.x / cell)}|${Math.floor(piece.y / cell)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(piece);
    else grid.set(key, [piece]);
  };

  if (plaza) add({ id: 'church', x: plaza.cx, y: plaza.cy - 6, s: 1, r: 0, tail: false });

  const bands = Math.ceil(limitY / BAND);
  for (let band = 0; band < bands; band += 1) {
    const bandRng = mulberry32(SCENERY_SEED ^ Math.imul(band + 1, 0x9e3779b1) ^ Math.imul(wr, 0x85ebca6b));
    const attempts = Math.ceil(((W * BAND) / (radius * radius)) * 6);
    for (let i = 0; i < attempts; i += 1) {
      // Always draw the same count of numbers per attempt, so the stream stays aligned.
      const x = bandRng() * W;
      const y = band * BAND + bandRng() * BAND;
      const u = bandRng();
      const v = bandRng();
      const w = bandRng();
      if (y > limitY || tooClose(x, y)) continue;
      if (inBlock(x, y, 24) || (hero && x > hero.left - 40 && x < hero.right + 40 && y > hero.top - 40 && y < hero.bottom + 40)) continue;
      if (track.distance(x, y) < roadW / 2 + 14 + 14) continue;
      if (riverDist(x, y) < riverW / 2 + 22 || cliffDist(x, y) < 22) continue;
      if (x > stand.x - 26 && x < stand.x + stand.w + 26 && y > stand.y - 26 && y < stand.y + stand.h + 26) continue;
      if (inCove(x, y, 14)) continue;

      let id: PieceId;
      let rotation = 0;
      if (inSea(x, y, 16)) {
        if (boats >= 2 || y < NAV_H + 16 || !inSea(x, y + 20, 0) || u > 0.6) continue;
        id = 'boat';
        boats += 1;
        rotation = -35 + v * 70;
      } else if (inSand(x, y)) {
        id = pick(SAND_PIECES, u);
      } else {
        const f = y / H;
        const zone = ZONES.find(z => f < z.until) ?? ZONES[ZONES.length - 1];
        if (w > zone.keep) continue;
        id = pick(zone.pieces, u);
        if (plaza) {
          const d = Math.hypot((x - plaza.cx) / plaza.rx, (y - plaza.cy) / plaza.ry);
          if (d < 0.75) continue;
          if (d < 2.1) id = pick(VILLAGE_RING, u);
        }
      }
      if (id === 'fence') rotation = v < 0.5 ? 0 : 90;
      if (id === 'flowers') rotation = Math.round(v * 3) * 30;
      add({ id, x, y, s: id === 'boat' ? 1 : 0.84 + v * 0.4, r: rotation, tail: y > breakY + 140 });
    }
  }

  // Over the budget (very wide screens): thin evenly, so no part of the map ends up bare.
  let kept = pieces;
  if (pieces.length > MAX_PIECES) {
    const ratio = MAX_PIECES / pieces.length;
    kept = pieces.filter((piece, index) => piece.id === 'church' || Math.floor(index * ratio) !== Math.floor((index - 1) * ratio));
  }

  // Painter's order: pieces lower on the page cover the shadows of the ones above.
  kept.sort((a, b) => a.y - b.y);

  return { sand, seaTop, seaDeep, foam, cove, coveFoam, patches, cliff, plaza, river, bridge, stand, stars, pieces: kept };
}

/* ---------- pieces of road and scenery that break off after the finish ---------- */
export type ChunkKind = 'asphalt' | 'kerb-red' | 'kerb-white' | 'leaf' | 'roof';

export interface Chunk {
  kind: ChunkKind;
  x: number;
  y: number;
  dx: number;
  dy: number;
  rot: number;
  size: number;
  delay: number;
  /** Opacity of the star it ends as. */
  glow: number;
  cool: boolean;
}

export function buildChunks(track: Track, breakLen: number, pieces: Piece[], width: number): Chunk[] {
  const rng = mulberry32(SCENERY_SEED ^ 0x51ed270b ^ Math.round(width / 50));
  const chunks: Chunk[] = [];
  const spread = Math.min(520, width * 0.7);
  const make = (kind: ChunkKind, x: number, y: number, size: number): Chunk => ({
    kind,
    x,
    y,
    dx: (rng() - 0.5) * spread,
    dy: 120 + rng() * 520,
    rot: (rng() - 0.5) * 540,
    size,
    delay: rng() * 0.4,
    glow: 0.35 + rng() * 0.6,
    cool: rng() < 0.4
  });
  const span = Math.max(1, track.length - breakLen);
  const step = Math.max(10, span / 66);
  let flip = false;
  for (let s = breakLen; s < track.length; s += step) {
    const p = track.at(s);
    const side = flip ? 1 : -1;
    chunks.push(make('asphalt', p.x + (rng() - 0.5) * track.roadW * 0.8, p.y, 5 + rng() * 8));
    chunks.push(make(flip ? 'kerb-red' : 'kerb-white', p.x + side * (track.roadW / 2 + 2), p.y, 4 + rng() * 5));
    flip = !flip;
  }
  pieces
    .filter(piece => piece.tail)
    .slice(0, 70)
    .forEach(piece => {
      const roof = piece.id === 'house' || piece.id === 'house-v' || piece.id === 'church';
      chunks.push(make(roof ? 'roof' : 'leaf', piece.x, piece.y, 5 + rng() * 7));
    });
  // Keep the count inside the 150–260 budget.
  while (chunks.length < 150) {
    const p = track.at(breakLen + rng() * span);
    chunks.push(make('leaf', p.x + (rng() - 0.5) * Math.min(width, 700), p.y, 4 + rng() * 6));
  }
  return chunks.slice(0, 260);
}
