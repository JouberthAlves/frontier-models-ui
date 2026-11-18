/**
 * The spiral galaxy of the space (spec-v3 §3.3), as plain data: every particle is generated here
 * once, from a seed, and drawn either by the WebGL layer (components/space/SpiralGalaxy.tsx) or,
 * without a real GPU or with reduced motion, once on a 2D canvas (components/space/SpiralStill.tsx).
 * Both read the same numbers, so the still picture is the same galaxy.
 *
 * Shape: two logarithmic arms out of a very bright nucleus, denser near it, fine dust between the
 * arms, a few larger stars with a glow, and loose stars over the whole sky.
 */
import { mulberry32 } from './scenery';

/** Particles of the galaxy itself (the sky stars come on top of this). */
export const SPIRAL_POINTS = { desktop: 7000, phone: 3000 } as const;
/** Loose stars over the whole sky. */
export const SKY_STARS = 600;
/** One turn every 6 minutes. */
export const SPIRAL_TURN_SECONDS = 360;
/** The disc is seen almost face-on (tilted 24 degrees) and rolled a little on screen, like the reference. */
export const SPIRAL_TILT = (24 * Math.PI) / 180;
export const SPIRAL_ROLL = (-10 * Math.PI) / 180;
/** The galaxy "lights up" from the nucleus outwards in this time. */
export const SPIRAL_IGNITE_MS = 1200;
/** The galaxy follows the page at this fraction of its speed (the rest is the parallax). */
export const SPIRAL_FOLLOW = 0.6;
/** Where the nucleus rests on the screen (fraction of the window height): the middle, which is
 *  where the second hero puts it when that hero fills the window. */
export const SPIRAL_REST = 0.5;
/** The galaxy belongs to the second hero: it fades out over this many px above the hero's bottom
 *  edge, so it never shows behind the content of the section below. */
export const SPIRAL_CLIP_FADE = 160;

/**
 * Document y of the nucleus when the page is scrolled to `scrollY`. With the WebGL layer (`live`)
 * the galaxy follows the page slower than it scrolls; the still picture sits on the marker.
 * RaceMap uses the same number to pull the cars into the nucleus.
 */
export const spiralCoreY = (anchorY: number, scrollY: number, viewH: number, live: boolean) => {
  const rest = scrollY + viewH * SPIRAL_REST;
  return live ? rest + (anchorY - rest) * SPIRAL_FOLLOW : anchorY;
};

const SEED = 20261118;
/** How tightly the arms wind: angle gained per unit of ln(radius). */
const WIND = 3.1;
const ARM_START = 0.06;

/** Particle kinds (4th value of `meta`). */
export const KIND_DISC = 0;
export const KIND_SKY = 1;
/** Soft glow of the nucleus: its size is a fraction of the galaxy radius, not px. */
export const KIND_CORE = 2;

const WHITE = [1, 1, 1];
const ICE = [0xcf / 255, 0xe3 / 255, 1];
const BLUE = [0x9c / 255, 0xc4 / 255, 1];
const PEACH = [1, 0xc7 / 255, 0x9a / 255];
const ORANGE = [1, 0x9e / 255, 0x6b / 255];
const WARM_WHITE = [1, 0xf3 / 255, 0xe2 / 255];
/** Share of warm (peach / orange) particles in the disc. */
const WARM_SHARE = 0.12;

export interface SpiralData {
  count: number;
  /** x, y in the plane of the disc (radius 1 = its edge) and z across it. Sky stars: x, y in 0..1 of the screen, z = parallax depth. */
  pos: Float32Array;
  /** size (px at DPR 1), brightness (0..1), twinkle phase, kind. */
  meta: Float32Array;
  /** r, g, b (0..1). */
  color: Float32Array;
}

