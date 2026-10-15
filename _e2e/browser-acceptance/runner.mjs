// Focused browser acceptance for the mixed-provider fixture, not a general UI suite.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const project = resolve(here, '../independent-build/icon-indep');
const delay = ms => new Promise(r => setTimeout(r, ms));
const AUDIT = `(() => {
  const shown = e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
  const imgs = [...document.querySelectorAll('.ux-icon-pair img')];
  const visible = imgs.filter(shown);
  const root = getComputedStyle(document.documentElement);
  const button = document.querySelector('.el-button');
  const input = document.querySelector('.el-input__wrapper');
  const body = getComputedStyle(document.body);
  return {
    theme: document.documentElement.dataset.theme,
    pairCount: document.querySelectorAll('.ux-icon-pair').length,
    imgCount: imgs.length,
    lightShown: visible.filter(e => e.classList.contains('ux-icon-light')).length,
    darkShown: visible.filter(e => e.classList.contains('ux-icon-dark')).length,
    visibleImages: visible.map(e => ({src:e.src, complete:e.complete, naturalWidth:e.naturalWidth,
      width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})),
    brokenImgs: imgs.filter(e => !e.complete || !e.naturalWidth).length,
    epIconCount: document.querySelectorAll('.el-button svg, .el-icon svg').length,
    tableRows: document.querySelectorAll('.el-table__row').length,
    buttons: [...document.querySelectorAll('.el-button')].map(e => e.textContent.trim()),
    tokenBackground: root.getPropertyValue('--color-bg-1').trim(),
    tokenFont: root.getPropertyValue('--font-size-normal').trim(),
    background: body.backgroundColor, color:body.color, fontFamily:body.fontFamily,
    buttonHeight: button?.getBoundingClientRect().height || 0,
    buttonBackground: button ? getComputedStyle(button).backgroundColor : '',
    inputShadow: input ? getComputedStyle(input).boxShadow : '',
    pagePadding: getComputedStyle(document.querySelector('.page-root')).paddingTop,
    tableHeaderBackground: document.querySelector('.el-table th') ? getComputedStyle(document.querySelector('.el-table th')).backgroundColor : '',
    bootError: document.querySelector('#ux-boot-error')?.textContent || ''
  };
})()`;

function validate(a, dark) {
  assert.equal(a.theme, dark ? 'dark' : 'default', 'theme selector must match shipped skin');
  assert.equal(a.pairCount, 2, 'two company icons');
  assert.equal(a.imgCount, 4);
  assert.equal(a.lightShown, dark ? 0 : 2);
  assert.equal(a.darkShown, dark ? 2 : 0);
  assert.equal(a.brokenImgs, 0, 'all company images loaded');
  assert.equal(a.epIconCount, 5, 'EP fallback icons remain visible in fixture');
  assert.equal(a.tableRows, 10, 'fixture data rendered');
  assert.equal(a.buttons.length, 5);
  assert.ok(a.tokenBackground && a.tokenFont, 'theme variables resolved');
  assert.ok(a.buttonHeight >= 28, 'button CSS applied');
  assert.ok(a.inputShadow && a.inputShadow !== 'none', 'input CSS applied');
  assert.ok(parseFloat(a.pagePadding) >= 16, 'page scoped styles applied');
  for (const i of a.visibleImages) assert.ok(i.complete && i.naturalWidth && i.width >= 10 && i.height >= 10, 'visible icon has valid dimensions');
}

