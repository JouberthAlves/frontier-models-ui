import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import SceneryDefs from './SceneryDefs';
import { markStep, preloadImages } from '../../lib/boot';
import { hasGpu, useGalaxyOff } from '../../lib/gpu';
import { useReducedMotion } from '../../lib/motion';
import { setFinishY, setRoadBroken } from '../../lib/raceState';
import { buildRoadEdge, type RoadEdge } from '../../lib/roadEdge';
import { buildScenery, type Rect, type Scenery } from '../../lib/scenery';
import { MAP_ASSET_URLS, mapAsset, TEXTURES, TEXTURE_SIZE } from '../../lib/sceneryKit';
import { measureSpiralAnchor, spiralCoreY } from '../../lib/spiral';
import { buildTrack, CAR_SPACING, TRACK_STEP, type BlockRect, type Track, type TrackSide } from '../../lib/track';
import './RaceMap.css';

/**
 * The racing zone (spec-v2, spec-v4): a pastel top-down map behind the hero and the Racing
 * section, the S-shaped track computed from the real block rectangles, neutral cars driven by
 * the scroll position, the finish line, and the broken end of the road.
 *
 * The end of the road is always broken (spec-v4 §1): a jagged edge, then slabs of road that
 * fall away into the sky (lib/roadEdge.ts). It is a drawing, not an animation.
 *
 * The cars are decorative (spec-v4 §2): they drive to the jagged edge, jump off it and are
 * pulled into the nucleus of the galaxy of the second hero along a spiral, where they vanish.
 * Everything is a function of the scroll position, so scrolling back undoes it.
 *
 * Per frame only `transform` / `opacity` change, on the cars and their flashes.
 */

/**
 * Number of cars. A fixed, decorative number on purpose (spec-v4 §2): the cars stand for no
 * model and end in the galaxy, so adding or removing a model never touches them.
 */
const CAR_COUNT = 5;
const NAV_H = 64;
const GRID_TOP = NAV_H + 34;
/** Length of the last stretch (before the finish) whose ground turns to dusk and fades. */
const BREAK_BEFORE_FINISH = 640;
const BAND = 220;
/** The ground fades out over this many px at the very end of the map. */
const GROUND_FADE = 200;
/** px each stretch of road is drawn past its end, under the next one. */
const SEAM_OVERLAP = 8;
/** The fall into the galaxy: turns around the nucleus (the way the galaxy turns: clockwise). */
const VORTEX_TURNS = 1.25;
/** How fast the radius closes (1 = evenly; above 1 = quicker at first). */
const VORTEX_PULL = 1.6;
/** The car ends at this fraction of its size, and goes out over the last fifth of the fall. */
const VORTEX_END_SCALE = 0.08;
const VORTEX_FADE_FROM = 0.8;
const TINT_GOLD = [255, 196, 120] as const;
const TINT_DUSK = [60, 70, 120] as const;
const TINT_NIGHT = [16, 30, 53] as const;

/** Sprites and ground textures of the map, loaded once (the loader's "map" step waits for them). */
let mapAssets: Promise<void> | null = null;
const loadMapAssets = () => (mapAssets ??= preloadImages(MAP_ASSET_URLS));

