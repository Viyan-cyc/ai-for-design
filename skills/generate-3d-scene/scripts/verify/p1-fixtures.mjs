// P1 regression tests use production modules, not copied implementations.
// node scripts/verify/p1-fixtures.mjs --node-only
// node scripts/verify/p1-fixtures.mjs --url http://localhost:5199/
//
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { createServer } from 'node:http';
import {
  createCdpConnection, openBrowserSession, positionalArg, collectPageErrors, collectNetwork404s,
} from '../lib/cdp.mjs';
import { compareGroups, intersectsFrustumBox, inspectSubject } from './scene-checks.mjs';
import {
  verifyScene, verifyPage, readExpect, waitReady, summarize,
} from './scene.mjs';

const template = resolve(dirname(fileURLToPath(import.meta.url)), '../../template');
const ts = (await import(pathToFileURL(join(template, 'node_modules/typescript/lib/typescript.js')))).default;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
      const url = new URL(`${specifier }.ts`, context.parentURL);
      if (existsSync(fileURLToPath(url))) {
        return { url: url.href, shortCircuit: true };
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.ts') && url.startsWith(pathToFileURL(template).href)) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText,
      };
    }
    return next(url, context);
  },
});
const THREE = await import(pathToFileURL(join(template, 'node_modules/three/build/three.module.js')));
const { installDiagnostics, waitForReady, getPageErrorSink } =
  await import(pathToFileURL(join(template, 'src/scene-core/diagnostics.ts')));
const { makeAssetNodeFactory } = await import(pathToFileURL(join(template, 'src/scene-core/handlers/registry.ts')));
const { SceneEngine } = await import(pathToFileURL(join(template, 'src/scene-core/engine/SceneEngine.ts')));
const { RenderLoop } = await import(pathToFileURL(join(template, 'src/scene-core/engine/RenderLoop.ts')));

