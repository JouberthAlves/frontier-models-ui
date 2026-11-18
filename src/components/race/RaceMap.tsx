import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import SceneryDefs from './SceneryDefs';
import { orbitArena } from '../../data/archive';
import { colorOf } from '../../data/models';
import { markStep } from '../../lib/boot';
import { useReducedMotion } from '../../lib/motion';
import { buildChunks, buildScenery, type Chunk, type Scenery } from '../../lib/scenery';
import { buildTrack, CAR_SPACING, type BlockRect, type Track, type TrackSide } from '../../lib/track';
import './RaceMap.css';

/**
 * The racing zone (spec-v2): a pastel top-down map behind the hero and the Racing section, the
 * S-shaped track computed from the real block rectangles, neutral cars driven by the scroll
 * position, the finish line, the last stretch breaking into stars and the zero-g flight of each
 * car to its Orbitarium planet. One car per current Orbitarium run (from archive.json).
 *
 * Per frame only `transform` / `opacity` change, on the cars and on the visible pieces.
 */

const NAV_H = 64;
const GRID_TOP = NAV_H + 34;
/** Length of the last stretch (before the finish) that breaks up. */
const BREAK_BEFORE_FINISH = 640;
const BAND = 220;
const TINT_GOLD = [255, 196, 120] as const;
const TINT_DUSK = [60, 70, 120] as const;
const TINT_NIGHT = [16, 30, 53] as const;

