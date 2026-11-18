#!/usr/bin/env node
// Sync script: reads the Frontier Models fork READ-ONLY (git show / git ls-tree at a pinned
// commit) and writes src/data/archive.json + public/scenes/<runId>/s<N>-{640,1600}.webp.
//
// Usage: npm run sync -- --fork ../Frontiers-Models --commit a71127c
// Nothing is ever written inside the fork.

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FORK = '../Frontiers-Models';
const DEFAULT_COMMIT = 'a71127c12508e4b7b35e62a711d3ef98986e0f4c';
const REPO = 'JouberthAlves/Frontiers-Models';
const MAX_BUFFER = 64 * 1024 * 1024;

const BENCHMARKS = {
  racing: { folder: 'benchmarks/racing' },
  orbitarium: { folder: 'benchmarks/solar-system' }
};

/* ---------- args ---------- */
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [name, inline] = arg.slice(2).split('=');
    out[name] = inline ?? argv[i + 1];
    if (inline === undefined) i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const fork = resolve(ROOT, args.fork ?? DEFAULT_FORK);

/* ---------- git helpers (read-only) ---------- */
function git(gitArgs, options = {}) {
  return execFileSync('git', ['-C', fork, ...gitArgs], {
    encoding: options.buffer ? 'buffer' : 'utf8',
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

const sha = git(['rev-parse', '--verify', `${args.commit ?? DEFAULT_COMMIT}^{commit}`]).trim();
const shortSha = sha.slice(0, 7);

const show = (path, buffer = false) => git(['show', `${sha}:${path}`], { buffer });
const exists = path => {
  try {
    git(['cat-file', '-e', `${sha}:${path}`]);
    return true;
  } catch {
    return false;
  }
};
const lsTree = path =>
  git(['ls-tree', '-r', '--name-only', sha, path])
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

const treeUrl = (folder, path) => `https://github.com/${REPO}/tree/${sha}/${folder}/${path}`;
const blobUrl = (folder, path) => `https://github.com/${REPO}/blob/${sha}/${folder}/${path}`;

/* ---------- prompts ---------- */
const promptKey = path => {
  if (!path) return null;
  const file = path.split('/').pop() ?? '';
  return file.replace(/\.md$/i, '') || null;
};

function readPrompts(benchmark, json) {
  const { folder } = BENCHMARKS[benchmark];
  return Object.entries(json.prompts ?? {}).map(([key, prompt]) => {
    let { bytes, lines } = prompt;
    if (typeof bytes !== 'number' || typeof lines !== 'number') {
      const text = show(`${folder}/${prompt.path}`, true);
      bytes = text.length;
      const newlines = text.toString('utf8').split('\n').length - 1;
      lines = text.length && text[text.length - 1] !== 0x0a ? newlines + 1 : newlines;
    }
    const entry = { key, path: prompt.path, status: prompt.status, bytes, lines };
    if (prompt.required_attachment) entry.attachment = prompt.required_attachment;
    return entry;
  });
}

/* ---------- runs ---------- */
function racingCategory(json, id) {
  if ((json.current_arena ?? []).includes(id)) return 'current';
  if ((json.legacy_runs ?? []).includes(id)) return 'legacy';
  if ((json.non_frontier_runs ?? []).includes(id)) return 'non-frontier';
  throw new Error(`racing run "${id}" has no category`);
}

function orbitariumCategory(json, run) {
  if ((json.current_arena ?? []).includes(run.id)) return 'current';
  if (run.role === 'historical-baseline') return 'historical';
  if (typeof run.role === 'string' && run.role.startsWith('outdated')) return 'outdated';
  if (run.role === 'non-frontier-run') return 'non-frontier';
  throw new Error(`orbitarium run "${run.id}" has no category (role ${run.role})`);
}

function normalizeRuns(benchmark, json) {
  const { folder } = BENCHMARKS[benchmark];
  const arena = json.current_arena ?? [];
  const provenance = `${folder}/RUN-PROVENANCE.md`;
  return json.runs.map(run => {
    const category = benchmark === 'racing' ? racingCategory(json, run.id) : orbitariumCategory(json, run);
    const path = benchmark === 'racing' ? run.archive_path : run.target_path;
    const hasCode = Boolean(path) && exists(`${folder}/${path}`);
    const liveUrl = benchmark === 'racing' ? (run.live_url ?? run.site_url ?? null) : (run.live_url ?? null);
    return {
      key: `${benchmark}:${run.id}`,
      benchmark,
      id: run.id,
      model: run.model,
      category,
      order: arena.includes(run.id) ? arena.indexOf(run.id) : null,
      liveUrl,
      sourceUrl: hasCode ? treeUrl(folder, path) : null,
      recordUrl: !hasCode && exists(provenance) ? blobUrl(folder, 'RUN-PROVENANCE.md') : null,
      prompt: promptKey(run.prompt)
    };
  });
}

/* ---------- scenes ---------- */
const FPS_SUFFIX = /-(\d+fps|fps\d+)\.png$/i;

function pickScene(files, n) {
  const prefix = `s${n}-`;
  const candidates = files
    .filter(file => {
      const parts = file.split('/');
      const name = parts[parts.length - 1];
      if (parts.includes('compare')) return false;
      return name.toLowerCase().endsWith('.png') && name.startsWith(prefix);
    })
    .sort();
  if (!candidates.length) return null;
  return candidates.find(file => !FPS_SUFFIX.test(file)) ?? candidates[0];
}

async function buildScenes(runs) {
  const { folder } = BENCHMARKS.racing;
  const outRoot = join(ROOT, 'public', 'scenes');
  rmSync(outRoot, { recursive: true, force: true });
  const missing = [];
  const jobs = [];

  for (const run of runs) {
    const base = `${folder}/runs/${run.id}/source/verification`;
    const files = lsTree(base).filter(file => {
      const rest = file.slice(base.length + 1);
      return !rest.includes('/') || rest.startsWith('screenshots/');
    });
    run.scenes = [];
    for (let n = 1; n <= 12; n += 1) {
      const file = pickScene(files, n);
      if (!file) missing.push(`${run.id} S${n}`);
      else jobs.push({ run, n, file });
    }
  }

  if (missing.length) {
    throw new Error(`Missing scenes:\n  ${missing.join('\n  ')}`);
  }

  for (const { run, n, file } of jobs) {
    const input = await hideOverlay(run.id, show(file, true));
    const dir = join(outRoot, run.id);
    mkdirSync(dir, { recursive: true });
    await sharp(input)
      .resize({ width: 640, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toFile(join(dir, `s${n}-640.webp`));
    const info = await sharp(input)
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(join(dir, `s${n}-1600.webp`));
    run.scenes.push({ n, w: info.width, h: info.height });
    process.stdout.write('.');
  }
  process.stdout.write('\n');
}

// Some runs burned a frame-rate counter into their screenshots. The site never
// shows those numbers, so the counter area is blurred out before resizing.
// Boxes are measured on the 1920×1080 originals and scaled to the real width.
const OVERLAYS = {
  'gpt-6-astra-v3.4': { left: 1830, top: 14, width: 80, height: 36 },
  'sonnet-5.5-v3.4': { left: 0, top: 0, width: 104, height: 21 },
};

async function hideOverlay(runId, input) {
  const box = OVERLAYS[runId];
  if (!box) return input;
  const { width, height } = await sharp(input).metadata();
  const k = width / 1920;
  const region = {
    left: Math.max(0, Math.round(box.left * k)),
    top: Math.max(0, Math.round(box.top * k)),
    width: Math.round(box.width * k),
    height: Math.round(box.height * k),
  };
  region.width = Math.min(region.width, width - region.left);
  region.height = Math.min(region.height, height - region.top);
  // Blur a padded area so the patch takes the colour around the counter, then
  // paste back only the counter box.
  const pad = Math.round(28 * k);
  const outer = {
    left: Math.max(0, region.left - pad),
    top: Math.max(0, region.top - pad),
  };
  outer.width = Math.min(width, region.left + region.width + pad) - outer.left;
  outer.height = Math.min(height, region.top + region.height + pad) - outer.top;
  const blurred = await sharp(input).extract(outer).blur(16).toBuffer();
  const patch = await sharp(blurred)
    .extract({
      left: region.left - outer.left,
      top: region.top - outer.top,
      width: region.width,
      height: region.height,
    })
    .toBuffer();
  return sharp(input).composite([{ input: patch, left: region.left, top: region.top }]).png().toBuffer();
}

function dirSize(dir) {
  let total = 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = dirSize(full);
      total += sub.total;
      count += sub.count;
    } else if (entry.name.endsWith('.webp')) {
      total += statSync(full).size;
      count += 1;
    }
  }
  return { total, count };
}

/* ---------- main ---------- */
async function main() {
  console.log(`fork   ${fork}`);
  console.log(`commit ${sha}`);

  const racingJson = JSON.parse(show(`${BENCHMARKS.racing.folder}/RUNS.json`));
  const orbitJson = JSON.parse(show(`${BENCHMARKS.orbitarium.folder}/RUNS.json`));

  const racingRuns = normalizeRuns('racing', racingJson);
  const orbitRuns = normalizeRuns('orbitarium', orbitJson);

  const racingCurrent = racingRuns
    .filter(run => run.category === 'current')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const orbitCurrent = orbitRuns.filter(run => run.category === 'current');

  if (racingCurrent.length !== 6) throw new Error(`expected 6 current racing runs, got ${racingCurrent.length}`);
  if (orbitCurrent.length !== 5) throw new Error(`expected 5 current orbitarium runs, got ${orbitCurrent.length}`);

  await buildScenes(racingCurrent);
  const sceneCount = racingCurrent.reduce((sum, run) => sum + run.scenes.length, 0);
  if (sceneCount !== 72) throw new Error(`expected 72 scenes, got ${sceneCount}`);

  const archive = {
    repo: REPO,
    commit: { sha, short: shortSha },
    benchmarks: {
      racing: {
        folder: BENCHMARKS.racing.folder,
        currentPrompt: racingJson.current_prompt ?? null,
        prompts: readPrompts('racing', racingJson)
      },
      orbitarium: {
        folder: BENCHMARKS.orbitarium.folder,
        currentPrompt: 'frontier-v2',
        prompts: readPrompts('orbitarium', orbitJson)
      }
    },
    runs: [...racingRuns, ...orbitRuns]
  };

  const outFile = join(ROOT, 'src', 'data', 'archive.json');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(archive, null, 2)}\n`, 'utf8');

  const webp = dirSize(join(ROOT, 'public', 'scenes'));
  const mb = (webp.total / 1024 / 1024).toFixed(2);
  console.log(`racing  ${racingRuns.length} runs (${racingCurrent.length} current)`);
  console.log(`orbit   ${orbitRuns.length} runs (${orbitCurrent.length} current)`);
  console.log(`scenes  ${sceneCount} scenes, ${webp.count} webp files, ${mb} MB`);
  console.log(`wrote   ${relative(ROOT, outFile)}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