export async function run(mode, args = process.argv.slice(2)) {
  const negative = args.includes('--negative-css');
  const positional = args.filter(a => !a.startsWith('--'));
  let url = positional[0];
  const out = resolve(positional[1] || join(here, 'shots', negative ? `negative-${mode}` : mode));
  mkdirSync(out, { recursive: true });
  let server, chrome, ws;
  const report = { mode, negative, status: 'FAIL', requests: [], responses: [], errors: [], exceptions: [], networkFailed: [], shots: [] };
  try {
    if (!url && mode === 'dist') {
      const base = join(project, 'dist');
      server = createServer((req, res) => {
        const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (name === '/favicon.ico') { res.writeHead(204); res.end(); return; }
        const path = resolve(base, `.${name === '/' ? '/index.html' : name}`);
        if (!path.startsWith(base + sep) || !existsSync(path)) { res.writeHead(404); res.end(); return; }
        const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(path)] || 'application/octet-stream';
        res.writeHead(200, {'content-type':mime}); res.end(readFileSync(path));
      });
      await new Promise(r => server.listen(0, '127.0.0.1', r));
      url = `http://127.0.0.1:${server.address().port}/`;
    }
    url ||= pathToFileURL(join(project, 'index.gts.html')).href;
    report.url = url;
    const profile = mkdtempSync(join(tmpdir(), 'gts-browser-acceptance-'));
    chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
      '--no-first-run','--no-default-browser-check','--disable-background-networking',
      '--window-size=1440,900','--hide-scrollbars','about:blank'
    ], {stdio:'ignore', windowsHide:true}); // deliberately no allow-file-access-from-files
    let launchError; chrome.on('error', e => { launchError=e; });
    const portFile = join(profile, 'DevToolsActivePort');
    for (let i=0; i<100 && !existsSync(portFile); i++) { if(launchError) throw launchError; await delay(100); }
    assert.ok(existsSync(portFile), 'Chrome debugging endpoint ready');
    const port = readFileSync(portFile, 'utf8').split('\n')[0];
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r,j) => {ws.onopen=r;ws.onerror=j;});
    let id=0; const pending=new Map();
    const send = (method, params={}) => new Promise((r,j) => {
      const mid=++id;
      const timer=setTimeout(()=>{pending.delete(mid);j(new Error(`CDP timeout ${method}`));},15000);
      pending.set(mid, {r,j,timer}); ws.send(JSON.stringify({id:mid,method,params}));
    });
    ws.onmessage = ({data}) => {
      const m=JSON.parse(data);
      if(m.id && pending.has(m.id)) {const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.j(new Error(JSON.stringify(m.error))):p.r(m.result);}
      if(m.method==='Runtime.consoleAPICalled' && ['error','warning'].includes(m.params.type)) report.errors.push(m.params);
      if(m.method==='Runtime.exceptionThrown') report.exceptions.push(m.params);
      if(m.method==='Network.requestWillBeSent') report.requests.push({url:m.params.request.url,type:m.params.type});
      if(m.method==='Network.responseReceived') report.responses.push({url:m.params.response.url,status:m.params.response.status,mime:m.params.response.mimeType});
      if(m.method==='Network.loadingFailed') report.networkFailed.push(m.params);
      if(m.method==='Fetch.requestPaused') send('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'BlockedByClient'}).catch(e=>report.errors.push(String(e)));
    };
    const evaluate = async expression => {
      const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
      if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
      return r.result.value;
    };
    await send('Runtime.enable'); await send('Network.enable'); await send('Page.enable');
    await send('Network.setCacheDisabled',{cacheDisabled:true});
    if(mode==='file') {
      await send('Fetch.enable',{patterns:[{urlPattern:'http://*'},{urlPattern:'https://*'}]});
      report.offlinePolicy='block all HTTP(S) before navigation; cache disabled; default file permissions';
    } else if(negative) {
      await send('Fetch.enable',{patterns:[{urlPattern:'*.css*'}]});
    }
    report.browser=await evaluate('navigator.userAgent');
    await send('Page.navigate',{url});
    let ready=false;
    for(let i=0;i<100;i++){ready=await evaluate('document.querySelectorAll(".el-table__row").length === 10');if(ready)break;await delay(100);}
    assert.ok(ready, 'fixture mounted before deadline');
    await evaluate('Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))');
    await evaluate('document.fonts.ready.then(()=>true)');
    await delay(350); // let EP enter/colour transitions settle before screenshots
    report.light=await evaluate(AUDIT);
    const capture=async name=>{const p=join(out,name);const r=await send('Page.captureScreenshot',{format:'png'});writeFileSync(p,Buffer.from(r.data,'base64'));report.shots.push(p);};
    await capture(`${mode}-light.png`); validate(report.light,false);
    await evaluate('document.documentElement.dataset.theme="dark"');await delay(350);
    report.dark=await evaluate(AUDIT); await capture(`${mode}-dark.png`); validate(report.dark,true);
    assert.notEqual(report.light.background,report.dark.background,'page theme really changes');
    assert.notEqual(report.light.color,report.dark.color,'text theme really changes');
    assert.equal(report.errors.length,0,'no console errors/warnings');
    assert.equal(report.exceptions.length,0,'no JS exceptions');
    assert.equal(report.networkFailed.length,0,'all required resources loaded');
    assert.equal(report.responses.filter(r=>r.status>=400).length,0,'no HTTP/resource errors');
    if(mode==='file') assert.equal(report.requests.filter(r=>/^https?:/.test(r.url)).length,0,'no HTTP(S) requests attempted');
    const css=report.responses.filter(r=>r.url.includes('.css'));
    if(mode==='dist') assert.ok(css.some(r=>r.status===200 && r.mime==='text/css'),'production CSS served with correct MIME');
    report.status='PASS';
  } catch(e) {report.failure=e.stack; process.exitCode=1;}
  finally {
    writeFileSync(join(out,`accept-${mode}.json`),JSON.stringify(report,null,2));
    console.log(`RESULT: ${report.status} | ${mode}${negative?' negative-css':''} | ${out}`);
    if(report.failure) console.error(report.failure.split('\n').slice(0,3).join('\n'));
    if(ws)ws.close();if(chrome)chrome.kill();if(server)await new Promise(r=>server.close(r));
  }
  return report;
}
