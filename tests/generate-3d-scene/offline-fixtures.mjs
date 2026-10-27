import { pixelPNG } from './asset-fixture-data.mjs';
import { dependencyPath } from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';
/** One-time maintenance regression. Does not run during scene generation. */
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/generate-3d-scene');
const fixture = resolve(mkdtempSync(resolve(tmpdir(), 'gts-offline-')), '工程 空格');
const template = resolve(skill, 'template');
cpSync(template, fixture, { recursive: true, filter: (path) => !['node_modules', '.cache', 'dist', 'offline'].includes(basename(path)) && !basename(path).startsWith('.offline-') });
symlinkSync(dependencyPath(), resolve(fixture, 'node_modules'), 'junction');
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2));
const scenePath = resolve(fixture, 'public/scene-data.json');
const scene = json(scenePath);
const manifestPath = resolve(fixture, 'public/assets/asset-manifest.json');
const manifest = json(manifestPath);
for (const [i, name] of ['嵌套 A', '嵌套 B'].entries()) {
  const dir = resolve(fixture, 'public/assets/models', name);
  mkdirSync(resolve(dir, 'mesh'), { recursive: true });
  mkdirSync(resolve(dir, 'images'), { recursive: true });
  const values = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1]);
  writeFileSync(resolve(dir, 'mesh/geometry.bin'), Buffer.from(values.buffer));
  writeFileSync(resolve(dir, 'images/texture.png'), pixelPNG);
  save(resolve(dir, 'mesh/model.gltf'), {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'triangle', mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
    buffers: [{ uri: 'geometry.bin', byteLength: 60 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 24 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' }],
    images: [{ uri: '../images/texture.png' }], textures: [{ source: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, baseColorFactor: [i, 1 - i, 0, 1] }, doubleSided: true }],
  });
  manifest[`test${i}`] = { model: `models/${name}/mesh/model.gltf`, format: 'gltf' };
}
scene.asset = [0, 1, 0].map((i, index) => ({ id: `offline_test_${index}`, position: [index * 2, 1, 0], params: { assetId: `test${i}` } }));
save(scenePath, scene); save(manifestPath, manifest);
const command = resolve(skill, 'scripts/build-offline.mjs');
const run = (...args) => spawnSync(process.execPath, args, { cwd: skill, encoding: 'utf8' });
const start = performance.now();
const built = run(command, fixture);
assert.equal(built.status, 0, built.stdout + built.stderr);
console.log(`PASS multi-file build ${(performance.now() - start).toFixed(0)}ms; ${fixture}`);
const html = resolve(fixture, 'offline/index.3d.html');
const moved = resolve(dirname(fixture), '移动 后');
cpSync(resolve(fixture, 'offline'), moved, { recursive: true });
const browser = run(resolve(skill, '../../tests/generate-3d-scene/offline-preview.mjs'), resolve(moved, 'index.3d.html'));
assert.equal(browser.status, 0, browser.stdout + browser.stderr);
console.log(browser.stdout.trim());
const digest = () => createHash('sha256').update(readFileSync(html)).update(readFileSync(resolve(fixture, 'offline/scene-data.js'))).digest('hex');
const previous = digest();
const missing = resolve(fixture, 'public/assets/models/嵌套 A/mesh/geometry.bin');
const bytes = readFileSync(missing); unlinkSync(missing);
assert.notEqual(run(command, fixture).status, 0);
assert.equal(digest(), previous);
writeFileSync(missing, bytes);
writeFileSync(resolve(fixture, 'src/invalid.ts'), 'export const bad: number = "not a number";');
const failed = run(command, fixture);
assert.notEqual(failed.status, 0);
assert.match(failed.stdout, /invalid.ts/);
assert.equal(digest(), previous);
assert.equal(existsSync(resolve(fixture, '.offline-build.lock')), false);
unlinkSync(resolve(fixture, 'src/invalid.ts'));
console.log('PASS missing-resource/type-error fail without replacing last valid output');
writeFileSync(resolve(fixture, '.offline-build.lock'), 'other build');
assert.notEqual(run(command, fixture).status, 0);
assert.equal(readFileSync(resolve(fixture, '.offline-build.lock'), 'utf8'), 'other build');
assert.equal(digest(), previous);
unlinkSync(resolve(fixture, '.offline-build.lock'));
console.log('PASS concurrent build refuses without deleting another owner lock');
for (const key of Object.keys(scene)) {
  if (Array.isArray(scene[key]) && key !== 'lights') delete scene[key];
}
scene.Box = [{ id: 'geometry_box', position: [0, 0.5, 0] }];
save(scenePath, scene);
const geometry = run(command, fixture);
assert.equal(geometry.status, 0, geometry.stdout + geometry.stderr);
const geometryBrowser = run(resolve(skill, '../../tests/generate-3d-scene/offline-preview.mjs'), html);
assert.equal(geometryBrowser.status, 0, geometryBrowser.stdout + geometryBrowser.stderr);
console.log('PASS geometry fallback');
console.log(geometryBrowser.stdout.trim());
console.log('Fixture retained for inspection:', fixture);

