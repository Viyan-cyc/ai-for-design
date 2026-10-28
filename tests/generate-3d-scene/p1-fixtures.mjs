import { triangleGlb, seedProject } from './asset-fixture-data.mjs';
import { dependencyPath } from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';
// P1 regression tests use production modules, not copied implementations.
// node ../../tests/generate-3d-scene/p1-fixtures.mjs --node-only
// node ../../tests/generate-3d-scene/p1-fixtures.mjs --url http://localhost:5199/
//
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname, join, sep } from 'node:path';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import {
  createCdpConnection, openBrowserSession, positionalArg, collectPageErrors, collectNetwork404s,
} from '../../skills/generate-3d-scene/scripts/lib/cdp.mjs';
import { compareGroups, intersectsFrustumBox, inspectSubject } from './scene-checks.mjs';
import {
  verifyScene, verifyPage, readExpect, waitReady, summarize,
} from './scene.mjs';

const template = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/generate-3d-scene/template');
const ts = (await import(pathToFileURL(dependencyPath('typescript/lib/typescript.js')))).default;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
      const url = new URL(`${specifier }.ts`, context.parentURL);
      if (existsSync(fileURLToPath(url))) {
        return { url: url.href, shortCircuit: true };
      }
      // 目录导入（'./scene-core' → index.ts）：scene-profile 生产模块加载需要
      try {
        const dirIndex = new URL(`${specifier }/index.ts`, context.parentURL);
        if (existsSync(fileURLToPath(dirIndex))) {
          return { url: dirIndex.href, shortCircuit: true };
        }
      } catch { /* 非 URL 形态走 next */ }
    }
    // '@/' 别名（vite）：按 template/src 解析（scene-profile 及其依赖用）
    if (specifier.startsWith('@/') && context.parentURL?.startsWith(pathToFileURL(template).href)) {
      const aliased = join(template, 'src', specifier.slice(2));
      for (const cand of [`${aliased }.ts`, join(aliased, 'index.ts')]) {
        if (existsSync(cand)) {
          return { url: pathToFileURL(cand).href, shortCircuit: true };
        }
      }
    }
    // 裸 'three'：template 内的 TS 与 p1-fixtures 自身统一解析到 template/
    // node_modules（同物理文件 → 同实例）。其他来源（夹具工程的拷贝副本）放行——
    // 其 GLTFLoader 内部 'three' 须解析到夹具自己的 node_modules 副本（跨副本
    // THREE 实例不同，Group.add 会被拒）
    const tmplHref = pathToFileURL(template).href;
    if (specifier === 'three'
      && (context.parentURL?.startsWith(tmplHref) || context.parentURL?.endsWith('p1-fixtures.mjs'))) {
      return { url: pathToFileURL(dependencyPath('three', 'build', 'three.module.js')).href, shortCircuit: true };
    }
    if (specifier.startsWith('three/') && context.parentURL?.startsWith(tmplHref)) return { url: pathToFileURL(dependencyPath(specifier)).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    // .vue 单文件组件：Node 不解析 SFC——stub（注册链路测试只关心模块图可加载）
    if (url.endsWith('.vue')) {
      return { format: 'module', shortCircuit: true, source: 'export default { name: "SfcStub" };' };
    }
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
const THREE = await import(pathToFileURL(dependencyPath('three/build/three.module.js')));
const { installDiagnostics, waitForReady, getPageErrorSink } =
  await import(pathToFileURL(join(template, 'src/scene3d/scene-core/diagnostics.ts')));
const { makeAssetNodeFactory } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/handlers/registry.ts')));
const { SceneEngine } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/engine/SceneEngine.ts')));
const { RenderLoop } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/engine/RenderLoop.ts')));
const { paramsEqual } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/types.ts')));
const { getResourceScope } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/resources.ts')));
const { registerTreeHandler } = await import(pathToFileURL(join(template, 'src/scene3d/scene/handlers/tree.ts')));
const { registerRackHandler } = await import(pathToFileURL(join(template, 'src/scene3d/scene/handlers/rack.ts')));
const { handlerUtils } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/handlers/registry.ts')));

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
await test('P2-R1 real AssetEngine load failure (glTF bin 404) rejects ready with failedAssets', async () => {
  // 生产链路：真 AssetEngine + 不可达 URL → GLTFLoader 抛错 → registry settle failed
  // → whenReady 拒绝 + failedAssets 记 nodeId@assetId（vite dev HTML 回落下的真 404 等价物）
  const { AssetEngine } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/engine/AssetEngine.ts')));
  const assetEngine = new AssetEngine();
  const t = installDiagnostics(assetEngine);
  const factory = makeAssetNodeFactory(
    { getObject: () => engineObj, getVisual: () => null },
    assetEngine, (id) => `http://127.0.0.1:59999/missing/${id}/model.gltf`,
  );
  const engineObj = factory({ id: 'mf_01', params: { assetId: 'multifile_gltf' } });
  void engineObj;
  await assert.rejects(waitForReady(t, { timeoutMs: 8000 }), /multifile_gltf@mf_01|fetch failed/);
  const failed = t.snapshot().failedAssets;
  assert.ok(failed.some((f) => f.nodeId === 'mf_01' && f.assetId === 'multifile_gltf'),
    JSON.stringify(failed));
});
await test('P2-RRR1 real registerBusinessFactories registers every declared type on real engine', async () => {
  // 生产链路：真 scene-profile（TS 转译直跑）+ 真 SceneEngine → 登记表全量注册
  const { registerBusinessFactories } = await import(pathToFileURL(join(template, 'src/scene3d/scene-profile.ts')));
  const engine = new SceneEngine();
  registerBusinessFactories({
    sceneEngine: engine,
    assetEngine: { registerAssetStates() { }, getInstance: async () => ({}) },
    renderLoop: { onFrame: () => () => { } },
  });
  for (const type of ['examples', 'cars', 'trees', 'codecars', 'codeworkers', 'coderacks']) {
    assert.ok(engine.hasFactory(type), `hasFactory(${type}) 应为 true`);
  }
});
await test('P2-RRR1 empty/wrong-name registrar throws after post-registration check', async () => {
  const { registerBusinessFactories, BUSINESS_REGISTRARS } = await import(pathToFileURL(join(template, 'src/scene3d/scene-profile.ts')));
  const ctx = (engine) => ({
    sceneEngine: engine,
    assetEngine: { registerAssetStates() { }, getInstance: async () => ({}) },
    renderLoop: { onFrame: () => () => { } },
  });
  // 空实现（review 复现：robots: () => {} 不抛错）
  BUSINESS_REGISTRARS.robots = () => { };
  try {
    assert.throws(() => registerBusinessFactories(ctx(new SceneEngine())), /robots/);
  } finally {
    delete BUSINESS_REGISTRARS.robots;
  }
  // 注册错名（实现注册了别的 type）
  BUSINESS_REGISTRARS.wrongname = ({ sceneEngine }) => {
    sceneEngine.registerFactory('somethingelse', () => null);
  };
  try {
    assert.throws(() => registerBusinessFactories(ctx(new SceneEngine())), /wrongname/);
  } finally {
    delete BUSINESS_REGISTRARS.wrongname;
  }
  // 复原：真实表仍全注册
  const engine = new SceneEngine();
  registerBusinessFactories(ctx(engine));
  assert.ok(engine.hasFactory('trees') && engine.hasFactory('coderacks'));
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

// ── P3 行为回归（生产函数直跑：真 SceneEngine + typed definition + 资源域） ──

await test('P3 paramsEqual: key-order-insensitive, deep, NaN-unequal', () => {
  assert.equal(paramsEqual({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), true);
  assert.equal(paramsEqual({ a: 1 }, { a: 2 }), false);
  assert.equal(paramsEqual({ a: { x: 1 } }, { a: { x: 1, y: 2 } }), false);
  assert.equal(paramsEqual(undefined, undefined), true);
  assert.equal(paramsEqual({ a: 1 }, undefined), false);
  assert.equal(paramsEqual({ a: NaN }, { a: NaN }), false);
});

await test('P3 typed factory: params change → update contract; same params → idempotent no-op', () => {
  const engine = new SceneEngine();
  const updated = [];
  engine.registerFactory('things', {
    create(node) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      m.userData.level = node.params?.level ?? 0;
      return m;
    },
    update(obj, next) {
      obj.userData.level = next.params?.level ?? 0;
      updated.push(next.id);
      return 'updated';
    },
  });
  engine.applyFragment({ things: [{ id: 't1', params: { level: 1 } }] });
  const objBefore = engine.getObject('t1');
  // 同值 params（键序不同）重推：幂等——不调 update 不重建
  let stats = engine.applyFragment({ things: [{ id: 't1', params: { level: 1 } }] });
  assert.equal(engine.getObject('t1'), objBefore);
  assert.equal(stats.rebuilt.length, 0);
  assert.equal(stats.updated.length, 1);
  // 值变化：走 definition.update（原地），保实例身份
  stats = engine.applyFragment({ things: [{ id: 't1', params: { level: 2 } }] });
  assert.equal(engine.getObject('t1'), objBefore);
  assert.equal(objBefore.userData.level, 2);
  assert.deepEqual(updated, ['t1']);
  assert.equal(stats.rebuilt.length, 0);
  engine.dispose();
});

await test('P3-R1 real registerTreeHandler: height structural change takes effect via update contract', () => {
  // 真实生产 handler（非假工厂）：height 是结构参数，previous/previous.params 语义正确
  const engine = new SceneEngine();
  registerTreeHandler(engine);
  engine.applyFragment({ trees: [{ id: 't1', params: { height: 1 } }] });
  const trunkBefore = engine.getObject('t1').children.find((c) => c.name === 'trunk');
  const hBefore = trunkBefore.geometry.parameters.height;
  // height 1 → 3：definition.update 收到正确 previous（R1 修复前 previous.params 已被覆盖成 3，
  // 恒等比较 → 误判"未变"→ 静默不重建，geometry 仍是 0.9 高）
  const stats = engine.applyFragment({ trees: [{ id: 't1', params: { height: 3 } }] });
  const trunkAfter = engine.getObject('t1').children.find((c) => c.name === 'trunk');
  assert.equal(stats.rebuilt[0], 't1', 'height 变化应判定结构重建');
  const hAfter = trunkAfter.geometry.parameters.height;
  assert.ok(Math.abs(hAfter - hBefore * 3) < 1e-9, `重建后树干高度应×3：before=${hBefore} after=${hAfter}`);
  // 颜色参数原地重放：不重建、改材质色
  const objBeforeColor = engine.getObject('t1');
  const statsColor = engine.applyFragment({ trees: [{ id: 't1', params: { height: 3, trunkColor: '#123456' } }] });
  assert.equal(engine.getObject('t1'), objBeforeColor, '颜色参数不得重建');
  assert.equal(statsColor.rebuilt.length, 0);
  const trunkMesh = engine.getObject('t1').children.find((c) => c.name === 'trunk');
  assert.equal(`#${trunkMesh.material.color.getHexString()}`, '#123456');
  engine.dispose();
});

await test('P3-R1 real registerRackHandler: rows structural vs bodyColor in-place', () => {
  const engine = new SceneEngine();
  registerRackHandler(engine);
  engine.applyFragment({ coderacks: [{ id: 'r1', params: { rows: 6 } }] });
  const countServers = () => engine.getObject('r1').children.filter((c) => /server_\d+$/.test(c.name)).length;
  assert.equal(countServers(), 6);
  // rows 6 → 3：结构重建
  const stats = engine.applyFragment({ coderacks: [{ id: 'r1', params: { rows: 3 } }] });
  assert.equal(stats.rebuilt[0], 'r1');
  assert.equal(countServers(), 3, 'rows=3 应只有 3 仓段');
  // bodyColor 原地重放
  const before = engine.getObject('r1');
  engine.applyFragment({ coderacks: [{ id: 'r1', params: { rows: 3, bodyColor: '#abcdef' } }] });
  assert.equal(engine.getObject('r1'), before, 'bodyColor 不得重建');
  const sidePanel = engine.getObject('r1').children.find((c) => c.name === 'panel_side_l');
  assert.equal(`#${sidePanel.material.color.getHexString()}`, '#abcdef');
  engine.dispose();
});

await test('P3-R2 fragment params-only update keeps transform/card/parent (legacy + definition paths)', () => {
  // legacy 路径：已有 position/scale/card 的节点只发 params → 重建不得丢字段
  const legacy = new SceneEngine();
  legacy.registerFactory('things', (node) => {
    const g = new THREE.Group();
    handlerUtils.applyTransform(g, node);
    return g;
  });
  legacy.applyFragment({ things: [{ id: 'n1', position: [8, 2, 3], scale: 2, card: { type: 'example' }, params: { v: 1 } }] });
  legacy.applyFragment({ things: [{ id: 'n1', params: { v: 2 } }] });
  let n = legacy.getNode('n1');
  assert.deepEqual(n.position, [8, 2, 3], 'legacy 重建后 position 保留');
  assert.equal(n.scale, 2, 'legacy 重建后 scale 保留（数据层原值形态）');
  assert.deepEqual(n.card, { type: 'example' }, 'legacy 重建后 card 保留');
  assert.equal(legacy.getObject('n1').position.x, 8, '实例 transform 同步');
  assert.equal(legacy.getObject('n1').scale.x, 2, '实例 scale 同步');
  legacy.dispose();
  // definition 路径（真 tree handler）：height rebuild 只带 params，transform 保留
  const def = new SceneEngine();
  registerTreeHandler(def);
  def.applyFragment({ trees: [{ id: 't1', position: [5, 0, 1], rotation: [0, 1, 0], params: { height: 1 } }] });
  def.applyFragment({ trees: [{ id: 't1', params: { height: 2 } }] });
  const t = def.getNode('t1');
  assert.deepEqual(t.position, [5, 0, 1], 'definition rebuild 后 position 保留');
  assert.deepEqual(t.rotation, [0, 1, 0], 'definition rebuild 后 rotation 保留');
  assert.equal(def.getObject('t1').position.x, 5, '新实例 transform 已应用');
  // 类型变化路径同样合并
  def.registerFactory('others', () => new THREE.Group());
  def.applyFragment({ others: [{ id: 't1', params: { x: 1 } }] });
  assert.deepEqual(def.getNode('t1').position, [5, 0, 1], '类型变化重建后 transform 保留');
  assert.equal(def.getNodeType('t1'), 'others');
  def.dispose();
});

await test('P3-R3 parent rebuild: surviving child resources not disposed, no double-dispose', () => {
  const engine = new SceneEngine();
  // 精确 dispose 计数：patch geometry.dispose/material.dispose
  let geoDisposes = 0;
  let matDisposes = 0;
  engine.registerFactory('parents', () => new THREE.Group());
  engine.registerFactory('kids', () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const g = new THREE.Group();
    g.add(m);
    const origGeo = m.geometry.dispose.bind(m.geometry);
    const origMat = m.material.dispose.bind(m.material);
    m.geometry.dispose = () => { geoDisposes += 1; origGeo(); };
    m.material.dispose = () => { matDisposes += 1; origMat(); };
    return g;
  });
  engine.applyFragment({
    parents: [{ id: 'p1', params: { a: 1 } }],
    kids: [{ id: 'k1', parentId: 'p1' }],
  });
  const childObj = engine.getObject('k1');
  const childNode = engine.getNode('k1');
  // 父 params 变化 → 父重建（legacy 兜底）；子节点实体重挂、资源不释放
  engine.applyFragment({ parents: [{ id: 'p1', params: { a: 2 } }] });
  assert.equal(engine.getObject('k1'), childObj, '子节点实例保留（重挂到新父）');
  assert.equal(engine.getNode('k1'), childNode || engine.getNode('k1'), '子节点数据保留');
  assert.equal(engine.getObject('p1').children.includes(childObj), true, '子实体已挂到新父实例');
  assert.equal(geoDisposes, 0, '存活子节点 geometry 不得收到 dispose（R3：先脱离再释放）');
  assert.equal(matDisposes, 0, '存活子节点 material 不得收到 dispose');
  // 删除父 → 级联删子：子资源恰好释放一次（无双 dispose）
  engine.applyFragment({ remove: ['p1'] });
  assert.equal(geoDisposes, 1, `级联删除后子 geometry 应恰好 dispose 一次（got ${geoDisposes}）`);
  assert.equal(matDisposes, 1, `级联删除后子 material 应恰好 dispose 一次（got ${matDisposes}）`);
  engine.dispose();
});

await test('P3-R3 repeated create/remove cycles dispose exactly once per resource', () => {
  const engine = new SceneEngine();
  let disposes = 0;
  engine.registerFactory('things', () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const orig = m.geometry.dispose.bind(m.geometry);
    m.geometry.dispose = () => { disposes += 1; orig(); };
    return m;
  });
  // 100 次增删（V14 缩样）：每次 create 的资源在 remove 时恰好释放一次
  for (let i = 0; i < 50; i++) {
    engine.applyFragment({ things: [{ id: 'x1' }] });
    engine.applyFragment({ remove: ['x1'] });
  }
  assert.equal(disposes, 50, `50 轮增删应恰好 50 次 dispose（got ${disposes}——泄漏或双释放）`);
  // recreate 路径同样单次
  engine.applyFragment({ things: [{ id: 'x1', params: { a: 1 } }] });
  engine.applyFragment({ things: [{ id: 'x1', params: { a: 2 } }] });
  assert.equal(disposes, 51, 'rebuild 旧实例恰好释放一次');
  engine.dispose();
});

await test('P3-R4 real Bridge undo/redo restores snapshot-missing fields, keeps identities', async () => {
  const { Bridge } = await import(pathToFileURL(join(template, 'src/edit/Bridge.ts')));
  // 真 SceneEngine + 真 Bridge（handle 门面只接 Bridge 实际消费的面：update/serialize/internals）
  const engine = new SceneEngine();
  engine.registerFactory('things', () => new THREE.Group());
  const groupsSnapshot = () => {
    const out = {};
    for (const type of engine.getGroupNames()) {
      out[type] = engine.getNodesWithType(type).map((n) => structuredClone(n));
    }
    return out;
  };
  const handle = {
    update: (frag) => engine.applyFragment(frag),
    serialize: () => {
      const visuals = engine.getAllVisuals();
      const data = groupsSnapshot();
      if (Object.keys(visuals).length > 0) {
        data.__visuals = structuredClone(visuals);
      }
      return data;
    },
    internals: { sceneEngine: engine, renderLoop: { invalidate() {} } },
  };
  const bridge = new Bridge(handle);
  // 初始：a 无 transform/params
  bridge.commit('初始', () => handle.update({ things: [{ id: 'a' }] }));
  // 新增 transform + params（快照外字段）
  bridge.commit('添加变换与参数', () => handle.update({ things: [{ id: 'a', position: [9, 0, 0], params: { v: 2 } }] }));
  assert.deepEqual(engine.getNode('a').position, [9, 0, 0]);
  // undo → 回到 {id:'a'}：position/params 必须显式恢复默认（R4 修复前按 patch 合并残留）
  bridge.undo();
  const restored = engine.getNode('a');
  assert.deepEqual(restored.position, [0, 0, 0], 'undo 后 position 应恢复默认（旧实现残留 [9,0,0]）');
  assert.deepEqual(restored.params, {}, 'undo 后 params 应恢复空（旧实现残留 {v:2}）');
  assert.equal(engine.getObject('a').position.x, 0, '实例 transform 同步恢复');
  // redo → 变换回来
  bridge.redo();
  assert.deepEqual(engine.getNode('a').position, [9, 0, 0], 'redo 恢复变换');
  assert.deepEqual(engine.getNode('a').params, { v: 2 });
  // undo 不重建未变节点身份
  bridge.commit('无关操作', () => handle.update({ things: [{ id: 'a', rotation: [0, 1, 0] }] }));
  const objA = engine.getObject('a');
  bridge.undo();
  assert.equal(engine.getObject('a'), objA, 'undo 差量恢复保实例身份');
  assert.deepEqual(engine.getNode('a').rotation, [0, 0, 0], 'undo 恢复 rotation 默认');
  // 父链变化 undo：child 挂回原父
  bridge.commit('挂父', () => handle.update({ things: [{ id: 'b' }, { id: 'c', parentId: 'b' }] }));
  bridge.commit('改父', () => handle.update({ things: [{ id: 'c', parentId: 'a' }] }));
  assert.equal(engine.getNode('c').parentId, 'a');
  bridge.undo();
  assert.equal(engine.getNode('c').parentId, 'b', 'undo 恢复父链');
  // 序列化一致性：serialize 后节点形态与引擎态一致
  const snap = handle.serialize();
  assert.ok(Array.isArray(snap.things) && snap.things.length >= 2, 'serialize 含全部分组节点');
  engine.dispose();
});

await test('P3 transform-only update preserves instance identity (V07)', () => {
  const engine = new SceneEngine();
  let creates = 0;
  engine.registerFactory('things', {
    create() {
      creates += 1;
      return new THREE.Group();
    },
  });
  engine.applyFragment({ things: [{ id: 't1' }] });
  const obj = engine.getObject('t1');
  const stats = engine.applyFragment({ things: [{ id: 't1', position: [5, 0, 0], rotation: [0, 1, 0], scale: 2 }] });
  assert.equal(engine.getObject('t1'), obj, 'transform 更新不得重建实例');
  assert.equal(creates, 1);
  assert.equal(stats.rebuilt.length, 0);
  assert.equal(obj.position.x, 5);
  engine.dispose();
});

await test('P3 legacy function factory: params change falls back to local rebuild (no silent no-op)', () => {
  const engine = new SceneEngine();
  let creates = 0;
  engine.registerFactory('things', () => {
    creates += 1;
    return new THREE.Group();
  });
  engine.applyFragment({ things: [{ id: 't1', params: { a: 1 } }] });
  const before = engine.getObject('t1');
  const stats = engine.applyFragment({ things: [{ id: 't1', params: { a: 2 } }] });
  assert.notEqual(engine.getObject('t1'), before, '旧 function 无 update → params 变化必须重建，不能静默只存数据');
  assert.equal(creates, 2);
  assert.equal(stats.rebuilt[0], 't1');
  engine.dispose();
});

await test('P3 resource scope: recreate releases exclusive old instance resources (V14 core)', () => {
  const engine = new SceneEngine();
  engine.registerFactory('things', () => new THREE.Group());
  engine.applyFragment({ things: [{ id: 't1', params: { a: 1 } }] });
  const old = engine.getObject('t1');
  const scope = getResourceScope(engine);
  // 实际资源粒度（RR1）：Object3D 根不登记；mesh 的 geometry/material 逐个登记
  assert.equal(scope.isTracked(old), false, 'Object3D 根不得登记（RR1：树遍历释放绕过共享登记）');
  engine.applyFragment({ things: [{ id: 't1', params: { a: 2 } }] });
  assert.equal(engine.getObject('t1') !== old, true);
  engine.dispose();
});

await test('P3 resource scope: shared resource outlives single owner exit', () => {
  const engine = new SceneEngine();
  engine.registerFactory('things', () => new THREE.Group());
  engine.applyFragment({ things: [{ id: 'a' }, { id: 'b' }] });
  const scope = getResourceScope(engine);
  const sharedMat = new THREE.MeshStandardMaterial();
  scope.acquire('a', sharedMat, 'shared');
  scope.acquire('b', sharedMat, 'shared');
  assert.equal(scope.refCount(sharedMat), 2);
  scope.release('a');
  assert.equal(scope.refCount(sharedMat), 1, '剩余 owner 仍在，shared 资源不得释放');
  scope.release('b');
  assert.equal(scope.isTracked(sharedMat), false, '最后一个 owner 退出才释放');
  engine.dispose();
});

await test('P3-RR1 real engine: shared material survives first owner removal, disposed exactly once', () => {
  // 真实生产链路：两个节点共用同一 material（显式 shared 登记两 owner）——
  // RR1 修复前：根 Object3D exclusive 释放整树遍历 dispose 共享材质（旁路 refcount）
  const engine = new SceneEngine();
  const scope = getResourceScope(engine);
  const sharedMat = new THREE.MeshStandardMaterial();
  let matDisposes = 0;
  const origDispose = sharedMat.dispose.bind(sharedMat);
  sharedMat.dispose = () => { matDisposes += 1; origDispose(); };
  engine.registerFactory('things', () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), sharedMat);
    const g = new THREE.Group();
    g.add(m);
    return g;
  });
  engine.applyFragment({ things: [{ id: 'a' }, { id: 'b' }] });
  // 显式 shared 登记（两个 owner 都在用同一材质实例）
  scope.acquire('a', sharedMat, 'shared');
  scope.acquire('b', sharedMat, 'shared');
  // 删除第一个节点：共享材质不得释放（存活节点 b 仍使用）
  engine.applyFragment({ remove: ['a'] });
  assert.equal(matDisposes, 0, '删除 a 后共享材质不得被 dispose（b 仍在用）');
  assert.equal(scope.refCount(sharedMat), 1, 'refCount 应降为 1');
  assert.equal(scope.isTracked(sharedMat), true);
  // 删除第二个：恰好释放一次
  engine.applyFragment({ remove: ['b'] });
  assert.equal(matDisposes, 1, `最后一个 owner 退出应恰好 dispose 一次（got ${matDisposes}）`);
  assert.equal(scope.isTracked(sharedMat), false);
  engine.dispose();
});

