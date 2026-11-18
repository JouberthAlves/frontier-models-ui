import { getFinishY, onFinishY } from './raceState';

export type Zone = 'race' | 'space';

/**
 * Which zone the middle of the window is in (spec-v4 §4): the race from the top of the page to
 * the finish line, the space from there down. Written to `data-zone` on <html>, only when it
 * changes; the compare bar, its popover and the motion notice pick their skin from it in CSS.
 * The finish line is the one of the map (raceState); before the map is measured, the element.
 */
export function watchZone(): () => void {
  const root = document.documentElement;
  let raf = 0;
  let fallback: number | null = null;
  let current: Zone | null = null;

  const finish = () => {
    const known = getFinishY();
    if (known !== null) return known;
    if (fallback === null) {
      const node = document.querySelector('[data-track-finish]');
      if (node) fallback = node.getBoundingClientRect().top + window.scrollY;
    }
    return fallback;
  };

  const update = () => {
    raf = 0;
    const y = finish();
    const zone: Zone = y !== null && window.scrollY + window.innerHeight / 2 >= y ? 'space' : 'race';
    if (zone === current) return;
    current = zone;
    root.dataset.zone = zone;
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  const onResize = () => {
    fallback = null;
    schedule();
  };

  update();
  const stop = onFinishY(schedule);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });
  return () => {
    cancelAnimationFrame(raf);
    stop();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', onResize);
  };
}
