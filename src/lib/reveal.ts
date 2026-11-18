import { useEffect, useRef, type RefObject } from 'react';

export const REVEAL_ROOT_MARGIN = '0px 0px -12% 0px';
export const REVEAL_SAFETY_MS = 2500;

/**
 * Calls `onReveal` once when `element` enters the viewport (threshold 0, bottom margin -12%).
 * Safety net: if the observer has not reported anything after 2.5 s (hidden window, no
 * rendering), reveal anyway. Returns a cleanup function.
 */
export function observeReveal(element: Element, onReveal: () => void): () => void {
  let done = false;
  let reported = false;
  const reveal = () => {
    if (done) return;
    done = true;
    observer?.disconnect();
    clearTimeout(safety);
    onReveal();
  };

  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          entries => {
            reported = true;
            if (entries.some(entry => entry.isIntersecting)) reveal();
          },
          { threshold: 0, rootMargin: REVEAL_ROOT_MARGIN }
        )
      : null;

  if (observer) observer.observe(element);

  const safety = setTimeout(() => {
    if (!reported || document.hidden) reveal();
  }, REVEAL_SAFETY_MS);

  if (!observer) reveal();

  return () => {
    done = true;
    observer?.disconnect();
    clearTimeout(safety);
  };
}

/**
 * Adds `is-in` to the element when revealed. Children with `.reveal-item` animate in with
 * a 60 ms stagger (`--i`).
 */
export function useReveal<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    return observeReveal(element, () => element.classList.add('is-in'));
  }, []);
  return ref;
}
