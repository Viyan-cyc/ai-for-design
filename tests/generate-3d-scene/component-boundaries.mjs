import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
const root = resolve(process.argv[2] ?? '../3d-components');
const THREE = await import(pathToFileURL(resolve(root, 'node_modules/three/build/three.module.js')));
const { ScreenLabel } = await import(pathToFileURL(resolve(root, 'dist/es/labels.js')));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
for (const dep of ['maplibre-gl', 'gsap', 'three-bvh-csg', 'three-mesh-bvh']) assert.equal(pkg.peerDependenciesMeta[dep].optional, true);
// Traverse emitted JS imports rather than relying on tree-shaking assumptions.
function dependencies(file, visited = new Set()) {
  if (visited.has(file)) return new Set(); visited.add(file);
  const code = readFileSync(file, 'utf8'), imports = new Set();
  for (const match of code.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
    if (match[1].startsWith('.')) for (const item of dependencies(resolve(dirname(file), match[1]), visited)) imports.add(item);
    else imports.add(match[1]);
  }
  return imports;
}
assert.deepEqual([...dependencies(resolve(root,'dist/es/labels.js'))], ['three']);
assert.ok(!dependencies(resolve(root,'dist/es/index.js')).has('maplibre-gl'));
assert.deepEqual([...dependencies(resolve(root,'dist/es/map.js'))].sort(), ['maplibre-gl','three']);
console.log('PASS labels/map/root dependency isolation; optional peers');
let count=0;
for (const perspective of [true,false]) for (const distance of [10,100,1000])
for (const cssWidth of [640,1920]) for (const dpr of [.75,1,2]) {
  const camera=perspective?new THREE.PerspectiveCamera(50,cssWidth/720,.1,10000):new THREE.OrthographicCamera(-10,10,10,-10,.1,10000);
  camera.position.set(0,0,distance);camera.updateMatrixWorld();
  const texture=new THREE.Texture(),label=new ScreenLabel({texture});
  const parent=new THREE.Group();parent.scale.set(2,3,2);parent.add(label);parent.updateMatrixWorld(true);
  const renderer={domElement:{width:cssWidth*dpr,height:720*dpr,getBoundingClientRect:()=>({width:cssWidth,height:720})}};
  label.onBeforeRender(renderer,null,camera);
  const view=new THREE.Vector4(...label.getWorldPosition(new THREE.Vector3()).toArray(),1).applyMatrix4(camera.matrixWorldInverse);
  const centerClip=view.clone().applyMatrix4(camera.projectionMatrix);
  const worldScale=label.getWorldScale(new THREE.Vector3());
  const x=view.clone();x.x+=worldScale.x;x.applyMatrix4(camera.projectionMatrix);
  const y=view.clone();y.y+=worldScale.y;y.applyMatrix4(camera.projectionMatrix);
  assert.ok(Math.abs((x.x/x.w-centerClip.x/centerClip.w)*cssWidth/2-180)<1e-6);
  assert.ok(Math.abs((y.y/y.w-centerClip.y/centerClip.w)*720/2-48)<1e-6);
  let released=0,externalReleased=0;
  label.material.addEventListener('dispose',()=>released++);texture.addEventListener('dispose',()=>externalReleased++);
  label.dispose();label.dispose();assert.equal(released,1);assert.equal(externalReleased,0);assert.equal(parent.children.length,0);
  texture.dispose();count++;
}
for (const widthPx of [0,-1,Infinity,NaN,2049]) assert.throws(()=>new ScreenLabel({widthPx}));
globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},measureText(){return {width:10}},fillText(){}})})};
const own=new ScreenLabel({text:'test',anchor:[0,1]});let disposed=0;
own.material.map.addEventListener('dispose',()=>disposed++);own.dispose();own.dispose();assert.equal(disposed,1);
assert.deepEqual(own.center.toArray(),[0,1]);
console.log(`PASS ${count} projected-size cases, DPR/resize/distance/parent scale, ownership/idempotent cleanup/input validation`);

const original=new ScreenLabel({text:'clone',widthPx:240,heightPx:60});
const copied=original.clone(),group=new THREE.Group();group.add(original);
const nested=group.clone(true).children[0];
assert.notEqual(copied.material,original.material);
assert.notEqual(copied.material.map,original.material.map);
const cam=new THREE.PerspectiveCamera(50,1,.1,100);cam.position.z=10;cam.updateMatrixWorld();
const renderer={domElement:{getBoundingClientRect:()=>({width:600,height:600})}};
for(const item of [original,copied,nested]) item.onBeforeRender(renderer,null,cam);
assert.equal(copied.scale.x,original.scale.x);assert.equal(nested.scale.y,original.scale.y);
let sourceDisposals=0;original.material.addEventListener('dispose',()=>sourceDisposals++);
copied.dispose();nested.dispose();assert.equal(sourceDisposals,0);
const target=new ScreenLabel();let oldDisposed=0;target.material.map.addEventListener('dispose',()=>oldDisposed++);
target.copy(original);assert.equal(oldDisposed,1);target.dispose();original.dispose();assert.equal(sourceDisposals,1);
console.log('PASS clone/copy/Group.clone preserve size and isolate owned resources');
