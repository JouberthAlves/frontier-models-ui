import { useCallback, useEffect, useRef } from 'react';
import StrokeText from './bits/StrokeText';
import DecryptedText from './bits/DecryptedText';
import CountUp from './bits/CountUp';
import TrackTrails from './TrackTrails';
import { useI18n } from '../i18n/i18n';
import { IGNITION, useIgnited } from '../context/IgnitionContext';
import { currentProjectCount } from '../data/archive';
import { SCENE_NUMBERS } from '../data/scenes';
import { prefersReducedMotion } from '../lib/motion';
import './Hero.css';

const TITLE_LINES = ['FRONTIER', 'MODELS'];
const TRACK_FILL: [string, string] = ['#ffb76b', '#fff5ed'];
const SKY_FILL: [string, string] = ['#f0f8ff', '#85e4eb'];
const DESKTOP_QUERY = '(min-width: 900px)';

type Point = [number, number];

/** Below 900px the seam runs from the right edge (20% down) to the left edge (36% down),
 *  so it crosses FRONTIER/MODELS and stays clear of the text under the title. */
const MOBILE_SEAM: [number, number] = [0.2, 0.36];

/** The seam polygon (track side), in fractions of the hero box. */
const trackPolygon = (desktop: boolean): Point[] =>
  desktop
    ? [
        [0, 0],
        [0.58, 0],
        [0.42, 1],
        [0, 1]
      ]
    : [
        [0, 0],
        [1, 0],
        [1, MOBILE_SEAM[0]],
        [0, MOBILE_SEAM[1]]
      ];

const skyPolygon = (desktop: boolean): Point[] =>
  desktop
    ? [
        [0.58, 0],
        [1, 0],
        [1, 1],
        [0.42, 1]
      ]
    : [
        [0, MOBILE_SEAM[1]],
        [1, MOBILE_SEAM[0]],
        [1, 1],
        [0, 1]
      ];

