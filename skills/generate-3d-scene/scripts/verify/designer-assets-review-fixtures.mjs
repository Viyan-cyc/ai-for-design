/** DA-R1–R3: exercise actual preview, confirmation, injection and export. */
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {receive,loadPackage,confirm,inject,exportPackage,inputFiles} from '../lib/designer-assets.mjs';
import {previewPackage} from '../lib/asset-preview.mjs';
import {downloadCandidate} from '../lib/asset-service.mjs';
import {pixelPNG} from './asset-fixture-data.mjs';
const root=mkdtempSync(resolve(tmpdir(),'designer-assets-review-'));
const model={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],buffers:[{uri:'mesh.bin',byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-1,0,-0.5],max:[1,1,0.5]}],images:[{uri:'texture.png'}],textures:[{source:0}],materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorTexture:{index:0}}}]};
const geometry=n=>Buffer.from(new Float32Array([-1,0,-0.5,n,0,0.5,-1,1,0.5]).buffer);
async function prepare(name,{gltf=model,bin=geometry(1),texture=pixelPNG,extra={}}={}){
 const input=resolve(root,name+'-input'),out=resolve(root,name);mkdirSync(input);
 for(const [file,data] of Object.entries({'object.gltf':JSON.stringify(gltf),'mesh.bin':bin,'texture.png':texture,'notes.txt':'ordinary attachment',...extra}))writeFileSync(resolve(input,file),data);
 receive(input,out);await previewPackage(out);const pkg=loadPackage(out);assert.equal(pkg.assets.find(a=>a.entry==='object.gltf').technicalStatus,'loadable');return {out,pkg};
}
const a=await prepare('base'),b=await prepare('different-bin',{bin:geometry(2)});
// A valid JPEG differs in actual image data; the loader detects MIME independently of URI suffix.
const image=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAwT/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCWAB//2Q==','base64');
const c=await prepare('different-texture',{texture:image});
assert.notEqual(a.pkg.assets[0].id,b.pkg.assets[0].id);assert.notEqual(a.pkg.assets[0].id,c.pkg.assets[0].id);
const project=resolve(root,'project');mkdirSync(project);
for(const p of [a,b,c]){confirm(p.out,p.pkg.revision,{confirmFront:true,confirmScale:true});inject(p.out,project);}
const manifest=()=>readFileSync(resolve(project,'public/assets/asset-manifest.json'),'utf8');const before=manifest();inject(a.out,project);assert.equal(manifest(),before);assert.equal(Object.keys(JSON.parse(before)).length,3);
const duplicate=await prepare('duplicate');assert.equal(duplicate.pkg.assets[0].id,a.pkg.assets[0].id);
console.log('PASS dependency-aware IDs, bin/texture variants and idempotent injection');
const mixed=await prepare('mixed',{extra:{'truck.fbx':'unsupported'}});const unsupported=mixed.pkg.assets.find(a=>a.entry==='truck.fbx');assert.equal(unsupported.technicalStatus,'invalid');assert(mixed.pkg.unassociatedFiles.includes('notes.txt'));assert(!mixed.pkg.assets.some(a=>a.entry==='notes.txt'));
assert.throws(()=>confirm(mixed.out,mixed.pkg.revision),/not loadable/);const partial=confirm(mixed.out,mixed.pkg.revision,{allowPartial:true,confirmFront:true,confirmScale:true});assert.deepEqual(partial.confirmation.excluded,[unsupported.id]);
const result=exportPackage(mixed.out,resolve(root,'mixed.zip'),{source_id:16});assert.deepEqual(result.excluded,[unsupported.id]);assert.equal(result.count,1);assert(!inputFiles(result.path).some(f=>f.name.endsWith('.fbx')));
const onlyInput=resolve(root,'unsupported-input');mkdirSync(onlyInput);writeFileSync(resolve(onlyInput,'truck.fbx'),'unsupported');const only=resolve(root,'unsupported');const onlyPkg=receive(onlyInput,only);assert.throws(()=>confirm(only,onlyPkg.revision,{allowPartial:true,confirmFront:true,confirmScale:true}),/No usable/);assert.throws(()=>exportPackage(only,resolve(root,'empty.zip'),{source_id:16}),/confirmation/);
console.log('PASS complete mixed-package exclusions and no empty success');
for(const [name,gltf,selected,selection] of [['single',model,0,'default'],['multi-default',{...model,scenes:[{nodes:[0]},{nodes:[0]}],scene:1},1,'default'],['multi-first',{...model,scenes:[{nodes:[0]},{nodes:[0]}],scene:undefined},0,'first']]){
 const p=await prepare(name,{gltf});const cli=spawnSync(process.execPath,['scripts/designer-assets.mjs','list',p.out],{encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);const item=JSON.parse(cli.stdout).assets[0];assert.equal(item.sceneCount,gltf.scenes.length);assert.equal(item.selectedScene,selected);assert.equal(item.sceneSelection,selection);assert(item.sceneScope.length>0);if(gltf.scenes.length>1)assert(item.sceneScope.includes('其余不载入'));
}
console.log('PASS scene scope in CLI and confirmation HTML');
const server=createServer((req,res)=>{if(req.url.endsWith('.gltf'))res.end(JSON.stringify(model));else if(req.url.endsWith('mesh.bin'))res.end(geometry(req.url.startsWith('/b/')?2:1));else res.end(pixelPNG);});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
try{const base=`http://127.0.0.1:${server.address().port}`,cfg={endpoint:base,allowedOrigins:[base]},ids=[];for(const name of ['a','b']){const out=resolve(root,'remote-'+name);await downloadCandidate({entryUrl:`${base}/${name}/model.gltf`,remoteId:name,name},out,cfg);const p=await previewPackage(out);assert.equal(p.assets[0].technicalStatus,'loadable');confirm(out,p.revision);inject(out,project);ids.push(p.assets[0].id);}assert.notEqual(...ids);console.log('PASS two remote candidates with identical entry JSON');}finally{await new Promise(ok=>server.close(ok));}
console.log('FIXTURE:',root);
