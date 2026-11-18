/*
 * Adapted from React Bits: https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/TextAnimations/CountUp/CountUp.tsx
 * Changes for Frontier Models UI: no motion dependency; controlled start; Intl.NumberFormat of the active language; final value always set by a timer fallback.
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
import { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

export interface CountUpProps {
  to: number;
  from?: number;
  /** Seconds. */
  duration?: number;
  /** Seconds before counting. */
  delay?: number;
  /** Starts counting when it turns true. */
  start: boolean;
  /** Formatter of the active language. */
  format: Intl.NumberFormat;
  className?: string;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Writes the number straight to the DOM (no re-render per frame). The final value is the
 * accessible text from the start; the counting digits are aria-hidden.
 */
const CountUp = ({ to, from = 0, duration = 1.2, delay = 0, start, format, className = '' }: CountUpProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const doneRef = useRef(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const write = (value: number) => {
      node.textContent = format.format(Math.round(value));
    };

    if (doneRef.current || prefersReducedMotion()) {
      write(to);
      return undefined;
    }
    if (!start) {
      write(from);
      return undefined;
    }

    let raf = 0;
    let begin = 0;
    const tick = (now: number) => {
      if (!begin) begin = now;
      const t = Math.min(1, (now - begin) / (duration * 1000));
      write(from + (to - from) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else doneRef.current = true;
    };
    const delayTimer = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay * 1000);
    // rAF fallback: always land on the final value.
    const fallback = setTimeout(
      () => {
        cancelAnimationFrame(raf);
        doneRef.current = true;
        write(to);
      },
      (delay + duration) * 1000 + 400
    );

    return () => {
      clearTimeout(delayTimer);
      clearTimeout(fallback);
      cancelAnimationFrame(raf);
    };
  }, [to, from, duration, delay, start, format]);

  return (
    <span className={className}>
      <span className="sr-only">{format.format(to)}</span>
      <span ref={ref} aria-hidden="true" />
    </span>
  );
};

export default CountUp;
