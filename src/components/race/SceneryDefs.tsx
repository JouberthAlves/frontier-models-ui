/**
 * The scenery kit: one <symbol> per piece, all drawn top-down around (0, 0), flat pastel shapes
 * with a soft shadow offset down and to the right (spec-v2 §3.2). Colors come from the --map-*
 * tokens through the `mf-*` classes in RaceMap.css. Add a piece here, give it an id in
 * `PieceId` (src/lib/scenery.ts) and list it in a zone there.
 */

const f = (value: number) => value.toFixed(1);

/** Star of leaf-shaped petals (palm crowns). */
function petals(count: number, length: number, spread: number, rotation: number, dx = 0, dy = 0): string {
  let d = '';
  for (let i = 0; i < count; i += 1) {
    const a = rotation + (i / count) * Math.PI * 2;
    const tipX = dx + Math.cos(a) * length;
    const tipY = dy + Math.sin(a) * length;
    const c1x = dx + Math.cos(a - spread) * length * 0.6;
    const c1y = dy + Math.sin(a - spread) * length * 0.6;
    const c2x = dx + Math.cos(a + spread) * length * 0.6;
    const c2y = dy + Math.sin(a + spread) * length * 0.6;
    d += `M${f(dx)} ${f(dy)}Q${f(c1x)} ${f(c1y)} ${f(tipX)} ${f(tipY)}Q${f(c2x)} ${f(c2y)} ${f(dx)} ${f(dy)}Z`;
  }
  return d;
}

