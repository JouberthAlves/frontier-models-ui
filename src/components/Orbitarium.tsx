import { useState } from 'react';
import SectionTitle from './SectionTitle';
import OrbitMap from './OrbitMap';
import StarBorder from './bits/StarBorder';
import DecryptedText from './bits/DecryptedText';
import ExternalLink from './ExternalLink';
import { useI18n } from '../i18n/i18n';
import { orbitArena } from '../data/archive';
import { colorOf } from '../data/models';
import { hasGpu } from '../lib/gpu';
import { isKeyboardFocus, useReducedMotion } from '../lib/motion';
import { useReveal } from '../lib/reveal';
import './Orbitarium.css';

export default function Orbitarium() {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [selectedKey, setSelectedKey] = useState(orbitArena[0]?.key ?? '');
  const [nameKeys, setNameKeys] = useState<Record<string, number>>({});
  const listReveal = useReveal<HTMLUListElement>();
  const mapReveal = useReveal<HTMLDivElement>();
  const animatedBorder = !reduced && hasGpu();

  return (
    <section id="orbitarium" className="section orbitarium" aria-labelledby="orbitarium-title">
      <div className="shell">
        <header className="section__head">
          <SectionTitle id="orbitarium-title" text={t.orbitarium.title} strokeColor="var(--cyan)" />
          <p className="lede">{t.orbitarium.intro}</p>
        </header>

        <div className="orbitarium__layout">
          <div ref={mapReveal} className="orbitarium__map">
            <div className="reveal-item">
              <OrbitMap runs={orbitArena} selectedKey={selectedKey} onSelect={setSelectedKey} />
            </div>
          </div>

          <ul ref={listReveal} className="orbitarium__list">
            {orbitArena.map((run, index) => {
              const selected = run.key === selectedKey;
              const color = colorOf(run);
              return (
                <li key={run.key} className="reveal-item" style={{ ['--i' as string]: index, ['--dot' as string]: color }}>
                  <StarBorder color={color} speed={6} animated={animatedBorder} active={selected}>
                    <article className={`orbit-card${selected ? ' is-selected' : ''}`}>
                      <h3 className="orbit-card__name">
                        <button
                          type="button"
                          className="orbit-card__select"
                          aria-pressed={selected}
                          onClick={() => setSelectedKey(run.key)}
                          onFocus={event => {
                            if (isKeyboardFocus(event.currentTarget)) {
                              setNameKeys(keys => ({ ...keys, [run.key]: (keys[run.key] ?? 0) + 1 }));
                            }
                          }}
                        >
                          <span className="dot" aria-hidden="true" />
                          <span className="wrap-any">
                            <DecryptedText text={run.model} animateOn="hover" playKey={nameKeys[run.key] ?? 0} tone={color} />
                          </span>
                        </button>
                      </h3>
                      <p className="orbit-card__prompt">
                        {run.prompt === 'frontier-v2' ? t.orbitarium.promptV2 : t.orbitarium.promptUnverified}
                      </p>
                      <div className="orbit-card__links">
                        {run.liveUrl ? (
                          <ExternalLink className="link link--cool" href={run.liveUrl}>
                            {t.orbitarium.open}
                          </ExternalLink>
                        ) : (
                          <span className="muted">{t.orbitarium.deleted}</span>
                        )}
                        {run.sourceUrl && (
                          <ExternalLink className="link" href={run.sourceUrl}>
                            {t.orbitarium.code}
                          </ExternalLink>
                        )}
                      </div>
                    </article>
                  </StarBorder>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
