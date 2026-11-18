import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { racingArena, type Run } from '../data/archive';

export const MAX_COMPARE = 3;

interface CompareValue {
  /** Chosen racing runs (1–3), in the order they were added. */
  selected: Run[];
  add: (id: string) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  canAdd: boolean;
}

const CompareContext = createContext<CompareValue | null>(null);

/** Default comparison: the first two runs of the racing arena. */
export const DEFAULT_COMPARE: Run[] = racingArena.slice(0, 2);
const DEFAULT_IDS = DEFAULT_COMPARE.map(run => run.id);
const byId = new Map(racingArena.map(run => [run.id, run]));

export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(DEFAULT_IDS);

  const add = useCallback((id: string) => {
    setIds(current => (current.includes(id) || current.length >= MAX_COMPARE || !byId.has(id) ? current : [...current, id]));
  }, []);

  const remove = useCallback((id: string) => {
    setIds(current => (current.length <= 1 ? current : current.filter(item => item !== id)));
  }, []);

  const value = useMemo<CompareValue>(() => {
    const selected = ids.map(id => byId.get(id)).filter((run): run is Run => Boolean(run));
    return {
      selected,
      add,
      remove,
      has: (id: string) => ids.includes(id),
      canAdd: ids.length < MAX_COMPARE
    };
  }, [ids, add, remove]);

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareValue {
  const value = useContext(CompareContext);
  if (!value) throw new Error('useCompare must be used inside <CompareProvider>');
  return value;
}
