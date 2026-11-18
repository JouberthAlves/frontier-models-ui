/**
 * The scenery kit as plain data (spec-v2 §3.2): one symbol per piece, drawn around (0, 0).
 *
 * The pieces are illustrated sprites (public/map/*.webp, cut from the Magnific sheets in
 * design/magnific-map by scripts/cut-map-sprites.cjs). Two kinds of symbol:
 *  - single pieces (a tree, a palm, a house…): one <image>;
 *  - composites (a grove, a patch of woods, a cluster of palms, a run of fence): several `use`
 *    of the single pieces. One placed composite is ONE element in the map but draws 3 to 7
 *    sprites, which is how the map gets dense without going over the 650-element budget.
 *
 * Shadows are not part of the symbols: `KIT_PARTS` says where each piece touches the ground, and
 * scenery.ts turns all of them into one shared path under the pieces (no filter, no extra
 * element per piece, and the shadow never turns with the piece).
 *
 * Add a sprite: put it on a sheet, cut it (see AGENTS.md; its pixel size comes from the manifest
 * the cut writes), add a piece to `SINGLES` (and to `PieceId`), and list the piece in a zone of
 * `ZONES` (src/lib/scenery.ts). `SCENERY_DEF_ELEMENTS` and `FOOT` are computed from this data.
 */
import manifest from '../../public/map/manifest.json';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const mapAsset = (name: string) => `${BASE}/map/${name}.webp`;

type Manifest = typeof manifest;
type ManifestName = keyof Manifest;
/** The seamless ground tiles are the manifest entries marked `tile`; everything else is a sprite. */
type TextureName = { [K in ManifestName]: Manifest[K] extends { tile: boolean } ? K : never }[ManifestName];
export type SpriteName = Exclude<ManifestName, TextureName>;

const MANIFEST: Record<string, { w: number; h: number; tile?: boolean }> = manifest;
const names = Object.keys(MANIFEST);

/**
 * Pixel size of each sprite, read from public/map/manifest.json (written by the cut script):
 * a re-cut never needs a number copied here.
 */
export const SPRITES = Object.fromEntries(
  names.filter(name => !MANIFEST[name].tile).map(name => [name, [MANIFEST[name].w, MANIFEST[name].h]])
) as unknown as Record<SpriteName, readonly [number, number]>;

/** Seamless ground tiles. */
export const TEXTURES = names.filter(name => MANIFEST[name].tile);
export const TEXTURE_SIZE = MANIFEST[TEXTURES[0]]?.w ?? 512;

/** Every file the map draws: the loader waits for them (step "map"). */
export const MAP_ASSET_URLS: string[] = names.map(mapAsset);

export type PieceId =
  | 'palm'
  | 'palm2'
  | 'tree'
  | 'tree2'
  | 'pine'
  | 'pine2'
  | 'dense'
  | 'oak'
  | 'oak-d'
  | 'bush'
  | 'bushes'
  | 'hedge'
  | 'house'
  | 'house-sq'
  | 'house-l'
  | 'house-long'
  | 'church'
  | 'rock'
  | 'rock2'
  | 'umbrella'
  | 'umbrella2'
  | 'boat'
  | 'rowboat'
  | 'flowers'
  | 'fence'
  | 'fence-row'
  | 'grove-a'
  | 'grove-b'
  | 'grove-c'
  | 'woods-a'
  | 'woods-b'
  | 'woods-c'
  | 'palms-a'
  | 'palms-b';

export interface KitShape {
  tag: 'image' | 'use';
  /** `image`: file URL. `use`: id of another symbol of the kit (without the `sc-` prefix). */
  href: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  transform?: string;
}

export interface KitSymbol {
  id: string;
  shapes: KitShape[];
}

/**
 * How a piece meets the ground (its shadow):
 *  - `crown`: a canopy or parasol seen from above, the shadow peeks out below and to the right;
 *  - `building`: 3/4 view with the front wall at the bottom, the shadow lies along its base;
 *  - `low`: flat on the ground (flowers, rocks, fence, boats), a thin contact shadow;
 *  - `palm`: see-through fronds around a thin trunk: a small shadow under the middle only (a
 *    crown-sized one shows through the fronds as a grey disc).
 */
type Ground = 'crown' | 'building' | 'low' | 'palm';

interface Single {
  id: PieceId;
  sprite: SpriteName;
  /** Width on the map at scale 1 (the height follows the sprite). */
  w: number;
  ground: Ground;
  /** Mirrored left to right (a second look from the same sprite). */
  flip?: boolean;
}

