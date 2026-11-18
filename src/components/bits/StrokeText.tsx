/*
 * Adapted from React Bits: https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/TextAnimations/StrokeText/StrokeText.tsx
 * Changes for Frontier Models UI: multi-line (one SVG per line), gradient fill, controlled trigger (hero ignition) and scroll trigger with reveal safety net, fixed 0.86em line box, measured width reported for fit-to-width sizing; hover/loop/dash/shadow modes removed.
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
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { prefersReducedMotion } from '../../lib/motion';
import { observeReveal } from '../../lib/reveal';
import './StrokeText.css';

gsap.registerPlugin(ScrollTrigger);

export type StrokeTextTrigger = 'controlled' | 'scroll';
export type StrokeTextFillMode = 'wipe' | 'fade';

export interface StrokeTextProps {
  /** One SVG per line (rendered stacked). */
  lines: string[];
  strokeColor: string;
  /** Solid color, or [from, to] for a left-to-right gradient. */
  fill: string | [string, string];
  /** Stroke width in SVG units (font size = 200 units). */
  strokeWidth?: number;
  fontWeight?: number;
  /** font-stretch / wdth axis, in percent. */
  fontStretch?: number;
  letterSpacing?: number;
  /** Total time for every letter's stroke, stagger included (s). */
  drawDuration?: number;
  stagger?: number;
  ease?: string;
  /** Fill start, measured from the start of the stroke (s). */
  fillAt?: number;
  fillDuration?: number;
  fillEase?: string;
  fillMode?: StrokeTextFillMode;
  trigger?: StrokeTextTrigger;
  /** Controlled mode: starts the timeline when it turns true. */
  play?: boolean;
  /** Controlled mode: delay before the stroke starts (s). */
  delay?: number;
  /** Reports the widest line in em, after measuring. */
  onMeasure?: (widestEm: number) => void;
  className?: string;
  style?: CSSProperties;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const UNITS = 200; // font size in SVG user units
const LINE_TOP = -0.8 * UNITS; // visual line box: 0.86em (title line-height)
const LINE_HEIGHT = 0.86 * UNITS;

