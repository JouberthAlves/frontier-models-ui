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
const STEP = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const roadWidthFor = (width: number) => (width >= 1100 ? 54 : width >= 768 ? 44 : 30);

interface Lane {
  x: number;
  amp: number;
  /** Half width of the free strip the lane runs in (0 for a side margin). */
  room: number;
}

function buildWaypoints(input: TrackInput, roadW: number, gridLen: number, endY: number): { x: number; y: number }[] {
  const { width: W, blocks, contentLeft, contentRight, startY, finishY } = input;
  const edge = roadW / 2 + (W >= 768 ? 10 : 2);
  const clear = 28 + roadW / 2;
  const contentW = Math.max(1, contentRight - contentLeft);
  const points: { x: number; y: number }[] = [];
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
      push(gridX, startY);
      push(gridX, startY + gridLen);
      top = startY + gridLen;
    }
    const bottom = Math.max(block.bottom - reach, top + 24);
    const height = bottom - top;
    const bends = chosen.amp > 6 ? (height > 760 ? 2 : height > 340 ? 1 : 0) : 0;
    const offsets = bends === 2 ? [0.5, -1, 1, -0.5] : bends === 1 ? [0.5, -1, 0.5] : [0, 0];
    offsets.forEach((offset, step) => {
      if (index === 0 && step === 0) return;
      push(chosen.x + chosen.amp * offset, top + (height * step) / (offsets.length - 1));
    });
    currentX = points[points.length - 1]?.x ?? currentX;
  });

  // Finish straight, centred.
  const last = points[points.length - 1];
  const straightTop = Math.max(finishY - 20, (last?.y ?? startY) + 40);
  push(W / 2, straightTop);
  push(W / 2, Math.max(endY, straightTop + 40));
  return points;
}

/**
 * Cubic Bézier between two waypoints with vertical end tangents: control points at
 * (x0, y0 + k·dy) and (x1, y1 − k·dy). y stays monotonic for k ≤ 1, and the radius where the
 * curve leaves a waypoint is 1.5·(k·dy)² / |dx|, so wide crossings use the largest k.
 */
function controlFactor(dx: number, dy: number): number {
  return clamp(0.3 + (0.7 * Math.abs(dx)) / Math.max(1, dy), 0.3, 0.97);
}

export function buildTrack(input: TrackInput): Track {
  const roadW = roadWidthFor(input.width);
  const gridLead = Math.max(0, input.cars - 1) * CAR_SPACING + 30;
  const gridLen = gridLead + 44;
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
    const k = controlFactor(dx, dy);
    const c1y = a.y + dy * k;
    const c2y = b.y - dy * k;
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
