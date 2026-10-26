/** Targeted regressions for MR-R1..R8. Temp packages only; no production server. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {receive,loadPackage,atomicJSON,selected,checkCacheState} from '../lib/designer-assets.mjs';
import {generateIntakePage,importReview,packageIdentity} from '../lib/intake-page.mjs';
import {downloadCandidate} from '../lib/asset-service.mjs';
import {makeResolver} from '../lib/viewer/intake.js';
import {CHECKER_VERSION} from '../lib/viewer-version.mjs';
import {RULES_VERSION} from '../lib/model-policy.mjs';
import {triangleGlb,pixelPNG} from './asset-fixture-data.mjs';
import {openBrowserSession} from '../lib/cdp.mjs';
const root=fs.mkdtempSync(resolve(tmpdir(),'intake-review-fixed-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const run=(...args)=>spawnSync(process.execPath,['scripts/designer-assets.mjs',...args],{encoding:'utf8'});
function build(name){const input=resolve(root,name+'-in'),dir=resolve(root,name);fs.mkdirSync(input);for(const f of ['a.glb','b.glb'])fs.writeFileSync(resolve(input,f),triangleGlb());receive(input,dir,'original');return dir;}
function manifest(dir){const p=loadPackage(dir);return {kind:'model-intake',schemaVersion:2,purpose:'confirm',submissionId:crypto.randomUUID(),...packageIdentity(p),mode:'upload',baseRevision:p.revision,checkerVersion:CHECKER_VERSION,rulesVersion:RULES_VERSION,packageDescription:'公司机房模型',confirmSelection:true,allowPartial:false,entries:p.assets.map(a=>({assetId:a.id,contentHash:a.contentHash,name:'新名称 '+a.number,description:'用途 '+a.number,selected:true,confirmFront:true,confirmScale:true,result:{ok:true,image:pixelPNG.toString('base64'),bbox:{min:[-.5,0,-.5],max:[.5,1,.5]},meshes:1,triangles:1,instanced:false,skinned:false}}))};}
const dir=build('contract'),original=manifest(dir);
for(const change of [m=>m.packageId='wrong',m=>m.packageDigest='wrong',m=>m.checkerVersion='old',m=>m.entries[1]=structuredClone(m.entries[0]),m=>m.entries[0].result.bbox.min=[5,5,5],m=>m.entries[0].result.meshes=-1,m=>m.entries[0].selected=false,m=>m.entries.forEach(e=>{e.selected=false;e.result={ok:false,error:'failed'}})]) {
 const m=structuredClone(original);change(m);assert.throws(()=>importReview(dir,m));assert.equal(loadPackage(dir).revision,1);
}
assert.equal(importReview(dir,original).status,'applied');assert.equal(loadPackage(dir).description,'公司机房模型');
assert.equal(importReview(dir,original).status,'duplicate');
const changedId=structuredClone(original);changedId.packageDescription='different';assert.throws(()=>importReview(dir,changedId),/提交编号/);
const stale=structuredClone(original);stale.submissionId='new-old';assert.throws(()=>importReview(dir,stale),/revision/);
const selection=manifest(dir);selection.entries.forEach(e=>e.result=null);selection.entries[1].selected=false;selection.allowPartial=true;
const beforeRevision=loadPackage(dir).revision;importReview(dir,selection);assert.equal(loadPackage(dir).revision,beforeRevision+1);assert.equal(selected(dir).length,1);
const duplicate=importReview(dir,original);assert.equal(duplicate.counts.selected,1,'duplicate returns current selection');
console.log('PASS identity, versions, whole-payload idempotency, final-state validation and selection revision');
// Failure injection verifies old JSON/pictures survive a failed atomic commit.
const before=fs.readFileSync(resolve(dir,'package.json'));const photos=loadPackage(dir).assets.map(a=>[a.thumbnail,fs.readFileSync(resolve(dir,a.thumbnail))]);
const rename=fs.renameSync;fs.renameSync=(from,to)=>{if(to===resolve(dir,'package.json'))throw new Error('injected commit failure');return rename(from,to);};syncBuiltinESMExports();
try{assert.throws(()=>importReview(dir,manifest(dir)),/injected/);}finally{fs.renameSync=rename;syncBuiltinESMExports();}
assert.deepEqual(fs.readFileSync(resolve(dir,'package.json')),before);for(const [path,bytes] of photos)assert.deepEqual(fs.readFileSync(resolve(dir,path)),bytes);
const badSecond=manifest(dir);badSecond.entries[1].result.image='invalid';assert.throws(()=>importReview(dir,badSecond));assert.deepEqual(fs.readFileSync(resolve(dir,'package.json')),before);
console.log('PASS failed batch/commit preserves prior package and referenced pictures');
const resolver=makeResolver({}, {files:{'red/base.png':'RED','blue/base.png':'BLUE','中文/a b.bin':'BIN'}},'blob:null/entry');
assert.equal(resolver('https://gts3d.invalid/red/base.png'),'RED');assert.equal(resolver('https://gts3d.invalid/blue/base.png'),'BLUE');assert.equal(resolver('https://gts3d.invalid/%E4%B8%AD%E6%96%87/a%20b.bin'),'BIN');assert.equal(resolver('https://outside/base.png'),null);
console.log('PASS exact nested/encoded dependency resolution, no basename guessing');
// Real browser download to disk; early editing under deliberately delayed model fetch.
// Force short deadlines only inside this test browser; late loads cannot start rendering.
const timeoutDir=build('timeout'),timeoutPage=generateIntakePage(timeoutDir);
const tb=await openBrowserSession({url:'file:///'+timeoutPage.page.replaceAll('\\','/'),deadlineMs:20000,onEvents:[p=>p.rpc('Page.addScriptToEvaluateOnNewDocument',{source:`window.fastTimeout=true;window.webglCount=0;const st=setTimeout;window.setTimeout=(fn,ms,...args)=>st(fn,window.fastTimeout&&ms===20000?20:ms,...args);const f=fetch;window.fetch=(...args)=>String(args[0]).startsWith('data:model/')?new Promise(r=>st(r,100)).then(()=>f(...args)):f(...args);const gc=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type.startsWith('webgl'))window.webglCount++;return gc.call(this,type,...args);};`})]});
try{
 for(let i=0;i<100;i++){if(await tb.evaluate(`document.querySelectorAll('.badge.bad').length===2`).catch(()=>false))break;await sleep(100);}
 assert.equal(await tb.evaluate(`document.querySelectorAll('.badge.bad').length`),2);
 await sleep(300);assert.equal(await tb.evaluate('window.webglCount'),0);
 await tb.evaluate(`window.fastTimeout=false;document.querySelector('[data-retry]').click();true`);
 for(let i=0;i<100;i++){if(await tb.evaluate(`document.querySelectorAll('.badge.bad').length===1&&!document.querySelector('[data-retry]').disabled`))break;await sleep(100);}
 assert.equal(await tb.evaluate(`document.querySelectorAll('.badge.bad').length`),1,'retry affects only the chosen model');
 await tb.evaluate(`document.querySelector('[data-retry]').click();true`);
 for(let i=0;i<100;i++){if(await tb.evaluate(`[...document.querySelectorAll('.badge')].length===2 && [...document.querySelectorAll('.badge')].every(b=>['通过','待确认'].includes(b.textContent))`))break;await sleep(100);}
 assert.equal(await tb.evaluate(`[...document.querySelectorAll('.badge')].filter(b=>['通过','待确认'].includes(b.textContent)).length`),2);
 console.log('PASS timeout cancellation blocks late renderer creation; explicit retry recovers');
}finally{await tb.close();}
// Library path: actual mock HTTP download, formal CLI preview/import-check/accept/inject.
const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'model/gltf-binary'});res.end(triangleGlb());});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,remote=resolve(root,'remote');
fs.writeFileSync(resolve(root,'config.json'),JSON.stringify({endpoint:origin+'/search',allowedOrigins:[origin]}));
fs.writeFileSync(resolve(root,'candidate.json'),JSON.stringify({origin:'remote',remoteId:'rack',name:'机柜',entryUrl:origin+'/rack.glb'}));
// Pass mock settings directly to the library; the designer CLI uses built-in intranet settings.
try{await downloadCandidate(JSON.parse(fs.readFileSync(resolve(root,'candidate.json'),'utf8')),remote,{endpoint:origin+'/search',allowedOrigins:[origin]});}finally{await new Promise(r=>server.close(r));}
const rp=JSON.parse(run('preview',remote).stdout);const rd=resolve(root,'remote-download');fs.mkdirSync(rd);
const rb=await openBrowserSession({url:'file:///'+rp.page.replaceAll('\\','/'),deadlineMs:20000,onEvents:[p=>p.rpc('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:rd})]});
try {
 for(let i=0;i<100;i++){if(await rb.evaluate(`document.getElementById('save')&&!document.getElementById('save').disabled`))break;await sleep(100);}
 await rb.evaluate(`while(document.body.dataset.step!=='2')document.getElementById('next').click();document.getElementById('save').click();true`);
 const file=resolve(rd,'models.3d.json');for(let i=0;i<100&&!fs.existsSync(file);i++)await sleep(100);assert(fs.existsSync(file));
 assert.notEqual(run('import-review',remote,'--file',file).status,0);
 const checked=run('import-check',remote,'--file',file);assert.equal(checked.status,0,checked.stderr);assert.equal(loadPackage(remote).confirmation,null);
 assert.equal(run('accept-remote',remote).status,0);const project=resolve(root,'remote-project');fs.mkdirSync(project);const injected=run('inject',remote,'--project',project);assert.equal(injected.status,0,injected.stderr);assert.equal(JSON.parse(injected.stdout).assets.length,1);
 console.log('PASS remote download -> static browser result file -> import-check -> accept-remote -> inject');
}finally{await rb.close();}
console.log('FIXTURE: '+root);

