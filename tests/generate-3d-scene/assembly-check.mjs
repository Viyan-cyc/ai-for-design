import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAssembly } from '../../skills/generate-3d-scene/scripts/lib/assembly-check.mjs';

const skill = fileURLToPath(new URL('../../skills/generate-3d-scene/', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'assembly-fixture-'));
const profile = join(root, 'src/scene3d/scene-profile.ts');
const data = join(root, 'public/scene3d/scene-data.json');
const setFactory = body => writeFileSync(profile, `
import * as THREE from 'three';
import {createComposite} from './scene-core/handlers/procedural/composite';
export function registerBusinessFactories({sceneEngine}) {
 sceneEngine.registerFactory('test', {create(node) {
 const b=createComposite(), g=new THREE.BoxGeometry(1,1,1), m=new THREE.MeshStandardMaterial();
 ${body}
 }});
}`);
try {
  cpSync(join(skill, 'template'), root, { recursive: true });
  writeFileSync(data, JSON.stringify({ test: [{ id: 'first' }, { id: 'second' }] }));
  for (const [body, expected] of [
    [`const col=()=>b.mesh('corner_col',g,m); col(); col(); return b.finish();`, 'Duplicate slot: corner_col'],
    [`for(let i=0;i<4;i++) b.mesh('dock_doors',g,m); return b.finish();`, 'Duplicate slot: dock_doors'],
    [`b.finish(); b.mesh('late',g,m); return b.finish();`, 'Composite already finished'],
    [`b.mesh('bad/name',g,m); return b.finish();`, 'Invalid slot name'],
    [`for(let i=0;i<2;i++) b.batch('steel',g,new THREE.MeshStandardMaterial()); return b.finish();`, 'same material instance'],
  ]) {
    setFactory(body);
    const result = await checkAssembly(root);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.errors.length, 2, JSON.stringify(result));
    assert.ok(result.errors.every(error => error.includes(expected)), JSON.stringify(result));
    assert.match(result.errors[0], /scene-profile\.ts/); // source maps locate generated handler
  }
  setFactory(`const col=(id)=>b.mesh(id,g,m); col('left'); col('right');
    const batch=b.batchSlot('beams',m); for(let i=0;i<4;i++) batch.add(new THREE.BoxGeometry(1,1,1));
    return b.finish();`);
  let result = await checkAssembly(root);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.checked, 2);
  assert.equal(result.skipped.length, 0);
  setFactory(`Promise.reject(new Error('async rejected')); return b.finish();`);
  result = await checkAssembly(root);
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.match(result.errors.join('\n'), /async rejected/);
  setFactory(`if(node.id==='first') document.createElement('canvas');
    b.mesh('x',g,m); b.mesh('x',g,m); return b.finish();`);
  result = await checkAssembly(root);
  assert.equal(result.ok, false);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /second: Error: Duplicate slot/);
  writeFileSync(data, JSON.stringify({ asset: [{ id: 'remote', params: { assetId: 'truck' } }] }));
  result = await checkAssembly(root);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.checked, 0);
  assert.equal(result.skipped.length, 1); // never claim GLB loaded
  writeFileSync(data, JSON.stringify({ test: [{ id: 'loop' }] }));
  setFactory('while(true) {}');
  result = await checkAssembly(root, { timeout: 500 });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /ETIMEDOUT/);
  setFactory('this is not valid TypeScript !');
  result = await checkAssembly(root);
  assert.equal(result.ok, false);
  console.log('PASS: assembly errors, source locations, valid batches, partial coverage, assets, timeout, syntax');
} finally { rmSync(root, { recursive: true, force: true }); }
