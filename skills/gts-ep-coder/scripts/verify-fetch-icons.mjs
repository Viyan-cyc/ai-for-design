#!/usr/bin/env node
// Mock IconPlus server + driver for fetch-icons.mjs validation (Spec §6).
// Usage: node verify-fetch-icons.mjs
// Covers: a) first run  b) re-run zero requests  c) mixed add  d) as-alias keyword
//         e) parallel + failure semantics (dark down → R-5 reuse; light down → EP fallback)

import { spawn } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, 'fetch-icons.mjs');
let BASE_URL = ''; // set once the mock server is listening

// ---------- mock state ----------
const requests = []; // {path, t}
let mode = 'normal'; // normal | dark-down | light-down
let configHitCount = 0;

const SVG = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path fill="${c}" d="M0 0h24v24H0z"/></svg>`;

const server = http.createServer((req, res) => {
  requests.push({ path: req.url, t: Date.now() });
  if (process.env.UXFI_TRACE) console.error('[mock]', req.url.slice(0, 90));
  const url = new URL(req.url, 'http://x');

  if (url.pathname.endsWith('/getConfig')) {
    configHitCount++;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      size: [{ key: '24' }],
      style: [{ key: 'border', value: '线性' }],
      colors: [{ style: '线性', id: 'light-c1' }],
      dark_colors: [{ style: '线性', id: 'dark-c1' }],
    }));
    return;
  }

  if (url.pathname.endsWith('/getIconInfo')) {
    const keywords = (url.searchParams.get('keyword') || '').split(',').filter(Boolean);
    const out = keywords.map((kw) => ({
      keyword: kw,
      icons: [
        { englishName: kw.toUpperCase() + '-WRONG', url: `http://mock/${kw}-wrong.svg`, score: 0.99, name: 'wrong', category: 'c' },
        { englishName: kw, url: `http://mock/${kw}.svg`, score: 0.5, name: kw, category: 'cat' },
      ],
    }));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out));
    return;
  }

  if (url.pathname.endsWith('/getIcon')) {
    const theme = url.searchParams.get('theme');
    if (theme === 'dark' && mode === 'dark-down') { res.writeHead(500); res.end('boom'); return; }
    if (theme === 'light' && mode === 'light-down') { res.writeHead(500); res.end('boom'); return; }
    const urls = (url.searchParams.get('url') || '').split(',').filter(Boolean);
    const color = theme === 'light' ? '#111111' : '#eeeeee';
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(urls.map((u) => ({ url: u, data: SVG(color) }))));
    return;
  }

  res.writeHead(404); res.end();
});

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' | ' + detail : ''}`);
}

function runFetch(dir) {
  return new Promise((resolveP) => {
    const p = spawn('node', [SCRIPT, '--dir', dir, '--base-url', BASE_URL], { cwd: __dirname });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => resolveP({ code, out }));
  });
}

function makeProject(files) {
  const root = mkdtempSync(join(tmpdir(), 'uxfi-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const f = join(root, 'src', rel);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, content, 'utf8');
  }
  return root;
}

import crypto from 'crypto';
const hashOf = (p) => crypto.createHash('md5').update(readFileSync(p)).digest('hex');

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  BASE_URL = `http://127.0.0.1:${server.address().port}`;

  // ---------- a) first run: 10 icons ----------
  const iconsA = ['Search', 'Edit', 'Plus', 'Delete', 'Setting', 'User', 'Bell', 'Calendar', 'Clock', 'Close'];
  const projA = makeProject({
    'pages/login.vue': `import { ${iconsA.join(', ')} } from '@element-plus/icons-vue'\nexport default { components: {} }\n`,
  });
  requests.length = 0; configHitCount = 0;
  const r1 = await runFetch(projA);
  const iconsDirA = join(projA, 'src', 'assets', 'icons');
  check('a1 first run OK', r1.out.includes('RESULT: OK'), `code=${r1.code}`);
  check('a2 CACHED: 0 on first run', /RESOLVED: 10, MISSED: 0, CACHED: 0/.test(r1.out), (r1.out.match(/RESOLVED.*/) || [''])[0]);
  check('a3 20 svg + barrel written', existsSync(join(iconsDirA, 'Search.light.svg')) && existsSync(join(iconsDirA, 'Close.dark.svg')) && existsSync(join(iconsDirA, 'index.js')));
  check('a4 barrel has 10 exports', (readFileSync(join(iconsDirA, 'index.js'), 'utf8').match(/export const /g) || []).length === 10);
  check('a5 config requested once (merged probe)', configHitCount === 1, `config hits=${configHitCount}`);
  check('a6 total requests = 4 (config+info+light+dark)', requests.length === 4, `n=${requests.length}`);
  const hashesA = Object.fromEntries(iconsA.flatMap((n) => [`${n}.light.svg`, `${n}.dark.svg`]).map((f) => [f, hashOf(join(iconsDirA, f))]));
  const barrelHashA = hashOf(join(iconsDirA, 'index.js'));

  // ---------- b) re-run same 10: zero requests ----------
  requests.length = 0; configHitCount = 0;
  const r2 = await runFetch(projA);
  const hashesB = Object.fromEntries(Object.keys(hashesA).map((f) => [f, hashOf(join(iconsDirA, f))]));
  check('b1 re-run OK CACHED: 10', /RESOLVED: 10, MISSED: 0, CACHED: 10/.test(r2.out), (r2.out.match(/RESOLVED.*/) || [''])[0]);
  check('b2 zero network requests', requests.length === 0, `n=${requests.length}`);
  check('b3 all file hashes unchanged', JSON.stringify(hashesA) === JSON.stringify(hashesB));

  // ---------- c) mixed: 10 cached + 5 new ----------
  const iconsNew = ['Download', 'Upload', 'Refresh', 'Lock', 'Unlock'];
  writeFileSync(join(projA, 'src', 'pages', 'more.vue'), `import { ${iconsNew.join(', ')} } from '@element-plus/icons-vue'\nexport default {}\n`, 'utf8');
  requests.length = 0; configHitCount = 0;
  const r3 = await runFetch(projA);
  const reqKeywords = requests.filter((q) => q.path.includes('getIconInfo')).map((q) => new URL(q.path, 'http://x').searchParams.get('keyword')).join('|');
  check('c1 mixed OK CACHED: 10 RESOLVED: 15', /RESOLVED: 15, MISSED: 0, CACHED: 10/.test(r3.out), (r3.out.match(/RESOLVED.*/) || [''])[0]);
  check('c2 only new names in search keywords', iconsNew.every((n) => reqKeywords.includes(n)) && !reqKeywords.includes('Search'), reqKeywords.slice(0, 80));
  const oldUnchanged = Object.keys(hashesA).every((f) => hashOf(join(iconsDirA, f)) === hashesA[f]);
  check('c3 old file hashes unchanged', oldUnchanged);
  const barrelExports = readFileSync(join(iconsDirA, 'index.js'), 'utf8');
  check('c4 barrel has 15 exports', (barrelExports.match(/export const /g) || []).length === 15);
  const exportOrder = [...barrelExports.matchAll(/export const (\w+)/g)].map((m) => m[1]);
  check('c5 barrel exports sorted', JSON.stringify(exportOrder) === JSON.stringify([...exportOrder].sort()));

  // ---------- d) as-alias: import { Search as SearchIcon } ----------
  const projD = makeProject({
    'pages/p.vue': `import { Search as SearchIcon } from '@element-plus/icons-vue'\nexport default {}\n`,
  });
  requests.length = 0;
  await runFetch(projD);
  const dKeywords = requests.filter((q) => q.path.includes('getIconInfo')).map((q) => new URL(q.path, 'http://x').searchParams.get('keyword')).join('|');
  check('d1 alias resolves to export name Search', dKeywords === 'Search', dKeywords);

  // ---------- e) parallel + failure semantics ----------
  // e1: dark endpoint down → light written (R-5 reuse), dark file = light content
  mode = 'dark-down';
  const projE1 = makeProject({ 'pages/p.vue': `import { Search, Bell } from '@element-plus/icons-vue'\nexport default {}\n` });
  const rE1 = await runFetch(projE1);
  const e1Dir = join(projE1, 'src', 'assets', 'icons');
  const lightC = readFileSync(join(e1Dir, 'Search.light.svg'), 'utf8');
  const darkC = readFileSync(join(e1Dir, 'Search.dark.svg'), 'utf8');
  check('e1 dark-down: OK + light reused as dark', rE1.out.includes('RESULT: OK') && lightC.includes('#111111') && darkC.includes('#111111'), `code=${rE1.code}`);
  check('e1b still RESOLVED: 2', /RESOLVED: 2, MISSED: 0/.test(rE1.out), (rE1.out.match(/RESOLVED.*/) || [''])[0]);

  // e2: light endpoint down → all miss → EP fallback (no svg files)
  mode = 'light-down';
  const projE2 = makeProject({ 'pages/p.vue': `import { Search, Bell } from '@element-plus/icons-vue'\nexport default {}\n` });
  const rE2 = await runFetch(projE2);
  const e2Dir = join(projE2, 'src', 'assets', 'icons');
  check('e2 light-down: all miss, no svg written', rE2.out.includes('MISSED: 2') && !existsSync(join(e2Dir, 'Search.light.svg')), (rE2.out.match(/RESOLVED.*/) || [''])[0]);
  mode = 'normal';

  // e3: parallelism — light & dark getIcon overlap in time
  const projE3 = makeProject({ 'pages/p.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
  requests.length = 0;
  await runFetch(projE3);
  const getIconTimes = requests.filter((q) => q.path.includes('getIcon?')).map((q) => q.t);
  check('e3 getIcon light+dark arrived close together (parallel)', getIconTimes.length === 2 && Math.abs(getIconTimes[0] - getIconTimes[1]) < 1500, `delta=${Math.abs(getIconTimes[0] - getIconTimes[1])}ms`);

  // ---------- f) probe-down: cached still reported, net names missed ----------
  const projF = makeProject({ 'pages/p.vue': `import { Search, NeverAsked } from '@element-plus/icons-vue'\nexport default {}\n` });
  // pre-seed Search pair as cached
  mkdirSync(join(projF, 'src', 'assets', 'icons'), { recursive: true });
  writeFileSync(join(projF, 'src', 'assets', 'icons', 'Search.light.svg'), SVG('#111111'), 'utf8');
  writeFileSync(join(projF, 'src', 'assets', 'icons', 'Search.dark.svg'), SVG('#eeeeee'), 'utf8');
  const p2 = new Promise((resolveP) => {
    const pp = spawn('node', [SCRIPT, '--dir', projF, '--base-url', 'http://127.0.0.1:9'], { cwd: __dirname });
    let out = ''; pp.stdout.on('data', (d) => (out += d)); pp.stderr.on('data', (d) => (out += d)); pp.on('close', () => resolveP(out));
  });
  const outF = await p2;
  check('f1 probe-down: CACHED kept + net missed', /RESOLVED: 1, MISSED: 1, CACHED: 1/.test(outF) && outF.includes('MISSED_LIST: NeverAsked'), (outF.match(/RESOLVED.*/) || [''])[0]);

  // ---------- cleanup ----------
  server.close();
  for (const p of [projA, projD, projE1, projE2, projE3, projF]) rmSync(p, { recursive: true, force: true });

  const fails = results.filter((r) => !r.ok).length;
  console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : 'FAIL'} | ${results.length - fails}/${results.length}`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error('DRIVER ERROR:', e); process.exit(2); });
