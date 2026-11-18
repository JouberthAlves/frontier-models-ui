import { useRef, useState, type KeyboardEvent } from 'react';
import SectionTitle from './SectionTitle';
import SplitFlapText from './bits/SplitFlapText';
import DecryptedText from './bits/DecryptedText';
import SceneViewer from './SceneViewer';
import ExternalLink from './ExternalLink';
import { useI18n } from '../i18n/i18n';
import { useCompare } from '../context/CompareContext';
import { racingArena, sceneSrc, type Run } from '../data/archive';
import { colorOf } from '../data/models';
import { SCENE_NUMBERS, sceneName } from '../data/scenes';
import { isKeyboardFocus } from '../lib/motion';
import { useReveal } from '../lib/reveal';
import './Racing.css';

const sceneSize = (run: Run, n: number) => run.scenes?.find(scene => scene.n === n) ?? { n, w: 1600, h: 900 };


export default function Racing() {
  const { t, lang } = useI18n();
  const { selected } = useCompare();
  const [scene, setScene] = useState(1);
  const [viewer, setViewer] = useState<{ open: boolean; opener: HTMLElement | null }>({ open: false, opener: null });
  const [nameKeys, setNameKeys] = useState<Record<string, number>>({});
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabsReveal = useReveal<HTMLDivElement>();
  const stageReveal = useReveal<HTMLDivElement>();
  const gamesReveal = useReveal<HTMLUListElement>();

  const lead = selected[0] ?? racingArena[0];
  const cols = selected.length;
  const sizes =
    cols === 1
      ? '(max-width: 767px) calc(100vw - 72px), min(1184px, calc(100vw - 152px))'
      : cols === 2
        ? '(max-width: 767px) calc(100vw - 72px), min(580px, calc(50vw - 88px))'
        : '(max-width: 767px) calc(100vw - 72px), min(380px, calc(33vw - 66px))';

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = SCENE_NUMBERS.length - 1;
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next < 0) return;
    event.preventDefault();
    setScene(SCENE_NUMBERS[next]);
    tabRefs.current[next]?.focus();
  };

  const sceneLabel = (n: number) => `S${n} ${sceneName(lang, n)}`;

  return (
    <section id="racing" className="section racing race-scope" aria-labelledby="racing-title">
      <div className="shell racing__flow">
        {/* Each block declares its side; the track is computed from these rectangles (RaceMap). */}
        <div className="race-card racing__block racing__block--intro" data-track-side="right">
          <header className="section__head">
            <SectionTitle id="racing-title" text={t.racing.title} strokeColor="var(--ink-navy)" fill="var(--ink-navy)" />
            <p className="lede">{t.racing.intro}</p>
          </header>

          <div ref={tabsReveal} className="scene-tabs" role="tablist" aria-label={t.racing.scenes}>
          {SCENE_NUMBERS.map((n, index) => {
            const active = n === scene;
            return (
              <button
                key={n}
                ref={node => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`scene-tab-${n}`}
                aria-selected={active}
                aria-controls="scene-stage"
                tabIndex={active ? 0 : -1}
                className={`scene-tab reveal-item${active ? ' is-active' : ''}`}
                style={{ ['--i' as string]: index }}
                onClick={() => setScene(n)}
                onKeyDown={event => onTabKey(event, index)}
              >
                <span className="frame scene-tab__thumb">
                  <img
                    src={sceneSrc(lead.id, n, 640)}
                    width={640}
                    height={360}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <span className="scene-tab__text">
                  <span className="data scene-tab__n">S{n}</span>
                  <span className="scene-tab__name">{sceneName(lang, n)}</span>
                </span>
              </button>
            );
          })}
          </div>
        </div>

        <div className="race-card racing__block racing__block--stage" data-track-side="full">
        <div
          ref={stageReveal}
          id="scene-stage"
          className="stage"
          role="tabpanel"
          aria-labelledby={`scene-tab-${scene}`}
          data-cols={cols}
        >
          {selected.map((run, index) => {
            const size = sceneSize(run, scene);
            const alt = `${run.model} — ${sceneLabel(scene)}`;
            return (
              <article
                key={run.id}
                className="stage__col reveal-item"
                style={{ ['--dot' as string]: colorOf(run), ['--i' as string]: index }}
                aria-label={run.model}
                onFocus={event => {
                  if (isKeyboardFocus(event.target)) setNameKeys(keys => ({ ...keys, [run.id]: (keys[run.id] ?? 0) + 1 }));
                }}
              >
                <span className="stage__bar" aria-hidden="true" />
                <h3 className="stage__name">
                  <SplitFlapText
                    text={run.model}
                    color="var(--ink-navy)"
                    tileColor={colorOf(run)}
                    decryptOnHover
                    playKey={nameKeys[run.id] ?? 0}
                  />
                </h3>
                <button
                  type="button"
                  className="frame stage__shot"
                  style={{ aspectRatio: `${size.w} / ${size.h}` }}
                  aria-label={t.racing.enlarge(alt)}
                  onClick={event => setViewer({ open: true, opener: event.currentTarget })}
                >
                  <img
                    key={scene}
                    className="stage__img"
                    src={sceneSrc(run.id, scene, 1600)}
                    srcSet={`${sceneSrc(run.id, scene, 640)} 640w, ${sceneSrc(run.id, scene, 1600)} ${size.w}w`}
                    sizes={sizes}
                    width={size.w}
                    height={size.h}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    onLoad={event => event.currentTarget.classList.add('is-loaded')}
                    ref={node => {
                      // Already in the cache: no load event will come.
                      if (node?.complete && node.naturalWidth) node.classList.add('is-loaded');
                    }}
                  />
                </button>
                <div className="stage__links">
                  {run.liveUrl ? (
                    <ExternalLink className="link link--warm" href={run.liveUrl}>
                      {t.racing.play}
                    </ExternalLink>
                  ) : (
                    <span className="muted">{t.racing.deleted}</span>
                  )}
                  {run.sourceUrl && (
                    <ExternalLink className="link" href={run.sourceUrl}>
                      {t.racing.code}
                    </ExternalLink>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        </div>

        <div className="race-card racing__block racing__block--games" data-track-side="left">
          <h3 className="racing__games-title">{t.racing.games(racingArena.length)}</h3>
          <ul ref={gamesReveal} className="games">
            {racingArena.map((run, index) => (
              <GameCard key={run.id} run={run} index={index} />
            ))}
          </ul>

          <p className="caption racing__note">{t.racing.note}</p>
        </div>

        {/* Finish line of the track, then room for the road to end and the cars to float away. */}
        <div className="racing__finish" aria-hidden="true">
          <span className="racing__finish-line" data-track-finish />
        </div>
      </div>

      <SceneViewer
        open={viewer.open}
        opener={viewer.opener}
        scene={scene}
        onScene={setScene}
        onClose={() => setViewer({ open: false, opener: null })}
      />
    </section>
  );
}

function GameCard({ run, index }: { run: Run; index: number }) {
  const { t } = useI18n();
  const { add, has, canAdd } = useCompare();
  const [echo, setEcho] = useState(0);
  const inCompare = has(run.id);
  const label = inCompare ? t.racing.compareIn : canAdd ? t.racing.compareAdd : t.racing.compareFull;

  return (
    <li className="games__item reveal-item" style={{ ['--dot' as string]: colorOf(run), ['--i' as string]: index }}>
      <article
        className="game"
        aria-label={run.model}
        onPointerEnter={event => {
          if (event.pointerType === 'mouse') setEcho(value => value + 1);
        }}
        onFocus={event => {
          if (isKeyboardFocus(event.target)) setEcho(value => value + 1);
        }}
      >
        <span className="game__stripe" aria-hidden="true" />
        <div className="frame game__thumb">
          <img src={sceneSrc(run.id, 1, 640)} width={640} height={360} alt="" loading="lazy" decoding="async" />
        </div>
        <div className="game__body">
          <h3 className="game__name">
            <DecryptedText text={run.model} animateOn="hover" playKey={echo} tone={colorOf(run)} onCream />
          </h3>
          <p className="game__prompt">{t.racing.prompt}</p>
          <div className="game__links">
            {run.liveUrl ? (
              <ExternalLink className="link link--warm" href={run.liveUrl}>
                {t.racing.play}
              </ExternalLink>
            ) : (
              <span className="muted">{t.racing.deleted}</span>
            )}
            {run.sourceUrl && (
              <ExternalLink className="link" href={run.sourceUrl}>
                {t.racing.code}
              </ExternalLink>
            )}
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--small game__compare"
            disabled={inCompare || !canAdd}
            onClick={() => add(run.id)}
            aria-label={inCompare || !canAdd ? undefined : t.racing.compareAddLabel(run.model)}
          >
            {label}
          </button>
        </div>
      </article>
    </li>
  );
}
