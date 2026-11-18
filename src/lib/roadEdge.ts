/**
 * The broken end of the road (spec-v4 §1), as plain data. The road is always broken there: it is
 * a drawing, not an animation.
 *
 * The last stretch of the finish straight is cut into slabs: a small Voronoi diagram over the
 * road strip (asphalt + kerbs), from a seed. Neighbouring slabs share their fracture line (the
 * same jagged edge on both sides), so they read as one plate that cracked. The first row stays
 * in place (the jagged edge the cars jump from); the further along, the more a slab has moved
 * away, turned, shrunk and darkened, with its shadow coming apart from it. RaceMap draws each
 * slab as a clipped piece of the real road, so every slab carries the asphalt, the centre line
 * and the kerb that were there.
 */
import { mulberry32, SCENERY_SEED } from './scenery';
import type { Track } from './track';

/** Length of road that is broken, when the finish straight is at least this long. */
export const EDGE_LEN = 240;

export interface Slab {
  /** Outline in map coordinates, where the slab was before it broke off. */
  d: string;
  /** Centre of the outline (the slab turns and shrinks around it). */
  cx: number;
  cy: number;
  /** 0 = still attached to the road, 1 = the furthest one. */
  k: number;
  /** How far it has moved, turned (degrees) and shrunk. */
  dx: number;
  dy: number;
  rot: number;
  scale: number;
  /** 1 = as lit as the road, down to 0.45 for the furthest one. */
  bright: number;
  /** Offset of its shadow: grows as the slab falls away. */
  shadowX: number;
  shadowY: number;
  /** Seconds: start of its slow sway (only the loose ones sway). */
  delay: number;
}

export interface Grit {
  x: number;
  y: number;
  r: number;
  o: number;
}

export interface KerbChip {
  d: string;
  red: boolean;
  o: number;
}

export interface RoadEdge {
  /** Track length where the slabs start: the whole road is drawn up to here. */
  startLen: number;
  /** Track length of the jagged edge: the cars jump from here. */
  jumpLen: number;
  /** `d` of the area the whole road is kept to (everything before `startLen`). */
  keep: string;
  slabs: Slab[];
  gravel: Grit[];
  chips: KerbChip[];
  /** Box of the drawing, in map coordinates (it may be clipped by the page width). */
  top: number;
  bottom: number;
}

type Point = [number, number];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const fmt = (value: number) => value.toFixed(1);

