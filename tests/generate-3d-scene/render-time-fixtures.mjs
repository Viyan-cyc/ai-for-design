import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dependencyPath } from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';
const ts = createRequire(import.meta.url)(dependencyPath('typescript'));
const source = readFileSync(new URL('../../skills/generate-3d-scene/template/src/scene3d/scene-core/engine/RenderLoop.ts', import.meta.url), 'utf8')
  .replace("import { onResourcesChanged } from '../render-invalidation';", 'const onResourcesChanged = () => () => {};');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { RenderLoop } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
let now = 0, seq = 0;
const raf = new Map(), visibility = new Set();
globalThis.performance = { now: () => now };
globalThis.requestAnimationFrame = cb => { raf.set(++seq, cb); return seq; };
globalThis.cancelAnimationFrame = id => raf.delete(id);
globalThis.document = { hidden: false, addEventListener: (_, cb) => visibility.add(cb), removeEventListener: (_, cb) => visibility.delete(cb) };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const close = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function fixture(external, fps) {
  const config = { renderMode: 'demand', maxFps: fps };
  const frames = [], after = [], controlsDelta = [];
  let requests = 0;
  const controls = { autoRotate: false, addEventListener() {}, removeEventListener() {} };
  const renderer = { renderer: { domElement: {}, info: { render: { calls: 1, triangles: 1 }, reset() {} } }, getConfig: () => config, render() {} };
  const loop = new RenderLoop(renderer, { controls, update: d => controlsDelta.push(d) }, () => ({}), () => ({}), external ? () => requests++ : undefined);
  const remove = loop.onFrame((...args) => frames.push(args));
  loop.onAfterFrame((...args) => after.push(args));
  loop.start();
  const step = ms => { now += ms; if (external) loop.drawExternal(); else { const queued = [...raf.values()]; raf.clear(); queued.forEach(cb => cb(now)); } };
  return { loop, frames, after, controlsDelta, config, step, remove, requests: () => requests };
}
for (const external of [false, true]) {
  for (const fps of [5, 10, 30, 60]) {
    const f = fixture(external, fps);
    for (let i = 0; i < fps * 2; i++) { f.loop.invalidate(); f.step(1000 / fps); }
    close(f.frames.reduce((s, [d]) => s + d, 0), 2);
    close(f.frames.at(-1)[1], 2);
    f.frames.forEach(([d, , bounded]) => close(bounded, Math.min(d, 0.1)));
    assert.deepEqual(f.after, f.frames);
    if (!external) assert.deepEqual(f.controlsDelta, f.frames.map(([d]) => d));
    else assert.equal(raf.size, 0, 'external driver must not create RAF');
    f.step(2000); close(f.frames.at(-1)[0], 2); close(f.frames.at(-1)[2], 0.1);
    f.loop.stop(); now += 10000; f.loop.start(); f.step(1000 / fps); close(f.frames.at(-1)[0], 1 / fps);
    document.hidden = true; visibility.forEach(cb => cb()); now += 10000;
    document.hidden = false; visibility.forEach(cb => cb()); f.step(1000 / fps); close(f.frames.at(-1)[0], 1 / fps);
    f.remove(); f.step(1000 / fps);
    const observerFrames = [];
    now += 10000;
    const off = f.loop.onFrame(d => observerFrames.push(d), false);
    f.step(1000 / fps); close(observerFrames.at(-1), 1 / fps);
    if (external) { now += 10000; f.loop.drawExternal(); close(observerFrames.at(-1), 0); }
    off(); now += 10000;
    const animated = [];
    f.loop.onFrame(d => animated.push(d));
    f.step(1000 / fps); close(animated[0], 1 / fps);
    f.loop.dispose(); assert.equal(raf.size, 0); assert.equal(visibility.size, 0);
  }
}
// RAF polling and repeated invalidations must not reset active time at low caps.
const f = fixture(false, 5);
for (let i = 0; i < 121; i++) { f.loop.invalidate(); f.step(1000 / 60); }
assert.equal(f.frames.length, 11); close(f.frames.at(-1)[1], 121 / 60);
f.config.maxFps = 60; f.loop.configurationChanged(); f.step(1000 / 60); close(f.frames.at(-1)[0], 1 / 60);
f.loop.dispose();
console.log('PASS active time at 5/10/30/60 FPS, bounded simulation step, native/external drivers, long frames, idle/background/restart, cap switch, callbacks and cleanup');