// Widths are for the sprites as cut today: the re-cut trimmed the empty margins of pine-2 and
// rocks, so their widths went down to keep the same size on the map.
const SINGLES: Single[] = [
  /* ---------- trees ---------- */
  { id: 'tree', sprite: 'tree-round', w: 56, ground: 'crown' },
  { id: 'tree2', sprite: 'oak', w: 48, ground: 'crown' },
  { id: 'dense', sprite: 'tree-round-dark', w: 58, ground: 'crown' },
  { id: 'pine', sprite: 'pine', w: 46, ground: 'crown' },
  { id: 'pine2', sprite: 'pine-2', w: 42, ground: 'crown' },
  // Landmark trees: one wide crown.
  { id: 'oak', sprite: 'oak', w: 66, ground: 'crown' },
  { id: 'oak-d', sprite: 'tree-round-dark', w: 70, ground: 'crown' },
  { id: 'palm', sprite: 'palm', w: 58, ground: 'palm' },
  { id: 'palm2', sprite: 'palm-2', w: 54, ground: 'palm' },
  { id: 'bush', sprite: 'bush', w: 28, ground: 'crown' },
  { id: 'bushes', sprite: 'bushes', w: 44, ground: 'crown' },
  { id: 'hedge', sprite: 'hedge', w: 44, ground: 'low' },

  /* ---------- buildings (3/4 view: roof on top, front wall at the bottom; never rotated) ---------- */
  { id: 'house', sprite: 'house', w: 44, ground: 'building' },
  { id: 'house-sq', sprite: 'house-square', w: 44, ground: 'building' },
  { id: 'house-l', sprite: 'house-l', w: 46, ground: 'building' },
  { id: 'house-long', sprite: 'house-long', w: 42, ground: 'building' },
  { id: 'church', sprite: 'church', w: 37, ground: 'building' },

  /* ---------- small things ---------- */
  { id: 'rock', sprite: 'rocks', w: 19, ground: 'low' },
  { id: 'rock2', sprite: 'rocks', w: 25, ground: 'low', flip: true },
  { id: 'umbrella', sprite: 'umbrella-coral', w: 30, ground: 'crown' },
  { id: 'umbrella2', sprite: 'umbrella-teal', w: 28, ground: 'crown' },
  { id: 'boat', sprite: 'sailboat', w: 20, ground: 'low' },
  { id: 'rowboat', sprite: 'rowboat', w: 18, ground: 'low' },
  { id: 'flowers', sprite: 'flowers', w: 34, ground: 'low' },
  { id: 'fence', sprite: 'fence', w: 30, ground: 'low' }
];

type Part = [id: PieceId, x: number, y: number, scale: number, turn?: number];

/** Composites: their parts are drawn top to bottom, so the lower ones overlap the ones above. */
const GROUPS: [PieceId, Part[]][] = [
  [
    'grove-a',
    [
      ['tree', -32, -16, 1, -14],
      ['tree2', 6, -30, 1.08, 40],
      ['tree', 36, -6, 0.94, 18],
      ['tree2', -12, 10, 1.12, -70],
      ['tree', 20, 24, 1, 8],
      ['bush', -40, 22, 1.1, 120]
    ]
  ],
  [
    'grove-b',
    [
      ['tree2', -24, -14, 1.05, 25],
      ['tree', 10, -20, 1.08, -10],
      ['tree', -8, 16, 1, 16],
      ['bushes', 30, 14, 0.9, 200],
      ['tree2', 34, -8, 0.8, 150]
    ]
  ],
  [
    'grove-c',
    [
      ['tree', -16, -8, 1.04, 12],
      ['tree2', 15, -13, 1, -50],
      ['tree', 3, 15, 0.94, -16]
    ]
  ],
  [
    'woods-a',
    [
      ['dense', -36, -24, 1, 10],
      ['pine', 0, -36, 1.05, 30],
      ['dense', 36, -22, 0.96, -18],
      ['dense', -16, 0, 1.12, 20],
      ['pine2', 24, 6, 1.06, 75],
      ['pine', -38, 26, 1, 160],
      ['dense', 6, 32, 1.02, -8]
    ]
  ],
  [
    'woods-b',
    [
      ['pine2', -30, -20, 1.04, 110],
      ['dense', 6, -26, 1.06, 14],
      ['dense', 34, 0, 0.94, -20],
      ['dense', -22, 14, 1.04, 6],
      ['pine', 12, 26, 1, 220],
      ['tree2', -2, 0, 0.9, 60]
    ]
  ],
  [
    'woods-c',
    [
      ['dense', -18, -12, 1.02, -12],
      ['pine', 16, -16, 1, 45],
      ['dense', 12, 16, 0.96, 18],
      ['pine2', -20, 18, 0.88, 190]
    ]
  ],
  [
    'palms-a',
    [
      ['palm', -20, -8, 1, 0],
      ['palm2', 18, -16, 1.04, 95],
      ['palm', 4, 18, 0.9, 210]
    ]
  ],
  [
    'palms-b',
    [
      ['palm2', -26, -12, 1, 30],
      ['palm', 6, -22, 1.06, 150],
      ['palm', 28, 8, 0.92, 280],
      ['palm2', -8, 20, 0.96, 200]
    ]
  ],
  // A run of fence: three panels, the end posts overlapping.
  [
    'fence-row',
    [
      ['fence', -27, 0, 1],
      ['fence', 0, 0, 1],
      ['fence', 27, 0, 1]
    ]
  ]
];

