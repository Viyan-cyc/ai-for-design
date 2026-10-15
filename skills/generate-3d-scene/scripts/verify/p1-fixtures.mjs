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
const THREE = await import(pathToFileURL(join(template, 'node_modules/three/build/three.module.js')));
const { installDiagnostics, waitForReady, getPageErrorSink } =
  await import(pathToFileURL(join(template, 'src/scene-core/diagnostics.ts')));
const { makeAssetNodeFactory } = await import(pathToFileURL(join(template, 'src/scene-core/handlers/registry.ts')));
const { SceneEngine } = await import(pathToFileURL(join(template, 'src/scene-core/engine/SceneEngine.ts')));
const { RenderLoop } = await import(pathToFileURL(join(template, 'src/scene-core/engine/RenderLoop.ts')));
const { paramsEqual } = await import(pathToFileURL(join(template, 'src/scene-core/types.ts')));
const { getResourceScope } = await import(pathToFileURL(join(template, 'src/scene-core/resources.ts')));
const { registerTreeHandler } = await import(pathToFileURL(join(template, 'src/scene-core/handlers/procedural/tree.ts')));
const { registerRackHandler } = await import(pathToFileURL(join(template, 'src/scene-core/handlers/procedural/rack.ts')));
const { handlerUtils } = await import(pathToFileURL(join(template, 'src/scene-core/handlers/registry.ts')));

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
  const { AssetEngine } = await import(pathToFileURL(join(template, 'src/scene-core/engine/AssetEngine.ts')));
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
  const { registerBusinessFactories } = await import(pathToFileURL(join(template, 'src/scene-profile.ts')));
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
  const { registerBusinessFactories, BUSINESS_REGISTRARS } = await import(pathToFileURL(join(template, 'src/scene-profile.ts')));
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
    internals: { sceneEngine: engine },
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
  const { EnvironmentEngine } = await import(pathToFileURL(join(template, 'src/scene-core/engine/EnvironmentEngine.ts')));
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
  const { AssetEngine } = await import(pathToFileURL(join(template, 'src/scene-core/engine/AssetEngine.ts')));
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
    internals: { sceneEngine: engine },
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
