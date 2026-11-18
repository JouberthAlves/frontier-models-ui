/**
 * One fact shared between the racing zone and the space: is the last stretch of road broken
 * (the last car has left it)? RaceMap sets it; the galaxy lights up when it first turns true.
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
