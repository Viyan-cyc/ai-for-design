#!/usr/bin/env node
// Mock IconPlus server + driver for fetch-icons.mjs ( matrix).
// Usage: node verify-fetch-icons.mjs
//
// Covered scenarios (§10.1):
//   A exact low-score wins / wrong high-score ignored
//   B no exact name → highest score candidate
//   C duplicate exact names → first exact candidate
//   D reviewed alias → locked company asset, no search
//   E service unreachable → valid cache kept, rest EP (SERVICE_UNAVAILABLE)
//   F missing dark theme → reuse light SVG
//   G explicit shared asset → both themes share, dark not requested
//   H hash mismatch / no metadata → cache not trusted, re-resolve
//   I same-version valid cache → zero network, stable files
//   J add / alias import / re-run → request set + barrel correct, aliases kept
//   K AST: comment / similar string not mis-parsed
//   L invalid SVG → EP (INVALID_SVG)
//   M non-owned barrel / unknown EP name → FAIL
//   N real project build accepts the migrated barrel (same entry as preview)
// Rework regression (review R1–R6 + getIcon params):
//   O R1 XML well-formedness (mismatch / multi-root / unclosed / stray text /
//     external + protocol-relative href / DOCTYPE) → INVALID_SVG; #frag+data ok
//   P R2 anomalous response classification (200 error-envelope / scalar) is a
//     service anomaly, never a NO_MATCH; genuine empty array still NO_MATCH
//   Q R3 negative cache is service-scoped and not perpetually renewed
//   R R4 scan narrowed to src/assets/icons (a module under src/assets is scanned)
//   S R5 shared cache validates the dark file too (corruption → re-resolve)
//   T getIcon sends original download metadata and style value

import { spawn, spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, 'fetch-icons.mjs');
const INIT = join(__dirname, 'init.mjs');
const BUILD = join(__dirname, 'build.mjs');
const BARREL_REL = '../../assets/icons/index.js';
let BASE_URL = '';
const requests = []; // full request urls
let behavior;

const VALID_SVG = (c) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="${c}" d="M0 0h24v24H0z"/></svg>`;
function resetBehavior() {
  behavior = {
    searchStatus: 200,
    getIconStatus: () => 200,
    search: (kw) => [{ englishName: kw, url: `mock://${kw}`, score: 0.5, name: kw, category: 'c' }],
    svg: (url, theme) => VALID_SVG(theme === 'light' ? '#111111' : '#eeeeee'),
    // when set, getIconInfo / getIcon return this body verbatim (anomaly tests)
    searchRaw: undefined,
    getIconRaw: undefined,
    // when 'hang', getConfig never responds → client-side timeout
    getConfig: undefined,
  };
}
resetBehavior();

