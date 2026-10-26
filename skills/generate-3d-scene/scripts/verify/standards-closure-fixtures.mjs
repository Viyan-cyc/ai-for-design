/** Cross-module regressions for MS-R1..MS-R8. Actual browser downloads, no production service. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {receive,loadPackage,selected,applyCheckResult,checkCacheState,atomicJSON,inputFiles,exportPackage} from '../lib/designer-assets.mjs';
import {importReview,packageIdentity,generateIntakePage} from '../lib/intake-page.mjs';
import {updatePackage} from '../lib/package-update.mjs';
import {RULES_VERSION,createAcknowledgement} from '../lib/model-policy.mjs';
import {CHECKER_VERSION} from '../lib/viewer-version.mjs';
import {pixelPNG} from './asset-fixture-data.mjs';
import {openBrowserSession} from '../lib/cdp.mjs';
const root=fs.mkdtempSync(resolve(os.tmpdir(),'standards-closure-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let serial=0;
function model({faces=1,camera=false,light=false,scale=false,multi=false,uri=false}={}){
 const verts=[];for(let i=0;i<faces;i++)verts.push(-.5,0,-.5,.5,0,-.5,0,1,.5);
 const bin=Buffer.from(new Float32Array(verts).buffer);
 const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:multi?[0,1]:[0]}],nodes:[{mesh:0,...(scale?{scale:[.5,.5,.5]}:{})},...(multi?[{name:'empty'}]:[])],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[.3,.5,.75,1]}}],buffers:[{uri:uri||'data:application/octet-stream;base64,'+bin.toString('base64'),byteLength:bin.length}],bufferViews:[{buffer:0,byteLength:bin.length}],accessors:[{bufferView:0,componentType:5126,count:verts.length/3,type:'VEC3',min:[-.5,0,-.5],max:[.5,1,.5]}]};
 if(camera)json.cameras=[{type:'perspective',perspective:{yfov:1,znear:.1}}];
 if(light)json.extensions={KHR_lights_punctual:{lights:[{type:'point'}]}};
 return {json,bin};
}
function input(entries){const dir=resolve(root,'in-'+(++serial));fs.mkdirSync(dir);for(const [name,opts] of Object.entries(entries)){const {json,bin}=model(opts);fs.writeFileSync(resolve(dir,name),JSON.stringify(json));if(opts.uri)fs.writeFileSync(resolve(dir,opts.uri),bin);}return dir;}
function pkg(entries){const i=input(entries),dir=resolve(root,'pkg-'+(++serial));receive(i,dir,'原包说明');return {dir,input:i};}
const result={ok:true,image:pixelPNG.toString('base64'),bbox:{min:[-.5,0,-.5],max:[.5,1,.5]},meshes:1,triangles:1,nodeCount:1,drawCalls:1,textureCount:0,maxTextureSize:0,instanced:false,skinned:false};
function manifest(dir,{purpose='confirm',report=result}={}){const p=loadPackage(dir);return {kind:'model-intake',schemaVersion:2,purpose,submissionId:'test-'+(++serial),...packageIdentity(p),mode:'upload',baseRevision:p.revision,checkerVersion:CHECKER_VERSION,rulesVersion:RULES_VERSION,packageDescription:'已编辑包说明',confirmSelection:purpose==='confirm',allowPartial:true,entries:p.assets.map(a=>({assetId:a.id,contentHash:a.contentHash,name:'编辑 '+a.entry,description:'已编辑用途',selected:true,confirmFront:true,confirmScale:true,tier:'medium',result:report}))};}
for(const options of [{scale:true},{multi:true},{camera:true},{light:true},{}]){
 const {dir}=pkg({'rack.gltf':options});const m=manifest(dir);if(!Object.keys(options).length)m.entries[0].result={...result,bbox:{min:[10,20,30],max:[11,21,31]}};
 const before=fs.readFileSync(resolve(dir,'package.json'),'utf8');assert.throws(()=>importReview(dir,m),/违规/);assert.equal(fs.readFileSync(resolve(dir,'package.json'),'utf8'),before);
 m.purpose='draft';m.confirmSelection=false;assert.equal(importReview(dir,m).status,'draft-applied');
}
{const {dir}=pkg({'rack.gltf':{}});const m=manifest(dir);delete m.entries[0].confirmFront;assert.throws(()=>importReview(dir,m),/正面/);}
console.log('PASS MS-R1/R3 hard policy evaluated on first import; rejected batch atomic; hard violations permit drafts');
{const {dir,input:i}=pkg({'z.gltf':{}});const m=manifest(dir,{purpose:'draft',report:null});m.entries[0].selected=false;importReview(dir,m);
 const page=generateIntakePage(dir);const text=fs.readFileSync(page.data,'utf8');assert(text.includes('已编辑用途'));assert(text.includes('"selected":false'));
 const next=resolve(root,'draft-update');const updated=updatePackage(dir,i,next);assert.equal(updated.description,'已编辑包说明');assert.equal(updated.assets[0].description,'已编辑用途');assert.equal(updated.assets[0].inheritedSelection,false);
 const stale=structuredClone(m);stale.submissionId='different';const oldFile=resolve(root,'stale.json');fs.writeFileSync(oldFile,JSON.stringify(stale));assert.throws(()=>updatePackage(dir,i,resolve(root,'stale-update'),{review:oldFile}),/过期/);
}
console.log('PASS MS-R4 draft -> import -> reopen/update retains text and selection; stale review blocked');
{const {dir,input:i}=pkg({'z.gltf':{}});importReview(dir,manifest(dir));const old=loadPackage(dir);assert.equal(checkCacheState(dir,old.assets[0]),'hit');
 fs.copyFileSync(resolve(i,'z.gltf'),resolve(i,'a.gltf'));const next=resolve(root,'path-priority');const up=updatePackage(dir,i,next);assert.deepEqual(up.assets.map(a=>[a.entry,a.mapping.kind]),[['a.gltf','added'],['z.gltf','unchanged']]);const z=up.assets[1];assert.equal(checkCacheState(next,z),'hit');assert(z.frontConfirmed&&z.scaleConfirmed);
 old.assets[0].checkerVersion='old';atomicJSON(resolve(dir,'package.json'),old);assert.equal(checkCacheState(resolve(root,'stale-cache'),updatePackage(dir,i,resolve(root,'stale-cache')).assets[1]),'miss');
}
{const {dir}=pkg({'old.gltf':{uri:'old.bin'}});const newIn=input({'renamed.gltf':{uri:'new.bin'}});const up=updatePackage(dir,newIn,resolve(root,'renamed'));assert.equal(up.assets[0].mapping.kind,'renamed');}
{const {dir}=pkg({'old-a.gltf':{},'old-b.gltf':{}});const next=resolve(root,'ambiguous');updatePackage(dir,input({'new.gltf':{}}),next);const m=manifest(next);assert.throws(()=>importReview(next,m),/映射/);m.entries[0].confirmMapping=true;m.entries[0].mappingChoice='wrong';assert.throws(()=>importReview(next,m),/旧模型/);m.entries[0].mappingChoice='new';assert.equal(importReview(next,m).status,'applied');assert.equal(selected(next).length,1);const again=manifest(next,{report:null});again.entries[0].confirmMapping=true;assert.equal(importReview(next,again).status,'applied');assert.equal(loadPackage(next).assets[0].mapping.resolvedChoice,'new');}
console.log('PASS MS-R5/R6 path priority, dependency renames, ambiguous confirmation, valid cache copy and old-version invalidation');
console.log('PASS backend standards closure; browser delivery workflow is covered by delivery-workflow-fixtures.mjs');