const heightOf = (single: Single) => (single.w * SPRITES[single.sprite][1]) / SPRITES[single.sprite][0];
const round1 = (value: number) => Math.round(value * 10) / 10;

export const KIT: KitSymbol[] = [
  ...SINGLES.map(single => {
    const h = heightOf(single);
    return {
      id: single.id,
      shapes: [
        {
          tag: 'image' as const,
          href: mapAsset(single.sprite),
          x: round1(-single.w / 2),
          y: round1(-h / 2),
          width: single.w,
          height: round1(h),
          transform: single.flip ? 'scale(-1 1)' : undefined
        }
      ]
    };
  }),
  ...GROUPS.map(([id, parts]) => ({
    id,
    shapes: [...parts]
      .sort((a, b) => a[2] - b[2])
      .map(([href, x, y, scale, turn]) => ({
        tag: 'use' as const,
        href,
        transform: `translate(${x} ${y})${turn ? ` rotate(${turn})` : ''}${scale !== 1 ? ` scale(${scale})` : ''}`
      }))
  }))
];

/** Where a piece touches the ground, in its own units: one entry per sprite it draws. */
export interface GroundPart {
  /** Centre of the part inside the piece (turns with the piece). */
  x: number;
  y: number;
  /** Shadow ellipse and its offset from the part (the offset never turns: the light is fixed). */
  rx: number;
  ry: number;
  dx: number;
  dy: number;
  /** Turn of the part inside the piece (matters for long shadows only). */
  turn: number;
}

function groundOf(single: Single, scale = 1, x = 0, y = 0, turn = 0): GroundPart {
  const w = single.w * scale;
  const h = heightOf(single) * scale;
  if (single.ground === 'building') return { x, y, rx: w * 0.53, ry: h * 0.25, dx: w * 0.05, dy: h * 0.31, turn };
  if (single.ground === 'palm') return { x, y, rx: w * 0.25, ry: h * 0.22, dx: w * 0.07, dy: h * 0.11, turn };
  if (single.ground === 'low') return { x, y, rx: w * 0.5, ry: h * 0.47, dx: w * 0.03, dy: h * 0.09, turn };
  return { x, y, rx: w * 0.46, ry: h * 0.45, dx: w * 0.07, dy: h * 0.11, turn };
}

const SINGLE_BY_ID = new Map(SINGLES.map(single => [single.id, single]));

export const KIT_PARTS = Object.fromEntries([
  ...SINGLES.map(single => [single.id, [groundOf(single)]]),
  ...GROUPS.map(([id, parts]) => [
    id,
    parts.flatMap(([part, x, y, scale, turn]) => {
      const single = SINGLE_BY_ID.get(part);
      return single ? [groundOf(single, scale, x, y, turn ?? 0)] : [];
    })
  ])
]) as Record<PieceId, GroundPart[]>;

/** Footprint radius of the composites at scale 1; single pieces get theirs from the sprite size. */
const GROUP_FOOT: Partial<Record<PieceId, number>> = {
  'grove-a': 64,
  'grove-b': 54,
  'grove-c': 44,
  'woods-a': 68,
  'woods-b': 60,
  'woods-c': 48,
  'palms-a': 52,
  'palms-b': 58,
  'fence-row': 30
};

/** Footprint radius of each piece at scale 1 (spacing between pieces, clearance from the road). */
export const FOOT = Object.fromEntries([
  ...SINGLES.map(single => [single.id, Math.round(Math.max(single.w, heightOf(single)) * (single.ground === 'building' ? 0.5 : 0.44))]),
  ...GROUPS.map(([id]) => [id, GROUP_FOOT[id] ?? 40])
]) as Record<PieceId, number>;

/** Elements the kit adds to the map SVG (each symbol and each of its shapes). */
export const SCENERY_DEF_ELEMENTS = KIT.reduce((sum, symbol) => sum + 1 + symbol.shapes.length, 0);
