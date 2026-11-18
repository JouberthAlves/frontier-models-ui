/**
 * Pastel top-down scenery of the racing zone (spec-v2 §3). Everything here is pure geometry:
 * the same seed and the same page width give the same map.
 *
 * The map is built in layers:
 *  1. terrain: sand and sea on the shore, soft grass blobs, the cliff step, the stream;
 *  2. the village: a sand plaza with the church, streets, rows of houses, fences along the plots;
 *  3. pieces: groves, woods and palm clusters first (composite symbols: one element draws 3 to 7
 *     trees), then single pieces in the room that is left. Both by seeded dart throwing per
 *     400 px band (a block that grows only reshuffles the bands it touches), away from the
 *     content blocks, the hero text, the road and the water.
 *
 * To get a different map, change SCENERY_SEED. To change what grows where, edit `ZONES`.
 */
import { FOOT, type PieceId } from './sceneryKit';
import type { BlockRect, Track } from './track';

export type { PieceId } from './sceneryKit';

export const SCENERY_SEED = 20261118;
/** Whole map SVG must stay under 650 elements (spec-v2 §9): this caps the placed pieces. */
export const MAX_PIECES = 320;
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

export interface Piece {
  id: PieceId;
  x: number;
  y: number;
  /** Scale. */
  s: number;
  /** Rotation in degrees (only pieces without a baked shadow rotate). */
  r: number;
  /** Footprint radius on the map (already scaled). */
  rad: number;
  /** Belongs to the last stretch, which breaks up after the finish. */
  tail: boolean;
  /** Part of the village: never thinned out. */
  fixed?: boolean;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Scenery {
  sand: string;
  /** Sea, from the shore inwards: wet sand line, shallow water, sea, deep sea, two foam lines. */
  wetSand: string;
  shallow: string;
  sea: string;
  seaDeep: string;
  foam: string;
  foamInner: string;
  cove: string | null;
  coveFoam: string | null;
  patches: { d: string; tail: boolean }[];
  /** Cliff step: the face (filled), its top lip, and where the shadow falls. */
  cliff: { face: string; lip: string } | null;
  village: { plaza: Rect; radius: number; streets: string; streetWidth: number; fence: string } | null;
  river: { d: string; width: number } | null;
  bridge: { x: number; y: number; angle: number; w: number; len: number } | null;
  stand: { x: number; y: number; w: number; h: number };
  stars: { d: string; o: number }[];
  pieces: Piece[];
}

export interface SceneryInput {
  width: number;
  /** Height of the map (the road ends a little above it). */
  height: number;
  /** Where the last stretch (the part that breaks up) starts. */
  breakY: number;
  blocks: BlockRect[];
  /** Rectangles of the hero text and buttons: kept clear so the title reads. */
  calm: Rect[];
  track: Track;
  contentLeft: number;
}

type Mix = [PieceId, number][];

interface Zone {
  /** The zone ends at this fraction of the map height. */
  until: number;
  /** Groves and woods (composite symbols), placed first. */
  big: Mix;
  /** px between two tries of a big piece: smaller = more of them. */
  bigGap: number;
  /** Single pieces, in the room that is left. */
  small: Mix;
  smallGap: number;
  /** Below 1, canopies overlap (1 = footprints just touch). */
  pack: number;
}

/** Zones from the top of the map down, as fractions of its height (spec-v2 §3.3). */
const ZONES: Zone[] = [
  // Shore (the grass beside the beach)
  {
    until: 0.22,
    big: [['grove-b', 30], ['grove-c', 18], ['palms-a', 20], ['grove-a', 32]],
    bigGap: 58,
    small: [['tree', 26], ['tree2', 20], ['palm', 16], ['bush', 18], ['rock', 10], ['flowers', 8]],
    smallGap: 96,
    pack: 0.96
  },
  // Cliff and fields
  {
    until: 0.42,
    big: [['grove-a', 46], ['grove-b', 30], ['grove-c', 16], ['woods-c', 8]],
    bigGap: 54,
    small: [['tree', 30], ['tree2', 24], ['bush', 16], ['rock', 8], ['rock2', 8], ['flowers', 8], ['pine', 6]],
    smallGap: 96,
    pack: 0.94
  },
  // Around the village
  {
    until: 0.66,
    big: [['grove-a', 40], ['grove-b', 32], ['grove-c', 20], ['woods-c', 8]],
    bigGap: 56,
    small: [['tree', 28], ['tree2', 22], ['bush', 16], ['flowers', 16], ['house', 6], ['house-sq', 4], ['rock', 5], ['pine', 3]],
    smallGap: 96,
    pack: 0.94
  },
  // Woods: almost fully covered by canopy
  {
    until: 0.9,
    big: [['woods-a', 58], ['woods-b', 32], ['woods-c', 10]],
    bigGap: 30,
    small: [['dense', 44], ['pine', 36], ['tree2', 14], ['bush', 6]],
    smallGap: 44,
    pack: 0.62
  },
  // Finish
  {
    until: 2,
    big: [['woods-c', 50], ['grove-c', 50]],
    bigGap: 110,
    small: [['bush', 40], ['pine', 30], ['tree2', 30]],
    smallGap: 104,
    pack: 1.1
  }
];
/** On the beach: palms in clusters, parasols, a few rocks. */
const SAND: Zone = {
  until: 0,
  big: [['palms-a', 52], ['palms-b', 48]],
  bigGap: 96,
  small: [['palm', 26], ['palm2', 20], ['umbrella', 16], ['umbrella2', 14], ['rock', 10], ['bush', 14]],
  smallGap: 100,
  pack: 1.12
};

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
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
const circlePath = (cx: number, cy: number, r: number) =>
  `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r * 2)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r * 2)} 0Z`;
const polyline = (points: number[]) => {
  let d = '';
  for (let i = 0; i < points.length; i += 2) d += `${i ? 'L' : 'M'}${fmt(points[i])} ${fmt(points[i + 1])}`;
  return d;
};

/** Soft irregular blob (grass patches): a wobbly closed curve, never a plain ellipse. */
function blob(cx: number, cy: number, rx: number, ry: number, a: number, b: number, c: number): string {
  const count = 18;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const theta = (i / count) * Math.PI * 2;
    const k = 1 + 0.17 * Math.sin(theta * 2 + a) + 0.12 * Math.sin(theta * 3 + b) + 0.07 * Math.sin(theta * 5 + c);
    xs.push(cx + Math.cos(theta) * rx * k);
    ys.push(cy + Math.sin(theta) * ry * k);
  }
  let d = `M${fmt((xs[count - 1] + xs[0]) / 2)} ${fmt((ys[count - 1] + ys[0]) / 2)}`;
  for (let i = 0; i < count; i += 1) {
    const n = (i + 1) % count;
    d += `Q${fmt(xs[i])} ${fmt(ys[i])} ${fmt((xs[i] + xs[n]) / 2)} ${fmt((ys[i] + ys[n]) / 2)}`;
  }
  return `${d}Z`;
}

