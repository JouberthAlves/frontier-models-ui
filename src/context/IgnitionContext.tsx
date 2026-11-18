import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { isOpen, useBoot } from '../lib/boot';

/**
 * Hero ignition (signature effect, plays once per load). Starts when the loading lights go out
 * (spec-v2 §8; the loader waits for the fonts and has a 12 s cap). Sets `data-ignited` on
 * <html>; CSS drives the timed entrances, GSAP the title, CountUp the numbers. With reduced
 * motion everything is already in its final state.
 */
export const IGNITION = {
  stroke: 400,
  fill: 1900,
  underline: 2700,
  lede: 1900,
  numbers: 2050,
  actions: 2200,
  bar: 2400
} as const;

const IgnitionContext = createContext(false);

export function IgnitionProvider({ children }: { children: ReactNode }) {
  const ignited = isOpen(useBoot().phase);

  useEffect(() => {
    if (ignited) document.documentElement.dataset.ignited = 'true';
  }, [ignited]);

  return <IgnitionContext.Provider value={ignited}>{children}</IgnitionContext.Provider>;
}

export function useIgnited(): boolean {
  return useContext(IgnitionContext);
}
