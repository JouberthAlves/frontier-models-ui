/**
 * Pastel top-down scenery of the racing zone (spec-v2 §3). Everything here is pure geometry:
 * the same seed and the same page width give the same map.
 *
 * The map is built in layers:
 *  1. terrain: sand and sea on the shore, soft grass blobs, the cliff step (one side of the road),
 *     the winding stream;
 *  2. the village: houses of varied size and turn packed around a sand plaza with the church,
 *     curved streets, gardens and trees in the lots, a fence around it, a few houses outside it;
 *  3. hedges along the road in places, clearings;
 *  4. pieces (illustrated sprites, see sceneryKit.ts): big single trees, groves, woods and palm clusters first (composite symbols: one
 *     element draws 3 to 7 trees), then single pieces in the room that is left. Both by seeded dart throwing per
 *     400 px band (a block that grows only reshuffles the bands it touches), away from the
 *     content blocks, the hero text, the road and the water.
 *
 * The soft shadows under the pieces are one shared path (two stacked fills, no filter), built here
 * from where each sprite touches the ground.
 *
 * To get a different map, change SCENERY_SEED. To change what grows where, edit `ZONES`.
 */
import { FOOT, KIT_PARTS, SPRITES, type PieceId } from './sceneryKit';
import { ROAD_TAIL, type BlockRect, type Track } from './track';

export type { PieceId } from './sceneryKit';

