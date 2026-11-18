/*
 * Adapted from React Bits: https://github.com/DavidHDev/react-bits/tree/main/src/ts-default/Animations/StarBorder
 * Changes for Frontier Models UI: card wrapper version of the classic two-glow StarBorder (speed prop in seconds), active/animated switches with a static border fallback.
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
import type { CSSProperties, ReactNode } from 'react';
import './StarBorder.css';

export interface StarBorderProps {
  children: ReactNode;
  /** Model color. */
  color: string;
  /** Seconds per sweep. */
  speed?: number;
  /** Animated border on; off = static 1.5px border in `color` (no GPU / reduced motion). */
  animated: boolean;
  /** Turns the border on (selected card). */
  active: boolean;
  className?: string;
}

/** Wraps a card; when active, two soft stars sweep along the top and bottom edges. */
const StarBorder = ({ children, color, speed = 6, animated, active, className = '' }: StarBorderProps) => {
  const style = { '--star-color': color, '--star-speed': `${speed}s` } as CSSProperties;
  const classes = [
    'star-border',
    active && 'is-active',
    active && animated && 'is-animated',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={style}>
      {active && animated && (
        <>
          <span className="star-border__glow star-border__glow--bottom" aria-hidden="true" />
          <span className="star-border__glow star-border__glow--top" aria-hidden="true" />
        </>
      )}
      <div className="star-border__inner">{children}</div>
    </div>
  );
};

export default StarBorder;
