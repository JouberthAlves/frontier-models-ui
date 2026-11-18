/**
 * Track geometry (spec-v2 §2.3). The route is computed from the real rectangles of the content
 * blocks: it runs down the free side of each block and crosses the page in the gaps between
 * them. Every segment is a cubic Bézier with vertical end tangents, so y never decreases along
 * the path (S curves, never a loop) and "target y → length" is a plain binary search.
 */

export type TrackSide = 'left' | 'right' | 'full';

export interface BlockRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  side: TrackSide;
  /** A cream card (covers the map). The hero is not one: it sits straight on the map. */
  opaque?: boolean;
}

export interface TrackInput {
  /** Page width (document client width). */
  width: number;
  /** Content blocks of the racing zone, top to bottom. The first one holds the starting grid. */
  blocks: BlockRect[];
  /** Left / right edge of the content container. */
  contentLeft: number;
  contentRight: number;
  /** y of the first grid slot. */
  startY: number;
  /** y of the finish line. */
  finishY: number;
  /** Number of cars (sizes the grid straight). */
  cars: number;
}

export interface TrackPoint {
  x: number;
  y: number;
  /** Heading in degrees (0 = pointing right, 90 = pointing down the page). */
  angle: number;
}

export interface Track {
  roadW: number;
  /** Car scale for this width. */
  carScale: number;
  length: number;
  finishLen: number;
  finishY: number;
  /** y where the road ends (past the finish line). */
  endY: number;
  /** Length of the leading car when it waits on the grid. */
  gridLead: number;
  lenAtY: (y: number) => number;
  at: (length: number) => TrackPoint;
  /** Polyline `d` between two lengths (for drawing). */
  slice: (from: number, to: number) => string;
  /** Distance from a point to the centre line. */
  distance: (x: number, y: number) => number;
}

/** px between cars along the track. */
export const CAR_SPACING = 58;
/** px of road after the finish line. */
export const ROAD_TAIL = 260;
/** The road enters the page from above its top edge. */
export const ROAD_LEAD_IN = 60;
/** px between two samples of the centre line. */
export const TRACK_STEP = 4;
const STEP = TRACK_STEP;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 54 px needs a 72 px side margin beside the full-width block; below 1250 px the road is 44. */
export const roadWidthFor = (width: number) => (width >= 1250 ? 54 : width >= 768 ? 44 : 30);

interface Lane {
  x: number;
  amp: number;
  /** Half width of the free strip the lane runs in (0 for a side margin). */
  room: number;
}

interface Waypoint {
  x: number;
  y: number;
  /** Control factors of the curve that arrives here (leaving / arriving); default: one k for both. */
  k?: [number, number];
}

