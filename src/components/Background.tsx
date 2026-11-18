import { useEffect, useRef, useState } from 'react';
import Galaxy from './bits/Galaxy';
import { markStep } from '../lib/boot';
import { hasGpu, reportGalaxyOff } from '../lib/gpu';
import { isSmallScreen, isTouchDevice, useReducedMotion } from '../lib/motion';
import './Background.css';

// Cool tints with a few warm ones (one slot in eight).
const STAR_COLORS = ['#83caff', '#85e4eb', '#f1f6fd', '#83caff', '#85e4eb', '#f1f6fd', '#f1f6fd', '#ffc99d'];

/**
 * Global background, fixed behind the page: navy base gradient, the sky (Galaxy shader with a
 * real GPU, otherwise a static CSS star field) and the cool veil of the Orbitarium.
 *
 * v2: the sky is hidden behind the map of the racing zone. RaceMap fades the `[data-race-sky]`
 * wrapper in from the finish line on; the Galaxy is compiled while the page loads (loading
 * step 5) and only renders once the finish line is within one screen.
 */
export default function Background() {
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const [near, setNear] = useState(false);
  const veilRef = useRef<HTMLDivElement>(null);

  const gpu = !reduced && hasGpu();
  const showGalaxy = gpu && !failed;

  useEffect(() => {
    if (gpu) return;
    reportGalaxyOff();
    markStep('sky');
  }, [gpu]);

  // The finish line is within one screen below the viewport, or already above it.
  useEffect(() => {
    const finish = document.querySelector('[data-track-finish]');
    if (!finish || typeof IntersectionObserver !== 'function') {
      const id = setTimeout(() => setNear(true), 0);
      return () => clearTimeout(id);
    }
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[entries.length - 1];
        setNear(entry.isIntersecting || entry.boundingClientRect.top < 0);
      },
      { rootMargin: '0px 0px 100% 0px', threshold: 0 }
    );
    observer.observe(finish);
    return () => observer.disconnect();
  }, []);

  // Cool veil: on while the Orbitarium crosses the middle line of the viewport.
  useEffect(() => {
    const veil = veilRef.current;
    const section = document.getElementById('orbitarium');
    if (!veil || !section || typeof IntersectionObserver !== 'function') return undefined;
    const observer = new IntersectionObserver(
      entries => {
        veil.dataset.on = String(entries.some(entry => entry.isIntersecting));
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const touch = isTouchDevice();
  const small = isSmallScreen();

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__base" />
      <div className="bg__sky" data-race-sky>
        <div className={`bg__stars${showGalaxy ? ' is-hidden' : ''}`} />
        {showGalaxy && (
          <div className="bg__galaxy">
            <Galaxy
              starColors={STAR_COLORS}
              density={small ? 0.6 : 1}
              layers={small ? 2 : 4}
              dpr={touch ? 1 : Math.min(window.devicePixelRatio || 1, 1.25)}
              frameRateCap={touch ? 30 : 0}
              paused={!near}
              onReady={() => markStep('sky')}
              onFail={reason => {
                // Frozen: keep the last complete frame on screen. Lost / unavailable: static stars.
                if (reason !== 'frozen') setFailed(true);
                reportGalaxyOff();
                markStep('sky');
              }}
            />
          </div>
        )}
      </div>
      <div ref={veilRef} className="bg__veil bg__veil--cool" data-on="false" />
    </div>
  );
}
