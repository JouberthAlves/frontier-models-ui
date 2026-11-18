/**
 * The scenery kit as plain data (spec-v2 §3.2): one symbol per piece, all drawn top-down around
 * (0, 0), flat pastel shapes with a soft shadow offset down and to the right. Colors come from
 * the --map-* tokens through the `mf-*` classes in RaceMap.css.
 *
 * Two kinds of symbol:
 *  - single pieces (a tree, a palm, a house…), a few shapes each;
 *  - composites (a grove, a patch of woods, a row of houses): several `use` of the single
 *    pieces. One placed composite is ONE element in the map but draws 3 to 7 pieces, which is
 *    how the map gets dense without going over the 650-element budget.
 *
 * Add a piece: describe it here, give it a footprint radius in `FOOT`, and list it in a zone of
 * `ZONES` (src/lib/scenery.ts). `SCENERY_DEF_ELEMENTS` is counted from this data.
 */

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
  | 'house-sq'
  | 'church'
  | 'rock'
  | 'rock2'
  | 'umbrella'
  | 'umbrella2'
  | 'boat'
  | 'flowers'
  | 'grove-a'
  | 'grove-b'
  | 'grove-c'
  | 'woods-a'
  | 'woods-b'
  | 'woods-c'
  | 'palms-a'
  | 'palms-b'
  | 'row-h'
  | 'row-h2'
  | 'row-v';

export interface KitShape {
  tag: 'path' | 'circle' | 'ellipse' | 'rect' | 'use';
  cls?: string;
  d?: string;
  cx?: number;
  cy?: number;
  r?: number;
  rx?: number;
  ry?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** `use` only: id of another symbol of the kit (without the `sc-` prefix). */
  href?: string;
  transform?: string;
}