const server = http.createServer((req, res) => {
  if (behavior.down) { req.socket.destroy(); return; } // simulate network outage on the SAME base-url
  requests.push(req.url);
  const url = new URL(req.url, 'http://x');
  const json = (v) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(v)); };

  if (url.pathname.endsWith('/getConfig')) {
    if (behavior.getConfig === 'hang') return; // never respond → client abort
    return json({
      size: [{ key: '24' }],
      style: [{ key: 'border', value: '线性' }],
      colors: [{ style: '线性', id: 'light-c1' }],
      dark_colors: [{ style: '线性', id: 'dark-c1' }],
    });
  }
  if (url.pathname.endsWith('/getIconInfo')) {
    if (behavior.searchStatus !== 200) { res.writeHead(behavior.searchStatus); return res.end('err'); }
    if (behavior.searchRaw !== undefined) return json(behavior.searchRaw);
    const keywords = (url.searchParams.get('keyword') || '').split(',').filter(Boolean);
    return json(keywords.map((kw) => ({ keyword: kw, icons: behavior.search(kw) })));
  }
  if (url.pathname.endsWith('/getIcon')) {
    const theme = url.searchParams.get('theme');
    const st = behavior.getIconStatus(theme);
    if (st !== 200) { res.writeHead(st); return res.end('boom'); }
    if (behavior.getIconRaw !== undefined) return json(behavior.getIconRaw);
    const urls = (url.searchParams.get('url') || '').split(',').filter(Boolean);
    return json(urls.map((u) => ({ url: u, data: behavior.svg(u, theme) })).filter((x) => x.data != null));
  }
  res.writeHead(404); res.end();
});

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' | ' + detail : ''}`);
}

function runFetch(dir, extra = [], baseUrl) {
  return new Promise((resolveP) => {
    const args = [SCRIPT, '--dir', dir, '--base-url', baseUrl || BASE_URL, ...extra];
    const p = spawn('node', args, { cwd: __dirname, env: { ...process.env, NODE_OPTIONS: '' } });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => resolveP({ code, out }));
  });
}
function runScript(script, args) {
  const r = spawnSync('node', [script, ...args], { cwd: __dirname, env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
function makeProject(files) {
  const root = mkdtempSync(join(tmpdir(), 'uxfi-'));
  mkdirSync(join(root, 'src', 'pages', 'Home'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const f = join(root, 'src', rel);
    mkdirSync(dirname(f), { recursive: true });
    // wrap bare JS import snippets in a valid SFC so the AST parser accepts them
    const body = rel.endsWith('.vue') && !/<\s*(template|script)/.test(content)
      ? `<script>\n${content}\n</script>\n<template><div/></template>\n`
      : content;
    writeFileSync(f, body, 'utf8');
  }
  return root;
}
const hashOf = (p) => crypto.createHash('md5').update(readFileSync(p)).digest('hex');
const barrelOf = (dir) => { const p = join(dir, 'src', 'assets', 'icons', 'index.js'); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };
const iconFile = (dir, name, theme) => join(dir, 'src', 'assets', 'icons', `${name}.${theme}.svg`);
const reportOf = (dir) => JSON.parse(readFileSync(join(dir, 'icons-report.json'), 'utf8'));
function getIconUrlsSince(from) {
  return requests.slice(from).filter((u) => u.includes('getIcon?')).flatMap((u) => {
    const v = new URL(u, 'http://x').searchParams.get('url');
    return v ? v.split(',') : [];
  });
}
function searchKeywordsSince(from) {
  return requests.slice(from).filter((u) => u.includes('getIconInfo')).map((u) => new URL(u, 'http://x').searchParams.get('keyword') || '').join('|');
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  BASE_URL = `http://127.0.0.1:${server.address().port}`;

  // ── A. exact low-score wins over wrong high-score ──
  {
    resetBehavior();
    behavior.search = (kw) =>
      kw === 'Search'
        ? [{ englishName: 'Search-WRONG', url: 'mock://wrong', score: 0.99 }, { englishName: 'Search', url: 'mock://right', score: 0.1 }]
        : [{ englishName: kw, url: `mock://${kw}`, score: 0.5 }];
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const { out } = await runFetch(proj);
    const fetched = getIconUrlsSince(0);
    check('A1 exact-low-score → IconPlus / COMPLETE', out.includes('RESULT: OK') && out.includes('STATUS: COMPLETE') && out.includes('RESOLVED: 1, MISSED: 0'));
    check('A2 fetched the exact asset, not the high-score one', fetched.includes('mock://right') && !fetched.includes('mock://wrong'), fetched.join(','));
    check('A3 company SVG pair written + barrel company export', existsSync(iconFile(proj, 'Search', 'light')) && existsSync(iconFile(proj, 'Search', 'dark')) && /export const Search = \{/.test(barrelOf(proj)));
    check('A4 page import rewritten to barrel', readFileSync(join(proj, 'src', 'pages', 'Home', 'index.vue'), 'utf8').includes(BARREL_REL));
    rmSync(proj, { recursive: true, force: true });
  }

  // ── B. score-based selection without exact name ──
  {
    resetBehavior();
    behavior.search = () => [{ englishName: 'MagnifierX', url: 'mock://m', score: 0.99 }];
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const { out } = await runFetch(proj);
    check('B1 no exact name → highest score company', out.includes('STATUS: COMPLETE') && out.includes('RESOLVED: 1'));
    check('B2 score winner materialized', existsSync(iconFile(proj, 'Search', 'light')) && /export const Search = \{/.test(barrelOf(proj)));
    check('B3 report reason SCORE', reportOf(proj).items.find((i) => i.epName === 'Search').reason === 'SCORE');
    rmSync(proj, { recursive: true, force: true });
  }

  // ── C. first exact candidate wins ──
  {
    resetBehavior();
    behavior.search = (kw) => [
      { englishName: kw, url: 'mock://a', icon_id: 'id1', score: 0.9 },
      { englishName: kw, url: 'mock://b', icon_id: 'id2', score: 0.8 },
    ];
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const { out } = await runFetch(proj);
    check('C1 duplicate exact names → first exact company', out.includes('STATUS: COMPLETE') && existsSync(iconFile(proj, 'Search', 'light')));
    check('C2 duplicate exact names report EXACT', reportOf(proj).items.find((i) => i.epName === 'Search').reason === 'EXACT');
    rmSync(proj, { recursive: true, force: true });
    // C3: duplicate records that are the SAME asset identity dedupe to one → EXACT
    resetBehavior();
    behavior.search = (kw) => [
      { englishName: kw, url: 'mock://same', icon_id: 'id1', score: 0.9 },
      { englishName: kw, url: 'mock://same', icon_id: 'id1', score: 0.8 },
    ];
    const proj3 = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const r3 = await runFetch(proj3);
    check('C3 same-identity duplicates dedupe → EXACT company', r3.out.includes('STATUS: COMPLETE') && existsSync(iconFile(proj3, 'Search', 'light')) && /export const Search = \{/.test(barrelOf(proj3)));
    check('C3b report reason EXACT', reportOf(proj3).items.find((i) => i.epName === 'Search').reason === 'EXACT');
    rmSync(proj3, { recursive: true, force: true });
  }

  // ── D. reviewed alias → locked asset, no search ──
  {
    resetBehavior();
    const aliasFile = join(mkdtempSync(join(tmpdir(), 'uxal-')), 'aliases.json');
    writeFileSync(aliasFile, JSON.stringify({ schemaVersion: 1, mappingVersion: '1', config: { provider: 'iconplus', negativeCacheHours: 24 }, aliases: { Search: { assetId: 'AID-1', url: 'mock://alias-search', sourceRef: 'reviewed 2026-10-15' } } }), 'utf8');
    behavior.search = () => { throw new Error('search must not be called for an aliased icon'); };
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const from0 = requests.length;
    const { out } = await runFetch(proj, ['--aliases', aliasFile]);
    const searched = requests.slice(from0).some((u) => u.includes('getIconInfo'));
    check('D1 alias → company / COMPLETE', out.includes('STATUS: COMPLETE') && /export const Search = \{/.test(barrelOf(proj)));
    check('D2 alias asset fetched from reviewed url', getIconUrlsSince(0).includes('mock://alias-search'));
    check('D3 no search issued for aliased icon', !searched);
    const item = reportOf(proj).items.find((i) => i.epName === 'Search');
    check('D4 report reason ALIAS + identity', item.reason === 'ALIAS' && item.companyIdentity === 'AID-1');
    rmSync(dirname(aliasFile), { recursive: true, force: true });
    rmSync(proj, { recursive: true, force: true });
  }

  // ── E. unreachable → valid cache kept, rest EP ──
  {
    resetBehavior();
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    await runFetch(proj); // online seed: Search company cached
    // add Camera (no cache); network then goes down (same base-url)
    writeFileSync(join(proj, 'src', 'pages', 'Home', 'index.vue'), `<script>\nimport { Search, Camera } from '@element-plus/icons-vue'\nexport default {}\n</script>\n<template><div/></template>\n`, 'utf8');
    behavior.down = true;
    const { out } = await runFetch(proj);
    behavior.down = false;
    check('E1 unreachable → FALLBACK, not FAIL', out.includes('RESULT: OK') && out.includes('STATUS: FALLBACK'));
    check('E2 cached Search still company', /export const Search = \{/.test(barrelOf(proj)));
    const camera = reportOf(proj).items.find((i) => i.epName === 'Camera');
    check('E3 new icon reason SERVICE_UNAVAILABLE (not NO_MATCH)', camera && camera.reason === 'SERVICE_UNAVAILABLE');
    rmSync(proj, { recursive: true, force: true });
  }

  // ── F. dark theme missing reuses light ──
  {
    resetBehavior();
    behavior.getIconStatus = (theme) => (theme === 'dark' ? 500 : 200);
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const { out } = await runFetch(proj);
    check('F1 dark missing → company with light reused', out.includes('STATUS: COMPLETE') && existsSync(iconFile(proj, 'Search', 'light')) && existsSync(iconFile(proj, 'Search', 'dark')));
    check('F2 reused light/dark files identical', hashOf(iconFile(proj, 'Search', 'light')) === hashOf(iconFile(proj, 'Search', 'dark')));
    check('F3 barrel uses company component', /export const Search = \{/.test(barrelOf(proj)));
    rmSync(proj, { recursive: true, force: true });
  }

  // ── G. explicit shared asset → both themes share ──
  {
    resetBehavior();
    behavior.getIconStatus = (theme) => (theme === 'dark' ? 500 : 200); // dark would fail if requested
    const aliasFile = join(mkdtempSync(join(tmpdir(), 'uxal-')), 'aliases.json');
    writeFileSync(aliasFile, JSON.stringify({ schemaVersion: 1, config: { provider: 'iconplus' }, aliases: { Search: { assetId: 'S1', url: 'mock://shared', themeMode: 'shared', sourceRef: 'shared verified' } } }), 'utf8');
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const darkBefore = requests.filter((u) => u.includes('theme=dark')).length;
    const { out } = await runFetch(proj, ['--aliases', aliasFile]);
    const darkAfter = requests.filter((u) => u.includes('theme=dark')).length;
    check('G1 shared → company / COMPLETE', out.includes('STATUS: COMPLETE') && /export const Search = \{/.test(barrelOf(proj)));
    check('G2 shared writes identical light+dark files', existsSync(iconFile(proj, 'Search', 'light')) && hashOf(iconFile(proj, 'Search', 'light')) === hashOf(iconFile(proj, 'Search', 'dark')));
    check('G3 dark endpoint not requested for shared', darkAfter === darkBefore, `dark calls ${darkAfter - darkBefore}`);
    rmSync(dirname(aliasFile), { recursive: true, force: true });
    rmSync(proj, { recursive: true, force: true });
  }

  // ── H. hash mismatch / no metadata → cache not trusted ──
  {
    resetBehavior();
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    await runFetch(proj);
    // corrupt the cached svg CONTENT but keep the owned marker (hash mismatch)
    const lp = iconFile(proj, 'Search', 'light');
    writeFileSync(lp, readFileSync(lp, 'utf8').replace('#111111', '#999999'), 'utf8');
    let from = requests.length;
    const r2 = await runFetch(proj);
    check('H1 corrupted hash → re-resolved (network used)', requests.slice(from).some((u) => u.includes('getIcon?')));
    check('H2 still company after re-resolve', /export const Search = \{/.test(barrelOf(proj)));
    // delete metadata → legacy unverified pair must re-resolve
    rmSync(join(proj, 'src', 'assets', 'icons', '.icon-cache.json'), { force: true });
    from = requests.length;
    const r3 = await runFetch(proj);
    check('H3 legacy (no metadata) → re-resolved', requests.slice(from).some((u) => u.includes('getIcon?')));
    check('H4 report marks LEGACY_UNVERIFIED', reportOf(proj).items.find((i) => i.epName === 'Search').cacheStatus === 'LEGACY_UNVERIFIED');
    rmSync(proj, { recursive: true, force: true });
  }

  // ── I. valid cache → zero network, stable files ──
  {
    resetBehavior();
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search, Edit } from '@element-plus/icons-vue'\nexport default {}\n` });
    await runFetch(proj);
    const h1 = hashOf(iconFile(proj, 'Search', 'light'));
    const b1 = hashOf(join(proj, 'src', 'assets', 'icons', 'index.js'));
    const from = requests.length;
    const { out } = await runFetch(proj);
    check('I1 valid cache → zero network', requests.length === from, `n=${requests.length - from}`);
    check('I2 CACHED: 2 reported', /CACHED: 2/.test(out), (out.match(/RESOLVED.*/) || [''])[0]);
    check('I3 files unchanged', hashOf(iconFile(proj, 'Search', 'light')) === h1 && hashOf(join(proj, 'src', 'assets', 'icons', 'index.js')) === b1);
    rmSync(proj, { recursive: true, force: true });
  }

  // ── J. add / alias import / re-run ──
  {
    resetBehavior();
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search, Edit as Rename } from '@element-plus/icons-vue'\nexport default {}\n` });
    await runFetch(proj);
    const searchHash = hashOf(iconFile(proj, 'Search', 'light'));
    check('J1 alias preserved in rewrite', readFileSync(join(proj, 'src', 'pages', 'Home', 'index.vue'), 'utf8').includes('Edit as Rename'));
    // add a new file with a new icon (valid SFC)
    writeFileSync(join(proj, 'src', 'pages', 'Home', 'more.vue'), `<script>\nimport { Plus } from '../../assets/icons/index.js'\nexport default {}\n</script>\n<template><div/></template>\n`, 'utf8');
    const from = requests.length;
    await runFetch(proj);
    const kw = searchKeywordsSince(from);
    check('J2 only the new icon searched on re-run', kw.includes('Plus') && !kw.includes('Search') && !kw.includes('Edit'), kw);
    check('J3 barrel now exports all three', /export const Search/.test(barrelOf(proj)) && /export const Plus/.test(barrelOf(proj)));
    check('J4 existing file hashes stable', hashOf(iconFile(proj, 'Search', 'light')) === searchHash);
    rmSync(proj, { recursive: true, force: true });
  }

  // ── K. AST: comment / similar string not mis-parsed ──
  {
    resetBehavior();
    const proj = makeProject({
      'pages/Home/index.vue': `<script setup>\n// import { Ghost } from '@element-plus/icons-vue'\nconst s = "import { Phantom } from '@element-plus/icons-vue'"\nimport { Search } from '@element-plus/icons-vue'\n</script>\n<template><div/></template>\n`,
    });
    const from = requests.length;
    const { out } = await runFetch(proj);
    const kw = searchKeywordsSince(from);
    check('K1 only the real import collected', kw === 'Search' && !kw.includes('Ghost') && !kw.includes('Phantom'), kw);
    check('K2 barrel only exports Search', (barrelOf(proj).match(/export (const| \{[^}]*\}) /g) || []).length <= 2 && !/Ghost|Phantom/.test(barrelOf(proj)));
    check('K3 comment + string left intact', readFileSync(join(proj, 'src', 'pages', 'Home', 'index.vue'), 'utf8').includes('// import { Ghost }'));
    rmSync(proj, { recursive: true, force: true });
  }

  // ── L. invalid SVG → EP ──
  {
    resetBehavior();
    behavior.svg = (url, theme) => (theme === 'light' ? '<svg></svg>' : VALID_SVG('#eeeeee')); // light: no viewBox
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const { out } = await runFetch(proj);
    check('L1 invalid svg → FALLBACK, no company svg', out.includes('STATUS: FALLBACK') && !existsSync(iconFile(proj, 'Search', 'light')));
    check('L2 report reason INVALID_SVG', reportOf(proj).items.find((i) => i.epName === 'Search').reason === 'INVALID_SVG');
    // script injection must also be refused
    resetBehavior();
    behavior.svg = () => '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>';
    const proj2 = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const r2 = await runFetch(proj2);
    check('L3 script-injected svg → EP / INVALID_SVG', r2.out.includes('STATUS: FALLBACK') && reportOf(proj2).items.find((i) => i.epName === 'Search').reason === 'INVALID_SVG');
    rmSync(proj, { recursive: true, force: true });
    rmSync(proj2, { recursive: true, force: true });
  }

  // ── M. FAIL cases ──
  {
    resetBehavior();
    // non-owned barrel → refuse
    const projM1 = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    mkdirSync(join(projM1, 'src', 'assets', 'icons'), { recursive: true });
    writeFileSync(join(projM1, 'src', 'assets', 'icons', 'index.js'), '// user-owned barrel\nexport const Foo = 1\n', 'utf8');
    const m1 = await runFetch(projM1);
    check('M1 non-owned barrel → RESULT: FAIL', m1.out.includes('RESULT: FAIL') && m1.out.includes('STATUS: FAILED'));
    check('M1b user barrel not overwritten', readFileSync(join(projM1, 'src', 'assets', 'icons', 'index.js'), 'utf8').includes('user-owned'));
    // unknown EP name → FAIL
    const projM2 = makeProject({ 'pages/Home/index.vue': `import { NotARealIconXyz } from '@element-plus/icons-vue'\nexport default {}\n` });
    const m2 = await runFetch(projM2);
    check('M2 unknown EP name → RESULT: FAIL', m2.out.includes('RESULT: FAIL') && /unknown Element Plus icon/.test(m2.out));
    rmSync(projM1, { recursive: true, force: true });
    rmSync(projM2, { recursive: true, force: true });
  }

  // ── N. real project build accepts the migrated barrel ──
  {
    resetBehavior();
    // one icon resolves to the company asset, the other must fall back to EP —
    // proves the barrel serves BOTH from the same entry (as the real project sees it)
    behavior.search = (kw) => (kw === 'Edit' ? [] : [{ englishName: kw, url: `mock://${kw}`, score: 0.5 }]);
    const artifact = mkdtempSync(join(tmpdir(), 'uxe2e-'));
    const slug = 'e2e-icon-page';
    const init = runScript(INIT, [artifact, slug]);
    const projDir = join(artifact, slug);
    if (init.code === 0 && existsSync(projDir)) {
      // replace the starter page with one that uses EP icons
      const pagePath = join(projDir, 'src', 'pages', 'E2eIconPage', 'index.vue');
      writeFileSync(pagePath, `<script setup>\nimport { ElButton, ElIcon } from 'element-plus'\nimport { Search, Edit } from '@element-plus/icons-vue'\n</script>\n<template>\n  <div class="page-root">\n    <ElButton type="primary" :icon="Search">查询</ElButton>\n    <ElIcon :size="20"><Edit /></ElIcon>\n  </div>\n</template>\n<style scoped lang="less">\n.page-root { padding: var(--space-size-24); color: var(--color-text-primary); }\n</style>\n`, 'utf8');
      const fetch = await runFetch(projDir);
      check('N1 e2e fetch OK + page migrated', fetch.out.includes('RESULT: OK') && readFileSync(pagePath, 'utf8').includes(BARREL_REL), fetch.out.replace(/\n/g, ' ').slice(0, 100));
      const build = runScript(BUILD, ['--dir', projDir]);
      check('N2 real-project build accepts migrated barrel', build.out.includes('RESULT: OK'), (build.out.match(/RESULT:.*/) || [''])[0]);
      // company hit + EP fallback both served from the one barrel, same specifier as the real project
      check('N3 barrel serves company + EP fallback from one entry', /export const Search = \{/.test(barrelOf(projDir)) && /export \{[^}]*Edit[^}]*\} from '@element-plus\/icons-vue'/.test(barrelOf(projDir)));
    } else {
      check('N1 e2e init available', false, `init exit=${init.code} ${init.out.slice(0, 120)}`);
    }
    rmSync(artifact, { recursive: true, force: true });
  }

  // ── O. XML well-formedness + external-ref validation ──
  {
    const oneIcon = () => makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const cases = [
      ['mismatched tags', '<svg viewBox="0 0 24 24"><g></path></g></svg>'],
      ['multiple roots', '<svg viewBox="0 0 24 24"></svg><svg viewBox="0 0 24 24"></svg>'],
      ['unclosed tag', '<svg viewBox="0 0 24 24"><g>'],
      ['text outside root', '<svg viewBox="0 0 24 24"></svg>garbage'],
      ['external http href', '<svg viewBox="0 0 24 24"><use href="http://evil.example/x.svg#a"/></svg>'],
      ['protocol-relative href', '<svg viewBox="0 0 24 24"><image href="//evil.example/x.png"/></svg>'],
      ['DOCTYPE declaration', '<!DOCTYPE svg><svg viewBox="0 0 24 24"></svg>'],
    ];
    let ok = 0;
    for (const [label, body] of cases) {
      resetBehavior();
      behavior.svg = () => body;
      const proj = oneIcon();
      const { out } = await runFetch(proj);
      const item = reportOf(proj).items.find((i) => i.epName === 'Search');
      if (out.includes('STATUS: FALLBACK') && item.reason === 'INVALID_SVG' && !existsSync(iconFile(proj, 'Search', 'light'))) ok++;
      else console.log(`   O: ${label} → ${item.reason} (expected INVALID_SVG)`);
      rmSync(proj, { recursive: true, force: true });
    }
    check('O1 malformed XML / external refs all → INVALID_SVG', ok === cases.length, `${ok}/${cases.length}`);
    // O2: a well-formed SVG using only #fragment + inline data:image is accepted
    resetBehavior();
    behavior.svg = () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g"/></defs><use href="#g"/><image href="data:image/png;base64,AAAA"/></svg>';
    const projOk = oneIcon();
    const rOk = await runFetch(projOk);
    check('O2 well-formed SVG (#fragment + data:image) accepted', rOk.out.includes('STATUS: COMPLETE') && existsSync(iconFile(projOk, 'Search', 'light')));
    rmSync(projOk, { recursive: true, force: true });
  }

  // ── P. anomalous response classification (never a business miss) ──
  {
    const N = 'Search';
    const oneIcon = () => makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const reasonOf = (proj) => reportOf(proj).items.find((i) => i.epName === N).reason;
    resetBehavior(); behavior.searchRaw = [{ code: 500, msg: 'internal' }];
    let proj = oneIcon(); await runFetch(proj);
    check('P1 search 200 array error-envelope → not NO_MATCH', reasonOf(proj) === 'BAD_RESPONSE', reasonOf(proj));
    rmSync(proj, { recursive: true, force: true });
    resetBehavior(); behavior.searchRaw = { code: 500, msg: 'internal' };
    proj = oneIcon(); await runFetch(proj);
    check('P2 search 200 object error-envelope → not NO_MATCH', reasonOf(proj) === 'BAD_RESPONSE', reasonOf(proj));
    rmSync(proj, { recursive: true, force: true });
    resetBehavior(); behavior.searchRaw = 'oops';
    proj = oneIcon(); await runFetch(proj);
    check('P3 search 200 scalar → SERVICE_UNAVAILABLE', reasonOf(proj) === 'SERVICE_UNAVAILABLE', reasonOf(proj));
    rmSync(proj, { recursive: true, force: true });
    resetBehavior(); behavior.searchRaw = [];
    proj = oneIcon(); await runFetch(proj);
    check('P4 search 200 empty array → NO_MATCH (genuine miss)', reasonOf(proj) === 'NO_MATCH', reasonOf(proj));
    rmSync(proj, { recursive: true, force: true });
    resetBehavior(); behavior.getIconRaw = { code: 500, msg: 'boom' };
    proj = oneIcon(); await runFetch(proj);
    check('P5 getIcon 200 error-envelope → EP, service-side reason', !existsSync(iconFile(proj, N, 'light')) && ['BAD_RESPONSE', 'SERVICE_UNAVAILABLE'].includes(reasonOf(proj)), reasonOf(proj));
    rmSync(proj, { recursive: true, force: true });
    resetBehavior(); behavior.searchRaw = [{ code: 500 }];
    proj = oneIcon(); await runFetch(proj);
    const cacheDoc = JSON.parse(readFileSync(join(proj, 'src', 'assets', 'icons', '.icon-cache.json'), 'utf8'));
    check('P6 service anomaly not persisted as a NO_MATCH negative entry', (cacheDoc.entries[N] || {}).reason !== 'NO_MATCH');
    rmSync(proj, { recursive: true, force: true });
  }

  // ── Q. negative-cache service isolation + no perpetual renewal ──
  {
    const N = 'Search';
    const projOf = () => makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const cacheOf = (proj) => JSON.parse(readFileSync(join(proj, 'src', 'assets', 'icons', '.icon-cache.json'), 'utf8'));
    const writeCache = (proj, doc) => writeFileSync(join(proj, 'src', 'assets', 'icons', '.icon-cache.json'), JSON.stringify(doc), 'utf8');
    resetBehavior(); behavior.searchRaw = [];   // genuine miss → NO_MATCH
    let proj = projOf();
    await runFetch(proj);
    let doc1 = cacheOf(proj);
    let neg = doc1.entries[N];
    check('Q1 NO_MATCH entry is service-scoped', !!neg && neg.reason === 'NO_MATCH' && !!neg.provider && !!neg.baseUrl && neg.sourceId != null && neg.groupId != null);
    // a foreign-scope negative entry must not be honoured
    neg.baseUrl = 'http://elsewhere.invalid';
    writeCache(proj, doc1);
    let from = requests.length;
    await runFetch(proj);
    check('Q2 foreign-scope negative entry not reused (re-queried)', requests.slice(from).some((u) => u.includes('getIconInfo')));
    rmSync(proj, { recursive: true, force: true });
    // within-TTL hit reuses cache but must NOT renew `until`
    resetBehavior(); behavior.searchRaw = [];
    proj = projOf();
    await runFetch(proj);
    const until1 = cacheOf(proj).entries[N].until;
    from = requests.length;
    const r3 = await runFetch(proj);
    check('Q3 within-TTL negative hit → zero network, counts as CACHED', !requests.slice(from).some((u) => u.includes('getIconInfo')) && /CACHED: [1-9]/.test(r3.out), (r3.out.match(/RESOLVED.*/) || [''])[0]);
    check('Q3b negative hit does NOT renew `until`', cacheOf(proj).entries[N].until === until1);
    // expired entry is re-queried
    const doc = cacheOf(proj); doc.entries[N].until = 1; writeCache(proj, doc);
    from = requests.length;
    await runFetch(proj);
    check('Q4 expired negative entry re-queried', requests.slice(from).some((u) => u.includes('getIconInfo')));
    rmSync(proj, { recursive: true, force: true });
  }

  // ── R. src/assets scan must be narrowed to the icons output dir ──
  {
    resetBehavior();
    // a module under src/assets/ (NOT src/assets/icons) that imports EP icons
    const proj = makeProject({ 'assets/widgets/tool.js': `import { Search } from '@element-plus/icons-vue'\nexport const tool = Search\n` });
    const { out } = await runFetch(proj);
    check('R4a icon import under src/assets scanned + resolved', out.includes('RESOLVED: 1') && existsSync(iconFile(proj, 'Search', 'light')));
    check('R4b that import rewritten to the barrel (correct relative path)', /from ['"]\.\.\/icons\/index\.js['"]/.test(readFileSync(join(proj, 'src', 'assets', 'widgets', 'tool.js'), 'utf8')));
    check('R4c generated barrel written + owned', barrelOf(proj).includes('@gts-ep-coder-owned'));
    rmSync(proj, { recursive: true, force: true });
  }

  // ── S. shared cache completeness — the dark file is validated ──
  {
    resetBehavior();
    const aliasDir = mkdtempSync(join(tmpdir(), 'uxal-'));
    const aliasFile = join(aliasDir, 'aliases.json');
    writeFileSync(aliasFile, JSON.stringify({ schemaVersion: 1, mappingVersion: '1', config: { provider: 'iconplus' }, aliases: { Search: { assetId: 'S1', url: 'mock://shared', themeMode: 'shared', sourceRef: 'shared' } } }), 'utf8');
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    await runFetch(proj, ['--aliases', aliasFile]);
    const entry = JSON.parse(readFileSync(join(proj, 'src', 'assets', 'icons', '.icon-cache.json'), 'utf8')).entries.Search;
    check('S1 shared cache stores themeMode=shared + darkHash==lightHash', entry.themeMode === 'shared' && entry.darkHash === entry.lightHash);
    // corrupt the shared dark file CONTENT (keep the owned marker) → cache invalidates
    const dp = iconFile(proj, 'Search', 'dark');
    writeFileSync(dp, readFileSync(dp, 'utf8').replace('#111111', '#deadbeef'), 'utf8');
    const from = requests.length;
    await runFetch(proj, ['--aliases', aliasFile]);
    check('S2 corrupted shared dark file → cache invalid → re-resolved', requests.slice(from).some((u) => u.includes('getIcon?')));
    check('S3 shared pair restored identical', hashOf(iconFile(proj, 'Search', 'light')) === hashOf(iconFile(proj, 'Search', 'dark')));
    rmSync(aliasDir, { recursive: true, force: true });
    rmSync(proj, { recursive: true, force: true });
  }

  // ── T. getIcon parameter contract (url/size/style/color/theme/fileType) ──
  {
    resetBehavior();
    const proj = makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const from = requests.length;
    await runFetch(proj);
    const getIconUrl = requests.slice(from).find((u) => u.includes('/getIcon?'));
    const p = getIconUrl ? new URL(getIconUrl, 'http://x').searchParams : new URLSearchParams();
    check('T1 getIcon sends url/size/style/color/theme/fileType', ['url', 'size', 'style', 'color', 'theme', 'fileType'].every((k) => p.has(k)), [...p.keys()].join(','));
    check('T2 getIcon keeps original name/category/style values', p.get('name') === 'Search' && p.get('category') === 'c' && p.get('style') === '线性');
    check('T3 getIcon fileType=svg', p.get('fileType') === 'svg');
    rmSync(proj, { recursive: true, force: true });
  }

  // ── U. R1 hardening (spec §15.2-1): real parser + icon contract ──
  // the four counterexamples that the old regex stack accepted, plus
  // namespace / viewBox-shape / positive-size checks and a real-world sample.
  {
    const oneIcon = () => makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const reasonOf = (proj) => reportOf(proj).items.find((i) => i.epName === 'Search');
    const cases = [
      // counterexamples (all must now be INVALID_SVG)
      ['duplicate attribute', '<svg viewBox="0 0 24 24" a="1" a="2"></svg>'],
      ['unquoted attribute value', '<svg viewBox="0 0 24 24"><path d=M0 /></svg>'],
      ['non-numeric viewBox', '<svg viewBox="oops"></svg>'],
      ['non-svg root element', '<html><svg viewBox="0 0 24 24"/></html>'],
      // contract checks beyond well-formedness
      ['wrong namespace', '<svg xmlns="http://example.com/not-svg" viewBox="0 0 24 24"></svg>'],
      ['viewBox fewer than 4 numbers', '<svg viewBox="0 0 24"></svg>'],
      ['viewBox non-positive size', '<svg viewBox="0 0 0 24"></svg>'],
      ['single quotes still parse (valid)', null], // placeholder, replaced below
    ];
    let ok = 0;
    const failCases = cases.filter((c) => c[1] !== null);
    for (const [label, body] of failCases) {
      resetBehavior();
      behavior.svg = () => body;
      const proj = oneIcon();
      const { out } = await runFetch(proj);
      const item = reasonOf(proj);
      const passed = out.includes('STATUS: FALLBACK') && item.reason === 'INVALID_SVG' && !existsSync(iconFile(proj, 'Search', 'light'));
      if (passed) ok++; else console.log(`   U: ${label} → ${item.reason} (expected INVALID_SVG)`);
      rmSync(proj, { recursive: true, force: true });
    }
    check('U1 §15.1 counterexamples + ns/viewBox contract → INVALID_SVG', ok === failCases.length, `${ok}/${failCases.length}`);
    // single-quoted attributes are legal XML and must pass
    resetBehavior();
    behavior.svg = () => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M0 0h24v24H0z' fill='#111'/></svg>`;
    let proj = oneIcon();
    let r = await runFetch(proj);
    check('U2 single-quoted valid SVG accepted', r.out.includes('STATUS: COMPLETE') && existsSync(iconFile(proj, 'Search', 'light')));
    rmSync(proj, { recursive: true, force: true });
    // a realistic full EP-style icon body (defs/style/multiple paths) is accepted
    resetBehavior();
    behavior.svg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs><style>.a{fill:currentColor}</style></defs><path class="a" d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896z"/><path class="a" d="M288 512h448v64H288z"/></svg>`;
    proj = oneIcon();
    r = await runFetch(proj);
    check('U3 realistic multi-path SVG accepted', r.out.includes('STATUS: COMPLETE') && existsSync(iconFile(proj, 'Search', 'light')));
    rmSync(proj, { recursive: true, force: true });
    // missing xmlns is tolerated (defaults to the SVG namespace) but viewBox is not optional
    resetBehavior();
    behavior.svg = () => `<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>`;
    proj = oneIcon();
    r = await runFetch(proj);
    check('U4 svg without explicit xmlns still accepted', r.out.includes('STATUS: COMPLETE') && existsSync(iconFile(proj, 'Search', 'light')));
    rmSync(proj, { recursive: true, force: true });
  }

  // ── V. R2 hardening (spec §15.2-2): per-layer type validation ──
  // no input shape may crash the script; anomalies are service-side reasons.
  {
    const N = 'Search';
    const oneIcon = () => makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    const reasonOf = (proj) => reportOf(proj).items.find((i) => i.epName === N).reason;
    const run = async (raw) => {
      resetBehavior();
      behavior.searchRaw = raw;
      const proj = oneIcon();
      const { out, code } = await runFetch(proj);
      const reason = existsSync(join(proj, 'icons-report.json')) ? reasonOf(proj) : 'CRASH';
      rmSync(proj, { recursive: true, force: true });
      return { out, code, reason };
    };
    // icons is an object (not an array)
    let r = await run([{ keyword: 'Search', icons: { error: 'failed' } }]);
    check('V1 icons=object → no crash, service reason', r.code === 0 && r.out.includes('RESULT: OK') && ['BAD_RESPONSE', 'SERVICE_UNAVAILABLE'].includes(r.reason), `${r.code} ${r.reason}`);
    // icons is null
    r = await run([{ keyword: 'Search', icons: null }]);
    check('V2 icons=null → no crash, service reason', r.code === 0 && r.out.includes('RESULT: OK') && ['BAD_RESPONSE', 'SERVICE_UNAVAILABLE'].includes(r.reason), `${r.code} ${r.reason}`);
    // icons missing entirely
    r = await run([{ keyword: 'Search' }]);
    check('V3 icons missing → no crash, service reason', r.code === 0 && r.out.includes('RESULT: OK') && ['BAD_RESPONSE', 'SERVICE_UNAVAILABLE'].includes(r.reason), `${r.code} ${r.reason}`);
    // array containing null / scalar entries
    r = await run([{ keyword: 'Search', icons: [null, 'x', { englishName: 'Search', url: 'mock://ok' }] }]);
    check('V4 icons array with junk entries → usable candidate survives, no crash', r.code === 0 && r.out.includes('RESULT: OK') && r.reason === 'EXACT', `${r.code} ${r.reason}`);
    // mixed valid + invalid groups: the good group still resolves
    r = await run([{ keyword: 'Search', icons: [{ englishName: 'Search', url: 'mock://ok' }] }, { code: 500 }]);
    check('V5 mixed valid/invalid groups → good group resolves, anomaly flagged', r.code === 0 && r.reason === 'EXACT', `${r.code} ${r.reason}`);
    // getIcon layer: array with null / missing data must not throw
    resetBehavior();
    behavior.getIconRaw = [null, { url: 'mock://Search' }, { data: 'x' }];
    let proj = oneIcon();
    const rg = await runFetch(proj);
    check('V6 getIcon junk array → no crash, EP fallback', rg.code === 0 && rg.out.includes('RESULT: OK') && !existsSync(iconFile(proj, N, 'light')), rg.out.replace(/\n/g, ' ').slice(0, 80));
    rmSync(proj, { recursive: true, force: true });
    // getIcon returning an object envelope
    resetBehavior();
    behavior.getIconRaw = { error: 'boom' };
    proj = oneIcon();
    const rg2 = await runFetch(proj);
    check('V7 getIcon object envelope → BAD_RESPONSE, not NO_MATCH', reasonOf(proj) === 'BAD_RESPONSE', reasonOf(proj));
    rmSync(proj, { recursive: true, force: true });
    // no anomaly may be persisted as a negative NO_MATCH entry (V1-style body)
    resetBehavior();
    behavior.searchRaw = [{ keyword: 'Search', icons: { error: 'failed' } }];
    proj = oneIcon();
    await runFetch(proj);
    const cacheDoc = JSON.parse(readFileSync(join(proj, 'src', 'assets', 'icons', '.icon-cache.json'), 'utf8'));
    check('V8 icons=object anomaly not persisted as NO_MATCH', (cacheDoc.entries[N] || {}).reason !== 'NO_MATCH', (cacheDoc.entries[N] || {}).reason);
    rmSync(proj, { recursive: true, force: true });
  }

  // ── W. §15.2-4 observability: config error surfaced, physical retries counted ──
  {
    const oneIcon = () => makeProject({ 'pages/Home/index.vue': `import { Search } from '@element-plus/icons-vue'\nexport default {}\n` });
    // config endpoint hangs → timeout; reason must be surfaced in the report
    resetBehavior();
    behavior.getConfig = 'hang';
    let proj = oneIcon();
    await runFetch(proj, ['--timeout', '300']);
    const rep = reportOf(proj);
    const net = rep.summary.network;
    check('W1 config timeout reason surfaced in report', net.configError === 'TIMEOUT', net.configError);
    check('W2 physical attempts counted (config retried once)', net.config.attempts === 2, String(net.config.attempts));
    rmSync(proj, { recursive: true, force: true });
    // online path: report carries per-endpoint attempt counts + elapsed ms
    resetBehavior();
    proj = oneIcon();
    await runFetch(proj);
    const net2 = reportOf(proj).summary.network;
    check('W3 online report has search/icon attempt counts + networkMs',
      typeof net2.search.attempts === 'number' && net2.search.attempts >= 1
      && typeof net2.iconLight.attempts === 'number' && net2.iconLight.attempts >= 1
      && typeof net2.networkMs === 'number' && net2.networkMs >= 0,
      JSON.stringify({ s: net2.search.attempts, l: net2.iconLight.attempts, ms: net2.networkMs }));
    rmSync(proj, { recursive: true, force: true });
  }

  // ── Y. mixed-response per-icon classification + negative-cache purity ──
  {
    const twoIcons = () => makeProject({ 'pages/Home/index.vue': `<script>\nimport { Search, Camera } from '@element-plus/icons-vue'\nexport default {}\n</script>\n<template><div/></template>\n` });
    const reasonsOf = (proj) => {
      const rep = reportOf(proj);
      const m = new Map(rep.items.map((i) => [i.epName, i.reason]));
      return { Search: m.get('Search'), Camera: m.get('Camera') };
    };
    const cacheOf = (proj) => JSON.parse(readFileSync(join(proj, 'src', 'assets', 'icons', '.icon-cache.json'), 'utf8'));

    // Y1: the repro — one genuine empty group + one malformed group
    resetBehavior();
    behavior.searchRaw = [{ keyword: 'Search', icons: [] }, { keyword: 'Camera', icons: { error: 'failed' } }];
    let proj = twoIcons();
    const ry = await runFetch(proj);
    const rs = reasonsOf(proj);
    const cy = cacheOf(proj);
    check('Y1 mixed response: Search=NO_MATCH, Camera=BAD_RESPONSE',
      ry.out.includes('RESULT: OK') && rs.Search === 'NO_MATCH' && rs.Camera === 'BAD_RESPONSE',
      `Search=${rs.Search} Camera=${rs.Camera}`);
    check('Y2 Camera not persisted as NO_MATCH negative entry',
      (cy.entries.Camera || {}).reason !== 'NO_MATCH', (cy.entries.Camera || {}).reason);
    check('Y3 Search still negative-cached (genuine miss)',
      (cy.entries.Search || {}).reason === 'NO_MATCH' && (cy.entries.Search || {}).until > Date.now());

    // Y4/Y5: fix the mock → Camera must re-query and adopt the company asset;
    // Search must stay negative-cached with zero search traffic for it
    resetBehavior();
    behavior.search = (kw) => [{ englishName: kw, url: `mock://${kw}`, icon_id: `id-${kw}`, score: 0.5 }];
    behavior.searchRaw = undefined;
    const from = requests.length;
    const ry2 = await runFetch(proj); // same project — cache from Y1 in place
    const rs2 = reasonsOf(proj);
    const searchedKws = searchKeywordsSince(from);
    check('Y4 after fix: Camera re-queried → EXACT company', ry2.out.includes('RESOLVED: 1, MISSED: 1') && rs2.Camera === 'EXACT', `Camera=${rs2.Camera}`);
    check('Y5 Search negative hit → no search re-issue, still NO_MATCH', !/search/i.test(searchedKws) && rs2.Search === 'NO_MATCH', searchedKws);
    rmSync(proj, { recursive: true, force: true });

    // Y6: all candidates junk → BAD_RESPONSE, never a business miss
    resetBehavior();
    behavior.searchRaw = [{ keyword: 'Search', icons: [null, 'junk', 42] }];
    proj = twoIcons();
    const ry3 = await runFetch(proj);
    const rs3 = reasonsOf(proj);
    const cy3 = cacheOf(proj);
    check('Y6 all-junk candidates → BAD_RESPONSE + no negative cache',
      ry3.out.includes('RESULT: OK') && rs3.Search === 'BAD_RESPONSE' && (cy3.entries.Search || {}).reason !== 'NO_MATCH',
      `Search=${rs3.Search} cache=${(cy3.entries.Search || {}).reason}`);
    rmSync(proj, { recursive: true, force: true });

    // Y7: partial junk — usable candidate survives, junk does not crash
    resetBehavior();
    behavior.searchRaw = [{ keyword: 'Search', icons: [null, { englishName: 'Search', url: 'mock://ok', icon_id: 'ok1' }, 'junk'] }, { keyword: 'Camera', icons: [] }];
    proj = twoIcons();
    const ry4 = await runFetch(proj);
    const rs4 = reasonsOf(proj);
    check('Y7 partial junk: valid candidate survives, other keyword still NO_MATCH',
      ry4.out.includes('RESULT: OK') && rs4.Search === 'EXACT' && rs4.Camera === 'NO_MATCH',
      `Search=${rs4.Search} Camera=${rs4.Camera}`);
    rmSync(proj, { recursive: true, force: true });

    // Y8: requested keyword missing from response entirely → service anomaly, not miss
    resetBehavior();
    behavior.searchRaw = [{ keyword: 'Search', icons: [] }]; // no Camera group at all
    proj = twoIcons();
    const ry5 = await runFetch(proj);
    const rs5 = reasonsOf(proj);
    const cy5 = cacheOf(proj);
    check('Y8 missing keyword group → BAD_RESPONSE, no negative cache',
      ry5.out.includes('RESULT: OK') && rs5.Camera === 'BAD_RESPONSE' && (cy5.entries.Camera || {}).reason !== 'NO_MATCH',
      `Camera=${rs5.Camera} cache=${(cy5.entries.Camera || {}).reason}`);
    rmSync(proj, { recursive: true, force: true });
  }

  // ── Z. candidate-object minimum schema (table-driven) ──
  // Each row: malformed candidate shapes must classify as BAD_RESPONSE (never
  // a negative-cached NO_MATCH), while well-formed-but-unmatched candidates
  // stay genuine NO_MATCH — the fix must not over-tighten.
  {
    const twoIcons = () => makeProject({ 'pages/Home/index.vue': `<script>\nimport { Search, Camera } from '@element-plus/icons-vue'\nexport default {}\n</script>\n<template><div/></template>\n` });
    const reportMap = (proj) => new Map(reportOf(proj).items.map((i) => [i.epName, i]));
    const cacheOf = (proj) => JSON.parse(readFileSync(join(proj, 'src', 'assets', 'icons', '.icon-cache.json'), 'utf8'));

    // table: [label, cameraIcons, expectedCameraReason]
    const TABLE = [
      ['empty object {}', [{}], 'BAD_RESPONSE'],
      ['error envelope object', [{ error: 'failed' }], 'BAD_RESPONSE'],
      ['array-as-candidate', [[]], 'BAD_RESPONSE'],
      ['url not a string', [{ url: 123 }], 'BAD_RESPONSE'],
      ['url empty string', [{ url: '' }], 'BAD_RESPONSE'],
      ['missing url entirely', [{ englishName: 'Camera', icon_id: 'x' }], 'BAD_RESPONSE'],
      ['all invalid mixed shapes', [null, 'x', {}, { url: 42 }], 'BAD_RESPONSE'],
      ['partial valid + invalid', [{ url: 'mock://cam', englishName: 'Camera', icon_id: 'c1' }, { error: 'boom' }, null], 'EXACT'],
      // A well-formed non-exact candidate is selected by score.
      ['well-formed non-exact candidate', [{ url: 'mock://other', englishName: 'CameraX', icon_id: 'c2' }], 'SCORE'],
      // Source/group filtering is performed by the original search API parameters.
      ['well-formed out-of-scope candidate', [{ url: 'mock://s', englishName: 'Camera', icon_id: 'c3', source_id: 999 }], 'EXACT'],
    ];

    for (const [label, cameraIcons, expected] of TABLE) {
      resetBehavior();
      // Search group stays a GENUINE empty miss in every row
      behavior.searchRaw = [{ keyword: 'Search', icons: [] }, { keyword: 'Camera', icons: cameraIcons }];
      const proj = twoIcons();
      const { out } = await runFetch(proj);
      const rep = reportMap(proj);
      const cache = cacheOf(proj);
      const cam = rep.get('Camera');
      const search = rep.get('Search');
      const camCache = (cache.entries.Camera || {}).reason;
      const searchCache = (cache.entries.Search || {}).reason;
      const ok =
        out.includes('RESULT: OK') &&
        cam.reason === expected &&
        (['EXACT', 'SCORE'].includes(expected) ? cam.provider !== 'element-plus' : cam.provider === 'element-plus') &&
        search.reason === 'NO_MATCH' &&
        // negative-cache discipline: only a genuine miss may be cached as NO_MATCH
        (expected === 'NO_MATCH' ? camCache === 'NO_MATCH' : camCache !== 'NO_MATCH') &&
        searchCache === 'NO_MATCH';
      check(`Z1 ${label} → Camera=${expected}, Search=NO_MATCH, cache clean`, ok,
        `Camera=${cam.reason}/${cam.provider} camCache=${camCache} Search=${search.reason}/${searchCache}`);
      rmSync(proj, { recursive: true, force: true });
    }

    // Z2: service recovery — after BAD_RESPONSE, the SAME project re-runs and
    // the previously-anomalous icon re-queries immediately and adopts company
    const recoveryRows = [
      ['{}', [{}]],
      ['error envelope', [{ error: 'failed' }]],
    ];
    for (const [label, badIcons] of recoveryRows) {
      resetBehavior();
      behavior.searchRaw = [{ keyword: 'Search', icons: [] }, { keyword: 'Camera', icons: badIcons }];
      const proj = twoIcons();
      await runFetch(proj); // anomaly run — Camera=BAD_RESPONSE
      // fix the service: valid exact candidates now
      resetBehavior();
      behavior.search = (kw) => [{ englishName: kw, url: `mock://${kw}`, icon_id: `id-${kw}`, score: 0.5 }];
      behavior.searchRaw = undefined;
      const from = requests.length;
      const r2 = await runFetch(proj); // same project — BAD_RESPONSE must NOT have blocked re-query
      const rep = reportMap(proj);
      const cam = rep.get('Camera');
      const camKwQueried = requests.slice(from).some((u) => {
        const kw = new URL(u, 'http://x').searchParams.get('keyword') || '';
        return u.includes('getIconInfo') && kw.toLowerCase().split(',').includes('camera');
      });
      check(`Z2 after ${label}: Camera re-queried → EXACT company`, r2.out.includes('RESULT: OK') && cam.reason === 'EXACT' && cam.provider !== 'element-plus' && camKwQueried,
        `Camera=${cam.reason} reQueried=${camKwQueried}`);
      rmSync(proj, { recursive: true, force: true });
    }
  }

  // ── X. §15.2-4: commit-phase rollback on mid-set rename failure ──
  // Inject a failure at the LAST committed output: a directory junction where
  // the SVG should be makes renameSync fail while earlier renames succeeded.
  // The rollback must restore the pre-run state of every already-committed file.
  {
    const N = 'Search';
    const proj = makeProject({
      'pages/Home/index.vue': `<script>\nimport { Search, Plus } from '@element-plus/icons-vue'\nexport default {}\n</script>\n<template><div/></template>\n`,
    });
    resetBehavior();
    behavior.search = (kw) => [{ englishName: kw, url: `mock://${kw}`, icon_id: `id-${kw}` }];
    behavior.svg = (url, theme) => VALID_SVG(theme === 'light' ? '#111111' : '#eeeeee');
    // pre-run: seed a VALID old generation (light/dark for Search only) so the
    // rollback target content is known; Plus has no old files (did-not-exist path)
    mkdirSync(join(proj, 'src', 'assets', 'icons'), { recursive: true });
    const oldLight = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- @gts-ep-coder-owned --><path d="OLD-LIGHT"/></svg>';
    const oldDark = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><!-- @gts-ep-coder-owned --><path d="OLD-DARK"/></svg>';
    writeFileSync(iconFile(proj, N, 'light'), oldLight, 'utf8');
    writeFileSync(iconFile(proj, N, 'dark'), oldDark, 'utf8');
    // deterministic commit-phase injection: a DANGLING junction at Plus.light
    // passes the ownership gate (existsSync=false), stages fine, then the
    // commit rename fails with EPERM after Search.light/.dark already landed.
    const junction = iconFile(proj, 'Plus', 'light');
    const { spawnSync: sp } = await import('child_process');
    const jn = sp('cmd', ['/c', 'mklink', '/J', junction, join(proj, 'no-such-target')], { encoding: 'utf8' });
    if (jn.status !== 0) {
      check('X1 mid-commit rename failure rolls back (junction injection)', false, `mklink failed: ${jn.stderr || jn.stdout}`);
    } else {
      let detail = '';
      let failed = false;
      let rolledBack = false;
      let noPlus = false;
      try {
        const { out } = await runFetch(proj);
        failed = out.includes('RESULT: FAIL') && /failed to write icon assets atomically/.test(out);
        const afterLight = readFileSync(iconFile(proj, N, 'light'), 'utf8');
        const afterDark = readFileSync(iconFile(proj, N, 'dark'), 'utf8');
        rolledBack = afterLight === oldLight && afterDark === oldDark;
        noPlus = !existsSync(iconFile(proj, 'Plus', 'dark'));
        if (!failed) detail = `no-fail: ${out.replace(/\n/g, ' ').slice(0, 120)}`;
        else if (!rolledBack) detail = `light-ok=${afterLight === oldLight} dark-ok=${afterDark === oldDark}`;
      } catch (e) {
        detail = `driver exception: ${e.message}`;
      }
      check('X1 mid-commit rename failure rolls back to old set', failed && rolledBack && noPlus, detail);
    }
    rmSync(proj, { recursive: true, force: true });
  }

  server.close();
  const fails = results.filter((r) => !r.ok).length;
  console.log(`\nRESULT: ${fails === 0 ? 'ALL PASS' : 'FAIL'} | ${results.length - fails}/${results.length}`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error('DRIVER ERROR:', e); process.exit(2); });
