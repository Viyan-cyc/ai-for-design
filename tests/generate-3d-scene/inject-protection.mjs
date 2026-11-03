import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {createServer} from 'node:http';
import {downloadCandidate} from '../../skills/generate-3d-scene/scripts/lib/asset-service.mjs';
import {inject,loadPackage} from '../../skills/generate-3d-scene/scripts/lib/designer-assets.mjs';
const root=fs.mkdtempSync(resolve(tmpdir(),'inject-protection-'));
const gltf=JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'mesh.bin',byteLength:4}],images:[{uri:'texture.png'}],scenes:[{nodes:[]}],scene:0});
const server=createServer((req,res)=>{res.end(req.url.endsWith('.gltf')?gltf:Buffer.from([1,2,3,4]));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const snap=p=>Object.fromEntries(fs.readdirSync(p,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const f=resolve(e.parentPath??e.path,e.name);return[f,fs.readFileSync(f).toString('base64')];}));
try{
 const origin=`http://127.0.0.1:${server.address().port}`,pkg=resolve(root,'pkg');
 await downloadCandidate({remoteId:'sample',name:'sample',entryUrl:origin+'/model.gltf'},pkg,{endpoint:origin,allowedOrigins:[origin]});
 const a=loadPackage(pkg).assets[0];assert(a.files.length>=3);
 for(const [index,value] of [[],null,'invalid',42,true].entries()){
  const project=resolve(root,'invalid'+index),manifest=resolve(project,'public/scene3d/assets/asset-manifest.json');
  fs.mkdirSync(dirname(manifest),{recursive:true});fs.writeFileSync(manifest,JSON.stringify(value));
  const before=snap(project);
  const result=spawnSync(process.execPath,[resolve('skills/generate-3d-scene/scripts/designer-assets.mjs'),'inject',pkg,'--project',project],{encoding:'utf8'});
  assert.equal(result.status,1,result.stdout+result.stderr);assert.equal(result.stdout.trim(),'');assert.match(result.stderr,/Invalid asset manifest/);
  assert.deepEqual(snap(project),before,'invalid manifest must not write any assets');
 }
 const emptyProject=resolve(root,'empty-mapping'),emptyManifest=resolve(emptyProject,'public/scene3d/assets/asset-manifest.json');
 fs.mkdirSync(dirname(emptyManifest),{recursive:true});fs.writeFileSync(emptyManifest,'{}');
 inject(pkg,emptyProject);assert(JSON.parse(fs.readFileSync(emptyManifest))[a.id]);

 for(const [i,file] of a.files.entries()){
  const project=resolve(root,'project'+i);inject(pkg,project);const before=snap(project);inject(pkg,project);assert.deepEqual(snap(project),before);
  const base=resolve(project,'public/scene3d/assets',`models/packages/${a.id}_${a.contentHash.slice(0,12)}`);
  fs.writeFileSync(resolve(base,file),'USER EDIT');
  const other=a.files.find(f=>f!==file);fs.unlinkSync(resolve(base,other));
  const changed=snap(project);assert.throws(()=>inject(pkg,project),/conflict/);assert.deepEqual(snap(project),changed);
 }
 console.log('PASS real download/inject: first/repeat, model/bin/texture conflicts, missing sibling not written, manifest unchanged');
}finally{await new Promise(r=>server.close(r));assert(root.startsWith(resolve(tmpdir(),'inject-protection-')));fs.rmSync(root,{recursive:true,force:true});}
