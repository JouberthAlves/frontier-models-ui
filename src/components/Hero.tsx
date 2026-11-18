import { useCallback, useRef } from 'react';
import StrokeText from './bits/StrokeText';
import DecryptedText from './bits/DecryptedText';
import CountUp from './bits/CountUp';
import { useI18n } from '../i18n/i18n';
import { IGNITION, useIgnited } from '../context/IgnitionContext';
import { currentProjectCount } from '../data/archive';
import { SCENE_NUMBERS } from '../data/scenes';
import './Hero.css';

const TITLE_LINES = ['FRONTIER', 'MODELS'];

/**
 * Hero (spec-v2 §6): not a card, it sits straight on the sand of the map. Navy title drawn by
 * StrokeText, then a 6 px orange→cyan underline draws from the left. The block occupies the left
 * side on wide screens; the starting grid of the track is on the free side (RaceMap).
 */
export default function Hero() {
  const { t, nf } = useI18n();
  const ignited = useIgnited();
  const artRef = useRef<HTMLSpanElement>(null);

  const stats = [2, currentProjectCount, SCENE_NUMBERS.length];

  const onMeasure = useCallback((widestEm: number) => {
    artRef.current?.style.setProperty('--title-wem', widestEm.toFixed(3));
  }, []);

  return (
    <section id="top" className="hero race-scope" aria-labelledby="hero-title">
      <div className="shell">
        <div className="hero__inner" data-track-side="left">
          <h1 id="hero-title" className="hero__title">
            <span className="sr-only">Frontier Models</span>
            <span ref={artRef} className="hero__title-art" aria-hidden="true">
              <StrokeText
                lines={TITLE_LINES}
                strokeColor="#ffffff"
                fill="#ffffff"
                onMeasure={onMeasure}
                trigger="controlled"
                play={ignited}
                delay={IGNITION.stroke / 1000}
                drawDuration={1.6}
                stagger={0.05}
                ease="power2.out"
                fillAt={(IGNITION.fill - IGNITION.stroke) / 1000}
                fillDuration={0.8}
                fillEase="power2.inOut"
                fillMode="wipe"
                strokeWidth={3}
                fontWeight={900}
                fontStretch={125}
                letterSpacing={-4}
              />
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
      </div>
    </section>
  );
}
