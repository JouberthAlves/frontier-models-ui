import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import SceneryDefs from './SceneryDefs';
import { orbitArena } from '../../data/archive';
import { colorOf } from '../../data/models';
import { markStep, preloadImages } from '../../lib/boot';
import { useReducedMotion } from '../../lib/motion';
import { setRoadBroken } from '../../lib/raceState';
import { buildChunks, buildScenery, type Chunk, type ChunkKind, type Rect, type Scenery } from '../../lib/scenery';
import { MAP_ASSET_URLS, mapAsset, TEXTURES, TEXTURE_SIZE } from '../../lib/sceneryKit';
import { buildTrack, CAR_SPACING, TRACK_STEP, type BlockRect, type Track, type TrackSide } from '../../lib/track';
import './RaceMap.css';

/**
 * The racing zone (spec-v2): a pastel top-down map behind the hero and the Racing section, the
 * S-shaped track computed from the real block rectangles, neutral cars driven by the scroll
 * position, the finish line, and the zero-g flight of each car to its Orbitarium planet. One car
 * per current Orbitarium run (from archive.json).
 *
 * The break-up of the last stretch is NOT tied to the scroll (spec-v3 §2): the road stays whole
 * while any car is on it; when the last car leaves its end, one timed animation runs (crack,
 * let go and drift, turn into stars). Scrolling back until a car is on the road again plays it
 * backwards, once.
 *
 * Per frame only `transform` / `opacity` change, on the cars and on the visible pieces.
 */

const NAV_H = 64;
const GRID_TOP = NAV_H + 34;
/** Length of the last stretch (before the finish) that breaks up. */
const BREAK_BEFORE_FINISH = 640;
const BAND = 220;
/** The ground fades out over this many px at the very end of the map. */
const GROUND_FADE = 200;
/** px each stretch of road is drawn past its end, under the next one. */
const SEAM_OVERLAP = 8;
/** The road fades out over its last px instead of ending in a square cut. */
const ROAD_END_FADE = 90;
/** The end of the road is broken for good (spec change 2026-11-18, owner): over its last px the
 *  road turns into loose pieces that hang in the air, and the cars jump off that edge into space. */
const EDGE_LEN = 240;
const TINT_GOLD = [255, 196, 120] as const;
const TINT_DUSK = [60, 70, 120] as const;
const TINT_NIGHT = [16, 30, 53] as const;
/**
 * Same colors as the --map-* tokens (road) and as the sprites (leaves, roof tiles): the pieces
 * that break off are tinted for their hour of the day.
 */
const CHUNK_RGB: Record<ChunkKind, readonly number[]> = {
  asphalt: [95, 102, 119],
  'kerb-red': [227, 93, 82],
  'kerb-white': [251, 247, 239],
  leaf: [98, 164, 62],
  roof: [222, 98, 54]
};

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
  chunks: Chunk[];
  /** Phones: per track sample, how hidden a car is there (1 = under a card). Null on wider screens. */
  cover: Float32Array | null;
  /** Document y the leading car is at when its flight ends. */
  floatEndY: number;
  /**
   * The Orbitarium heading and lede, which the flying cars must not cross: they go down the
   * free margin at `x` while between `top` and `bottom`. `x` is null when there is no margin
   * to use (phones, tablets): there the cars dim while they are behind the text.
   */
  avoid: { x: number | null; top: number; bottom: number } | null;
  signature: number[];
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};
const bez = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
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

