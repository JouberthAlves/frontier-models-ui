import { BOOT_STEPS, useBoot } from '../lib/boot';
import { useI18n } from '../i18n/i18n';
import './Loader.css';

/**
 * Loading screen C1, "start lights" (spec-v2 §8): one column of two lights per loading step;
 * a column turns on when its step finishes. All on → lights out → the screen fades and the hero
 * ignites. The page exists underneath (readers, SEO); focus is never trapped here.
 */
export default function Loader() {
  const { t } = useI18n();
  const { done, phase } = useBoot();
  if (phase === 'gone') return null;

  const total = BOOT_STEPS.length;
  const lit = phase === 'loading' || phase === 'lit' ? done : 0;

  return (
    <div className="loader" data-phase={phase}>
      <div className="loader__panel" aria-hidden="true">
        {BOOT_STEPS.map((step, index) => (
          <span key={step} className={`loader__col${index < lit ? ' is-on' : ''}`}>
            <i />
            <i />
          </span>
        ))}
      </div>
      <p className="loader__text" aria-hidden="true">
        {t.loader.text}
      </p>
      <p className="loader__count data" aria-hidden="true">
        {done} / {total}
      </p>
      <p className="sr-only" role="status" aria-live="polite">
        {t.loader.progress(done, total)}
      </p>
    </div>
  );
}
