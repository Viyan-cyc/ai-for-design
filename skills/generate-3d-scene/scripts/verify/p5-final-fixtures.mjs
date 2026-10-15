import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileAppearance } from '../lib/compile-appearance.mjs';
import { compareFidelity } from './fidelity-compare.mjs';
import { verifyEditRoundTrip } from './edit-contract-core.mjs';
import { defaultRunExportForTest, defaultRunFidelity } from './scene.mjs';
const root = fs.mkdtempSync(join(tmpdir(), 'p5-final-'));
try {
  const source = { things: [{ id: 'a', position: [0, 0, 0] }], __visuals: { a: { visible: false, locked: true, libraryRef: 'red' } }, __materialLib: { red: { spec: { color: '#ff0000' } }, unused: { spec: { color: '#000000' } } } };
  const compiled = compileAppearance(source);
  assert.deepEqual(compiled.errors, []);
  const runtime = { things: source.things };
  assert.equal(compareFidelity(source, runtime, compiled.code).ok, true);
  assert.equal(compareFidelity(source, runtime, compiled.code.replace('#ff0000', '#0000ff')).ok, false);
  const project = join(root, 'project');
  const delivery = project + '-dist';
  for (const p of [project, delivery]) fs.mkdirSync(join(p, 'public'), { recursive: true });
  fs.mkdirSync(join(delivery, 'src/scene-core/generated'), { recursive: true });
  fs.writeFileSync(join(project, 'public/scene-data.json'), JSON.stringify(source));
  fs.writeFileSync(join(delivery, 'public/scene-data.json'), JSON.stringify(runtime));
  const appearance = join(delivery, 'src/scene-core/generated/appearance.ts');
  fs.writeFileSync(appearance, compiled.code);
  assert.equal((await defaultRunFidelity(project)).status, 'PASS');
  fs.writeFileSync(appearance, compiled.code.replace('#ff0000', '#0000ff'));
  assert.equal((await defaultRunFidelity(project)).status, 'FAIL');
  console.log('PASS real compiler / normalization / delivered artifact tamper');

  const makeHandle = (fault) => {
    let nodes = { a: { id: 'a', position: [0, 0, 0] } }, visuals = {}, objects = { a: { visible: true, position: { x: 0, y: 0, z: 0 } } }, cleared = false;
    const copy = v => JSON.parse(JSON.stringify(v));
    const se = { getAllIds: () => Object.keys(nodes), getNode: id => nodes[id], getNodeType: () => 'things', getObject: id => objects[id], getVisual: id => visuals[id], patchVisual: (id, v) => { if (fault === 'noop') return; visuals[id] = v; if (fault !== 'object') objects[id].visible = v.visible; } };
    return { internals: { sceneEngine: se }, whenReady: async () => {}, serialize: () => {
      if (fault === 'throw') throw Error('serialize failed');
      return copy({ things: Object.values(nodes), __visuals: fault === 'loss' ? {} : visuals });
    }, update: f => {
      if (f.remove) { nodes = {}; objects = {}; visuals = {}; cleared = true; }
      for (const n of f.things ?? []) { nodes[n.id] = copy(n); objects[n.id] = { visible: visuals[n.id]?.visible ?? true, position: { x: n.position[0], y: n.position[1], z: n.position[2] } }; }
      if (f.__visuals) { visuals = copy(f.__visuals); for (const [id, v] of Object.entries(visuals)) if (objects[id]) objects[id].visible = v.visible; }
      if (fault === 'object' && objects.a) objects.a.visible = true;
      if (fault === 'restore' && cleared && objects.a) objects.a.position.x = 999;
    } };
  };
  await verifyEditRoundTrip(makeHandle());
  for (const fault of ['noop', 'object', 'throw', 'loss', 'restore']) await assert.rejects(() => verifyEditRoundTrip(makeHandle(fault)), undefined, fault);
  console.log('PASS edit roundtrip / noop / object mismatch / serialize throw+loss / reload corruption');

  const out = join(root, 'out'); fs.mkdirSync(out); fs.writeFileSync(join(out, 'old'), 'OLD');
  const rename = fs.renameSync;
  fs.renameSync = (from, to) => { if (from.startsWith(out + '.staging-') || from === out + '.old') throw Error('injected rename failure'); return rename(from, to); };
  syncBuiltinESMExports();
  let result;
  try { result = defaultRunExportForTest(project, out, { stagePrepare: () => ({ ok: true }), buildStep: () => ({ ok: true }) }); }
  finally { fs.renameSync = rename; syncBuiltinESMExports(); }
  assert.equal(result.ok, false);
  assert.equal(fs.readFileSync(join(out + '.old', 'old'), 'utf8'), 'OLD');
  let reached = false;
  assert.equal(defaultRunExportForTest(project, out, { stagePrepare: () => { reached = true; return { ok: false }; } }).ok, false);
  assert.equal(reached, false);
  assert.equal(fs.readFileSync(join(out + '.old', 'old'), 'utf8'), 'OLD');
  console.log('PASS publish+rollback failure / retry retains original backup');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