interface Layout {
  W: number;
  H: number;
  breakY: number;
  breakLen: number;
  track: Track;
  scenery: Scenery;
  /** The broken end of the road: slabs, gravel, where the cars jump. */
  edge: RoadEdge;
  /** Phones: per track sample, how hidden a car is there (1 = under a card). Null on wider screens. */
  cover: Float32Array | null;
  /** Marker of the nucleus of the galaxy (second hero), in the coordinates of the map. */
  core: { x: number; y: number };
  signature: number[];
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};
const rgba = (rgb: readonly number[], alpha: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(3)})`;


/** Dusk tint at a fraction of the map height (from the 50% stop down). */
function duskAt(f: number, nightAt: number): { rgb: number[]; alpha: number } {
  if (f <= 0.5) return { rgb: [...TINT_DUSK], alpha: 0 };
  if (f <= 0.85) return { rgb: [...TINT_DUSK], alpha: (0.18 * (f - 0.5)) / 0.35 };
  if (f <= nightAt) {
    const t = clamp((f - 0.85) / Math.max(0.001, nightAt - 0.85));
    return { rgb: TINT_DUSK.map((value, index) => mix(value, TINT_NIGHT[index], t)), alpha: mix(0.18, 0.5, t) };
  }
  return { rgb: [...TINT_NIGHT], alpha: 0.5 * clamp((1 - f) / Math.max(0.001, 1 - nightAt)) };
}

/**
 * What is laid over a slab of road so it matches the road it broke from (the dusk tint of the
 * map at that height) and gets darker as it falls (`bright` 1 → 0.45): one color, one opacity.
 */
function slabVeil(f: number, nightAt: number, bright: number): { fill: string; opacity: number } {
  const tint = duskAt(f, nightAt);
  const dark = 1 - bright;
  const opacity = 1 - (1 - tint.alpha) * (1 - dark);
  const share = opacity > 0 ? (tint.alpha * (1 - dark)) / opacity : 0;
  return { fill: `rgb(${tint.rgb.map(value => Math.round(value * share)).join(',')})`, opacity };
}

function measure(root: HTMLElement, previous: Layout | null): Layout | null {
  const origin = root.getBoundingClientRect();
  const W = document.documentElement.clientWidth;
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-track-side]'));
  const finishNode = document.querySelector<HTMLElement>('[data-track-finish]');
  const heroNode = document.getElementById('top');
  if (!nodes.length || !finishNode || W < 200) return null;

  const rectOf = (node: Element): Rect => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left - origin.left, right: rect.right - origin.left, top: rect.top - origin.top, bottom: rect.bottom - origin.top };
  };
  // Blocks that are not cards (the hero) sit straight on the map: only their text and buttons
  // are kept clear of scenery, not the whole box.
  const calm: Rect[] = [];
  const blocks: BlockRect[] = nodes
    .map(node => {
      const opaque = node.classList.contains('race-card');
      if (!opaque) {
        Array.from(node.children).forEach(child => {
          const rect = rectOf(child);
          if (rect.bottom > rect.top && rect.right > rect.left) calm.push(rect);
        });
      }
      return { ...rectOf(node), side: (node.dataset.trackSide as TrackSide) ?? 'full', opaque };
    })
    .filter(block => block.bottom > block.top)
    .sort((a, b) => a.top - b.top);
  if (!blocks.length) return null;

  const finishY = finishNode.getBoundingClientRect().top - origin.top;
  const heroTop = heroNode ? heroNode.getBoundingClientRect().top - origin.top : 0;
  // The page tells the compare bar and the notice where the race ends (lib/zone.ts).
  setFinishY(finishY + origin.top + window.scrollY);
  // Where the cars end: the nucleus of the galaxy, between the words of the second hero.
  const anchor = measureSpiralAnchor();
  const core = anchor
    ? { x: anchor.x - window.scrollX - origin.left, y: anchor.y - window.scrollY - origin.top }
    : { x: W / 2, y: finishY + 1000 };

  // Nothing moved by 2 px or more: keep the current map.
  const signature = [W, finishY, core.x, core.y, ...blocks.flatMap(block => [block.left, block.right, block.top, block.bottom])];
  if (
    previous &&
    previous.signature.length === signature.length &&
    previous.signature.every((value, index) => Math.abs(value - signature[index]) < 2)
  ) {
    return previous;
  }

  const contentLeft = Math.min(...blocks.map(block => block.left));
  const contentRight = Math.max(...blocks.map(block => block.right));
  const track = buildTrack({
    width: W,
    blocks,
    contentLeft,
    contentRight,
    startY: heroTop + GRID_TOP,
    finishY,
    cars: CAR_COUNT
  });
  // Whole pixels: the ground is made of rects that meet at breakY (and at the fade line), and a
  // joint on a fraction of a pixel shows as a hairline across the map.
  const H = Math.ceil(track.endY + 40);
  const breakY = Math.round(Math.max(blocks[0].bottom, finishY - BREAK_BEFORE_FINISH));
  const breakLen = track.lenAtY(breakY);
  const scenery = buildScenery({ width: W, height: H, breakY, blocks, calm, track, contentLeft });
  const edge = buildRoadEdge(track, W);

  // Phones: the road runs behind the cards, so a car beside one would show as a sliver past its
  // edge. Per sample: is the centre line under a card? Blurred over ±24 px, so cars fade.
  let cover: Float32Array | null = null;
  if (W < 768) {
    const cards = blocks.filter(block => block.opaque);
    const count = Math.ceil(track.length / TRACK_STEP) + 1;
    const raw = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) {
      const p = track.at(i * TRACK_STEP);
      raw[i] = cards.some(b => p.x > b.left && p.x < b.right && p.y > b.top && p.y < b.bottom) ? 1 : 0;
    }
    cover = new Float32Array(count);
    const reach = 6;
    for (let i = 0; i < count; i += 1) {
      let sum = 0;
      for (let k = -reach; k <= reach; k += 1) sum += raw[clamp(i + k, 0, count - 1)];
      cover[i] = sum / (reach * 2 + 1);
    }
  }

  return { W, H, breakY, breakLen, track, scenery, edge, cover, core, signature };
}

interface RoadProps {
  id: string;
  offset: number;
  roadW: number;
}

/** Kerbs of one stretch of road (red base + white dashes). */
function RoadKerbs({ id, offset, roadW }: RoadProps) {
  const href = `#${id}`;
  return (
    <>
      <use href={href} className="rm-kerb-red" strokeWidth={roadW + 10} />
      <use href={href} className="rm-kerb-white" strokeWidth={roadW + 10} strokeDasharray="14 14" strokeDashoffset={offset % 28} />
    </>
  );
}

