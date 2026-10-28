/** Maintenance only: package boundaries, failure cleanup and batched card updates. */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..').replaceAll('\\', '/');
const env = await import(
  pathToFileURL(root + '/skills/generate-3d-scene/scripts/lib/environment.mjs')
);
const esbuild = await import(pathToFileURL(env.dependencyPath('esbuild/lib/main.js')));
const dir = mkdtempSync(join(tmpdir(), 'scene3d-review-'));
const core = root + '/skills/generate-3d-scene/template/src/scene3d/scene-core';
const entry = `import * as THREE from 'three';import {createScene} from '${core}/createScene';import {setupCards} from '${core}/cards/registry';import {AssetEngine} from '${core}/engine/AssetEngine';import {RendererEngine} from '${core}/engine/RendererEngine';import {loadAssetManifest} from '${core}/asset-manifest';import {createDataAdapter} from '${root}/skills/generate-3d-scene/template/src/business/data/adapter';window.review={createDataAdapter,THREE,createScene,setupCards,AssetEngine,RendererEngine,loadAssetManifest};`;
const compiled = await esbuild.build({
  stdin: { contents: entry, resolveDir: root, loader: 'ts' },
  bundle: true,
  format: 'esm',
  write: false,
  nodePaths: [env.dependencyPath('three').replace(/[\\/]three$/, '')],
  define: { 'import.meta.env.DEV': 'false', 'process.env.NODE_ENV': '"production"' },
});
const data = JSON.parse(
  readFileSync(root + '/skills/generate-3d-scene/template/public/scene3d/scene-data.json', 'utf8'),
);
for (const key of Object.keys(data))
  if (!['version', 'meta', 'scene', 'camera', 'lights', 'controls', 'renderer'].includes(key))
    delete data[key];
