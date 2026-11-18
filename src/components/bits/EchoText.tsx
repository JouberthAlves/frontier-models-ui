/*
 * Adapted from Vue Bits (ported to React): https://github.com/DavidHDev/vue-bits/blob/main/src/content/TextAnimations/EchoText/EchoText.vue
 * Changes for Frontier Models UI: React port; short burst triggered on pointer enter instead of cursor tracking; static per-echo blur; hover-capable devices only.
 *
 * MIT + Commons Clause License Condition v1.0
 *
 * Copyright (c) 2026 David Haz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, and distribute the Software as part of
 * an application, website, or product, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * Commons Clause Restriction: You may use this Software, including for any
 * commercial purpose, so long as you do not sell, sublicense, or redistribute the
 * components themselves - whether alone, in a bundle, or as a ported version.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/motion';
import './EchoText.css';

export interface EchoTextProps {
  text: string;
  /** Increment to play the short echo burst (e.g. on pointer enter). */
  playKey: number;
  echoes?: number;
  lag?: number;
  /** Px the echoes start from, to the right. */
  offset?: number;
  fade?: number;
  /** Max blur (px) of the last echo. Static per echo, never animated. */
  blur?: number;
  tint?: string;
  /** Burst length (ms). */
  duration?: number;
  className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const canHover = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches);

const EchoText = ({
  text,
  playKey,
  echoes = 8,
  lag = 0.24,
  offset = 28,
  fade = 0.72,
  blur = 2,
  tint = 'var(--warm)',
  duration = 900,
  className = ''
}: EchoTextProps) => {
  const copyRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const count = clamp(Math.round(echoes), 0, 24);

  useEffect(() => {
    if (playKey === 0 || count === 0 || prefersReducedMotion() || !canHover()) return undefined;
    const copies = copyRefs.current;
    const safeLag = clamp(lag, 0.02, 0.5);
    const positions = Array.from({ length: count + 1 }, (_, index) => offset * (index + 0.35));
    const startedAt = performance.now();
    let activity = 1;
    let raf = 0;

    const reset = () => {
      copies.forEach((copy, index) => {
        if (!copy) return;
        copy.style.transform = '';
        if (index > 0) copy.style.opacity = '0';
      });
    };

    const frame = (now: number) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const rest = 1 - easeOut(progress);
      let separation = 0;
      for (let index = 1; index <= count; index += 1) {
        const desired = rest * offset * (index + 0.35);
        const lerp = clamp(0.34 / (1 + index * safeLag * 4.2), 0.018, 0.36);
        positions[index] += (desired - positions[index]) * lerp;
        separation = Math.max(separation, positions[index]);
        const copy = copies[index];
        if (copy) copy.style.transform = `translate3d(${positions[index].toFixed(2)}px, 0, 0)`;
      }
      const target = Math.max(rest, clamp(separation / (offset * 2.25), 0, 1));
      activity += (target - activity) * 0.18;
      for (let index = 1; index <= count; index += 1) {
        const copy = copies[index];
        if (copy) copy.style.opacity = String(Math.pow(fade, index) * activity);
      }
      if (progress < 1 || activity > 0.01) raf = requestAnimationFrame(frame);
      else reset();
    };

    raf = requestAnimationFrame(frame);
    const fallback = setTimeout(() => {
      cancelAnimationFrame(raf);
      reset();
    }, duration + 1500);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
      reset();
    };
  }, [playKey, count, lag, offset, fade, duration]);

  const echoIndexes = Array.from({ length: count }, (_, i) => count - i);

  return (
    <span className={`echo-text ${className}`.trim()}>
      {echoIndexes.map(index => (
        <span
          key={index}
          ref={node => {
            copyRefs.current[index] = node;
          }}
          className="echo-text__echo"
          aria-hidden="true"
          style={{
            color: `color-mix(in srgb, ${tint} ${Math.min(72, 18 + index * 5)}%, currentColor)`,
            filter: blur > 0 ? `blur(${((blur * index) / count).toFixed(2)}px)` : undefined
          }}
        >
          {text}
        </span>
      ))}
      <span
        ref={node => {
          copyRefs.current[0] = node;
        }}
        className="echo-text__main"
      >
        {text}
      </span>
    </span>
  );
};

export default EchoText;
