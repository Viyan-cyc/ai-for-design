/**
 * Basic scene verification, shared by CLI and fixtures.
 * node scene.mjs [url] [--edit|--both] [--expect path] [--json]
 * Exit: 0 PASS or explicitly INCONCLUSIVE, 1 correctness failure, 2 environment unavailable.
 * Profile/cache scheduling belongs to P5; this runner always executes the basic checks.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { openBrowserSession, positionalArg, CdpEnvironmentError } from '../lib/cdp.mjs';
import {
  compareGroups, intersectsFrustumBox, inspectSubject, inspectCanvas,
} from './scene-checks.mjs';

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCENE_KEYS = new Set(['lights', 'camera', 'controls', 'renderer', 'environment', 'remove']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const readExpect = (path) => {
  const text = readFileSync(path, 'utf8');
  const data = JSON.parse(text);
  const idByGroup = {};
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && !SCENE_KEYS.has(key) && !key.startsWith('__')) {
      idByGroup[key] = value.map((node) => node.id);
    }
  }
  return { idByGroup, hash: createHash('sha256').update(text).digest('hex') };
};

export const waitReady = async (evaluate, timeoutMs = 15000) => {
  if (!await evaluate('typeof window.__gts3d?.whenReady === "function"')) {
    return { status: 'SKIP', detail: 'legacy template has no strict ready API; manual verification required' };
  }
  const result = await evaluate(`window.__gts3d.whenReady({timeoutMs:${ timeoutMs }})`
    + '.then(d=>({ok:true,d})).catch(e=>({ok:false,message:String(e?.message??e)}))');
  return result.ok && result.d.pending === 0 && result.d.failedAssets.length === 0
    ? { status: 'PASS', detail: JSON.stringify(result.d) }
    : { status: 'FAIL', detail: result.message ?? JSON.stringify(result.d) };
};

export const summarize = (checks) => checks.some((c) => c.status === 'FAIL') ? 'FAIL'
  : checks.some((c) => c.status === 'SKIP') ? 'INCONCLUSIVE' : 'PASS';

export const verifyPage = async (page, {
  mode, expect, mountTimeoutMs = 7000, readyTimeoutMs = 15000,
}) => {
  const checks = [];
  let last = performance.now();
  const record = (id, status, evidence) => {
    const now = performance.now();
    checks.push({
      id,
      status,
      pass: status === 'PASS',
      evidence,
      duration: now - last,
      hash: expect.hash,
      source: 'live',
      mode,
    });
    last = now;
  };
  const { evaluate } = page;
  const deadline = Date.now() + mountTimeoutMs;
  let mounted = false;
  do {
    mounted = await evaluate(`!!window.__gts3d${ mode === 'edit' ? ' && !!window.__gts3dEdit' : ''}`);
    if (mounted) {
      break;
    }
    await sleep(Math.min(100, Math.max(1, deadline - Date.now())));
  } while (Date.now() < deadline);
  record('mounted', mounted ? 'PASS' : 'FAIL', mounted ? 'ok' : 'mount deadline exceeded');
  if (mounted) {
    const ready = await waitReady(evaluate, readyTimeoutMs);
    record('ready', ready.status, ready.detail);
    const graph = await evaluate('(()=>{const s=window.__gts3d.internals.sceneEngine; const groups={};'
      + 'for(const id of s.getAllIds()){(groups[s.getNodeType(id)]??=[]).push(id);}return groups;})()');
    const groups = compareGroups(expect.idByGroup, graph);
    record('groups', groups.ok ? 'PASS' : 'FAIL', JSON.stringify(groups.mismatches));
    const camera = await evaluate('!!window.__gts3d.internals.camera');
    record('camera', camera ? 'PASS' : 'FAIL', String(camera));
    const canvas = await evaluate(`(${ inspectCanvas.toString() })()`);
    record('canvas', canvas.ok ? 'PASS' : 'FAIL', JSON.stringify(canvas));
    const subject = await evaluate(`(${ inspectSubject.toString() })(window.__gts3d,${
      intersectsFrustumBox.toString() })`);
    record('subject', subject.ok ? 'PASS' : 'FAIL', JSON.stringify(subject));
    // Require a fresh successful frame, not stale nonzero statistics from a stopped loop.
    const renderDeadline = Date.now() + 1500;
    const before = await evaluate('window.__gts3d.internals.renderLoop.getStats()');
    let stats; let active = false;
    do {
      await sleep(50);
      stats = await evaluate('window.__gts3d.internals.renderLoop.getStats()');
      active = stats.fps > 0 && stats.calls > 0 && stats.elapsed > before.elapsed;
      if (active) {
        break;
      }
    } while (Date.now() < renderDeadline);
    record('render', active ? 'PASS' : 'FAIL', JSON.stringify(stats));
  }
  const diagErrors = mounted ? await evaluate('window.__gts3d.getDiagnostics?.().pageErrors ?? []') : [];
  const errors = [...new Set([...page.pageErrors, ...diagErrors])];
  record('errors', errors.length ? 'FAIL' : 'PASS', errors);
  const misses = page.netMisses.filter((m) => !/\/favicon\.ico(?:[?#\s]|$)/i.test(m));
  record('assets', misses.length ? 'FAIL' : 'PASS', misses);
  return {
    mode, verdict: summarize(checks), checks, pageErrors: errors, netMisses: misses,
  };
};

/** No global argv or process.exit in the reusable API. Caller may supply an already-owned session. */
export const verifyScene = async (options = {}) => {
  const {
    url = 'http://localhost:5199/', mode = 'run', project = join(SKILL_ROOT, 'template'),
    viewport = { width: 1280, height: 800 }, profile = 'preview',
  } = options;
  if (!['run', 'edit', 'both'].includes(mode)) {
    throw new Error(`Unsupported mode: ${ mode}`);
  }
  if (profile !== 'preview' || options.cache) {
    throw new Error('P1 supports uncached preview checks only; profile/cache scheduling is P5');
  }
  const expect = options.expect ?? readExpect(options.expectPath ?? join(project, 'public', 'scene-data.json'));
  const session = options.session ?? await openBrowserSession({ port: options.port ?? 9271, windowSize: `${viewport.width },${ viewport.height}` });
  const reports = [];
  const started = performance.now();
  try {
    for (const current of mode === 'both' ? ['run', 'edit'] : [mode]) {
      const target = new URL(url);
      if (current === 'edit') {
        target.searchParams.set('edit', '1');
      } else {
        target.searchParams.delete('edit');
      }
      const page = await session.newPage();
      try {
        await page.navigateTo(target.href);
        reports.push(await verifyPage(page, { ...options, mode: current, expect }));
      } finally {
        await page.close();
      }
    }
    const checks = reports.flatMap((r) => r.checks);
    return {
      verdict: summarize(checks),
      profile,
      scope: 'basic',
      checks,
      reports,
      duration: performance.now() - started,
      cache: 'disabled',
      changeSet: options.changeSet ?? null,
    };
  } finally {
    if (!options.session) {
      await session.close();
    }
  }
};

const main = async () => {
  const argv = process.argv.slice(2);
  const idx = argv.indexOf('--expect');
  const report = await verifyScene({
    url: positionalArg(argv) ?? 'http://localhost:5199/',
    mode: argv.includes('--both') ? 'both' : argv.includes('--edit') ? 'edit' : 'run',
    expectPath: idx >= 0 ? argv[idx + 1] : undefined,
  });
  if (argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const c of report.checks) {
      console.log(`${c.mode } ${ c.status } ${ c.id } — ${ JSON.stringify(c.evidence)}`);
    }
    console.log(`SCENE ${ report.verdict}`);
  }
  process.exitCode = report.verdict === 'FAIL' ? 1 : 0;
};
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error('SCENE ERROR:', error.message);
    process.exitCode = error instanceof CdpEnvironmentError ? 2 : 1;
  });
}
