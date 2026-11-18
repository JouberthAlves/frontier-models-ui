import { useEffect, useId, useRef, useState } from 'react';
import { useCompare } from '../context/CompareContext';
import { useI18n } from '../i18n/i18n';
import { racingArena } from '../data/archive';
import { colorOf, shortName } from '../data/models';
import './CompareBar.css';

const LEAVE_MS = 150;

export default function CompareBar() {
  const { t } = useI18n();
  const { selected, add, remove, canAdd, has } = useCompare();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  // Body padding = bar height (CSS var on <html>).
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver !== 'function') return undefined;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--bar-h', `${Math.ceil(bar.offsetHeight)}px`);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // Popover: Esc and click outside close it; focus returns to the "+ model" button.
  useEffect(() => {
    if (!open) return undefined;
    const close = (restoreFocus: boolean) => {
      setOpen(false);
      if (restoreFocus) addRef.current?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target) || addRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    const first = popoverRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    first?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const choose = (id: string) => {
    add(id);
    setOpen(false);
    // The button may disappear (3 chosen): fall back to the bar's main action.
    requestAnimationFrame(() => {
      (addRef.current ?? barRef.current?.querySelector<HTMLElement>('.compare-bar__go'))?.focus();
    });
  };

  const startRemove = (id: string) => {
    setLeaving(id);
    setTimeout(() => {
      remove(id);
      setLeaving(current => (current === id ? null : current));
    }, LEAVE_MS);
  };

  const single = selected.length === 1;

  return (
    <div className="compare-bar" ref={barRef} role="region" aria-label={t.compare.region}>
      <span className="compare-bar__label">{t.compare.label}</span>
      <ul className="compare-bar__chips">
        {selected.map(run => (
          <li
            key={run.id}
            className={`compare-chip${leaving === run.id ? ' is-leaving' : ''}`}
            style={{ ['--dot' as string]: colorOf(run) }}
          >
            <span className="dot" aria-hidden="true" />
            <span className="compare-chip__name compare-chip__name--full">{run.model}</span>
            <span className="compare-chip__name compare-chip__name--short" aria-hidden="true">
              {shortName(run)}
            </span>
            {!single && (
              <button
                type="button"
                className="compare-chip__remove"
                aria-label={t.compare.remove(run.model)}
                onClick={() => startRemove(run.id)}
                disabled={leaving === run.id}
              >
                <span aria-hidden="true">×</span>
              </button>
            )}
          </li>
        ))}
        {canAdd && (
          <li className="compare-bar__add-wrap">
            <button
              ref={addRef}
              type="button"
              className="compare-bar__add"
              aria-label={t.compare.addLabel}
              aria-expanded={open}
              aria-controls={popoverId}
              onClick={() => setOpen(value => !value)}
            >
              <span aria-hidden="true">{t.compare.add}</span>
            </button>
          </li>
        )}
      </ul>

      <a className="btn btn--ink compare-bar__go" href="#scene-stage">
        <span className="compare-bar__go-full">{t.compare.view}</span>
        <span className="compare-bar__go-short" aria-hidden="true">
          {t.compare.viewShort}
        </span>
      </a>

      <div
        ref={popoverRef}
        id={popoverId}
        className="compare-pop"
        role="group"
        aria-label={t.compare.listLabel}
        hidden={!open}
      >
        <p className="compare-pop__title">{t.compare.listLabel}</p>
        <ul>
          {racingArena.map(run => {
            const chosen = has(run.id);
            return (
              <li key={run.id}>
                <button
                  type="button"
                  className="compare-pop__item"
                  disabled={chosen}
                  aria-pressed={chosen}
                  onClick={() => choose(run.id)}
                  style={{ ['--dot' as string]: colorOf(run) }}
                >
                  <span className="dot" aria-hidden="true" />
                  <span className="wrap-any">{run.model}</span>
                  {chosen && <span className="compare-pop__check">✓ {t.compare.chosen}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
