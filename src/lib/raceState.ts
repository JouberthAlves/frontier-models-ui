/**
 * Facts shared between the racing zone and the rest of the page. RaceMap writes them.
 *
 * - `roadBroken`: the first car has jumped off the broken end of the road (the galaxy lights up
 *   when it first turns true).
 * - `finishY`: document y of the finish line. Above it the page is the race, below it the space:
 *   lib/zone.ts turns that into `data-zone` on <html> (compare bar and notice skins, spec-v4 §4).
 */
let broken = false;
const listeners = new Set<(broken: boolean) => void>();

export function setRoadBroken(next: boolean): void {
  if (next === broken) return;
  broken = next;
  listeners.forEach(listener => listener(broken));
}

export const isRoadBroken = () => broken;

export function onRoadBroken(listener: (broken: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let finishY: number | null = null;
const finishListeners = new Set<() => void>();

export function setFinishY(next: number): void {
  const rounded = Math.round(next);
  if (rounded === finishY) return;
  finishY = rounded;
  finishListeners.forEach(listener => listener());
}

/** Document y of the finish line, or null before the map was measured. */
export const getFinishY = () => finishY;

export function onFinishY(listener: () => void): () => void {
  finishListeners.add(listener);
  return () => {
    finishListeners.delete(listener);
  };
}
