import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dependencyPath } from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';
const ts = createRequire(import.meta.url)(dependencyPath('typescript'));
const root = new URL('../../skills/generate-3d-scene/template/src/scene-core/', import.meta.url);
async function load(file, rewrite = s => s) {
  const source = rewrite(readFileSync(new URL(file, root), 'utf8'));
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
}
const { normalizeRenderer, qualityPreset, QUALITY_PRESETS } = await load('render-settings.ts');
const base = { toneMapping: 'ACESFilmic', exposure: 1, shadowMapEnabled: false, shadowMap: 'PCF' };
assert.equal(normalizeRenderer(base).pixelRatio, 1);
assert.equal(normalizeRenderer(base).maxFps, 60);
assert.equal(normalizeRenderer(base).renderMode, 'demand');
assert.equal(normalizeRenderer(base).antialias, false);
assert.equal(qualityPreset(base), 'fluent');
assert.equal(qualityPreset({ ...base, ...QUALITY_PRESETS.fine, maxFps: 30, logarithmicDepthBuffer: true }), 'fine');
assert.equal(qualityPreset({ ...base, pixelRatio: 0.75 }), 'custom');
for (const patch of [{ pixelRatio: NaN }, { pixelRatio: 0 }, { maxFps: -1 }, { maxFps: 29.5 }, { shadowMapSize: 768 }]) {
  assert.throws(() => normalizeRenderer({ ...base, ...patch }));
}

let now = 0, seq = 0;
const raf = new Map();
const visibility = new Set();
globalThis.performance = { now: () => now };
globalThis.requestAnimationFrame = cb => { raf.set(++seq, cb); return seq; };
globalThis.cancelAnimationFrame = id => raf.delete(id);
globalThis.document = { hidden: false, addEventListener: (_, cb) => visibility.add(cb), removeEventListener: (_, cb) => visibility.delete(cb) };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const { RenderLoop } = await load('engine/RenderLoop.ts', s => s.replace("import { onResourcesChanged } from '../render-invalidation';", 'const onResourcesChanged = () => () => {};'));
let config = normalizeRenderer(base), renders = 0;
const changes = new Set();
const controls = { autoRotate: false, addEventListener: (_, cb) => changes.add(cb), removeEventListener: (_, cb) => changes.delete(cb) };
const info = { autoReset: true, render: { calls: 1, triangles: 12 }, reset() {} };
const renderer = { renderer: { domElement: {}, info }, getConfig: () => config, render() { renders++; }, applySize: () => ({ width: 100, height: 100 }) };
const loop = new RenderLoop(renderer, { controls, update() {} }, () => ({}), () => ({}));
function step(ms = 1000 / 60) { now += ms; const queued = [...raf.values()]; raf.clear(); for (const cb of queued) cb(now); }
function advance(frames, ms) { for (let i = 0; i < frames; i++) step(ms); }
loop.start(); step(); assert.equal(renders, 1); assert.equal(raf.size, 0); assert.equal(loop.getStats().idle, true);
loop.invalidate(); loop.invalidate(); assert.equal(raf.size, 1); step(); assert.equal(renders, 2);
const observer = loop.onFrame(() => {}, false); step(); assert.equal(raf.size, 0); observer();
config = { ...config, renderMode: 'continuous', maxFps: 30 }; loop.invalidate();
const before = renders; advance(120); assert(Math.abs(renders - before - 60) <= 1); assert(Math.abs(loop.getStats().fps - 30) <= 1);
config = { ...config, renderMode: 'demand' }; step(); assert.equal(raf.size, 0);
now += 5000; assert.equal(loop.getStats().fps, 0); assert.equal(loop.getStats().idle, true);
let distance = 0;
const removeAnimation = loop.onFrame(delta => { distance += delta * 2; });
advance(120); assert(Math.abs(distance - 4) < 0.1, `animation speed ${distance}`);
removeAnimation(); advance(3); assert.equal(raf.size, 0);
config = { ...config, renderMode: 'continuous', maxFps: 0 }; loop.invalidate();
const unlimitedStart = renders; advance(144, 1000 / 144); assert.equal(renders - unlimitedStart, 144);
document.hidden = true; visibility.forEach(cb => cb()); assert.equal(raf.size, 0); assert.equal(loop.getStats().paused, true);
now += 10000; document.hidden = false; visibility.forEach(cb => cb()); assert.equal(loop.getStats().fps, 0); assert.equal(loop.getStats().sampling, true); step();
config = { ...config, maxFps: 1 }; loop.configurationChanged(); step();
config = { ...config, maxFps: 60 }; loop.configurationChanged();
const changedStart = renders; step(); assert.equal(renders, changedStart + 1, 'cap change should not wait for old deadline');
loop.dispose(); assert.equal(raf.size, 0); assert.equal(visibility.size, 0); assert.equal(changes.size, 0);
console.log('PASS presets, validation, idle/wake, coalescing, 30 FPS cap, time-based animation, unlimited, visibility reset, disposal');
