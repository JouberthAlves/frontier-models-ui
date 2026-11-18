import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Run } from '../data/archive';
import { colorOf } from '../data/models';
import { hasGpu } from '../lib/gpu';
import { useReducedMotion } from '../lib/motion';
import { useI18n } from '../i18n/i18n';

interface OrbitMapProps {
  runs: Run[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

const C = 300; // center of the 600×600 viewBox
const SQUASH = 0.42;
const TILT = -12;
const R_MIN = 92;
const R_MAX = 240;
/** Planet and sun (glow) radius, in viewBox units. */
const PLANET_R = 9;
const SUN_R = 40;

/** One orbit per run, from the data: radii spread between R_MIN and R_MAX, slower further out. */
function orbits(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const t = count > 1 ? index / (count - 1) : 0.5;
    return {
      radius: Math.round(R_MIN + (R_MAX - R_MIN) * t),
      period: Math.round(48 + 82 * Math.pow(t, 1.15)),
      // Golden-ratio steps keep the starting positions apart (fraction of a turn).
      phase: (0.08 + index * 0.381966) % 1
    };
  });
}

/**
 * Orbital map. Each planet orbits inside a group squashed by scale(1, 0.42) (the orbit is an
 * ellipse); the planet counter-rotates and counter-scales so it stays round and its label
 * upright. CSS animation on transform only; only with a real GPU and without reduced motion;
 * paused off screen and in hidden tabs.
 *
 * v3 look: thin white orbits, the sun as a soft white glow, planets as small shaded spheres in
 * the model color, small grey labels.
 *
 * v4: the planets no longer wait for a car. The map fades in on its own when it enters the
 * screen (the `.reveal-item` around it); with reduced motion it is simply visible.
 */
export default function OrbitMap({ runs, selectedKey, onSelect }: OrbitMapProps) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1.15);
  const spinning = !reduced && hasGpu();

  // Keep labels at ~14px and hit areas at ≥ 44px whatever the rendered size.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width || 600;
      setScale(600 / width);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  // Pause off screen / hidden tab.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !spinning) return undefined;
    let onScreen = true;
    const apply = () => svg.classList.toggle('is-paused', !onScreen || document.hidden);
    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(entries => {
            onScreen = entries.some(entry => entry.isIntersecting);
            apply();
          })
        : null;
    io?.observe(svg);
    document.addEventListener('visibilitychange', apply);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', apply);
    };
  }, [spinning]);

  const onKey = (event: KeyboardEvent<SVGGElement>, key: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(key);
    }
  };

  const labelSize = 13 * scale;
  const hit = Math.max(22 * scale, 18);
  const rings = orbits(runs.length);

  return (
    <svg
      ref={svgRef}
      className={`orbit-map${spinning ? ' is-spinning' : ''}`}
      viewBox="0 135 600 330"
      role="group"
      aria-label={t.orbitarium.map}
    >
      <defs>
        {/* The sun: warm (owner, 2026-11-18) — white-hot core, yellow body, orange glow. */}
        <radialGradient id="orbit-star" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6dc" />
          <stop offset="18%" stopColor="#ffd666" stopOpacity="0.98" />
          <stop offset="34%" stopColor="#ffab3d" stopOpacity="0.7" />
          <stop offset="60%" stopColor="#ff8a2a" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#ff8a2a" stopOpacity="0" />
        </radialGradient>
        {/* Light from the upper left and shade on the far side: makes a flat disc a small sphere. */}
        <radialGradient id="orbit-shade" cx="34%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="42%" stopColor="#fff" stopOpacity="0" />
          <stop offset="58%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.42" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={SUN_R} fill="url(#orbit-star)" />
      <g transform={`rotate(${TILT} ${C} ${C})`}>
        {rings.map((ring, index) => (
          <ellipse key={index} cx={C} cy={C} rx={ring.radius} ry={ring.radius * SQUASH} className="orbit-map__orbit" />
        ))}
        <g transform={`translate(${C} ${C}) scale(1 ${SQUASH}) translate(${-C} ${-C})`}>
          {runs.map((run, index) => {
            const ring = rings[index];
            const px = C + ring.radius;
            const selected = run.key === selectedKey;
            const delay = `${-(ring.phase * ring.period).toFixed(2)}s`;
            const timing = { animationDuration: `${ring.period}s`, animationDelay: delay };
            // Static phase (used when not spinning; the animation overrides it otherwise).
            const angle = ring.phase * 360;
            return (
              <g key={run.key} className="orbit-map__spin" style={{ ...timing, transform: `rotate(${angle}deg)` }}>
                <g
                  className="orbit-map__counter"
                  style={{ ...timing, transformOrigin: `${px}px ${C}px`, transform: `rotate(${-angle}deg)` }}
                >
                  <g transform={`translate(${px} ${C}) scale(1 ${1 / SQUASH}) rotate(${-TILT}) translate(${-px} ${-C})`}>
                    <g
                      className={`orbit-map__planet${selected ? ' is-selected' : ''}`}
                      role="button"
                      tabIndex={0}
                      aria-label={t.orbitarium.select(run.model)}
                      aria-pressed={selected}
                      onClick={() => onSelect(run.key)}
                      onKeyDown={event => onKey(event, run.key)}
                    >
                      <circle cx={px} cy={C} r={hit} className="orbit-map__hit" />
                      <circle cx={px} cy={C} r={16 + 4 * Math.min(scale, 2)} className="orbit-map__focus" />
                      {selected && <circle cx={px} cy={C} r={PLANET_R + 6} className="orbit-map__ring" />}
                      <circle cx={px} cy={C} r={PLANET_R} fill={colorOf(run)} className="orbit-map__body" />
                      <circle cx={px} cy={C} r={PLANET_R} fill="url(#orbit-shade)" className="orbit-map__shade" />
                      <text
                        x={px}
                        y={C + PLANET_R + 9 + labelSize}
                        textAnchor="middle"
                        className="orbit-map__label"
                        style={{ fontSize: `${labelSize}px` }}
                      >
                        {run.model}
                      </text>
                    </g>
                  </g>
                </g>
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
}
