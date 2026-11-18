import { useRef, useState, type KeyboardEvent } from 'react';
import SectionTitle from './SectionTitle';
import ExternalLink from './ExternalLink';
import { useI18n } from '../i18n/i18n';
import type { Dict } from '../i18n/pt';
import { archive, archiveOrder, promptUrl, type Benchmark, type Prompt } from '../data/archive';
import { colorOf } from '../data/models';
import { promptLabel } from '../data/prompts';
import { useReveal } from '../lib/reveal';
import './Prompts.css';

interface TabDef {
  benchmark: Benchmark;
  prompt: Prompt;
}

function stateText(t: Dict, benchmark: Benchmark, prompt: Prompt): string {
  const s = t.prompts.states;
  if (benchmark === 'orbitarium') {
    if (prompt.key === 'sun-original') return s.original;
    if (prompt.key === 'frontier-v2') return s.current;
    return s.archived;
  }
  if (prompt.status === 'legacy-archived-verbatim-and-verified') return s.legacy;
  if (prompt.status.startsWith('historical-frozen-archived')) return s.historical;
  if (prompt.status.startsWith('current-')) return s.current;
  if (prompt.status.startsWith('candidate-')) return s.candidate;
  return s.archived;
}

function tabText(t: Dict, benchmark: Benchmark, prompt: Prompt): string {
  const base = promptLabel(prompt.key);
  if (benchmark === 'racing' && prompt.status.startsWith('current-')) return `${base} · ${t.prompts.current}`;
  if (benchmark === 'racing' && prompt.status.startsWith('candidate-')) return `${base} · ${t.prompts.candidate}`;
  return base;
}

const GROUPS: Benchmark[] = ['racing', 'orbitarium'];

export default function Prompts() {
  const { t, nf } = useI18n();
  const [active, setActive] = useState<string>(`racing:${archive.benchmarks.racing.currentPrompt ?? 'racing-v3.4'}`);
  const tabRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const reveal = useReveal<HTMLDivElement>();

  const tabs: Record<Benchmark, TabDef[]> = {
    racing: archive.benchmarks.racing.prompts.map(prompt => ({ benchmark: 'racing', prompt })),
    orbitarium: archive.benchmarks.orbitarium.prompts.map(prompt => ({ benchmark: 'orbitarium', prompt }))
  };
  const all = [...tabs.racing, ...tabs.orbitarium];
  const current = all.find(tab => `${tab.benchmark}:${tab.prompt.key}` === active) ?? all[0];
  const { benchmark, prompt } = current;
  const runs = archiveOrder.filter(run => run.benchmark === benchmark && run.prompt === prompt.key);
  const kbText = `${new Intl.NumberFormat(nf.resolvedOptions().locale, { maximumFractionDigits: 1 }).format(prompt.bytes / 1024)} KB`;

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, group: TabDef[], index: number) => {
    const last = group.length - 1;
    let next = -1;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next < 0) return;
    event.preventDefault();
    const target = group[next];
    const key = `${target.benchmark}:${target.prompt.key}`;
    setActive(key);
    tabRefs.current.get(key)?.focus();
  };

  return (
    <section id="prompts" className="section prompts" aria-labelledby="prompts-title">
      <div className="shell">
        <header className="section__head">
          <SectionTitle id="prompts-title" text={t.prompts.title} strokeColor="var(--ink-2)" />
        </header>

        <div ref={reveal} className="prompts__body">
          {GROUPS.map((group, groupIndex) => {
            const list = tabs[group];
            const hasActive = list.some(tab => `${tab.benchmark}:${tab.prompt.key}` === active);
            return (
              <div key={group} className="prompts__group reveal-item" style={{ ['--i' as string]: groupIndex }}>
                <p className={`prompts__group-label prompts__group-label--${group}`} id={`prompts-${group}-label`}>
                  {group === 'racing' ? 'Racing' : 'Orbitarium'}
                </p>
                <div
                  className="prompts__tabs"
                  role="tablist"
                  aria-label={group === 'racing' ? t.prompts.racingTabs : t.prompts.orbitTabs}
                >
                  {list.map((tab, index) => {
                    const key = `${tab.benchmark}:${tab.prompt.key}`;
                    const selected = key === active;
                    return (
                      <button
                        key={key}
                        ref={node => {
                          tabRefs.current.set(key, node);
                        }}
                        type="button"
                        role="tab"
                        id={`prompt-tab-${tab.benchmark}-${tab.prompt.key}`}
                        aria-selected={selected}
                        aria-controls="prompt-panel"
                        tabIndex={selected || (!hasActive && index === 0) ? 0 : -1}
                        className={`prompt-tab prompt-tab--${group}${selected ? ' is-active' : ''}`}
                        onClick={() => setActive(key)}
                        onKeyDown={event => onKey(event, list, index)}
                      >
                        {tabText(t, tab.benchmark, tab.prompt)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div
            id="prompt-panel"
            role="tabpanel"
            aria-labelledby={`prompt-tab-${benchmark}-${prompt.key}`}
            className={`prompt-panel prompt-panel--${benchmark} reveal-item`}
            style={{ ['--i' as string]: 2 }}
          >
            <div key={active} className="prompt-panel__inner">
              <dl className="prompt-panel__facts">
                <div>
                  <dt>{t.prompts.file}</dt>
                  <dd className="data">{prompt.path}</dd>
                </div>
                <div>
                  <dt>{t.prompts.status}</dt>
                  <dd>{stateText(t, benchmark, prompt)}</dd>
                </div>
                <div>
                  <dt>{t.prompts.size}</dt>
                  <dd>
                    <span className="data">{kbText}</span> · {t.prompts.lines(nf.format(prompt.lines))}
                  </dd>
                </div>
                {prompt.attachment && (
                  <div>
                    <dt>{t.prompts.attachment}</dt>
                    <dd className="data">{prompt.attachment}</dd>
                  </div>
                )}
              </dl>

              <div className="prompt-panel__runs">
                <p className="prompt-panel__runs-title">{t.prompts.usedBy}</p>
                {runs.length ? (
                  <ul className="prompt-panel__chips">
                    {runs.map(run => (
                      <li key={run.key} className="chip" style={{ ['--dot' as string]: colorOf(run) }}>
                        <span className="dot" aria-hidden="true" />
                        <span>
                          {run.model}
                          {run.category !== 'current' && (
                            <span className="prompt-panel__cat"> · {t.archive.categories[run.category]}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="caption">{t.prompts.none}</p>
                )}
              </div>

              <ExternalLink
                className={`link ${benchmark === 'racing' ? 'link--warm' : 'link--cool'}`}
                href={promptUrl(benchmark, prompt.path)}
              >
                {t.prompts.read}
              </ExternalLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
