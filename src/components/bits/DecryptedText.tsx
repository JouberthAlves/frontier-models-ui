/*
 * Adapted from React Bits: https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/TextAnimations/DecryptedText/DecryptedText.tsx
 * Changes for Frontier Models UI: no motion dependency; plays only when the text changes after mount (language switch); sequential reveal; layout-stable cells; timer fallback; animateOn="hover" mode for model names (scramble and resolve left to right in the model color); animateOn="view" mode (plays once when the text enters the screen).
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
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from '../../lib/motion';
import { observeReveal } from '../../lib/reveal';
import { useScramble } from '../../lib/scramble';
import './DecryptedText.css';

export interface DecryptedTextProps {
  text: string;
  /** Milliseconds per tick. */
  speed?: number;
  /** Ticks for the non-sequential mode. */
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: 'start' | 'end';
  characters?: string;
  className?: string;
  /**
   * "change" (default): plays when the text changes. "hover": plays on mouse enter / playKey.
   * "view": plays once, when the text enters the screen.
   */
  animateOn?: 'change' | 'hover' | 'view';
  /** Hover mode: bump it to play from outside (card hover, keyboard focus). */
  playKey?: number;
  /** Hover mode: color of the scrambled glyphs (model identity color). */
  tone?: string;
  /** Hover mode: the name sits on a cream card, so the tone is darkened to keep AA contrast. */
  onCream?: boolean;
}

const isSpace = (char: string) => /\s/.test(char);

/** Deterministic scramble used for the very first frame (render must stay pure). */
const placeholder = (chars: string[], pool: string[]) =>
  chars.map((char, index) => (isSpace(char) ? char : pool[((char.codePointAt(0) ?? 0) + index * 7) % pool.length]));

/** Cells grouped into words, so the line breaks never move while scrambling. */
function renderCells(text: string, shown: string[]): ReactNode {
  const chars = Array.from(text);
  const words: { key: number; cells: number[] }[] = [];
  let current: number[] = [];
  chars.forEach((char, index) => {
    if (isSpace(char)) {
      if (current.length) words.push({ key: current[0], cells: current });
      words.push({ key: index, cells: [index] });
      current = [];
    } else {
      current.push(index);
    }
  });
  if (current.length) words.push({ key: current[0], cells: current });

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map(word =>
          word.cells.length === 1 && isSpace(chars[word.cells[0]]) ? (
            <span key={word.key}> </span>
          ) : (
            <span className="decrypted-text__word" key={word.key}>
              {word.cells.map(index => {
                const scrambled = shown[index] !== chars[index];
                return (
                  <span className="decrypted-text__cell" key={index}>
                    <span className="decrypted-text__ghost">{chars[index]}</span>
                    <span className={`decrypted-text__glyph${scrambled ? ' is-scrambled' : ''}`}>{shown[index]}</span>
                  </span>
                );
              })}
            </span>
          )
        )}
      </span>
    </>
  );
}

/**
 * Hover mode (spec-v2 §7): scrambles and resolves from left to right when the mouse enters the
 * name, or when `playKey` changes. Width is locked by the ghost cells; the real text stays
 * available to assistive tech.
 */
function HoverDecrypt({ text, speed = 35, className = '', playKey, tone, onCream }: DecryptedTextProps) {
  const { shown, play } = useScramble(text, speed);
  const lastKey = useRef(playKey);

  useEffect(() => {
    if (playKey === lastKey.current) return;
    lastKey.current = playKey;
    play();
  }, [playKey, play]);

  const style = tone
    ? ({
        '--decrypt-color': onCream ? `color-mix(in oklab, ${tone} 55%, #0f1a2b)` : tone,
        '--decrypt-opacity': 1
      } as CSSProperties)
    : undefined;

  return (
    <span
      className={`decrypted-text ${className}`.trim()}
      style={style}
      onPointerEnter={event => {
        if (event.pointerType === 'mouse') play();
      }}
    >
      {shown ? renderCells(text, shown) : text}
    </span>
  );
}

/**
 * View mode (spec-v3 §3.2): the letters scramble and resolve from left to right once, when the
 * text enters the screen, on any device. Same cells as the hover mode: the width never moves.
 */
function ViewDecrypt({ text, speed = 35, className = '', tone }: DecryptedTextProps) {
  const { shown, play } = useScramble(text, speed);
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || played.current) return undefined;
    return observeReveal(element, () => {
      played.current = true;
      play(true);
    });
  }, [play]);

  const style = tone ? ({ '--decrypt-color': tone, '--decrypt-opacity': 1 } as CSSProperties) : undefined;

  return (
    <span ref={ref} className={`decrypted-text ${className}`.trim()} style={style}>
      {shown ? renderCells(text, shown) : text}
    </span>
  );
}

/**
 * Plays only when `text` changes after mount (language switch). The final text is always
 * available to screen readers; the animated glyphs are aria-hidden.
 */
const ChangeDecrypt = ({
  text,
  speed = 35,
  maxIterations = 8,
  sequential = true,
  revealDirection = 'start',
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>',
  className = ''
}: DecryptedTextProps) => {
  const reduced = useReducedMotion();
  const [settled, setSettled] = useState(text);
  const [frame, setFrame] = useState<{ text: string; shown: string[] } | null>(null);
  const pool = Array.from(characters);
  const chars = Array.from(text);

  useEffect(() => {
    if (text === settled) return undefined;
    if (reduced) {
      const id = setTimeout(() => setSettled(text), 0);
      return () => clearTimeout(id);
    }

    const letters = Array.from(text);
    const glyphs = Array.from(characters);
    const order = letters.map((_, index) => index).filter(index => !isSpace(letters[index]));
    if (revealDirection === 'end') order.reverse();
    const revealed = new Set<number>();
    let iteration = 0;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      clearTimeout(fallback);
      setFrame(null);
      setSettled(text);
    };

    const tick = () => {
      iteration += 1;
      if (sequential) {
        const next = order.shift();
        if (next !== undefined) revealed.add(next);
      } else if (iteration >= maxIterations) {
        letters.forEach((_, index) => revealed.add(index));
      }
      const complete = sequential ? order.length === 0 : iteration >= maxIterations;
      if (complete) {
        finish();
        return;
      }
      setFrame({
        text,
        shown: letters.map((char, index) =>
          isSpace(char) || revealed.has(index) ? char : glyphs[Math.floor(Math.random() * glyphs.length)]
        )
      });
    };

    const timer = setInterval(tick, Math.max(16, speed));
    const steps = sequential ? order.length : maxIterations;
    // Throttled timers in hidden windows: land on the final text anyway.
    const fallback = setTimeout(finish, steps * Math.max(16, speed) + 800);

    return () => {
      done = true;
      clearInterval(timer);
      clearTimeout(fallback);
    };
  }, [text, settled, reduced, speed, maxIterations, sequential, revealDirection, characters]);

  const shown =
    reduced || text === settled ? chars : frame && frame.text === text ? frame.shown : placeholder(chars, pool);

  // At rest, plain text: copy, find-in-page and screen readers see normal words.
  if (!frame && settled === text) {
    return <span className={`decrypted-text ${className}`.trim()}>{text}</span>;
  }

  return <span className={`decrypted-text ${className}`.trim()}>{renderCells(text, shown)}</span>;
};

const DecryptedText = (props: DecryptedTextProps) =>
  props.animateOn === 'hover' ? <HoverDecrypt {...props} /> : props.animateOn === 'view' ? <ViewDecrypt {...props} /> : <ChangeDecrypt {...props} />;

export default DecryptedText;
