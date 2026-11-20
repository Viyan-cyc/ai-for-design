import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {createServer} from 'node:http';
import {triangleGlb} from './asset-fixture-data.mjs';
import {downloadCandidate} from '../../skills/generate-3d-scene/scripts/lib/asset-service.mjs';
import {inject,loadPackage,receive} from '../../skills/generate-3d-scene/scripts/lib/designer-assets.mjs';
const root=fs.mkdtempSync(resolve(tmpdir(),'inject-protection-'));
const gltf=JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'mesh.bin',byteLength:4}],images:[{uri:'texture.png'}],scenes:[{nodes:[]}],scene:0});
const server=createServer((req,res)=>{res.end(req.url.endsWith('.gltf')?gltf:req.url.endsWith('.glb')?triangleGlb():Buffer.from([1,2,3,4]));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const snap=p=>Object.fromEntries(fs.readdirSync(p,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const f=resolve(e.parentPath??e.path,e.name);return[f,fs.readFileSync(f).toString('base64')];}));
try{
 const origin=`http://127.0.0.1:${server.address().port}`,pkg=resolve(root,'pkg');
 await downloadCandidate({remoteId:'sample',name:'sample',entryUrl:origin+'/model.gltf'},pkg,{endpoint:origin,allowedOrigins:[origin]});
 const a=loadPackage(pkg).assets[0];assert(a.files.length>=3);
 const flatPackage=resolve(root,'flat-package'),flatProject=resolve(root,'flat-project');
 await downloadCandidate({remoteId:'tower',name:'tower',entryUrl:origin+'/tower.glb'},flatPackage,{endpoint:origin,allowedOrigins:[origin]});
 const [injected]=inject(flatPackage,flatProject);
 const flat=JSON.parse(fs.readFileSync(resolve(flatProject,'public/data/model-manifest.json')));
 assert.equal(flat[injected.id].model,'/models/model.glb');
 assert.deepEqual(fs.readFileSync(resolve(flatProject,'public/models/model.glb')),triangleGlb());
 inject(flatPackage,flatProject);
 const input=resolve(root,'case-input'),casePackage=resolve(root,'case-package'),caseProject=resolve(root,'case-project');
 for(const [folder,name,nested] of [['first','Tower.glb',false],['second','tower.glb',true]]){
  fs.mkdirSync(resolve(input,folder),{recursive:true});
  fs.writeFileSync(resolve(input,folder,name),triangleGlb(nested));
 }
 receive(input,casePackage);
 const caseMetadata=loadPackage(casePackage);
 for(const asset of caseMetadata.assets)asset.origin='remote';
 fs.writeFileSync(resolve(casePackage,'package.json'),JSON.stringify(caseMetadata));
 const entries=inject(casePackage,caseProject);
 const caseManifest=JSON.parse(fs.readFileSync(resolve(caseProject,'public/data/model-manifest.json')));
 assert.equal(entries.length,2);
 assert.equal(new Set(entries.map(({id})=>caseManifest[id].model.toLowerCase())).size,2);
 for(const asset of caseMetadata.assets){
  const model=caseManifest[asset.id].model;
  assert.match(model,/^\/models\/tower(?:-2)?\.glb$/i);
  assert.deepEqual(fs.readFileSync(resolve(caseProject,'public',model.slice(1))),fs.readFileSync(resolve(casePackage,'files',asset.entry)));
 }
 const caseBefore=snap(caseProject);
 inject(casePackage,caseProject);
 assert.deepEqual(snap(caseProject),caseBefore);
 const occupiedProject=resolve(root,'occupied-project'),models=resolve(occupiedProject,'public/models');
 fs.mkdirSync(models,{recursive:true});
 fs.writeFileSync(resolve(models,'TOWER.glb'),'user model');
 fs.writeFileSync(resolve(models,'tower-2.glb'),'another user model');
 inject(casePackage,occupiedProject);
 const numbered=JSON.parse(fs.readFileSync(resolve(occupiedProject,'public/data/model-manifest.json')));
 assert.deepEqual(Object.values(numbered).map(({model})=>model.toLowerCase()).sort(),['/models/tower-3.glb','/models/tower-4.glb']);
 assert.equal(fs.readFileSync(resolve(models,'TOWER.glb'),'utf8'),'user model');

 const dotInput=resolve(root,'dot-input'),dotPackage=resolve(root,'dot-package'),dotProject=resolve(root,'dot-project');
 fs.mkdirSync(dotInput);
 for(const name of ['..gltf','...gltf'])fs.writeFileSync(resolve(dotInput,name),gltf);
 fs.writeFileSync(resolve(dotInput,'mesh.bin'),Buffer.from([1,2,3,4]));
 fs.writeFileSync(resolve(dotInput,'texture.png'),Buffer.from([1,2,3,4]));
 receive(dotInput,dotPackage);
 const dotMetadata=loadPackage(dotPackage);
 assert.equal(dotMetadata.assets.length,2);
 for(const asset of dotMetadata.assets)asset.origin='remote';
 fs.writeFileSync(resolve(dotPackage,'package.json'),JSON.stringify(dotMetadata));
 inject(dotPackage,dotProject);
 const dotPublic=resolve(dotProject,'public');
 assert.deepEqual(fs.readdirSync(dotPublic).sort(),['data','models']);
 assert.deepEqual(fs.readdirSync(resolve(dotPublic,'models')).sort(),['model','model-2']);
 for(const dir of ['model','model-2']){
  const files=fs.readdirSync(resolve(dotPublic,'models',dir));
  assert(files.includes('mesh.bin')&&files.includes('texture.png')&&files.some(name=>name.endsWith('.gltf')));
 }
 for(const [index,value] of [[],null,'invalid',42,true].entries()){
  const project=resolve(root,'invalid'+index),manifest=resolve(project,'public/data/model-manifest.json');
  fs.mkdirSync(dirname(manifest),{recursive:true});fs.writeFileSync(manifest,JSON.stringify(value));
  const before=snap(project);
  const result=spawnSync(process.execPath,[resolve('skills/generate-3d-scene/scripts/designer-assets.mjs'),'inject',pkg,'--project',project],{encoding:'utf8'});
  assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.stdout.trim(),'');assert.match(result.stderr,/Invalid asset manifest/);
  assert.deepEqual(snap(project),before,'invalid manifest must not write any assets');
 }
 const emptyProject=resolve(root,'empty-mapping'),emptyManifest=resolve(emptyProject,'public/data/model-manifest.json');
 fs.mkdirSync(dirname(emptyManifest),{recursive:true});fs.writeFileSync(emptyManifest,'{}');
 inject(pkg,emptyProject);assert(JSON.parse(fs.readFileSync(emptyManifest))[a.id]);

 for(const [i,file] of a.files.entries()){
  const project=resolve(root,'project'+i);inject(pkg,project);const before=snap(project);inject(pkg,project);assert.deepEqual(snap(project),before);
  const manifest=JSON.parse(fs.readFileSync(resolve(project,'public/data/model-manifest.json')));
  const model=manifest[a.id].model;
  assert(model.startsWith('/models/model/'));
  const base=resolve(project,'public',model.slice(1,-a.entry.length));
  fs.writeFileSync(resolve(base,file),'USER EDIT');
  const other=a.files.find(f=>f!==file);fs.unlinkSync(resolve(base,other));
  const changed=snap(project);assert.throws(()=>inject(pkg,project),/conflict/);assert.deepEqual(snap(project),changed);
 }
 console.log('PASS real download/inject: first/repeat, model/bin/texture conflicts, missing sibling not written, manifest unchanged');
}finally{await new Promise(r=>server.close(r));assert(root.startsWith(resolve(tmpdir(),'inject-protection-')));fs.rmSync(root,{recursive:true,force:true});}