export function buildSpiral(points: number, stars: number = SKY_STARS): SpiralData {
  const rng = mulberry32(SEED ^ Math.imul(points, 0x9e3779b1));
  const cores = 3;
  const count = points + stars + cores;
  const pos = new Float32Array(count * 3);
  const meta = new Float32Array(count * 4);
  const color = new Float32Array(count * 3);
  let n = 0;
  const put = (x: number, y: number, z: number, size: number, bright: number, kind: number, rgb: readonly number[]) => {
    pos.set([x, y, z], n * 3);
    meta.set([size, bright, rng() * 6.2832, kind], n * 4);
    color.set(rgb, n * 3);
    n += 1;
  };
  /** Roughly normal, sigma 1. */
  const gauss = () => (rng() + rng() + rng() + rng() - 2) * 1.732;
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const tone = () => {
    const u = rng();
    if (u < WARM_SHARE * 0.6) return PEACH;
    if (u < WARM_SHARE) return ORANGE;
    if (u < WARM_SHARE + 0.3) return ICE;
    if (u < WARM_SHARE + 0.46) return BLUE;
    return WHITE;
  };
  /** A point on one of the two arms, spread across it (wider near the nucleus). */
  const onArm = () => {
    const r = ARM_START + (1 - ARM_START) * Math.pow(rng(), 1.35);
    const arm = rng() < 0.5 ? 0 : Math.PI;
    const theta = arm + WIND * Math.log(r / ARM_START) + gauss() * mix(0.24, 0.085, r);
    const rr = r * (1 + gauss() * 0.035);
    return { x: Math.cos(theta) * rr, y: Math.sin(theta) * rr, r };
  };

  const nucleus = Math.round(points * 0.12);
  const dust = Math.round(points * 0.2);
  const glow = Math.round(points * 0.065);
  const arms = points - nucleus - dust - glow;

  for (let i = 0; i < nucleus; i += 1) {
    const r = Math.abs(gauss()) * 0.07;
    const theta = rng() * 6.2832;
    put(Math.cos(theta) * r, Math.sin(theta) * r, gauss() * 0.03 * Math.max(0, 1 - r / 0.2), 1 + 2.2 * Math.pow(rng(), 2), 0.6 + 0.4 * rng(), KIND_DISC, rng() < 0.7 ? WARM_WHITE : WHITE);
  }
  for (let i = 0; i < arms; i += 1) {
    const p = onArm();
    put(p.x, p.y, gauss() * 0.012, 1.4 + 3.4 * Math.pow(rng(), 2.4), mix(1, 0.72, p.r) * (0.7 + 0.3 * rng()), KIND_DISC, tone());
  }
  // Fine dust between the arms: small and faint, all around.
  for (let i = 0; i < dust; i += 1) {
    const r = 0.08 + 0.95 * Math.pow(rng(), 0.9);
    const theta = rng() * 6.2832;
    put(Math.cos(theta) * r, Math.sin(theta) * r, gauss() * 0.016, 1 + 0.6 * rng(), 0.06 + 0.12 * rng(), KIND_DISC, tone());
  }
  // A few larger stars with a glow, along the arms.
  for (let i = 0; i < glow; i += 1) {
    const p = onArm();
    put(p.x, p.y, gauss() * 0.012, 5 + 4.5 * rng(), 0.85 + 0.15 * rng(), KIND_DISC, tone());
  }
  // Loose stars over the whole sky.
  for (let i = 0; i < stars; i += 1) {
    const big = rng() < 0.05;
    const u = rng();
    put(rng(), rng(), 0.3 + 0.7 * rng(), big ? 2.4 + rng() : 1 + 1.3 * rng() * rng(), big ? 0.85 : 0.22 + 0.5 * rng(), KIND_SKY, u < 0.08 ? PEACH : u < 0.4 ? ICE : WHITE);
  }
  // Nucleus: three stacked soft glows, warm white.
  put(0, 0, 0, 0.42, 0.16, KIND_CORE, WARM_WHITE);
  put(0, 0, 0, 0.2, 0.32, KIND_CORE, WARM_WHITE);
  put(0, 0, 0, 0.08, 0.75, KIND_CORE, WHITE);

  return { count, pos, meta, color };
}

/** Radius of the disc on screen: it fills the gap between the two words of the title (a little
 *  wider than the gap, like the reference) and about 90% of the window height. With the words
 *  stacked (phones, tablets) it sits behind them and is wider than the screen. */
export const spiralRadius = (width: number, height: number, gap?: number) =>
  gap && gap > 120 ? Math.min(height * 0.46, gap * 0.66, 620) : Math.min(height * 0.46, width * 0.62, 560);

/** A point of the disc on the screen, in units of the galaxy radius around its centre. */
export function projectSpiral(x: number, y: number, z: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const qx = x * c - y * s;
  const qy = (x * s + y * c) * Math.cos(SPIRAL_TILT) + z * Math.sin(SPIRAL_TILT);
  const rc = Math.cos(SPIRAL_ROLL);
  const rs = Math.sin(SPIRAL_ROLL);
  return [qx * rc - qy * rs, qx * rs + qy * rc];
}

export interface SpiralAnchor {
  /** Where the nucleus sits, in document coordinates: between the two words of the title. */
  x: number;
  y: number;
  /** Bottom of the second hero (the full-screen title): the galaxy leaves with it. */
  bottom: number;
  /** Free width between the two words of the title (0 when they are stacked). */
  gap: number;
}

/** Reads the layout (call it on resize, never per frame). */
export function measureSpiralAnchor(): SpiralAnchor | null {
  const core = document.querySelector('[data-galaxy-core]');
  const section = document.querySelector('[data-galaxy-hero]');
  if (!core || !section) return null;
  const c = core.getBoundingClientRect();
  const s = section.getBoundingClientRect();
  const words = section.querySelectorAll(".split-title__word");
  let gap = 0;
  if (words.length === 2) {
    const a = words[0].getBoundingClientRect();
    const b = words[1].getBoundingClientRect();
    if (Math.abs(a.top - b.top) < a.height / 2) gap = Math.max(0, b.left - a.right);
  }
  return { x: c.left + c.width / 2 + window.scrollX, y: c.top + c.height / 2 + window.scrollY, bottom: s.bottom + window.scrollY, gap };
}