export const SCENERY_SEED = 20261118;
/** Whole map SVG must stay under 650 elements (spec-v2 §9): this caps the placed pieces. */
export const MAX_PIECES = 300;
const BAND = 400;
const NAV_H = 64;
/** px kept free between a piece and a card (cliff rocks keep CLIFF_ROCK_GAP more). */
const CARD_GAP = 12;
const CLIFF_ROCK_GAP = 8;
/** px kept free between a piece and the boxes of the hero h1 / p / dl / buttons. */
const CALM_GAP = 16;

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
  /** Rotation in degrees. Houses and the church stay upright (front wall at the bottom). */
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
  patches: string[];
  /** Cliff step: the face (filled), the shaded band along its foot, a rock seam, and its top lip. */
  cliff: { face: string; foot: string; strata: string; lip: string } | null;
  /** Plaza (a filled blob) and dirt streets (stroked). The fence is made of pieces. */
  village: { plaza: string; streets: string; streetWidth: number } | null;
  /** Stream: the water (filled, its width varies), the deeper middle, flow dashes, bank stones. */
  river: { water: string; deep: string; deepWidth: number; flow: string; stones: string } | null;
  bridge: { x: number; y: number; angle: number; w: number; len: number } | null;
  /** Grandstand: `tiles` sprites of `w` × `tileH` stacked down the page. */
  stand: { x: number; y: number; w: number; h: number; tiles: number; tileH: number };
  /** Soft ground shadows of all the pieces: a wide faint layer and a tighter one, body and last stretch. */
  shadows: { soft: string; core: string; tailSoft: string; tailCore: string };
  /** The hero text and buttons as one box: a light wash goes behind them. */
  calmBox: Rect | null;
  moon: { x: number; y: number; r: number };
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
    big: [['oak', 14], ['grove-b', 28], ['grove-c', 18], ['palms-a', 18], ['grove-a', 28]],
    bigGap: 58,
    small: [['tree', 26], ['tree2', 20], ['palm', 16], ['bush', 12], ['bushes', 8], ['rock', 10], ['flowers', 8]],
    smallGap: 96,
    pack: 0.96
  },
  // Cliff and fields
  {
    until: 0.42,
    big: [['oak', 20], ['grove-a', 38], ['grove-b', 26], ['grove-c', 16], ['woods-c', 8]],
    bigGap: 54,
    small: [['tree', 30], ['tree2', 24], ['bush', 10], ['bushes', 8], ['rock', 8], ['rock2', 8], ['flowers', 8], ['pine', 6]],
    smallGap: 96,
    pack: 0.94
  },
  // Around the village
  {
    until: 0.66,
    big: [['oak', 18], ['grove-a', 34], ['grove-b', 28], ['grove-c', 20], ['woods-c', 8]],
    bigGap: 56,
    // No houses here: they only stand in the village and on its outskirts.
    small: [['tree', 30], ['tree2', 24], ['bush', 10], ['bushes', 8], ['flowers', 18], ['rock', 6], ['pine', 4]],
    smallGap: 96,
    pack: 0.94
  },
  // Woods: almost fully covered by canopy
  {
    until: 0.9,
    big: [['oak-d', 16], ['woods-a', 50], ['woods-b', 28], ['woods-c', 10]],
    bigGap: 30,
    small: [['dense', 44], ['pine', 22], ['pine2', 16], ['tree2', 12], ['bushes', 6]],
    smallGap: 44,
    pack: 0.62
  },
  // Finish
  {
    until: 2,
    big: [['oak-d', 20], ['woods-c', 42], ['grove-c', 42]],
    bigGap: 110,
    small: [['bushes', 40], ['pine', 16], ['pine2', 14], ['tree2', 30]],
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

/** Big single trees: placed with the groves, at 1 to 1.6 of their size. */
const LANDMARK = new Set<PieceId>(['oak', 'oak-d']);
/** Trees whose size varies the most (0.85 to 1.6). */
const SINGLE_TREE = new Set<PieceId>(['tree', 'tree2', 'pine', 'pine2', 'dense', 'palm', 'palm2', 'bush', 'bushes']);
/** Low things that may grow in a clearing. */
const GROUND_COVER = new Set<PieceId>(['flowers', 'bush', 'bushes', 'rock', 'rock2']);
/**
 * Sprites lit evenly enough to face any way. The round canopies (and the groves made of them)
 * have a lit side, so they only lean a little; buildings never turn.
 */
const FREE_TURN = new Set<PieceId>([
  'palm',
  'palm2',
  'pine',
  'pine2',
  'bush',
  'bushes',
  'rock',
  'rock2',
  'umbrella',
  'umbrella2',
  'flowers',
  'palms-a',
  'palms-b'
]);
/** Turn of a piece from two numbers it already drew (no extra draw: the stream stays aligned). */
const turnOf = (id: PieceId, u: number, v: number) => {
  const t = (u * 977 + v * 613) % 1;
  return FREE_TURN.has(id) ? Math.round(t * 360) : Math.round((t - 0.5) * 44);
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
/** Outline of an ellipse, turned by `turn` degrees. */
const ellipsePath = (cx: number, cy: number, rx: number, ry: number, turn: number) => {
  const a = (turn * Math.PI) / 180;
  const ux = Math.cos(a) * rx;
  const uy = Math.sin(a) * rx;
  const arc = `a${rx.toFixed(1)} ${ry.toFixed(1)} ${Math.round(turn)} 1 0 `;
  return `M${fmt(cx - ux)} ${fmt(cy - uy)}${arc}${fmt(ux * 2)} ${fmt(uy * 2)}${arc}${fmt(-ux * 2)} ${fmt(-uy * 2)}Z`;
};
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

  /* ---------- grass patches: soft irregular blobs (none on the last stretch: it is dusk there) ---------- */
  const patches: string[] = [];
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
    if (cy + ry * 1.3 > breakY) continue;
    patches.push(blob(cx, cy, rx, ry, a, b, c));
  }

  /* ---------- cliff: a step on ONE side of the road, its face thinning to nothing before the kerb ---------- */
  let cliff: Scenery['cliff'] = null;
  const c1 = rng() * 6.28;
  const cliffTilt = rng() < 0.5 ? -0.035 : 0.035;
  const cliffDeep = desktop ? 62 * Math.min(unit, 1.15) : phone ? 34 : 46;
  const roadXAt = (y: number) => track.at(track.lenAtY(y)).x;
  /** 0 beside the road (from 40 px before the kerb), 1 away from it: the face thins out, never a square cut. */
  const cliffTaper = (x: number, top: number) =>
    smooth((Math.min(track.distance(x, top), track.distance(x, top + cliffDeep / 2), track.distance(x, top + cliffDeep)) - (roadW / 2 + 45)) / 80);
  let cliffY = 0;
  let cliffSide = 1;
  {
    // Where it shows most: a height (22–40% of the map) and a side of the road with a long open run.
    let top = 150;
    for (let y = H * 0.22; y <= H * 0.4 && y < breakY - 160; y += 24) {
      const mid = y + cliffDeep / 2;
      const rx = roadXAt(mid);
      for (const side of [-1, 1]) {
        let open = 0;
        for (let x = side < 0 ? -20 : rx; x <= (side < 0 ? rx : W + 20); x += 24) {
          if (inCard(x, mid, cliffDeep / 2 + 16) || inRects(calm, x, mid, cliffDeep / 2 + 20) || inSand(Math.max(0, x), Math.max(0, mid - cliffDeep))) {
            continue;
          }
          // Counts for as much as the face is deep there.
          open += 24 * cliffTaper(x, y);
        }
        const fit = open - Math.abs(y / H - 0.31) * 1800;
        if (fit > top) {
          top = fit;
          cliffY = y;
          cliffSide = side;
        }
      }
    }
  }
  const cliffLine = (x: number) => cliffY + cliffTilt * (x - W / 2) + 11 * Math.sin(x / 120 + c1) + 5 * Math.sin(x / 47 + p1);
  // Top edge and depth of the face, sampled every 8 px across the page.
  const CS = 8;
  const cliffN = Math.ceil((W + 48) / CS) + 1;
  const cliffTops = new Float32Array(cliffN);
  const cliffDepths = new Float32Array(cliffN);
  if (cliffY > 0) {
    for (let i = 0; i < cliffN; i += 1) {
      const x = -24 + i * CS;
      const top = cliffLine(x);
      cliffTops[i] = top;
      const mid = top + cliffDeep / 2;
      if ((x - roadXAt(mid)) * cliffSide <= 0) continue;
      cliffDepths[i] = cliffDeep * cliffTaper(x, top) * (0.86 + 0.14 * Math.sin(x / 70 + c1 * 2));
    }
    const back = (points: number[]) => {
      const out: number[] = [];
      for (let i = points.length - 2; i >= 0; i -= 2) out.push(points[i], points[i + 1]);
      return polyline(out).replace('M', 'L');
    };
    let face = '';
    let foot = '';
    let strata = '';
    let lip = '';
    let up: number[] = [];
    let low: number[] = [];
    let band: number[] = [];
    let seam: number[] = [];
    const closeSeam = () => {
      if (seam.length >= 6) strata += polyline(seam);
      seam = [];
    };
    const close = () => {
      if (up.length >= 8) {
        face += `${polyline(up)}${back(low)}Z`;
        foot += `${polyline(band)}${back(low)}Z`;
        lip += polyline(up);
      }
      closeSeam();
      up = [];
      low = [];
      band = [];
    };
    for (let i = 0; i < cliffN; i += 1) {
      const depth = cliffDepths[i];
      if (depth < 3) {
        close();
        continue;
      }
      const x = -24 + i * CS;
      const top = cliffTops[i];
      up.push(x, top);
      // Scalloped foot of the step; the darker band along it is the shaded bottom of the face.
      low.push(x, top + depth + 3 * Math.abs(Math.sin(x / 15)));
      band.push(x, top + depth * 0.66 + 2 * Math.sin(x / 23 + c1));
      if (depth > 24) seam.push(x, top + depth * 0.34 + 2.5 * Math.sin(x / 31 + c1));
      else closeSeam();
    }
    close();
    if (face) cliff = { face, foot, strata, lip };
  }
  const cliffHit = (x: number, y: number, pad: number) => {
    if (!cliff) return false;
    const at = Math.round((x + 24) / CS);
    const reach = Math.ceil(pad / CS);
    for (let i = Math.max(0, at - reach); i <= Math.min(cliffN - 1, at + reach); i += 1) {
      const depth = cliffDepths[i];
      if (depth >= 3 && y > cliffTops[i] - 5 - pad && y < cliffTops[i] + depth + 14 + pad) return true;
    }
    return false;
  };

  /* ---------- stream: winds across the page with a diagonal drift, under a wooden bridge ---------- */
  let river: Scenery['river'] = null;
  let bridge: Scenery['bridge'] = null;
  const riverBase = desktop ? clamp(50 * unit, 46, 60) : W >= 768 ? 36 : 22;
  const riverLo = H * 0.66;
  const riverHi = Math.min(H * 0.9, breakY - 90);
  const r1 = rng() * 6.28;
  const r2 = rng() * 6.28;
  const r3 = rng() * 6.28;
  const driftSign = rng() < 0.5 ? -1 : 1;
  const riverAmp = clamp(W * 0.078, 24, 122);
  const riverLam = clamp(W * 0.07, 58, 104);
  interface RiverPoint {
    t: number;
    x: number;
    y: number;
    /** Width of the water there. */
    w: number;
  }
  let riverPts: RiverPoint[] = [];
  let riverTop = Infinity;
  let riverBottom = -Infinity;
  {
    // The crossing: where the road runs down the page, in the open (not beside or behind a card).
    const crossings: { x: number; y: number; angle: number; cost: number }[] = [];
    for (let y = riverLo; y <= riverHi; y += 12) {
      const point = track.at(track.lenAtY(y));
      const lean = Math.abs(Math.cos((point.angle * Math.PI) / 180));
      if (lean > 0.5 || inCard(point.x, y, roadW / 2 + 8)) continue;
      crossings.push({ x: point.x, y, angle: point.angle, cost: lean + Math.abs(y / H - 0.78) * 1.5 });
    }
    crossings.sort((a, b) => a.cost - b.cost);
    // Centre line: a straight axis through the crossing (leaning `lean`), plus a wave that is
    // flat at the crossing itself, so the bridge sits square on the water.
    const trace = (cross: { x: number; y: number }, lean: number, amp: number) => {
      const ux = Math.cos(lean);
      const uy = Math.sin(lean);
      const wave = (t: number) => amp * (0.8 * Math.sin(t / riverLam + r1) + 0.2 * Math.sin(t / (riverLam * 0.45) + r2));
      const still = wave(0);
      const points: RiverPoint[] = [];
      const from = Math.floor((-70 - cross.x) / ux / 14) * 14;
      for (let t = from; t <= (W + 70 - cross.x) / ux + 14; t += 14) {
        const off = (wave(t) - still) * smooth(Math.abs(t) / 170);
        points.push({
          t,
          x: cross.x + ux * t - uy * off,
          y: cross.y + uy * t + ux * off,
          w: riverBase * (1 + 0.2 * Math.sin(t / 140 + r3))
        });
      }
      return points;
    };
    // It crosses the road once (at the bridge), keeps clear of it elsewhere and stays in its zone.
    const fits = (points: RiverPoint[]) =>
      points.every(point => {
        if (point.x < -20 || point.x > W + 20) return true;
        if (point.y < H * 0.6 || point.y > breakY - 44 - point.w / 2) return false;
        if (Math.abs(point.t) < 80 || inCard(point.x, point.y, 0)) return true;
        return track.distance(point.x, point.y) > roadW / 2 + 5 + point.w / 2 + 14;
      });
    const baseLean = (angle: number) => clamp(((angle - 90) * Math.PI) / 180, -0.21, 0.21);
    const search = () => {
      // Widest winding first; a smaller wave only when the wide one does not fit anywhere.
      for (const scale of [1, 0.85, 0.7, 0.55, 0.4, 0.28]) {
        for (const cross of crossings) {
          const base = baseLean(cross.angle);
          // A road running straight down: lean the stream anyway, for the diagonal drift.
          const leans = Math.abs(base) < 0.1 ? [driftSign * 0.17, -driftSign * 0.17, base] : [base];
          for (const lean of leans) {
            const points = trace(cross, lean, riverAmp * scale);
            if (fits(points)) return { cross, lean, points };
          }
        }
      }
      const cross = crossings[0];
      return cross ? { cross, lean: 0, points: trace(cross, 0, 14) } : null;
    };
    const found = search();
    if (found) {
      const { cross, lean, points } = found;
      riverPts = points;
      const left: number[] = [];
      const right: number[] = [];
      const centre: number[] = [];
      const flowA: number[] = [];
      const flowB: number[] = [];
      let stones = '';
      let nextStone = 2;
      const width0 = riverBase * (1 + 0.2 * Math.sin(r3));
      const square = Math.abs(Math.sin((cross.angle * Math.PI) / 180 - lean));
      const deck = Math.min(150, (width0 + 26) / Math.max(0.55, square));
      points.forEach((point, index) => {
        const a = points[Math.max(0, index - 1)];
        const b = points[Math.min(points.length - 1, index + 1)];
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / d;
        const ny = (b.x - a.x) / d;
        const half = point.w / 2;
        left.push(point.x + nx * half, point.y + ny * half);
        right.push(point.x - nx * half, point.y - ny * half);
        centre.push(point.x, point.y);
        flowA.push(point.x + nx * half * 0.46, point.y + ny * half * 0.46);
        flowB.push(point.x - nx * half * 0.4, point.y - ny * half * 0.4);
        riverTop = Math.min(riverTop, point.y - half);
        riverBottom = Math.max(riverBottom, point.y + half);
        // Stones on the banks, a few at a time.
        if (index >= nextStone) {
          const side = rng() < 0.5 ? -1 : 1;
          const r = (phone ? 2.6 : 3.6) + rng() * 4;
          const turn = rng() * 6.28;
          nextStone = index + 3 + Math.floor(rng() * 5);
          const sx = point.x + nx * side * (half + 1);
          const sy = point.y + ny * side * (half + 1);
          if (Math.abs(point.t) > deck / 2 + 14 && sx > -10 && sx < W + 10 && !inCard(sx, sy, -6)) {
            const corners: number[] = [];
            for (let k = 0; k < 6; k += 1) {
              const angle = turn + (k / 6) * 6.28;
              const reach = r * (0.75 + 0.5 * Math.abs(Math.sin(k * 2.1 + turn)));
              corners.push(sx + Math.cos(angle) * reach, sy + Math.sin(angle) * reach);
            }
            stones += `${polyline(corners)}Z`;
          }
        }
      });
      const back: number[] = [];
      for (let i = right.length - 2; i >= 0; i -= 2) back.push(right[i], right[i + 1]);
      river = {
        water: `${polyline(left)}${polyline(back).replace('M', 'L')}Z`,
        deep: polyline(centre),
        deepWidth: riverBase * 0.38,
        flow: polyline(flowA) + polyline(flowB),
        stones
      };
      bridge = { x: cross.x, y: cross.y, angle: cross.angle - 90, w: roadW + 12, len: deck };
    }
  }
  /** Distance from a point to the water's edge (negative in the water). */
  const riverGap = (x: number, y: number) => {
    if (!river || y < riverTop - 90 || y > riverBottom + 90) return Infinity;
    let nearest = Infinity;
    for (const point of riverPts) {
      const d = Math.hypot(point.x - x, point.y - y) - point.w / 2;
      if (d < nearest) nearest = d;
    }
    return nearest;
  };

  /* ---------- grandstand beside the straight, just past the finish line ---------- */
  const standW = W >= 768 ? clamp(60 * unit, 52, 72) : 38;
  const standTileH = (standW * SPRITES.stand[1]) / SPRITES.stand[0];
  const standTiles = 2;
  const stand = {
    x: W / 2 + roadW / 2 + (W >= 768 ? 30 : 22),
    y: track.finishY + 22,
    w: standW,
    h: standTileH * standTiles + 4 * (standTiles - 1),
    tiles: standTiles,
    tileH: standTileH
  };

  /* ---------- crescent moon past the finish, and the first stars of the night ---------- */
  const moon = {
    x: W / 2 + clamp(W * 0.27, 104, 430),
    y: track.finishY + (W >= 768 ? 104 : 86),
    r: clamp(25 * unit, 15, 32)
  };
  // 26 in the last 400 px before the finish (brighter towards it), 10 more around the moon.
  const starBands = ['', '', '', ''];
  const starSpot = (x: number, y: number) =>
    !inCard(x, y, 6) &&
    track.distance(x, y) > roadW / 2 + 12 &&
    !(x > stand.x - 6 && x < stand.x + stand.w + 6 && y > stand.y - 6 && y < stand.y + stand.h + 6) &&
    Math.hypot(x - moon.x, y - moon.y) > moon.r * 1.9;
  const starShape = (x: number, y: number, r: number, sparkle: boolean) => {
    if (!sparkle) return circlePath(x, y, r);
    const long = r * 2.6;
    const short = r * 0.62;
    return `M${fmt(x)} ${fmt(y - long)}L${fmt(x + short)} ${fmt(y - short)}L${fmt(x + long)} ${fmt(y)}L${fmt(x + short)} ${fmt(y + short)}L${fmt(x)} ${fmt(y + long)}L${fmt(x - short)} ${fmt(y + short)}L${fmt(x - long)} ${fmt(y)}L${fmt(x - short)} ${fmt(y - short)}Z`;
  };
  for (const [wanted, below] of [
    [26, false],
    [10, true]
  ] as const) {
    let placed = 0;
    for (let tries = 0; tries < 400 && placed < wanted; tries += 1) {
      const up = rng() * (below ? ROAD_TAIL - 50 : 400);
      const x = 10 + rng() * (W - 20);
      const size = rng();
      const y = below ? track.finishY + 16 + up : track.finishY - up;
      if (!starSpot(x, y)) continue;
      placed += 1;
      starBands[below ? 3 : Math.min(2, Math.floor(up / 134))] += starShape(x, y, 1.2 + size * 1.2, size > 0.76);
    }
  }
  const stars = starBands.map((d, index) => ({ d, o: [0.95, 0.75, 0.5, 1][index] })).filter(star => star.d);

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

  /** Inside the village fence (set once the village is laid out)? */
  let villageHit: (x: number, y: number, pad: number) => boolean = () => false;
  /** Room for a piece of this footprint at (x, y)? */
  const free = (x: number, y: number, rad: number) => {
    if (y > limitY) return false;
    // Cards: the whole footprint stays CARD_GAP px clear of them, so no sprite is cut by a card
    // edge. Phones keep the old rule: the cards fill the width and the map only shows between them.
    if (inCard(x, y, phone ? 2 : CARD_GAP + rad)) return false;
    // Hero title, lede, numbers and buttons: the footprint stays CALM_GAP px away from each box.
    if (inRects(calm, x, y, CALM_GAP + rad)) return false;
    if (track.distance(x, y) < roadW / 2 + 10 + rad * 0.85) return false;
    if (riverGap(x, y) < 8 + rad * 0.75) return false;
    if (cliffHit(x, y, rad * 0.6 + 4)) return false;
    if (x > stand.x - rad && x < stand.x + stand.w + rad && y > stand.y - rad && y < stand.y + stand.h + rad) return false;
    if (Math.hypot(x - moon.x, y - moon.y) < moon.r + rad + 10) return false;
    if (inCove(x, y, rad * 0.7 + 6) || inSea(x, y, rad * 0.75 + 8)) return false;
    if (villageHit(x, y, rad * 0.75 + 10)) return false;
    return true;
  };

  /* ---------- village: an irregular cluster around a sand plaza, wrapped by a fence ---------- */
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
          inCard(x, y, 14 + step / 2) || track.distance(x, y) < roadW / 2 + 20 + step * 0.7 || cliffHit(x, y, 30) || riverGap(x, y) < 46 ? 1 : 0;
        sums[(j + 1) * (cols + 1) + i + 1] = busy + sums[j * (cols + 1) + i + 1] + sums[(j + 1) * (cols + 1) + i] - sums[j * (cols + 1) + i];
      }
    }
    const busyIn = (i0: number, j0: number, i1: number, j1: number) =>
      sums[j1 * (cols + 1) + i1] - sums[j0 * (cols + 1) + i1] - sums[j1 * (cols + 1) + i0] + sums[j0 * (cols + 1) + i0];
    const sizes: [number, number][] = [];
    for (const hw of W >= 1440 ? [430, 380, 340, 280, 225, 175, 130] : desktop ? [340, 280, 225, 175, 130] : [225, 175, 130, 100]) {
      for (const hh of [170, 150, 132, 114, 100, 88, 78]) sizes.push([hw * unit, hh * unit]);
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
    // Its own number stream: the village does not change when something else on the map does.
    const vr = mulberry32(SCENERY_SEED ^ 0x7f4a7c15 ^ Math.imul(wr, 0x85ebca6b));
    const { left, right, top, bottom } = villageRect;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const hw = (right - left) / 2;
    const hh = (bottom - top) / 2;
    // Houses stop growing at 1.1: on very wide screens the village gets more houses, not bigger ones.
    const hs = Math.min(unit, 1.1) * 1.08;
    const street = 13 * hs;
    // The village is a rounded shape (a superellipse) inside that rectangle: below 1 = inside.
    const POWER = 2.6;
    const norm = (x: number, y: number, kx = 1, ky = 1) =>
      Math.pow(Math.abs(x - cx) / (hw * kx), POWER) + Math.pow(Math.abs(y - cy) / (hh * ky), POWER);
    const inside = (x: number, y: number, rad: number, limit: number) =>
      norm(x - rad, y) < limit && norm(x + rad, y) < limit && norm(x, y - rad) < limit && norm(x, y + rad) < limit;

    // Sand plaza with the church, a little off square.
    const plazaRx = Math.min(hw * 0.3, 78 * hs);
    const plazaRy = Math.min(hh * 0.66, 62 * hs);
    const plaza = blob(cx, cy, plazaRx / 1.14, plazaRy / 1.14, vr() * 6.28, vr() * 6.28, vr() * 6.28);
    const churchS = Math.min(1.32 * Math.min(unit, 1), (plazaRy * 2 + 10) / 74);
    // Upright, like every building: its front wall faces down the page.
    add('church', cx + (vr() - 0.5) * plazaRx * 0.2, cy - churchS * 4, churchS, (vr() - 0.5) * 3, true);
    add('flowers', cx - plazaRx * 0.66, cy + plazaRy * 0.5, hs, 20, true);
    add('flowers', cx + plazaRx * 0.62, cy - plazaRy * 0.52, hs, -30, true);
    add('tree2', cx - plazaRx * 0.7, cy - plazaRy * 0.5, 0.74 * hs, -15, true);
    add('tree2', cx + plazaRx * 0.72, cy + plazaRy * 0.5, 0.84 * hs, 12, true);

    // Curved dirt streets out of the plaza, through the fence.
    const lanePts: number[] = [];
    let streets = '';
    const lane = (ax: number, ay: number, qx: number, qy: number, bx: number, by: number) => {
      streets += `M${fmt(ax)} ${fmt(ay)}Q${fmt(qx)} ${fmt(qy)} ${fmt(bx)} ${fmt(by)}`;
      for (let i = 0; i <= 14; i += 1) {
        const t = i / 14;
        const u = 1 - t;
        lanePts.push(u * u * ax + 2 * u * t * qx + t * t * bx, u * u * ay + 2 * u * t * qy + t * t * by);
      }
    };
    const bendA = (vr() - 0.5) * hh * 0.7;
    const bendB = (vr() - 0.5) * hh * 0.7;
    const sideUp = vr() < 0.5 ? -1 : 1;
    lane(cx - plazaRx * 0.5, cy, cx - hw * 0.55, cy + bendA, cx - hw - 12, cy + bendA * 0.5);
    lane(cx + plazaRx * 0.5, cy, cx + hw * 0.55, cy + bendB, cx + hw + 12, cy + bendB * 0.5);
    lane(cx + sideUp * plazaRx * 0.3, cy - plazaRy * 0.4, cx + sideUp * hw * 0.16, cy - hh * 0.7, cx + sideUp * hw * 0.34, cy - hh - 10);
    lane(cx - sideUp * plazaRx * 0.3, cy + plazaRy * 0.4, cx - sideUp * hw * 0.2, cy + hh * 0.7, cx - sideUp * hw * 0.4, cy + hh + 10);
    const offLanes = (x: number, y: number, gap: number) => {
      for (let i = 0; i < lanePts.length; i += 2) {
        if (Math.hypot(lanePts[i] - x, lanePts[i + 1] - y) < gap) return false;
      }
      return true;
    };
    const offPlaza = (x: number, y: number, rad: number) =>
      Math.pow((x - cx) / (plazaRx + rad), 2) + Math.pow((y - cy) / (plazaRy + rad), 2) > 1;

    // Same draws as the old ring fence took, so the houses stay where they were.
    vr();
    vr();

    // Houses: thrown at random inside the village, each with its own size and look, all upright
    // (3 degrees of lean at most). Not on the plaza, not on a street, not on each other.
    const houseCap = W >= 1440 ? 30 : desktop ? 22 : 12;
    let houses = 0;
    for (let i = 0; i < 1100 && houses < houseCap; i += 1) {
      const x = cx + (vr() * 2 - 1) * hw;
      const y = cy + (vr() * 2 - 1) * hh;
      const kind = vr();
      const size = vr();
      const turn = vr();
      const id: PieceId = kind < 0.26 ? 'house-sq' : kind < 0.5 ? 'house-l' : kind < 0.74 ? 'house-long' : 'house';
      const s = hs * (0.86 + 0.5 * size * size);
      const rad = FOOT[id] * s;
      if (!inside(x, y, rad * 0.9, 0.8) || !offPlaza(x, y, rad * 0.9) || !offLanes(x, y, street / 2 + rad * 0.82)) continue;
      if (crowded(x, y, rad, 0.9)) continue;
      add(id, x, y, s, (turn - 0.5) * 6, true);
      houses += 1;
    }
    // Trees, bushes, flower beds and short hedges in the lots between them.
    const lotMix: Mix = [['hedge', 20], ['flowers', 22], ['tree2', 24], ['bush', 14], ['bushes', 12], ['tree', 8]];
    let lots = 0;
    for (let i = 0; i < 260 && lots < Math.round(houses * 0.6) + 3; i += 1) {
      const x = cx + (vr() * 2 - 1) * hw;
      const y = cy + (vr() * 2 - 1) * hh;
      const id = pick(lotMix, vr());
      const size = vr();
      const turn = vr();
      const s = hs * (id === 'hedge' ? 0.8 + size * 0.3 : 0.62 + size * 0.34);
      const rad = FOOT[id] * s;
      if (!inside(x, y, rad, 0.86) || !offPlaza(x, y, rad * 0.6) || !offLanes(x, y, street / 2 + rad * 0.7)) continue;
      if (crowded(x, y, rad, 0.9)) continue;
      add(id, x, y, s, id === 'hedge' ? (turn < 0.5 ? 0 : 90) : turnOf(id, turn, size), true);
      lots += 1;
    }
    // Wooden fence along the front and the back of the village (upright runs of three panels
    // that follow the edge), open where a street leaves.
    // The houses are already placed: a run is skipped where it would cross one (the houses
    // claim the ground first), and where it would land on another run (doubled posts).
    const rowW = 84 * hs;
    // Two neighbouring runs share their end post, like the panels inside a run.
    const rowStep = 81 * hs;
    const rowHalfH = (KIT_PARTS.fence[0].ry + 2) * hs;
    const buildings = pieces.filter(piece => piece.id.startsWith('house') || piece.id === 'church');
    const runs: { x: number; y: number }[] = [];
    for (const side of [-1, 1]) {
      const span = Math.max(0, Math.floor((hw * 1.24) / rowStep));
      for (let k = 0; k < span; k += 1) {
        const x = cx + (k - (span - 1) / 2) * rowStep;
        const y = cy + side * hh * 0.97 * Math.pow(1 - Math.pow(Math.abs(x - cx) / hw, POWER), 1 / POWER);
        if (!offLanes(x, y, street / 2 + rowW * 0.55)) continue;
        // A run in front of a house (lower on the page) is drawn over it: not within the house's
        // footprint. A run behind a house simply passes behind its roof.
        if (buildings.some(b => Math.abs(b.x - x) < rowW / 2 + b.rad * 0.8 && y > b.y - 2 && y - b.y < b.rad + rowHalfH + 2)) continue;
        if (runs.some(run => Math.abs(run.x - x) < rowW * 0.9 && Math.abs(run.y - y) < rowHalfH * 2 + 4)) continue;
        runs.push({ x, y });
        add('fence-row', x, y, hs, 0, true);
      }
    }
    village = { plaza, streets, streetWidth: street };
    villageHit = (x, y, pad) => norm(x, y, 1 + pad / hw, 1 + pad / hh) < 1;

    // Outskirts: a few more houses outside the fence, in whatever free ground lies next to the
    // village. On wide screens (>= 1440 px) they reach well into the free margin.
    const spillX = (W >= 1440 ? 210 : desktop ? 90 : 50) * unit;
    const spillY = (W >= 1440 ? 280 : desktop ? 110 : 60) * unit;
    const kx = 1 + spillX / hw;
    const ky = 1 + spillY / hh;
    const outCap = W >= 1440 ? 14 : desktop ? 6 : 3;
    let out = 0;
    for (let i = 0; i < 520 && out < outCap; i += 1) {
      const x = cx + (vr() * 2 - 1) * hw * kx;
      const y = cy + (vr() * 2 - 1) * hh * ky;
      const kind = vr();
      const size = vr();
      const turn = vr();
      const keep = vr();
      const id: PieceId = kind < 0.26 ? 'house-sq' : kind < 0.5 ? 'house-l' : kind < 0.74 ? 'house-long' : 'house';
      const s = hs * (0.84 + 0.4 * size);
      const rad = FOOT[id] * s;
      const reach = norm(x, y, kx, ky);
      if (reach > 1 || keep < reach * 0.55 || y > breakY - 60 || inSand(x, y)) continue;
      // Whole on the page: never cut by the edge of the screen.
      if (x < rad + 4 || x > W - rad - 4) continue;
      if (!free(x, y, rad * 1.15) || crowded(x, y, rad, 1.25)) continue;
      add(id, x, y, s, (turn - 0.5) * 6, true);
      out += 1;
    }
  }

  /* ---------- hedges: runs of clipped hedge along the road, in places ---------- */
  {
    const hs = desktop ? Math.min(unit, 1.15) : phone ? 0.62 : 0.8;
    const long = KIT_PARTS.hedge[0].rx * 2 * hs;
    const deep = (long * SPRITES.hedge[1]) / SPRITES.hedge[0];
    const offset = roadW / 2 + 8 + deep / 2;
    const first = track.gridLead + 110;
    const room = track.lenAtY(breakY - 40) - first - 300;
    const count = room > 300 ? clamp(Math.round(room / 560), 2, 8) : 0;
    for (let i = 0; i < count; i += 1) {
      const start = first + ((i + rng() * 0.7) / count) * room;
      const length = 120 + rng() * 170;
      const side = rng() < 0.5 ? -1 : 1;
      // (one more draw, as before: the numbers after this keep their place in the stream)
      rng();
      const run: number[] = [];
      for (let at = start + long / 2; at <= start + length; at += long * 0.9) {
        const p = track.at(at);
        const a = (p.angle * Math.PI) / 180;
        const x = p.x - Math.sin(a) * side * offset;
        const y = p.y + Math.cos(a) * side * offset;
        if (
          x < 6 ||
          x > W - 6 ||
          inCard(x, y, deep + 12) ||
          inRects(calm, x, y, deep + CALM_GAP) ||
          inSand(x, y) ||
          inSea(x, y, deep + 6) ||
          inCove(x, y, deep + 6) ||
          riverGap(x, y) < deep + 14 ||
          cliffHit(x, y, deep + 4) ||
          villageHit(x, y, deep + 6)
        ) {
          run.length = 0;
          break;
        }
        // Lit side up: the sprite never ends upside down.
        const turn = ((((p.angle + 90) % 180) + 180) % 180) - 90;
        run.push(x, y, turn);
      }
      for (let k = 0; k < run.length; k += 3) add('hedge', run[k], run[k + 1], hs, run[k + 2], true);
    }
  }

  /* ---------- clearings: open ground with no trees; in the fields zones, a crop field in the middle ---------- */
  const clearings: { x: number; y: number; r: number; a: number }[] = [];
  {
    const count = clamp(Math.round((W * H) / 760000), 2, 10);
    for (let i = 0; i < count; i += 1) {
      const x = rng() * W;
      const y = H * 0.2 + rng() * Math.max(1, limitY - H * 0.2);
      const r = (92 + rng() * 76) * unit * (phone ? 0.62 : 1);
      const a = rng() * 6.28;
      const kind = rng();
      const size = rng();
      const turn = rng();
      if (inSand(x, y)) continue;
      clearings.push({ x, y, r, a });
      // Crop fields read as wooden pallets at this scale: clearings stay as open grass.
      void kind;
      void size;
      void turn;
    }
  }
  const inClearing = (x: number, y: number, rad: number) =>
    clearings.some(c => {
      const dx = x - c.x;
      const dy = y - c.y;
      return Math.hypot(dx, dy) < c.r * (1 + 0.16 * Math.sin(Math.atan2(dy, dx) * 3 + c.a)) + rad * 0.4;
    });

  // Boats out on the water.
  for (const u of [0.16, 0.74]) {
    const x = seaR * u + (rng() - 0.5) * 60;
    const depth = seaDepth(x);
    const turn = -35 + rng() * 70;
    const y = Math.max(NAV_H + 22, depth * 0.42);
    if (depth > 96 && y < depth - 40 && !phone) add(u < 0.5 ? 'boat' : 'rowboat', x, y, 1.1 * unit, turn);
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
    add(id, px, py, s, turnOf(id, u, v));
  }

  // Fallen rocks along the foot of the cliff.
  if (cliff) {
    for (let x = -10 + rng() * 40; x < W + 10; ) {
      const u = rng();
      const v = rng();
      const s = unit * (0.9 + v * 0.8);
      const id: PieceId = u < 0.5 ? 'rock' : 'rock2';
      const at = clamp(Math.round((x + 24) / CS), 0, cliffN - 1);
      const depth = cliffDepths[at];
      const y = cliffTops[at] + depth + 9 + FOOT[id] * s * 0.45;
      if (depth > cliffDeep * 0.45 && !inCard(x, y, CARD_GAP + CLIFF_ROCK_GAP + FOOT[id] * s) && track.distance(x, y) > roadW / 2 + 20 && !crowded(x, y, FOOT[id] * s, 0.8)) {
        add(id, x, y, s, turnOf(id, u, v), true);
      }
      x += (48 + u * 74) * unit;
    }
  }

  // Big single trees, groves and woods first, then single pieces in the room that is left.
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
        // Sizes: single trees from 0.85 to 1.6 (most of them small, a few large), landmark
        // trees 1 to 1.6, groves 0.8 to 1.3, beach and garden things close to 1.
        const s = unit * (LANDMARK.has(id) ? 1 + v * 0.6 : big ? 0.8 + v * 0.5 : SINGLE_TREE.has(id) ? 0.85 + 0.75 * v * v : 0.85 + v * 0.35);
        const rad = FOOT[id] * s;
        if (inClearing(x, y, rad) && !GROUND_COVER.has(id)) continue;
        if (!free(x, y, rad) || crowded(x, y, rad, zone.pack)) continue;
        add(id, x, y, s, turnOf(id, u, v));
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

  // Painter's order: pieces lower on the page overlap the ones above.
  kept.sort((a, b) => a.y - b.y);

  // Ground shadows: one ellipse per sprite, offset down and to the right whatever the piece's
  // turn. All of them go in two paths (a wide faint one and a tighter one) under the pieces.
  const shadows = { soft: '', core: '', tailSoft: '', tailCore: '' };
  for (const piece of kept) {
    const a = (piece.r * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    let soft = '';
    let core = '';
    for (const part of KIT_PARTS[piece.id]) {
      const x = piece.x + (part.x * cos - part.y * sin + part.dx) * piece.s;
      const y = piece.y + (part.x * sin + part.y * cos + part.dy) * piece.s;
      const rx = part.rx * piece.s;
      const ry = part.ry * piece.s;
      const turn = Math.abs(rx - ry) < rx * 0.2 ? 0 : piece.r + part.turn;
      soft += ellipsePath(x, y, rx + 2.5, ry + 2.5, turn);
      core += ellipsePath(x, y, Math.max(1, rx - 1.5), Math.max(1, ry - 1.5), turn);
    }
    if (piece.tail) {
      shadows.tailSoft += soft;
      shadows.tailCore += core;
    } else {
      shadows.soft += soft;
      shadows.core += core;
    }
  }

  const calmBox = calm.length
    ? {
        left: Math.min(...calm.map(rect => rect.left)),
        right: Math.max(...calm.map(rect => rect.right)),
        top: Math.min(...calm.map(rect => rect.top)),
        bottom: Math.max(...calm.map(rect => rect.bottom))
      }
    : null;

  return {
    sand,
    wetSand,
    shallow,
    sea,
    seaDeep,
    foam,
    foamInner,
    cove,
    coveFoam,
    patches,
    cliff,
    village,
    river,
    bridge,
    stand,
    shadows,
    calmBox,
    moon,
    stars,
    pieces: kept
  };
}