export function buildScenery(input: SceneryInput): Scenery {
  const { width: W, height: H, breakY, blocks, track, contentLeft } = input;
  const desktop = W >= 1100;
  const phone = W < 768;
  /** Size of the pieces: 1 at 1440 px, larger on wider screens, smaller on tablets and phones. */
  const unit = desktop ? clamp(W / 1440, 1, 1.3) : phone ? 0.72 : 0.86;
  const hero = blocks[0];
  const cards = blocks.filter(block => block.opaque);
  const calm = input.calm.length ? input.calm : hero && !hero.opaque ? [hero] : [];
  const wr = Math.round(W / 50) * 50;
  const rng = mulberry32(SCENERY_SEED ^ Math.imul(wr, 0x85ebca6b));
  const roadW = track.roadW;
  const bandEnd = breakY + 220;

  const inRects = (list: Rect[], x: number, y: number, pad: number) =>
    list.some(b => x > b.left - pad && x < b.right + pad && y > b.top - pad && y < b.bottom + pad);
  const inCard = (x: number, y: number, pad: number) => inRects(cards, x, y, pad);

  /* ---------- shore: sea along the top (deeper beside the hero text), beach under the hero ---------- */
  const grid = track.at(track.gridLead);
  const p1 = rng() * 6.28;
  const p2 = rng() * 6.28;
  const seaR = Math.max(W * 0.3, grid.x - roadW / 2 - (desktop ? 64 : 22));
  // Over the hero text the sea stops above the title; beside it, it comes 160–240 px in.
  const seaOverText = clamp(hero.top - 30, 70, 190);
  const seaBeside = desktop && seaR - hero.right > 170 ? 232 : seaOverText;
  const corner = Math.min(seaR * 0.5, seaBeside * 0.95);
  const seaDepth = (x: number) => {
    if (x >= seaR) return 0;
    const base = mix(seaOverText, seaBeside, smooth((x - hero.right - 10) / 150));
    const wave = 15 * Math.sin(x / 83 + p1) + 8 * Math.sin(x / 37 + p2);
    const round = 1 - clamp((seaR - x) / corner, 0, 1);
    return Math.max(0, (base + wave) * Math.sqrt(1 - round * round));
  };
  const inSea = (x: number, y: number, pad = 0) => x < seaR + pad && y < seaDepth(clamp(x, 0, seaR)) + pad;
  const shore: number[] = [];
  const mid: number[] = [];
  const deep: number[] = [];
  const wet: number[] = [];
  for (let x = seaR; x >= -24; x -= 12) {
    const depth = seaDepth(Math.max(0, x));
    shore.push(x, depth);
    wet.push(x, depth + 7);
    const midDepth = depth * 0.8 - 8 + 4 * Math.sin(x / 29 + p2);
    if (midDepth > 0) mid.push(x, midDepth);
    const deepDepth = depth * 0.52 - 16 + 5 * Math.sin(x / 61 + p1);
    if (deepDepth > 0) deep.push(x, deepDepth);
  }
  const fill = (points: number[]) =>
    points.length >= 4 ? `M${fmt(points[0])} 0${polyline(points).replace(/M/g, 'L')}L${fmt(points[points.length - 2])} 0Z` : '';
  const shallow = fill(shore);
  const sea = fill(mid);
  const seaDeep = fill(deep);
  const foam = polyline(shore);
  const foamInner = mid.length >= 4 ? polyline(mid) : '';
  const wetSand = polyline(wet);

  const sandR = desktop ? Math.max(hero.right + 90, W * 0.6, seaR + 80) : W * 1.5;
  const sandB = Math.min(hero.bottom + 70, H * 0.32);
  const sandRadius = (theta: number) => {
    const c = Math.abs(Math.cos(theta)) / sandR;
    const s = Math.abs(Math.sin(theta)) / sandB;
    const base = 1 / Math.pow(Math.pow(c, 2.5) + Math.pow(s, 2.5), 0.4);
    return base * (1 + 0.035 * Math.sin(theta * 9 + p1) + 0.025 * Math.sin(theta * 17 + p2));
  };
  const inSand = (x: number, y: number) => Math.hypot(x, y) < sandRadius(Math.atan2(y, x));
  let sand = 'M0 0';
  for (let i = 0; i <= 48; i += 1) {
    const theta = (i / 48) * (Math.PI / 2);
    const r = sandRadius(theta);
    sand += `L${fmt(Math.cos(theta) * r)} ${fmt(Math.sin(theta) * r)}`;
  }
  sand += 'Z';

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

  /* ---------- grass patches: soft irregular blobs ---------- */
  const patches: Scenery['patches'] = [];
  const patchCount = Math.min(12, Math.round((W * H) / 460000));
  const patchScale = Math.max(0.45, Math.min(1.15, W / 1440));
  for (let i = 0; i < patchCount; i += 1) {
    const rx = (150 + rng() * 170) * patchScale;
    const ry = rx * (0.5 + rng() * 0.3);
    const cx = rng() * W;
    const cy = rng() * (H - 160);
    const a = rng() * 6.28;
    const b = rng() * 6.28;
    const c = rng() * 6.28;
    // Not across the seam between the map and its last stretch.
    if (cy + ry * 1.3 > breakY && cy - ry * 1.3 < bandEnd) continue;
    patches.push({ d: blob(cx, cy, rx, ry, a, b, c), tail: cy > breakY });
  }

  /* ---------- cliff: a filled step that tapers at both ends, open where the road crosses ---------- */
  let cliff: Scenery['cliff'] = null;
  const c1 = rng() * 6.28;
  const cliffTilt = rng() < 0.5 ? -0.06 : 0.06;
  const cliffThick = desktop ? 26 : 18;
  let cliffY = 0;
  let cliffA = 0;
  let cliffB = 0;
  {
    // Where it shows most: a height (25–40% of the map) and a side with few cards over it.
    let top = -Infinity;
    for (let y = H * 0.25; y <= H * 0.4 && y < breakY - 120; y += 24) {
      for (const [a, b] of [
        [-20, W * 0.62],
        [W * 0.38, W + 20]
      ]) {
        let open = 0;
        for (let i = 1; i <= 9; i += 1) if (!inCard(a + ((b - a) * i) / 10, y, 8)) open += 1;
        const fit = open - Math.abs(y / H - 0.33) * 6;
        if (fit > top) {
          top = fit;
          cliffY = y;
          cliffA = a;
          cliffB = b;
        }
      }
    }
  }
  const cliffTop = (x: number) =>
    cliffY + cliffTilt * (x - (cliffA + cliffB) / 2) + 12 * Math.sin(x / 120 + c1) + 5 * Math.sin(x / 47 + p1);
  const cliffDepth = (x: number) => {
    const u = (x - cliffA) / (cliffB - cliffA);
    return u <= 0 || u >= 1 ? 0 : cliffThick * Math.pow(Math.sin(Math.PI * u), 0.6);
  };
  if (cliffY > 0) {
    let face = '';
    let lip = '';
    let upper: number[] = [];
    let lower: number[] = [];
    const close = () => {
      if (upper.length >= 6) {
        const back: number[] = [];
        for (let i = lower.length - 2; i >= 0; i -= 2) back.push(lower[i], lower[i + 1]);
        face += `${polyline(upper)}${polyline(back).replace('M', 'L')}Z`;
        lip += polyline(upper);
      }
      upper = [];
      lower = [];
    };
    for (let x = cliffA; x <= cliffB; x += 8) {
      const depth = cliffDepth(x);
      const top = cliffTop(x);
      if (depth < 2 || track.distance(x, top + depth / 2) < roadW / 2 + 12) {
        close();
        continue;
      }
      upper.push(x, top);
      // Scalloped foot of the step.
      lower.push(x, top + depth + 3 * Math.abs(Math.sin(x / 14)));
    }
    close();
    if (face) cliff = { face, lip };
  }
  const cliffHit = (x: number, y: number, pad: number) => {
    if (!cliff || x < cliffA - pad || x > cliffB + pad) return false;
    const top = cliffTop(x);
    return y > top - pad && y < top + cliffDepth(x) + 10 + pad;
  };

  /* ---------- stream that crosses the page under a wooden bridge ---------- */
  let river: Scenery['river'] = null;
  let bridge: Scenery['bridge'] = null;
  const riverW = W >= 768 ? 34 : 22;
  const riverLo = H * 0.66;
  const riverHi = Math.min(H * 0.9, breakY - 90);
  const r1 = rng() * 6.28;
  const r2 = rng() * 6.28;
  const riverWave = (t: number) => 14 * Math.sin(t / 170 + r1) + 7 * Math.sin(t / 67 + r2);
  let riverX = 0;
  let riverY = 0;
  let riverUx = 1;
  let riverUy = 0;
  {
    // The crossing: where the road runs down the page, in the open (not beside or behind a card).
    let lowest = Infinity;
    let crossAngle = 90;
    for (let y = riverLo; y <= riverHi; y += 12) {
      const point = track.at(track.lenAtY(y));
      const lean = Math.abs(Math.cos((point.angle * Math.PI) / 180));
      if (lean > 0.6 || inCard(point.x, y, roadW / 2 + 8)) continue;
      const cost = lean + Math.abs(y / H - 0.78) * 1.5;
      if (cost < lowest) {
        lowest = cost;
        riverY = y;
        riverX = point.x;
        crossAngle = point.angle;
      }
    }
    if (lowest < Infinity) {
      // The stream leans a little, towards square with the road (at most 12°).
      let lean = clamp(((crossAngle - 90) * Math.PI) / 180, -0.21, 0.21);
      const reach = Math.max(riverX, W - riverX) * Math.abs(Math.tan(lean)) + 40;
      if (riverY - reach < riverLo - 60 || riverY + reach > breakY - 50) lean = 0;
      riverUx = Math.cos(lean);
      riverUy = Math.sin(lean);
      const shift = riverWave(0);
      const points: number[] = [];
      const far = W / riverUx + 60;
      for (let t = -far; t <= far; t += 30) {
        const off = riverWave(t) - shift;
        points.push(riverX + riverUx * t - riverUy * off, riverY + riverUy * t + riverUx * off);
      }
      river = { d: polyline(points), width: riverW };
      const roadRad = (crossAngle * Math.PI) / 180;
      const square = Math.abs(Math.sin(roadRad - lean));
      bridge = { x: riverX, y: riverY, angle: crossAngle - 90, w: roadW + 12, len: Math.min(130, (riverW + 22) / Math.max(0.5, square)) };
    }
  }
  const riverDist = (x: number, y: number) => {
    if (!river) return Infinity;
    const dx = x - riverX;
    const dy = y - riverY;
    const t = dx * riverUx + dy * riverUy;
    return Math.abs(-dx * riverUy + dy * riverUx - (riverWave(t) - riverWave(0)));
  };

  /* ---------- grandstand beside the straight, just past the finish line ---------- */
  const standH = W >= 768 ? 130 : 84;
  const standW = W >= 768 ? 30 : 18;
  const stand = { x: W / 2 + roadW / 2 + (W >= 768 ? 30 : 24), y: track.finishY + 22, w: standW, h: standH };

  /* ---------- first stars, in the last 400 px before the finish ---------- */
  const starBands = ['', '', ''];
  for (let i = 0; i < 27; i += 1) {
    const up = rng() * 400;
    const x = rng() * W;
    const r = 0.8 + rng() * 0.9;
    starBands[Math.min(2, Math.floor(up / 134))] += circlePath(x, track.finishY - up, r);
  }
  const stars = starBands.map((d, index) => ({ d, o: [0.85, 0.55, 0.28][index] })).filter(star => star.d);

  /* ---------- placed pieces ---------- */
  const cell = 90;
  const buckets = new Map<string, Piece[]>();
  const pieces: Piece[] = [];
  const limitY = track.endY - 150;

  const crowded = (x: number, y: number, rad: number, pack: number) => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    for (let ix = gx - 2; ix <= gx + 2; ix += 1) {
      for (let iy = gy - 2; iy <= gy + 2; iy += 1) {
        const bucket = buckets.get(`${ix}|${iy}`);
        if (!bucket) continue;
        for (const other of bucket) {
          const reach = (rad + other.rad) * pack;
          if ((other.x - x) * (other.x - x) + (other.y - y) * (other.y - y) < reach * reach) return true;
        }
      }
    }
    return false;
  };
  const add = (id: PieceId, x: number, y: number, s: number, r = 0, fixed = false) => {
    const piece: Piece = { id, x, y, s, r, rad: FOOT[id] * s, tail: y > breakY + 140, fixed: fixed || undefined };
    pieces.push(piece);
    const key = `${Math.floor(x / cell)}|${Math.floor(y / cell)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(piece);
    else buckets.set(key, [piece]);
  };

  /* ---------- village: plaza with the church, streets, rows of houses, fences along the plots ---------- */
  let village: Scenery['village'] = null;
  let villageRect: Rect | null = null;
  if (W >= 600) {
    // Free room on a coarse grid (cards and road), then the largest rectangle that fits.
    const step = 12;
    const y0 = Math.floor((H * 0.4) / step) * step;
    const y1 = Math.min(H * 0.69, breakY - 60);
    const cols = Math.ceil(W / step);
    const rows = Math.max(0, Math.ceil((y1 - y0) / step));
    const sums = new Int32Array((cols + 1) * (rows + 1));
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const x = (i + 0.5) * step;
        const y = y0 + (j + 0.5) * step;
        const busy =
          inCard(x, y, 14 + step / 2) || track.distance(x, y) < roadW / 2 + 20 + step * 0.7 || cliffHit(x, y, 30) || riverDist(x, y) < riverW + 40
            ? 1
            : 0;
        sums[(j + 1) * (cols + 1) + i + 1] = busy + sums[j * (cols + 1) + i + 1] + sums[(j + 1) * (cols + 1) + i] - sums[j * (cols + 1) + i];
      }
    }
    const busyIn = (i0: number, j0: number, i1: number, j1: number) =>
      sums[j1 * (cols + 1) + i1] - sums[j0 * (cols + 1) + i1] - sums[j1 * (cols + 1) + i0] + sums[j0 * (cols + 1) + i0];
    const sizes: [number, number][] = [];
    for (const hw of desktop ? [340, 280, 225, 175, 130] : [225, 175, 130, 100]) {
      for (const hh of [132, 114, 100, 88, 78]) sizes.push([hw * unit, hh * unit]);
    }
    sizes.sort((a, b) => b[0] * b[1] - a[0] * a[1]);
    for (const [hw, hh] of sizes) {
      const wCells = Math.ceil((hw * 2) / step);
      const hCells = Math.ceil((hh * 2) / step);
      let lowestCost = Infinity;
      for (let j = 0; j + hCells <= rows; j += 1) {
        for (let i = 0; i + wCells <= cols; i += 1) {
          if (busyIn(i, j, i + wCells, j + hCells)) continue;
          const cx = (i + wCells / 2) * step;
          const cy = y0 + (j + hCells / 2) * step;
          const cost = Math.abs(cy / H - 0.54) * 4 + Math.abs(cx / W - 0.5);
          if (cost < lowestCost) {
            lowestCost = cost;
            villageRect = { left: cx - hw, right: cx + hw, top: cy - hh, bottom: cy + hh };
          }
        }
      }
      if (villageRect) break;
    }
  }
  if (villageRect) {
    const { left, right, top, bottom } = villageRect;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const hw = (right - left) / 2;
    const hh = (bottom - top) / 2;
    const hs = unit * 1.18;
    const street = 15 * hs;
    const plazaW = Math.min(hw * 0.36, 104 * hs);
    const plazaH = Math.min(hh - 8, 82 * hs);
    const plaza = { left: cx - plazaW, right: cx + plazaW, top: cy - plazaH, bottom: cy + plazaH };
    // Main street through the plaza, a lane on each side of it.
    const laneX = plazaW + street / 2 + 3;
    let streets = `M${fmt(left + 6)} ${fmt(cy)}H${fmt(right - 6)}`;
    const lanes = hw - laneX > 70 * hs;
    if (lanes) {
      streets += `M${fmt(cx - laneX)} ${fmt(top + 8)}V${fmt(bottom - 8)}M${fmt(cx + laneX)} ${fmt(top + 8)}V${fmt(bottom - 8)}`;
    }
    add('church', cx, cy - plazaH * 0.12, 1.3 * hs, 0, true);
    add('flowers', cx - plazaW * 0.62, cy + plazaH * 0.62, hs, 20, true);
    add('flowers', cx + plazaW * 0.62, cy + plazaH * 0.62, hs, -20, true);
    add('tree2', cx - plazaW * 0.7, cy - plazaH * 0.62, 0.8 * hs, 0, true);
    add('tree2', cx + plazaW * 0.7, cy - plazaH * 0.62, 0.8 * hs, 0, true);

    // Rows of houses facing the street, on both sides of the plaza; a second row behind when it fits.
    const rowW = 128 * hs;
    const gap = 10 * hs;
    const depth = 31 * hs;
    const inner = lanes ? laneX + street / 2 + 8 * hs : plazaW + 10 * hs;
    const rowYs: number[] = [];
    for (let k = 0; k < 2; k += 1) {
      const offset = street / 2 + 5 * hs + depth / 2 + k * (depth + 9 * hs);
      if (offset + depth / 2 > hh - 5) break;
      rowYs.push(-offset, offset);
    }
    let fence = '';
    for (const side of [-1, 1]) {
      const from = side < 0 ? left + 9 : cx + inner;
      const to = side < 0 ? cx - inner : right - 9;
      const room = to - from;
      const count = Math.floor((room + gap) / (rowW + gap));
      const rest = room - count * rowW - Math.max(0, count - 1) * gap;
      const single = rest >= 48 * hs + gap;
      const used = count * rowW + Math.max(0, count - 1) * gap + (single ? 40 * hs + gap : 0);
      const x = from + (room - used) / 2;
      rowYs.forEach((dy, index) => {
        let at = x;
        for (let n = 0; n < count; n += 1) {
          add((n + index) % 2 ? 'row-h2' : 'row-h', at + rowW / 2, cy + dy, hs, 0, true);
          at += rowW + gap;
        }
        if (single) add(index % 2 ? 'house' : 'house-sq', at + 20 * hs, cy + dy, hs, 0, true);
      });
      // Fence along the back of the plots and around the outer end.
      const outer = side < 0 ? left + 3 : right - 3;
      const innerX = side < 0 ? to + 4 : from - 4;
      if (count > 0 || single) {
        fence += `M${fmt(innerX)} ${fmt(top + 3)}H${fmt(outer)}V${fmt(cy - street)}M${fmt(outer)} ${fmt(cy + street)}V${fmt(bottom - 3)}H${fmt(innerX)}`;
      }
    }
    village = { plaza, radius: Math.min(plazaW, plazaH) * 0.55, streets, streetWidth: street, fence };
  }
  const inVillage = (x: number, y: number, pad: number) => villageRect !== null && inRects([villageRect], x, y, pad);

  /** Room for a piece of this footprint at (x, y)? */
  const free = (x: number, y: number, rad: number) => {
    if (y > limitY) return false;
    if (inCard(x, y, desktop ? 16 + rad * 0.75 : phone ? 2 : 8 + rad * 0.3)) return false;
    if (inRects(calm, x, y, (desktop ? 18 : 8) + rad * 0.7)) return false;
    if (track.distance(x, y) < roadW / 2 + 10 + rad * 0.85) return false;
    if (riverDist(x, y) < riverW / 2 + 8 + rad * 0.75) return false;
    if (cliffHit(x, y, rad * 0.6 + 4)) return false;
    if (x > stand.x - rad && x < stand.x + stand.w + rad && y > stand.y - rad && y < stand.y + stand.h + rad) return false;
    if (inCove(x, y, rad * 0.7 + 6) || inSea(x, y, rad * 0.75 + 8)) return false;
    if (inVillage(x, y, rad * 0.75 + 10)) return false;
    return true;
  };

  // Boats out on the water.
  for (const u of [0.16, 0.74]) {
    const x = seaR * u + (rng() - 0.5) * 60;
    const depth = seaDepth(x);
    const turn = -35 + rng() * 70;
    const y = Math.max(NAV_H + 22, depth * 0.42);
    if (depth > 96 && y < depth - 40 && !phone) add('boat', x, y, 1.1 * unit, turn);
  }

  // Palms clustered along the beach, just behind the wet sand.
  for (let x = 30 * unit; x < seaR + 50; x += 104 * unit) {
    const u = rng();
    const v = rng();
    const w = rng();
    const id: PieceId = u < 0.42 ? 'palms-a' : u < 0.78 ? 'palms-b' : 'palm';
    const s = unit * (0.9 + v * 0.22);
    const rad = FOOT[id] * s;
    const px = x + (w - 0.5) * 40 * unit;
    const py = seaDepth(clamp(px, 0, seaR)) + rad * 0.8 + 16 + w * 30 * unit;
    if (!inSand(px, py) || !free(px, py, rad) || crowded(px, py, rad, 1)) continue;
    add(id, px, py, s);
  }

  // A few rocks at the foot of the cliff.
  if (cliff) {
    for (let i = 0; i < 6; i += 1) {
      const u = rng();
      const v = rng();
      const x = cliffA + (cliffB - cliffA) * (0.14 + i * 0.13 + u * 0.05);
      const s = unit * (1 + v * 0.5);
      const id: PieceId = v < 0.5 ? 'rock' : 'rock2';
      const y = cliffTop(x) + cliffDepth(x) + 12 + FOOT[id] * s * 0.6;
      if (cliffDepth(x) < 8 || inCard(x, y, 6) || track.distance(x, y) < roadW / 2 + 20 || crowded(x, y, FOOT[id] * s, 1)) continue;
      add(id, x, y, s);
    }
  }

  // Groves and woods first, then single pieces in the room that is left.
  const bands = Math.ceil(limitY / BAND);
  for (let band = 0; band < bands; band += 1) {
    const bandRng = mulberry32(SCENERY_SEED ^ Math.imul(band + 1, 0x9e3779b1) ^ Math.imul(wr, 0x85ebca6b));
    const f = ((band + 0.5) * BAND) / H;
    const bandZone = ZONES.find(z => f < z.until) ?? ZONES[ZONES.length - 1];
    for (const big of [true, false]) {
      const gap = (big ? Math.min(bandZone.bigGap, SAND.bigGap) : Math.min(bandZone.smallGap, SAND.smallGap)) * unit;
      const attempts = Math.ceil((W * BAND) / (gap * gap));
      for (let i = 0; i < attempts; i += 1) {
        // Always draw the same count of numbers per attempt, so the stream stays aligned.
        const x = bandRng() * W;
        const y = band * BAND + bandRng() * BAND;
        const u = bandRng();
        const v = bandRng();
        const w = bandRng();
        const zone = inSand(x, y) ? SAND : (ZONES.find(z => y / H < z.until) ?? ZONES[ZONES.length - 1]);
        // Sparser zones skip part of the tries.
        const zoneGap = (big ? zone.bigGap : zone.smallGap) * unit;
        if (w > (gap * gap) / (zoneGap * zoneGap)) continue;
        const id = pick(big ? zone.big : zone.small, u);
        const s = unit * (0.9 + v * 0.25);
        const rad = FOOT[id] * s;
        if (!free(x, y, rad) || crowded(x, y, rad, zone.pack)) continue;
        add(id, x, y, s, id === 'flowers' ? Math.round(v * 3) * 30 : 0);
      }
    }
  }

  // Over the budget (very wide screens): thin evenly, so no part of the map ends up bare.
  let kept = pieces;
  if (pieces.length > MAX_PIECES) {
    const fixed = pieces.filter(piece => piece.fixed).length;
    const ratio = Math.max(0, MAX_PIECES - fixed) / Math.max(1, pieces.length - fixed);
    let index = 0;
    kept = pieces.filter(piece => {
      if (piece.fixed) return true;
      index += 1;
      return Math.floor(index * ratio) !== Math.floor((index - 1) * ratio);
    });
  }

  // Painter's order: pieces lower on the page cover the shadows of the ones above.
  kept.sort((a, b) => a.y - b.y);

  return { sand, wetSand, shallow, sea, seaDeep, foam, foamInner, cove, coveFoam, patches, cliff, village, river, bridge, stand, stars, pieces: kept };
}

/* ---------- the last stretch of road, in slices that fade one after the other ---------- */
export interface TailSlice {
  from: number;
  to: number;
}

export function buildSlices(track: Track, breakLen: number): TailSlice[] {
  const span = Math.max(1, track.length - breakLen);
  const count = clamp(Math.round(span / 120), 3, 9);
  const slices: TailSlice[] = [];
  for (let i = 0; i < count; i += 1) {
    slices.push({ from: breakLen + (span * i) / count, to: breakLen + (span * (i + 1)) / count });
  }
  return slices;
}

/* ---------- pieces of road and scenery that break off after the finish ---------- */
export type ChunkKind = 'asphalt' | 'kerb-red' | 'kerb-white' | 'leaf' | 'roof';

export interface Chunk {
  kind: ChunkKind;
  /** Where it sits before it breaks off, and its heading there. */
  x: number;
  y: number;
  turn: number;
  /** Outline, around (0, 0). */
  d: string;
  dx: number;
  dy: number;
  rot: number;
  /** Track length at which the break front lets it go. */
  at: number;
  /** Track length at which it shows (its slice of road starts to fade). */
  show: number;
  /** Opacity of the star it ends as. */
  glow: number;
  cool: boolean;
}

const MAX_CHUNKS = 260;
const MIN_CHUNKS = 150;

export function buildChunks(track: Track, breakLen: number, slices: TailSlice[], pieces: Piece[], width: number): Chunk[] {
  const rng = mulberry32(SCENERY_SEED ^ 0x51ed270b ^ Math.round(width / 50));
  const chunks: Chunk[] = [];
  const spread = Math.min(560, width * 0.75);
  const roadW = track.roadW;
  const span = Math.max(1, track.length - breakLen);

  /** Irregular polygon: a box (hw × hl) with every corner pulled in a little, plus one notch. */
  const shard = (hw: number, hl: number) => {
    const j = () => rng() * Math.min(3.2, hw * 0.45);
    const points = [-hw + j(), -hl + j(), hw - j(), -hl + j(), hw - j() * 0.6, (rng() - 0.5) * hl, hw - j(), hl - j(), -hw + j(), hl - j()];
    return `${polyline(points)}Z`;
  };
  const make = (kind: ChunkKind, x: number, y: number, turn: number, d: string, at: number, show: number): Chunk => ({
    kind,
    x,
    y,
    turn,
    d,
    dx: (rng() - 0.5) * spread,
    dy: 140 + rng() * 540,
    rot: (rng() - 0.5) * 560,
    at: at + rng() * 46,
    show,
    glow: 0.35 + rng() * 0.6,
    cool: rng() < 0.4
  });

  // The road itself, tiled: rows of asphalt shards with a kerb shard on each side.
  const lanes = roadW >= 44 ? 2 : 1;
  const perRow = lanes + 2;
  const rows = clamp(Math.round(span / 21), 12, Math.floor((MAX_CHUNKS - 44) / perRow));
  const step = span / rows;
  const laneW = roadW / lanes;
  for (let row = 0; row < rows; row += 1) {
    const s = breakLen + (row + 0.5) * step;
    const p = track.at(s);
    const a = (p.angle * Math.PI) / 180;
    // Unit vector across the road.
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const show = (slices.find(slice => s < slice.to) ?? slices[slices.length - 1]).from;
    const turn = p.angle - 90;
    for (let lane = 0; lane < lanes; lane += 1) {
      const off = (lane + 0.5) * laneW - roadW / 2;
      chunks.push(make('asphalt', p.x + nx * off, p.y + ny * off, turn, shard(laneW / 2 + 0.5, step / 2 + 0.5), s, show));
    }
    for (const side of [-1, 1]) {
      const off = side * (roadW / 2 + 2.5);
      chunks.push(make((row + (side > 0 ? 1 : 0)) % 2 ? 'kerb-red' : 'kerb-white', p.x + nx * off, p.y + ny * off, turn, shard(3.4, step / 2 + 0.5), s, show));
    }
  }

  // Leaves and roof tiles from the scenery around it.
  const leaf = () => {
    const r = 5.5 + rng() * 4.5;
    const points: number[] = [];
    const phase = rng() * 6.28;
    for (let i = 0; i < 5; i += 1) {
      const angle = phase + (i / 5) * 6.28;
      const k = 0.7 + rng() * 0.5;
      points.push(Math.cos(angle) * r * k, Math.sin(angle) * r * k);
    }
    return `${polyline(points)}Z`;
  };
  const tail = pieces.filter(piece => piece.tail);
  for (const piece of tail) {
    const roof = piece.id.startsWith('house') || piece.id.startsWith('row') || piece.id === 'church';
    const count = piece.rad > 34 ? 3 : 1;
    for (let i = 0; i < count && chunks.length < MAX_CHUNKS; i += 1) {
      const x = piece.x + (rng() - 0.5) * piece.rad * 1.3;
      const y = piece.y + (rng() - 0.5) * piece.rad * 1.3;
      const at = Math.max(breakLen, track.lenAtY(y));
      chunks.push(make(roof ? 'roof' : 'leaf', x, y, rng() * 360, leaf(), at, at));
    }
  }
  while (chunks.length < MIN_CHUNKS) {
    const s = breakLen + rng() * span;
    const p = track.at(s);
    const side = rng() < 0.5 ? -1 : 1;
    const x = clamp(p.x + side * (roadW / 2 + 16 + rng() * Math.min(width, 700) * 0.45), 4, width - 4);
    chunks.push(make('leaf', x, p.y + (rng() - 0.5) * 60, rng() * 360, leaf(), s, s));
  }
  return chunks.slice(0, MAX_CHUNKS);
}
