import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dependencyPath } from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/generate-3d-scene');
const ts = (await import(pathToFileURL(dependencyPath('typescript/lib/typescript.js')))).default;
registerHooks({
  resolve(s, c, next) {
    if (s === 'three')
      return {
        url: pathToFileURL(dependencyPath('three/build/three.module.js')).href,
        shortCircuit: true,
      };
    if (s.startsWith('three/'))
      return { url: pathToFileURL(dependencyPath(s)).href, shortCircuit: true };
    if (s.startsWith('.') && c.parentURL) {
      const candidate = new URL(s + '.ts', c.parentURL);
      if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
    }
    return next(s, c);
  },
  load(u, c, next) {
    if (u.endsWith('.ts'))
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(u), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText,
      };
    return next(u, c);
  },
});
const THREE = await import('three');

const { SceneEngine } = await import(
  pathToFileURL(join(skill, 'template/src/scene3d/scene-core/engine/SceneEngine.ts'))
);
const { createDataAdapter } = await import(
  pathToFileURL(join(skill, 'template/src/business/data/adapter.ts'))
);
const { connectData } = await import(pathToFileURL(join(skill, 'template/src/business/data/connect.ts')));
const engine = new SceneEngine();
let creates = 0,
  updates = 0;
engine.registerFactory('devices', {
  create() {
    creates++;
    return new THREE.Group();
  },
  update(object, node) {
    updates++;
    object.userData.status = node.params.status;
    return 'updated';
  },
});
engine.applyFragment({
  devices: [
    { id: 'a', position: [1, 0, 2], params: { assetId: 'cabinet', capacity: 2, status: 'normal' } },
  ],
});
const original = engine.getObject('a');
const listeners = new Set();
const handle = {
  getNodeData(id) {
    const node = engine.getNode(id);
    return node ? { type: engine.getNodeType(id), node: structuredClone(node) } : null;
  },
  batchUpdates(operation) { return operation(); },
  patchNodeParams(id, patch) {
    const current = this.getNodeData(id);
    engine.applyFragment({[current.type]:[{id,params:{...current.node.params,...patch}}]});
  },
  onDispose(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};
const adapter = createDataAdapter(handle, [{ businessId: 'device-a', nodeId: 'a' }]);
assert.deepEqual(adapter.apply([]), { updated: [], unchanged: [], issues: [] });
assert.deepEqual(adapter.apply([{ id: 'device-a', status: 'alarm' }]).updated, ['device-a']);
assert.deepEqual(engine.getNode('a').params, { assetId: 'cabinet', capacity: 2, status: 'alarm' });
assert.equal(engine.getObject('a'), original);
assert.equal(creates, 1);
assert.equal(original.userData.status, 'alarm');
assert.deepEqual(engine.getNode('a').position, [1, 0, 2]);
const before = updates;
assert.deepEqual(adapter.apply([{ id: 'device-a', status: 'alarm' }]).unchanged, ['device-a']);
assert.equal(updates, before);
// Other API/editor changes must be read fresh, never reverted to initial data.
engine.applyFragment({
  devices: [{ id: 'a', params: { assetId: 'replacement', capacity: 99, status: 'normal' } }],
});
adapter.apply([{ id: 'device-a', status: 'maintenance' }]);
assert.deepEqual(engine.getNode('a').params, {
  assetId: 'replacement',
  capacity: 99,
  status: 'maintenance',
});
const invalid = adapter.apply([
  { id: 'device-a', speed: NaN },
  { id: 'device-a', status: null },
  { id: 'device-a', assetId: 'bad' },
  { id: 'missing', status: 'normal' },
  { id: 'device-a', status: 'alarm' },
]);
assert.deepEqual(
  invalid.issues.map((x) => x.code),
  ['invalid-record', 'invalid-record', 'invalid-record', 'unknown-id'],
);
assert.deepEqual(invalid.updated, ['device-a']);
assert.equal(engine.getNode('a').params.assetId, 'replacement');
const duplicates = createDataAdapter(handle, [
  { businessId: 'x', nodeId: 'a' },
  { businessId: 'y', nodeId: 'a' },
]);
assert.equal(duplicates.apply([{ id: 'x', status: 'normal' }]).issues[0].code, 'duplicate-mapping');
const repeated = createDataAdapter(handle, [
  { businessId: 'x', nodeId: 'a' },
  { businessId: 'x', nodeId: 'b' },
]);
assert.equal(repeated.apply([{ id: 'x', status: 'normal' }]).issues[0].code, 'duplicate-mapping');
const direct = createDataAdapter(handle);
assert.deepEqual(
  direct.apply([
    { id: 'a', status: 'normal' },
    { id: 'a', status: 'alarm' },
  ]).updated,
  ['a', 'a'],
);
assert.deepEqual(direct.apply([{ id: 'a', status: undefined }]).unchanged, ['a']);
const snapshot = structuredClone(engine.getNode('a'));
engine.applyFragment({ remove: ['a'] });
assert.equal(direct.apply([{ id: 'a', status: 'normal' }]).issues[0].code, 'unknown-id');
assert.equal(engine.getNode('a'), null);
engine.applyFragment({ devices: [snapshot] }); // equivalent to restored editor snapshot
assert.deepEqual(direct.apply([{ id: 'a', status: 'normal' }]).updated, ['a']);
const disconnect = connectData(adapter);
disconnect();
disconnect();
for (const cb of [...listeners]) cb();
assert.equal(adapter.apply([{ id: 'device-a', status: 'alarm' }]).issues[0].code, 'disposed');
assert.equal(direct.apply([{ id: 'a', status: 'alarm' }]).issues[0].code, 'disposed');
adapter.dispose();
adapter.dispose();
assert.equal(listeners.size, 0);
engine.dispose();
console.log(
  'PASS real engine adapter: params preservation, identity, fresh edits, validation, mappings, sequential patches, remove/restore, disposal',
);

// State + explicit material edit: transient clones must not accumulate.
const visualEngine = new SceneEngine();
const clones = [];
const originalClone = THREE.MeshStandardMaterial.prototype.clone;
THREE.MeshStandardMaterial.prototype.clone = function () {
  const mat = originalClone.call(this);
  const entry = { mat, disposed: 0 };
  mat.addEventListener('dispose', () => entry.disposed++);
  clones.push(entry);
  return mat;
};
try {
  visualEngine.registerFactory('devices', {
    create() {
      return new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    },
    update(obj, next) {
      obj.material = obj.material.clone();
      obj.material.color.set(next.params.status === 'alarm' ? '#ff0000' : '#00ff00');
      return 'updated';
    },
  });
  visualEngine.applyFragment({ devices: [{ id: 'v', params: { status: 'normal' } }] });
  visualEngine.applyVisual('v', { color: '#123456' });
  for (let i = 0; i < 20; i++) {
    visualEngine.applyFragment({
      devices: [{ id: 'v', params: { status: i % 2 ? 'normal' : 'alarm' } }],
    });
    assert.equal(visualEngine.getObject('v').material.color.getHexString(), '123456');
    assert.equal(
      clones.filter((x) => x.disposed === 0).length,
      1,
      'only the current edited material remains live',
    );
  }
  visualEngine.dispose();
  assert(
    clones.every((x) => x.disposed === 1),
    'every replaced material disposed exactly once',
  );
  console.log('PASS state/editor priority and 20-update material ownership regression');
} finally {
  THREE.MeshStandardMaterial.prototype.clone = originalClone;
}