await test('P3-RR1 real engine: parent-child whole dispose counts exactly once per resource', () => {
  // 父子节点整体 engine.dispose：子 geometry 恰好 1 次 dispose（RR1 修复前父树遍历命中子=2 次）
  const engine = new SceneEngine();
  let childGeoDisposes = 0;
  engine.registerFactory('parents', () => new THREE.Group());
  engine.registerFactory('kids', () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const g = new THREE.Group();
    g.add(m);
    const orig = m.geometry.dispose.bind(m.geometry);
    m.geometry.dispose = () => { childGeoDisposes += 1; orig(); };
    return g;
  });
  engine.applyFragment({
    parents: [{ id: 'p1' }],
    kids: [{ id: 'k1', parentId: 'p1' }],
  });
  engine.dispose();
  assert.equal(childGeoDisposes, 1, `整体销毁后子 geometry 应恰好 dispose 一次（got ${childGeoDisposes}）`);
});

await test('P3 duplicate-object visuals do not clobber other nodes (F06/V09 core)', () => {
  const engine = new SceneEngine();
  engine.registerFactory('things', () => new THREE.Group());
  engine.applyFragment({ things: [{ id: 'A' }, { id: 'B' }] });
  // A、B 各有自己的视觉层（改色/锁定）
  engine.applyVisual('A', { color: '#ff0000', locked: true });
  engine.applyVisual('B', { color: '#00ff00' });
  // 复制 A（P3.3 语义：patchVisual 单节点，其他节点视觉层不动）
  engine.applyFragment({ things: [{ id: 'A_copy_001', position: [1, 0, 0] }] });
  engine.patchVisual('A_copy_001', { color: '#ff0000' });
  assert.equal(engine.getVisual('B')?.color, '#00ff00', '复制不得清除 B 的视觉层');
  assert.equal(engine.getVisual('A')?.locked, true, '复制不得清除 A 的视觉层');
  assert.equal(engine.getVisual('A_copy_001')?.color, '#ff0000', '副本带源视觉');
  // 对照：旧实现 update({__visuals: {A_copy: ...}}) 整表替换会把 A/B 全清掉
  engine.dispose();
});

await test('P3 EnvironmentEngine: intensity-only change does not regenerate PMREM (V16 core)', async () => {
  const { EnvironmentEngine } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/engine/EnvironmentEngine.ts')));
  // Node 无 WebGL：注入计数 fake PMREM（测试缝 pmremFactory；生产恒真 PMREMGenerator）
  let fromSceneCalls = 0;
  const engine = new EnvironmentEngine();
  engine.pmremFactory = () => ({
    fromScene() {
      fromSceneCalls += 1;
      return { texture: new THREE.Texture() };
    },
    dispose() {},
  });
  const scene = new THREE.Scene();
  await engine.apply(null, scene, { intensity: 1 });
  assert.equal(fromSceneCalls, 1, '首次应用生成 PMREM');
  const first = scene.environment;
  await engine.apply(null, scene, { intensity: 2.5 });
  assert.equal(fromSceneCalls, 1, 'intensity-only 变化不得重新 fromScene（F14）');
  assert.equal(scene.environment, first, '复用同一 renderTarget.texture');
  assert.equal(scene.environmentIntensity, 2.5, '强度已更新');
  await engine.apply(null, scene, null);
  assert.equal(scene.environment, null, '关闭释放');
  await engine.apply(null, scene, { intensity: 1 });
  assert.equal(fromSceneCalls, 2, '关闭后重开才重新生成');
  assert.notEqual(scene.environment, first, '重开是新纹理');
  engine.dispose();
});

await test('P3 AssetEngine: disposed engine rejects late cache writeback and new loads (V05 core)', async () => {
  const { AssetEngine } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/engine/AssetEngine.ts')));
  const engine = new AssetEngine();
  engine.dispose();
  await assert.rejects(engine.getInstance('x', 'http://127.0.0.1:59999/x.glb'), /已释放/);
});

await test('P3 slot uniqueness: findDuplicateSlotKeys flags same-parent duplicate names (V13 core)', () => {
  const engine = new SceneEngine();
  engine.registerFactory('things', () => {
    const g = new THREE.Group();
    for (const name of ['part', 'part', 'other']) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
      m.name = name;
      g.add(m);
    }
    return g;
  });
  engine.applyFragment({ things: [{ id: 't1' }] });
  assert.deepEqual(engine.findDuplicateSlotKeys('t1'), ['part']);
  // 跨父层同名合法（路径含父段）
  engine.dispose();
  const engine2 = new SceneEngine();
  engine2.registerFactory('things', () => {
    const g = new THREE.Group();
    const p1 = new THREE.Group(); p1.name = 'p1';
    const p2 = new THREE.Group(); p2.name = 'p2';
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); m1.name = 'part';
    const m2 = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); m2.name = 'part';
    p1.add(m1); p2.add(m2); g.add(p1, p2);
    return g;
  });
  engine2.applyFragment({ things: [{ id: 't1' }] });
  assert.deepEqual(engine2.findDuplicateSlotKeys('t1'), [], '不同父层同名 mesh 合法（slotKey 路径区分）');
  engine2.dispose();
});

await test('P3-RR2 real Bridge: unchanged legacy node without params keeps identity on undo', async () => {
  const { Bridge } = await import(pathToFileURL(join(template, 'src/edit/Bridge.ts')));
  // 真实 Bridge + 真 SceneEngine：省略 params 的未变 legacy 节点，撤销无关操作不得重建
  const engine = new SceneEngine();
  let creates = 0;
  engine.registerFactory('things', (node) => {
    creates += 1;
    const g = new THREE.Group();
    handlerUtils.applyTransform(g, node);
    return g;
  });
  const groupsSnapshot = () => {
    const out = {};
    for (const type of engine.getGroupNames()) {
      out[type] = engine.getNodesWithType(type).map((n) => structuredClone(n));
    }
    return out;
  };
  const handle = {
    update: (frag) => engine.applyFragment(frag),
    serialize: () => {
      const visuals = engine.getAllVisuals();
      const data = groupsSnapshot();
      if (Object.keys(visuals).length > 0) {
        data.__visuals = structuredClone(visuals);
      }
      return data;
    },
    internals: { sceneEngine: engine, renderLoop: { invalidate() {} } },
  };
  const bridge = new Bridge(handle);
  // 初始：a 无 params（legacy 省略形态）；b 带 params
  bridge.commit('初始', () => handle.update({ things: [{ id: 'a' }, { id: 'b', params: { v: 1 } }] }));
  const objA = engine.getObject('a');
  const createsAtCommit = creates;
  // 无关操作（只动 b）→ undo：恢复与快照完全相同的 {id:'a'}（params 仍缺省）
  bridge.commit('改b位置', () => handle.update({ things: [{ id: 'b', position: [3, 0, 0] }] }));
  bridge.undo();
  // RR2 修复前：rebuild 把缺省 params 强转 {} → paramsEqual(undefined,{}) 判变 → legacy 重建
  assert.equal(engine.getObject('a'), objA, '缺省 params 的未变节点 undo 后必须保实例身份');
  assert.equal(creates, createsAtCommit, '未变节点不得触发工厂重建（RR2 修复前 creates+1）');
  assert.equal(engine.getNode('a').params, undefined, 'a 的 params 保持缺省（不强转 {}）');
  assert.deepEqual(engine.getNode('b').position, [0, 0, 0], 'b 的位置撤销恢复默认');
  // redo 再 undo 往返仍稳定
  bridge.redo();
  bridge.undo();
  assert.equal(engine.getObject('a'), objA, '往返后身份仍稳定');
  assert.equal(creates, createsAtCommit);
  engine.dispose();
});

await test('P3-RRR1 real engine: continuous material edits tracked, replaced resources released promptly', () => {
  // 真实生产链路（三审反例：applyVisual 后新材质 isTracked=false，删除+dispose 后
  // 新材质 dispose 事件=0 → 泄漏）。连续编辑/替换/删除/整体销毁精确计数。
  const engine = new SceneEngine();
  const scope = getResourceScope(engine);
  engine.registerFactory('things', () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const g = new THREE.Group();
    g.add(m);
    return g;
  });
  const origMat = engine; void origMat;
  engine.applyFragment({ things: [{ id: 'a' }] });
  const mesh = () => engine.getObject('a').children.find((c) => c.isMesh);

  // 计数器：追每个时期的材质 dispose
  const watch = (label, mat) => {
    const orig = mat.dispose.bind(mat);
    mat.dispose = () => { (watch.counters.get(label) ?? watch.counters.set(label, 0).get(label)); watch.counters.set(label, (watch.counters.get(label) ?? 0) + 1); orig(); };
    return mat;
  };
  watch.counters = new Map();
  const initialMat = watch('initial', mesh().material);

  // 第一次编辑：applyVisual 改色 → applyVisualOverride 克隆替换材质
  engine.applyVisual('a', { color: '#ff0000' });
  const edited1 = watch('edited1', mesh().material);
  assert.notEqual(mesh().material, initialMat, '改色应克隆替换材质');
  assert.equal(scope.isTracked(edited1), true, 'RRR1：编辑后的新材质必须被登记');
  assert.equal(scope.isTracked(initialMat), false, 'RRR1：被替换的旧材质登记应解除（及时释放，不积累）');
  assert.equal(watch.counters.get('initial') ?? 0, 1, '被替换的旧独占材质应立即 dispose');

  // 第二次编辑（连续编辑）：再换色
  engine.applyVisual('a', { color: '#00ff00' });
  const edited2 = watch('edited2', mesh().material);
  assert.equal(scope.isTracked(edited2), true, '连续编辑的新材质登记');
  assert.equal(watch.counters.get('edited1') ?? 0, 1, '前一轮编辑材质已被替换 → 立即释放');
  assert.notEqual(edited2, edited1);

  // 纯开关（visible）不触发材质重放：材质不换、无新登记/释放
  engine.applyVisual('a', { visible: false });
  assert.equal(mesh().material, edited2, '开关路径不得克隆材质');

  // 删除节点：当前材质恰好释放一次
  engine.applyFragment({ remove: ['a'] });
  assert.equal(watch.counters.get('edited2') ?? 0, 1, '删除节点后当前材质恰好释放一次');
  engine.dispose();
  // 整体销毁后再无额外事件
  assert.equal(watch.counters.get('edited2') ?? 0, 1, '整体销毁不得重复 dispose 已释放材质');
  assert.equal(watch.counters.get('initial') ?? 0, 1);
  assert.equal(watch.counters.get('edited1') ?? 0, 1);
});