/** A map color as it looks under the dusk tint at that height. */
function tinted(rgb: readonly number[], f: number, nightAt: number): string {
  const tint = duskAt(f, nightAt);
  return `rgb(${rgb.map((value, index) => Math.round(mix(value, tint.rgb[index], tint.alpha))).join(',')})`;
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
  const orbitLayout = document.querySelector<HTMLElement>('.orbitarium__layout');
  const orbitSvg = document.querySelector<SVGSVGElement>('.orbit-map');
  const orbitTop = orbitLayout ? orbitLayout.getBoundingClientRect().top - origin.top : finishY + 900;
  const orbitHalf = orbitSvg ? Math.min(220, orbitSvg.getBoundingClientRect().height / 2) : 160;
  const floatEndY = orbitTop + orbitHalf;
  const orbitHead = document.querySelector<HTMLElement>('#orbitarium .section__head');
  const headRect = orbitHead ? rectOf(orbitHead) : null;
  const avoid =
    headRect && headRect.bottom > headRect.top
      ? { x: headRect.left >= 46 ? Math.max(22, headRect.left / 2) : null, top: headRect.top, bottom: headRect.bottom }
      : null;

  // Nothing moved by 2 px or more: keep the current map.
  const signature = [W, finishY, floatEndY, avoid?.top ?? 0, avoid?.bottom ?? 0, ...blocks.flatMap(block => [block.left, block.right, block.top, block.bottom])];
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
    cars: orbitArena.length
  });
  // Whole pixels: the ground is made of rects that meet at breakY (and at the fade line), and a
  // joint on a fraction of a pixel shows as a hairline across the map.
  const H = Math.ceil(track.endY + 40);
  const breakY = Math.round(Math.max(blocks[0].bottom, finishY - BREAK_BEFORE_FINISH));
  const breakLen = track.lenAtY(breakY);
  const scenery = buildScenery({ width: W, height: H, breakY, blocks, calm, track, contentLeft });
  const chunks = buildChunks(track, breakLen, scenery.pieces, W);

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

  return { W, H, breakY, breakLen, track, scenery, chunks, cover, floatEndY, avoid, signature };
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

  // The scroll-driven engine: cars, finish flags, break-up, sky and planets.
  useLayoutEffect(() => {
    const carsRoot = carsRef.current;
    const root = rootRef.current;
    if (!layout || !carsRoot || !root) return undefined;
    const { track, W, chunks, cover, breakLen, floatEndY, avoid } = layout;
    const cars = Array.from(carsRoot.querySelectorAll<HTMLElement>('.race-car')).map(el => ({
      el,
      tint: el.querySelector<SVGElement>('.race-car__tint')
    }));
    const count = cars.length;
    const scale = track.carScale;
    const gridLead = track.gridLead;
    const gridY = track.at(gridLead).y;
    const end = track.at(track.length);
    const floatSpan = Math.max(300, floatEndY - track.endY);
    const slotShift = track.roadW * 0.16;
    // Page origin of the layers (read once per layout, never per frame).
    const originRect = carsRoot.getBoundingClientRect();
    const originX = originRect.left + window.scrollX;
    const originY = originRect.top + window.scrollY;

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
      car.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(p.angle - 90 + wobble).toFixed(1)}deg) scale(${scale})`;
      car.el.style.opacity = cover ? (1 - cover[clamp(Math.round(length / TRACK_STEP), 0, cover.length - 1)]).toFixed(2) : '1';
      if (car.tint) car.tint.style.opacity = '0';
    };

    carsRoot.dataset.ready = 'true';

    if (reduced) {
      // Reduced motion: cars parked on the grid, nothing breaks, planets stay visible.
      for (let i = 0; i < count; i += 1) placeOnTrack(i, gridLead - i * CAR_SPACING, 0, 1);
      return undefined;
    }

    const sky = document.querySelector<HTMLElement>('[data-race-sky]');
    const fx = fxRef.current;
    const flags = flagsRef.current;
    // Tail of the map: the ground, scenery and dusk tint fade together; the road is one piece.
    const tailLayers = Array.from(root.querySelectorAll<SVGElement>('[data-tail]'));
    const tailShadow = root.querySelector<SVGElement>('[data-tail-shadow]');
    const tailRoad = root.querySelector<SVGElement>('[data-tail-road]');
    const chunkNodes = fx
      ? Array.from(fx.querySelectorAll<SVGGElement>('[data-chunk]')).map(g => ({
          g,
          body: g.firstElementChild as SVGElement | null,
          star: g.lastElementChild as SVGElement | null
        }))
      : [];
    let planets: { wrap: HTMLElement | SVGElement; body: Element | null }[] = [];
    const planetShown: number[] = [];
    const findPlanets = () => {
      planets = Array.from(document.querySelectorAll<SVGElement>('[data-orbit-planet]'))
        .sort((a, b) => Number(a.dataset.orbitPlanet) - Number(b.dataset.orbitPlanet))
        .map(wrap => ({ wrap, body: wrap.querySelector('[data-orbit-body]') }));
      planetShown.length = 0;
    };
    const showPlanet = (index: number, opacity: number) => {
      const planet = planets[index];
      if (!planet) return;
      const value = Math.round(opacity * 100) / 100;
      if (planetShown[index] === value) return;
      planetShown[index] = value;
      planet.wrap.style.opacity = String(value);
      planet.wrap.dataset.arrival = value === 0 ? 'waiting' : value >= 0.5 ? 'arrived' : 'landing';
    };

    const carsSpan = (count - 1) * CAR_SPACING;

    /* ---------- the broken end of the road (static) ---------- */
    const tailSpan = Math.max(1, track.length - breakLen);
    // The broken end: pieces of the last EDGE_LEN px of road, the further along the more loose.
    const edgeStart = track.length - Math.min(EDGE_LEN, tailSpan);
    const edgeK = chunks.map(chunk =>
      chunk.kind === 'leaf' || chunk.kind === 'roof' ? -1 : clamp((chunk.at - edgeStart) / Math.max(1, track.length - edgeStart))
    );
    const applyEdge = () => {
      if (tailRoad) tailRoad.style.opacity = '1';
      if (tailShadow) tailShadow.style.opacity = '1';
      if (!fx) return;
      fx.style.display = 'block';
      chunkNodes.forEach((node, index) => {
        const chunk = chunks[index];
        if (!chunk || !node.body || !node.star) return;
        const k = edgeK[index];
        if (k <= 0) {
          node.body.style.opacity = '0';
          node.star.style.opacity = '0';
          return;
        }
        // Still attached at the start of the edge, more and more adrift towards the end.
        const drift = 0.04 + 0.42 * Math.pow(k, 1.7);
        const x = chunk.x + chunk.dx * drift * 0.45;
        const y = chunk.y + chunk.dy * drift * 0.5;
        node.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(chunk.turn + chunk.rot * drift * 0.5).toFixed(1)})`);
        node.body.setAttribute('transform', `scale(${mix(1, 0.72, k).toFixed(3)})`);
        node.body.style.opacity = mix(1, 0.8, k).toFixed(3);
        node.star.style.opacity = '0';
      });
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
      const flying = lead > track.length && lead - (count - 1) * CAR_SPACING < track.length + floatSpan;
      if (lead === lastLead && vh === lastVh && !flying) return;
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

      // The end of the road is broken from the start (applyEdge); when the last car has jumped
      // off it, the galaxy lights up.
      if (first) applyEdge();
      setRoadBroken(lead - carsSpan > track.length);

      if (lead > track.length && (!planets.length || !planets[0].wrap.isConnected)) findPlanets();

      const onGrid = 1 - smooth((lead - gridLead) / 160);
      for (let i = 0; i < count; i += 1) {
        const d = lead - i * CAR_SPACING;
        const car = cars[i];
        if (d <= track.length) {
          placeOnTrack(i, Math.max(0, d), wobble, onGrid);
          if (planets.length) showPlanet(i, 0);
          continue;
        }
        // Zero-g: a cubic Bézier from the end of the road to this car's planet. The car leaves
        // the road straight ahead at the speed it had on it (so the line keeps its spacing: no
        // pile-up at the end of the road) and slows down as it reaches the planet.
        const u = clamp((d - track.length) / floatSpan);
        const t = u * (1 + 0.5 * u - 0.5 * u * u);
        const planetOpacity = clamp((t - 0.75) / 0.25);
        showPlanet(i, planetOpacity);
        if (t >= 1) {
          car.el.style.opacity = '0';
          continue;
        }
        const rect = planets[i]?.body?.getBoundingClientRect();
        const tx = rect ? rect.left + rect.width / 2 + window.scrollX - originX : W / 2;
        const ty = rect ? rect.top + rect.height / 2 + sy - originY : floatEndY;
        const side = i % 2 ? 1 : -1;
        const y = bez(end.y, end.y + floatSpan / 3, ty - 260, ty, t);
        let x: number;
        let dim = 1;
        if (avoid && avoid.x !== null && avoid.bottom < ty) {
          // Around the Orbitarium heading and lede: out to the free margin above the text,
          // straight down beside it, then across to the planet.
          const above = avoid.top - 50;
          const below = avoid.bottom + 24;
          // Each car keeps its own lane in the margin so two cars never sit on the same pixel.
          const lane = clamp(avoid.x + ((i % 3) - 1) * 26, 18, Math.max(18, avoid.x * 2 - 18));
          if (y <= above) x = mix(end.x, lane, smooth((y - end.y - 40) / Math.max(1, above - end.y - 40)));
          else if (y <= below) x = lane;
          else x = mix(lane, tx, smooth((y - below) / Math.max(80, ty - below)));
          // A planet level with the text: the car finishes the move across while it fades.
          x = mix(x, tx, smooth((t - 0.72) / 0.23));
        } else {
          const c2 = clamp(tx - side * 160, 24, W - 24);
          x = bez(end.x, end.x, c2, tx, t);
          // No free margin (phones, tablets): the car dims while it is behind the text.
          if (avoid) dim = 1 - 0.75 * smooth((y - avoid.top + 70) / 60) * (1 - smooth((y - avoid.bottom) / 60));
        }
        const turn = t * t * (220 + (i % 4) * 60) * side;
        car.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${turn.toFixed(1)}deg) scale(${(scale * mix(1, 0.55, t) * (1 + 0.38 * Math.sin(Math.PI * Math.min(1, t / 0.32)))).toFixed(3)})`;
        car.el.style.opacity = (dim * (1 - clamp((t - 0.75) / 0.2))).toFixed(3);
        if (car.tint) car.tint.style.opacity = clamp(t * 1.4).toFixed(3);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    findPlanets();
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (sky) sky.style.opacity = '';
      [...tailLayers, tailShadow, tailRoad].forEach(node => {
        if (node) node.style.opacity = '';
      });
      if (fx) fx.style.display = 'none';
      planets.forEach(planet => {
        planet.wrap.style.opacity = '';
        delete planet.wrap.dataset.arrival;
      });
    };
  }, [layout, reduced]);

  const cars = (
    <div key="cars" ref={carsRef} className="race-cars" aria-hidden="true">
      {orbitArena.map(run => (
        <div key={run.key} className="race-car" style={{ ['--model' as string]: colorOf(run) }}>
          <svg viewBox="-14 -22 28 44" width="28" height="44" focusable="false">
            <rect x="-8" y="-16" width="20" height="38" rx="7" className="race-car__shadow" />
            <path d="M-12 -13h4v8h-4zM8 -13h4v8h-4zM-12 6h4v8h-4zM8 6h4v8h-4z" className="race-car__tyres" />
            <rect x="-10" y="-19" width="20" height="38" rx="7" className="race-car__paint" />
            <rect x="-10" y="-19" width="20" height="38" rx="7" className="race-car__tint" />
            <rect x="-2" y="-19" width="4" height="38" className="race-car__stripe" />
            <rect x="-6.5" y="-3" width="13" height="9" rx="2.5" className="race-car__glass" />
            <path d="M-7.5 15.4h4v2.2h-4zM3.5 15.4h4v2.2h-4z" className="race-car__lights" />
          </svg>
        </div>
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

  const { W, H, breakY, breakLen, track, scenery, chunks } = layout;
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
  const slots = orbitArena.map((run, index) => {
    const p = track.at(track.gridLead - index * CAR_SPACING + 24);
    return { key: run.key, x: p.x + (index % 2 ? 1 : -1) * roadW * 0.16, y: p.y };
  });
  const startLine = track.at(track.gridLead + 34);
  const { village, bridge, cliff, river, moon, stand, shadows, calmBox } = scenery;
  // Ground textures: 512 px tiles, smaller on phones (where every piece is smaller too).
  const tile = W < 768 ? TEXTURE_SIZE * 0.62 : TEXTURE_SIZE;
  const fadeY = Math.round(Math.max(breakY, H - GROUND_FADE));
  const tailTop = breakY - 80;
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
            {/* The road does not end in a square cut: its last px fade out. */}
            <linearGradient id="rm-road-end-fade" gradientUnits="userSpaceOnUse" x1="0" y1={track.endY - ROAD_END_FADE} x2="0" y2={track.endY}>
              <stop offset="0" stopColor="#fff" />
              <stop offset="1" stopColor="#000" />
            </linearGradient>
            <mask id="rm-road-end" maskUnits="userSpaceOnUse" x="0" y={tailTop} width={W} height={H - tailTop}>
              <rect x="0" y={tailTop} width={W} height={H - tailTop} fill="url(#rm-road-end-fade)" />
            </mask>
            {/* Moon glow: light that falls off to nothing (a flat fill reads as a grey disc). */}
            <radialGradient id="rm-moon-glow">
              <stop offset="0.3" className="rm-stop-moon" stopOpacity="0.26" />
              <stop offset="1" className="rm-stop-moon" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ground of the last stretch: fades after the finish line. Drawn under everything. */}
          <g data-tail="ground">
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

          {/* Road. The last stretch is one piece: it stays whole until the last car has left it,
              then goes out as its pieces (the fx layer) take its place. */}
          <g fill="none" strokeLinejoin="round">
            <g data-tail-shadow mask="url(#rm-road-end)">
              <RoadShadow id="rm-road-tail" roadW={roadW} />
            </g>
            <RoadShadow id="rm-road-body" roadW={roadW} />
            <g data-tail-road mask="url(#rm-road-end)">
              <Road id="rm-road-tail" offset={Math.floor(breakLen / TRACK_STEP) * TRACK_STEP} roadW={roadW} />
              {finishMark}
            </g>
          </g>

          {/* Scenery of the last stretch: fades with its ground. */}
          <g data-tail="scenery">
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
          <rect data-tail="tint" x="0" y={breakY} width={W} height={H - breakY} fill="url(#rm-tint-tail)" />

          {/* Night at the finish, over the tint so it stays bright: the first stars and a crescent moon. */}
          <g data-tail="sky">
            {scenery.stars.map((star, index) => (
              <path key={index} d={star.d} className="rm-star" opacity={star.o} />
            ))}
            <circle cx={moon.x} cy={moon.y} r={moon.r * 2.6} fill="url(#rm-moon-glow)" />
            <path
              d="M.586 -.81A1 1 0 1 0 .586 .81A.82 .82 0 1 1 .586 -.81Z"
              className="rm-moon"
              transform={`translate(${moon.x.toFixed(1)} ${moon.y.toFixed(1)}) rotate(210) scale(${moon.r.toFixed(1)})`}
            />
          </g>
        </svg>
      </div>

      {!reduced && (
        <svg
          key="fx"
          ref={fxRef}
          className="race-fx"
          viewBox={`0 0 ${W} ${H + 760}`}
          width={W}
          height={H + 760}
          style={{ display: 'none' }}
          aria-hidden="true"
          focusable="false"
        >
          {chunks.map((chunk, index) => (
            <g key={index} data-chunk transform={`translate(${chunk.x.toFixed(1)} ${chunk.y.toFixed(1)}) rotate(${chunk.turn.toFixed(1)})`}>
              <path d={chunk.d} fill={tinted(CHUNK_RGB[chunk.kind], chunk.y / H, nightAt)} opacity="0" />
              <circle r="1.3" className={chunk.cool ? 'fx-star fx-star--cool' : 'fx-star'} />
            </g>
          ))}
        </svg>
      )}

      {cars}
    </>
  );
}
