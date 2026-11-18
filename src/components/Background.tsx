import { useEffect, useRef, useState } from 'react';
import Galaxy from './bits/Galaxy';
import { hasGpu, reportGalaxyOff } from '../lib/gpu';
import { isSmallScreen, isTouchDevice, useReducedMotion, whenIdle } from '../lib/motion';
import './Background.css';

// Cool tints with a few warm ones (one slot in eight).
const STAR_COLORS = ['#83caff', '#85e4eb', '#f1f6fd', '#83caff', '#85e4eb', '#f1f6fd', '#f1f6fd', '#ffc99d'];

type Tone = 'none' | 'warm' | 'cool';

/**
 * Global background, fixed behind the page: diagonal base gradient, the Galaxy shader (real GPU
 * only) or a static CSS star field, and the two tone veils driven by the active section.
 */
export default function Background() {
  const reduced = useReducedMotion();
  const [galaxyReady, setGalaxyReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const veilsRef = useRef<HTMLDivElement>(null);

  const gpu = !reduced && hasGpu();
  const showGalaxy = gpu && galaxyReady && !failed;

  useEffect(() => {
    if (!gpu) {
      reportGalaxyOff();
      return undefined;
    }
    return whenIdle(() => setGalaxyReady(true), 300);
  }, [gpu]);

  // Tone veils: the section crossing the middle line of the viewport.
  useEffect(() => {
    const veils = veilsRef.current;
    if (!veils || typeof IntersectionObserver !== 'function') return undefined;
    const ids = ['top', 'racing', 'orbitarium', 'prompts', 'archive'];
    const active = new Map<string, boolean>();
    const apply = () => {
      const tone: Tone = active.get('racing') ? 'warm' : active.get('orbitarium') ? 'cool' : 'none';
      veils.dataset.tone = tone;
    };
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => active.set(entry.target.id, entry.isIntersecting));
        apply();
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    ids.forEach(id => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  const touch = isTouchDevice();
  const small = isSmallScreen();

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__base" />
      <div className={`bg__stars${showGalaxy ? ' is-hidden' : ''}`} />
      {showGalaxy && (
        <div className="bg__galaxy">
          <Galaxy
            starColors={STAR_COLORS}
            density={small ? 0.6 : 1}
            layers={small ? 2 : 4}
            dpr={touch ? 1 : Math.min(window.devicePixelRatio || 1, 1.25)}
            frameRateCap={touch ? 30 : 0}
            onFail={reason => {
              // Frozen: keep the last complete frame on screen. Lost / unavailable: static stars.
              if (reason !== 'frozen') setFailed(true);
              reportGalaxyOff();
            }}
          />
        </div>
      )}
      <div ref={veilsRef} className="bg__veils" data-tone="none">
        <div className="bg__veil bg__veil--warm" />
        <div className="bg__veil bg__veil--cool" />
      </div>
    </div>
  );
}
