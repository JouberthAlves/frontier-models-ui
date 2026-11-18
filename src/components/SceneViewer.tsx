import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useCompare } from '../context/CompareContext';
import { useI18n } from '../i18n/i18n';
import { sceneSrc, type Run } from '../data/archive';
import { colorOf } from '../data/models';
import { SCENE_NUMBERS, sceneName } from '../data/scenes';
import './SceneViewer.css';

interface SceneViewerProps {
  open: boolean;
  opener: HTMLElement | null;
  scene: number;
  onScene: (n: number) => void;
  onClose: () => void;
}

const PAIRS: [number, number][] = [
  [0, 1],
  [0, 2],
  [1, 2]
];

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

export default function SceneViewer({ open, opener, scene, onScene, onClose }: SceneViewerProps) {
  const { t, lang } = useI18n();
  const { selected } = useCompare();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const [pairIndex, setPairIndex] = useState(0);
  const [pos, setPos] = useState(50);
  const pairSelectId = useId();

  useEffect(() => {
    openerRef.current = opener;
  }, [opener]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.classList.add('is-locked');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const onDialogClose = () => {
      document.body.classList.remove('is-locked');
      const back = openerRef.current;
      onClose();
      if (back?.isConnected) back.focus();
    };
    dialog.addEventListener('close', onDialogClose);
    return () => dialog.removeEventListener('close', onDialogClose);
  }, [onClose]);

  useEffect(() => () => document.body.classList.remove('is-locked'), []);

  const pairs = PAIRS.filter(([, b]) => b < selected.length);
  const [ia, ib] = pairs[pairIndex] ?? PAIRS[0];
  const runA: Run | undefined = selected[ia];
  const runB: Run | undefined = selected.length > 1 ? selected[ib] : undefined;
  const sceneIndex = SCENE_NUMBERS.indexOf(scene as (typeof SCENE_NUMBERS)[number]);
  const label = `S${scene} ${sceneName(lang, scene)}`;

  const step = (delta: number) => {
    const count = SCENE_NUMBERS.length;
    onScene(SCENE_NUMBERS[(sceneIndex + delta + count) % count]);
  };

  const setFromPointer = (clientX: number) => {
    const rect = compareRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    setPos(clampPct(((clientX - rect.left) / rect.width) * 100));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    setFromPointer(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) setFromPointer(event.clientX);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onSliderKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number | undefined> = {
      ArrowLeft: pos - 2,
      ArrowDown: pos - 2,
      ArrowRight: pos + 2,
      ArrowUp: pos + 2,
      Home: 0,
      End: 100
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    setPos(clampPct(next));
  };

  const onDialogKey = (event: KeyboardEvent<HTMLDialogElement>) => {
    const target = event.target as HTMLElement;
    if (event.key === 'Tab') {
      // Keep focus inside the dialog.
      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>('button, select, [tabindex="0"]') ?? []
      ).filter(node => !node.hasAttribute('disabled'));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (target.getAttribute('role') === 'slider' || target.tagName === 'SELECT') return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }
  };

  const shot = (run: Run, className: string) => (
    <img
      className={className}
      src={sceneSrc(run.id, scene, 1600)}
      width={run.scenes?.[sceneIndex]?.w ?? 1600}
      height={run.scenes?.[sceneIndex]?.h ?? 900}
      alt={`${run.model} — ${label}`}
      decoding="async"
      draggable={false}
    />
  );

  return (
    // Keyboard handling (focus trap, scene arrows) lives on the dialog itself.
    <dialog ref={dialogRef} className="viewer" aria-label={t.viewer.label} onKeyDown={onDialogKey}>
      {open && runA && (
        <div className="viewer__panel">
          <div className="viewer__stage">
            {runB ? (
              <div
                ref={compareRef}
                className="viewer__compare"
                style={{ ['--pos' as string]: pos }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {shot(runA, 'viewer__img')}
                <div className="viewer__top" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
                  {shot(runB, 'viewer__img')}
                </div>
                <span className="viewer__tag viewer__tag--a" style={{ ['--dot' as string]: colorOf(runA) }}>
                  <span className="dot" aria-hidden="true" />
                  {runA.model}
                </span>
                <span className="viewer__tag viewer__tag--b" style={{ ['--dot' as string]: colorOf(runB) }}>
                  <span className="dot" aria-hidden="true" />
                  {runB.model}
                </span>
                <div className="viewer__handle-track">
                  <div
                    className="viewer__handle"
                    role="slider"
                    tabIndex={0}
                    aria-label={t.viewer.slider}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(pos)}
                    aria-valuetext={t.viewer.sliderValue(runA.model, runB.model, Math.round(pos))}
                    onKeyDown={onSliderKey}
                  >
                    <span className="viewer__knob" aria-hidden="true">
                      ‹›
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="viewer__single">{shot(runA, 'viewer__img')}</div>
            )}
          </div>

          <div className="viewer__bar">
            <div className="viewer__meta">
              <p className="viewer__names">
                {[runA, runB].filter((run): run is Run => Boolean(run)).map(run => (
                  <span key={run.id} className="viewer__name" style={{ ['--dot' as string]: colorOf(run) }}>
                    <span className="dot" aria-hidden="true" />
                    {run.model}
                  </span>
                ))}
              </p>
              <p className="viewer__scene">
                <span className="data">S{scene}</span> {sceneName(lang, scene)}
              </p>
            </div>

            {pairs.length > 1 && (
              <div className="viewer__pair">
                <label htmlFor={pairSelectId}>{t.viewer.pair}</label>
                <select
                  id={pairSelectId}
                  value={pairIndex}
                  onChange={event => setPairIndex(Number(event.target.value))}
                >
                  {pairs.map(([a, b], index) => (
                    <option key={`${a}-${b}`} value={index}>
                      {selected[a].model} / {selected[b].model}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="viewer__actions">
              <button type="button" className="btn btn--ghost viewer__nav" aria-label={t.viewer.prev} onClick={() => step(-1)}>
                <span aria-hidden="true">←</span>
              </button>
              <button type="button" className="btn btn--ghost viewer__nav" aria-label={t.viewer.next} onClick={() => step(1)}>
                <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="btn btn--ink" onClick={() => dialogRef.current?.close()}>
                {t.viewer.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
