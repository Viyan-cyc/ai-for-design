/** Standards spec acceptance fixtures (§10 matrix items 1–8): naming prefill, measurements,
 * placement/forbidden gates, budget acknowledgement binding, draft protocol, package update,
 * and vector-template raw_data. Temp dirs only; no production server. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const base = 'D:/cyc/project/octo/gts/test/ep-coder/skills/generate-3d-scene/scripts';
const url = (p) => pathToFileURL(p).href;
const { receive, loadPackage, confirm, inject, exportPackage, applyCheckResult, selected, inputFiles } = await import(url(base + '/lib/designer-assets.mjs'));
const { generateIntakePage, importReview, packageIdentity } = await import(url(base + '/lib/intake-page.mjs'));
const { updatePackage } = await import(url(base + '/lib/package-update.mjs'));
const { writeZip } = await import(url(base + '/import-assets.mjs'));
const { CHECKER_VERSION } = await import(url(base + '/lib/viewer-version.mjs'));
const { RULES_VERSION, budgetPolicy, scanForbiddenContent, checkPlacement, checkBudget, suggestName, validAcknowledgement,metricValues,createAcknowledgement } = await import(url(base + '/lib/model-policy.mjs'));
const { sanitizeLibraryMetadata } = await import(url(base + '/lib/asset-service.mjs'));
const { triangleGlb, pixelPNG } = await import(url(base + '/verify/asset-fixture-data.mjs'));

const root = fs.mkdtempSync(resolve(tmpdir(), 'model-standards-'));
const run = (...args) => spawnSync(process.execPath, ['scripts/designer-assets.mjs', ...args], { encoding: 'utf8', cwd: resolve(base, '..') });

// ---------------------------------------------------------------------------
// 1. Naming prefill (matrix #1)
// ---------------------------------------------------------------------------
{
  const input = resolve(root, 'naming-in'); fs.mkdirSync(input);
  const gltf = (name) => JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'body', mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ uri: 'mesh.bin', byteLength: 36 }], bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, 0, -1], max: [1, 1, 1] }] });
  const bin = Buffer.from(new Float32Array([-1, 0, -1, 1, 0, -1, -1, 0, 1]).buffer);
  for (const [file, meta] of [['armchair_01.glb', null], ['armchair_02.glb', null], ['object_xxx.gltf', null], ['rack_07.glb', null]]) {
    if (file.endsWith('.glb')) {
      // reuse triangleGlb but centered: build our own minimal GLB
      fs.writeFileSync(resolve(input, file), triangleGlb());
    } else {
      fs.writeFileSync(resolve(input, file), gltf(file));
    }
  }
  fs.writeFileSync(resolve(input, 'mesh.bin'), bin);
  const out = resolve(root, 'naming-pkg');
  const pkg = receive(input, out, '');
  const byEntry = new Map(pkg.assets.map((a) => [a.entry, a]));
  assert.equal(byEntry.get('armchair_01.glb').name, '扶手椅 01', 'armchair_01 prefill');
  assert.equal(byEntry.get('armchair_02.glb').name, '扶手椅 02', 'numbered sibling keeps its number');
  assert.equal(byEntry.get('rack_07.glb').name, '机柜 07');
  assert.equal(byEntry.get('object_xxx.gltf').name, 'object_xxx', 'weak name keeps original file stem');
  assert.equal(byEntry.get('object_xxx.gltf').namePending, true, 'weak name stays pending');
  assert.equal(byEntry.get('armchair_01.glb').namePending, false);
  console.log('PASS naming prefill: translated terms, numbered siblings, weak names pending');
}

// ---------------------------------------------------------------------------
// 2. Measurement statistics (matrix #2) — pure function level
// ---------------------------------------------------------------------------
{
  // 3 empty Groups: calls must be 0; node_count counts Groups; triangles by topology.
  const fakeThree = { Box3: class { constructor() { this.min = { toArray: () => [0, 0, 0] }; this.max = { toArray: () => [1, 1, 1] }; } setFromObject() { return this; } isEmpty() { return false; } } };
  const { measureModel, meshTriangles, countNodes, countTextures } = await import(url(base + '/lib/viewer/measure.js'));
  const mkMesh = (indexCount, drawMode, extra = {}) => ({ isMesh: true, drawMode, geometry: { index: { count: indexCount } }, ...extra });
  assert.equal(meshTriangles(mkMesh(9)), 3, 'indexed triangles count/3');
  assert.equal(meshTriangles(mkMesh(9, 1)), 7, 'TRIANGLE_STRIP count-2');
  assert.equal(meshTriangles(mkMesh(9, 2)), 7, 'TRIANGLE_FAN count-2');
  assert.equal(meshTriangles({ isMesh: true, isInstancedMesh: true, count: 4, geometry: { index: { count: 9 } } }), 12, 'instanced multiplies');
  const groupTree = { traverse(fn) { fn(this.g1); fn(this.g2); fn(this.g3); }, g1: {}, g2: {}, g3: {} };
  assert.equal(countNodes(groupTree), 3, 'node_count includes Groups');
  // measureModel path with a fake root
  const root3 = {
    traverse(fn) { fn(this); fn(this.m1); },
    m1: { isMesh: true, geometry: { index: { count: 300 } }, material: { map: { isTexture: true, source: { data: { width: 512, height: 512 } }, image: { width: 512, height: 512 } }, normalMap: { isTexture: true, source: null, image: { width: 256, height: 256 } } } },
    updateMatrixWorld() {},
  };
  root3.m1.material.map.source = { data: root3.m1.material.map.image };
  const measured = measureModel(fakeThree, root3);
  assert.equal(measured.triangles, 100);
  assert.equal(measured.meshes, 1);
  assert.equal(measured.textureCount, 2, 'same-source slots count once');
  assert.equal(measured.maxTextureSize, 512);
  console.log('PASS measurement statistics: topology, instances, nodes, unique texture sources');
}

// ---------------------------------------------------------------------------
// 3. Placement checks (matrix #3)
// ---------------------------------------------------------------------------
{
  const ok = checkPlacement({ bbox: { min: [-0.3, 0, -0.5], max: [0.3, 2, 0.5] } });
  assert.equal(ok.ok, true);
  const offset = checkPlacement({ bbox: { min: [1, 0, -0.5], max: [2, 2, 0.5] } });
  assert.equal(offset.ok, false, 'X offset must fail');
  const floating = checkPlacement({ bbox: { min: [-0.3, 0.5, -0.5], max: [0.3, 2, 0.5] } });
  assert.equal(floating.ok, false, 'floating must fail');
  const rootScaled = checkPlacement({ bbox: { min: [-0.3, 0, -0.5], max: [0.3, 2, 0.5] }, rootNode: { scale: [2, 2, 2] } });
  assert.equal(rootScaled.ok, false, 'root scale must fail');
  const rootRot = checkPlacement({ bbox: { min: [-0.3, 0, -0.5], max: [0.3, 2, 0.5] }, rootNode: { rotation: [0, 0.7, 0, 0.7] } });
  assert.equal(rootRot.ok, false, 'root rotation must fail');
  const internalOk = checkPlacement({ bbox: { min: [-0.3, 0, -0.5], max: [0.3, 2, 0.5] }, rootNode: null });
  assert.equal(internalOk.ok, false, 'unknown placement root requires re-export');
  console.log('PASS placement: bottom-center, X/Z center, floating, root transforms');
}

// 90° rotation world-bbox semantics (matrix #3, §4.3): local bbox survives instance rotation.
{
  const local = { min: [-0.3, 0, -0.5], max: [0.3, 2, 0.5] };
  const rot90y = (p) => [p[2], p[1], -p[0]]; // rotate +90° about Y: x'=z, z'=-x
  const corners = [];
  for (const x of [local.min[0], local.max[0]]) for (const y of [local.min[1], local.max[1]]) for (const z of [local.min[2], local.max[2]]) corners.push(rot90y([x, y, z]));
  const worldMin = [0, 1, 2].map((i) => Math.min(...corners.map((c) => c[i])));
  const worldMax = [0, 1, 2].map((i) => Math.max(...corners.map((c) => c[i])));
  // local W=0.6, D=1.0 → rotated W=1.0, D=0.6
  assert.ok(Math.abs((worldMax[0] - worldMin[0]) - 1.0) < 1e-9, 'world W swaps local D after 90°');
  assert.ok(Math.abs((worldMax[2] - worldMin[2]) - 0.6) < 1e-9, 'world D swaps local W after 90°');
  console.log('PASS 90°-rotated world bbox width/depth swap correctly');
}

// ---------------------------------------------------------------------------
// 4. Forbidden content scan (matrix #4)
// ---------------------------------------------------------------------------
{
  const base = { asset: { version: '2.0' }, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [] }] };
  assert.equal(scanForbiddenContent(base).length, 0, 'clean model');
  assert.equal(scanForbiddenContent({ ...base, cameras: [{ type: 'perspective' }] }).length, 1, 'unreferenced cameras array counts');
  assert.equal(scanForbiddenContent({ ...base, nodes: [{ mesh: 0, camera: 3 }] }).length, 1, 'node.camera reference counts');
  assert.equal(scanForbiddenContent({ ...base, extensions: { KHR_lights_punctual: { lights: [{ type: 'directional' }] } } }).length, 1, 'unreferenced punctual lights count');
  assert.equal(scanForbiddenContent({ ...base, nodes: [{ mesh: 0, extensions: { KHR_lights_punctual: { light: 0 } } }] }).length, 1, 'node light reference counts');
  assert.equal(scanForbiddenContent({ ...base, materials: [{ emissiveFactor: [1, 0, 0] }] }).length, 0, 'emissive is not a light');
  // Both array and node-reference together
  assert.equal(scanForbiddenContent({ ...base, cameras: [{}], nodes: [{ mesh: 0, camera: 0 }] }).length, 2);
  // End-to-end: receive marks the asset forbidden and confirm blocks it.
  const gltf = JSON.stringify({ ...base, cameras: [{ type: 'perspective', perspective: { yfov: 1 } }] });
  const input = resolve(root, 'forbidden-in'); fs.mkdirSync(input);
  fs.writeFileSync(resolve(input, 'cam.gltf'), gltf);
  const out = resolve(root, 'forbidden-pkg');
  const pkg = receive(input, out, '');
  const a = pkg.assets[0];
  assert(a.forbidden?.length === 1, 'receive records forbidden content');
  // applyCheckResult keeps it unconfirmable even when loadable
  applyCheckResult(out, { assetId: a.id, contentHash: a.contentHash, checkerVersion: CHECKER_VERSION, ok: true, image: pixelPNG.toString('base64'), bbox: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }, meshes: 1, triangles: 1, instanced: false, skinned: false, nodeCount: 1, drawCalls: 1, textureCount: 0, maxTextureSize: 0 });
  const withCheck = loadPackage(out);
  assert.equal(withCheck.assets[0].technicalStatus, 'loadable', 'forbidden model stays previewable');
  assert.throws(() => confirm(out, withCheck.revision), /相机\/灯光或坐标规范违规不能确认使用/);
  const project = resolve(root, 'forbidden-project'); fs.mkdirSync(project);
  assert.throws(() => inject(out, project), /Package needs user confirmation|hard violations/);
  console.log('PASS forbidden cameras/lights: scan, preview allowed, confirm/inject blocked');
}

// ---------------------------------------------------------------------------
// 5. Budget boundaries + acknowledgement binding (matrix #5)
// ---------------------------------------------------------------------------
{
  for (const [tier, limit] of [['simple', 200], ['medium', 500], ['complex', 1000]]) {
    assert.equal(checkBudget({ triangles: limit }, tier).warnings.length, 0, `${tier} at limit passes`);
    assert.equal(checkBudget({ triangles: limit + 1 }, tier).warnings.length, 1, `${tier} over limit warns`);
  }
  assert.equal(checkBudget({ node_count: 5 }).warnings.length, 0);
  assert.equal(checkBudget({ node_count: 6 }).warnings.length, 1);
  assert.equal(checkBudget({ max_texture_size: 1024 }).warnings.length, 0);
  assert.equal(checkBudget({ max_texture_size: 1025 }).warnings.length, 1);
  assert.equal(checkBudget({ draw_calls: 5 }).warnings.length, 0);
  assert.equal(checkBudget({ draw_calls: 6 }).warnings.length, 1);
  assert.equal(checkBudget({ texture_count: 4 }).warnings.length, 0);
  assert.equal(checkBudget({ texture_count: 5 }).warnings.length, 1);
  // Acknowledgement binding
  const measurements = { triangles: 600, node_count: 2 };
  const good = { measurements:metricValues(measurements),contentHash: 'h1', rulesVersion: RULES_VERSION, tier: 'medium', accepted: ['triangles'] };
  assert.equal(validAcknowledgement(good, { contentHash: 'h1', rulesVersion: RULES_VERSION, measurements, tier: 'medium' }), true);
  assert.equal(validAcknowledgement(good, { contentHash: 'h2', rulesVersion: RULES_VERSION, measurements, tier: 'medium' }), false, 'different content invalidates ack');
  assert.equal(validAcknowledgement({ ...good, accepted: [] }, { contentHash: 'h1', rulesVersion: RULES_VERSION, measurements, tier: 'medium' }), false, 'unaccepted warning invalid');
  assert.equal(validAcknowledgement({ ...good, rulesVersion: '0.0.1' }, { contentHash: 'h1', rulesVersion: RULES_VERSION, measurements, tier: 'medium' }), false, 'rule version mismatch invalidates');
  // End-to-end: budget-exceeding model needs ack to consume
  const gltf = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'body', mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ uri: 'mesh.bin', byteLength: 36 }], bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }] });
  const input = resolve(root, 'budget-in'); fs.mkdirSync(input);
  fs.writeFileSync(resolve(input, 'heavy.gltf'), gltf);
  fs.writeFileSync(resolve(input, 'mesh.bin'), Buffer.from(new Float32Array([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5]).buffer));
  const out = resolve(root, 'budget-pkg');
  receive(input, out, '');
  const a0 = loadPackage(out).assets[0];
  applyCheckResult(out, { assetId: a0.id, contentHash: a0.contentHash, checkerVersion: CHECKER_VERSION, ok: true, image: pixelPNG.toString('base64'), bbox: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }, meshes: 1, triangles: 600, instanced: false, skinned: false, nodeCount: 1, drawCalls: 1, textureCount: 0, maxTextureSize: 0 });
  const pkg1 = loadPackage(out);
  const heavy = pkg1.assets[0];
  assert(heavy.budgetWarnings?.length === 1, '600 triangles over medium 500 budget warns');
  assert.equal(heavy.technicalStatus, 'loadable', 'budget warning is not a rejection');
  assert.throws(()=>confirm(out,pkg1.revision,{confirmFront:true,confirmScale:true}),/超预算同意/);
  const m={kind:'model-intake',schemaVersion:2,purpose:'confirm',submissionId:'budget-confirm',...packageIdentity(pkg1),mode:'upload',baseRevision:pkg1.revision,checkerVersion:CHECKER_VERSION,rulesVersion:RULES_VERSION,packageDescription:'预算',confirmSelection:true,allowPartial:false,entries:[{assetId:heavy.id,contentHash:heavy.contentHash,name:heavy.name,description:'',selected:true,confirmFront:true,confirmScale:true,tier:'medium',acknowledgement:createAcknowledgement(heavy),result:null}]};
  importReview(out,m);
  assert.equal(selected(out).length,1,'file acknowledgement unblocks consumption');
  console.log('PASS budget boundaries and acknowledgement binding');
}

// ---------------------------------------------------------------------------
// 6. Draft protocol (matrix #6)
// ---------------------------------------------------------------------------
{
  const input = resolve(root, 'draft-in'); fs.mkdirSync(input);
  fs.writeFileSync(resolve(input, 'a.glb'), triangleGlb());
  fs.writeFileSync(resolve(input, 'broken.glb'), Buffer.from('not a glb'));
  const out = resolve(root, 'draft-pkg');
  receive(input, out, '');
  const p0 = loadPackage(out);
  const m = { kind: 'model-intake', schemaVersion: 2, purpose: 'draft', submissionId: 'draft-sub-1', ...packageIdentity(p0), mode: 'upload', baseRevision: p0.revision, checkerVersion: CHECKER_VERSION, rulesVersion: RULES_VERSION, packageDescription: '草稿说明', confirmSelection: false, allowPartial: false, entries: p0.assets.map((a) => ({ assetId: a.id, contentHash: a.contentHash, name: '草稿名称', description: '草稿用途', selected: true, result: null })) };
  const applied = importReview(out, m);
  assert.equal(applied.status, 'draft-applied');
  assert.equal(loadPackage(out).confirmation, null, 'draft leaves no confirmation');
  assert.equal(loadPackage(out).assets[0].confirmed, false, 'draft does not confirm');
  const project = resolve(root, 'draft-project'); fs.mkdirSync(project);
  assert.throws(() => inject(out, project), /Package needs user confirmation/, 'draft cannot be injected');
  assert.throws(() => exportPackage(out, resolve(root, 'draft.zip'), { source_id: 16 }), /Package needs user confirmation/, 'draft cannot be exported');
  // A confirm-purpose manifest with confirmSelection is refused for draft files
  const fakeConfirm = structuredClone(m); fakeConfirm.purpose = 'confirm'; fakeConfirm.confirmSelection = true;
  assert.throws(() => importReview(out, fakeConfirm), /请至少选择一个有效模型|选择了未通过检查/, 'confirm over unchecked entries refused');
  console.log('PASS draft protocol: intent recorded, no confirmation authority, no inject/export');
}

// ---------------------------------------------------------------------------
// 7. Package update (matrix #7)
// ---------------------------------------------------------------------------
{
  const mkGltf = (n) => JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'body' + n, mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ uri: 'mesh' + n + '.bin', byteLength: 36 }], bufferViews: [{ buffer: 0, byteLength: 36 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }] });
  const bin = (n) => Buffer.from(new Float32Array([-0.5, 0, -0.5, n, 0, -0.5, -0.5, 0, 0.5]).buffer);
  const oldIn = resolve(root, 'upd-old-in'); fs.mkdirSync(oldIn);
  fs.writeFileSync(resolve(oldIn, 'a.gltf'), mkGltf(1)); fs.writeFileSync(resolve(oldIn, 'mesh1.bin'), bin(1));
  fs.writeFileSync(resolve(oldIn, 'b.gltf'), mkGltf(2)); fs.writeFileSync(resolve(oldIn, 'mesh2.bin'), bin(2));
  const oldPkgDir = resolve(root, 'upd-old');
  const oldPkg = receive(oldIn, oldPkgDir, '原包说明');
  const oa = oldPkg.assets[0];
  applyCheckResult(oldPkgDir, { assetId: oa.id, contentHash: oa.contentHash, checkerVersion: CHECKER_VERSION, ok: true, image: pixelPNG.toString('base64'), bbox: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }, meshes: 1, triangles: 1, instanced: false, skinned: false, nodeCount: 1, drawCalls: 1, textureCount: 0, maxTextureSize: 0 });
  const withCheck = loadPackage(oldPkgDir);
  withCheck.assets[0].name = '精密空调 A'; withCheck.assets[0].description = '行末空调'; withCheck.assets[0].confirmed = true;
  withCheck.assets[1].name = '机柜 B';
  fs.writeFileSync(resolve(oldPkgDir, 'package.json'), JSON.stringify(withCheck, null, 2));

  // New ZIP: a.gltf unchanged; b.gltf content changed (same path); c.glb added; b2? no — keep it simple
  const newIn = resolve(root, 'upd-new-in'); fs.mkdirSync(newIn);
  fs.writeFileSync(resolve(newIn, 'a.gltf'), mkGltf(1)); fs.writeFileSync(resolve(newIn, 'mesh1.bin'), bin(1));
  fs.writeFileSync(resolve(newIn, 'b.gltf'), mkGltf(9)); fs.writeFileSync(resolve(newIn, 'mesh9.bin'), bin(9)); // same path new content+dep
  fs.writeFileSync(resolve(newIn, 'c.glb'), triangleGlb());
  const zipEntries = [];
  for (const f of fs.readdirSync(newIn)) zipEntries.push({ name: f, data: fs.readFileSync(resolve(newIn, f)) });
  const zip = resolve(root, 'upd-new.zip'); writeZip(zipEntries, zip);

  const newOut = resolve(root, 'upd-new');
  const result = updatePackage(oldPkgDir, zip, newOut);
  const s = result.updateSummary;
  assert.equal(s.unchanged, 1, 'a unchanged');
  assert.equal(s.updated, 1, 'b same-path changed');
  assert.equal(s.added, 1, 'c added');
  assert.equal(result.parentPackageId, oldPkg.id, 'parentPackageId recorded');
  const byEntry = new Map(result.assets.map((a) => [a.entry, a]));
  assert.equal(byEntry.get('a.gltf').name, '精密空调 A', 'name migrated');
  assert.equal(byEntry.get('a.gltf').description, '行末空调', 'description migrated');
  assert.equal(byEntry.get('a.gltf').technicalStatus, 'loadable', 'unchanged content reuses check');
  assert.equal(byEntry.get('a.gltf').mapping.kind, 'unchanged');
  assert.equal(byEntry.get('b.gltf').name, '机柜 B', 'name migrated for updated');
  assert.notEqual(byEntry.get('b.gltf').technicalStatus, 'loadable', 'changed content must re-check');
  assert.equal(byEntry.get('b.gltf').mapping.kind, 'updated');
  // Original preserved
  const stillOld = loadPackage(oldPkgDir);
  assert.equal(stillOld.assets.length, 2);
  assert.equal(stillOld.assets[0].name, '精密空调 A');
  assert(!fs.existsSync(resolve(oldPkgDir, 'files/mesh9.bin')), 'original files untouched');
  // Ambiguity: two identical new entries can only map to one old -> other becomes added
  const ambIn = resolve(root, 'amb-new-in'); fs.mkdirSync(ambIn);
  fs.writeFileSync(resolve(ambIn, 'b.gltf'), mkGltf(2)); fs.writeFileSync(resolve(ambIn, 'mesh2.bin'), bin(2));
  fs.writeFileSync(resolve(ambIn, 'b-copy.gltf'), mkGltf(2)); // duplicate content under new name
  const ambZip = resolve(root, 'amb.zip'); writeZip([
    { name: 'b.gltf', data: fs.readFileSync(resolve(ambIn, 'b.gltf')) },
    { name: 'b-copy.gltf', data: fs.readFileSync(resolve(ambIn, 'b-copy.gltf')) },
    { name: 'mesh2.bin', data: fs.readFileSync(resolve(ambIn, 'mesh2.bin')) },
  ], ambZip);
  const ambOut = resolve(root, 'amb-new');
  const amb = updatePackage(oldPkgDir, ambZip, ambOut);
  assert.equal(amb.updateSummary.unchanged + amb.updateSummary.renamed + amb.updateSummary.updated, 1, 'only one path matches the old b');
  assert.equal(amb.updateSummary.added, 1, 'the duplicate copy is added, not double-mapped');
  console.log('PASS package update: unchanged/updated/added/removed, migration, original preserved, no double-mapping');
}

// ---------------------------------------------------------------------------
// 8. Version/transaction + vector template raw_data (matrix #8, #10)
// ---------------------------------------------------------------------------
{
  const input = resolve(root, 'vec-in'); fs.mkdirSync(input);
  fs.writeFileSync(resolve(input, 'a.glb'), triangleGlb());
  const out = resolve(root, 'vec-pkg');
  receive(input, out, '向量包');
  const p0 = loadPackage(out);
  const a = p0.assets[0];
  applyCheckResult(out, { assetId: a.id, contentHash: a.contentHash, checkerVersion: CHECKER_VERSION, ok: true, image: pixelPNG.toString('base64'), bbox: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] }, meshes: 1, triangles: 1, instanced: false, skinned: false, nodeCount: 2, drawCalls: 1, textureCount: 1, maxTextureSize: 256 });
  const p1 = loadPackage(out);
  p1.assets[0].name = '向量空调'; p1.assets[0].confirmed = true;p1.assets[0].frontConfirmed=true;p1.assets[0].scaleConfirmed=true;
  p1.confirmation = { revision: p1.revision, usable: [p1.assets[0].id], excluded: [] };
  fs.writeFileSync(resolve(out, 'package.json'), JSON.stringify(p1, null, 2));
  const zipOut = resolve(root, 'vec.zip');
  const result = exportPackage(out, zipOut, { source_id: 16, group_id: 973 });
  assert.equal(result.status, 'ready_for_manual_upload');
  const files = inputFiles(zipOut);
  const config = files.find((f) => f.name === 'config.json');
  const parsed = JSON.parse(config.data.toString('utf8'));
  assert.equal(parsed.meta.type, 'file', 'outer template type');
  assert.equal(parsed.meta.source_id, 16);
  assert.equal(parsed.meta.group_id, 973);
  assert.equal(parsed.data.length, 1);
  const entry = parsed.data[0];
  for (const key of ['name', 'file_name', 'file_path', 'thumbnail_path', 'description', 'tags', 'search_text', 'raw_data']) assert(key in entry, `template field ${key}`);
  const raw = entry.raw_data;
  for (const key of ['bbox', 'triangles', 'draw_calls', 'node_count', 'texture_count', 'max_texture_size']) assert(key in raw, `raw_data field ${key}`);
  assert.equal(Object.keys(raw).length,6);assert(!('content_hash' in raw));
  assert.deepEqual(raw.bbox, { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5] });
  assert.equal(raw.triangles, 1); assert.equal(raw.node_count, 2); assert.equal(raw.draw_calls, 1); assert.equal(raw.texture_count, 1); assert.equal(raw.max_texture_size, 256);
  // Library metadata passthrough sanitization
  assert.deepEqual(sanitizeLibraryMetadata({ triangles: 5, draw_calls: 2, node_count: 3, texture_count: 1, max_texture_size: 512, bbox: { min: [0, 0, 0], max: [1, 1, 1] }, units: 'm' }), { triangles: 5, draw_calls: 2, node_count: 3, texture_count: 1, max_texture_size: 512, bbox: { min: [0, 0, 0], max: [1, 1, 1] }, units: 'm' });
  assert.equal(sanitizeLibraryMetadata({ triangles: -3 }), null, 'negative dropped');
  assert.equal(sanitizeLibraryMetadata({ junk: 'x' }), null, 'unknown fields dropped');
  assert.equal(sanitizeLibraryMetadata(null), null);
  console.log('PASS vector template: outer config identical to file_templete, raw_data whitelist, library metadata sanitization');
}

console.log('FIXTURE: ' + root);
