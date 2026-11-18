import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.(QUERY).matches);

const subscribeReduced = (onChange: () => void) => {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};

/** Live `prefers-reduced-motion: reduce`. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, prefersReducedMotion, () => false);
}

/**
 * One-shot requestAnimationFrame with a setTimeout fallback, so the callback still runs
 * when the window is hidden and rAF is paused. Returns a cancel function.
 */
export function nextFrame(callback: () => void, fallbackMs = 100): () => void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(rafId);
    clearTimeout(timerId);
    callback();
  };
  const rafId = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : 0;
  const timerId = setTimeout(run, fallbackMs);
  return () => {
    done = true;
    cancelAnimationFrame(rafId);
    clearTimeout(timerId);
  };
}

/** Resolves when web fonts are ready, or after `maxMs`, whichever comes first. */
export function fontsReady(maxMs = 1200): Promise<void> {
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    setTimeout(finish, maxMs);
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    if (fonts?.ready) fonts.ready.then(finish, finish);
    else finish();
  });
}

export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: none) and (pointer: coarse)').matches);

export const isSmallScreen = (): boolean =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(max-width: 767px)').matches);

/** Run a callback when the browser is idle (fallback: setTimeout). */
export function whenIdle(callback: () => void, fallbackMs = 300): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(callback, { timeout: 1500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = setTimeout(callback, fallbackMs);
  return () => clearTimeout(id);
}

/** True when the element is focused from the keyboard (`:focus-visible`). */
export function isKeyboardFocus(element: Element): boolean {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
}