/** Keeps the side of the polygon nearer to `a` than to `b` (Sutherland–Hodgman, one half-plane). */
function clipNearer(polygon: Point[], a: Point, b: Point): Point[] {
  const nx = b[0] - a[0];
  const ny = b[1] - a[1];
  const limit = (nx * (a[0] + b[0]) + ny * (a[1] + b[1])) / 2;
  const side = (p: Point) => nx * p[0] + ny * p[1] - limit;
  const out: Point[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    const sp = side(p);
    const sq = side(q);
    if (sp <= 0) out.push(p);
    if (sp < 0 !== sq < 0 && sp !== 0 && sq !== 0) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

export function buildRoadEdge(track: Track, width: number): RoadEdge {
  const rng = mulberry32(SCENERY_SEED ^ 0x3c6ef372 ^ Math.round(width / 50));
  const end = track.at(track.length);
  const heading = (end.angle * Math.PI) / 180;
  // Along the road and across it (the finish straight is a straight line).
  const ax = Math.cos(heading);
  const ay = Math.sin(heading);
  const nx = -ay;
  const ny = ax;

  // How much of the end really is straight (it normally is: the straight is 270 px long).
  let len = 40;
  for (let s = 48; s <= EDGE_LEN; s += 8) {
    const p = track.at(track.length - s);
    if (Math.abs((p.x - end.x) * nx + (p.y - end.y) * ny) > 0.75) break;
    len = s;
  }
  const startLen = track.length - len;
  const start = track.at(startLen);
  // Local frame: s along the road from `start` (0..len), t across it (±half).
  const world = (s: number, t: number): Point => [start.x + ax * s + nx * t, start.y + ay * s + ny * t];
  const half = track.roadW / 2 + 5;
  const wide = half * 2 >= 54;

  /* ---------- sites: jittered rows across the strip ---------- */
  const rowH = wide ? 40 : 30;
  const rows = Math.max(2, Math.round(len / rowH));
  const step = len / rows;
  const sites: Point[] = [];
  for (let row = 0; row < rows; row += 1) {
    // Mostly two slabs side by side; now and then one slab takes the whole width.
    const single = wide ? row % 3 === 2 : row % 2 === 1;
    const s = () => (row + 0.5 + (rng() - 0.5) * 0.44) * step;
    if (single) {
      sites.push([s(), (rng() - 0.5) * half * 0.6]);
    } else {
      const lean = (rng() - 0.5) * half * 0.36;
      sites.push([s(), -half * 0.5 + lean + (rng() - 0.5) * half * 0.2]);
      sites.push([s(), half * 0.5 + lean + (rng() - 0.5) * half * 0.2]);
    }
  }

  /* ---------- fracture lines: the same jagged edge for the two slabs that share it ---------- */
  const onBorder = (a: Point, b: Point) =>
    (Math.abs(Math.abs(a[1]) - half) < 0.05 && Math.abs(a[1] - b[1]) < 0.05) ||
    (a[0] < 0.05 && b[0] < 0.05) ||
    (a[0] > len - 0.05 && b[0] > len - 0.05);
  const jagged = (a: Point, b: Point): Point[] => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 14 || onBorder(a, b)) return [];
    // Always computed from the same end, so both neighbours get the same points.
    const flip = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
    const p = flip ? b : a;
    const q = flip ? a : b;
    const key = Math.round(p[0] * 2) * 73856093 + Math.round(p[1] * 2) * 19349663 + Math.round(q[0] * 2) * 83492791 + Math.round(q[1] * 2) * 2971;
    const local = mulberry32(SCENERY_SEED ^ (key | 0));
    const count = length > 34 ? 2 : 1;
    const px = -(q[1] - p[1]) / length;
    const py = (q[0] - p[0]) / length;
    const points: Point[] = [];
    for (let i = 1; i <= count; i += 1) {
      const t = (i + (local() - 0.5) * 0.3) / (count + 1);
      const push = (local() < 0.5 ? -1 : 1) * (1.6 + local() * Math.min(3.4, length * 0.1));
      points.push([p[0] + (q[0] - p[0]) * t + px * push, p[1] + (q[1] - p[1]) * t + py * push]);
    }
    return flip ? points.reverse() : points;
  };

  /* ---------- slabs ---------- */
  const strip: Point[] = [
    [0, -half],
    [len, -half],
    [len, half],
    [0, half]
  ];
  const slabs: Slab[] = [];
  sites.forEach((site, index) => {
    let cell = strip;
    sites.forEach((other, otherIndex) => {
      if (otherIndex !== index && cell.length) cell = clipNearer(cell, site, other);
    });
    if (cell.length < 3) return;
    const outline: Point[] = [];
    cell.forEach((p, i) => {
      outline.push(p, ...jagged(p, cell[(i + 1) % cell.length]));
    });
    const points = outline.map(p => world(p[0], p[1]));
    const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
    // The first row stays where it is; from there on, further and further adrift.
    const k = clamp((site[0] - step) / Math.max(1, len - step * 1.5), 0, 1);
    const along = k > 0 ? 3 + 11 * k + 150 * Math.pow(k, 1.7) * (0.8 + rng() * 0.4) : 0;
    const across = (rng() - 0.5) * 2 * (8 + 62 * k) * k;
    const moved: Point = [ax * along + nx * across, ay * along + ny * across];
    // Never past the edge of the page.
    moved[0] = clamp(cx + moved[0], 26, Math.max(26, width - 26)) - cx;
    slabs.push({
      d: `M${points.map(p => `${fmt(p[0])} ${fmt(p[1])}`).join('L')}Z`,
      cx,
      cy,
      k,
      dx: moved[0],
      dy: moved[1],
      rot: (rng() - 0.5) * 2 * (5 + 40 * k) * k,
      scale: 1 - 0.45 * k,
      bright: 1 - 0.55 * k,
      shadowX: 3 + 20 * k,
      shadowY: 5 + 40 * k,
      delay: -rng() * 6
    });
  });

  /* ---------- gravel and kerb chips in the gaps ---------- */
  const gravel: Grit[] = [];
  const grains = wide ? 18 : 12;
  for (let i = 0; i < grains; i += 1) {
    const s = step * 0.9 + rng() * (len * 1.25 - step * 0.9);
    const k = clamp(s / (len * 1.25), 0, 1);
    const [x, y] = world(s, (rng() - 0.5) * (half * 2 + 80 * k));
    gravel.push({ x: clamp(x, 8, width - 8), y, r: 0.5 + rng(), o: 0.85 - 0.5 * k });
  }
  const chips: KerbChip[] = [];
  for (let i = 0; i < 3; i += 1) {
    const s = step * 1.3 + ((i + rng() * 0.8) / 3) * (len - step * 0.6);
    const k = clamp(s / len, 0, 1);
    const side = i % 2 ? 1 : -1;
    const [x, y] = world(s, side * (half + 4 + rng() * 22 * k));
    const turn = rng() * 6.2832;
    const size = 2.6 + rng() * 2.2;
    const corners: Point[] = [0, 1, 2, 3].map(corner => {
      const angle = turn + corner * 1.5708 + (rng() - 0.5) * 0.5;
      const reach = size * (corner % 2 ? 0.55 : 1) * (0.8 + rng() * 0.4);
      return [clamp(x, 10, width - 10) + Math.cos(angle) * reach, y + Math.sin(angle) * reach];
    });
    chips.push({ d: `M${corners.map(p => `${fmt(p[0])} ${fmt(p[1])}`).join('L')}Z`, red: i !== 1, o: 0.95 - 0.45 * k });
  }

  // Everything before the slabs (2 px under them, so no seam shows): a wide box behind the cut.
  const reach = width * 2 + 400;
  const back = track.length + width + 4000;
  const cut = world(2, 0);
  const keep = `M${[
    [cut[0] + nx * reach, cut[1] + ny * reach],
    [cut[0] - nx * reach, cut[1] - ny * reach],
    [cut[0] - nx * reach - ax * back, cut[1] - ny * reach - ay * back],
    [cut[0] + nx * reach - ax * back, cut[1] + ny * reach - ay * back]
  ]
    .map(p => `${fmt(p[0])} ${fmt(p[1])}`)
    .join('L')}Z`;

  return {
    startLen,
    jumpLen: startLen + step * 0.8,
    keep,
    slabs,
    gravel,
    chips,
    top: Math.floor(Math.min(start.y, end.y) - 24),
    bottom: Math.ceil(Math.max(start.y, end.y) + 300)
  };
}
