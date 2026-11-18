/*
 * Adapted from React Bits: https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/TextAnimations/SplitFlapText/SplitFlapText.tsx
 * Changes for Frontier Models UI: single text (no loop), starts on reveal, wraps between words, transform-only flaps (no brightness filters), setTimeout fallback, optional "decrypt" scramble on hover once the flaps have settled.
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
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from '../../lib/motion';
import { observeReveal } from '../../lib/reveal';
import { useScramble } from '../../lib/scramble';
import './SplitFlapText.css';

export interface SplitFlapTextProps {
  text: string;
  /** Glyph color (model identity color). */
  color: string;
  tileColor?: string;
  /** Seconds per flip. */
  flipDuration?: number;
  /** Seconds between neighbouring tiles. */
  stagger?: number;
  flipsPerChar?: number;
  /** Once settled, scramble and resolve the name on mouse enter (and when `playKey` changes). */
  decryptOnHover?: boolean;
  playKey?: number;
  className?: string;
}

interface Tile {
  current: string;
  next: string;
  flipping: boolean;
  tick: number;
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const randomGlyph = () => GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));

const staticTiles = (value: string): Tile[] =>
  Array.from(value).map(char => ({ current: char, next: char, flipping: false, tick: 0 }));

/** Groups tile indexes into words so long names wrap between words, never mid-word. */
function groupWords(tiles: Tile[], layout: string): number[][] {
  const groups: number[][] = [];
  let word: number[] = [];
  tiles.forEach((_, index) => {
    if (layout[index] === ' ') {
      if (word.length) groups.push(word);
      groups.push([index]);
      word = [];
    } else {
      word.push(index);
    }
  });
  if (word.length) groups.push(word);
  return groups;
}

const SplitFlapText = ({
  text,
  color,
  tileColor = '#3a2b45',
  flipDuration = 0.12,
  stagger = 0.06,
  flipsPerChar = 6,
  decryptOnHover = false,
  playKey,
  className = ''
}: SplitFlapTextProps) => {
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLSpanElement>(null);
  // Last fully shown text (the starting point of the next animation).
  const [shown, setShown] = useState('');
  const [frame, setFrame] = useState<{ target: string; tiles: Tile[] } | null>(null);
  const scramble = useScramble(text);
  const playScramble = scramble.play;
  const lastKey = useRef(playKey);
  const settled = shown === text && !frame;

  useEffect(() => {
    if (playKey === lastKey.current) return;
    lastKey.current = playKey;
    if (decryptOnHover && settled) playScramble();
  }, [playKey, decryptOnHover, settled, playScramble]);

  useEffect(() => {
    const root = rootRef.current;
    if (reduced || !root) return undefined;
    if (shown === text) return undefined;

    const flipMs = Math.max(40, flipDuration * 1000);
    const staggerMs = Math.max(0, stagger * 1000);
    let raf = 0;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
      setFrame(null);
      setShown(text);
    };

    const begin = () => {
      if (cancelled) return;
      const width = Math.max(shown.length, text.length);
      const from = shown.padEnd(width, ' ');
      const target = text.padEnd(width, ' ');
      const plans = Array.from(target)
        .map((char, index) => ({
          index,
          from: from[index],
          target: char,
          sequence: [...Array.from({ length: flipsPerChar }, randomGlyph), char],
          start: index * staggerMs,
          step: -1
        }))
        .filter(plan => plan.from !== plan.target);
      const tiles = staticTiles(from);
      const total = plans.reduce((max, plan) => Math.max(max, plan.start + plan.sequence.length * flipMs), 0);
      const startedAt = performance.now();

      const tick = (now: number) => {
        if (cancelled) return;
        const elapsed = now - startedAt;
        let running = false;
        let changed = false;
        plans.forEach(plan => {
          const local = elapsed - plan.start;
          if (local < 0) {
            running = true;
            return;
          }
          const step = Math.floor(local / flipMs);
          if (step < plan.sequence.length) {
            running = true;
            if (step !== plan.step) {
              plan.step = step;
              const tile = tiles[plan.index];
              tiles[plan.index] = {
                current: step === 0 ? plan.from : plan.sequence[step - 1],
                next: plan.sequence[step],
                flipping: true,
                tick: tile.tick + 1
              };
              changed = true;
            }
          } else if (tiles[plan.index].flipping || tiles[plan.index].current !== plan.target) {
            tiles[plan.index] = { current: plan.target, next: plan.target, flipping: false, tick: tiles[plan.index].tick + 1 };
            changed = true;
          }
        });
        if (changed) setFrame({ target: text, tiles: [...tiles] });
        if (running) raf = requestAnimationFrame(tick);
        else finish();
      };

      setFrame({ target: text, tiles: [...tiles] });
      raf = requestAnimationFrame(tick);
      // rAF may be paused (hidden window): land on the final text anyway.
      fallback = setTimeout(finish, total + 600);
    };

    const stopReveal = observeReveal(root, begin);
    return () => {
      cancelled = true;
      stopReveal();
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [text, shown, reduced, flipDuration, stagger, flipsPerChar]);

  const animating = frame && frame.target === text;
  const tiles = reduced
    ? staticTiles(text)
    : animating
      ? frame.tiles
      : settled && scramble.shown
        ? staticTiles(scramble.shown.join(''))
        : staticTiles(shown || ' '.repeat(text.length));
  const layout = (reduced || animating ? text : shown || text).padEnd(tiles.length, ' ');
  const groups = groupWords(tiles, layout);

  const style = {
    '--split-flap-tile-color': tileColor,
    '--split-flap-text-color': color,
    '--split-flap-flip-duration': `${Math.max(0.04, flipDuration)}s`
  } as CSSProperties;

  return (
    <span
      ref={rootRef}
      className={`split-flap-text ${className}`.trim()}
      style={style}
      onPointerEnter={event => {
        if (decryptOnHover && settled && event.pointerType === 'mouse') playScramble();
      }}
    >
      <span className="sr-only">{text}</span>
      {groups.map(group => (
        <span className="split-flap-text__word" aria-hidden="true" key={group[0]}>
          {group.map(index => {
            const tile = tiles[index];
            const blank = layout[index] === ' ' && tile.current === ' ' && !tile.flipping;
            return (
              <span
                className={`split-flap-text__tile${tile.flipping ? ' is-flipping' : ''}${blank ? ' is-space' : ''}`}
                key={index}
              >
                <span className="split-flap-text__half split-flap-text__half--top">
                  <span className="split-flap-text__char">{tile.flipping ? tile.next : tile.current}</span>
                </span>
                <span className="split-flap-text__half split-flap-text__half--bottom">
                  <span className="split-flap-text__char">{tile.current}</span>
                </span>
                {tile.flipping && (
                  <>
                    <span className="split-flap-text__flap split-flap-text__flap--front" key={`f${tile.tick}`}>
                      <span className="split-flap-text__char">{tile.current}</span>
                    </span>
                    <span className="split-flap-text__flap split-flap-text__flap--back" key={`b${tile.tick}`}>
                      <span className="split-flap-text__char">{tile.next}</span>
                    </span>
                  </>
                )}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
};

export default SplitFlapText;