/** Asphalt and centre line of one stretch of road. */
function RoadTop({ id, offset, roadW }: RoadProps) {
  const href = `#${id}`;
  return (
    <>
      <use href={href} className="rm-asphalt" strokeWidth={roadW} />
      <use href={href} className="rm-centre" strokeWidth={2} strokeDasharray="18 22" strokeDashoffset={offset % 40} />
    </>
  );
}

/** Kerbs, asphalt and centre line of one stretch of road (the soft shadow is drawn apart). */
function Road(props: RoadProps) {
  return (
    <>
      <RoadKerbs {...props} />
      <RoadTop {...props} />
    </>
  );
}

/** Soft shadow under the road: two wide, faint strokes (a cheap blur, no filter on a huge path). */
function RoadShadow({ id, roadW }: { id: string; roadW: number }) {
  const href = `#${id}`;
  return (
    <>
      <use href={href} className="rm-road-shadow" strokeWidth={roadW + 22} transform="translate(3 4)" />
      <use href={href} className="rm-road-shadow" strokeWidth={roadW + 13} transform="translate(3 4)" />
    </>
  );
}

function Pieces({ scenery, tail }: { scenery: Scenery; tail: boolean }) {
  return (
    <>
      {scenery.pieces.map((piece, index) =>
        piece.tail === tail ? (
          <use
            key={index}
            href={`#sc-${piece.id}`}
            transform={`translate(${piece.x.toFixed(1)} ${piece.y.toFixed(1)})${piece.r ? ` rotate(${piece.r.toFixed(0)})` : ''} scale(${piece.s.toFixed(2)})`}
          />
        ) : null
      )}
    </>
  );
}

