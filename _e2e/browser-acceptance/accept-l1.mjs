#!/usr/bin/env node
// L1 轻量验收：加载 L1 fixture 的 file:// 离线预览，断言挂载/主要交互可用/无白屏/console 干净。
// 只覆盖 §50.4 L1 验证点（打开预览 + 一条主要交互），不是通用 UI 套件。
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, '../l1-fixture/l1-check');
const out = join(here, 'shots', 'l1-accept');
mkdirSync(out, { recursive: true });
const delay = ms => new Promise(r => setTimeout(r, ms));

const report = { mode: 'l1-accept', status: 'FAIL', errors: [], exceptions: [], networkFailed: [], requests: [], shots: [] };
let chrome, ws;
try {
  const url = pathToFileURL(join(project, 'index.gts.html')).href;
  report.url = url;
  const profile = mkdtempSync(join(tmpdir(), 'gts-l1-accept-'));
  chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run','--no-default-browser-check','--disable-background-networking',
    '--window-size=1440,900','--hide-scrollbars','about:blank'
  ], { stdio: 'ignore', windowsHide: true });
  let launchError; chrome.on('error', e => { launchError = e; });
  const portFile = join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100 && !existsSync(portFile); i++) { if (launchError) throw launchError; await delay(100); }
  assert.ok(existsSync(portFile), 'Chrome debugging endpoint ready');
  const port = readFileSync(portFile, 'utf8').split('\n')[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((r, j) => {
    const mid = ++id;
    const timer = setTimeout(() => { pending.delete(mid); j(new Error(`CDP timeout ${method}`)); }, 15000);
    pending.set(mid, { r, j, timer }); ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); clearTimeout(p.timer); pending.delete(m.id); m.error ? p.j(new Error(JSON.stringify(m.error))) : p.r(m.result); }
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) report.errors.push(m.params);
    if (m.method === 'Runtime.exceptionThrown') report.exceptions.push(m.params);
    if (m.method === 'Network.requestWillBeSent') report.requests.push({ url: m.params.request.url, type: m.params.type });
    if (m.method === 'Network.loadingFailed') report.networkFailed.push(m.params);
  };
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  report.browser = await evaluate('navigator.userAgent');
  await send('Page.navigate', { url });

  // 等挂载：starter 页 10 行表格（无白屏证明）
  let mounted = false;
  for (let i = 0; i < 100; i++) {
    mounted = await evaluate('document.querySelectorAll(".el-table__row").length === 10');
    if (mounted) break; await delay(100);
  }
  assert.ok(mounted, '页面挂载，10 行数据渲染（无白屏）');

  const initial = await evaluate(`(() => ({
    rows: document.querySelectorAll('.el-table__row').length,
    title: document.querySelector('.page-title')?.textContent || '',
    input: !!document.querySelector('.el-input__wrapper'),
    buttons: [...document.querySelectorAll('.el-button')].map(e => e.textContent.trim()),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bootError: document.querySelector('#ux-boot-error')?.textContent || ''
  }))()`);
  assert.equal(initial.rows, 10, '主要内容可见');
  assert.equal(initial.title, '演示工作台', '标题渲染');
  assert.ok(initial.input && initial.buttons.includes('查询'), '搜索栏与按钮渲染');
  assert.equal(initial.bootError, '', '无 boot 错误');
  report.initial = initial;

  // 主要交互：搜索过滤（输入关键字 → 列表变化）+ 分页跳转
  const interaction = await evaluate(`(async () => {
    const setVal = (el, v) => {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const input = document.querySelector('.el-input__inner');
    setVal(input, 'Server-01');
    document.querySelector('.el-button').click();
    await new Promise(r => setTimeout(r, 400));
    const filtered = document.querySelectorAll('.el-table__row').length;
    const firstFiltered = document.querySelector('.el-table__row .cell')?.textContent || '';
    // 清空回全量
    setVal(input, '');
    document.querySelector('.el-button').click();
    await new Promise(r => setTimeout(r, 400));
    const restored = document.querySelectorAll('.el-table__row').length;
    // 分页：全量 12 条 → 第 2 页应有 2 行
    const pageBtn = [...document.querySelectorAll('.el-pager li')].find(li => li.textContent === '2');
    if (pageBtn) { pageBtn.click(); await new Promise(r => setTimeout(r, 400)); }
    const page2Rows = document.querySelectorAll('.el-table__row').length;
    return { filtered, firstFiltered, restored, page2Rows };
  })()`);
  assert.ok(interaction.filtered < 10 && interaction.filtered >= 1, `搜索过滤生效（${interaction.filtered} 行）`);
  assert.ok(interaction.firstFiltered.includes('Ankara-Server-01'), `过滤结果含关键字（${interaction.firstFiltered}）`);
  assert.equal(interaction.restored, 10, '清空后恢复全量');
  assert.equal(interaction.page2Rows, 2, `分页第 2 页渲染正确（${interaction.page2Rows} 行）`);
  report.interaction = interaction;

  const shot = join(out, 'l1-accept.png');
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(shot, Buffer.from(r.data, 'base64'));
  report.shots.push(shot);

  assert.equal(report.errors.length, 0, `无 console error/warning（${report.errors.length}）`);
  assert.equal(report.exceptions.length, 0, '无 JS 异常');
  assert.equal(report.networkFailed.length, 0, '无资源加载失败');
  report.status = 'PASS';
} catch (e) {
  report.failure = e.stack; process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'accept-l1.json'), JSON.stringify(report, null, 2));
  console.log(`RESULT: ${report.status} | l1-accept | ${out}`);
  if (report.failure) console.error(report.failure.split('\n').slice(0, 3).join('\n'));
  if (ws) ws.close(); if (chrome) chrome.kill();
}
