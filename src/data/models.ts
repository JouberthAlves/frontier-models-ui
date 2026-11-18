import type { Run } from './archive';

/** Identity colors per run (from the README image generator of the archive). */
const COLORS: Record<string, string> = {
  'racing:gpt-6.1-sol-v3.4': '#facc6b',
  'orbitarium:gpt-6.1-sol-source': '#facc6b',
  'racing:gpt-6-astra-v3.4': '#aaa7ff',
  'orbitarium:gpt-6-astra-max-frontier-v2': '#aaa7ff',
  'racing:opus-5.5-v3.4': '#ff99cc',
  'racing:gemini-4-argon-v3.4': '#8df0a4',
  'orbitarium:gemini-4-argon-source': '#83caff',
  'racing:sonnet-5.5-v3.4': '#f4a1ed',
  'racing:gemini-4-hydrogen-v3.4': '#78dad1',
  'orbitarium:grok-4.7-solar-source': '#d2a2ff',
  'orbitarium:fable-5.1-frontier-v2': '#72dfbd'
};

export const OFF_ARENA = '#8fa5bf';

export const colorOf = (run: Pick<Run, 'key' | 'category'>): string =>
  run.category === 'current' ? (COLORS[run.key] ?? OFF_ARENA) : OFF_ARENA;

/** Short names for the compare chips below 600px. */
const SHORT: Record<string, string> = {
  'gpt-6.1-sol-v3.4': 'Sol',
  'gpt-6-astra-v3.4': 'Astra',
  'opus-5.5-v3.4': 'Opus',
  'gemini-4-argon-v3.4': 'Argon',
  'sonnet-5.5-v3.4': 'Sonnet',
  'gemini-4-hydrogen-v3.4': 'Hydrogen'
};

export const shortName = (run: Pick<Run, 'id' | 'model'>): string => SHORT[run.id] ?? run.model;