export default function RaceMap() {
  const reduced = useReducedMotion();
  const galaxyOff = useGalaxyOff();
  // The WebGL galaxy follows the page slower than it scrolls; the still picture does not.
  const galaxyLive = !reduced && !galaxyOff && hasGpu();
  const rootRef = useRef<HTMLDivElement>(null);
  const carsRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<SVGSVGElement>(null);
  const flagsRef = useRef<SVGGElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  // Measure the blocks and rebuild the map: first paint, fonts ready, resize (150 ms debounce)
  // and whenever a block changes height (ResizeObserver on <main>).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let alive = true;
    let first = true;
    // The "map" step is done when the map is laid out AND its sprites and textures are in, so
    // nothing pops in after the lights go out.
    const assets = loadMapAssets();
    const run = () => {
      if (!alive) return;
      setLayout(previous => measure(root, previous) ?? previous);
      void assets.then(() => markStep('map'));
    };
    const schedule = () => {
      clearTimeout(timer);
      if (first) {
        first = false;
        run();
        return;
      }
      timer = setTimeout(run, 150);
    };
    const main = document.querySelector('main');
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    if (main) observer?.observe(main);
    // A block can change size without <main> changing (the hero has a minimum height).
    document.querySelectorAll('[data-track-side]').forEach(block => observer?.observe(block));
    if (!observer) timer = setTimeout(run, 0);
    window.addEventListener('resize', schedule, { passive: true });
    document.fonts?.ready.then(schedule, schedule);
    return () => {
      alive = false;
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);


  // The scroll-driven engine: cars, finish flags, sky, and the fall of the cars into the galaxy.
  useLayoutEffect(() => {
    const carsRoot = carsRef.current;
    if (!layout || !carsRoot) return undefined;
    const { track, W, edge, cover, core } = layout;
    const cars = Array.from(carsRoot.querySelectorAll<HTMLElement>('.race-car'));
    const flashes = Array.from(carsRoot.querySelectorAll<HTMLElement>('.race-flash'));
    const count = cars.length;
    const scale = track.carScale;
    const gridLead = track.gridLead;
    const gridY = track.at(gridLead).y;
    // The cars leave the road at its jagged edge.
    const jumpLen = edge.jumpLen;
    const jump = track.at(jumpLen);
    const slotShift = track.roadW * 0.16;
    // Page origin of the layers (read once per layout, never per frame).
    const originY = carsRoot.getBoundingClientRect().top + window.scrollY;

    /** `onGrid` 1 → 0: each car leaves its own grid slot (left / right) and joins the centre line. */
    const placeOnTrack = (index: number, length: number, wobble: number, onGrid: number) => {
      const p = track.at(length);
      const car = cars[index];
      let { x, y } = p;
      if (onGrid > 0) {
        const a = (p.angle * Math.PI) / 180;
        const shift = (index % 2 ? 1 : -1) * slotShift * onGrid;
        x += Math.sin(a) * shift;
        y -= Math.cos(a) * shift;
      }
      car.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(p.angle - 90 + wobble).toFixed(1)}deg) scale(${scale})`;
      car.style.opacity = cover ? (1 - cover[clamp(Math.round(length / TRACK_STEP), 0, cover.length - 1)]).toFixed(2) : '1';
    };

    carsRoot.dataset.ready = 'true';

    if (reduced) {
      // Reduced motion: cars parked on the grid, no fall, no flash.
      for (let i = 0; i < count; i += 1) placeOnTrack(i, gridLead - i * CAR_SPACING, 0, 1);
      flashes.forEach(flash => {
        flash.style.opacity = '0';
      });
      return undefined;
    }

    const sky = document.querySelector<HTMLElement>('[data-race-sky]');
    const flags = flagsRef.current;
    const carsSpan = (count - 1) * CAR_SPACING;
    /** y of the nucleus, in the coordinates of the cars, with the page scrolled to `scrollY`. */
    const coreAt = (scrollY: number, vh: number) => spiralCoreY(core.y + originY, scrollY, vh, galaxyLive) - originY;
    // Narrow screens: the spiral is squeezed sideways so no car leaves the page.
    const sideRoom = Math.min(core.x, W - core.x) - 20;
    const flashShown = new Array<number>(count).fill(-1);
    const flash = (index: number, x: number, y: number, p: number) => {
      const node = flashes[index];
      if (!node) return;
      const value = p <= 0 || p >= 1 ? 0 : Math.round(Math.sin(Math.PI * p) * 85) / 100;
      if (value === 0 && flashShown[index] === 0) return;
      flashShown[index] = value;
      node.style.opacity = String(value);
      if (value > 0) node.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(0.35 + 1.1 * p).toFixed(3)})`;
    };

    let raf = 0;
    let lastLead = NaN;
    let lastT = NaN;
    let lastVh = 0;

    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const sy = window.scrollY;
      // On the grid at the top; settles ~58% down the viewport over the first 0.6 screen.
      const blend = clamp(sy / (vh * 0.6));
      const targetY = Math.max(gridY, sy - originY + vh * 0.58 * blend + (1 - blend) * gridY);
      const lead = targetY <= track.endY ? track.lenAtY(targetY) : track.length + (targetY - track.endY);
      if (lead === lastLead && vh === lastVh) return;
      const first = Number.isNaN(lastLead);
      const wobble = first ? 0 : clamp((lead - lastLead) / 40, -1, 1);
      lastLead = lead;
      lastVh = vh;

      const T = clamp((lead - track.finishLen) / (vh * 1.1));
      if (T !== lastT) {
        lastT = T;
        if (sky) sky.style.opacity = smooth(T).toFixed(3);
        flags?.classList.toggle('is-waving', lead >= track.finishLen);
      }

      // The galaxy lights up when the first car jumps off the road.
      setRoadBroken(lead > jumpLen);

      // The fall lasts this many px of scroll per car: the last one reaches the nucleus about
      // when the second hero comes to rest under the nav (where the menu link scrolls to).
      const fall = Math.max(360, core.y - jump.y + vh * 0.08 - carsSpan - NAV_H - 8);
      const coreNow = coreAt(sy, vh);
      const onGrid = 1 - smooth((lead - gridLead) / 160);
      for (let i = 0; i < count; i += 1) {
        const d = lead - i * CAR_SPACING;
        const car = cars[i];
        if (d <= jumpLen) {
          placeOnTrack(i, Math.max(0, d), wobble, onGrid);
          flash(i, 0, 0, 0);
          continue;
        }
        const u = clamp((d - jumpLen) / fall);
        // A short white flash in the nucleus as the car goes out.
        flash(i, core.x, coreNow, (u - 0.86) / 0.14);
        if (u >= 1) {
          car.style.opacity = '0';
          continue;
        }
        // A spiral around the nucleus, in polar coordinates. It starts at the edge of the road
        // (radius and angle of that point as seen from the nucleus when this car jumped), the
        // radius closes and the angle runs faster and faster, the way the galaxy turns.
        const vx = jump.x - core.x;
        const vy = jump.y - coreAt(sy - (d - jumpLen), vh);
        const r0 = Math.hypot(vx, vy) || 1;
        const theta = Math.atan2(vy, vx) + VORTEX_TURNS * 2 * Math.PI * Math.pow(u, 1.5);
        const r = r0 * Math.pow(1 - u, VORTEX_PULL);
        const squeeze = mix(1, Math.min(1, sideRoom / (r0 * 0.55)), smooth(u / 0.3));
        const x = clamp(core.x + Math.cos(theta) * r * squeeze, 14, W - 14);
        const y = coreNow + Math.sin(theta) * r;
        // Nose: straight ahead as it jumps, then towards the nucleus, then along the spiral.
        const along = (theta * 180) / Math.PI + 180 - 90 * smooth(u / 0.45);
        const heading = mix(90, along, smooth(u / 0.15));
        // The jump: the car grows a little as it leaves the edge, then shrinks all the way in.
        const size = scale * mix(1, VORTEX_END_SCALE, smooth(u)) * (1 + 0.38 * Math.sin(Math.PI * Math.min(1, u / 0.2)));
        car.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(heading - 90).toFixed(1)}deg) scale(${size.toFixed(3)})`;
        car.style.opacity = (1 - clamp((u - VORTEX_FADE_FROM) / (1 - VORTEX_FADE_FROM))).toFixed(3);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (sky) sky.style.opacity = '';
    };
  }, [layout, reduced, galaxyLive]);

  // The loose slabs sway very slowly (CSS), only with a real GPU and only while they are on screen.
  const floating = !reduced && hasGpu();
  useEffect(() => {
    const fx = fxRef.current;
    if (!fx || !floating || typeof IntersectionObserver !== 'function') return undefined;
    const observer = new IntersectionObserver(entries => {
      fx.classList.toggle('is-live', entries.some(entry => entry.isIntersecting));
    });
    observer.observe(fx);
    return () => {
      observer.disconnect();
      fx.classList.remove('is-live');
    };
  }, [floating, layout]);

  const cars = (
    <div key="cars" ref={carsRef} className="race-cars" aria-hidden="true">
      {Array.from({ length: CAR_COUNT }, (_, index) => (
        <div key={index} className="race-car">
          <svg viewBox="-14 -22 28 44" width="28" height="44" focusable="false">
            <rect x="-8" y="-16" width="20" height="38" rx="7" className="race-car__shadow" />
            <path d="M-12 -13h4v8h-4zM8 -13h4v8h-4zM-12 6h4v8h-4zM8 6h4v8h-4z" className="race-car__tyres" />
            <rect x="-10" y="-19" width="20" height="38" rx="7" className="race-car__paint" />
            <rect x="-2" y="-19" width="4" height="38" className="race-car__stripe" />
            <rect x="-6.5" y="-3" width="13" height="9" rx="2.5" className="race-car__glass" />
            <path d="M-7.5 15.4h4v2.2h-4zM3.5 15.4h4v2.2h-4z" className="race-car__lights" />
          </svg>
        </div>
      ))}
      {/* One flash per car, in the nucleus of the galaxy, as that car goes out. */}
      {Array.from({ length: CAR_COUNT }, (_, index) => (
        <span key={`flash-${index}`} className="race-flash" />
      ))}
    </div>
  );

  if (!layout) {
    return (
      <>
        <div key="map" ref={rootRef} className="race-map race-map--pending" aria-hidden="true" />
        {cars}
      </>
    );
  }

  const { W, H, breakY, breakLen, track, scenery, edge } = layout;
  const tailOffset = Math.floor(breakLen / TRACK_STEP) * TRACK_STEP;
  const roadW = track.roadW;
  const finish = track.at(track.finishLen);
  const nightAt = (H - 170) / H;
  const bandEnd = breakY + BAND;
  const atBreak = duskAt(breakY / H, nightAt);
  const atBandEnd = duskAt(bandEnd / H, nightAt);
  // The body tint fades out over the band below the break line while the tail tint fades in,
  // so the two add up to one continuous dusk.
  const tailStops: { at: number; color: string }[] = [
    { at: breakY / H, color: rgba(atBandEnd.rgb, 0) },
    { at: bandEnd / H, color: rgba(atBandEnd.rgb, atBandEnd.alpha) }
  ];
  if (bandEnd / H < 0.85) tailStops.push({ at: 0.85, color: rgba(TINT_DUSK, 0.18) });
  if (bandEnd / H < nightAt) tailStops.push({ at: nightAt, color: rgba(TINT_NIGHT, 0.5) });
  tailStops.push({ at: 1, color: rgba(TINT_NIGHT, 0) });
  const slots = Array.from({ length: CAR_COUNT }, (_, index) => {
    const p = track.at(track.gridLead - index * CAR_SPACING + 24);
    return { key: index, x: p.x + (index % 2 ? 1 : -1) * roadW * 0.16, y: p.y };
  });
  const startLine = track.at(track.gridLead + 34);
  const { village, bridge, cliff, river, stand, shadows, calmBox } = scenery;
  // Ground textures: 512 px tiles, smaller on phones (where every piece is smaller too).
  const tile = W < 768 ? TEXTURE_SIZE * 0.62 : TEXTURE_SIZE;
  const fadeY = Math.round(Math.max(breakY, H - GROUND_FADE));
  // Darker ground of the woods: fades in at 60% of the map and hands over to the dusk ground of
  // the last stretch (or ends at 92%, when the last stretch starts lower than that).
  const woodsTop = H * 0.6;
  const woodsHold = breakY <= H * 0.92 ? breakY : H * 0.86;
  const woodsEnd = breakY <= H * 0.92 ? bandEnd : H * 0.92;
  const woods = woodsHold - woodsTop > 140;
  const woodsAt = (y: number) => clamp((y - woodsTop) / (woodsEnd - woodsTop)).toFixed(4);
  // Bridge sprite: its planks run along the road, so it is drawn turned a quarter; the deck
  // (the sprite minus its posts and rails) is as wide as the road and its kerbs.
  const bridgeAcross = bridge ? bridge.w / 0.8 : 0;
  const bridgeAlong = bridge ? bridge.len + 12 : 0;
  const finishMark = (
    <>
      <rect x={finish.x - (roadW + 10) / 2} y={finish.y - 7} width={roadW + 10} height="14" fill="url(#rm-check)" />
      <g ref={flagsRef} className="rm-flags">
        {[-1, 1].map(side => (
          <g key={side} transform={`translate(${(finish.x + side * (roadW / 2 + 12)).toFixed(1)} ${(finish.y + 4).toFixed(1)})`}>
            <g className="rm-flag" style={{ ['--dir' as string]: side }}>
              <path d="M0 0V-28" className="rm-flag__pole" />
              <path d="M0 -28h15v10h-15z" fill="url(#rm-check)" />
            </g>
          </g>
        ))}
      </g>
    </>
  );

  return (
    <>
      <div key="map" ref={rootRef} className="race-map" style={{ height: H }} aria-hidden="true">
        <svg className="race-map__svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} focusable="false">
          <defs>
            <SceneryDefs />
            <pattern id="rm-check" width="12" height="12" patternUnits="userSpaceOnUse">
              <rect width="12" height="12" fill="#fbf7ef" />
              <path d="M0 0h6v6h-6zM6 6h6v6h-6z" fill="#161a22" />
            </pattern>
            {TEXTURES.map(name => (
              // Half a px of overlap, so no hairline shows between two tiles.
              <pattern key={name} id={`rm-${name}`} width={tile} height={tile} patternUnits="userSpaceOnUse">
                <image href={mapAsset(name)} x="-0.25" y="-0.25" width={tile + 0.5} height={tile + 0.5} preserveAspectRatio="none" />
              </pattern>
            ))}
            {/* Fades whatever it is put on from opaque (top) to nothing (bottom). */}
            <linearGradient id="rm-fade-down" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </linearGradient>
            <mask id="rm-fade" maskContentUnits="objectBoundingBox">
              <rect width="1" height="1" fill="url(#rm-fade-down)" />
            </mask>
            <linearGradient id="rm-ground-tail" gradientUnits="userSpaceOnUse" x1="0" y1={breakY} x2="0" y2={H}>
              <stop offset="0" className="rm-stop-dusk-ground" stopOpacity="0" />
              <stop offset={clamp(BAND / (H - breakY)).toFixed(4)} className="rm-stop-dusk-ground" stopOpacity="0.44" />
              <stop offset={clamp((fadeY - breakY) / (H - breakY)).toFixed(4)} className="rm-stop-dusk-ground" stopOpacity="0.44" />
              <stop offset="1" className="rm-stop-dusk-ground" stopOpacity="0" />
            </linearGradient>
            {woods && (
              <linearGradient id="rm-woods" gradientUnits="userSpaceOnUse" x1="0" y1={woodsTop} x2="0" y2={woodsEnd}>
                <stop offset="0" className="rm-stop-woods" stopOpacity="0" />
                <stop offset={woodsAt(woodsTop + Math.min(H * 0.08, (woodsHold - woodsTop) / 2))} className="rm-stop-woods" stopOpacity="0.2" />
                <stop offset={woodsAt(woodsHold)} className="rm-stop-woods" stopOpacity="0.2" />
                <stop offset="1" className="rm-stop-woods" stopOpacity="0" />
              </linearGradient>
            )}
            <radialGradient id="rm-calm">
              <stop offset="0" className="rm-stop-calm" stopOpacity="0.56" />
              <stop offset="0.72" className="rm-stop-calm" stopOpacity="0.5" />
              <stop offset="1" className="rm-stop-calm" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="rm-tint-tail" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
              {tailStops.map((stop, index) => (
                <stop key={index} offset={clamp(stop.at).toFixed(4)} stopColor={stop.color} />
              ))}
            </linearGradient>
            <linearGradient id="rm-tint-body" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
              <stop offset="0" stopColor={rgba(TINT_GOLD, 0.16)} />
              <stop offset="0.5" stopColor={rgba(TINT_GOLD, 0)} />
              <stop offset="0.5" stopColor={rgba(TINT_DUSK, 0)} />
              <stop offset={Math.max(0.5, breakY / H).toFixed(4)} stopColor={rgba(atBreak.rgb, atBreak.alpha)} />
              <stop offset={Math.max(0.5, bandEnd / H).toFixed(4)} stopColor={rgba(atBreak.rgb, 0)} />
            </linearGradient>
            {/* Each stretch runs a few px into the next one, so no seam shows where they meet. */}
            <path id="rm-road-body" d={track.slice(0, breakLen + SEAM_OVERLAP)} />
            <path id="rm-road-tail" d={track.slice(breakLen, track.length)} />
            {/* The whole road stops where the slabs of its broken end start (the fx layer). */}
            <clipPath id="rm-road-keep">
              <path d={edge.keep} />
            </clipPath>
            {/* Moon glow: light that falls off to nothing (a flat fill reads as a grey disc). */}
            <radialGradient id="rm-moon-glow">
              <stop offset="0.3" className="rm-stop-moon" stopOpacity="0.26" />
              <stop offset="1" className="rm-stop-moon" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ground of the last stretch: fades after the finish line. Drawn under everything. */}
          <g>
            {/* One px taller than its share: the joint with the fading rect never shows. */}
            <rect x="0" y={breakY} width={W} height={fadeY - breakY + 1} fill="url(#rm-grass)" />
            <rect x="0" y={fadeY} width={W} height={H - fadeY} fill="url(#rm-grass)" mask="url(#rm-fade)" />
            <rect x="0" y={breakY} width={W} height={H - breakY} fill="url(#rm-ground-tail)" />
            <rect x={stand.x + 3} y={stand.y + 5} width={stand.w} height={stand.h} rx="6" className="rm-shade rm-shade--hard" />
            {Array.from({ length: stand.tiles }, (_, index) => (
              <image
                key={index}
                href={mapAsset('stand')}
                x={stand.x}
                y={stand.y + index * (stand.tileH + 4)}
                width={stand.w}
                height={stand.tileH}
                preserveAspectRatio="none"
              />
            ))}
          </g>

          {/* Ground of the rest of the map. Its lower band fades into the last stretch. */}
          <rect x="0" y="0" width={W} height={breakY + 1} fill="url(#rm-grass)" />
          <rect x="0" y={breakY} width={W} height={BAND} fill="url(#rm-grass)" mask="url(#rm-fade)" />
          {woods && <rect x="0" y={woodsTop} width={W} height={woodsEnd - woodsTop} fill="url(#rm-woods)" />}
          {scenery.patches.map((d, index) => (
            <path key={index} d={d} className="rm-patch" />
          ))}
          <path d={scenery.sand} className="rm-sand-edge" fill="url(#rm-sand)" />
          <path d={scenery.wetSand} className="rm-wet-sand" />
          {/* Sea: the texture, lighter in the shallows and deeper far from the shore. */}
          <path d={scenery.shallow} fill="url(#rm-sea)" />
          <path d={scenery.shallow} className="rm-shallow" />
          {scenery.sea && <path d={scenery.sea} fill="url(#rm-sea)" />}
          {scenery.seaDeep && <path d={scenery.seaDeep} className="rm-sea-deep" />}
          <path d={scenery.foam} className="rm-foam" />
          {scenery.foamInner && <path d={scenery.foamInner} className="rm-foam rm-foam--inner" />}
          {scenery.cove && <path d={scenery.cove} fill="url(#rm-sea)" />}
          {scenery.coveFoam && <path d={scenery.coveFoam} className="rm-foam" />}
          {calmBox && (
            // Calm area behind the hero text: a light wash over the textured ground, so the
            // title, the lede and the numbers keep their contrast.
            <ellipse
              cx={(calmBox.left + calmBox.right) / 2}
              cy={(calmBox.top + calmBox.bottom) / 2}
              rx={((calmBox.right - calmBox.left) / 2 + 28) * Math.SQRT2}
              ry={((calmBox.bottom - calmBox.top) / 2 + 22) * Math.SQRT2}
              fill="url(#rm-calm)"
            />
          )}
          {cliff && (
            // A step in the ground: the shadow it throws on the lower grass, the face, the shaded
            // band along its foot, a seam in the rock and the lit top edge.
            <>
              <path d={cliff.face} className="rm-cliff-shadow" transform="translate(4 13)" />
              <path d={cliff.face} className="mf-sand-2" />
              <path d={cliff.foot} className="rm-cliff-foot" />
              <path d={cliff.lip} className="rm-cliff-lip" />
            </>
          )}
          {village && (
            <>
              <path d={village.plaza} className="rm-sand-edge" fill="url(#rm-sand)" />
              <path d={village.streets} className="rm-street" stroke="url(#rm-sand)" strokeWidth={village.streetWidth} />
            </>
          )}
          {river && (
            <>
              <path d={river.water} className="rm-river-bank" />
              <path d={river.water} className="rm-river" fill="url(#rm-sea)" />
              <path d={river.deep} className="rm-river-deep" strokeWidth={river.deepWidth} />
              {river.stones && <path d={river.stones} className="rm-river-stones" />}
            </>
          )}

          {/* Road. The last stretch is cut where its broken end starts. */}
          <g fill="none" strokeLinejoin="round">
            <g clipPath="url(#rm-road-keep)">
              <RoadShadow id="rm-road-tail" roadW={roadW} />
            </g>
            <RoadShadow id="rm-road-body" roadW={roadW} />
            <g clipPath="url(#rm-road-keep)">
              <Road id="rm-road-tail" offset={tailOffset} roadW={roadW} />
              {finishMark}
            </g>
          </g>

          {/* Scenery of the last stretch: fades with its ground. */}
          <g>
            {shadows.tailSoft && <path d={shadows.tailSoft} className="rm-shade" />}
            {shadows.tailCore && <path d={shadows.tailCore} className="rm-shade" />}
            <Pieces scenery={scenery} tail />
          </g>

          <g fill="none" strokeLinejoin="round">
            <Road id="rm-road-body" offset={0} roadW={roadW} />
          </g>
          {bridge && (
            // Wooden deck over the stream (sprite): it covers the road and its kerbs there.
            <g transform={`translate(${bridge.x.toFixed(1)} ${bridge.y.toFixed(1)}) rotate(${(bridge.angle + 90).toFixed(1)})`}>
              <rect x={-bridgeAlong / 2 - 3} y={-bridgeAcross / 2 + 1} width={bridgeAlong + 6} height={bridgeAcross + 4} rx="6" className="rm-shade rm-shade--hard" />
              <image
                href={mapAsset('bridge')}
                x={-bridgeAlong / 2}
                y={-bridgeAcross / 2}
                width={bridgeAlong}
                height={bridgeAcross}
                preserveAspectRatio="none"
              />
            </g>
          )}
          {slots.map(slot => (
            <rect key={slot.key} x={slot.x - roadW * 0.21} y={slot.y} width={roadW * 0.42} height="3" rx="1" className="rm-slot" />
          ))}
          <rect x={startLine.x - roadW / 2} y={startLine.y} width={roadW} height="8" fill="url(#rm-check)" />
          {/* Soft shadows of every piece: two stacked fills in one path each, no filter. */}
          {shadows.soft && <path d={shadows.soft} className="rm-shade" />}
          {shadows.core && <path d={shadows.core} className="rm-shade" />}
          <Pieces scenery={scenery} tail={false} />

          {/* Hour of the day: gold at the top, dusk towards the finish. */}
          <rect x="0" y="0" width={W} height={bandEnd} fill="url(#rm-tint-body)" />
          <rect x="0" y={breakY} width={W} height={H - breakY} fill="url(#rm-tint-tail)" />

          {/* No moon or stars on the race map (owner, 2026-11-18): the sky only appears in space. */}
        </svg>
      </div>

      {/* The broken end of the road (spec-v4 §1): slabs of the real road (each one a clipped
          piece of it, so it carries its asphalt, centre line and kerb), further adrift, smaller
          and darker towards the end, with gravel between them. Static; drawn with reduced
          motion too. Outside the map SVG: it does not count in its element budget. */}
      <svg
        key="fx"
        ref={fxRef}
        className={`race-fx${floating ? ' is-floating' : ''}`}
        viewBox={`0 ${edge.top} ${W} ${edge.bottom - edge.top}`}
        width={W}
        height={edge.bottom - edge.top}
        style={{ top: edge.top }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {edge.slabs.map((slab, index) => (
            <clipPath key={index} id={`rm-slab-${index}`}>
              <path d={slab.d} />
            </clipPath>
          ))}
        </defs>
        {edge.gravel.map((grit, index) => (
          <circle key={index} cx={grit.x.toFixed(1)} cy={grit.y.toFixed(1)} r={grit.r.toFixed(2)} className="fx-grit" opacity={grit.o.toFixed(2)} />
        ))}
        {edge.chips.map((chip, index) => (
          <path key={index} d={chip.d} className={chip.red ? 'fx-chip fx-chip--red' : 'fx-chip'} opacity={chip.o.toFixed(2)} />
        ))}
        {/* The furthest slabs first: the ones nearer the road lie over them. */}
        {edge.slabs
          .map((slab, index) => ({ slab, index }))
          .reverse()
          .map(({ slab, index }) => {
            const place = `translate(${(slab.cx + slab.dx).toFixed(1)} ${(slab.cy + slab.dy).toFixed(1)}) rotate(${slab.rot.toFixed(1)}) scale(${slab.scale.toFixed(3)}) translate(${(-slab.cx).toFixed(1)} ${(-slab.cy).toFixed(1)})`;
            const veil = slabVeil((slab.cy + slab.dy) / H, nightAt, slab.bright);
            return (
              <g key={index} className={slab.k > 0 ? 'fx-slab fx-slab--loose' : 'fx-slab'} style={{ animationDelay: `${slab.delay.toFixed(2)}s` }}>
                {/* Its shadow, further from it the more it has fallen. */}
                <path
                  d={slab.d}
                  className="fx-slab__shadow"
                  opacity={(0.14 + 0.2 * Math.min(1, slab.k * 3)).toFixed(2)}
                  transform={`translate(${slab.shadowX.toFixed(1)} ${slab.shadowY.toFixed(1)}) ${place}`}
                />
                {/* The thickness of the plate: a darker band along its lower edges. */}
                <path d={slab.d} className="fx-slab__side" transform={`translate(0.6 ${(4 * slab.scale).toFixed(1)}) ${place}`} />
                <g transform={place}>
                  <g clipPath={`url(#rm-slab-${index})`} fill="none" strokeLinejoin="round">
                    <Road id="rm-road-tail" offset={tailOffset} roadW={roadW} />
                  </g>
                  {veil.opacity > 0.01 && <path d={slab.d} fill={veil.fill} opacity={veil.opacity.toFixed(3)} />}
                </g>
              </g>
            );
          })}
      </svg>

      {cars}
    </>
  );
}
