import { useState } from 'react';
import OrbitMap from './OrbitMap';
import DecryptedText from './bits/DecryptedText';
import ExternalLink from './ExternalLink';
import SpiralStill from './space/SpiralStill';
import { useI18n } from '../i18n/i18n';
import { orbitArena } from '../data/archive';
import { colorOf } from '../data/models';
import { hasGpu, useGalaxyOff } from '../lib/gpu';
import { isKeyboardFocus, useReducedMotion } from '../lib/motion';
import { useReveal } from '../lib/reveal';
import './Orbitarium.css';

export default function Orbitarium() {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const galaxyOff = useGalaxyOff();
  const [selectedKey, setSelectedKey] = useState(orbitArena[0]?.key ?? '');
  const [nameKeys, setNameKeys] = useState<Record<string, number>>({});
  const listReveal = useReveal<HTMLUListElement>();
  const mapReveal = useReveal<HTMLDivElement>();
  // No real GPU, reduced motion, or the WebGL galaxy stopped: the still picture of the spiral.
  const still = reduced || galaxyOff || !hasGpu();
  // Second hero (spec-v4 §3): one full screen with the words of the name at the two edges and
  // the galaxy between them, and nothing else. The lede, the map and the list come below it.
  const words = t.orbitarium.title.split('-').filter(Boolean);
  const lastWord = words.length > 1 ? words[words.length - 1] : '';
  const firstWords = lastWord ? words.slice(0, -1).join('-') : t.orbitarium.title;

  return (
    <section id="orbitarium" className="section orbitarium space" aria-labelledby="orbitarium-title">
      <div className="orbit-hero" data-galaxy-hero>
        {still && <SpiralStill />}
        <div className="orbit-hero__shell">
          <h2 id="orbitarium-title" className="split-title">
            <span className="sr-only">{t.orbitarium.title}</span>
            <span className="split-title__art" aria-hidden="true">
              <span className="split-title__word">
                <DecryptedText text={firstWords} animateOn="view" speed={35} tone="var(--sp-ink-2)" />
              </span>
              {/* Where the nucleus of the galaxy sits (read by lib/spiral.ts). */}
              <span className="split-title__core" data-galaxy-core />
              {lastWord && (
                <span className="split-title__word split-title__word--end">
                  <DecryptedText text={lastWord} animateOn="view" speed={35} tone="var(--sp-ink-2)" />
                </span>
              )}
            </span>
          </h2>
        </div>
      </div>

      <div className="shell orbitarium__shell">
        <p className="lede orbitarium__lede">{t.orbitarium.intro}</p>

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
                <li
                  key={run.key}
                  className={`orbit-row reveal-item${selected ? ' is-selected' : ''}`}
                  style={{ ['--i' as string]: index, ['--dot' as string]: color }}
                >
                  <h3 className="orbit-row__name">
                    <button
                      type="button"
                      className="orbit-row__select"
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
                  <p className="orbit-row__prompt">
                    {run.prompt === 'frontier-v2' ? t.orbitarium.promptV2 : t.orbitarium.promptUnverified}
                  </p>
                  <div className="orbit-row__links">
                    {run.liveUrl ? (
                      <ExternalLink className="pill pill--solid" href={run.liveUrl}>
                        {t.orbitarium.open}
                      </ExternalLink>
                    ) : (
                      <span className="muted">{t.orbitarium.deleted}</span>
                    )}
                    {run.sourceUrl && (
                      <ExternalLink className="pill pill--glass" href={run.sourceUrl}>
                        {t.orbitarium.code}
                      </ExternalLink>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