let passed = 0; let failed = 0;
const filterArg = process.argv.find((arg) => arg.startsWith('--filter='));
const filter = filterArg ? new RegExp(filterArg.slice('--filter='.length)) : null;
const test = async (name, run) => {
  if (filter && !filter.test(name)) {
    return;
  }
  try {
    await run(); passed += 1; console.log(`PASS ${ name}`);
  } catch (error) {
    failed += 1; console.error(`FAIL ${ name }: ${ error.stack}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fresh = () => installDiagnostics({});
await test('RR1 retry/replace/delete failures use current state, history preserved', async () => {
  const t = fresh(); const other = fresh();
  t.settle(t.begin('a', 'old'), 'failed', '404');
  await assert.rejects(waitForReady(t), /404/);
  const token = t.begin('a', 'replacement');
  t.settle(token, 'succeeded');
  assert.equal((await waitForReady(t)).failed, 1);
  t.settle(t.begin('a', 'again'), 'failed', 'gone');
  t.cancelNode('a');
  assert.equal((await waitForReady(t)).failedAssets.length, 0);
  assert.equal(other.snapshot().failed, 0);
});
await test('stale attempts cannot settle newer attempt; unrelated failures survive cancellation', async () => {
  const t = fresh();
  const old = t.begin('a', 'asset'); const current = t.begin('a', 'asset');
  t.settle(old, 'failed', 'stale');
  assert.equal(t.snapshot().pending, 1);
  t.settle(current, 'succeeded'); t.settle(current, 'failed');
  t.settle(t.begin('b', 'bad'), 'failed', 'unrelated');
  t.cancelNode('a');
  await assert.rejects(waitForReady(t), /unrelated/);
  assert.equal(t.snapshot().succeeded, 1);
  assert.equal(t.snapshot().cancelled, 1);
});
await test('ready timeout/abort and listener cleanup', async () => {
  const t = fresh(); t.begin('a', 'asset');
  await assert.rejects(waitForReady(t, { timeoutMs: 5 }), /超时/);
  const controller = new AbortController();
  let balance = 0;
  const signal = {
    get aborted() {
      return controller.signal.aborted;
    },
    addEventListener(...a) {
      balance++; controller.signal.addEventListener(...a);
    },
    removeEventListener(...a) {
      balance--; controller.signal.removeEventListener(...a);
    },
  };
  const pending = waitForReady(t, { signal });
  controller.abort();
  await assert.rejects(pending, /中止/);
  assert.equal(balance, 0);
  t.cancelNode('a');
  const c = new AbortController();
  await waitForReady(t, { signal: c.signal });
  c.abort();
});
await test('page errors fail ready; sink detaches', async () => {
  globalThis.window = new EventTarget();
  const engine = {}; const sink = getPageErrorSink(engine);
  const event = new Event('error'); event.message = 'boot';
  window.dispatchEvent(event);
  await assert.rejects(waitForReady(installDiagnostics(engine)), /boot/);
  sink.detach(); window.dispatchEvent(event);
  assert.equal(sink.errors.length, 1);
  delete globalThis.window;
});
await test('RR5 real factory callback exception stays failed', async () => {
  const engine = { getInstance: async () => new THREE.Group() }; const t = installDiagnostics(engine);
  let object;
  const factory = makeAssetNodeFactory(
    { getObject: () => object, getVisual: () => null },
    engine, (id) => id, () => {
      throw new Error('onLoaded-broken');
    },
  );
  object = factory({ id: 'a', params: { assetId: 'asset' } });
  await sleep(0);
  await assert.rejects(waitForReady(t), /onLoaded-broken/);
  assert.equal(t.snapshot().succeeded, 0);
});
await test('SceneEngine subscribers survive legacy callback replacement', () => {
  const engine = new SceneEngine();
  let calls = 0;
  const off = engine.subscribeNodeEvent('removed', () => calls++);
  engine.registerFactory('Box', () => new THREE.Group());
  engine.applyFragment({ Box: [{ id: 'a' }] });
  engine.onNodeRemoved = () => {};
  engine.applyFragment({ remove: ['a'] });
  assert.equal(calls, 1);
  off();
});

await test('firstFrame marker runs only after successful render', () => {
  let tick; let rendered = false; let marked = 0;
  globalThis.ResizeObserver = class {
    observe() {} disconnect() {}
  };
  globalThis.requestAnimationFrame = (fn) => {
    tick = fn; return 1;
  };
  globalThis.cancelAnimationFrame = () => {};
  const loop = new RenderLoop({
    renderer: { domElement: {}, info: { render: { calls: 1, triangles: 1 } } },
    render() {
      if (!rendered) {
        throw new Error('render failed');
      }
    },
  }, { update() {} }, () => new THREE.Scene(), () => new THREE.Camera());
  try {
    const off = loop.onAfterFrame(() => {
      marked++; off();
    });
    loop.start();
    assert.throws(() => tick(), /render failed/);
    assert.equal(marked, 0);
    rendered = true; tick(); tick();
    assert.equal(marked, 1);
  } finally {
    loop.dispose();
    delete globalThis.ResizeObserver;
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  }
});

await test('synchronous asset URL error settles failure instead of leaving pending', async () => {
  const engine = {}; const t = installDiagnostics(engine);
  const factory = makeAssetNodeFactory({}, engine, () => {
    throw new Error('bad URL');
  });
  factory({ id: 'a', params: { assetId: 'bad' } });
  await sleep(0);
  await assert.rejects(waitForReady(t), /bad URL/);
  assert.equal(t.snapshot().pending, 0);
});

class Socket extends EventTarget {
  readyState = 1;
  send(text) {
    this.sent = JSON.parse(text); this.respond?.(this.sent);
  }

  emit(data) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  close() {
    this.readyState = 3; this.dispatchEvent(new Event('close'));
  }
}
await test('RR4 production RPC success/protocol error/send error/timeout/close cleanup', async () => {
  const ws = new Socket(); const c = createCdpConnection(ws, { rpcTimeoutMs: 8 });
  ws.respond = (msg) => ws.emit({ id: msg.id, result: {} });
  await c.rpc('ok'); assert.equal(c.pendingCount, 0);
  ws.respond = (msg) => ws.emit({ id: msg.id, error: { message: 'protocol' } });
  await assert.rejects(c.rpc('bad'), /protocol/);
  ws.respond = () => {
    throw new Error('send');
  };
  await assert.rejects(c.rpc('send'), /send/); assert.equal(c.pendingCount, 0);
  ws.respond = undefined;
  await assert.rejects(c.rpc('timeout'), /timeout/);
  const pending = assert.rejects(c.rpc('pending'), /closed/);
  await c.close(); await pending; await c.close();
  assert.equal(c.pendingCount, 0);
});
await test('RR3 collectors retain boot events before caller obtains session', async () => {
  const ws = new Socket(); const c = createCdpConnection(ws);
  ws.emit({ method: 'Runtime.exceptionThrown', params: { exceptionDetails: { text: 'boot' } } });
  ws.emit({ method: 'Runtime.consoleAPICalled', params: { type: 'error', args: [{ value: 'ordinary' }] } });
  ws.emit({ method: 'Network.responseReceived', params: { response: { status: 404, url: '/bad.glb' } } });
  assert.equal(collectPageErrors(c).length, 2);
  assert.equal(collectPageErrors(c, { favicon404Exempt: false }).length, 2);
  assert.equal(collectNetwork404s(c).length, 1);
  await c.close();
});
await test('automatic navigation failure kills browser once', async () => {
  const proc = new EventEmitter(); proc.exitCode = null; proc.signalCode = null;
  let killed = 0;
  proc.kill = () => {
    killed++; proc.signalCode = 'SIGTERM'; proc.emit('exit');
  };
  class AutoSocket extends Socket {
    constructor() {
      super(); queueMicrotask(() => this.dispatchEvent(new Event('open')));
    }

    send(text) {
      const msg = JSON.parse(text);
      if (msg.method === 'Page.navigate') {
        throw new Error('navigation send');
      }
      this.emit({ id: msg.id, result: {} });
    }
  }
  await assert.rejects(openBrowserSession({ url: 'http://test/' }, {
    spawn: () => proc,
    WebSocket: AutoSocket,
    fetch: async () => ({ json: async () => [{ id: 'a', type: 'page', webSocketDebuggerUrl: 'ws://test/' }] }),
  }), /navigation send/);
  assert.equal(killed, 1);
});
await test('bounded preflight cleanup', async () => {
  const proc = new EventEmitter(); proc.exitCode = null; proc.signalCode = null;
  let killed = 0;
  proc.kill = () => {
    killed++; proc.signalCode = 'SIGTERM'; proc.emit('exit');
  };
  const start = performance.now();
  await assert.rejects(openBrowserSession({ deadlineMs: 30 }, {
    spawn: () => proc,
    fetch: async (_url, { signal }) => new Promise((_resolve, reject) => {
      const keepAlive = setTimeout(() => reject(new Error('probe hung')), 1000);
      signal.addEventListener('abort', () => {
        clearTimeout(keepAlive); reject(signal.reason);
      }, { once: true });
    }),
  }), /unavailable/);
  assert.equal(killed, 1); assert.ok(performance.now() - start < 250);
});
await test('handshake timeout and spawn error close owned browser', async () => {
  for (const failSpawn of [false, true]) {
    const proc = new EventEmitter(); proc.exitCode = null; proc.signalCode = null;
    let killed = 0;
    proc.kill = () => {
      killed++; proc.signalCode = 'SIGTERM'; proc.emit('exit');
    };
    class NeverOpens extends Socket { }
    await assert.rejects(openBrowserSession({ deadlineMs: 30 }, {
      spawn: () => {
        if (failSpawn) {
          queueMicrotask(() => proc.emit('error', new Error('spawn failed')));
        }
        return proc;
      },
      WebSocket: NeverOpens,
      fetch: async () => ({ json: async () => failSpawn ? [] : [{ type: 'page', webSocketDebuggerUrl: 'ws://test/' }] }),
    }));
    assert.equal(killed, 1);
  }
});
await test('RR2 huge intersecting box passes; fully offscreen and behind fail against THREE', () => {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  cam.position.set(0, 10, 10); cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  const matrix = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(matrix);
  for (const box of [
    new THREE.Box3(new THREE.Vector3(-10000, -1, -10000), new THREE.Vector3(10000, 0, 10000)),
    new THREE.Box3(new THREE.Vector3(1000, 0, 0), new THREE.Vector3(1010, 10, 10)),
    new THREE.Box3(new THREE.Vector3(-1, 20, 20), new THREE.Vector3(1, 21, 21)),
  ]) {
    assert.equal(intersectsFrustumBox(box, matrix.elements), frustum.intersectsBox(box));
  }
});
await test('hidden/transparent subjects rejected; objects beyond first 20 considered', () => {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  cam.position.z = 10; cam.updateMatrixWorld();
  const root = new THREE.Group(); const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  root.add(mesh);
  const handle = {
    internals: {
      camera: cam,
      sceneEngine: {
        getAllIds: () => Array.from({ length: 21 }, (_, i) => String(i)),
        getObject: (id) => id === '20' ? root : null,
        getSkinnedAwareBox: (obj) => new THREE.Box3().setFromObject(obj),
      },
    },
  };
  assert.equal(inspectSubject(handle, intersectsFrustumBox).ok, true);
  root.visible = false; assert.equal(inspectSubject(handle, intersectsFrustumBox).ok, false);
  root.visible = true; mesh.material.transparent = true; mesh.material.opacity = 0;
  assert.equal(inspectSubject(handle, intersectsFrustumBox).ok, false);
});
await test('cross-group swaps and duplicate IDs fail; boolean argv preserves URL', () => {
  assert.equal(compareGroups({ A: ['a'], B: ['b'] }, { A: ['b'], B: ['a'] }).ok, false);
  assert.equal(compareGroups({ A: ['a', 'a'] }, { A: ['a'] }).ok, false);
  assert.equal(compareGroups({ A: ['a'] }, { A: ['a'] }).ok, true);
  assert.equal(positionalArg(['--edit', 'http://test/']), 'http://test/');
  assert.equal(positionalArg(['--out', 'shots', '--edit']), null);
});
await test('legacy ready is SKIP/INCONCLUSIVE, never strict PASS', async () => {
  const result = await waitReady(async () => false);
  assert.equal(result.status, 'SKIP');
  assert.equal(summarize([{ status: result.status }]), 'INCONCLUSIVE');
});

if (!process.argv.includes('--node-only')) {
  const i = process.argv.indexOf('--url');
  const url = i >= 0 ? process.argv[i + 1] : positionalArg(process.argv.slice(2)) ?? 'http://localhost:5199/';
  const expect = readExpect(join(template, 'public/scene-data.json'));
  let session;
  try {
    session = await openBrowserSession({ port: 9274 });
    await test('real run/edit share one browser; both basic contracts pass', async () => {
      const report = await verifyScene({
        url, mode: 'both', session, expect,
      });
      assert.equal(report.verdict, 'PASS', JSON.stringify(report));
      assert.deepEqual(report.reports.map((r) => r.mode), ['run', 'edit']);
    });
    // Boot fixture served outside template: never mutate scene-data or public files.
    const server = createServer((req, res) => {
      if (req.url !== '/') {
        res.writeHead(404); res.end('missing'); return;
      }
      res.setHeader('Content-Type', 'text/html');
      res.end('<script>console.error("boot-console");window.__gts3d={};throw Error("boot-sync")</script>'
        + '<script>Promise.reject(Error("boot-rejection"));fetch("/missing.glb")</script>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    try {
      await test('real immediate boot errors, rejection and 404 retained after automatic navigation', async () => {
        const page = await session.newPage({ url: `http://127.0.0.1:${ server.address().port }/` });
        try {
          const deadline = Date.now() + 2000;
          while (page.pageErrors.length < 3 || !page.netMisses.some((m) => m.includes('missing.glb'))) {
            assert.ok(Date.now() < deadline, JSON.stringify({ errors: page.pageErrors, misses: page.netMisses }));
            await sleep(30);
          }
          assert.ok(page.pageErrors.some((e) => e.includes('boot-sync')));
          assert.ok(page.pageErrors.some((e) => e.includes('boot-rejection')));
        } finally {
          await page.close();
        }
      });
    } finally {
      await new Promise((r) => server.close(r));
    }
    await test('real transparent/hidden/blocked canvas checks fail', async () => {
      const page = await session.newPage({ url });
      try {
        const baseline = await verifyPage(page, { mode: 'run', expect });
        assert.equal(baseline.verdict, 'PASS', JSON.stringify(baseline));
        for (const mutation of [
          'document.getElementById("scene-canvas").style.opacity="0"',
          'document.getElementById("scene-canvas").style.opacity="1"; document.getElementById("scene-canvas").parentElement.style.visibility="hidden"',
          'document.getElementById("scene-canvas").parentElement.style.visibility="visible";const o=document.createElement("div");o.style.cssText="position:fixed;inset:0;z-index:999999;background:white";document.body.append(o)',
        ]) {
          await page.evaluate(mutation);
          const report = await verifyPage(page, { mode: 'run', expect });
          assert.equal(report.checks.find((c) => c.id === 'canvas').status, 'FAIL');
        }
      } finally {
        await page.close();
      }
    });
    await test('real offscreen/hidden subjects, wrong groups and missing GLB fail', async () => {
      const page = await session.newPage({ url });
      try {
        assert.equal((await verifyPage(page, { mode: 'run', expect })).verdict, 'PASS');
        await page.evaluate('window.__gts3d.internals.camera.position.set(1e6,1e6,1e6);window.__gts3d.internals.camera.lookAt(2e6,2e6,2e6)');
        // Stop controls from restoring the camera while examining its deliberately bad position.
        await page.evaluate('window.__gts3d.internals.renderLoop.stop();window.__gts3d.internals.camera.position.set(1e6,1e6,1e6);window.__gts3d.internals.camera.lookAt(2e6,2e6,2e6)');
        let report = await verifyPage(page, { mode: 'run', expect });
        assert.equal(report.checks.find((c) => c.id === 'subject').status, 'FAIL');
        assert.equal(report.checks.find((c) => c.id === 'render').status, 'FAIL');
        await page.evaluate('for(const id of window.__gts3d.internals.sceneEngine.getAllIds()){window.__gts3d.internals.sceneEngine.getObject(id).visible=false;}');
        report = await verifyPage(page, { mode: 'run', expect: { hash: 'negative', idByGroup: { wrong: Object.values(expect.idByGroup).flat() } } });
        assert.equal(report.checks.find((c) => c.id === 'groups').status, 'FAIL');
        assert.equal(report.checks.find((c) => c.id === 'subject').status, 'FAIL');
        await page.evaluate('window.__gts3d.update({asset:[{id:"__p1_missing",params:{assetId:"__p1_missing.glb"}}]})');
        report = await verifyPage(page, { mode: 'run', expect });
        assert.equal(report.checks.find((c) => c.id === 'ready').status, 'FAIL');
        // Vite may return its HTML fallback with HTTP 200: loader failure is still a hard FAIL.
        const failures = await page.evaluate('window.__gts3d.getDiagnostics().failedAssets');
        assert.ok(failures.some((failure) => failure.nodeId === '__p1_missing'));
      } finally {
        await page.close();
      }
    });
  } catch (error) {
    failed++; console.error(error);
  } finally {
    await session?.close();
  }
}
console.log(JSON.stringify({ passed, failed }));
process.exitCode = failed ? 1 : 0;