const StrokeText = ({
  lines,
  strokeColor,
  fill,
  strokeWidth = 3,
  fontWeight = 900,
  fontStretch = 125,
  letterSpacing = -4,
  drawDuration = 1.6,
  stagger = 0.05,
  ease = 'power2.out',
  fillAt,
  fillDuration = 0.8,
  fillEase = 'power2.inOut',
  fillMode = 'wipe',
  trigger = 'controlled',
  play = false,
  delay = 0,
  onMeasure,
  className = '',
  style
}: StrokeTextProps) => {
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const strokeRefs = useRef<(SVGTextElement | null)[]>([]);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const playedRef = useRef(false);
  const onMeasureRef = useRef(onMeasure);
  const [boxes, setBoxes] = useState<(Box | null)[]>(() => lines.map(() => null));

  const baseId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const linesKey = lines.join('\u001f');
  const chars = useMemo(() => linesKey.split('\u001f').map(line => Array.from(line)), [linesKey]);
  const gradient = Array.isArray(fill);
  const dash = UNITS * 7;
  const measured = boxes.every(Boolean);

  useEffect(() => {
    onMeasureRef.current = onMeasure;
  }, [onMeasure]);

  // Measure each line with getBBox() once fonts are ready (and on resize).
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const next: (Box | null)[] = strokeRefs.current.slice(0, chars.length).map(node => {
        if (!node) return null;
        try {
          const bbox = node.getBBox();
          if (!bbox.width) return null;
          const pad = Math.max(strokeWidth * 2, UNITS * 0.04);
          return { x: bbox.x - pad, y: bbox.y - pad, width: bbox.width + pad * 2, height: bbox.height + pad * 2 };
        } catch {
          return null;
        }
      });
      if (!next.every(Boolean)) return;
      setBoxes(previous =>
        previous.length === next.length &&
        previous.every((box, index) => box && next[index] && Math.abs(box.width - next[index]!.width) < 0.5)
          ? previous
          : next
      );
      const widest = Math.max(...next.map(box => (box ? box.width : 0)));
      onMeasureRef.current?.(widest / UNITS);
    };

    const fonts = document.fonts;
    if (fonts?.ready) fonts.ready.then(measure, measure);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    if (!observer && !fonts?.ready) setTimeout(measure, 0);

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [chars, strokeWidth, fontWeight, fontStretch, letterSpacing]);

  // Build the timeline once measured.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !measured) return undefined;

    const strokes = Array.from(root.querySelectorAll<SVGTSpanElement>('[data-stroke-char]'));
    const fills = Array.from(root.querySelectorAll<SVGTextElement>('[data-fill]'));
    const wipes = Array.from(root.querySelectorAll<SVGRectElement>('[data-wipe]'));
    const targets = [...strokes, ...fills, ...wipes];
    const useWipe = fillMode === 'wipe';
    const endAttr = (rect: SVGRectElement) => ({ width: Number(rect.dataset.fullWidth) || 0 });

    const setEnd = () => {
      gsap.killTweensOf(targets);
      gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: 0 });
      gsap.set(fills, { opacity: 1 });
      wipes.forEach(rect => gsap.set(rect, { attr: endAttr(rect) }));
    };

    // Reduced motion, or a re-measure after the effect already played: final state.
    if (prefersReducedMotion() || playedRef.current) {
      setEnd();
      return () => gsap.killTweensOf(targets);
    }

    gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: dash });
    gsap.set(fills, { opacity: useWipe ? 1 : 0 });
    wipes.forEach(rect => gsap.set(rect, { attr: { width: 0 } }));

    const count = Math.max(1, strokes.length);
    const each = Math.max(0.2, drawDuration - stagger * (count - 1));
    const fillStart = fillAt ?? drawDuration;
    const tl = gsap.timeline({ paused: true });
    tl.to(strokes, { strokeDashoffset: 0, duration: each, ease, stagger }, 0);
    if (useWipe) {
      wipes.forEach(rect => tl.to(rect, { attr: endAttr(rect), duration: fillDuration, ease: fillEase }, fillStart));
    } else {
      tl.to(fills, { opacity: 1, duration: fillDuration, ease: fillEase }, fillStart);
    }
    timelineRef.current = tl;

    const total = tl.duration();
    let guard: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      playedRef.current = true;
      tl.play(0);
      // rAF may be paused (hidden window): make sure the final state is reached.
      clearTimeout(guard);
      guard = setTimeout(() => {
        if (tl.progress() < 1) tl.progress(1);
      }, total * 1000 + 600);
    };

    let cleanupTrigger: (() => void) | undefined;
    if (trigger === 'scroll') {
      let fired = false;
      const st = ScrollTrigger.create({
        trigger: root,
        start: 'top 82%',
        once: true,
        onEnter: () => {
          if (fired) return;
          fired = true;
          start();
        }
      });
      // Safety net: the shared reveal observer (and its 2.5 s fallback when it never reports,
      // e.g. in a hidden window) also starts it; hidden windows jump to the final state.
      const stopSafety = observeReveal(root, () => {
        if (fired) return;
        fired = true;
        if (document.hidden) {
          playedRef.current = true;
          tl.progress(1);
        } else {
          start();
        }
      });
      cleanupTrigger = () => {
        st.kill();
        stopSafety();
      };
    }

    return () => {
      cleanupTrigger?.();
      clearTimeout(guard);
      tl.kill();
      timelineRef.current = null;
      gsap.killTweensOf(targets);
    };
  }, [measured, boxes, dash, drawDuration, stagger, ease, fillAt, fillDuration, fillEase, fillMode, trigger]);

  // Controlled trigger.
  useEffect(() => {
    if (trigger !== 'controlled' || !play || !measured) return undefined;
    const tl = timelineRef.current;
    if (!tl || prefersReducedMotion()) return undefined;
    const total = delay + tl.duration();
    playedRef.current = true;
    // Delay with a timer (a paused GSAP timeline ignores its own delay when resumed).
    const begin = setTimeout(() => tl.play(0), delay * 1000);
    const guard = setTimeout(() => {
      if (tl.progress() < 1) tl.progress(1);
    }, total * 1000 + 600);
    return () => {
      clearTimeout(begin);
      clearTimeout(guard);
    };
  }, [trigger, play, measured, delay]);

  const fontStyle: CSSProperties = {
    fontFamily: 'var(--f-display)',
    fontSize: `${UNITS}px`,
    fontWeight,
    fontStretch: `${fontStretch}%`,
    fontVariationSettings: `"wdth" ${fontStretch}`,
    letterSpacing: `${letterSpacing}px`
  };

  return (
    <span ref={rootRef} className={`stroke-text ${className}`.trim()} style={style} aria-hidden="true">
      {chars.map((letters, line) => {
        const box = boxes[line];
        const width = box ? box.width : letters.length * 0.82 * UNITS;
        const x = box ? box.x : 0;
        const gradId = `st-grad-${baseId}-${line}`;
        const wipeId = `st-wipe-${baseId}-${line}`;
        return (
          <svg
            key={line}
            className="stroke-text__line"
            data-line={line}
            viewBox={`${x} ${LINE_TOP} ${width} ${LINE_HEIGHT}`}
            style={{ width: `${width / UNITS}em`, visibility: box ? undefined : 'hidden' }}
            focusable="false"
          >
            <defs>
              {gradient && (
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={fill[0]} />
                  <stop offset="100%" stopColor={fill[1]} />
                </linearGradient>
              )}
              {fillMode === 'wipe' && box && (
                <clipPath id={wipeId} clipPathUnits="userSpaceOnUse">
                  <rect data-wipe data-full-width={box.width} x={box.x} y={box.y} width={0} height={box.height} />
                </clipPath>
              )}
            </defs>
            {/* Stroke first, fill on top: the fill hides the inner contours of overlapping glyph parts. */}
            <text
              ref={node => {
                strokeRefs.current[line] = node;
              }}
              x="0"
              y="0"
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ ...fontStyle, stroke: strokeColor }}
            >
              {letters.map((char, index) => (
                <tspan data-stroke-char key={index}>
                  {char}
                </tspan>
              ))}
            </text>
            <text
              data-fill
              x="0"
              y="0"
              stroke="none"
              style={{ ...fontStyle, fill: gradient ? `url(#${gradId})` : (fill as string) }}
              clipPath={fillMode === 'wipe' && box ? `url(#${wipeId})` : undefined}
            >
              {letters.map((char, index) => (
                <tspan key={index}>{char}</tspan>
              ))}
            </text>
          </svg>
        );
      })}
    </span>
  );
};

export default StrokeText;
