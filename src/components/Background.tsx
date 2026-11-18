import { useEffect, useState } from 'react';
import SpiralGalaxy from './space/SpiralGalaxy';
import { markStep } from '../lib/boot';
import { hasGpu, reportGalaxyOff } from '../lib/gpu';
import { isSmallScreen, isTouchDevice, useReducedMotion } from '../lib/motion';
import { SPIRAL_POINTS } from '../lib/spiral';
import './Background.css';

/**
 * Global background, fixed behind the page: the navy base (behind the racing zone) and the sky
 * of the space (spec-v3 §3): near-black, with the spiral galaxy in WebGL when there is a real
 * GPU and motion is allowed, otherwise a static CSS star field (the still picture of the galaxy
 * is drawn by the Orbitarium section itself, see space/SpiralStill.tsx).
 *
 * The sky is hidden behind the map of the racing zone. RaceMap fades the `[data-race-sky]`
 * wrapper in from the finish line on; the galaxy is compiled while the page loads (loading
 * step 5) and only renders once the finish line is within one screen.
 */
export default function Background() {
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const [near, setNear] = useState(false);

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

  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__base" />
      <div className="bg__sky" data-race-sky>
        <div className={`bg__stars${showGalaxy ? ' is-hidden' : ''}`} />
        {showGalaxy && (
          <SpiralGalaxy
            points={isSmallScreen() ? SPIRAL_POINTS.phone : SPIRAL_POINTS.desktop}
            frameRateCap={isTouchDevice() ? 30 : 0}
            paused={!near}
            onReady={() => markStep('sky')}
            onFail={() => {
              // No context, frozen by the watchdog or context lost: the static stars take over,
              // the Orbitarium shows the still picture and the notice bar comes up.
              setFailed(true);
              reportGalaxyOff();
              markStep('sky');
            }}
          />
        )}
      </div>
    </div>
  );
}