function buildWaypoints(input: TrackInput, roadW: number, gridLen: number, endY: number): Waypoint[] {
  const { width: W, blocks, contentLeft, contentRight, startY, finishY } = input;
  // Half road + 5 px kerb + a little air, so the kerb is never cut by the screen edge.
  const edge = roadW / 2 + (W >= 768 ? 10 : 7);
  const clear = 28 + roadW / 2;
  const contentW = Math.max(1, contentRight - contentLeft);
  const points: Waypoint[] = [];
  let lastReach = 0;
  let lastRoom = 0;
  let lastLaneX = 0;
  let currentX = W - edge;
  let previousFull = false;

  const push = (x: number, y: number) => {
    const last = points[points.length - 1];
    const safeX = clamp(x, edge, W - edge);
    if (last && y < last.y + 12) return;
    points.push({ x: safeX, y });
  };

  blocks.forEach((block, index) => {
    let side: TrackSide = block.right - block.left >= contentW * 0.86 ? 'full' : block.side;
    let lane: Lane | null = null;

    if (side === 'left') {
      const lo = block.right + clear;
      const hi = W - edge;
      if (hi - lo >= 0) lane = { x: (lo + hi) / 2, amp: Math.min((hi - lo) / 2, 80) * 0.75, room: (hi - lo) / 2 };
      else side = 'full';
    } else if (side === 'right') {
      const lo = edge;
      const hi = block.left - clear;
      if (hi - lo >= 0) lane = { x: (lo + hi) / 2, amp: Math.min((hi - lo) / 2, 80) * 0.75, room: (hi - lo) / 2 };
      else side = 'full';
    }

    // Full-width block: down a side margin (partly behind the block when the margin is narrow).
    const leftX = Math.max(edge, block.left / 2);
    const rightX = Math.min(W - edge, (W + block.right) / 2);
    const onLeft = currentX < W / 2;
    const goLeft = index === 0 ? false : previousFull ? !onLeft : onLeft;
    const chosen: Lane = lane ?? { x: goLeft ? leftX : rightX, amp: 0, room: 0 };
    previousFull = side === 'full';

    // With room beside the block, the crossings start a little before its bottom edge and end a
    // little after its top edge: longer, wider curves (the road is still clear of the block there).
    const reach = block.bottom - block.top > 360 ? clamp(chosen.room - 30, 0, 80) : 0;
    let top = block.top + reach;
    if (index === 0) {
      // Starting grid: a straight stretch where the cars line up.
      const gridX = chosen.x + chosen.amp * 0.5;
      // The road comes in from above the top edge of the page.
      push(gridX, -ROAD_LEAD_IN);
      push(gridX, startY + gridLen);
      top = startY + gridLen;
    }
    const bottom = Math.max(block.bottom - reach, top + 24);
    if (index === blocks.length - 1) {
      lastReach = block.bottom - bottom;
      lastRoom = chosen.room;
      lastLaneX = chosen.x;
    }
    const height = bottom - top;
    const bends = chosen.amp > 6 ? (height > 760 ? 2 : height > 340 ? 1 : 0) : 0;
    const offsets = bends === 2 ? [0.5, -1, 1, -0.5] : bends === 1 ? [0.5, -1, 0.5] : [0, 0];
    offsets.forEach((offset, step) => {
      if (index === 0 && step === 0) return;
      let x = chosen.x + chosen.amp * offset;
      // Leaving the last block: on the side of the lane nearest to the finish straight (page
      // centre), so the last curve has less ground to cover.
      if (index === blocks.length - 1 && step === offsets.length - 1) x = clamp(W / 2, chosen.x - chosen.room, chosen.x + chosen.room);
      push(x, top + (height * step) / (offsets.length - 1));
    });
    currentX = points[points.length - 1]?.x ?? currentX;
  });

  // Finish straight, centred. The last curve has little height (the finish line is close to
  // the last block) and has to turn in under that block's corner: try where it starts (beside
  // the block or lower) and how long it holds each end, and keep the widest curve that stays
  // clear of the block.
  const last = points[points.length - 1];
  const straightTop = Math.max(finishY - 10, (last?.y ?? startY) + 40);
  const block = blocks[blocks.length - 1];
  if (last && block && Math.abs(W / 2 - last.x) > 1) {
    const before = points[points.length - 2];
    const pad = roadW / 2 + 5 + 2;
    const toCentre = Math.sign(W / 2 - last.x);
    let widest = -1;
    let keptX = last.x;
    let keptY = last.y;
    let keptK: [number, number] | undefined;
    for (const back of [0, 40, 80, 120, 160]) {
      // Start further from the centre (when the lane has the room): more ground to cover, but
      // more of the turn can happen beside the block.
      const x0 = last.x - toCentre * back;
      if (back > 0 && (lastRoom <= 0 || Math.abs(x0 - lastLaneX) > lastRoom)) break;
      const dx = W / 2 - x0;
      for (const lift of [1, 0.75, 0.5, 0.25, 0, -0.25]) {
        const y0 = block.bottom - lastReach * lift;
        if (lift !== 1 && (!before || y0 < before.y + 60 || y0 > straightTop - 60)) continue;
        const dy = straightTop - y0;
        for (let k1 = 0.15; k1 <= 0.96; k1 += 0.05) {
          for (let k2 = 0.15; k2 <= 0.96; k2 += 0.05) {
            const radius = minRadius(
              dx,
              dy,
              k1,
              k2,
              (x, y) => x0 + x > block.left - pad && x0 + x < block.right + pad && y0 + y > block.top - pad && y0 + y < block.bottom + pad,
              120
            );
            if (radius > widest) {
              widest = radius;
              keptX = x0;
              keptY = y0;
              keptK = [k1, k2];
            }
          }
        }
      }
    }
    last.x = keptX;
    last.y = keptY;
    push(W / 2, straightTop);
    if (keptK) points[points.length - 1].k = keptK;
  } else {
    push(W / 2, straightTop);
  }
  push(W / 2, Math.max(endY, straightTop + 40));
  return points;
}

/**
 * Cubic Bézier between two waypoints with vertical end tangents: control points at
 * (x0, y0 + k1·dy) and (x1, y1 − k2·dy). The tightest spot can be inside the curve, so the
 * minimum radius is measured along it. Returns -1 when y would go back up, or when `blocked`
 * says a point of the curve (relative to its start) is not allowed.
 */
function minRadius(dx: number, dy: number, k1: number, k2: number, blocked?: (x: number, y: number) => boolean, samples = 48): number {
  let min = Infinity;
  const p1 = k1 * dy;
  const p2 = dy - k2 * dy;
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const u = 1 - t;
    const x1 = dx * 6 * t * u;
    const x2 = dx * (6 - 12 * t);
    const y1 = 3 * (u * u * p1 + 2 * t * u * (p2 - p1) + t * t * (dy - p2));
    const y2 = 6 * (u * (p2 - 2 * p1) + t * (dy - 2 * p2 + p1));
    if (y1 < -1e-6) return -1;
    if (blocked?.(dx * (3 * t * t - 2 * t * t * t), 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * dy)) return -1;
    const cross = Math.abs(x1 * y2 - y1 * x2);
    if (cross < 1e-6) continue;
    const radius = Math.pow(x1 * x1 + y1 * y1, 1.5) / cross;
    if (radius < min) min = radius;
  }
  return min;
}
/**
 * The k closest to the usual one (wider crossings use a larger k) that keeps the curve at or
 * above the target radius; when no k reaches it, the k with the widest curve.
 */
