import DecryptedText from './bits/DecryptedText';
import { useState, type FocusEvent } from 'react';
import SectionTitle from './SectionTitle';
import ExternalLink from './ExternalLink';
import { useI18n } from '../i18n/i18n';
import type { Dict } from '../i18n/pt';
import { archive, archiveOrder, commitUrl, type Benchmark, type Category, type Run } from '../data/archive';
import { colorOf } from '../data/models';
import { promptLabel } from '../data/prompts';
import { isKeyboardFocus } from '../lib/motion';
import { useReveal } from '../lib/reveal';
import './Archive.css';

const CATEGORIES: Category[] = ['current', 'legacy', 'historical', 'outdated', 'non-frontier'];
const BENCHES: Benchmark[] = ['racing', 'orbitarium'];
const BENCH_NAME: Record<Benchmark, string> = { racing: 'Racing', orbitarium: 'Orbitarium' };

function CategoryChip({ run, t }: { run: Run; t: Dict }) {
  const tone = run.category === 'current' ? (run.benchmark === 'racing' ? 'warm' : 'cool') : 'plain';
  return <span className={`cat-chip cat-chip--${tone}`}>{t.archive.categories[run.category]}</span>;
}

function SiteCell({ run, t }: { run: Run; t: Dict }) {
  return run.liveUrl ? (
    <ExternalLink className="link" href={run.liveUrl}>
      {t.archive.open}
    </ExternalLink>
  ) : (
    <span className="muted">{t.archive.deleted}</span>
  );
}

function CodeCell({ run, t }: { run: Run; t: Dict }) {
  if (run.sourceUrl)
    return (
      <ExternalLink className="link" href={run.sourceUrl}>
        {t.archive.code}
      </ExternalLink>
    );
  if (run.recordUrl)
    return (
      <ExternalLink className="link" href={run.recordUrl}>
        {t.archive.record}
      </ExternalLink>
    );
  return <span className="muted">—</span>;
}

const promptText = (run: Run, t: Dict) => (run.prompt ? promptLabel(run.prompt) : t.archive.unverified);

export default function Archive() {
  const { t } = useI18n();
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [bench, setBench] = useState<Benchmark | 'all'>('all');
  // Keyboard focus on a link of a row plays the "decrypt" of its name (the mouse plays it on hover).
  const [nameKeys, setNameKeys] = useState<Record<string, number>>({});
  const playName = (key: string) => (event: FocusEvent<HTMLElement>) => {
    if (isKeyboardFocus(event.target)) setNameKeys(keys => ({ ...keys, [key]: (keys[key] ?? 0) + 1 }));
  };
  const tableReveal = useReveal<HTMLDivElement>();
  const listReveal = useReveal<HTMLUListElement>();

  const rows = archiveOrder.filter(
    run => (category === 'all' || run.category === category) && (bench === 'all' || run.benchmark === bench)
  );

  return (
    <section id="archive" className="section archive" aria-labelledby="archive-title">
      <div className="shell">
        <header className="section__head">
          <SectionTitle id="archive-title" text={t.archive.title} strokeColor="var(--cool)" />
        </header>

        <div className="archive__filters">
          <div className="archive__filter-row" role="group" aria-label={t.archive.filters}>
            {(['all', ...CATEGORIES] as const).map(value => (
              <button
                key={value}
                type="button"
                className="filter-chip"
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
              >
                {value === 'all' ? t.archive.all : t.archive.categories[value]}
              </button>
            ))}
          </div>
          <div className="archive__filter-row archive__filter-row--bench" role="group" aria-label={t.archive.benchFilter}>
            {(['all', ...BENCHES] as const).map(value => (
              <button
                key={value}
                type="button"
                className="filter-chip filter-chip--seg"
                aria-pressed={bench === value}
                onClick={() => setBench(value)}
              >
                {value === 'all' ? t.archive.all : BENCH_NAME[value]}
              </button>
            ))}
          </div>
          <p className="archive__count" aria-live="polite">
            {t.archive.count(rows.length)}
          </p>
        </div>

        {/* ≥ 768px: table */}
        <div ref={tableReveal} className="archive__table-wrap">
          <table className="archive__table">
            <thead>
              <tr>
                <th scope="col">{t.archive.cols.model}</th>
                <th scope="col">{t.archive.cols.benchmark}</th>
                <th scope="col">{t.archive.cols.category}</th>
                <th scope="col">{t.archive.cols.site}</th>
                <th scope="col">{t.archive.cols.code}</th>
                <th scope="col">{t.archive.cols.prompt}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((run, index) => (
                <tr key={run.key} className="reveal-item" style={{ ['--i' as string]: Math.min(index, 12) }} onFocus={playName(run.key)}>
                  <th scope="row">
                    <span className="archive__model" style={{ ['--dot' as string]: colorOf(run) }}>
                      <span className="dot" aria-hidden="true" />
                      <span className="wrap-any">
                  <DecryptedText text={run.model} animateOn="hover" playKey={nameKeys[run.key] ?? 0} tone={colorOf(run)} />
                </span>
                    </span>
                  </th>
                  <td>{BENCH_NAME[run.benchmark]}</td>
                  <td>
                    <CategoryChip run={run} t={t} />
                  </td>
                  <td>
                    <SiteCell run={run} t={t} />
                  </td>
                  <td>
                    <CodeCell run={run} t={t} />
                  </td>
                  <td className={run.prompt ? undefined : 'muted'}>{promptText(run, t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="caption archive__empty">{t.archive.empty}</p>}
        </div>

        {/* < 768px: cards */}
        <ul ref={listReveal} className="archive__cards">
          {rows.map((run, index) => (
            <li key={run.key} className="archive-card reveal-item" style={{ ['--i' as string]: Math.min(index, 8) }} onFocus={playName(run.key)}>
              <p className="archive__model archive-card__name" style={{ ['--dot' as string]: colorOf(run) }}>
                <span className="dot" aria-hidden="true" />
                <span className="wrap-any">
                        <DecryptedText text={run.model} animateOn="hover" playKey={nameKeys[run.key] ?? 0} tone={colorOf(run)} />
                      </span>
              </p>
              <dl className="archive-card__facts">
                <div>
                  <dt>{t.archive.cols.benchmark}</dt>
                  <dd>{BENCH_NAME[run.benchmark]}</dd>
                </div>
                <div>
                  <dt>{t.archive.cols.category}</dt>
                  <dd>
                    <CategoryChip run={run} t={t} />
                  </dd>
                </div>
                <div>
                  <dt>{t.archive.cols.site}</dt>
                  <dd>
                    <SiteCell run={run} t={t} />
                  </dd>
                </div>
                <div>
                  <dt>{t.archive.cols.code}</dt>
                  <dd>
                    <CodeCell run={run} t={t} />
                  </dd>
                </div>
                <div>
                  <dt>{t.archive.cols.prompt}</dt>
                  <dd className={run.prompt ? undefined : 'muted'}>{promptText(run, t)}</dd>
                </div>
              </dl>
            </li>
          ))}
          {!rows.length && <li className="caption">{t.archive.empty}</li>}
        </ul>

        <p className="caption archive__commit">
          {t.archive.commitBefore}
          <a className="link archive__commit-link" href={commitUrl} target="_blank" rel="noopener noreferrer">
            <code className="data">{archive.commit.short}</code>
            <span className="sr-only">{t.newTab}</span>
          </a>
          {t.archive.commitAfter}
        </p>
      </div>
    </section>
  );
}
