import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n';
import { hasGpu, useGalaxyOff } from '../lib/gpu';
import { useReducedMotion } from '../lib/motion';
import './MotionNotice.css';

const STORAGE_KEY = 'fm-motion-notice-closed';

const readClosed = () => {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

/** Shown when motion is reduced or the animated background could not run. */
export default function MotionNotice() {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const galaxyOff = useGalaxyOff();
  const [closed, setClosed] = useState(readClosed);
  const noticeRef = useRef<HTMLDivElement>(null);

  // Waits until the visitor leaves the first screen, so it never covers the hero buttons.
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (past) return undefined;
    const check = () => {
      if (window.scrollY > window.innerHeight * 0.6) setPast(true);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [past]);

  const needed = reduced || galaxyOff || !hasGpu();
  const visible = needed && !closed && past;

  // Body padding also counts the notice, so it never hides the end of the page.
  useEffect(() => {
    const root = document.documentElement;
    const notice = noticeRef.current;
    if (!visible || !notice || typeof ResizeObserver !== 'function') {
      root.style.setProperty('--notice-h', '0px');
      return undefined;
    }
    const observer = new ResizeObserver(() => {
      root.style.setProperty('--notice-h', `${Math.ceil(notice.offsetHeight) + 10}px`);
    });
    observer.observe(notice);
    return () => {
      observer.disconnect();
      root.style.setProperty('--notice-h', '0px');
    };
  }, [visible]);

  if (!visible) return null;

  const close = () => {
    setClosed(true);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* storage blocked */
    }
  };

  return (
    <div ref={noticeRef} className="motion-notice" role="status">
      <p>{t.notice.text}</p>
      <button type="button" className="motion-notice__close" aria-label={t.notice.close} onClick={close}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
