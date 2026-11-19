import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installDependencies, retargetLock, registries } from '../../skills/generate-3d-scene/scripts/lib/npm-install.mjs';
const template=JSON.parse(readFileSync(new URL('../../skills/generate-3d-scene/template/package-lock.json',import.meta.url)));
function fixture(fn){const cwd=mkdtempSync(join(tmpdir(),'scene-registry-'));try{fn(cwd,join(cwd,'package-lock.json'));}finally{rmSync(cwd,{recursive:true,force:true});}}
test('all locked fields preserved across configured mirrors',()=>{for(const registry of registries){const migrated=retargetLock(template,registry);for(const [id,pkg] of Object.entries(template.packages)){const a={...pkg},b={...migrated.packages[id]};delete a.resolved;delete b.resolved;assert.deepEqual(a,b);if(pkg.resolved)assert.ok(migrated.packages[id].resolved.startsWith(registry+'/'));}}});
test('network failures switch sources and retain ci',()=>fixture((cwd,p)=>{writeFileSync(p,JSON.stringify(template));let calls=0;installDependencies({node:'node',npm:'npm',cwd,preferred:'https://ignored.test',run:(_,args)=>{assert.ok(args.includes('ci'));assert.equal(args[args.indexOf('--registry')+1],registries[calls]);calls++;return calls<3?{status:1,stderr:'npm error code ENOTFOUND\n'}:{status:0};}});assert.equal(calls,3);}));
for(const code of ['EPERM','EUSAGE','EINTEGRITY','ERESOLVE'])test(code+' stops immediately and restores original',()=>fixture((cwd,p)=>{const original=JSON.stringify(template);writeFileSync(p,original);let calls=0;assert.throws(()=>installDependencies({node:'node',npm:'npm',cwd,run:()=>{calls++;return {status:1,stderr:'npm error code '+code+'\n'};}}));assert.equal(calls,1);assert.equal(readFileSync(p,'utf8'),original);}));
test('retry migrates newly generated lock',()=>fixture((cwd,p)=>{let calls=0;installDependencies({node:'node',npm:'npm',cwd,args:['install'],run:()=>{if(++calls===1){writeFileSync(p,JSON.stringify(template));return {status:1,stderr:'npm error code ECONNRESET\n'};}assert.ok(JSON.parse(readFileSync(p)).packages['node_modules/three'].resolved.startsWith(registries[1]));return {status:0};}});assert.equal(calls,2);}));
test('local and unrelated archives unchanged',()=>{const lock={packages:{local:{resolved:'file:local.tgz'},remote:{resolved:'https://assets.example.test/a.tgz'}}};assert.deepEqual(retargetLock(lock,registries[0]),lock);});
import { retryable } from '../../skills/generate-3d-scene/scripts/lib/npm-install.mjs';

