import { useEffect, useRef } from 'react';
import { isSmallScreen } from '../../lib/motion';
import { buildSpiral, KIND_CORE, KIND_DISC, measureSpiralAnchor, projectSpiral, SPIRAL_POINTS, spiralRadius } from '../../lib/spiral';
import './SpiralGalaxy.css';

/** Height the radius is sized for: the still picture does not depend on the window height. */
const STILL_VIEW_H = 900;
/** The picture reaches this far above and below the nucleus, in galaxy radii. */
const REACH = 0.75;

/**
 * The same spiral as the WebGL layer, drawn once on a 2D canvas (spec-v3 §3.3): shown without a
 * real GPU, with reduced motion, or after the WebGL layer stopped. No animation. It sits inside
 * the Orbitarium section, behind its content, with the nucleus between the two words of the
 * title, and is drawn again only when the layout changes.
 */
export default function SpiralStill() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !section || !ctx) return undefined;
    const data = buildSpiral(isSmallScreen() ? SPIRAL_POINTS.phone : SPIRAL_POINTS.desktop, 0);
    let drawn = '';
    let raf = 0;

    const draw = () => {
      raf = 0;
      const anchor = measureSpiralAnchor();
      if (!anchor) return;
      const box = section.getBoundingClientRect();
      const width = section.clientWidth;
      const cx = anchor.x - window.scrollX - box.left;
      const coreY = anchor.y - window.scrollY - box.top;
      const radius = spiralRadius(width, STILL_VIEW_H);
      // Never above the section: the end of the race map is there.
      const top = Math.max(0, Math.round(coreY - radius * REACH));
      const height = Math.max(1, Math.round(Math.min(box.height - top, coreY + radius * REACH - top)));
      const key = `${width}|${Math.round(cx)}|${Math.round(coreY)}|${height}`;
      if (key === drawn) return;
      drawn = key;

      canvas.width = width;
      canvas.height = height;
      canvas.style.top = `${top}px`;
      const cy = coreY - top;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      const glow = (x: number, y: number, r: number, rgb: string, alpha: number) => {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, `rgba(${rgb},${alpha.toFixed(3)})`);
        gradient.addColorStop(0.35, `rgba(${rgb},${(alpha * 0.35).toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      };
      for (let i = 0; i < data.count; i += 1) {
        const kind = data.meta[i * 4 + 3];
        const size = data.meta[i * 4];
        const alpha = data.meta[i * 4 + 1];
        const rgb = `${Math.round(data.color[i * 3] * 255)},${Math.round(data.color[i * 3 + 1] * 255)},${Math.round(data.color[i * 3 + 2] * 255)}`;
        if (kind === KIND_CORE) {
          glow(cx, cy, (size * radius) / 2, rgb, alpha);
          continue;
        }
        if (kind !== KIND_DISC) continue;
        const [dx, dy] = projectSpiral(data.pos[i * 3], data.pos[i * 3 + 1], data.pos[i * 3 + 2], 0);
        const x = cx + dx * radius;
        const y = cy + dy * radius;
        if (y < -8 || y > height + 8 || x < -8 || x > width + 8) continue;
        if (size > 4) {
          glow(x, y, size, rgb, alpha);
          continue;
        }
        // A point of the WebGL layer is a soft dot: here, a small square at about the same light.
        const side = Math.max(1, size * 0.6);
        ctx.fillStyle = `rgba(${rgb},${Math.min(1, alpha * 0.85).toFixed(3)})`;
        ctx.fillRect(x - side / 2, y - side / 2, side, side);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(section);
    window.addEventListener('resize', schedule, { passive: true });
    document.fonts?.ready.then(schedule, schedule);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return <canvas ref={canvasRef} className="spiral-still" aria-hidden="true" />;
}
