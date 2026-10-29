// Child process: real geometry/factories, no fake DOM, canvas, GLB or rendered frame.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
const [bundle, dataPath, resultPath] = process.argv.slice(2);
const result = { ok: true, checked: 0, skipped: [], errors: [] };
let current = 'profile';
const scope = new AsyncLocalStorage();
const location = () => scope.getStore() ?? current;
const completed = new Set();
const skipped = new Set();
class Unavailable extends Error {}
const unavailable = reason => {
  completed.delete(location());
  skipped.add(`${location()}: ${reason}`);
  throw new Unavailable(reason);
};
// No service calls during a code check. This is not a security sandbox.
globalThis.fetch = () => unavailable('网络/异步资源加载不在装配检查范围');
const record = error => {
  completed.delete(location());
  if (error instanceof Unavailable) return;
  if (error instanceof ReferenceError && /^(document|window|Image|ImageBitmap|OffscreenCanvas|requestAnimationFrame|ResizeObserver) is not defined$/.test(error.message)) {
    skipped.add(`${location()}: ${error.message}（需要浏览器，未检查）`);
  } else result.errors.push(`${location()}: ${error.stack ?? error}`);
};
let engine;
let assets;
process.on('unhandledRejection', error => { current = 'async (not a rendered frame)'; record(error); });
try {
  const { SceneEngine, AssetEngine, registerBuiltinFactories, registerBusinessFactories, RESERVED_KEYS } = await import(pathToFileURL(bundle));
  engine = new SceneEngine();
  assets = new AssetEngine();
  // Throw synchronously rather than manufacture a successful placeholder load.
  assets.getInstance = () => unavailable('模型异步加载未执行；资源闭包由构建检查');
  // Registration only. No frame callbacks are executed, no renderer is simulated.
  const subscriptions = new Set();
  const subscribe = cb => { subscriptions.add(cb); return () => subscriptions.delete(cb); };
  const renderLoop = new Proxy({ onFrame: subscribe, onAfterFrame: subscribe, onResize: subscribe, invalidate() {} }, {
    get(target, key) { return key in target ? target[key] : unavailable(`renderLoop.${String(key)} 需要运行环境`); },
  });
  const context = { sceneEngine: engine, assetEngine: assets, renderLoop };
  engine.registerFactoryContext(context);
  // Keep the real engine's registration, resource ownership and tree assembly.
  // Catch independent factory failures to report all observed errors in one attempt.
  const register = engine.registerFactory.bind(engine);
  engine.registerFactory = (type, factory, ctx) => {
    const create = typeof factory === 'function' ? factory : factory.create.bind(factory);
    const wrapped = (node, factoryContext) => scope.run(`${type}/${node.id}`, () => {
      const before = skipped.size;
      try {
        const object = create(node, factoryContext);
        if (object?.then) throw new Error('工厂 create 必须同步返回 Object3D，不能返回 Promise');
        if (skipped.size === before) completed.add(location());
        return object;
      } catch (error) { record(error); return null; }
    });
    register(type, typeof factory === 'function' ? wrapped : { ...factory, create: wrapped }, ctx);
  };
  registerBuiltinFactories(engine, assets);
  registerBusinessFactories(context);
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const groups = Object.entries(data).filter(([key, value]) => !RESERVED_KEYS.has(key) && Array.isArray(value));
  engine.buildTree(groups);
  await new Promise(resolve => setImmediate(resolve));
} catch (error) { record(error); }
finally {
  try { engine?.dispose(); assets?.dispose(); } catch (error) { record(error); }
}
// Surface immediate rejected promises instead of hiding them with process.exit.
await new Promise(resolve => setImmediate(resolve));
result.skipped = [...skipped];
result.checked = completed.size;
result.ok = result.errors.length === 0;
writeFileSync(resultPath, JSON.stringify(result));
// No animation, timers or outstanding asynchronous work is part of this check.
process.exit(0);