/** Pointed star polygon (conifers seen from above). */
function spikes(count: number, outer: number, inner: number, dx = 0, dy = 0): string {
  let d = '';
  for (let i = 0; i < count * 2; i += 1) {
    const a = (i / (count * 2)) * Math.PI * 2;
    const r = i % 2 ? inner : outer;
    d += `${i ? 'L' : 'M'}${f(dx + Math.cos(a) * r)} ${f(dy + Math.sin(a) * r)}`;
  }
  return `${d}Z`;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;

const blobs = (list: [number, number, number][], dx = 0, dy = 0) =>
  list.map(([cx, cy, r]) => circle(cx + dx, cy + dy, r)).join('');

const PALM = petals(7, 19, 0.5, 0.2);
const PALM_SHADOW = petals(7, 19, 0.5, 0.2, 4, 5);
const PALM_CORE = petals(7, 10, 0.42, 0.65);
const PALM2 = petals(6, 17, 0.56, 0.9);
const PALM2_SHADOW = petals(6, 17, 0.56, 0.9, 4, 5);
const PALM2_CORE = petals(6, 9, 0.46, 0.4);
const PINE = spikes(8, 15, 8.5);
const PINE_SHADOW = spikes(8, 15, 8.5, 4, 5);
const PINE_CORE = spikes(8, 8, 4.5, -1, -1);
const DENSE: [number, number, number][] = [
  [-7, 3, 11],
  [7, 4, 10],
  [0, -6, 11]
];
const DENSE_TOP: [number, number, number][] = [
  [-8, 1, 6],
  [6, 2, 5.5],
  [-1, -8, 6.5]
];
const BUSH: [number, number, number][] = [
  [-5, 1, 7],
  [5, 2, 6],
  [0, -3, 6.5]
];
const WEDGES = [0, 90, 180, 270]
  .map(deg => {
    const a = (deg * Math.PI) / 180;
    const b = ((deg + 45) * Math.PI) / 180;
    return `M0 0L${f(Math.cos(a) * 13)} ${f(Math.sin(a) * 13)}A13 13 0 0 1 ${f(Math.cos(b) * 13)} ${f(Math.sin(b) * 13)}Z`;
  })
  .join('');

/** Number of elements this component renders (kept in sync by hand; used for the SVG budget). */
export const SCENERY_DEF_ELEMENTS = 77;

export default function SceneryDefs() {
  return (
    <>
      <symbol id="sc-palm" overflow="visible">
        <path d={PALM_SHADOW} className="mf-shadow" />
        <path d={PALM} className="mf-tree" />
        <path d={PALM_CORE} className="mf-tree-2" />
        <circle r="2.6" className="mf-trunk" />
      </symbol>
      <symbol id="sc-palm2" overflow="visible">
        <path d={PALM2_SHADOW} className="mf-shadow" />
        <path d={PALM2} className="mf-tree-2" />
        <path d={PALM2_CORE} className="mf-tree" />
        <circle r="2.4" className="mf-trunk" />
      </symbol>
      <symbol id="sc-tree" overflow="visible">
        <circle cx="4" cy="5" r="15" className="mf-shadow" />
        <circle r="15" className="mf-tree-2" />
        <circle cx="-3" cy="-3" r="10" className="mf-tree" />
      </symbol>
      <symbol id="sc-tree2" overflow="visible">
        <circle cx="4" cy="5" r="12.5" className="mf-shadow" />
        <circle r="12.5" className="mf-tree" />
        <circle cx="-2.5" cy="-2.5" r="7.5" className="mf-grass-dark" />
      </symbol>
      <symbol id="sc-pine" overflow="visible">
        <path d={PINE_SHADOW} className="mf-shadow" />
        <path d={PINE} className="mf-tree-2" />
        <path d={PINE_CORE} className="mf-tree" />
      </symbol>
      <symbol id="sc-dense" overflow="visible">
        <path d={blobs(DENSE, 4, 5)} className="mf-shadow" />
        <path d={blobs(DENSE)} className="mf-tree-2" />
        <path d={blobs(DENSE_TOP)} className="mf-tree" />
      </symbol>
      <symbol id="sc-bush" overflow="visible">
        <ellipse cx="3" cy="4" rx="12" ry="9" className="mf-shadow" />
        <path d={blobs(BUSH)} className="mf-tree" />
      </symbol>
      <symbol id="sc-house" overflow="visible">
        <rect x="-12" y="-7" width="32" height="24" rx="3" className="mf-shadow" />
        <rect x="-16" y="-12" width="32" height="24" rx="3" className="mf-wall" />
        <rect x="-15" y="-11" width="30" height="11" rx="2" className="mf-roof" />
        <rect x="-15" y="0" width="30" height="11" rx="2" className="mf-roof-2" />
        <rect x="-15" y="-0.8" width="30" height="1.6" className="mf-ridge" />
      </symbol>
      <symbol id="sc-house-v" overflow="visible">
        <rect x="-8" y="-11" width="24" height="32" rx="3" className="mf-shadow" />
        <g transform="rotate(90)">
          <rect x="-16" y="-12" width="32" height="24" rx="3" className="mf-wall" />
          <rect x="-15" y="-11" width="30" height="11" rx="2" className="mf-roof-2" />
          <rect x="-15" y="0" width="30" height="11" rx="2" className="mf-roof" />
          <rect x="-15" y="-0.8" width="30" height="1.6" className="mf-ridge" />
        </g>
      </symbol>
      <symbol id="sc-church" overflow="visible">
        <path d="M-7 -21h22v19h11v16h-11v17h-22v-17h-11v-16h11z" className="mf-shadow" />
        <rect x="-11" y="-26" width="22" height="52" rx="2" className="mf-roof" />
        <rect x="-22" y="-8" width="44" height="16" rx="2" className="mf-roof-2" />
        <path d="M0 -26V26M-22 0H22" className="mf-ridge-line" />
        <rect x="-9" y="-40" width="18" height="18" rx="2" className="mf-wall" />
        <rect x="-6" y="-37" width="12" height="12" rx="1.5" className="mf-roof-2" />
        <circle cy="-31" r="2.4" className="mf-wood" />
      </symbol>
      <symbol id="sc-fence" overflow="visible">
        <path d="M-20 3H24" className="mf-fence-shadow" />
        <path d="M-22 0H22" className="mf-fence" />
      </symbol>
      <symbol id="sc-rock" overflow="visible">
        <ellipse cx="2.5" cy="3.5" rx="10" ry="7.5" className="mf-shadow" />
        <path d="M-9 1L-6 -6L2 -8L9 -3L8 4L1 7L-6 6Z" className="mf-rock" />
      </symbol>
      <symbol id="sc-rock2" overflow="visible">
        <path d="M-9 6L-7 -2L1 -4L6 1L4 8L-4 9ZM6 -1L8 -7L14 -6L15 0L11 3Z" className="mf-shadow" />
        <path d="M-12 3L-10 -5L-2 -7L3 -2L1 5L-7 6ZM3 -4L5 -10L11 -9L12 -3L8 0Z" className="mf-rock" />
      </symbol>
      <symbol id="sc-umbrella" overflow="visible">
        <circle cx="4" cy="5" r="13" className="mf-shadow" />
        <circle r="13" className="mf-roof" />
        <path d={WEDGES} className="mf-wall" />
        <circle r="1.8" className="mf-roof-2" />
      </symbol>
      <symbol id="sc-umbrella2" overflow="visible">
        <circle cx="4" cy="5" r="12" className="mf-shadow" />
        <circle r="12" className="mf-sea-deep" />
        <path d={WEDGES} className="mf-wall" transform="scale(0.92)" />
        <circle r="1.8" className="mf-wall" />
      </symbol>
      <symbol id="sc-boat" overflow="visible">
        <path d="M-7 15q7 6 14 0" className="mf-wake" />
        <path d="M0 -15C7 -9 8 6 5 13H-5C-8 6 -7 -9 0 -15Z" className="mf-wall" />
        <rect x="-3.5" y="-4" width="7" height="11" rx="2" className="mf-wood" />
      </symbol>
      <symbol id="sc-flowers" overflow="visible">
        <ellipse rx="14" ry="9" className="mf-grass-dark" />
        <path d={blobs([[-8, -1, 2.2], [-1, 3, 2.2], [6, -2, 2.2], [2, -4, 1.8], [-4, 4, 1.8]])} className="mf-roof" />
        <path d={blobs([[-4, -3, 1.8], [4, 2, 1.8], [9, 2, 1.6], [-9, 3, 1.6]])} className="mf-wall" />
      </symbol>
    </>
  );
}