interface Layout {
  W: number;
  H: number;
  breakY: number;
  breakLen: number;
  track: Track;
  scenery: Scenery;
  chunks: Chunk[];
  /** Document y the leading car is at when its flight ends. */
  floatEndY: number;
  signature: number[];
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};
const bez = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};
const rgba = (rgb: readonly number[], alpha: number) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(3)})`;

/** Dusk tint at a fraction of the map height (between the 50% and the last stops). */
function duskAt(f: number, nightAt: number): { rgb: number[]; alpha: number } {
  if (f <= 0.5) return { rgb: [...TINT_DUSK], alpha: 0 };
  if (f <= 0.85) return { rgb: [...TINT_DUSK], alpha: (0.18 * (f - 0.5)) / 0.35 };
  const t = clamp((f - 0.85) / Math.max(0.001, nightAt - 0.85));
  return { rgb: TINT_DUSK.map((value, index) => mix(value, TINT_NIGHT[index], t)), alpha: mix(0.18, 0.5, t) };
}

function measure(root: HTMLElement, previous: Layout | null): Layout | null {
  const origin = root.getBoundingClientRect();
  const W = document.documentElement.clientWidth;
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-track-side]'));
  const finishNode = document.querySelector<HTMLElement>('[data-track-finish]');
  const heroNode = document.getElementById('top');
  if (!nodes.length || !finishNode || W < 200) return null;

  const blocks: BlockRect[] = nodes
    .map(node => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left - origin.left,
        right: rect.right - origin.left,
        top: rect.top - origin.top,
        bottom: rect.bottom - origin.top,
        side: (node.dataset.trackSide as TrackSide) ?? 'full'
      };
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

  // Nothing moved by 2 px or more: keep the current map.
  const signature = [W, finishY, floatEndY, ...blocks.flatMap(block => [block.left, block.right, block.top, block.bottom])];
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
  const H = track.endY + 40;
  const breakY = Math.max(blocks[0].bottom, finishY - BREAK_BEFORE_FINISH);
  const breakLen = track.lenAtY(breakY);
  const scenery = buildScenery({ width: W, height: H, breakY, blocks, track, contentLeft });
  const chunks = buildChunks(track, breakLen, scenery.pieces, W);
  return { W, H, breakY, breakLen, track, scenery, chunks, floatEndY, signature };
}

function Road({ id, offset, roadW }: { id: string; offset: number; roadW: number }) {
  const href = `#${id}`;
  return (
    <g fill="none" strokeLinejoin="round">
      <use href={href} className="rm-road-shadow" strokeWidth={roadW + 12} transform="translate(3 4)" />
      <use href={href} className="rm-kerb-red" strokeWidth={roadW + 10} />
      <use href={href} className="rm-kerb-white" strokeWidth={roadW + 10} strokeDasharray="14 14" strokeDashoffset={offset % 28} />
      <use href={href} className="rm-asphalt" strokeWidth={roadW} />
      <use href={href} className="rm-centre" strokeWidth={2} strokeDasharray="18 22" strokeDashoffset={offset % 40} />
    </g>
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
            transform={`translate(${piece.x.toFixed(1)} ${piece.y.toFixed(1)})${piece.r ? ` rotate(${piece.r})` : ''} scale(${piece.s.toFixed(2)})`}
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
  const tailRef = useRef<SVGGElement>(null);
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
    const run = () => {
      if (!alive) return;
      setLayout(previous => measure(root, previous) ?? previous);
      markStep('map');
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
    if (!layout || !carsRoot) return undefined;
    const { track, W, chunks, floatEndY } = layout;
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
    // Page origin of the layers (read once per layout, never per frame).
    const originRect = carsRoot.getBoundingClientRect();
    const originX = originRect.left + window.scrollX;
    const originY = originRect.top + window.scrollY;

    const placeOnTrack = (index: number, length: number, wobble: number) => {
      const p = track.at(length);
      const car = cars[index];
      car.el.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) rotate(${(p.angle - 90 + wobble).toFixed(1)}deg) scale(${scale})`;
      car.el.style.opacity = '1';
      if (car.tint) car.tint.style.opacity = '0';
    };

    carsRoot.dataset.ready = 'true';

    if (reduced) {
      // Reduced motion: cars parked on the grid, nothing breaks, planets stay visible.
      for (let i = 0; i < count; i += 1) placeOnTrack(i, gridLead - i * CAR_SPACING, 0);
      return undefined;
    }

    const sky = document.querySelector<HTMLElement>('[data-race-sky]');
    const fx = fxRef.current;
    const tail = tailRef.current;
    const flags = flagsRef.current;
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
      const wobble = Number.isNaN(lastLead) ? 0 : clamp((lead - lastLead) / 40, -1, 1);
      lastLead = lead;
      lastVh = vh;

      const T = clamp((lead - track.finishLen) / (vh * 1.1));
      if (T !== lastT) {
        lastT = T;
        if (sky) sky.style.opacity = smooth(T).toFixed(3);
        if (tail) tail.style.opacity = (1 - smooth((T - 0.2) / 0.55)).toFixed(3);
        flags?.classList.toggle('is-waving', lead >= track.finishLen);
        if (fx) {
          fx.style.display = T > 0 ? 'block' : 'none';
          if (T > 0) {
            chunkNodes.forEach((node, index) => {
              const chunk = chunks[index];
              if (!chunk || !node.body || !node.star) return;
              const t = ease(clamp((T - chunk.delay) / (1 - chunk.delay)));
              const x = chunk.x + chunk.dx * t;
              const y = chunk.y + chunk.dy * t;
              node.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(chunk.rot * t).toFixed(1)})`);
              node.body.setAttribute('transform', `scale(${mix(1, 0.2, t).toFixed(3)})`);
              node.body.style.opacity = t <= 0 ? '0' : (1 - clamp((t - 0.55) / 0.3)).toFixed(3);
              node.star.style.opacity = (clamp((t - 0.5) / 0.3) * chunk.glow).toFixed(3);
            });
          }
        }
      }

      if (lead > track.length && (!planets.length || !planets[0].wrap.isConnected)) findPlanets();

      for (let i = 0; i < count; i += 1) {
        const d = lead - i * CAR_SPACING;
        const car = cars[i];
        if (d <= track.length) {
          placeOnTrack(i, Math.max(0, d), wobble);
          if (planets.length) showPlanet(i, 0);
          continue;
        }
        // Zero-g: a cubic Bézier from the end of the road to this car's planet.
        const t = ease(clamp((d - track.length) / floatSpan));
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
        const c1 = clamp(end.x + side * (120 + (i % 4) * 40), 24, W - 24);
        const c2 = clamp(tx - side * 160, 24, W - 24);
        const x = bez(end.x, c1, c2, tx, t);
        const y = bez(end.y, end.y + 160, ty - 260, ty, t);
        const turn = t * (220 + (i % 4) * 60) * side;
        car.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${turn.toFixed(1)}deg) scale(${(scale * mix(1, 0.55, t)).toFixed(3)})`;
        car.el.style.opacity = (1 - clamp((t - 0.75) / 0.2)).toFixed(3);
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
  const atBreak = duskAt(breakY / H, nightAt);
  const slots = orbitArena.map((run, index) => {
    const p = track.at(track.gridLead - index * CAR_SPACING + 24);
    return { key: run.key, x: p.x + (index % 2 ? 1 : -1) * roadW * 0.16, y: p.y };
  });
  const startLine = track.at(track.gridLead + 34);

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
            <pattern id="rm-planks" width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" className="mf-wood" />
              <path d="M0 0V8" className="rm-plank-line" />
            </pattern>
            <pattern id="rm-stand" width="30" height="24" patternUnits="userSpaceOnUse">
              <rect width="30" height="8" className="mf-roof" />
              <rect y="8" width="30" height="8" className="mf-wall" />
              <rect y="16" width="30" height="8" className="mf-sea-deep" />
            </pattern>
            <linearGradient id="rm-ground-body" gradientUnits="userSpaceOnUse" x1="0" y1={breakY} x2="0" y2={breakY + BAND}>
              <stop offset="0" className="rm-stop-grass" />
              <stop offset="1" className="rm-stop-grass" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="rm-ground-tail" gradientUnits="userSpaceOnUse" x1="0" y1={breakY} x2="0" y2={H}>
              <stop offset="0" className="rm-stop-grass-dark" />
              <stop offset={clamp((H - 200 - breakY) / (H - breakY)).toFixed(4)} className="rm-stop-grass-dark" />
              <stop offset="1" className="rm-stop-grass-dark" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="rm-tint-tail" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
              <stop offset="0" stopColor={rgba(TINT_GOLD, 0.16)} />
              <stop offset="0.5" stopColor={rgba(TINT_GOLD, 0)} />
              <stop offset="0.5" stopColor={rgba(TINT_DUSK, 0)} />
              <stop offset="0.85" stopColor={rgba(TINT_DUSK, 0.18)} />
              <stop offset={nightAt.toFixed(4)} stopColor={rgba(TINT_NIGHT, 0.5)} />
              <stop offset="1" stopColor={rgba(TINT_NIGHT, 0)} />
            </linearGradient>
            <linearGradient id="rm-tint-body" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
              <stop offset="0" stopColor={rgba(TINT_GOLD, 0.16)} />
              <stop offset="0.5" stopColor={rgba(TINT_GOLD, 0)} />
              <stop offset="0.5" stopColor={rgba(TINT_DUSK, 0)} />
              <stop offset={Math.max(0.5, breakY / H).toFixed(4)} stopColor={rgba(atBreak.rgb, atBreak.alpha)} />
              <stop offset={Math.max(0.5, (breakY + BAND) / H).toFixed(4)} stopColor={rgba(atBreak.rgb, 0)} />
            </linearGradient>
            <path id="rm-road-body" d={track.slice(0, breakLen)} />
            <path id="rm-road-tail" d={track.slice(breakLen, track.length)} />
          </defs>

          {/* Last stretch: fades and breaks up after the finish line. Drawn under the rest. */}
          <g ref={tailRef} className="race-map__tail">
            <rect x="0" y={breakY} width={W} height={H - breakY} fill="url(#rm-ground-tail)" />
            {scenery.patches.map((patch, index) =>
              patch.tail ? <ellipse key={index} cx={patch.cx} cy={patch.cy} rx={patch.rx} ry={patch.ry} className="mf-grass-2" /> : null
            )}
            <rect x={scenery.stand.x} y={scenery.stand.y} width={scenery.stand.w} height={scenery.stand.h} rx="4" fill="url(#rm-stand)" />
            <Road id="rm-road-tail" offset={breakLen} roadW={roadW} />
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
            <Pieces scenery={scenery} tail />
            {scenery.stars.map((star, index) => (
              <circle key={index} cx={star.x.toFixed(1)} cy={star.y.toFixed(1)} r={star.r.toFixed(2)} fill="#fff" opacity={star.o.toFixed(2)} />
            ))}
            <rect x="0" y={breakY} width={W} height={H - breakY} fill="url(#rm-tint-tail)" />
          </g>

          <g className="race-map__body">
            <rect x="0" y="0" width={W} height={breakY + BAND} fill="url(#rm-ground-body)" />
            {scenery.patches.map((patch, index) =>
              patch.tail ? null : <ellipse key={index} cx={patch.cx} cy={patch.cy} rx={patch.rx} ry={patch.ry} className="mf-grass-2" />
            )}
            <path d={scenery.sand} className="mf-sand" />
            <path d={scenery.seaTop} className="mf-sea" />
            <path d={scenery.seaDeep} className="mf-sea-deep" />
            <path d={scenery.foam} className="rm-foam" />
            {scenery.cove && <path d={scenery.cove} className="mf-sea" />}
            {scenery.coveFoam && <path d={scenery.coveFoam} className="rm-foam" />}
            {scenery.cliff && <path d={scenery.cliff} className="rm-cliff-shadow" transform="translate(0 7)" />}
            {scenery.cliff && <path d={scenery.cliff} className="rm-cliff" />}
            {scenery.plaza && (
              <ellipse cx={scenery.plaza.cx} cy={scenery.plaza.cy} rx={scenery.plaza.rx} ry={scenery.plaza.ry} className="mf-sand" />
            )}
            {scenery.river && <path d={scenery.river.d} className="rm-river-bank" strokeWidth={scenery.river.width + 8} />}
            {scenery.river && <path d={scenery.river.d} className="rm-river" strokeWidth={scenery.river.width} />}
            {scenery.bridge && (
              <rect
                x={-scenery.bridge.w / 2}
                y={-scenery.bridge.h / 2}
                width={scenery.bridge.w}
                height={scenery.bridge.h}
                rx="3"
                fill="url(#rm-planks)"
                className="rm-bridge"
                transform={`translate(${scenery.bridge.x.toFixed(1)} ${scenery.bridge.y.toFixed(1)}) rotate(${scenery.bridge.angle.toFixed(1)})`}
              />
            )}
            <Road id="rm-road-body" offset={0} roadW={roadW} />
            {slots.map(slot => (
              <rect key={slot.key} x={slot.x - roadW * 0.21} y={slot.y} width={roadW * 0.42} height="3" rx="1" className="rm-slot" />
            ))}
            <rect x={startLine.x - roadW / 2} y={startLine.y} width={roadW} height="8" fill="url(#rm-check)" />
            <Pieces scenery={scenery} tail={false} />
            <rect x="0" y="0" width={W} height={breakY + BAND} fill="url(#rm-tint-body)" />
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
            <g key={index} data-chunk transform={`translate(${chunk.x.toFixed(1)} ${chunk.y.toFixed(1)})`}>
              <rect
                x={-chunk.size / 2}
                y={-chunk.size / 2}
                width={chunk.size}
                height={chunk.size}
                rx="1"
                className={`fx-chunk fx-chunk--${chunk.kind}`}
              />
              <circle r="1.3" className={chunk.cool ? 'fx-star fx-star--cool' : 'fx-star'} />
            </g>
          ))}
        </svg>
      )}

      {cars}
    </>
  );
}