export default function Hero() {
  const { t, nf } = useI18n();
  const ignited = useIgnited();
  const heroRef = useRef<HTMLElement>(null);
  const artRef = useRef<HTMLSpanElement>(null);

  const stats = [2, currentProjectCount, SCENE_NUMBERS.length];

  // Clip both title copies with the seam polygon, expressed in the copy's own pixels so the
  // color swaps exactly where the seam crosses the title.
  useEffect(() => {
    const hero = heroRef.current;
    const art = artRef.current;
    if (!hero || !art) return undefined;
    const media = window.matchMedia(DESKTOP_QUERY);
    let raf = 0;

    const toCss = (points: Point[], heroRect: DOMRect, artRect: DOMRect) => {
      // Push the hero corners (never the seam points) far out so translated or stretched glyphs
      // are not cut by the copy box; the seam edge keeps its exact angle.
      const far = 4000;
      const coords = points.map(([fx, fy]) => {
        let x = heroRect.left + fx * heroRect.width - artRect.left;
        let y = heroRect.top + fy * heroRect.height - artRect.top;
        const corner = (fx === 0 || fx === 1) && (fy === 0 || fy === 1);
        if (corner) {
          x += fx === 0 ? -far : far;
          y += fy === 0 ? -far : far;
        }
        return `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      });
      return `polygon(${coords.join(', ')})`;
    };

    const update = () => {
      raf = 0;
      const heroRect = hero.getBoundingClientRect();
      const artRect = art.getBoundingClientRect();
      const desktop = media.matches;
      art.style.setProperty('--clip-track', toCss(trackPolygon(desktop), heroRect, artRect));
      art.style.setProperty('--clip-sky', toCss(skyPolygon(desktop), heroRect, artRect));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    observer?.observe(hero);
    observer?.observe(art);
    media.addEventListener('change', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      media.removeEventListener('change', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  // Speed on scroll: the title stretches and the two lines drift apart (rAF-throttled).
  useEffect(() => {
    const hero = heroRef.current;
    const art = artRef.current;
    if (!hero || !art || prefersReducedMotion()) return undefined;
    let raf = 0;
    let lastProgress = -1;
    const apply = () => {
      raf = 0;
      const height = hero.offsetHeight || 1;
      const progress = Math.min(1, Math.max(0, window.scrollY / height));
      if (Math.abs(progress - lastProgress) < 0.001) return;
      lastProgress = progress;
      art.querySelectorAll<HTMLElement>('.hero__title-motion').forEach(node => {
        node.style.transform = `translateX(${(-3 * progress).toFixed(3)}vw) scaleX(${(1 + 0.12 * progress).toFixed(4)})`;
      });
      art.querySelectorAll<SVGSVGElement>('.stroke-text__line').forEach(line => {
        const dir = line.dataset.line === '0' ? -1 : 1;
        line.style.transform = `translateX(${(dir * progress).toFixed(3)}vw)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const onMeasure = useCallback((widestEm: number) => {
    artRef.current?.style.setProperty('--title-wem', widestEm.toFixed(3));
  }, []);

  const strokeTiming = {
    trigger: 'controlled' as const,
    play: ignited,
    delay: IGNITION.stroke / 1000,
    drawDuration: 1.6,
    stagger: 0.05,
    ease: 'power2.out', // ≈ --ease-draw (easeOutCubic)
    fillAt: (IGNITION.fill - IGNITION.stroke) / 1000,
    fillDuration: 0.8,
    fillEase: 'power2.inOut',
    fillMode: 'wipe' as const,
    strokeWidth: 5,
    fontWeight: 900,
    fontStretch: 125,
    letterSpacing: -4
  };

  return (
    <section id="top" ref={heroRef} className="hero" aria-labelledby="hero-title">
      <div className="hero__track" aria-hidden="true">
        <TrackTrails />
      </div>

      <div className="hero__seam" aria-hidden="true">
        <svg className="hero__seam-halo" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <defs>
            <linearGradient id="seam-grad-halo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb76b" />
              <stop offset="100%" stopColor="#80e9f2" />
            </linearGradient>
          </defs>
          <line x1="100" y1="0" x2="0" y2="100" stroke="url(#seam-grad-halo)" strokeWidth="18" vectorEffect="non-scaling-stroke" />
        </svg>
        <svg className="hero__seam-core" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
          <defs>
            <linearGradient id="seam-grad-core" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffb76b" />
              <stop offset="100%" stopColor="#80e9f2" />
            </linearGradient>
          </defs>
          <line x1="100" y1="0" x2="0" y2="100" stroke="url(#seam-grad-core)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="hero__inner">
        <h1 id="hero-title" className="hero__title">
          <span className="sr-only">Frontier Models</span>
          <span ref={artRef} className="hero__title-art" aria-hidden="true">
            <span className="hero__title-copy hero__title-copy--track">
              <span className="hero__title-motion">
                <StrokeText lines={TITLE_LINES} strokeColor="#fdaf6d" fill={TRACK_FILL} onMeasure={onMeasure} {...strokeTiming} />
              </span>
            </span>
            <span className="hero__title-copy hero__title-copy--sky">
              <span className="hero__title-motion">
                <StrokeText lines={TITLE_LINES} strokeColor="#85e4eb" fill={SKY_FILL} {...strokeTiming} />
              </span>
            </span>
          </span>
        </h1>

        <p className="hero__lede">
          <DecryptedText text={t.hero.lede(currentProjectCount)} speed={35} maxIterations={8} sequential revealDirection="start" />
        </p>

        <dl className="hero__stats">
          {stats.map((value, index) => (
            <div className="hero__stat" key={index} style={{ ['--i' as string]: index }}>
              <dt className="hero__stat-label">{t.hero.stats[index]}</dt>
              <dd className="hero__stat-value">
                <CountUp to={value} start={ignited} delay={(IGNITION.numbers + index * 80) / 1000} duration={1.2} format={nf} />
              </dd>
            </div>
          ))}
        </dl>

        <div className="hero__actions">
          <span className="hero__action" style={{ ['--i' as string]: 0 }}>
            <a className="btn btn--primary" href="#racing">
              {t.hero.primary}
            </a>
          </span>
          <span className="hero__action" style={{ ['--i' as string]: 1 }}>
            <a className="btn btn--secondary" href="#orbitarium">
              {t.hero.secondary}
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
