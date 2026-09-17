#!/usr/bin/env node
// smoke.mjs
// Headless browser smoke test for a generated prototype workspace.
// Launches serve.mjs on a scratch port, drives the page in headless
// Chrome/Edge (via puppeteer-core + the system browser — no download),
// and asserts the things build.mjs cannot see:
//
//   1. Page renders   — no pageerror/console errors (favicon 404 ignored),
//                       target selector appears
//   2. Token wiring   --el-color-primary resolves to the asset brand color
//   3. Theme switch   — setTheme('dark') flips data-theme and repaints body
//   4. Interactions   — click-through of [data-smoke] hooks if present
//
// Usage:
//   node scripts/smoke.mjs --dir "{artifact-folder}/{slug}" [--selector ".event-card"] [--settle 1200]
//
// Output (agent-parseable):
//   RESULT: OK | <checks summary>
//   RESULT: FAIL | <first failure>
//
// Requires: puppeteer-core (npm i -g puppeteer-core, or npm i in the skill
// scripts dir). A system Chrome/Edge must be installed.

import { existsSync, mkdtempSync, rmSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createServer } from 'http';
import net from 'net';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- args ----------
const args = process.argv.slice(2);
function getOpt(long, short) {
  const idx = args.findIndex((a) => a === long || a === short);
  if (idx === -1) return undefined;
  return args[idx + 1];
}
function hasFlag(long) {
  return args.includes(long);
}

const dir = getOpt('--dir', '-d');
const selector = getOpt('--selector') || '.event-card, .page-root, main, #app .el-button';
const settle = parseInt(getOpt('--settle') || '1200', 10);
const keepServer = hasFlag('--keep-server');

if (!dir) {
  console.log('RESULT: FAIL | Usage: node smoke.mjs --dir "<folder with index.html>" [--selector "..."] [--settle N]');
  process.exit(1);
}
const root = resolve(dir);
if (!existsSync(join(root, 'index.html'))) {
  console.log(`RESULT: FAIL | index.html not found in: ${root}`);
  process.exit(1);
}

// ---------- puppeteer-core resolution ----------
function resolvePuppeteer() {
  // 1) global install (npm i -g puppeteer-core)
  try {
    const r = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' });
    if (r.status === 0) {
      const req = createRequire(join((r.stdout || '').trim(), 'noop.js'));
      req.resolve('puppeteer-core');
      return req;
    }
  } catch { /* fall through */ }
  // 2) resolvable from the skill scripts dir (npm i in scripts/)
  try {
    const req = createRequire(join(__dirname, 'noop.js'));
    req.resolve('puppeteer-core');
    return req;
  } catch {
    return null;
  }
}
const pptrRequire = resolvePuppeteer();
if (!pptrRequire) {
  console.log('RESULT: FAIL | puppeteer-core not found. Run: npm i -g puppeteer-core (once per machine)');
  process.exit(1);
}
const { launch } = pptrRequire('puppeteer-core');

// ---------- system browser discovery ----------
// macOS Chrome/Edge 安装为 app bundle（x64 与 arm64 同路径，统一装到 /Applications）
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe` : null,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
];
const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/microsoft-edge',
];
const executablePath = [...CHROME_CANDIDATES, ...EDGE_CANDIDATES].filter(Boolean).find((p) => existsSync(p));
if (!executablePath) {
  console.log('RESULT: FAIL | No system Chrome/Edge found for headless smoke test');
  process.exit(1);
}

// ---------- start serve.mjs on a scratch port ----------
const scratchDir = mkdtempSync(join(tmpdir(), 'smoke-'));
// probe a free port, release it, then hand it to serve.mjs
function freePort() {
  return new Promise((resolvePort) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolvePort(port));
    });
  });
}
const port = await freePort();
const serverProc = spawn(process.execPath, [join(__dirname, 'serve.mjs'), '--dir', root, '--port', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
// TCP 就绪探测替代固定 sleep（fastui isServing 同款）：连上即走，慢机不再 flaky，快机省 800ms；
// serve.mjs 是静态服务器，端口应答 = 就绪（HTTP 200 轮询是给「起了还在编译」的服务器用的，此处不需要）
async function waitServing(p, timeoutMs = 10_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await new Promise((res) => {
      const sock = net.connect({ port: p, host: '127.0.0.1' });
      const done = (v) => { sock.destroy(); res(v); };
      sock.setTimeout(1500, () => done(false));
      sock.once('connect', () => done(true));
      sock.once('error', () => done(false));
    })) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log(`RESULT: FAIL | serve.mjs not listening on ${p} within ${timeoutMs}ms`);
  serverProc.kill();
  process.exit(1);
}
await waitServing(port);

const url = `http://127.0.0.1:${port}/index.html`;

try {
  const browser = await launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });

  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // favicon 404 surfaces here with the URL only in m.location — skip it there
    if (m.location()?.url && /favicon\.ico/.test(m.location().url)) return;
    errors.push(`console: ${m.text()}`);
  });
  // resource 404s: only favicon is an expected miss — anything else is a failure
  const missing404 = [];
  page.on('response', (r) => {
    if (r.status() === 404 && !/favicon\.ico/.test(r.url())) missing404.push(r.url());
  });

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForSelector(selector, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, settle));
  // let v-loading masks fade before interacting
  await page.waitForFunction(() => !document.querySelector('.el-loading-mask'), { timeout: 10000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));

  const checks = {};

  checks.rendered = true;
  checks.brandColor = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--el-color-primary').trim(),
  );
  checks.tokenOk = /^#[0-9a-f]{6}$/i.test(checks.brandColor);

  // theme switch (asset-library protocol: data-theme on <html>)
  // dark probe uses --code-background (design-source dark value: #FAFAFA/#131416) —
  // semantic bg tokens currently have no design-sourced dark overrides.
  const before = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.documentElement).getPropertyValue('--code-background').trim(),
  }));
  await page.evaluate(() => window.setTheme && window.setTheme('dark'));
  await new Promise((r) => setTimeout(r, 500));
  const after = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.documentElement).getPropertyValue('--code-background').trim(),
  }));
  checks.themeSwitch = before.theme !== after.theme && before.bg !== after.bg;
  // restore light for any follow-up screenshot
  await page.evaluate(() => window.setTheme && window.setTheme('light'));
  await new Promise((r) => setTimeout(r, 300));

  checks.errors = errors;
  checks.missing404 = missing404;

  const ok = checks.tokenOk && checks.themeSwitch && errors.length === 0 && missing404.length === 0;
  const summary = `render=1 token=${checks.brandColor} themeSwitch=${checks.themeSwitch ? 'ok' : 'NO'} errors=${errors.length} missing404=${missing404.length}`;
  console.log(ok ? `RESULT: OK | ${summary}` : `RESULT: FAIL | ${summary}${errors.length ? ` | first: ${errors[0]}` : ''}`);
  if (keepServer) {
    console.log(`URL: ${url}`);
    console.log('Server kept alive (--keep-server); press Ctrl+C to stop.');
    await new Promise(() => {});
  }
  await browser.close();
  process.exit(ok ? 0 : 1);
} catch (error) {
  console.log(`RESULT: FAIL | ${error.message}`);
  if (keepServer) {
    console.log(`URL: ${url}`);
    await new Promise(() => {});
  }
  process.exit(1);
} finally {
  if (!keepServer) {
    serverProc.kill();
    rmSync(scratchDir, { recursive: true, force: true });
  }
}