function controlFactor(dx: number, dy: number, target: number): number {
  const usual = clamp(0.3 + (0.7 * Math.abs(dx)) / Math.max(1, dy), 0.3, 0.97);
  let chosen = usual;
  let chosenGap = Infinity;
  let widest = usual;
  let widestRadius = -1;
  for (let k = 0.3; k <= 0.971; k += 0.02) {
    const radius = minRadius(dx, dy, k, k);
    if (radius > widestRadius) {
      widestRadius = radius;
      widest = k;
    }
    if (radius >= target && Math.abs(k - usual) < chosenGap) {
      chosenGap = Math.abs(k - usual);
      chosen = k;
    }
  }
  return chosenGap < Infinity ? chosen : widest;
}

export function buildTrack(input: TrackInput): Track {
  const roadW = roadWidthFor(input.width);
  const gridSpan = Math.max(0, input.cars - 1) * CAR_SPACING + 30;
  const gridLead = input.startY + ROAD_LEAD_IN + gridSpan;
  const gridLen = gridSpan + 44;
  const targetRadius = roadW >= 44 ? 92 : 48;
  const endY = input.finishY + ROAD_TAIL;
  const waypoints = buildWaypoints(input, roadW, gridLen, endY);

  // Flatten to a dense polyline.
  const dense: number[] = [waypoints[0].x, waypoints[0].y];
  for (let i = 1; i < waypoints.length; i += 1) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < 0.5) {
      dense.push(b.x, b.y);
      continue;
    }
    const single = b.k ? 0 : controlFactor(dx, dy, targetRadius);
    const c1y = a.y + dy * (b.k ? b.k[0] : single);
    const c2y = b.y - dy * (b.k ? b.k[1] : single);
    const steps = Math.max(8, Math.ceil((Math.abs(dx) + Math.abs(dy)) / 2));
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps;
      const u = 1 - t;
      const x = u * u * u * a.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * b.x;
      const y = u * u * u * a.y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * b.y;
      dense.push(x, y);
    }
  }

  // Resample every STEP px of arc length.
  const xs: number[] = [dense[0]];
  const ys: number[] = [dense[1]];
  let carry = 0;
  let px = dense[0];
  let py = dense[1];
  for (let i = 2; i < dense.length; i += 2) {
    const qx = dense[i];
    const qy = dense[i + 1];
    let segment = Math.hypot(qx - px, qy - py);
    while (carry + segment >= STEP) {
      const t = (STEP - carry) / segment;
      px += (qx - px) * t;
      py += (qy - py) * t;
      xs.push(px);
      ys.push(Math.max(py, ys[ys.length - 1]));
      segment = Math.hypot(qx - px, qy - py);
      carry = 0;
    }
    carry += segment;
    px = qx;
    py = qy;
  }
  const count = xs.length;
  const length = (count - 1) * STEP;

  const lenAtY = (y: number) => {
    if (y <= ys[0]) return 0;
    if (y >= ys[count - 1]) return length;
    let lo = 0;
    let hi = count - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ys[mid] < y) lo = mid;
      else hi = mid;
    }
    const span = ys[hi] - ys[lo];
    return (lo + (span > 0 ? (y - ys[lo]) / span : 0)) * STEP;
  };

  const at = (len: number): TrackPoint => {
    const f = clamp(len, 0, length) / STEP;
    const i = Math.min(count - 2, Math.floor(f));
    const t = f - i;
    const a = Math.max(0, i - 1);
    const b = Math.min(count - 1, i + 2);
    return {
      x: xs[i] + (xs[i + 1] - xs[i]) * t,
      y: ys[i] + (ys[i + 1] - ys[i]) * t,
      angle: (Math.atan2(ys[b] - ys[a], xs[b] - xs[a]) * 180) / Math.PI
    };
  };

  const slice = (from: number, to: number) => {
    const start = clamp(Math.floor(from / STEP), 0, count - 1);
    const end = clamp(Math.ceil(to / STEP), start, count - 1);
    let d = `M${xs[start].toFixed(1)} ${ys[start].toFixed(1)}`;
    // Every other sample (8 px chords) is plenty for drawing.
    for (let i = start + 2; i < end; i += 2) d += `L${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`;
    if (end > start) d += `L${xs[end].toFixed(1)} ${ys[end].toFixed(1)}`;
    return d;
  };

  const distance = (x: number, y: number) => {
    // Samples whose y is within the search window (y is monotonic).
    const window = 140;
    let i = Math.floor(lenAtY(y - window) / STEP);
    const stop = Math.min(count - 1, Math.ceil(lenAtY(y + window) / STEP));
    let nearest = Infinity;
    for (; i <= stop; i += 1) {
      const d = (xs[i] - x) * (xs[i] - x) + (ys[i] - y) * (ys[i] - y);
      if (d < nearest) nearest = d;
    }
    return Math.sqrt(nearest);
  };

  return {
    roadW,
    carScale: input.width >= 768 ? 1 : 0.62,
    length,
    finishLen: lenAtY(input.finishY),
    finishY: input.finishY,
    endY: ys[count - 1],
    gridLead,
    lenAtY,
    at,
    slice,
    distance
  };
}