export interface KitSymbol {
  id: string;
  shapes: KitShape[];
}

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
function spikes(count: number, outer: number, inner: number, dx = 0, dy = 0, rotation = 0): string {
  let d = '';
  for (let i = 0; i < count * 2; i += 1) {
    const a = rotation + (i / (count * 2)) * Math.PI * 2;
    const r = i % 2 ? inner : outer;
    d += `${i ? 'L' : 'M'}${f(dx + Math.cos(a) * r)} ${f(dy + Math.sin(a) * r)}`;
  }
  return `${d}Z`;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0Z`;

const dots = (list: [number, number, number][]) => list.map(([cx, cy, r]) => circle(cx, cy, r)).join('');

/** Fluffy canopy: a core circle with lobes around it (their union is the outline). */
function lump(cx: number, cy: number, radius: number, lobes: number, phase: number): string {
  let d = circle(cx, cy, radius * 0.72);
  for (let i = 0; i < lobes; i += 1) {
    const a = phase + (i / lobes) * Math.PI * 2;
    const wobble = 1 + 0.08 * Math.sin(i * 2.3 + phase * 3);
    d += circle(cx + Math.cos(a) * radius * 0.52 * wobble, cy + Math.sin(a) * radius * 0.52 * wobble, radius * 0.48);
  }
  return d;
}

const WEDGES = [0, 90, 180, 270]
  .map(deg => {
    const a = (deg * Math.PI) / 180;
    const b = ((deg + 45) * Math.PI) / 180;
    return `M0 0L${f(Math.cos(a) * 13)} ${f(Math.sin(a) * 13)}A13 13 0 0 1 ${f(Math.cos(b) * 13)} ${f(Math.sin(b) * 13)}Z`;
  })
  .join('');

type Part = [id: string, x: number, y: number, scale: number];

/** A composite: its parts are listed top to bottom, so the lower ones cover the shadows above. */
const group = (id: string, parts: Part[]): KitSymbol => ({
  id,
  shapes: [...parts]
    .sort((a, b) => a[2] - b[2])
    .map(([href, x, y, scale]) => ({ tag: 'use' as const, href, transform: `translate(${x} ${y}) scale(${scale})` }))
});

export const KIT: KitSymbol[] = [
  /* ---------- trees ---------- */
  {
    id: 'tree',
    shapes: [
      { tag: 'path', d: lump(5, 7, 22, 6, 0.3), cls: 'mf-shadow' },
      { tag: 'path', d: lump(0, 0, 22, 6, 0.3), cls: 'mf-tree-2' },
      { tag: 'path', d: lump(-4, -5, 13, 5, 1), cls: 'mf-tree' }
    ]
  },
  {
    id: 'tree2',
    shapes: [
      { tag: 'path', d: lump(4, 6, 18, 5, 0.9), cls: 'mf-shadow' },
      { tag: 'path', d: lump(0, 0, 18, 5, 0.9), cls: 'mf-tree' },
      { tag: 'path', d: lump(-3, -4, 10.5, 4, 0.2), cls: 'mf-grass-dark' }
    ]
  },
  {
    id: 'dense',
    shapes: [
      { tag: 'path', d: lump(5, 7, 24, 7, 0.6), cls: 'mf-shadow' },
      { tag: 'path', d: lump(0, 0, 24, 7, 0.6), cls: 'mf-tree-deep' },
      { tag: 'path', d: lump(-4, -5, 14, 5, 0.5), cls: 'mf-tree-2' }
    ]
  },
  {
    id: 'pine',
    shapes: [
      { tag: 'path', d: spikes(9, 21, 12.5, 5, 7), cls: 'mf-shadow' },
      { tag: 'path', d: spikes(9, 21, 12.5), cls: 'mf-tree-deep' },
      { tag: 'path', d: spikes(9, 12, 6.5, -1.5, -2, 0.35), cls: 'mf-tree-2' }
    ]
  },
  {
    id: 'palm',
    shapes: [
      { tag: 'path', d: petals(7, 27, 0.5, 0.2, 6, 8), cls: 'mf-shadow' },
      { tag: 'path', d: petals(7, 27, 0.5, 0.2), cls: 'mf-tree' },
      { tag: 'path', d: petals(7, 15, 0.42, 0.65), cls: 'mf-tree-2' },
      { tag: 'circle', r: 3.2, cls: 'mf-trunk' }
    ]
  },
  {
    id: 'palm2',
    shapes: [
      { tag: 'path', d: petals(6, 24, 0.56, 0.9, 6, 8), cls: 'mf-shadow' },
      { tag: 'path', d: petals(6, 24, 0.56, 0.9), cls: 'mf-tree-2' },
      { tag: 'path', d: petals(6, 13, 0.46, 0.4), cls: 'mf-tree' },
      { tag: 'circle', r: 3, cls: 'mf-trunk' }
    ]
  },
  {
    id: 'bush',
    shapes: [
      { tag: 'ellipse', cx: 3, cy: 4, rx: 13, ry: 10, cls: 'mf-shadow' },
      { tag: 'path', d: lump(0, 0, 12, 4, 0.4), cls: 'mf-tree' }
    ]
  },

  /* ---------- buildings (seen from above: two roof planes and the ridge) ---------- */
  {
    id: 'house-top',
    shapes: [
      { tag: 'rect', x: -19, y: -14, width: 38, height: 28, rx: 3, cls: 'mf-wall' },
      { tag: 'rect', x: -17, y: -12, width: 34, height: 12, rx: 1.5, cls: 'mf-roof' },
      { tag: 'rect', x: -17, y: 0, width: 34, height: 12, rx: 1.5, cls: 'mf-roof-2' },
      { tag: 'rect', x: -17, y: -1, width: 34, height: 2, cls: 'mf-ridge' }
    ]
  },
  {
    id: 'house',
    shapes: [
      { tag: 'rect', x: -14, y: -8, width: 38, height: 28, rx: 3, cls: 'mf-shadow' },
      { tag: 'use', href: 'house-top' }
    ]
  },
  {
    id: 'house-v',
    shapes: [
      { tag: 'rect', x: -9, y: -13, width: 28, height: 38, rx: 3, cls: 'mf-shadow' },
      { tag: 'use', href: 'house-top', transform: 'rotate(90)' }
    ]
  },
  {
    id: 'house-sq',
    shapes: [
      { tag: 'rect', x: -11, y: -9, width: 31, height: 31, rx: 3, cls: 'mf-shadow' },
      { tag: 'rect', x: -15.5, y: -15.5, width: 31, height: 31, rx: 3, cls: 'mf-wall' },
      { tag: 'path', d: 'M-13.5 -13.5H13.5L0 0ZM-13.5 -13.5V13.5L0 0Z', cls: 'mf-roof' },
      { tag: 'path', d: 'M13.5 13.5H-13.5L0 0ZM13.5 13.5V-13.5L0 0Z', cls: 'mf-roof-2' }
    ]
  },
  {
    id: 'church',
    shapes: [
      { tag: 'path', d: 'M-7 -21h22v19h11v16h-11v17h-22v-17h-11v-16h11z', cls: 'mf-shadow' },
      { tag: 'path', d: 'M-13 -28h26v18h11v20h-11v18h-26v-18h-11v-20h11z', cls: 'mf-wall' },
      { tag: 'rect', x: -11, y: -26, width: 22, height: 52, rx: 2, cls: 'mf-roof' },
      { tag: 'rect', x: -22, y: -8, width: 44, height: 16, rx: 2, cls: 'mf-roof-2' },
      { tag: 'path', d: 'M0 -26V26M-22 0H22', cls: 'mf-ridge-line' },
      { tag: 'rect', x: -9, y: -42, width: 18, height: 18, rx: 2, cls: 'mf-wall' },
      { tag: 'rect', x: -6, y: -39, width: 12, height: 12, rx: 1.5, cls: 'mf-roof-2' },
      { tag: 'circle', cy: -33, r: 2.4, cls: 'mf-wood' }
    ]
  },

  /* ---------- small things ---------- */
  {
    id: 'rock',
    shapes: [
      { tag: 'ellipse', cx: 2.5, cy: 3.5, rx: 10, ry: 7.5, cls: 'mf-shadow' },
      { tag: 'path', d: 'M-9 1L-6 -6L2 -8L9 -3L8 4L1 7L-6 6Z', cls: 'mf-rock' }
    ]
  },
  {
    id: 'rock2',
    shapes: [
      { tag: 'path', d: 'M-9 6L-7 -2L1 -4L6 1L4 8L-4 9ZM6 -1L8 -7L14 -6L15 0L11 3Z', cls: 'mf-shadow' },
      { tag: 'path', d: 'M-12 3L-10 -5L-2 -7L3 -2L1 5L-7 6ZM3 -4L5 -10L11 -9L12 -3L8 0Z', cls: 'mf-rock' }
    ]
  },
  {
    id: 'umbrella',
    shapes: [
      { tag: 'circle', cx: 4, cy: 5, r: 13, cls: 'mf-shadow' },
      { tag: 'circle', r: 13, cls: 'mf-roof' },
      { tag: 'path', d: WEDGES, cls: 'mf-wall' },
      { tag: 'circle', r: 1.8, cls: 'mf-roof-2' }
    ]
  },
  {
    id: 'umbrella2',
    shapes: [
      { tag: 'circle', cx: 4, cy: 5, r: 12, cls: 'mf-shadow' },
      { tag: 'circle', r: 12, cls: 'mf-sea-deep' },
      { tag: 'path', d: WEDGES, cls: 'mf-wall', transform: 'scale(0.92)' },
      { tag: 'circle', r: 1.8, cls: 'mf-wall' }
    ]
  },
  {
    id: 'boat',
    shapes: [
      { tag: 'path', d: 'M-7 15q7 6 14 0', cls: 'mf-wake' },
      { tag: 'path', d: 'M0 -15C7 -9 8 6 5 13H-5C-8 6 -7 -9 0 -15Z', cls: 'mf-wall' },
      { tag: 'rect', x: -3.5, y: -4, width: 7, height: 11, rx: 2, cls: 'mf-wood' }
    ]
  },
  {
    id: 'flowers',
    shapes: [
      { tag: 'ellipse', rx: 14, ry: 9, cls: 'mf-grass-dark' },
      { tag: 'path', d: dots([[-8, -1, 2.2], [-1, 3, 2.2], [6, -2, 2.2], [2, -4, 1.8], [-4, 4, 1.8]]), cls: 'mf-roof' },
      { tag: 'path', d: dots([[-4, -3, 1.8], [4, 2, 1.8], [9, 2, 1.6], [-9, 3, 1.6]]), cls: 'mf-wall' }
    ]
  },

  /* ---------- composites: groves, woods, palm clusters, rows of houses ---------- */
  group('grove-a', [
    ['tree', -32, -16, 1],
    ['tree2', 6, -30, 1.08],
    ['tree', 36, -6, 0.94],
    ['tree2', -12, 10, 1.12],
    ['tree', 20, 24, 1],
    ['bush', -40, 22, 1.1]
  ]),
  group('grove-b', [
    ['tree2', -24, -14, 1.05],
    ['tree', 10, -20, 1.08],
    ['tree', -8, 16, 1],
    ['bush', 30, 12, 1.25],
    ['tree2', 34, -8, 0.8]
  ]),
  group('grove-c', [
    ['tree', -16, -8, 1.04],
    ['tree2', 15, -13, 1],
    ['tree', 3, 15, 0.94]
  ]),
  group('woods-a', [
    ['dense', -36, -24, 1],
    ['pine', 0, -36, 1.05],
    ['dense', 36, -22, 0.96],
    ['dense', -16, 0, 1.12],
    ['pine', 24, 6, 1.12],
    ['pine', -38, 26, 1],
    ['dense', 6, 32, 1.02]
  ]),
  group('woods-b', [
    ['pine', -30, -20, 1.08],
    ['dense', 6, -26, 1.06],
    ['dense', 34, 0, 0.94],
    ['dense', -22, 14, 1.04],
    ['pine', 12, 26, 1],
    ['tree2', -2, 0, 0.9]
  ]),
  group('woods-c', [
    ['dense', -18, -12, 1.02],
    ['pine', 16, -16, 1],
    ['dense', 12, 16, 0.96],
    ['pine', -20, 18, 0.9]
  ]),
  group('palms-a', [
    ['palm', -20, -8, 1],
    ['palm2', 18, -16, 1.04],
    ['palm', 4, 18, 0.9]
  ]),
  group('palms-b', [
    ['palm2', -26, -12, 1],
    ['palm', 6, -22, 1.06],
    ['palm', 28, 8, 0.92],
    ['palm2', -8, 20, 0.96]
  ]),
  group('row-h', [
    ['house', -44, 0, 1],
    ['house-sq', -2, 1, 1],
    ['house', 40, -1, 1]
  ]),
  group('row-h2', [
    ['house-sq', -45, 1, 1],
    ['house', -4, 0, 1],
    ['house-sq', 43, -1, 1]
  ]),
  group('row-v', [
    ['house-v', 0, -44, 1],
    ['house-sq', 1, -2, 1],
    ['house-v', 0, 40, 1]
  ])
];

/** Footprint radius of each piece at scale 1 (spacing between pieces, clearance from the road). */
export const FOOT: Record<PieceId, number> = {
  palm: 28,
  palm2: 25,
  tree: 24,
  tree2: 20,
  pine: 22,
  dense: 26,
  bush: 13,
  house: 24,
  'house-v': 24,
  'house-sq': 21,
  church: 46,
  rock: 11,
  rock2: 14,
  umbrella: 15,
  umbrella2: 14,
  boat: 16,
  flowers: 15,
  'grove-a': 62,
  'grove-b': 52,
  'grove-c': 42,
  'woods-a': 66,
  'woods-b': 58,
  'woods-c': 46,
  'palms-a': 50,
  'palms-b': 56,
  'row-h': 66,
  'row-h2': 66,
  'row-v': 66
};

/** Elements the kit adds to the map SVG (each symbol and each of its shapes). */
export const SCENERY_DEF_ELEMENTS = KIT.reduce((sum, symbol) => sum + 1 + symbol.shapes.length, 0);
