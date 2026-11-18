import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fontsReady } from '../lib/motion';

/**
 * Hero ignition (signature effect, plays once per load). Starts after `document.fonts.ready`
 * (max 1.2 s wait). Sets `data-ignited` on <html>; CSS drives the timed entrances, GSAP the
 * title, CountUp the numbers. With reduced motion everything is already in its final state.
 */
export const IGNITION = {
  background: 0,
  seam: 150,
  stroke: 400,
  fill: 1900,
  lede: 1900,
  numbers: 2050,
  actions: 2200,
  bar: 2400
} as const;

const IgnitionContext = createContext(false);

export function IgnitionProvider({ children }: { children: ReactNode }) {
  const [ignited, setIgnited] = useState(false);

  useEffect(() => {
    let alive = true;
    fontsReady(1200).then(() => {
      if (!alive) return;
      document.documentElement.dataset.ignited = 'true';
      setIgnited(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return <IgnitionContext.Provider value={ignited}>{children}</IgnitionContext.Provider>;
}

export function useIgnited(): boolean {
  return useContext(IgnitionContext);
}
