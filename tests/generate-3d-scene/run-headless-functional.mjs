// Functional DOM/WebGL assertions only. No screenshot or aesthetic evaluation.
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const url = process.argv[2];
if (!url?.startsWith('http://127.0.0.1:')) throw new Error('Expected local maintenance test URL');
const profile = await mkdtemp(join(tmpdir(), 'scene3d-functional-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--enable-unsafe-swiftshader', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Chrome startup timeout')), 20000);
    browser.once('error', reject);
    browser.stderr.on('data', chunk => { const match = chunk.toString().match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timeout); resolve(match[1]); } });
  });
  const address = new URL(endpoint);
  const pages = await (await fetch(`http://${address.host}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let seq = 0; const pending = new Map(), errors = [];
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description ?? data.params.exceptionDetails.text);
    if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error') errors.push(data.params.entry.text);
    const entry = pending.get(data.id); if (entry) { pending.delete(data.id); data.error ? entry.reject(Error(data.error.message)) : entry.resolve(data.result); }
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  await call('Runtime.enable'); await call('Log.enable');
  await call('Page.navigate', { url });
  let text = '';
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const value = await call('Runtime.evaluate', { expression: 'document.querySelector("#result")?.textContent', returnByValue: true });
    text = value.result?.value ?? '';
    if (/ALL PASS|FAIL/.test(text) || errors.length) break;
  }
  console.log(text || 'No test result');
  if (errors.length) console.log(errors.join('\n'));
  if (!text.includes('ALL PASS') || errors.length) process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  socket?.close(); browser.kill();
}