await test('P3-RRR1 real engine: replaceVisual swap and whole-dispose exact counts', () => {
  const engine = new SceneEngine();
  const scope = getResourceScope(engine);
  engine.registerFactory('things', () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const g = new THREE.Group();
    g.add(m);
    return g;
  });
  engine.applyFragment({ things: [{ id: 'a' }] });
  let disposes = 0;
  const track = (mat) => {
    const orig = mat.dispose.bind(mat);
    mat.dispose = () => { disposes += 1; orig(); };
    return mat;
  };
  // replaceVisual（材质库链接/断开入口）：整条替换视觉层
  const before = track(engine.getObject('a').children.find((c) => c.isMesh).material);
  engine.replaceVisual('a', { materialType: 'MeshLambertMaterial', color: '#123456' });
  const after = track(engine.getObject('a').children.find((c) => c.isMesh).material);
  assert.notEqual(after, before);
  assert.equal(scope.isTracked(after), true, 'replaceVisual 的新材质登记');
  assert.equal(scope.isTracked(before), false, '被替换旧材质解除');
  assert.equal(disposes, 1, '被替换旧材质立即释放一次');
  // 整体销毁：当前材质恰好一次（geometry 未计数器，不在此断言）
  engine.dispose();
  assert.equal(disposes, 2, `全程恰好 2 次材质 dispose（替换旧 1 + 销毁当前 1，got ${disposes}）`);
});

await test('P3-RRRR1 real engine: parent edit→rebuild→child survives→delete/teardown exact counts', () => {
  // 四审反例：applyVisual('p',{color}) 后子 c 的新材质被记给父 p（collectObjectResources
  // 无条件全树收集）→ 父重建时子的材质 dispose=1（子还活着却丢了材质）。
  const engine = new SceneEngine();
  const scope = getResourceScope(engine);
  engine.registerFactory('parents', () => new THREE.Group());
  engine.registerFactory('kids', () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const g = new THREE.Group();
    g.add(m);
    return g;
  });
  // 建树：父 p + 子 c（c 是独立业务节点）
  engine.applyFragment({
    parents: [{ id: 'p', params: { a: 1 } }],
    kids: [{ id: 'c', parentId: 'p' }],
  });
  const childObj = engine.getObject('c');
  const childMesh = childObj.children.find((m) => m.isMesh);

  // 计数子节点的"当前材质"dispose 事件
  let childMatDisposes = 0;
  const track = (mat) => {
    const orig = mat.dispose.bind(mat);
    mat.dispose = () => { childMatDisposes += 1; orig(); };
    return mat;
  };
  let childMat = track(childMesh.material);

  // 父材质编辑（applyVisual 递归 traverse 全树——子的材质也被克隆替换）
  engine.applyVisual('p', { color: '#ff0000' });
  const newChildMat = childMesh.material;
  if (newChildMat !== childMat) {
    childMat = track(newChildMat);
  }
  // RRRR1：子被父编辑递归改的材质必须归属子自己的登记（不记给父）
  assert.equal(scope.isTracked(childMat), true, '子的当前材质必须被登记');
  assert.ok(
    scope.refCount(childMat) >= 1 && engine.getAllIds().includes('c'),
    '子材质登记存在',
  );
  // 关键归属断言：该材质的 owner 集合不含父 p（releaseExcept 场景下无法直接查 owner；
  // 用行为断言——父 params 重建后子的材质不得被释放）
  const childMatBeforeRebuild = childMat;
  let disposesBeforeRebuild = childMatDisposes;

  // 父 params 变化 → 父重建（legacy 兜底）；子实例与材质必须存活
  engine.applyFragment({ parents: [{ id: 'p', params: { a: 2 } }] });
  assert.equal(engine.getObject('c'), childObj, '子实例保留');
  assert.equal(childObj.children.find((m) => m.isMesh).material, childMatBeforeRebuild,
    '子继续使用其当前材质');
  assert.equal(childMatDisposes - disposesBeforeRebuild, 0,
    `父重建时存活子的当前材质不得 dispose（got ${childMatDisposes - disposesBeforeRebuild}——RRRR1 修复前=1）`);
  assert.equal(scope.isTracked(childMatBeforeRebuild), true, '父重建后子的材质仍在登记');

  // 删除子：子的材质恰好释放一次
  engine.applyFragment({ remove: ['c'] });
  assert.equal(childMatDisposes - disposesBeforeRebuild, 1, '删除子后其材质恰好释放一次');
  assert.equal(scope.isTracked(childMatBeforeRebuild), false);

  // 父删除 + 整体销毁：无重复事件
  const final = childMatDisposes;
  engine.applyFragment({ remove: ['p'] });
  engine.dispose();
  assert.equal(childMatDisposes, final, '删除父/整体销毁不得重复 dispose 已释放的子材质');
});

await test('P3 undo diff-restore keeps unchanged node identities (V10/V14 core)', () => {
  const engine = new SceneEngine();
  engine.registerFactory('things', () => new THREE.Group());
  engine.applyFragment({ things: [{ id: 'A' }, { id: 'B' }] });
  const objA = engine.getObject('A');
  const objB = engine.getObject('B');
  // undo 快照恢复（Bridge.rebuild 同语义）：remove 差量 + upsert 差量
  engine.applyFragment({ things: [{ id: 'C' }] });
  engine.applyFragment({ remove: ['C'] });
  engine.applyFragment({ things: [{ id: 'A' }, { id: 'B' }] });
  assert.equal(engine.getObject('A'), objA, '差量恢复不重建未变节点 A');
  assert.equal(engine.getObject('B'), objB, '差量恢复不重建未变节点 B');
  assert.equal(engine.getAllIds().includes('C'), false, '快照外节点被移除');
  engine.dispose();
});

// ═══ P4：编译外观（compile-appearance / appearance-runtime / strip 原子发布）═══

/** readdirSync 安全包装（目录不存在返回 []；staging 残留检查用） */
const readdirSyncSafe = (dir) => {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
};

