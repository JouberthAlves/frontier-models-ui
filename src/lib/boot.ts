import { useSyncExternalStore } from 'react';
import { prefersReducedMotion } from './motion';

/**
 * Loading screen state (spec-v2 §8, "start lights"). Five real steps; each one lights a column
 * when it finishes. When all are lit: 400 ms hold, lights out, the screen fades (450 ms) and the
 * hero ignition starts. Hard cap of 12 s: whatever is missing is lit and the page opens anyway.
 */
export const BOOT_STEPS = ['fonts', 'map', 'thumbs', 'stage', 'sky'] as const;
export type BootStep = (typeof BOOT_STEPS)[number];
/** loading → lit (all on) → dark (lights out) → fading (screen fades, page ignites) → gone */
export type BootPhase = 'loading' | 'lit' | 'dark' | 'fading' | 'gone';

export interface BootState {
  done: number;
  phase: BootPhase;
}

/** Faces of the space font (spec-v3 §3.1) loaded with the "fonts" step. */
const SPACE_FONTS = ["500 1em 'Geist'", "400 1em 'Geist'"];

const CAP_MS = 12000;
const HOLD_MS = 400;
const DARK_MS = 160;
const FADE_MS = 450;

const finished = new Set<BootStep>();
let state: BootState = { done: 0, phase: 'loading' };
const listeners = new Set<() => void>();
const kept: HTMLImageElement[] = []; // keeps the preloaded images alive
let started = false;

const emit = (next: BootState) => {
  state = next;
  listeners.forEach(listener => listener());
};

function lightsOut() {
  if (state.phase !== 'loading') return;
  emit({ done: BOOT_STEPS.length, phase: 'lit' });
  const reduced = prefersReducedMotion();
  setTimeout(() => {
    if (reduced) {
      emit({ ...state, phase: 'gone' });
      return;
    }
    emit({ ...state, phase: 'dark' });
    setTimeout(() => {
      emit({ ...state, phase: 'fading' });
      setTimeout(() => emit({ ...state, phase: 'gone' }), FADE_MS);
    }, DARK_MS);
  }, HOLD_MS);
}

export function markStep(step: BootStep): void {
  if (finished.has(step) || state.phase !== 'loading') return;
  finished.add(step);
  if (finished.size >= BOOT_STEPS.length) lightsOut();
  else emit({ ...state, done: finished.size });
}

/** Preloads images (kept in an array so they are not collected) and resolves when all settled. */
export function preloadImages(urls: string[]): Promise<void> {
  return Promise.all(
    urls.map(
      url =>
        new Promise<void>(resolve => {
          const image = new Image();
          image.decoding = 'async';
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = url;
          kept.push(image);
        })
    )
  ).then(() => undefined);
}

/** Starts the fonts step and the 12 s cap. Image steps are passed in by the caller. */
export function startBoot(steps: Partial<Record<BootStep, () => Promise<unknown>>>): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  setTimeout(lightsOut, CAP_MS);
  const fonts = document.fonts;
  const fontsDone = () => markStep('fonts');
  if (fonts?.ready) {
    // The space font is asked for by name, so it is in before the lights go out even though
    // its text is far down the page.
    const wanted = SPACE_FONTS.map(font => fonts.load(font).catch(() => undefined));
    Promise.all([fonts.ready, ...wanted]).then(fontsDone, fontsDone);
  } else fontsDone();
  (Object.keys(steps) as BootStep[]).forEach(step => {
    const done = () => markStep(step);
    steps[step]?.().then(done, done);
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => state;
const SERVER: BootState = { done: 0, phase: 'loading' };

/** Plain (non-React) subscription. Returns the unsubscribe function. */
export function onBoot(listener: (state: BootState) => void): () => void {
  return subscribe(() => listener(state));
}

export function useBoot(): BootState {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}

/** True once the loading screen starts to leave: the page may ignite. */
export const isOpen = (phase: BootPhase) => phase === 'fading' || phase === 'gone';