const peerConflict = 'npm error code ERESOLVE\nnpm error ERESOLVE unable to resolve dependency tree\nnpm error Found: react@19.0.0\nnpm error Could not resolve dependency:\nnpm error peer react@"^18.0.0" from example@1.0.0';
const failedFetch = 'npm http fetch GET https://mirror/unrelated attempt 1 failed with ECONNRESET\n';
for (const network of ['', failedFetch]) test('explicit peer conflict stops and restores lock '+(network ? 'with prior fetch failure' : 'without network failure'),()=>fixture((cwd,p)=>{
 const original=JSON.stringify(template);writeFileSync(p,original);let calls=0;
 assert.throws(()=>installDependencies({node:'node',npm:'npm',cwd,run:()=>{calls++;return {status:1,stderr:network+peerConflict};}}),/依赖安装失败/);
 assert.equal(calls,1);assert.equal(readFileSync(p,'utf8'),original);
}));
test('failed metadata with unresolved version still switches source',()=>fixture((cwd,p)=>{
 writeFileSync(p,JSON.stringify(template));let calls=0;
 const unresolved=peerConflict.replace('Found: react@19.0.0','Found: react@undefined');
 const selected=installDependencies({node:'node',npm:'npm',cwd,run:()=>++calls===1?{status:1,stderr:failedFetch+unresolved}:{status:0}});
 assert.equal(calls,2);assert.equal(selected,registries[1]);
}));
test('npm metadata network errors surfaced as ERESOLVE still switch sources',()=>{assert.equal(retryable({status:1,stderr:'npm http fetch GET http://mirror/package attempt 1 failed with ENOTFOUND\nnpm error code ERESOLVE'}),true);});
for (const code of ['EPERM','EACCES','EUSAGE','EINTEGRITY']) test('mixed network and '+code+' remains fatal',()=>fixture((cwd,p)=>{
 const original=JSON.stringify(template);writeFileSync(p,original);let calls=0;
 assert.throws(()=>installDependencies({node:'node',npm:'npm',cwd,run:()=>{calls++;return {status:1,stderr:'npm http fetch GET http://mirror/npm attempt 1 failed with ENOTFOUND\nnpm error code '+code};}}));
 assert.equal(calls,1);assert.equal(readFileSync(p,'utf8'),original);
}));
test('lifecycle failures remain fatal with network errors or process timeout',()=>{assert.equal(retryable({status:1,error:{code:'ETIMEDOUT'},stderr:'npm http fetch GET http://mirror/npm attempt 1 failed with ENOTFOUND\nnpm error command failed'}),false);});
test('reachable source can finish beyond old per-source quota after network fallback',()=>fixture((cwd,p)=>{
 writeFileSync(p,JSON.stringify(template));let time=0,calls=0;
 const chosen=installDependencies({node:'node',npm:'npm',cwd,now:()=>time,run:(_,args,options)=>{
   assert.equal(args[args.indexOf('--registry')+1],registries[calls]);assert.equal(options.timeout,300000-time);
   if(calls++===0){time+=3000;return {status:1,stderr:'npm error code ENOTFOUND'};}
   time+=180000;
   assert.ok(time<300000);assert.ok(JSON.parse(readFileSync(p)).packages['node_modules/three'].resolved.startsWith(registries[1]));return {status:0};
 }});assert.equal(chosen,registries[1]);assert.equal(calls,2);
}));
test('global timeout stops without switching source and restores original lock',()=>fixture((cwd,p)=>{
 const original=JSON.stringify(template);writeFileSync(p,original);let time=0,calls=0;
 assert.throws(()=>installDependencies({node:'node',npm:'npm',cwd,now:()=>time,run:(_,args,options)=>{calls++;time+=options.timeout;return {status:null,error:{code:'ETIMEDOUT'},stdout:'npm http fetch GET 200 https://registry.npmjs.org/three'};}}),/安装超时.*不代表源不可用/);
 assert.equal(calls,1);assert.equal(time,300000);assert.equal(readFileSync(p,'utf8'),original);
}));
test('non-timeout process errors do not switch sources',()=>{assert.equal(retryable({error:{code:'ENOENT'}}),false);});
test('failed download with generic npm error advances to next registry',()=>fixture((cwd,p)=>{
 writeFileSync(p,JSON.stringify(template));let calls=0;
 const chosen=installDependencies({node:'node',npm:'npm',cwd,run:(_,args)=>{
   assert.equal(args[args.indexOf('--registry')+1],registries[calls]);
   if(calls++===0)return {status:1,stderr:'npm http fetch GET http://mirror/three.tgz attempt 1 failed with ENOTFOUND\nnpm error Exit handler never called!'};
   assert.ok(JSON.parse(readFileSync(p)).packages['node_modules/three'].resolved.startsWith(registries[1]));
   return {status:0};
 }});assert.equal(calls,2);assert.equal(chosen,registries[1]);
}));
test('generic npm failure needs actual fetch evidence and never overrides fatal errors',()=>{
 const network='npm http fetch GET http://mirror/three.tgz attempt 1 failed with ECONNRESET\n';
 assert.equal(retryable({status:1,stderr:'npm error Exit handler never called!'}),false);
 assert.equal(retryable({status:1,stdout:network,stderr:'npm error unexpected failure'}),true);
 assert.equal(retryable({status:1,error:{code:'ENOENT'},stderr:network}),false);
 assert.equal(retryable({status:1,stderr:network+'npm error command failed'}),false);
});
