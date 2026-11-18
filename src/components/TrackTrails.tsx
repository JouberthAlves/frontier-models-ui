import { useEffect, useRef } from 'react';
import { hasGpu } from '../lib/gpu';
import { isTouchDevice, prefersReducedMotion } from '../lib/motion';

/**
 * "Rastros": light trails racing right-to-left on the track side of the hero (2D canvas,
 * inspired by React Bits Hyperspeed). DPR 1, additive blending, perspective (thicker and
 * faster near the bottom). Runs only while the hero is visible and the tab is active.
 */

interface Trail {
  x: number;
  y: number; // 0..1 of height
  length: number;
  thickness: number;
  speed: number;
  tone: 'main' | 'amber' | 'accent';
  accent: string;
  alpha: number;
}

const TRAIL_COUNT = 36;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Where trails may run, in fractions of the canvas height. */
interface Lanes {
  min: number;
  max: number;
  /** Bands covered by text (lede, numbers, buttons): no trail crosses them. */
  blocked: [number, number][];
}

const pickY = (lanes: Lanes) => {
  let y = rand(lanes.min, lanes.max);
  for (let tries = 0; tries < 12; tries += 1) {
    if (!lanes.blocked.some(([a, b]) => y >= a && y <= b)) return y;
    y = rand(lanes.min, lanes.max);
  }
  return lanes.min;
};

function makeTrail(width: number, spread: boolean, lanes: Lanes): Trail {
  const y = pickY(lanes);
  const depth = (y - lanes.min) / (lanes.max - lanes.min); // 0 far .. 1 near
  const roll = Math.random();
  const tone: Trail['tone'] = roll < 0.15 ? 'accent' : roll < 0.4 ? 'amber' : 'main';
  return {
    x: spread ? rand(-200, width + 200) : width + rand(0, width * 0.6),
    y,
    length: 80 + depth * 180 + rand(0, 60),
    thickness: 1 + depth * 2 * rand(0.6, 1),
    speed: 600 + depth * 1000 + rand(0, 200),
    tone,
    accent: Math.random() < 0.5 ? '255, 153, 204' : '250, 204, 107',
    alpha: tone === 'accent' ? 0.28 : rand(0.55, 0.95)
  };
}

export default function TrackTrails() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    const reduced = prefersReducedMotion();
    const frameRate = isTouchDevice() ? 30 : hasGpu() ? 60 : 24;
    const minFrame = 1000 / frameRate - 2;
    let width = 1;
    let height = 1;
    let trails: Trail[] = [];
    let raf = 0;
    let last = 0;
    let visible = true;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const trail of trails) {
        const y = Math.round(trail.y * height) + 0.5;
        const head = trail.x;
        const tail = trail.x + trail.length;
        if (tail < 0 || head > width) continue;
        const gradient = ctx.createLinearGradient(head, 0, tail, 0);
        if (trail.tone === 'accent') {
          gradient.addColorStop(0, `rgba(${trail.accent}, ${trail.alpha})`);
          gradient.addColorStop(1, `rgba(${trail.accent}, 0)`);
        } else if (trail.tone === 'amber') {
          gradient.addColorStop(0, `rgba(255, 183, 107, ${trail.alpha})`);
          gradient.addColorStop(1, 'rgba(255, 183, 107, 0)');
        } else {
          gradient.addColorStop(0, `rgba(255, 245, 237, ${trail.alpha})`);
          gradient.addColorStop(0.18, `rgba(253, 175, 109, ${trail.alpha})`);
          gradient.addColorStop(1, 'rgba(253, 175, 109, 0)');
        }
        ctx.strokeStyle = gradient;
        ctx.lineWidth = trail.thickness;
        ctx.beginPath();
        ctx.moveTo(head, y);
        ctx.lineTo(tail, y);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    const step = (dt: number) => {
      for (let i = 0; i < trails.length; i += 1) {
        const trail = trails[i];
        trail.x -= trail.speed * dt;
        if (trail.x + trail.length < 0) trails[i] = makeTrail(width, false, lanes);
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (!last || now - last >= minFrame) {
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
        last = now;
        step(dt);
        draw();
      }
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (reduced || raf || !visible || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };

    let lanes: Lanes = { min: 0.3, max: 0.95, blocked: [] };

    const measureLanes = (rect: DOMRect): Lanes => {
      const desktop = window.matchMedia('(min-width: 900px)').matches;
      const hero = canvas.closest('.hero');
      const blocked: [number, number][] = [];
      hero?.querySelectorAll<HTMLElement>('.hero__lede, .hero__stats, .hero__actions').forEach(el => {
        const box = el.getBoundingClientRect();
        if (!box.height) return;
        blocked.push([(box.top - rect.top - 6) / rect.height, (box.bottom - rect.top + 6) / rect.height]);
      });
      // Desktop: the whole track half below the nav. Phone: the narrow band above the seam.
      return desktop ? { min: 0.3, max: 0.95, blocked } : { min: 0.05, max: 0.33, blocked };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = width; // DPR 1
      canvas.height = height;
      lanes = measureLanes(rect);
      trails = Array.from({ length: TRAIL_COUNT }, () => makeTrail(width, true, lanes));
      draw();
    };

    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);
    resize();
    // Text bands move once the web fonts arrive: measure again then.
    document.fonts?.ready.then(resize).catch(() => undefined);

    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(entries => {
            visible = entries.some(entry => entry.isIntersecting);
            if (visible) wake();
            else {
              cancelAnimationFrame(raf);
              raf = 0;
            }
          })
        : null;
    io?.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else wake();
    };
    document.addEventListener('visibilitychange', onVisibility);
    wake();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero__trails" aria-hidden="true" />;
}
