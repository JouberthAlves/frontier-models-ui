import type { Dict } from './pt';

export const en: Dict = {
  meta: {
    title: 'Frontier Models · Racing and Orbitarium',
    description:
      'Compare side by side the racing games and solar systems that frontier AI models built from the same prompts.'
  },
  nav: {
    skip: 'Skip to content',
    home: 'Frontier Models, home',
    sections: 'Sections',
    racing: 'Racing',
    orbitarium: 'Orbitarium',
    prompts: 'Prompts',
    archive: 'Archive',
    language: 'Language'
  },
  hero: {
    lede: (projects: number) => `Same prompts. ${projects} complete projects. Compare them scene by scene.`,
    stats: ['benchmarks', 'current projects', 'scenes per race'],
    primary: 'Compare races',
    secondary: 'Explore Orbitarium'
  },
  compare: {
    region: 'Compare bar',
    label: 'Compare:',
    remove: (model: string) => `Remove ${model}`,
    add: '+ model',
    addLabel: 'Add a model to the comparison',
    listLabel: 'Racing models',
    chosen: 'in comparison',
    view: 'View side by side',
    viewShort: 'Compare'
  },
  racing: {
    eyebrow: 'Benchmark 002',
    title: 'Racing-bench V3.4',
    intro:
      'Every model got the same racing prompt with reference images (V3.4; for Fable 5.2, the V3.4.1 revision), and shipped a complete 3D racing game: a coastal circuit with 5 AI opponents.',
    scenes: 'Scenes',
    stage: (scene: string) => `Comparison for scene ${scene}`,
    play: 'Play',
    code: 'Code',
    deleted: 'Deleted',
    enlarge: (alt: string) => `Enlarge: ${alt}`,
    games: (count: number) => `The ${count} games`,
    prompt: 'Prompt V3.4',
    compareAdd: 'Compare',
    compareIn: 'In comparison',
    compareFull: 'Limit of 3',
    compareAddLabel: (model: string) => `Add ${model} to the comparison`,
    note: 'Sites and verification notes are provided by the run owner. Being in the current list does not imply benchmark acceptance.'
  },
  viewer: {
    label: 'Scene viewer',
    close: 'Close',
    prev: 'Previous scene',
    next: 'Next scene',
    slider: 'Comparison slider',
    pair: 'Compared pair',
    sliderValue: (left: string, right: string, percent: number) =>
      `${left} on the left, ${right} on the right, ${percent}%`
  },
  orbitarium: {
    eyebrow: 'Benchmark 001',
    title: 'Orbitarium-bench',
    intro:
      'Every model built an interactive Solar System from a dense product spec: navigation, time, orbits, accessibility and scientific honesty.',
    map: 'Orbital map of the current projects',
    select: (model: string) => `Select ${model}`,
    promptV2: 'Frontier V2 prompt',
    promptUnverified: 'Prompt not verified in the archive',
    open: 'Open project',
    code: 'Code',
    deleted: 'Deleted',
    selected: 'selected'
  },
  prompts: {
    title: 'Prompt versions',
    racingTabs: 'Racing prompt versions',
    orbitTabs: 'Orbitarium prompt versions',
    current: 'current',
    candidate: 'candidate',
    file: 'File',
    status: 'Status',
    size: 'Size',
    lines: (n: string) => `${n} lines`,
    attachment: 'Required attachment',
    usedBy: 'Runs with this prompt',
    none: 'No archived run uses this prompt.',
    read: 'Read the prompt',
    states: {
      legacy: 'Legacy, archived verbatim',
      historical: 'Historical, frozen',
      current: 'Current',
      candidate: 'Candidate for future runs',
      original: 'Original',
      archived: 'Archived'
    }
  },
  archive: {
    title: 'The whole archive',
    filters: 'Filter by category',
    benchFilter: 'Filter by benchmark',
    all: 'All',
    categories: {
      current: 'Current',
      legacy: 'Legacy',
      historical: 'Historical',
      outdated: 'Outdated',
      'non-frontier': 'Non-frontier'
    },
    cols: {
      model: 'Model',
      benchmark: 'Benchmark',
      category: 'Category',
      site: 'Site',
      code: 'Code',
      prompt: 'Prompt'
    },
    open: 'Open',
    deleted: 'Deleted',
    code: 'Code',
    record: 'Record',
    unverified: 'not verified',
    empty: 'No runs match these filters.',
    commitBefore: 'Data from Frontiers Models commit ',
    commitAfter: '.',
    count: (n: number) => (n === 1 ? '1 run' : `${n} runs`)
  },
  footer: {
    about:
      'Frontier Models is an independent benchmark archive. Model names identify the systems used for individual runs.',
    repo: 'Archive repository',
    methodology: 'Methodology',
    credit: 'Text effects adapted from React Bits by David Haz (MIT + Commons Clause).',
    links: 'Archive links'
  },
  loader: {
    text: 'Loading the grid',
    progress: (done: number, total: number) => `Loading ${done} of ${total}`
  },
  notice: {
    text: 'Simplified motion on this device: the cars stay on the grid and the background stays still.',
    close: 'Dismiss notice'
  },
  newTab: '(opens in a new tab)'
};