const server = createServer((req, res) => {
  if (req.url === '/app.js') {
    res.setHeader('content-type', 'text/javascript');
    res.end(compiled.outputFiles[0].text);
  } else if (req.url.includes('asset-manifest')) {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ a: { model: 'models/a.glb', format: 'glb' } }));
  } else {
    res.end('<html><body><script type="module" src="/app.js"></script></body></html>');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { openBrowserSession } = await import(
  pathToFileURL(root + '/skills/generate-3d-scene/scripts/lib/cdp.mjs')
);
const session = await openBrowserSession({ port: 9479, gpu: true, deadlineMs: 15000 });
try {
  const page = await session.newPage({ url: `http://127.0.0.1:${server.address().port}` });
  for (let i = 0; i < 100 && !(await page.evaluate('!!window.review')); i++)
    await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(page.pageErrors, []);
  const result = await page.evaluate(`(async()=>{
const {createDataAdapter,THREE,createScene,setupCards,AssetEngine,RendererEngine,loadAssetManifest}=review;
const data=${JSON.stringify(data)};
const container=document.createElement('div');container.style.cssText='width:600px;height:400px;position:relative';document.body.append(container);
const canvas=document.createElement('canvas');container.append(canvas);
const urls=[];AssetEngine.prototype.getInstance=async function(id,url){urls.push(url);return new THREE.Group()};
const manifest=await loadAssetManifest('/custom/');
const handle=await createScene(canvas,{...data,asset:[{id:'model',params:{assetId:'a'}}]}, {},{assetBaseUrl:'/custom/',assetManifest:manifest});
const manifest2={a:{model:'models/other.glb',format:'glb'}};
const canvas2=document.createElement('canvas');container.append(canvas2);
const other=await createScene(canvas2,{...data,asset:[{id:'other',params:{assetId:'a'}}]}, {},{assetBaseUrl:'/other/',assetManifest:manifest2});
await new Promise(r=>setTimeout(r,100));handle.dispose();other.dispose();canvas2.remove();
const nodes=new Map(['a','b'].map(id=>[id,{id,params:{},card:{type:'none',trigger:'click'}}]));const objects=new Map(['a','b'].map(id=>[id,new THREE.Group()]));const scene=new THREE.Scene();objects.forEach(o=>scene.add(o));
const cards=setupCards({scene,camera:new THREE.PerspectiveCamera(),resolveNode:id=>nodes.get(id),resolveObject:id=>objects.get(id),enumerateNodes:()=>[...nodes],container,components:{}});
let states;cards.onState(s=>states=s.map(x=>({id:x.id,visible:x.visible})));cards.refresh();cards.handleClick('a');cards.handleClick('b');const before=states;cards.refresh();const after=states;cards.dispose();
let disposed=0;const dispose=RendererEngine.prototype.dispose;RendererEngine.prototype.dispose=function(){disposed++;return dispose.call(this)};
const perfHandle=await createScene(canvas,{...data,devices:Array.from({length:200},(_,i)=>({id:'d'+i,params:{speed:0},card:{type:'empty'}}))},{empty:{render:()=>null}},{profile:({sceneEngine})=>sceneEngine.registerFactory('devices',{create:()=>new THREE.Group(),update:()=> 'updated'})});
const engine=perfHandle.internals.sceneEngine;let nodeReads=0;const originalGet=engine.getNode.bind(engine);engine.getNode=id=>{nodeReads++;return originalGet(id)};
const adapter=createDataAdapter(perfHandle);let notifications=0;const off=perfHandle.onCardState(()=>notifications++);notifications=0;nodeReads=0;
const started=performance.now();const applied=adapter.apply(Array.from({length:200},(_,i)=>({id:'d'+i,speed:1})));const batchMs=performance.now()-started;
const readsForBatch=nodeReads;const notificationsForBatch=notifications;
const ordered=adapter.apply([{id:'d0',speed:2},{id:'missing',speed:3},{id:'d0',speed:4}]);
const finalSpeed=perfHandle.getNodeData('d0').node.params.speed;
notifications=0;try{perfHandle.batchUpdates(()=>{perfHandle.patchNodeParams('d0',{speed:5});perfHandle.batchUpdates(()=>perfHandle.patchNodeParams('d1',{speed:5}));throw Error('batch failed')})}catch{}
const failedBatchNotifications=notifications;off();perfHandle.dispose();disposed=0;
const beforeChildren=container.childElementCount;let error;try{await createScene(canvas,data,{}, {profile:()=>{throw new Error('broken handler')}})}catch(e){error=e.message}
const profileFailure={error,disposed,extraElements:container.childElementCount-beforeChildren};
let released=0;disposed=0;const elements=container.childElementCount;
try{await createScene(canvas,{...data,devices:[{id:'good'},{id:'bad'}]}, {},{profile:({sceneEngine})=>sceneEngine.registerFactory('devices',{create:node=>{if(node.id==='bad')throw Error('broken node');const geometry=new THREE.BoxGeometry();geometry.addEventListener('dispose',()=>released++);return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial())}})})}catch{}
const treeFailure={disposed,released,extraElements:container.childElementCount-elements};
return {treeFailure,urls,expected:'/custom/assets/models/a.glb',cards:{before,after},batch:{models:200,updates:applied.updated.length,nodeReads:readsForBatch,notifications:notificationsForBatch,batchMs,orderedIssues:ordered.issues.length,finalSpeed,failedBatchNotifications},failedBoot:profileFailure};
})()`);
  assert.deepEqual(result.urls, ['/custom/assets/models/a.glb', '/other/assets/models/other.glb']);
  assert.deepEqual(result.cards.before, result.cards.after);
  assert.equal(result.failedBoot.disposed, 1);
  assert.equal(result.failedBoot.extraElements, 0);
  assert.equal(result.treeFailure.disposed, 1);
  assert.equal(result.treeFailure.released, 1);
  assert.equal(result.treeFailure.extraElements, 0);
  assert.equal(result.batch.updates, 200);
  assert.equal(result.batch.notifications, 1);
  assert.ok(result.batch.nodeReads < 3000, JSON.stringify(result.batch));
  assert.equal(result.batch.finalSpeed, 4);
  assert.equal(result.batch.orderedIssues, 1);
  assert.equal(result.batch.failedBatchNotifications, 1);
  writeFileSync(join(dir, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  console.log('Evidence: ' + dir);
  await page.close();
} finally {
  await session.close();
  await new Promise((r) => server.close(r));
}