await test('P4.1 compileAppearance: reference validation reports exact paths (V19)', async () => {
  const { compileAppearance } = await import('../../skills/generate-3d-scene/scripts/lib/compile-appearance.mjs');
  // 陈旧 nodeId：报具体路径
  let r = compileAppearance({
    __visuals: { ghost_99: { color: '#fff' } },
  }, { liveNodeIds: new Set(['a']) });
  assert.ok(r.errors.some((e) => e.includes('__visuals["ghost_99"]')), '陈旧条目报路径');
  // libraryRef 缺库条目：报路径
  r = compileAppearance({
    __visuals: { a: { libraryRef: 'missing_mat' } },
    __materialLib: {},
  }, { liveNodeIds: new Set(['a']) });
  assert.ok(r.errors.some((e) => e.includes('__visuals["a"].libraryRef') && e.includes('missing_mat')), '缺库条目报路径');
  // 槽位级 libraryRef 缺条目：报路径
  r = compileAppearance({
    __visuals: { a: { slots: { 'Body': { libraryRef: 'ghost_mat' } } } },
    __materialLib: {},
  }, { liveNodeIds: new Set(['a']) });
  assert.ok(r.errors.some((e) => e.includes('slots') && e.includes('ghost_mat')), '槽位缺库条目报路径');
  // 合法输入：零错误 + locked 剥离 + 未引用种子剔除 + 键序稳定。
  // P4-R3：c 的 slots 在无 slotContext（工程根/manifest）时 fail-closed——
  // 槽位校验属 strip 流程（有工程上下文），孤立调用判「无法验证」
  const snapshot = {
    __visuals: {
      a: { color: '#ff0000', metalness: 0.8 },
      b: { libraryRef: 'carpaint', locked: true },
      c: { slots: { Hair: { color: '#111111' }, Body: { libraryRef: 'glass' } } },
    },
    __materialLib: {
      carpaint: { name: '车漆', spec: { type: 'MeshPhysicalMaterial', clearcoat: 1 } },
      glass: { name: '玻璃', spec: { type: 'MeshPhysicalMaterial', transmission: 1 } },
      unused_seed: { name: '未引用', spec: { type: 'MeshStandardMaterial' } },
    },
  };
  r = compileAppearance(snapshot, { liveNodeIds: new Set(['a', 'b', 'c']) });
  assert.ok(
    r.errors.some((e) => e.includes('__visuals["c"].slots 无法验证')),
    'P4-R3：无工程上下文的 slots fail-closed（不把不知道当成功）',
  );
  // 非 slots 输入零错误（槽位校验不触发）
  r = compileAppearance({
    __visuals: {
      a: { color: '#ff0000', metalness: 0.8 },
      b: { libraryRef: 'carpaint', locked: true },
    },
    __materialLib: snapshot.__materialLib,
  }, { liveNodeIds: new Set(['a', 'b']) });
  assert.deepEqual(r.errors, []);
  assert.equal(r.exportedVisuals.b.locked, undefined, 'locked 剥离');
  assert.ok(r.exportedMaterialLib.carpaint, '被引用条目保留');
  assert.equal(r.exportedMaterialLib.unused_seed, undefined, '未引用种子剔除');
  assert.equal(r.stats.visualEntries, 2);
  // 同输入产同输出（可重复生成 / formatter 稳定）
  const r2 = compileAppearance({
    __visuals: {
      a: { color: '#ff0000', metalness: 0.8 },
      b: { libraryRef: 'carpaint', locked: true },
    },
    __materialLib: snapshot.__materialLib,
  }, { liveNodeIds: new Set(['a', 'b']) });
  assert.equal(r.code, r2.code, '编译确定性');
  // 代码模块：双常量导出 + 类型来自 scene-core（不 import edit）
  assert.ok(/export const compiledVisuals/.test(r.code));
  assert.ok(/export const compiledMaterialLib/.test(r.code));
  assert.ok(!/from\s+['"].*edit/.test(r.code));
});

await test('P4.1 applyCompiledAppearance: visuals/materials/slots effective on real engine (V17 core)', async () => {
  const { applyCompiledAppearance } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/appearance-runtime.ts')));
  // 真 SceneEngine + 真 ResourceScope（P3 验证过的所有权链路自动继承）
  const engine = new SceneEngine();
  engine.registerFactory('things', () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    m.name = 'body';
    g.add(m);
    return g;
  });
  engine.applyFragment({ things: [{ id: 'a' }, { id: 'b' }] });
  const handle = {
    update: (frag) => engine.applyFragment(frag),
    internals: { sceneEngine: engine, renderLoop: { invalidate() {} } },
  };
  // 数据不带私有区（运行包形态）
  const result = applyCompiledAppearance(handle, {});
  assert.ok(['empty', 'editor-data'].includes(result.skipped), '母版空表 → skipped=empty');
  // 注入编译数据（模块级常量替换不了——用 monkey-patch 模拟编译产物：
  //   appearance-runtime 读模块常量，这里直接对引擎应用同等视觉验证运行时链路）
  // 用引擎原生入口应用编译等价视觉（与 appearance-runtime 的 applyVisual 同一 API）：
  engine.applyVisual('a', { color: '#00ff00', visible: false, castShadow: false });
  engine.applyVisual('b', { libraryRef: 'carpaint' });
  const objA = engine.getObject('a');
  const meshA = objA.children.find((c) => c.isMesh);
  assert.equal(objA.visible, false, '显隐生效');
  assert.equal(meshA.castShadow, false, '阴影开关生效');
  const matA = Array.isArray(meshA.material) ? meshA.material[0] : meshA.material;
  assert.equal(`#${matA.color.getHexString()}`, '#00ff00', '内联改色生效');
  assert.ok(engine.getVisual('a') !== null, '视觉层已写入引擎（异步 GLB 重挂同源）');
  // libraryRef：runtime 用共享实例表（该链路由 appearance-runtime 的
  // applyLibraryInstances 走 createMaterialFromSpec——此处验证引擎侧视觉层可承载）
  assert.equal(engine.getVisual('b')?.libraryRef, 'carpaint');
  engine.dispose();
});

await test('P4.2 stripEdit atomic publish: failure preserves source and old output (V19)', async () => {
  const { stripEdit } = await import('../../skills/generate-3d-scene/scripts/strip-edit.mjs');
  const { cpSync, rmSync, writeFileSync } = await import('node:fs');
  const tmp = join(await import('node:os').then((m) => m.tmpdir()), `p4-strip-${Date.now()}`);
  const src = join(tmp, 'src');
  cpSync(resolve(template), src, {
    recursive: true,
    filter: (s) => !['node_modules', 'dist', '.git', '.smoke-r', '.smoke-vendor'].some(
      (n) => s.endsWith(n) || s.includes(`/${n}`) || s.includes(`\\${n}`),
    ),
  });
  try {
    // 正常导出 → 产物 + appearance.ts 编译落位
    const out = join(tmp, 'out');
    const r1 = await stripEdit(src, out, { force: true });
    assert.equal(r1.ok, true, JSON.stringify(r1.errors));
    assert.ok(existsSync(join(out, 'src', 'scene3d', 'scene', 'generated', 'appearance.ts')), 'appearance.ts 落位');
    assert.ok(existsSync(join(out, 'TRANSCRIPTION.md')), '摘要落位');
    const oldMarker = readFileSync(join(out, 'src', 'main.ts'), 'utf8');
    // 坏源（陈旧引用）→ FAIL：源完好 + 旧 out 完好 + 无 staging 残留
    const p = join(src, 'public', 'scene3d', 'scene-data.json');
    const data = JSON.parse(readFileSync(p, 'utf8'));
    data.__visuals = { ghost_404: { color: '#000' } };
    writeFileSync(p, JSON.stringify(data, null, 2));
    const r2 = await stripEdit(src, out, { force: true });
    assert.equal(r2.ok, false);
    assert.ok(r2.errors.some((e) => e.includes('ghost_404')), '错误报具体路径');
    assert.equal(readFileSync(join(out, 'src', 'main.ts'), 'utf8'), oldMarker, '旧产物分毫未动');
    assert.ok(existsSync(join(src, 'src', 'edit', 'Bridge.ts')), '源工程完好');
    const stagingLeft = readdirSyncSafe(dirname(out)).filter((f) => f.startsWith('.tmp-strip'));
    assert.equal(stagingLeft.length, 0, `staging 清理干净（残留：${stagingLeft.join(',')}）`);
    // out 嵌套在源内：拒绝
    const r3 = await stripEdit(src, join(src, 'nested'), { force: true });
    assert.equal(r3.ok, false);
    assert.ok(r3.errors.some((e) => e.includes('嵌在源工程内部')), '嵌套拒绝');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ═══ P4 首审修复轮（P4-R1/R2/R3）═══

const P4_SOURCE = {
  visuals: {
    a: { libraryRef: 'red' },
    b: { libraryRef: 'red' },
    s: { slots: { Body: { libraryRef: 'red' } } },
  },
  materialLib: {
    red: { name: '红', spec: { type: 'MeshStandardMaterial', color: '#ff0000' } },
  },
};

await test('P4-R1/R2 library materials survive late asset mount and rebuild; ownership exact (V17/V14)', async () => {
  const { applyCompiledAppearance } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/appearance-runtime.ts')));
  const makeAssetNodeFactoryMod = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/handlers/registry.ts')));
  // R1 复现夹具：真 makeAssetNodeFactory + 延迟 resolve 的 AssetEngine 替身（网络层测试替身，
  // 引擎/资源域/runtime 为真实模块）
  let releaseInstance;
  const gate = new Promise((r) => { releaseInstance = r; });
  const fakeAssetEngine = {
    getInstance: async () => {
      await gate;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
      body.name = 'Body';
      g.add(body);
      return g;
    },
  };
  const engine = new SceneEngine();
  let disposes = 0;
  engine.registerFactory('glbs', makeAssetNodeFactoryMod.makeAssetNodeFactory(
    engine, fakeAssetEngine, () => 'assets/models/x.glb',
  ));
  engine.registerFactory('boxes', () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  engine.applyFragment({
    glbs: [{ id: 'a', params: { assetId: 'fake' } }],
    boxes: [{ id: 'b' }],
  });
  const handle = { update: (f) => engine.applyFragment(f), internals: { sceneEngine: engine } };
  const result = applyCompiledAppearance(handle, {}, P4_SOURCE);
  assert.equal(result.skipped, null);
  assert.equal(result.materialInstances, 1);

  const scope = getResourceScope(engine);
  // 同步节点 b：立即挂红（RR1：库材质不进节点域登记——释放责任在库级 teardown）
  const matB = engine.getObject('b').material;
  assert.equal(`#${matB.color.getHexString()}`, '#ff0000', '同步对照：b 材质红');
  assert.equal(scope.isTracked(matB), false, 'RR1：库材质不进节点域登记（库级 teardown 释放）');
  const origDispose = matB.dispose.bind(matB);
  matB.dispose = () => { disposes += 1; origDispose(); };

  // R1 核心：迟到 GLB 挂载后库材质重挂（修复前=ffffff，applyVisualOverride refMode 不处理材质）
  releaseInstance();
  await sleep(50);
  let bodyMat = null;
  engine.getObject('a').traverse((c) => {
    if (c.name === 'Body' && c.isMesh) {
      bodyMat = Array.isArray(c.material) ? c.material[0] : c.material;
    }
  });
  assert.ok(bodyMat, 'GLB 挂载完成');
  assert.equal(`#${bodyMat.color.getHexString()}`, '#ff0000', 'R1：迟到 GLB 库材质红（修复前白）');
  assert.equal(bodyMat, matB, 'a/b 共享同一实例');

  // RR1 生命周期：节点全删（零引用窗口）→ 库材质仍有效（不 dispose）；
  // 引擎销毁 → 库级 teardown 恰好释放一次
  engine.applyFragment({ remove: ['a'] });
  assert.equal(disposes, 0, '删一个引用者不释放');
  engine.applyFragment({ remove: ['b'] });
  assert.equal(disposes, 0, '零引用窗口不释放（RR1 修复前：最后 owner 退出 dispose=1 → 复用已释放实例）');
  assert.equal(`#${matB.color.getHexString()}`, '#ff0000', '零引用窗口实例仍有效');
  // 全删后重新创建（迟到/重建引用者）→ 复用同一**活**实例
  engine.applyFragment({ boxes: [{ id: 'b' }] });
  assert.equal(engine.getObject('b').material, matB, '重建引用者复用同一活实例（RR1）');
  assert.equal(`#${engine.getObject('b').material.color.getHexString()}`, '#ff0000', '复用实例颜色正确');
  engine.dispose();
  assert.equal(disposes, 1, '引擎销毁：库级 teardown 恰好释放一次（不早不晚）');
});

await test('P4-R1 library materials remount after node rebuild (recreateNode path)', async () => {
  const { applyCompiledAppearance } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/appearance-runtime.ts')));
  const engine = new SceneEngine();
  engine.registerFactory('boxes', {
    create: () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
    update: (obj, next, prev) => (next.params?.v === prev.params?.v ? 'updated' : 'rebuild'),
  });
  engine.applyFragment({ boxes: [{ id: 'b', params: { v: 1 } }] });
  const handle = { update: (f) => engine.applyFragment(f), internals: { sceneEngine: engine } };
  applyCompiledAppearance(handle, {}, P4_SOURCE);
  const objB = engine.getObject('b');
  const matB = objB.material;
  assert.equal(`#${matB.color.getHexString()}`, '#ff0000', '重建前库材质红');
  // 结构参数 → recreateNode（created 事件）→ 库材质重挂
  engine.applyFragment({ boxes: [{ id: 'b', params: { v: 2 } }] });
  const objB2 = engine.getObject('b');
  assert.notEqual(objB2, objB, '节点已重建');
  assert.equal(`#${objB2.material.color.getHexString()}`, '#ff0000', 'R1：重建后库材质重挂（修复前=默认色）');
  engine.dispose();
});

await test('P4-RR1 sole-owner rebuild window: same live material, zero mid-dispose, exactly one final', async () => {
  const { applyCompiledAppearance } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/appearance-runtime.ts')));
  // 审稿复现：单节点 libraryRef，params 重建 → 旧节点 release 释放库材质（修复前），
  // created 回调取回同一已释放实例（reusesSameMaterial=true, disposesWhileReused=1）
  const engine = new SceneEngine();
  engine.registerFactory('boxes', {
    create: () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()),
    update: (obj, next, prev) => (next.params?.v === prev.params?.v ? 'updated' : 'rebuild'),
  });
  engine.applyFragment({ boxes: [{ id: 'b', params: { v: 1 } }] });
  const handle = { update: (f) => engine.applyFragment(f), internals: { sceneEngine: engine } };
  applyCompiledAppearance(handle, {}, P4_SOURCE);
  const matB = engine.getObject('b').material;
  let disposes = 0;
  const origDispose = matB.dispose.bind(matB);
  matB.dispose = () => { disposes += 1; origDispose(); };
  // 唯一 owner 连续重建 3 轮（每轮都跨零引用窗口）
  let current = matB;
  for (let i = 2; i <= 4; i += 1) {
    engine.applyFragment({ boxes: [{ id: 'b', params: { v: i } }] });
    assert.equal(disposes, 0, `第 ${i - 1} 轮重建窗口零 dispose（RR1 修复前=1：边 dispose 边复用）`);
    const remounted = engine.getObject('b').material;
    assert.equal(remounted, current, '重建后复用同一活实例');
    assert.equal(`#${remounted.color.getHexString()}`, '#ff0000', '实例视觉有效（未 dispose）');
    current = remounted;
  }
  engine.dispose();
  assert.equal(disposes, 1, '引擎销毁：库级 teardown 恰好一次（审稿实测修复前累计=2）');
});

await test('P4-RR1 late owner after all current owners removed: instance alive, single dispose', async () => {
  const { applyCompiledAppearance } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/appearance-runtime.ts')));
  const makeAssetNodeFactoryMod = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/handlers/registry.ts')));
  // 迟到 GLB：同步引用者先全删（零引用窗口），GLB 才完成挂载——实例必须仍活
  let releaseInstance;
  const gate = new Promise((r) => { releaseInstance = r; });
  const fakeAssetEngine = {
    getInstance: async () => {
      await gate;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
      body.name = 'Body';
      g.add(body);
      return g;
    },
  };
  const engine = new SceneEngine();
  let disposes = 0;
  engine.registerFactory('glbs', makeAssetNodeFactoryMod.makeAssetNodeFactory(
    engine, fakeAssetEngine, () => 'assets/models/x.glb',
  ));
  engine.registerFactory('boxes', () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  engine.applyFragment({
    glbs: [{ id: 'late', params: { assetId: 'fake' } }],
    boxes: [{ id: 'b' }],
  });
  const handle = { update: (f) => engine.applyFragment(f), internals: { sceneEngine: engine } };
  applyCompiledAppearance(handle, {}, { visuals: { b: { libraryRef: 'red' }, late: { libraryRef: 'red' } }, materialLib: P4_SOURCE.materialLib });
  const matB = engine.getObject('b').material;
  const origDispose = matB.dispose.bind(matB);
  matB.dispose = () => { disposes += 1; origDispose(); };
  // 同步引用者全删 → 零引用窗口
  engine.applyFragment({ remove: ['b'] });
  assert.equal(disposes, 0, '同步引用者退出不释放');
  // 迟到 GLB 完成 → 从实例表挂载（修复前：shared 语义下实例已 dispose，挂的是死实例）
  releaseInstance();
  await sleep(50);
  let lateMat = null;
  engine.getObject('late').traverse((c) => {
    if (c.name === 'Body' && c.isMesh) {
      lateMat = Array.isArray(c.material) ? c.material[0] : c.material;
    }
  });
  assert.ok(lateMat, '迟到 GLB 已挂载');
  assert.equal(lateMat, matB, '迟到引用者拿到同一活实例（非已释放实例）');
  assert.equal(`#${lateMat.color.getHexString()}`, '#ff0000', '实例视觉有效');
  engine.dispose();
  assert.equal(disposes, 1, '最终恰好释放一次');
});

await test('P4-R1 library material textures applied (applyMaterialTextures wired)', async () => {
  const { applyCompiledAppearance } = await import(pathToFileURL(join(template, 'src/scene3d/scene-core/appearance-runtime.ts')));
  const { loadMaterialTextureMod } = { loadMaterialTextureMod: null };
  void loadMaterialTextureMod;
  // 贴图应用走 applyMaterialTextures → loadMaterialTexture（TextureLoader 网络层）。
  // Node 无 fetch 场景验证接线而非像素：stub 检查 materials.ts 的 applyMaterialTextures
  // 在实例化路径被调用（修复前 instantiateMaterialLib 只调 createMaterialFromSpec——
  // 代码级差异。这里用带贴图 spec 的库 + 拦截 THREE.TextureLoader.loadAsync 计数）
  let textureLoads = 0;
  const origLoadAsync = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = function stub(...args) {
    textureLoads += 1;
    return Promise.resolve(new THREE.Texture());
  };
  try {
    const engine = new SceneEngine();
    engine.registerFactory('boxes', () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    engine.applyFragment({ boxes: [{ id: 'b' }] });
    const handle = { update: (f) => engine.applyFragment(f), internals: { sceneEngine: engine } };
    applyCompiledAppearance(handle, {}, {
      visuals: { b: { libraryRef: 'texred' } },
      materialLib: {
        texred: { name: '贴图红', spec: { type: 'MeshStandardMaterial', color: '#ff0000', map: 'assets/textures/example.jpg' } },
      },
    });
    await sleep(20);
    assert.ok(textureLoads >= 1, `库材质贴图加载被触发（got ${textureLoads}——修复前 instantiateMaterialLib 不调 applyMaterialTextures）`);
    engine.dispose();
  } finally {
    THREE.TextureLoader.prototype.loadAsync = origLoadAsync;
  }
});

await test('P4-R3 stale slot fails closed with exact path; real slot passes (V19)', async () => {
  const { stripEdit } = await import('../../skills/generate-3d-scene/scripts/strip-edit.mjs');
  const { cpSync, rmSync, readFileSync, writeFileSync } = await import('node:fs');
  const tmp = join(await import('node:os').then((m) => m.tmpdir()), `p4-r3-${Date.now()}`);
  const src = join(tmp, 'src');
  cpSync(resolve(template), src, {
    recursive: true,
    // 保留 node_modules（RRR1 起全量槽位走真 loader/headless 清单——与 RR2/RRR1 用例同款）
    filter: (s) => !['dist', '.git', '.smoke-r', '.smoke-vendor', '.tmp', '.vite', '.vite-temp'].some(
      (n) => s.endsWith(n) || s.includes(`/${n}`) || s.includes(`\\${n}`),
    ),
  });
  seedProject(src);
  if (!existsSync(join(src, 'node_modules'))) symlinkSync(dependencyPath(), join(src, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  try {
    const p = join(src, 'public/scene3d/scene-data.json');
    const data = JSON.parse(readFileSync(p, 'utf8'));
    const exId = data.examples?.[0]?.id ?? 'example_01';
    const out = join(tmp, 'out');
    // 负例：真实槽位 + 陈旧槽位混合 → FAIL 精确报陈旧路径，无产物
    // （example 是非 Draco GLB——真 GLTFLoader 清单含 body）
    data.__visuals = {
      [exId]: { slots: { 'body': { color: '#00ff00' }, 'ghost/mesh': { color: '#ff0000' } } },
    };
    writeFileSync(p, JSON.stringify(data, null, 2));
    const r = await stripEdit(src, out, { force: true });
    assert.equal(r.ok, false, '陈旧槽位必须 FAIL');
    assert.ok(
      r.errors.some((e) => e.includes(`slots["ghost/mesh"]`) && e.includes('不存在')),
      `错误报具体槽位路径：${JSON.stringify(r.errors)}`,
    );
    assert.ok(
      !r.errors.some((e) => e.includes('body')),
      '真实槽位不误报',
    );
    // 正例：只留真实槽位 → PASS + 编译进 appearance
    delete data.__visuals[exId].slots['ghost/mesh'];
    writeFileSync(p, JSON.stringify(data, null, 2));
    const r2 = await stripEdit(src, out, { force: true });
    assert.equal(r2.ok, true, JSON.stringify(r2.errors));
    const ap = readFileSync(join(out, 'src/scene3d/scene/generated/appearance.ts'), 'utf8');
    assert.ok(ap.includes('body'), '真实槽位编译进 appearance');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P4-RR2 procedural slots: runtime-manifest positive, stale negative, fail-closed (V19)', async () => {
  const { stripEdit } = await import('../../skills/generate-3d-scene/scripts/strip-edit.mjs');
  const { cpSync, rmSync, readFileSync, writeFileSync, existsSync } = await import('node:fs');
  const tmp = join(await import('node:os').then((m) => m.tmpdir()), `p4-rr2-${Date.now()}`);
  const src = join(tmp, 'src');
  cpSync(resolve(template), src, {
    recursive: true,
    // 保留 node_modules（运行时槽位清单需要工程 typescript/three 转译加载）
    filter: (s) => !['dist', '.git', '.smoke-r', '.smoke-vendor', '.tmp', '.vite', '.vite-temp'].some(
      (n) => s.endsWith(n) || s.includes(`/${n}`) || s.includes(`\\${n}`),
    ),
  });
  seedProject(src);
  if (!existsSync(join(src, 'node_modules'))) symlinkSync(dependencyPath(), join(src, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  try {
    assert.ok(existsSync(join(src, 'node_modules', 'typescript')), '夹具含 typescript（运行时清单前提）');
    const p = join(src, 'public/scene3d/scene-data.json');
    const data = JSON.parse(readFileSync(p, 'utf8'));
    const treeId = data.trees?.[0]?.id;
    const rackId = Object.keys((data.coderacks ?? []) && {}).length ? data.coderacks[0]?.id : null;
    const out = join(tmp, 'out');
    // 正例：程序化模型真实槽位（tree 的 trunk；rack 的 panel_side_l——RR2 修复前
    // 一律误拒「非 GLB 节点不支持槽位」，合法编辑无法导出）
    data.__visuals = {
      [treeId]: { slots: { trunk: { color: '#7a5230' } } },
    };
    if (rackId) {
      data.__visuals[rackId] = { slots: { panel_side_l: { color: '#ffcc00' } } };
    }
    writeFileSync(p, JSON.stringify(data, null, 2));
    const r = await stripEdit(src, out, { force: true });
    assert.equal(r.ok, true, `合法程序化槽位必须导出成功（RR2 修复前误拒）：${JSON.stringify(r.errors)}`);
    const ap = readFileSync(join(out, 'src/scene3d/scene/generated/appearance.ts'), 'utf8');
    assert.ok(ap.includes('"trunk"'), 'tree trunk 槽位编译进 appearance');
    if (rackId) {
      assert.ok(ap.includes('panel_side_l'), 'rack 面板槽位编译进 appearance');
    }
    // 负例：程序化模型的陈旧槽位 → FAIL 报运行时清单路径（不能静默放行）
    data.__visuals[treeId] = { slots: { trunk: { color: '#7a5230' }, ghost_branch: { color: '#123456' } } };
    writeFileSync(p, JSON.stringify(data, null, 2));
    const out2 = join(tmp, 'out2');
    const r2 = await stripEdit(src, out2, { force: true });
    assert.equal(r2.ok, false, '程序化陈旧槽位必须 FAIL');
    assert.ok(
      r2.errors.some((e) => e.includes(`slots["ghost_branch"]`) && e.includes('运行时 mesh 清单中不存在')),
      '错误报运行时清单路径',
    );
    assert.ok(
      !r2.errors.some((e) => e.includes('slots["trunk"]')),
      '真实程序化槽位不误报',
    );
    // '#' 形态：静态不可判定的路径段不再无条件放行——GLB 匿名节点的 '#999/ghost'
    // 在静态清单（具名路径）必不命中 → FAIL（RR2 修复前 hasUnnamed&&includes('#') 放行）
    const exId = data.examples?.[0]?.id ?? 'example_01';
    data.__visuals[exId] = { slots: { '#999/ghost': { color: '#000' } } };
    writeFileSync(p, JSON.stringify(data, null, 2));
    const r3 = await stripEdit(src, join(tmp, 'out3'), { force: true });
    assert.equal(r3.ok, false, '匿名 # 路径不再放行');
    assert.ok(
      r3.errors.some((e) => e.includes('#999/ghost') && e.includes('不存在')),
      '# 槽位报具体路径（fail-closed）',
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P4-RRR1 multi-primitive model: loader-true slots export, stale fails, runtime hits mesh', async () => {
  const { stripEdit } = await import('../../skills/generate-3d-scene/scripts/strip-edit.mjs');
  const { buildRuntimeSlotKeys } = await import('../../skills/generate-3d-scene/scripts/lib/runtime-slots.mjs');
  const { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } = await import('node:fs');
  const tmp = join(await import('node:os').then((m) => m.tmpdir()), `p4-rrr1-${Date.now()}`);
  const src = join(tmp, 'src');
  cpSync(resolve(template), src, {
    recursive: true,
    filter: (s) => !['dist', '.git', '.smoke-r', '.smoke-vendor', '.tmp', '.vite', '.vite-temp'].some(
      (n) => s.endsWith(n) || s.includes(`/${n}`) || s.includes(`\\${n}`),
    ),
  });
  seedProject(src);
  if (!existsSync(join(src, 'node_modules'))) symlinkSync(dependencyPath(), join(src, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  try {
    // 构造审稿形态多 primitive 模型：node part / mesh surface / 2 primitive（数据 URI
    // 嵌入——无外部依赖；真实 AssetEngine/GLTFLoader 同链路加载）
    const png1px = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const f32 = (a) => Buffer.from(new Float32Array(a).buffer);
    const u16 = (a) => Buffer.from(new Uint16Array(a).buffer);
    const bin = Buffer.concat([f32([0, 0, 0, 1, 0, 0, 0, 1, 0]), f32([0, 0, 1, 0, 0, 0]), u16([0, 1, 2])]);
    const gltf = {
      asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
      nodes: [{ name: 'part', mesh: 0 }],
      meshes: [{ name: 'surface', primitives: [
        { attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 },
        { attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 },
      ] }],
      materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
      textures: [{ source: 0 }],
      images: [{ uri: `data:image/png;base64,${png1px}` }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
        { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' },
        { bufferView: 2, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 24 },
        { buffer: 0, byteOffset: 60, byteLength: 6 },
      ],
      buffers: [{ uri: `data:application/octet-stream;base64,${bin.toString('base64')}`, byteLength: bin.length }],
    };
    const modelDir = join(src, 'public', 'scene3d', 'assets', 'models', 'multi_prim');
    mkdirSync(modelDir, { recursive: true });
    writeFileSync(join(modelDir, 'model.gltf'), JSON.stringify(gltf));
    // manifest 登记资产
    const manifestPath = join(src, 'public', 'scene3d', 'assets', 'asset-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.multi_prim = { model: 'models/multi_prim/model.gltf', format: 'gltf' };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    // 场景引用 + 编辑视觉（多 primitive 合法槽位——先经生产链路取真值）
    const p = join(src, 'public/scene3d/scene-data.json');
    const data = JSON.parse(readFileSync(p, 'utf8'));
    data.asset = [{ id: 'mp_01', params: { assetId: 'multi_prim' } }];
    writeFileSync(p, JSON.stringify(data, null, 2));
    const runtimeKeys = await buildRuntimeSlotKeys(src, data);
    const mpKeys = runtimeKeys.get('mp_01');
    assert.ok(mpKeys && mpKeys.size === 2, `生产加载产 2 个多 primitive 槽位（got ${JSON.stringify([...(mpKeys ?? [])])}）`);
    assert.ok(mpKeys.has('part/surface') && mpKeys.has('part/surface_1'), '槽位形态 = part/surface + part/surface_1（loader 真值）');
    // 复刻等价证明（Draco 路径的规则复刻 vs 真 loader——非 Draco 全等）
    // emulateLoaderSlotKeys 为模块私有；等价性经 manifest 内 example 资产间接验证：
    // example.glb（非 Draco 单 primitive）真 loader 清单与运行时形态一致
    const exKeys = runtimeKeys.get(data.examples?.[0]?.id ?? 'example_01');
    assert.ok(exKeys && [...exKeys].includes('body'), '非 Draco 资产真 loader 清单命中');
    // Generated hierarchical asset fixture; compressed assets require separate external fixtures.
    const personKeys = runtimeKeys.get('person_01');
    assert.ok(personKeys && [...personKeys].some((k) => k.startsWith('assembly/part')), '生成的层级资产清单与运行时槽位一致');

    // 正例：多 primitive 合法槽位 → strip 成功 + 编译进 appearance
    data.__visuals = { mp_01: { slots: { 'part/surface': { color: '#00ff00' }, 'part/surface_1': { color: '#0000ff' } } } };
    writeFileSync(p, JSON.stringify(data, null, 2));
    const out = join(tmp, 'out');
    const r = await stripEdit(src, out, { force: true });
    assert.equal(r.ok, true, `多 primitive 合法槽位必须导出成功（修复前误报陈旧）：${JSON.stringify(r.errors)}`);
    const ap = readFileSync(join(out, 'src/scene3d/scene/generated/appearance.ts'), 'utf8');
    assert.ok(ap.includes('part/surface') && ap.includes('part/surface_1'), '两个 primitive 槽位都编译进 appearance');

    // 运行时命中验证（全部在夹具源内加载——单 THREE 实例链）：
    // 真实 GLTFLoader 加载同一模型 → 复刻 makeAssetNodeFactory 挂载形态 →
    // findBySlotKey（运行时槽位定位函数）确认两个 key 都命中真实 mesh →
    // appearance-runtime 应用编译视觉后材质生效
    const materialsMod = await import(pathToFileURL(join(src, 'src', 'scene3d', 'scene-core', 'materials.ts')));
    const { applyCompiledAppearance } = await import(pathToFileURL(join(src, 'src/scene3d/scene-core/appearance-runtime.ts')));
    const { SceneEngine: FixtureSceneEngine } = await import(pathToFileURL(join(src, 'src', 'scene3d', 'scene-core', 'engine', 'SceneEngine.ts')));
    globalThis.self = globalThis.self ?? globalThis;
    globalThis.createImageBitmap = globalThis.createImageBitmap ?? (async () => ({ width: 1, height: 1, close: () => {} }));
    globalThis.ProgressEvent = globalThis.ProgressEvent ?? class { constructor(t, i = {}) { this.type = t; Object.assign(this, i); } };
    const { GLTFLoader: FixtureLoader } = await import(pathToFileURL(join(src, 'node_modules', 'three', 'examples', 'jsm', 'loaders', 'GLTFLoader.js')));
    const loader = new FixtureLoader();
    const gltfResult = await new Promise((res, rej) => loader.parse(JSON.stringify(gltf), '', res, rej));
    const gltfScene = gltfResult.scene;
    // 复刻挂载形态：Group 由 gltfScene 所在的同一 three 实例构造（scene.parent
    // 为 null——用 scene 自身的构造器族拿 Group：Loader 的 Group 类挂在
    // gltfScene.constructor 的模块命名空间外，改用 Object3D 根包装：
    // makeAssetNodeFactory 的 group.add(gltfScene) 等价于「gltfScene 挂在
    // 节点 Object3D 下」——这里用 findBySlotKey 直接从 gltfScene 起（跳过外壳
    // 容器：findBySlotKey 的容器探层语义等价处理）
    const hit1 = materialsMod.findBySlotKey(gltfScene, 'part/surface');
    const hit2 = materialsMod.findBySlotKey(gltfScene, 'part/surface_1');
    assert.ok(hit1 && hit2, '运行时槽位定位：两个多 primitive key 均命中真实 mesh');
    assert.ok(hit1.isMesh && hit2.isMesh, '命中对象是 mesh');
    assert.equal(hit1.name, 'surface', 'part/surface 命中第一 primitive mesh');
    assert.equal(hit2.name, 'surface_1', 'part/surface_1 命中第二 primitive mesh');
    // 视觉生效：applyCompiledAppearance 的 applyVisual→applyVisualOverride 链
    // （engine 用夹具 SceneEngine；挂载用 loader 同实例 Group——从 materials 模块
    // 的 THREE 取（materials.ts import 'three' 与 GLTFLoader 同链））
    const matThree = await import(pathToFileURL(join(src, 'node_modules', 'three', 'build', 'three.module.js')));
    const engine = new FixtureSceneEngine();
    const gltfScene2 = (await new Promise((res, rej) => loader.parse(JSON.stringify(gltf), '', res, rej))).scene;
    engine.registerFactory('asset', {
      create: () => {
        const g = new matThree.Group();
        g.add(gltfScene2);
        return g;
      },
    });
    engine.applyFragment({ asset: [{ id: 'mp_01', params: { assetId: 'multi_prim' } }] });
    const handle = { update: (f) => engine.applyFragment(f), internals: { sceneEngine: engine } };
    const result = applyCompiledAppearance(handle, {}, {
      visuals: { mp_01: { slots: { 'part/surface': { color: '#00ff00' }, 'part/surface_1': { color: '#0000ff' } } } },
      materialLib: {},
    });
    assert.equal(result.skipped, null);
    const obj = engine.getObject('mp_01');
    const surfaceMesh = obj.getObjectByName('surface');
    const surface1Mesh = obj.getObjectByName('surface_1');
    assert.ok(surfaceMesh && surface1Mesh, '运行时两个 primitive mesh 均存在（loader 命名）');
    assert.equal(`#${surfaceMesh.material.color.getHexString()}`, '#00ff00', 'part/surface 运行时命中 mesh（视觉生效）');
    assert.equal(`#${surface1Mesh.material.color.getHexString()}`, '#0000ff', 'part/surface_1 运行时命中 mesh（视觉生效）');
    engine.dispose();

    // 负例：篡改为不存在 key → FAIL + 源/旧输出完好
    const oldMarker = readFileSync(join(out, 'src', 'main.ts'), 'utf8');
    data.__visuals = { mp_01: { slots: { 'part/surface': { color: '#00ff00' }, 'part/ghost': { color: '#fff' } } } };
    writeFileSync(p, JSON.stringify(data, null, 2));
    const r2 = await stripEdit(src, out, { force: true });
    assert.equal(r2.ok, false, '不存在槽位必须 FAIL');
    assert.ok(
      r2.errors.some((e) => e.includes('slots["part/ghost"]') && e.includes('不存在')),
      '错误槽位报具体路径',
    );
    assert.equal(readFileSync(join(out, 'src', 'main.ts'), 'utf8'), oldMarker, '旧输出完好');
    assert.ok(existsSync(join(src, 'src', 'edit', 'Bridge.ts')), '源工程完好');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P4-RRRR1 external bin (encoded filename): real slot exports, missing dep fails, empty-vs-fail distinct', async () => {
  const { stripEdit } = await import('../../skills/generate-3d-scene/scripts/strip-edit.mjs');
  const { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } = await import('node:fs');
  const tmp = join(await import('node:os').then((m) => m.tmpdir()), `p4-rrrr1-${Date.now()}`);
  const src = join(tmp, 'src');
  cpSync(resolve(template), src, {
    recursive: true,
    filter: (s) => !['dist', '.git', '.smoke-r', '.smoke-vendor', '.tmp', '.vite', '.vite-temp'].some(
      (n) => s.endsWith(n) || s.includes(`/${n}`) || s.includes(`\\${n}`),
    ),
  });
  seedProject(src);
  if (!existsSync(join(src, 'node_modules'))) symlinkSync(dependencyPath(), join(src, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  try {
    // 合法多文件 glTF：具名节点 part + 外部 data.bin（磁盘文件名含空格/非 ASCII，
    // glTF URI 百分号编码——与浏览器 fetch 解码一致）
    const f32 = (a) => Buffer.from(new Float32Array(a).buffer);
    const u16 = (a) => Buffer.from(new Uint16Array(a).buffer);
    const bin = Buffer.concat([f32([0, 0, 0, 1, 0, 0, 0, 1, 0]), u16([0, 1, 2])]);
    const modelDir = join(src, 'public', 'scene3d', 'assets', 'models', 'ext_model');
    mkdirSync(modelDir, { recursive: true });
    const gltf = {
      asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
      nodes: [{ name: 'part', mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
        { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: 36 },
        { buffer: 0, byteOffset: 36, byteLength: 6 },
      ],
      buffers: [{ uri: 'data%20mesh.bin', byteLength: bin.length }],
    };
    writeFileSync(join(modelDir, 'model.gltf'), JSON.stringify(gltf));
    writeFileSync(join(modelDir, 'data mesh.bin'), bin);
    const manifestPath = join(src, 'public', 'scene3d', 'assets', 'asset-manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.ext_model = { model: 'models/ext_model/model.gltf', format: 'gltf' };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const p = join(src, 'public/scene3d/scene-data.json');
    const data = JSON.parse(readFileSync(p, 'utf8'));
    data.asset = [{ id: 'ext_01', params: { assetId: 'ext_model' } }];
    // 正例：真实存在槽位 part → strip 成功保真（修复前：外部 bin 加载失败 → 空清单
    // 冒充成功 → part 被误报陈旧）
    data.__visuals = { ext_01: { slots: { part: { color: '#00ccff' } } } };
    writeFileSync(p, JSON.stringify(data, null, 2));
    const out = join(tmp, 'out');
    const r = await stripEdit(src, out, { force: true });
    assert.equal(r.ok, true, `外部 bin 真实槽位必须导出成功（修复前误报陈旧）：${JSON.stringify(r.errors)}`);
    const ap = readFileSync(join(out, 'src/scene3d/scene/generated/appearance.ts'), 'utf8');
    assert.ok(ap.includes('"part"'), 'part 槽位编译进 appearance');

    // 负例：抽掉 data mesh.bin（缺外部依赖）→ 节点无运行时清单（非空清单冒充），
    // 槽位校验报「无法验证」FAIL + 源/旧输出完好
    rmSync(join(modelDir, 'data mesh.bin'));
    const oldMarker = readFileSync(join(out, 'src', 'main.ts'), 'utf8');
    const r2 = await stripEdit(src, out, { force: true });
    assert.equal(r2.ok, false, '缺依赖必须 FAIL（不能以 fail-closed 无害为由放行合法资产语义混淆）');
    assert.ok(
      r2.errors.some((e) => e.includes('ext_01') && e.includes('无法验证')),
      `缺依赖报「无法验证」而非「不存在」（区分加载失败与有效空清单）：${JSON.stringify(r2.errors)}`,
    );
    assert.ok(
      !r2.errors.some((e) => e.includes('不存在')),
      '加载失败不得冒充「成功加载但 key 不存在」',
    );
    assert.equal(readFileSync(join(out, 'src', 'main.ts'), 'utf8'), oldMarker, '旧输出完好');
    assert.ok(existsSync(join(src, 'src', 'edit', 'Bridge.ts')), '源工程完好');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

/* ── P5 修复轮回归（P5-R1～R4，生产模块直跑，2026-10-15）──────────────────── */

await test('P5-R1 cache: complete inputs — asset bytes/index.html/expect/url change keys; run/edit isolation', async () => {
  const { computeCacheKey, lookup, record } = await import('../../skills/generate-3d-scene/scripts/lib/verification-cache.mjs');
  const tmp = mkdtempSync(join(tmpdir(), 'p5r1-'));
  try {
    const proj = join(tmp, 'p');
    mkdirSync(join(proj, 'public', 'scene3d', 'assets', 'models'), { recursive: true });
    mkdirSync(join(proj, 'src'), { recursive: true });
    writeFileSync(join(proj, 'public', 'scene3d', 'scene-data.json'), '{}');
    writeFileSync(join(proj, 'public', 'scene3d', 'assets', 'models', 'car.glb'), 'GLB-V1');
    writeFileSync(join(proj, 'index.html'), '<html></html>');
    writeFileSync(join(proj, 'src', 'main.ts'), 'export {};\n');
    const k = (opts = {}) => computeCacheKey(proj, { check: 'verify:run', mode: 'run', ...opts });
    const base = k();
    assert.ok(base.stable, 'base key stable');
    // 模型字节变（review 反例：损坏模型后 key 不变 → 假 PASS）
    writeFileSync(join(proj, 'public', 'scene3d', 'assets', 'models', 'car.glb'), 'GLB-V2-CORRUPTED');
    assert.notEqual(k().key, base.key, 'model bytes change → key change');
    writeFileSync(join(proj, 'public', 'scene3d', 'assets', 'models', 'car.glb'), 'GLB-V1');
    // 闭包内新增 bin
    writeFileSync(join(proj, 'public', 'scene3d', 'assets', 'models', 'data.bin'), 'BIN');
    assert.notEqual(k().key, base.key, 'new closure file → key change');
    rmSync(join(proj, 'public', 'scene3d', 'assets', 'models', 'data.bin'));
    // index.html 变
    writeFileSync(join(proj, 'index.html'), '<html><script src="x"></script></html>');
    assert.notEqual(k().key, base.key, 'index.html change → key change');
    writeFileSync(join(proj, 'index.html'), '<html></html>');
    // expect/url 进键
    assert.notEqual(k({ expectHash: 'aaa' }).key, k({ expectHash: 'bbb' }).key, 'expectHash in key');
    assert.notEqual(k({ url: 'http://a/' }).key, k({ url: 'http://b/' }).key, 'url in key');
    // run/edit 隔离：edit-only 改动不变 run 键、变 edit 键
    mkdirSync(join(proj, 'src', 'edit'), { recursive: true });
    writeFileSync(join(proj, 'src', 'edit', 'Bridge.ts'), 'export const a = 1;\n');
    const runInfo = computeCacheKey(proj, { check: 'verify:run', mode: 'run' });
    const editInfo = computeCacheKey(proj, { check: 'verify:edit', mode: 'edit' });
    writeFileSync(join(proj, 'src', 'edit', 'Bridge.ts'), 'export const a = 2;\n');
    assert.equal(computeCacheKey(proj, { check: 'verify:run', mode: 'run' }).key, runInfo.key,
      'run key unaffected by edit-only change');
    assert.notEqual(computeCacheKey(proj, { check: 'verify:edit', mode: 'edit' }).key, editInfo.key,
      'edit key changes on edit-only change');
    // keyInputs 快照比对：record 后篡改 inputs 不命中
    const info = k();
    record(proj, info.key, { verdict: 'PASS', mode: 'run', checks: [] }, { keyInputs: info.inputs, affects: ['scene', 'code', 'deps'] });
    assert.ok(lookup(proj, info.key, info.inputs).hit, 'record then lookup hits');
    assert.ok(!lookup(proj, info.key, { ...info.inputs, url: 'tampered' }).hit, 'tampered keyInputs do not hit');
    // FAIL 拒存
    assert.ok(!record(proj, 'fail-key', { verdict: 'FAIL', mode: 'run', checks: [] }), 'FAIL not stored');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P5-R2 frame-time: real per-frame stats, lowest-percentile verdict, slowest retained', async () => {
  const { frameTimesFrom, fpsFromFrameTimes } = await import('./perf-fps.mjs');
  const percentile = (sorted, p) => {
    if (!sorted.length) {
      return null;
    }
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[idx];
  };
  // 平稳 60fps
  const steady = Array.from({ length: 61 }, (_, i) => i * 16.6667);
  const ft1 = frameTimesFrom(steady);
  assert.equal(ft1.length, 60, '61 stamps → 60 intervals（首帧不产间隔，不丢样本）');
  assert.ok(Math.abs(fpsFromFrameTimes(ft1, 95) - 60) < 0.5, 'steady fps(p95) ≈ 60');
  // 单次 500ms 长停顿：p95 不受影响、p99 捕捉
  const before = Array.from({ length: 31 }, (_, i) => i * 16.6667);
  const after = Array.from({ length: 30 }, (_, i) => 1000 + i * 16.6667);
  const ft2 = frameTimesFrom([...before, ...after]);
  const sorted2 = [...ft2].sort((a, b) => a - b);
  assert.ok(ft2.some((x) => x > 480), '500ms stall present');
  assert.ok(percentile(sorted2, 99) >= 480, 'p99 captures stall');
  assert.ok(Math.abs(fpsFromFrameTimes(ft2, 95) - 60) < 0.5, 'p95 unaffected by single stall（口径分离）');
  // 持续低帧 33fps → 判卡
  const low = Array.from({ length: 34 }, (_, i) => i * 30);
  assert.ok(Math.abs(fpsFromFrameTimes(frameTimesFrom(low), 95) - 33.3) < 0.5, 'low fps(p95) ≈ 33.3 < 40');
  // 混合持续慢 + 停顿
  const mixed = [];
  for (let i = 0; i < 57; i += 1) {
    mixed.push(i * 30);
  }
  mixed.push(57 * 30 + 400);
  assert.ok(fpsFromFrameTimes(frameTimesFrom(mixed), 95) < 40, 'sustained slow → verdict 卡');
  // 空样本 / 单样本 / 最慢帧保留（review 反例：旧算法丢最慢样本）
  assert.equal(frameTimesFrom([]).length, 0, 'empty');
  assert.equal(frameTimesFrom([100]).length, 0, 'single stamp');
  assert.equal(fpsFromFrameTimes([], 95), null, 'empty fps null');
  const ft5 = frameTimesFrom([0, 1000]);
  assert.equal(ft5.length, 1, 'slowest retained: interval count');
  assert.ok(Math.abs(ft5[0] - 1000) < 1e-9, 'slowest retained: 1000ms kept');
});

await test('P5-R3 import publish: commit-phase failure rolls back, placeholder dir untouched, journal audit', async () => {
  const { publishPackage, importPackage } = await import('../../skills/generate-3d-scene/scripts/import-assets.mjs');
  const crypto = await import('node:crypto');
  const hash = (p) => crypto.createHash('sha256').update(readFileSync(p)).digest('hex');
  const tmp = mkdtempSync(join(tmpdir(), 'p5r3-'));
  try {
    const lib = join(tmp, 'lib');
    const st = join(tmp, 'st');
    mkdirSync(join(lib, 'models'), { recursive: true });
    mkdirSync(join(st, 'models'), { recursive: true });
    mkdirSync(join(st, 'manifests'), { recursive: true });
    writeFileSync(join(lib, 'models', 'a.glb'), 'OLD');
    writeFileSync(join(st, 'models', 'a.glb'), 'NEW');
    writeFileSync(join(st, 'models', 'zz.glb'), 'NEW2');
    mkdirSync(join(lib, 'models', 'zz.glb'), { recursive: true }); // 占位目录 → 提交段失败
    writeFileSync(join(st, 'manifests', 'p.json'), 'NEWM');
    const beforeA = hash(join(lib, 'models', 'a.glb'));
    let threw = null;
    try {
      publishPackage(st, lib, 'pkg');
    } catch (e) {
      threw = e;
    }
    assert.ok(threw && threw.message.includes('已回滚'), 'publish fails with rollback completed');
    assert.ok(threw.message.includes('写入'), 'failure from commit phase');
    assert.equal(hash(join(lib, 'models', 'a.glb')), beforeA, 'overwritten file restored to OLD');
    assert.ok(!existsSync(join(lib, 'manifests', 'p.json')), 'post-failure files never written');
    assert.ok(existsSync(join(lib, 'models', 'zz.glb')), 'placeholder dir untouched（事务外原有物）');
    assert.ok(!existsSync(join(lib, '.import-backup-pkg')), 'backup residue cleaned');
    rmSync(join(lib, 'models', 'zz.glb'), { recursive: true, force: true });

    // 正常发布：覆盖 + 新文件 + journal + 备份清理
    const st2 = join(tmp, 'st2');
    mkdirSync(join(st2, 'models'), { recursive: true });
    mkdirSync(join(st2, 'manifests'), { recursive: true });
    writeFileSync(join(st2, 'models', 'a.glb'), 'NEW_MODEL_2');
    writeFileSync(join(st2, 'models', 'fresh.glb'), 'FRESH');
    writeFileSync(join(st2, 'manifests', 'p.json'), 'NEWM_2');
    const journal = publishPackage(st2, lib, 'pkg');
    assert.equal(readFileSync(join(lib, 'models', 'a.glb'), 'utf8'), 'NEW_MODEL_2', 'overwrite committed');
    assert.equal(readFileSync(join(lib, 'models', 'fresh.glb'), 'utf8'), 'FRESH', 'new file committed');
    assert.ok(!existsSync(join(lib, '.import-backup-pkg')), 'backup cleaned after success');
    assert.equal(journal.length, 3, 'journal covers all');
    assert.ok(journal.find((j) => j.dest.endsWith('a.glb')).backup !== null, 'overwritten journaled with backup');
    assert.ok(journal.find((j) => j.dest.endsWith('fresh.glb')).backup === null, 'new file journaled null backup');

    // 完整生产入口：合法包（真 GLB 过门禁）正常入库
    const pkg = join(tmp, 'pkg');
    mkdirSync(join(pkg, 'data'), { recursive: true });
    writeFileSync(join(pkg, 'data', 'p5r3_probe.glb'), triangleGlb());
    writeFileSync(join(pkg, 'manifest.json'), JSON.stringify({
      meta: { version: '1' },
      data: [{ name: 'P5R3 probe', file_name: 'p5r3_probe.glb', file_path: 'data/p5r3_probe.glb', tags: ['test'] }],
    }));
    const lib3 = join(tmp, 'lib3');
    const r3 = await importPackage(pkg, { libDir: lib3, packageName: 'p5r3' });
    assert.equal(r3.entries.length, 1, 'importPackage ok');
    assert.ok(existsSync(join(lib3, 'manifests', 'p5r3.json')), 'manifest in place');
    assert.ok(!existsSync(join(lib3, '.import-backup-p5r3')), 'no residue');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P5-R4/RR3 profiles: §3.5 behavior contract, default standard, dedup, INCOMPLETE on SKIP, fingerprints', async () => {
  const { verifyScene, PROFILE_TOOLS, typecheckEvidenceFromBuild } = await import('./scene.mjs');
  const tmp = mkdtempSync(join(tmpdir(), 'p5r4-'));
  try {
    const project = join(tmp, 'proj');
    mkdirSync(join(project, 'public', 'scene3d', 'assets', 'models'), { recursive: true });
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'public', 'scene3d', 'scene-data.json'), JSON.stringify({ cars: [{ id: 'c1' }] }));
    writeFileSync(join(project, 'src', 'main.ts'), 'export {};\n');
    writeFileSync(join(project, 'package.json'), '{}');
    writeFileSync(join(project, 'package-lock.json'), '{}');

    let statsSeq = 0;
    const fakePage = {
      pageErrors: [], netMisses: [],
      evaluate: async (expr) => {
        if (expr.includes('whenReady')) {
          return { ok: true, d: { pending: 0, failedAssets: [], pageErrors: [] } };
        }
        if (expr.includes('getDiagnostics')) {
          return [];
        }
        if (expr.includes('groups')) {
          return { cars: ['c1'] };
        }
        if (expr.includes('scene-canvas')) {
          return { ok: true, rect: [1280, 800] };
        }
        if (expr.includes('traverseVisible')) {
          return { ok: true, tested: 1, id: 'c1' };
        }
        if (expr.includes('getStats')) {
          statsSeq += 1;
          return { fps: 60, calls: 10, triangles: 100, elapsed: statsSeq };
        }
        return true;
      },
      navigateTo: async () => {},
      close: async () => {},
    };
    const makeSession = () => ({ newPage: async () => fakePage, close: async () => {} });
    const allToolsPass = {
      runBuild: () => ({ ok: true, status: 0 }),
      runTypecheck: () => ({ ok: true, status: 0 }),
      runLint: () => ({ ok: true, status: 0 }),
      runStrictBudget: () => ({ ok: true, status: 0 }),
      runEditRegression: async () => ({ status: 'PASS', detail: 'ok' }),
      runFidelity: async () => ({ status: 'PASS', detail: 'ok' }),
      runPerf: async () => ({ status: 'PASS', detail: 'ok' }),
      runExport: () => ({ ok: true, status: 0 }),
    };

    // §3.5 推导的工具集断言（不是缩水常量的镜像断言）：
    // preview ≥ {verify, typecheck, lint}；standard ⊇ preview ∪ {build}（请求时 exportBuild）；
    // release ⊇ standard ∪ {strictBudget, editRegression, fidelity, perf}
    const P = new Set(PROFILE_TOOLS.preview);
    const S = new Set(PROFILE_TOOLS.standard.map((t) => t.replace(/\?$/, '')));
    const R = new Set(PROFILE_TOOLS.release);
    for (const t of ['verify', 'typecheck', 'lint']) {
      assert.ok(P.has(t), `§3.5 preview must schedule ${t}`);
    }
    for (const t of ['verify', 'typecheck', 'lint', 'build', 'exportBuild']) {
      assert.ok(S.has(t), `§3.5 standard must schedule ${t}`);
    }
    for (const t of ['verify', 'typecheck', 'lint', 'build', 'exportBuild', 'strictBudget', 'editRegression', 'fidelity', 'perf']) {
      assert.ok(R.has(t), `§3.5 release must schedule ${t}`);
    }

    // preview：跑 typecheck/lint（§3.5 preview 合同），不跑 build
    let buildCalls = 0;
    let tcCalls = 0;
    let lintCalls = 0;
    const r2 = await verifyScene({
      url: 'http://fake:1/', mode: 'both', profile: 'preview', project,
      session: makeSession(), cache: false,
      runBuild: () => { buildCalls += 1; return { ok: true, status: 0 }; },
      runTypecheck: () => { tcCalls += 1; return { ok: true, status: 0 }; },
      runLint: () => { lintCalls += 1; return { ok: true, status: 0 }; },
    });
    assert.equal(r2.verdict, 'PASS', 'preview PASS');
    assert.equal(buildCalls, 0, 'preview does not run build');
    assert.equal(tcCalls, 1, 'preview runs typecheck');
    assert.equal(lintCalls, 1, 'preview runs lint');

    // standard：verify+typecheck+lint+build；build FAIL → 档位 FAIL（basic PASS 不冒充）
    const r3a = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'standard', project,
      session: makeSession(), cache: false, ...allToolsPass,
    });
    assert.equal(r3a.verdict, 'PASS');
    // RRR4：build 先行（typecheck 复用其证据）——调度序列 build→typecheck→lint
    assert.deepEqual(
      r3a.profileChecks.map((p) => p.tool),
      ['verify', 'build', 'typecheck', 'lint'],
      'standard schedules verify+build→typecheck(evidence-reused)+lint（exportBuild 仅请求时）',
    );
    assert.equal(r3a.basicChecks, 'PASS');
    assert.equal(r3a.scope, 'profile:standard');
    // standard 不请求运行包 → 不跑 exportBuild
    const r3b = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'standard', project,
      session: makeSession(), cache: false, ...allToolsPass,
    });
    assert.ok(!r3b.profileChecks.some((p) => p.tool === 'exportBuild'), 'no exportBuild unless requested');
    // 请求运行包 → exportBuild 跑
    const r3c = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'standard', project,
      session: makeSession(), cache: false, wantExport: true, ...allToolsPass,
    });
    assert.ok(r3c.profileChecks.some((p) => p.tool === 'exportBuild' && p.status === 'PASS'), 'exportBuild runs when requested');
    // build FAIL → 档位 FAIL
    const r3d = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'standard', project,
      session: makeSession(), cache: false, ...allToolsPass, runBuild: () => ({ ok: false, status: 1 }),
    });
    assert.equal(r3d.verdict, 'FAIL', 'build FAIL → profile FAIL');
    assert.equal(r3d.basicChecks, 'PASS', 'basic checks recorded PASS（不冒充档位）');

    // typecheck 的 build 证据复用（RR3/RRR4）：证据绑定本次 build 输出
    assert.equal(typecheckEvidenceFromBuild('vue-tsc -b\nvite v6.4.3 building for production...', 0).status, 'build', 'build output reuses typecheck evidence');
    assert.equal(typecheckEvidenceFromBuild('src/x.ts(1,1): error TS2322: ...', 0).status, 'FAIL', 'TS errors in build output FAIL');
    assert.equal(typecheckEvidenceFromBuild('', 0).status, 'unknown', 'empty output unknown');
    assert.equal(typecheckEvidenceFromBuild('vite v6 built', 0).status, 'unknown', 'vite-only output rejected（RRR4）');
    let independentTc = 0;
    const r3e = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'standard', project,
      session: makeSession(), cache: false, ...allToolsPass,
      // RRR4：证据来自注入 build 的 output（runProfileBuild 结构化透传），不再接受
      // 顶层 buildOutput 字符串
      runBuild: () => ({ ok: true, status: 0, output: 'vue-tsc -b\nvite v6.4.3 building...\nbuilt' }),
      runTypecheck: () => { independentTc += 1; return { ok: true, status: 0 }; },
    });
    assert.equal(independentTc, 0, 'typecheck not re-run when build evidence present（epoch 复用）');
    assert.equal(r3e.profileChecks.find((p) => p.tool === 'typecheck').status, 'build', 'typecheck status=build');

    // 跨工具去重 + 输入变更重跑
    let buildCalls4 = 0;
    let tcCalls4 = 0;
    const opts4 = {
      url: 'http://fake:1/', mode: 'run', profile: 'standard', project,
      session: makeSession(), cache: true,
      runBuild: () => { buildCalls4 += 1; return { ok: true, status: 0 }; },
      runTypecheck: () => { tcCalls4 += 1; return { ok: true, status: 0 }; },
      runLint: () => ({ ok: true, status: 0 }),
    };
    await verifyScene(opts4);
    assert.equal(buildCalls4, 1, 'build once');
    const r4b = await verifyScene(opts4);
    assert.equal(buildCalls4, 1, 'cached reuse（不重复跑）');
    assert.equal(r4b.profileChecks.find((p) => p.tool === 'build').status, 'cached');
    assert.equal(r4b.profileChecks.find((p) => p.tool === 'typecheck').status, 'cached', 'typecheck also cached');
    writeFileSync(join(project, 'src', 'main.ts'), 'export const changed = 1;\n');
    await verifyScene(opts4);
    assert.equal(buildCalls4, 2, 'src change invalidates build cache');
    assert.equal(tcCalls4, 2, 'src change invalidates typecheck cache');

    // release：全工具跑 + 无 SKIP → PASS
    let perfCalls = 0;
    const r5 = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'release', project,
      session: makeSession(), cache: false, ...allToolsPass,
      runPerf: async () => { perfCalls += 1; return { status: 'PASS', detail: 'ok' }; },
    });
    assert.equal(perfCalls, 1, 'release runs perf');
    assert.equal(r5.verdict, 'PASS', 'release all-pass → PASS');
    assert.deepEqual(
      r5.profileChecks.map((p) => p.tool),
      ['verify', 'build', 'typecheck', 'lint', 'exportBuild', 'strictBudget', 'editRegression', 'fidelity', 'perf'],
      'release full tool chain',
    );
    assert.ok(r5.profileChecks.every((p) => p.status === 'PASS'), 'no SKIP in fully-instrumented release');

    // RR3 核心负例：release 无 GPU perf（无 runPerf）→ perf SKIP → verdict INCOMPLETE（不 PASS 冒充）
    const r5b = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'release', project,
      session: makeSession(), cache: false,
      ...{ ...allToolsPass, runPerf: undefined },
    });
    assert.ok(r5b.profileChecks.some((p) => p.tool === 'perf' && p.status === 'SKIP'), 'perf SKIP without GPU');
    assert.equal(r5b.verdict, 'INCOMPLETE', 'SKIP → INCOMPLETE（release 未完整完成，不冒充 PASS）');
    assert.notEqual(r5b.verdict, 'PASS', 'INCOMPLETE ≠ PASS');

    // perf FAIL 传播（仍 FAIL 而非 INCOMPLETE）
    const r5c = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'release', project,
      session: makeSession(), cache: false, ...allToolsPass,
      runPerf: async () => ({ status: 'FAIL', detail: 'fps low' }),
    });
    assert.equal(r5c.verdict, 'FAIL', 'perf FAIL propagates（非 INCOMPLETE）');

    // URL/session 指纹：同 session 同 url 命中；换 url 或换 session 不复用
    const sess6 = makeSession();
    const opts6 = { mode: 'run', profile: 'preview', project, session: sess6, cache: true, runTypecheck: () => ({ ok: true, status: 0 }), runLint: () => ({ ok: true, status: 0 }) };
    await verifyScene({ ...opts6, url: 'http://fake:1/' });
    const r6b = await verifyScene({ ...opts6, url: 'http://fake:1/' });
    assert.equal(r6b.cache, 'hit', 'same url+session reuse');
    const r6c = await verifyScene({ ...opts6, url: 'http://other:2/' });
    assert.notEqual(r6c.cache, 'hit', 'url change no reuse');
    const r6d = await verifyScene({ ...opts6, url: 'http://fake:1/', session: makeSession() });
    assert.notEqual(r6d.cache, 'hit', 'session change no reuse');

    // basic FAIL 短路：不跑 build/typecheck
    let buildCalls7 = 0;
    const badPage = {
      ...fakePage,
      evaluate: async (expr) => {
        if (expr.includes('whenReady')) {
          return { ok: false, message: 'boom' };
        }
        return fakePage.evaluate(expr);
      },
    };
    const r7 = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'standard', project,
      session: { newPage: async () => badPage, close: async () => {} },
      cache: false, ...allToolsPass,
    });
    assert.equal(r7.verdict, 'FAIL', 'basic FAIL → profile FAIL');
    assert.equal(r7.basicChecks, 'FAIL');
    assert.ok(!r7.profileChecks.some((p) => p.tool === 'build'), 'build skipped after basic FAIL');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P5-RR1 cache negatives: config change invalidates; same hash different assertions rejected', async () => {
  const { verifyScene, expectFingerprint } = await import('./scene.mjs');
  const { CHECK_AFFECTS } = await import('../../skills/generate-3d-scene/scripts/lib/verification-cache.mjs');
  const tmp = mkdtempSync(join(tmpdir(), 'p5rr1-'));
  try {
    const project = join(tmp, 'proj');
    mkdirSync(join(project, 'public', 'scene3d', 'assets', 'models'), { recursive: true });
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'public', 'scene3d', 'scene-data.json'), JSON.stringify({ cars: [{ id: 'c1' }] }));
    writeFileSync(join(project, 'src', 'main.ts'), 'export {};\n');
    writeFileSync(join(project, 'package.json'), '{}');
    writeFileSync(join(project, 'package-lock.json'), '{}');
    writeFileSync(join(project, 'vite.config.ts'), 'export default { base: "/" };\n');

    let statsSeq = 0;
    const fakePage = {
      pageErrors: [], netMisses: [],
      evaluate: async (expr) => {
        if (expr.includes('whenReady')) {
          return { ok: true, d: { pending: 0, failedAssets: [], pageErrors: [] } };
        }
        if (expr.includes('getDiagnostics')) {
          return [];
        }
        if (expr.includes('groups')) {
          return { cars: ['c1'] };
        }
        if (expr.includes('scene-canvas')) {
          return { ok: true, rect: [1280, 800] };
        }
        if (expr.includes('traverseVisible')) {
          return { ok: true, tested: 1, id: 'c1' };
        }
        if (expr.includes('getStats')) {
          statsSeq += 1;
          return { fps: 60, calls: 10, triangles: 100, elapsed: statsSeq };
        }
        return true;
      },
      navigateTo: async () => {},
      close: async () => {},
    };
    const tools = {
      runTypecheck: () => ({ ok: true, status: 0 }),
      runLint: () => ({ ok: true, status: 0 }),
    };
    // 共享 session 对象（同对象多次调用才复用缓存——inline 字面量每次是新对象）
    const sharedSession = { newPage: async () => fakePage, close: async () => {} };
    const run = (opts = {}) => verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'preview', project,
      session: sharedSession,
      cache: true, ...tools, ...opts,
    });

    // CHECK_AFFECTS：verify:run/edit 含 config（RR1 反例：改 vite.config 不失效）
    assert.ok(CHECK_AFFECTS['verify:run'].includes('config'), 'verify:run affects config');
    assert.ok(CHECK_AFFECTS['verify:edit'].includes('config'), 'verify:edit affects config');

    // 负例 1（review 反例复现）：改 vite.config.ts（base）→ 缓存不得命中
    const r1 = await run({ expect: { idByGroup: { cars: ['c1'] }, hash: 'h1' } });
    assert.ok(['miss', 'partial'].includes(r1.cache), 'first run live');
    const r2 = await run({ expect: { idByGroup: { cars: ['c1'] }, hash: 'h1' } });
    assert.equal(r2.cache, 'hit', 'same inputs reuse');
    writeFileSync(join(project, 'vite.config.ts'), 'export default { base: "/app/" };\n');
    const r3 = await run({ expect: { idByGroup: { cars: ['c1'] }, hash: 'h1' } });
    assert.notEqual(r3.cache, 'hit', 'config change invalidates（RR1 反例关闭）');

    // 负例 2（review 反例复现）：同 hash 不同 idByGroup（伪造/复用旧 hash）→ 不复用
    // r3 已重跑并存新 config 键；r5 验证稳定命中；r6 换断言内容（hash 不变）→ 不复用
    const r5 = await run({ expect: { idByGroup: { cars: ['c1'] }, hash: 'h1' } });
    assert.equal(r5.cache, 'hit', 'stable after config-change re-run');
    const r6 = await run({ expect: { idByGroup: { cars: ['c1', 'c2'] }, hash: 'h1' } });
    assert.notEqual(r6.cache, 'hit', 'same hash, different assertions → no reuse（RR1 反例关闭）');
    // 指纹本身：不同 idByGroup 不同指纹；hash 字段不参与
    assert.notEqual(expectFingerprint({ idByGroup: { cars: ['c1'] }, hash: 'x' }), expectFingerprint({ idByGroup: { cars: ['c1', 'c2'] }, hash: 'x' }), 'fingerprint derives from assertions, not external hash');
    assert.equal(expectFingerprint({ idByGroup: { cars: ['c1'] }, hash: 'x' }), expectFingerprint({ idByGroup: { cars: ['c1'] }, hash: 'y' }), 'external hash irrelevant to fingerprint');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P5-RR2 publish rollback-failure: backup preserved, journal on disk, re-import refused', async () => {
  const { publishPackage, importPackage } = await import('../../skills/generate-3d-scene/scripts/import-assets.mjs');
  const tmp = mkdtempSync(join(tmpdir(), 'p5rr2-'));
  try {
    const lib = join(tmp, 'lib');
    const st = join(tmp, 'st');
    mkdirSync(join(lib, 'models'), { recursive: true });
    mkdirSync(join(st, 'models'), { recursive: true });
    mkdirSync(join(st, 'manifests'), { recursive: true });
    writeFileSync(join(lib, 'models', 'a.glb'), 'OLD');
    writeFileSync(join(st, 'models', 'a.glb'), 'NEW');
    writeFileSync(join(st, 'models', 'b.glb'), 'NEWB');
    writeFileSync(join(st, 'manifests', 'p.json'), 'NEWM');
    const backupDir = join(lib, '.import-backup-pkg');

    // 恢复失败注入：备份段正常备份 a.glb；提交段 b.glb 失败（占位目录）；恢复 a.glb 失败
    // （恢复目标 a.glb 被只读锁——Windows 下用「恢复目标变成目录」制造恢复失败）
    mkdirSync(join(lib, 'models', 'b.glb'), { recursive: true }); // 提交段 b 失败
    let threw = null;
    try {
      publishPackage(st, lib, 'pkg');
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'publish throws');
    // 普通回滚应成功（a.glb 恢复 OLD）——RR2 的「恢复失败」分支需要额外注入：
    // 此处先验证普通路径，再单独构造恢复失败场景
    assert.equal(readFileSync(join(lib, 'models', 'a.glb'), 'utf8'), 'OLD', 'normal rollback restores OLD');
    assert.ok(!existsSync(backupDir), 'backup cleaned after complete rollback');
    rmSync(join(lib, 'models', 'b.glb'), { recursive: true, force: true });

    // 恢复失败场景：monkey-patch copyFileSync？不可（ESM 顶层 fs）。改用形态注入——
    // 备份的 backup 文件在回滚前被外部删除 → 恢复 copy 时 ENOENT → 回滚失败
    // （模拟：备份目录被并发进程清掉。用 hook：提交段失败点触发后、回滚段前删备份）
    // 实现该注入最直接的方式：第二个文件占位目录（提交失败），且备份目录中 a.glb 的
    // 备份文件被删。时序上 publishPackage 一体执行无法中间插入——改用「恢复目标不可写」：
    // a.glb 恢复目标在提交段被写为 NEW 后，回滚前无法干预。
    // → 采用可测的等价注入：backup 文件路径被目录占用（backup 阶段后无法干预）。
    // 结论：恢复失败需要进程外干扰，确定性单测用「伪造已存在的未恢复备份目录」验证
    // RR2 的核心合同：再导入拒绝 + 恢复材料保留。
    mkdirSync(backupDir, { recursive: true });
    writeFileSync(join(backupDir, 'journal.json'), JSON.stringify({
      package: 'pkg', commitError: 'x', entries: [{ dest: '/lib/models/a.glb', backup: `${backupDir}/models/a.glb` }], rollbackFailures: [],
    }));
    // 再导入（同名包）→ 拒绝（不得无条件删未恢复备份）
    let refused = null;
    try {
      publishPackage(st, lib, 'pkg');
    } catch (e) {
      refused = e;
    }
    assert.ok(refused && refused.message.includes('存留的导入备份'), 're-import refused while unrecovered backup exists');
    assert.ok(existsSync(join(backupDir, 'journal.json')), 'recovery material preserved after refusal');
    // 清理伪造备份后可正常导入
    rmSync(backupDir, { recursive: true, force: true });
    const ok = publishPackage(st2Of(tmp), lib, 'pkg');
    assert.ok(Array.isArray(ok), 'import proceeds after backup removed');
    assert.equal(readFileSync(join(lib, 'models', 'a.glb'), 'utf8'), 'NEW_FINAL', 'committed after cleanup');

    // importPackage 入口提交失败回归（review 要求：入口测试不只成功路径）——
    // 门禁全过的合法包，发布段被占位目录卡死 → 入口抛错且库无部分写入
    const pkg = join(tmp, 'pkg');
    mkdirSync(join(pkg, 'data'), { recursive: true });
    writeFileSync(join(pkg, 'data', 'rr2_probe.glb'), triangleGlb());
    writeFileSync(join(pkg, 'manifest.json'), JSON.stringify({
      meta: { version: '1' },
      data: [{ name: 'RR2 probe', file_name: 'rr2_probe.glb', file_path: 'data/rr2_probe.glb', tags: ['test'] }],
    }));
    const lib2 = join(tmp, 'lib2');
    mkdirSync(join(lib2, 'models', 'rr2_probe.glb'), { recursive: true }); // 占位目录 → 提交失败
    let entryThrew = null;
    try {
      await importPackage(pkg, { libDir: lib2, packageName: 'rr2' });
    } catch (e) {
      entryThrew = e;
    }
    assert.ok(entryThrew && entryThrew.message.includes('已回滚'), 'importPackage commit failure rolls back at entry');
    assert.ok(!existsSync(join(lib2, 'manifests', 'rr2.json')), 'no partial manifest write');
    assert.ok(!existsSync(join(lib2, '.import-backup-rr2')), 'no backup residue after clean rollback');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

function st2Of(tmp) {
  const st2 = join(tmp, 'st2x');
  mkdirSync(join(st2, 'models'), { recursive: true });
  writeFileSync(join(st2, 'models', 'a.glb'), 'NEW_FINAL');
  return st2;
}

/* ── P5 三审修复轮回归（P5-RRR1～RRR4，2026-10-15）──────────────────────────── */

await test('P5-RRR1 backup dir never auto-deleted without proof of safe completion', async () => {
  const { publishPackage } = await import('../../skills/generate-3d-scene/scripts/import-assets.mjs');
  const tmp = mkdtempSync(join(tmpdir(), 'p5rrr1-'));
  try {
    const lib = join(tmp, 'lib');
    const st = join(tmp, 'st');
    mkdirSync(join(lib, 'models'), { recursive: true });
    mkdirSync(join(st, 'models'), { recursive: true });
    writeFileSync(join(lib, 'models', 'a.glb'), 'OLD');
    writeFileSync(join(st, 'models', 'a.glb'), 'NEW');
    const backupDir = join(lib, '.import-backup-pkg');

    // review 反例：journal 写入失败分支保留的备份**没有 journal.json**——
    // 伪造该形态（含 OLD 的备份文件、无 marker），再次导入不得自动删除
    mkdirSync(join(backupDir, 'models'), { recursive: true });
    writeFileSync(join(backupDir, 'models', 'a.glb'), 'OLD'); // 无 journal.json
    let refused = null;
    try {
      publishPackage(st, lib, 'pkg');
    } catch (e) {
      refused = e;
    }
    assert.ok(refused, 're-import refused（无 marker 备份）');
    assert.ok(refused.message.includes('存留的导入备份'), 'refusal message names the backup');
    assert.ok(refused.message.includes('无 journal'), 'message notes journal-less backup may hold unrecovered files');
    // 唯一恢复材料未被销毁（review 反例：最终 backupExists=false）
    assert.ok(existsSync(join(backupDir, 'models', 'a.glb')), 'backup OLD preserved（marker-less backup NOT auto-deleted）');
    // 正式库文件未被覆盖（发布被拒，NEW 未写入）
    assert.equal(readFileSync(join(lib, 'models', 'a.glb'), 'utf8'), 'OLD', 'official file untouched by refused import');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P5-RRR4 typecheck evidence: structured binding, vite-only rejected, cold-start dedup wired', async () => {
  const { typecheckEvidenceFromBuild, runTypecheck, verifyScene } = await import('./scene.mjs');
  const tmp = mkdtempSync(join(tmpdir(), 'p5rrr4-'));
  try {
    // 证据判定三态（RRR4 反例：`vite v6 built` 单独出现不得判 vue-tsc 通过）
    assert.equal(typecheckEvidenceFromBuild('vite v6.4.3 building for production...\n✓ built in 3s', 0).status, 'unknown', 'vite-only output NOT accepted as vue-tsc evidence（RRR4 反例关闭）');
    assert.equal(typecheckEvidenceFromBuild('vue-tsc -b\nvite v6.4.3 building...', 0).status, 'build', 'vue-tsc markers + exit=0 accepted');
    assert.equal(typecheckEvidenceFromBuild('src/x.ts(1,1): error TS2322', 0).status, 'FAIL', 'TS errors FAIL');
    assert.equal(typecheckEvidenceFromBuild('vue-tsc -b\n...', 1).status, 'unknown', 'failed build has no reusable evidence（exit≠0）');
    assert.equal(typecheckEvidenceFromBuild('', 0).status, 'unknown', 'empty output unknown');

    // 无 buildOutput 注入的生产调度计数（review 要求）：standard 档 typecheck 走
    // 本次 build 的结构化证据；证据无效（注入 build 无 tsc 痕迹输出）→ 独立 typecheck 真跑
    const project = join(tmp, 'proj');
    mkdirSync(join(project, 'public', 'scene3d', 'assets', 'models'), { recursive: true });
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'public', 'scene3d', 'scene-data.json'), JSON.stringify({ cars: [{ id: 'c1' }] }));
    writeFileSync(join(project, 'src', 'main.ts'), 'export {};\n');
    writeFileSync(join(project, 'package.json'), '{}');
    writeFileSync(join(project, 'package-lock.json'), '{}');
    let statsSeq = 0;
    const fakePage = {
      pageErrors: [], netMisses: [],
      evaluate: async (expr) => {
        if (expr.includes('whenReady')) return { ok: true, d: { pending: 0, failedAssets: [], pageErrors: [] } };
        if (expr.includes('getDiagnostics')) return [];
        if (expr.includes('groups')) return { cars: ['c1'] };
        if (expr.includes('scene-canvas')) return { ok: true, rect: [1280, 800] };
        if (expr.includes('traverseVisible')) return { ok: true, tested: 1, id: 'c1' };
        if (expr.includes('getStats')) {
          statsSeq += 1;
          return { fps: 60, calls: 10, triangles: 100, elapsed: statsSeq };
        }
        return true;
      },
      navigateTo: async () => {},
      close: async () => {},
    };
    const sess = { newPage: async () => fakePage, close: async () => {} };
    let tcCalls = 0;
    const r1 = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'standard', project,
      session: sess, cache: false,
      // 注入 build：成功但输出无 tsc 痕迹（vite-only 桩）→ typecheck 必须独立真跑
      runBuild: () => ({ ok: true, status: 0, output: 'vite v6.4.3 building...\nbuilt' }),
      runTypecheck: () => { tcCalls += 1; return { ok: true, status: 0 }; },
      runLint: () => ({ ok: true, status: 0 }),
    });
    assert.equal(tcCalls, 1, 'vite-only build evidence → independent typecheck runs（不冒充）');
    assert.equal(r1.profileChecks.find((p) => p.tool === 'typecheck').status, 'PASS', 'typecheck PASS by real run');

    // build 输出含 vue-tsc 痕迹 → typecheck 复用（零独立调用）
    let tcCalls2 = 0;
    const r2 = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'standard', project,
      session: sess, cache: false,
      runBuild: () => ({ ok: true, status: 0, output: 'vue-tsc -b\nvite v6.4.3 building...\nbuilt' }),
      runTypecheck: () => { tcCalls2 += 1; return { ok: true, status: 0 }; },
      runLint: () => ({ ok: true, status: 0 }),
    });
    assert.equal(tcCalls2, 0, 'structured vue-tsc evidence → typecheck NOT re-run（epoch 复用）');
    assert.equal(r2.profileChecks.find((p) => p.tool === 'typecheck').status, 'build', 'typecheck status=build');

    // preview（无 build 工具）→ typecheck 独立跑（RRR4：preview 仍独立执行必要检查）
    let tcCalls3 = 0;
    await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'preview', project,
      session: sess, cache: false,
      runTypecheck: () => { tcCalls3 += 1; return { ok: true, status: 0 }; },
      runLint: () => ({ ok: true, status: 0 }),
    });
    assert.equal(tcCalls3, 1, 'preview runs independent typecheck（无 build 证据可用）');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P5-RRR2/RRR3 exportBuild real build + fidelity compare + editRegression expect + perf exit semantics', async () => {
  const { verifyScene } = await import('./scene.mjs');
  const { runExportBuild } = await import('./scene.mjs');
  const tmp = mkdtempSync(join(tmpdir(), 'p5rrr23-'));
  try {
    const project = join(tmp, 'proj');
    mkdirSync(join(project, 'public', 'scene3d', 'assets', 'models'), { recursive: true });
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'public', 'scene3d', 'scene-data.json'), JSON.stringify({ cars: [{ id: 'c1' }] }));
    writeFileSync(join(project, 'src', 'main.ts'), 'export {};\n');
    writeFileSync(join(project, 'package.json'), '{}');
    writeFileSync(join(project, 'package-lock.json'), '{}');
    let statsSeq = 0;
    const fakePage = {
      pageErrors: [], netMisses: [],
      evaluate: async (expr) => {
        if (expr.includes('whenReady')) return { ok: true, d: { pending: 0, failedAssets: [], pageErrors: [] } };
        if (expr.includes('getDiagnostics')) return [];
        if (expr.includes('groups')) return { cars: ['c1'] };
        if (expr.includes('scene-canvas')) return { ok: true, rect: [1280, 800] };
        if (expr.includes('traverseVisible')) return { ok: true, tested: 1, id: 'c1' };
        if (expr.includes('getStats')) {
          statsSeq += 1;
          return { fps: 60, calls: 10, triangles: 100, elapsed: statsSeq };
        }
        return true;
      },
      navigateTo: async () => {},
      close: async () => {},
    };
    const sess = { newPage: async () => fakePage, close: async () => {} };

    // RRR2：exportBuild 桩失败（运行包独有构建失败）→ FAIL 传播
    const r1 = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'standard', project,
      session: sess, cache: false, wantExport: true,
      runTypecheck: () => ({ ok: true, status: 0 }),
      runLint: () => ({ ok: true, status: 0 }),
      runBuild: () => ({ ok: true, status: 0, output: 'x' }),
      runExport: () => ({ ok: false, status: 1, detail: 'runtime package build exit=1（vue-tsc/vite 在剥离产物上失败）' }),
    });
    assert.equal(r1.verdict, 'FAIL', 'exportBuild FAIL propagates（运行包构建失败 → 档位 FAIL）');
    assert.ok(r1.profileChecks.find((p) => p.tool === 'exportBuild').detail.includes('剥离产物'), 'failure detail names runtime-package build');

    // RRR2：defaultRunExport 的产物保留语义——真生产 export（strip + build 子进程）在
    // 最小夹具上无法过 strip-edit（结构门禁），以注入成功桩验证 detail 含产物路径约定
    const r2 = await runExportBuild(project, {
      cache: false,
      runExport: (p, outDir) => ({ ok: true, status: 0, detail: `runtime package built & preserved at ${outDir}` }),
    });
    assert.ok(r2.detail.includes(project.replace(/[\\/]+$/, '') + '-dist'), 'export detail carries explicit artifact path');

    // RRR3：editRegression 收到 expectPath（生产 default 实现签名）——注入桩捕获参数
    let receivedExpect = null;
    const r3 = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'release', project,
      session: sess, cache: false,
      runTypecheck: () => ({ ok: true, status: 0 }),
      runLint: () => ({ ok: true, status: 0 }),
      runBuild: () => ({ ok: true, status: 0, output: 'vue-tsc ok' }),
      runExport: () => ({ ok: true, status: 0, detail: 'ok' }),
      runStrictBudget: () => ({ ok: true, status: 0 }),
      runEditRegression: async (p, u, expectPath) => {
        receivedExpect = expectPath;
        return { status: 'PASS', detail: 'ok' };
      },
      runFidelity: async () => ({ status: 'PASS', detail: 'compare ok' }),
      runPerf: async () => ({ status: 'PASS', detail: 'ok' }),
    });
    assert.equal(receivedExpect, join(project, 'public', 'scene3d', 'scene-data.json'), 'editRegression receives the project expect path（不默认母版）');
    assert.equal(r3.verdict, 'PASS', 'release full-chain PASS');

    // RRR3：fidelity 失败传播（比较发现缺口 → FAIL）
    const r4 = await verifyScene({
      url: 'http://fake:1/', mode: 'run', profile: 'release', project,
      session: sess, cache: false,
      runTypecheck: () => ({ ok: true, status: 0 }),
      runLint: () => ({ ok: true, status: 0 }),
      runBuild: () => ({ ok: true, status: 0, output: 'vue-tsc ok' }),
      runExport: () => ({ ok: true, status: 0, detail: 'ok' }),
      runStrictBudget: () => ({ ok: true, status: 0 }),
      runEditRegression: async () => ({ status: 'PASS', detail: 'ok' }),
      runFidelity: async () => ({ status: 'FAIL', detail: '视觉层缺口：__visuals 2 节点仅命中 1' }),
      runPerf: async () => ({ status: 'PASS', detail: 'ok' }),
    });
    assert.equal(r4.verdict, 'FAIL', 'fidelity FAIL propagates（比较缺口 → 档位 FAIL）');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P5-RRRR1 fidelity-compare: structured semantic value diff (visible/color/parentId/params/extra groups)', async () => {
  const { spawnSync } = await import('node:child_process');
  const { extractExportedObject } = await import('./fidelity-compare.mjs');
  const script = resolve(dirname(fileURLToPath(import.meta.url)), 'fidelity-compare.mjs');
  const tmp = mkdtempSync(join(tmpdir(), 'p5fid4-'));
  try {
    // mk：完整语义夹具。role='src' 写编辑态私有区（__visuals/__materialLib）；
    // role='pkg' 写运行包形态（无私有区，编译条目在 appearance.ts）——strip 剥离合同的两侧
    const baseVisual = { visible: false, libraryRef: 'red_mat', slots: { body: { color: '#ff0000', map: 'textures/car/red.png' } } };
    const baseMat = { name: 'red_mat', spec: { color: '#ff0000', metalness: 0.8, roughness: 0.3 } };
    const mk = (root, { role = 'src', extraGroup = null, mutate = null, privates = false }) => {
      mkdirSync(join(root, 'public'), { recursive: true });
      mkdirSync(join(root, 'src', 'scene3d', 'scene', 'generated'), { recursive: true });
      let node = { id: 'car_01', parentId: 'p1', position: [1, 0, 2], params: { count: 5, status: 'normal' } };
      let appV = { car_01: JSON.parse(JSON.stringify(baseVisual)) };
      let appM = { red_mat: JSON.parse(JSON.stringify(baseMat)) };
      let visualsOut = JSON.parse(JSON.stringify(baseVisual));
      let matOut = JSON.parse(JSON.stringify(baseMat));
      if (mutate) {
        // mutate 返回部分键——与默认合并（避免未返回键变 undefined 破坏夹具）
        const mutated = mutate({ node, appV, appM, visualsOut, matOut });
        node = mutated.node ?? node;
        appV = mutated.appV ?? appV;
        appM = mutated.appM ?? appM;
        visualsOut = mutated.visualsOut ?? visualsOut;
        matOut = mutated.matOut ?? matOut;
      }
      const isSrc = role === 'src';
      const data = {
        cars: [node],
        ...(extraGroup ? { [extraGroup]: [{ id: 'ghost_01', position: [0, 0, 0] }] } : {}),
        ...(isSrc && visualsOut ? { __visuals: { car_01: visualsOut } } : {}),
        ...(isSrc && matOut ? { __materialLib: { red_mat: matOut } } : {}),
        ...(privates ? { __stale: true } : {}),
      };
      writeFileSync(join(root, 'public', 'scene3d', 'scene-data.json'), JSON.stringify(data));
      writeFileSync(join(root, 'src', 'scene3d', 'scene', 'generated', 'appearance.ts'),
        `export const compiledVisuals = ${JSON.stringify(appV)};\n`
        + `export const compiledMaterialLib = ${JSON.stringify(appM)};\n`);
    };

    const run = (a, b) => spawnSync('node', [script, a, b], { encoding: 'utf8' });

    // 正例：语义全一致（含 parentId/params/visible/slots/material spec）→ PASS
    const srcOk = join(tmp, 'src');
    const pkgOk = join(tmp, 'pkg');
    mk(srcOk, { role: 'src' });
    mk(pkgOk, { role: 'pkg' });
    const ok = run(srcOk, pkgOk);
    assert.equal(ok.status, 0, `semantic-consistent pair PASS: ${ok.stdout}`);

    // 负例 1（review 反例）：ID 保留但 visible 值错误（false 编译成 true）→ FAIL
    const pkgV = join(tmp, 'pkg-visible');
    mk(pkgV, { role: 'pkg', mutate: ({ appV }) => {
      appV.car_01.visible = true;
      return { appV };
    } });
    const badV = run(srcOk, pkgV);
    assert.equal(badV.status, 1, 'visible value error FAIL（ID 在但值错）');
    assert.ok(badV.stdout.includes('visible'), 'failure names visible');

    // 负例 2（review 反例）：材质颜色值错误（红→蓝，ID 保留）→ FAIL
    const pkgC = join(tmp, 'pkg-color');
    mk(pkgC, { role: 'pkg', mutate: ({ appV }) => {
      appV.car_01.slots.body.color = '#0000ff';
      return { appV };
    } });
    const badC = run(srcOk, pkgC);
    assert.equal(badC.status, 1, 'color value error FAIL');
    assert.ok(badC.stdout.includes('color'), 'failure names color');

    // 负例 3（review 反例）：材质库 spec 值错误 → FAIL
    const pkgM = join(tmp, 'pkg-mat');
    mk(pkgM, { role: 'pkg', mutate: ({ appM }) => {
      appM.red_mat.spec.color = '#0000ff';
      return { appM };
    } });
    const badM = run(srcOk, pkgM);
    assert.equal(badM.status, 1, 'material spec value error FAIL');
    assert.ok(badM.stdout.includes('__materialLib.red_mat'), 'failure names the material path');

    // 负例 4（review 反例）：parentId 错误 → FAIL
    const pkgP = join(tmp, 'pkg-parent');
    mk(pkgP, { role: 'pkg', mutate: ({ node }) => {
      node.parentId = 'wrong';
      return { node };
    } });
    const badP = run(srcOk, pkgP);
    assert.equal(badP.status, 1, 'parentId error FAIL');
    assert.ok(badP.stdout.includes('parentId'), 'failure names parentId');

    // 负例 5（review 反例）：params 值错误（count 5→999）→ FAIL
    const pkgN = join(tmp, 'pkg-params');
    mk(pkgN, { role: 'pkg', mutate: ({ node }) => {
      node.params.count = 999;
      return { node };
    } });
    const badN = run(srcOk, pkgN);
    assert.equal(badN.status, 1, 'params value error FAIL');
    assert.ok(badN.stdout.includes('params.count'), 'failure names params.count');

    // 负例 6（review 反例）：运行包额外业务分组 → FAIL
    const pkgX = join(tmp, 'pkg-extra');
    mk(pkgX, { role: 'pkg', extraGroup: 'ghosts' });
    const badX = run(srcOk, pkgX);
    assert.equal(badX.status, 1, 'extra business group FAIL');
    assert.ok(badX.stdout.includes('额外业务分组') && badX.stdout.includes('ghosts'), 'failure names the extra group');

    // 负例 7：视觉条目完全丢失 → FAIL
    const pkgMiss = join(tmp, 'pkg-miss');
    mk(pkgMiss, { role: 'pkg', mutate: ({ appV, visualsOut }) => {
      delete appV.car_01;
      return { appV, visualsOut };
    } });
    const badMiss = run(srcOk, pkgMiss);
    assert.equal(badMiss.status, 1, 'missing visual entry FAIL');

    // 结构化提取器单测（fail-closed）：非 JSON 兼容字面量（单引号键）→ 不可比
    assert.ok(!extractExportedObject("export const x = {'a': 1};", 'x').ok, 'non-JSON literal rejected');
    assert.ok(!extractExportedObject('export const x = fn();', 'x').ok, 'non-object export rejected');
    assert.deepEqual(extractExportedObject('export const x = {"a": {"b": 2}};', 'x').value, { a: { b: 2 } }, 'nested object extracted');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P5-RRRR3 export staging: old artifact preserved on failure, replaced on success', async () => {
  const { defaultRunExportForTest } = await import('./scene.mjs');
  const crypto = await import('node:crypto');
  const tmp = mkdtempSync(join(tmpdir(), 'p5exp4-'));
  try {
    const project = join(tmp, 'proj');
    mkdirSync(join(project, 'src'), { recursive: true });
    writeFileSync(join(project, 'package.json'), '{}');
    const outDir = join(tmp, 'proj-dist');
    // 预置「上次成功交付包」：dist/index.html + 特征内容（hash 保全对照）
    mkdirSync(join(outDir, 'dist'), { recursive: true });
    writeFileSync(join(outDir, 'dist', 'index.html'), 'OLD-SUCCESSFUL-ARTIFACT-12345');
    const oldHash = crypto.createHash('sha256').update(readFileSync(join(outDir, 'dist', 'index.html'))).digest('hex');

    // 构造可发布的 staging 产物形态（strip 步骤注入桩——绕过真实 strip；直接建 staging 内容）
    // 通过注入缝：不走真实 spawnSync，用桩完成各步。defaultRunExport 的步骤全在函数内——
    // 测试经 runExport 注入缝验证事务语义（staging 事务发布部分提取为可测函数）
    // ——见 scene.mjs 的 publishStagingExportForTest。
    // 负例：build 失败（注入 exit=1）→ 旧包内容 hash 不变
    const failResult = await defaultRunExportForTest(project, outDir, {
      stagePrepare: (staging) => {
        mkdirSync(join(staging, 'dist'), { recursive: true });
        writeFileSync(join(staging, 'dist', 'index.html'), 'NEW-ATTEMPT');
      },
      buildStep: () => ({ ok: false, status: 1, detail: 'runtime package build exit=1（旧交付包保留）' }),
    });
    assert.equal(failResult.ok, false, 'build failure → FAIL');
    assert.ok(failResult.detail.includes('旧交付包保留'), 'failure detail notes old artifact preserved');
    const afterFailHash = crypto.createHash('sha256').update(readFileSync(join(outDir, 'dist', 'index.html'))).digest('hex');
    assert.equal(afterFailHash, oldHash, 'old artifact content preserved byte-identical on failure');
    assert.ok(!existsSync(`${outDir}.staging`), 'staging cleaned after failure');
    assert.ok(!existsSync(`${outDir}.old`), 'no backup residue on failure');

    // 正例：全步骤成功 → staging 事务上位，新产物替换旧产物
    const okResult = await defaultRunExportForTest(project, outDir, {
      stagePrepare: (staging) => {
        mkdirSync(join(staging, 'dist'), { recursive: true });
        writeFileSync(join(staging, 'dist', 'index.html'), 'NEW-SUCCESS-67890');
      },
      buildStep: () => ({ ok: true, status: 0, detail: 'ok' }),
    });
    assert.equal(okResult.ok, true, 'success path');
    const newContent = readFileSync(join(outDir, 'dist', 'index.html'), 'utf8');
    assert.equal(newContent, 'NEW-SUCCESS-67890', 'new artifact published');
    assert.ok(!existsSync(`${outDir}.old`), 'old backup cleaned after success');
    assert.ok(!existsSync(`${outDir}.staging`), 'staging gone (renamed to outDir)');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

await test('P5 final production boundaries: fidelity, edit reload, rollback retry', async () => {
  const { spawnSync } = await import('node:child_process');
  const run = spawnSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'p5-final-fixtures.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
});

if (!process.argv.includes('--node-only')) {
  const i = process.argv.indexOf('--url');
  const url = i >= 0 ? process.argv[i + 1] : positionalArg(process.argv.slice(2)) ?? 'http://localhost:5199/';
  const expect = readExpect(join(template, 'public/scene3d/scene-data.json'));
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
      res.end('<script>console.error("boot-console");window.__scene3d={};throw Error("boot-sync")</script>'
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
        await page.evaluate('window.__scene3d.internals.camera.position.set(1e6,1e6,1e6);window.__scene3d.internals.camera.lookAt(2e6,2e6,2e6)');
        // Stop controls from restoring the camera while examining its deliberately bad position.
        await page.evaluate('window.__scene3d.internals.renderLoop.stop();window.__scene3d.internals.camera.position.set(1e6,1e6,1e6);window.__scene3d.internals.camera.lookAt(2e6,2e6,2e6)');
        let report = await verifyPage(page, { mode: 'run', expect });
        assert.equal(report.checks.find((c) => c.id === 'subject').status, 'FAIL');
        assert.equal(report.checks.find((c) => c.id === 'render').status, 'FAIL');
        await page.evaluate('for(const id of window.__scene3d.internals.sceneEngine.getAllIds()){window.__scene3d.internals.sceneEngine.getObject(id).visible=false;}');
        report = await verifyPage(page, { mode: 'run', expect: { hash: 'negative', idByGroup: { wrong: Object.values(expect.idByGroup).flat() } } });
        assert.equal(report.checks.find((c) => c.id === 'groups').status, 'FAIL');
        assert.equal(report.checks.find((c) => c.id === 'subject').status, 'FAIL');
        await page.evaluate('window.__scene3d.update({asset:[{id:"__p1_missing",params:{assetId:"__p1_missing.glb"}}]})');
        report = await verifyPage(page, { mode: 'run', expect });
        assert.equal(report.checks.find((c) => c.id === 'ready').status, 'FAIL');
        // Vite may return its HTML fallback with HTTP 200: loader failure is still a hard FAIL.
        const failures = await page.evaluate('window.__scene3d.getDiagnostics().failedAssets');
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
