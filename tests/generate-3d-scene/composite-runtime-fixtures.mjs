import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dependencyPath } from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/generate-3d-scene');
const ts = (await import(pathToFileURL(dependencyPath('typescript/lib/typescript.js')))).default;
registerHooks({
 resolve(s,c,next) {
  if(s === 'three') return {url:pathToFileURL(dependencyPath('three/build/three.module.js')).href,shortCircuit:true};
  if(s.startsWith('three/')) return {url:pathToFileURL(dependencyPath(s)).href,shortCircuit:true};
  if(s.startsWith('.') && c.parentURL){const candidate=new URL(s+'.ts',c.parentURL);if(existsSync(candidate))return {url:candidate.href,shortCircuit:true};}
  return next(s,c);
 },
 load(u,c,next) {
  if(u.endsWith('.ts')) return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(u),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
  return next(u,c);
 }
});
const THREE = await import('three');
const {createComposite} = await import(pathToFileURL(join(skill,'template/src/scene3d/scene-core/handlers/procedural/composite.ts')));

const {findBySlotKey, applyVisualOverride} = await import(pathToFileURL(join(skill,'template/src/scene3d/scene-core/materials.ts')));
const b=createComposite(), material=new THREE.MeshStandardMaterial();
b.mesh('shellDeep',new THREE.BoxGeometry(),material);
const slot=b.batchSlot('steelFrame',material);
slot.add(new THREE.BoxGeometry());slot.add(new THREE.BoxGeometry());
b.mesh('wall_-1_left',new THREE.BoxGeometry(),material);
const root=b.finish();
assert.equal(findBySlotKey(root,'shellDeep').name,'shellDeep');
assert.equal(findBySlotKey(root,'steelFrame').material,material);
assert.equal(findBySlotKey(root,'wall_-1_left').name,'wall_-1_left');
const saved=JSON.parse(JSON.stringify({slots:{shellDeep:{color:'#ff0000'}}}));
await applyVisualOverride(root,saved);
assert.equal(findBySlotKey(root,'shellDeep').material.color.getHexString(),'ff0000');
assert.equal(findBySlotKey(root,'steelFrame').material.color.getHexString(),'ffffff');
const bad=createComposite(), a=new THREE.MeshStandardMaterial(), c=a.clone();
bad.batchSlot('steel',a);
const rejected=new THREE.BoxGeometry();
assert.throws(()=>bad.batch('steel',rejected,c),/same material instance.*batchSlot/);rejected.dispose();
assert.throws(()=>bad.mesh('steel',new THREE.BoxGeometry(),a),/Duplicate slot/);
assert.throws(()=>bad.mesh('path/name',new THREE.BoxGeometry(),a),/Invalid slot/);
bad.finish();assert.throws(()=>bad.batchSlot('later',a),/already finished/);
root.traverse(o=>{o.geometry?.dispose();if(o.material&&o.material!==material)o.material.dispose();});
material.dispose();a.dispose();c.dispose();
console.log('PASS composite name preservation, actual slot lookup/JSON visual edit, batching, material identity and lifecycle guards');
