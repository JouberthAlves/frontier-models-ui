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
const RADII = [92, 132, 172, 208, 240];
const SQUASH = 0.42;
const TILT = -12;
const PERIODS = [48, 64, 82, 104, 130];
const PHASES = [0.08, 0.46, 0.73, 0.27, 0.6]; // fraction of a turn, as negative delays

/**
 * Orbital map. Each planet orbits inside a group squashed by scale(1, 0.42) (the orbit is an
 * ellipse); the planet counter-rotates and counter-scales so it stays round and its label
 * upright. CSS animation on transform only; only with a real GPU and without reduced motion;
 * paused off screen and in hidden tabs.
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

  const labelSize = 14 * scale;
  const hit = Math.max(22 * scale, 18);

  return (
    <svg
      ref={svgRef}
      className={`orbit-map${spinning ? ' is-spinning' : ''}`}
      viewBox="0 135 600 330"
      role="group"
      aria-label={t.orbitarium.map}
    >
      <defs>
        <radialGradient id="orbit-star" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff5ed" />
          <stop offset="55%" stopColor="#ffb76b" />
          <stop offset="100%" stopColor="#ffb76b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={26} fill="url(#orbit-star)" />
      <g transform={`rotate(${TILT} ${C} ${C})`}>
        {RADII.map(rx => (
          <ellipse key={rx} cx={C} cy={C} rx={rx} ry={rx * SQUASH} className="orbit-map__orbit" />
        ))}
        <g transform={`translate(${C} ${C}) scale(1 ${SQUASH}) translate(${-C} ${-C})`}>
          {runs.slice(0, RADII.length).map((run, index) => {
            const px = C + RADII[index];
            const selected = run.key === selectedKey;
            const delay = `${-(PHASES[index] * PERIODS[index]).toFixed(2)}s`;
            const timing = { animationDuration: `${PERIODS[index]}s`, animationDelay: delay };
            // Static phase (used when not spinning; the animation overrides it otherwise).
            const angle = PHASES[index] * 360;
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
                      {selected && <circle cx={px} cy={C} r={17} className="orbit-map__ring" />}
                      <circle cx={px} cy={C} r={11} fill={colorOf(run)} className="orbit-map__body" />
                      <text
                        x={px}
                        y={C + 22 + labelSize}
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
