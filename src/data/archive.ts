import raw from './archive.json';

export type Benchmark = 'racing' | 'orbitarium';
export type Category = 'current' | 'legacy' | 'historical' | 'outdated' | 'non-frontier';

export interface Scene {
  n: number;
  w: number;
  h: number;
}

export interface Run {
  key: string;
  benchmark: Benchmark;
  id: string;
  model: string;
  category: Category;
  order: number | null;
  liveUrl: string | null;
  sourceUrl: string | null;
  recordUrl: string | null;
  prompt: string | null;
  scenes?: Scene[];
}

export interface Prompt {
  key: string;
  path: string;
  status: string;
  bytes: number;
  lines: number;
  attachment?: string;
}

export interface BenchmarkInfo {
  folder: string;
  currentPrompt: string | null;
  prompts: Prompt[];
}

export interface Archive {
  repo: string;
  commit: { sha: string; short: string };
  benchmarks: Record<Benchmark, BenchmarkInfo>;
  runs: Run[];
}

export const archive = raw as Archive;

const byOrder = (a: Run, b: Run) => (a.order ?? 0) - (b.order ?? 0);

export const racingRuns = archive.runs.filter(run => run.benchmark === 'racing');
export const orbitRuns = archive.runs.filter(run => run.benchmark === 'orbitarium');

/** Racing current arena, in `current_arena` order. */
export const racingArena = racingRuns.filter(run => run.category === 'current').sort(byOrder);
/** Orbitarium current arena, in `current_arena` order. */
export const orbitArena = orbitRuns.filter(run => run.category === 'current').sort(byOrder);

export const currentProjectCount = racingArena.length + orbitArena.length;

/** Archive order: racing arena, orbitarium arena, then the rest in RUNS.json order. */
export const archiveOrder: Run[] = [
  ...racingArena,
  ...orbitArena,
  ...archive.runs.filter(run => run.category !== 'current')
];

export const runByKey = new Map(archive.runs.map(run => [run.key, run]));

export const repoUrl = `https://github.com/${archive.repo}`;
export const commitUrl = `${repoUrl}/commit/${archive.commit.sha}`;
export const methodologyUrl = `${repoUrl}/blob/${archive.commit.sha}/docs/METHODOLOGY.md`;

export const promptUrl = (benchmark: Benchmark, path: string) =>
  `${repoUrl}/blob/${archive.commit.sha}/${archive.benchmarks[benchmark].folder}/${path}`;

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

export const sceneSrc = (runId: string, n: number, width: 640 | 1600) =>
  `${base}/scenes/${runId}/s${n}-${width}.webp`;
