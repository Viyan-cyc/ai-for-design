import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {searchRemote,downloadCandidate} from '../../skills/generate-3d-scene/scripts/lib/asset-service.mjs';
import {summarizeCandidate,remoteExitCode} from '../../skills/generate-3d-scene/scripts/search-assets.mjs';
let body,requests=0;
const server=createServer((req,res)=>{requests++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`,cfg={endpoint:origin,allowedOrigins:[origin]};
const asset={id:1,name:'rack',file_path:origin+'/rack.glb',file_type:'glb',description:'long description',raw_data:{bbox:{min:[0,0,0],max:[1,2,3]},units:'m',triangles:12}};
try{
 body={results:[[asset],[],{status:'error',files:[]}]};
 const result=await searchRemote(['rack','empty','failed'],cfg);
 assert.equal(requests,1);assert.equal(result.status,'partial');assert.equal(remoteExitCode(result),2);
 assert.deepEqual(result.results.map(r=>r.status),['ok','empty','error']);
 const brief=summarizeCandidate(result.results[0].assets[0]);
 assert.deepEqual(brief.size,[1,2,3]);assert.equal(brief.triangles,12);assert.equal(brief.entryUrl,asset.file_path);
 assert.equal(brief.origin,'remote');assert.equal(brief.remoteId,1);assert.ok(!('description' in brief));
 assert.equal(brief.category,'unknown');assert.equal(brief.compatibility,'unknown');
 body={results:[[]]};assert.equal(remoteExitCode(await searchRemote(['x'],cfg)),3);
 body={results:[[asset]]};assert.equal(remoteExitCode(await searchRemote(['x'],cfg)),0);
 body={results:[{error:'failed'}]};assert.equal(remoteExitCode(await searchRemote(['x'],cfg)),2);
 body={results:[null]};assert.equal((await searchRemote(['x'],cfg)).results[0].status,'error');
}finally{await new Promise(r=>server.close(r));}
// Real CLI via fetch stub: validates formatting and exit code without contacting intranet.
const root=mkdtempSync(join(tmpdir(),'search-contract-'));
const preload=join(root,'fetch.mjs');
writeFileSync(preload,`globalThis.fetch=async()=>{if(process.env.SEARCH_THROW)throw Error('unavailable');return new Response(process.env.SEARCH_BODY,{status:200})};`);
const batch=join(root,'queries.txt');writeFileSync(batch,'rack\nempty\nfailed');
const cli=resolve('skills/generate-3d-scene/scripts/search-assets.mjs');
const run=(response,args=[],extra={})=>spawnSync(process.execPath,['--import',pathToFileURL(preload).href,cli,...args],{encoding:'utf8',env:{...process.env,SEARCH_BODY:JSON.stringify(response),...extra}});
let r=run({results:[[asset],[],{error:true}]},['--batch',batch,'--brief','--json']);
assert.equal(r.status,2);const value=JSON.parse(r.stdout);assert.equal(value.results[0].assets[0].entryUrl,asset.file_path);assert.ok(!('description' in value.results[0].assets[0]));
r=run({results:[[asset]]},['rack']);assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).results[0].assets[0].description,'long description');
r=run({results:[[]]},['rack','--brief']);assert.equal(r.status,3);
r=run({},['rack'],{SEARCH_THROW:'1'});assert.equal(r.status,2);assert.match(r.stderr,/FAIL/);
assert.equal(summarizeCandidate({id:'unknown'}).size,null);
console.log('PASS remote ok/empty/error/partial, one batch request, compact download identity, full output and CLI exit codes');

const designer=resolve('skills/generate-3d-scene/scripts/designer-assets.mjs');
const queries=join(root,'queries.json');writeFileSync(queries,JSON.stringify(['rack','empty','failed']));
const runDesigner=(response,args=['search','rack'],extra={})=>spawnSync(process.execPath,['--import',pathToFileURL(preload).href,designer,...args],{encoding:'utf8',env:{...process.env,SEARCH_BODY:JSON.stringify(response),...extra}});
for(const [groups,exit,ok] of [[[asset],0,true],[[],3,true],[{error:true},2,false],[null,2,false]]) {
 const result=runDesigner({results:[groups]});
 assert.equal(result.status,exit,result.stderr);assert.equal(JSON.parse(result.stdout).ok,ok);
}
r=runDesigner({results:[[asset],[],{error:true}]},['search','--queries',queries]);
assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).ok,false);assert.equal(JSON.parse(r.stdout).results[0].assets.length,1);
r=runDesigner({},['search','rack'],{SEARCH_THROW:'1'});assert.equal(r.status,2);assert.equal(JSON.parse(r.stderr).ok,false);
r=runDesigner({},['unsupported']);assert.equal(r.status,1,'other command error code unchanged');
console.log('PASS designer search ok/empty/error/malformed/partial/transport and other-command compatibility');

// A compact candidate really downloads a glTF plus external buffer, not just matching fields.
const model={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri:'mesh.bin',byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}]};
const binary=Buffer.from(new Float32Array([0,0,0,1,0,0,0,1,0]).buffer);
const downloads=[];
const models=createServer((req,res)=>{downloads.push(req.url);if(req.url==='/model.gltf'){res.end(JSON.stringify(model));}else if(req.url==='/mesh.bin'){res.end(binary);}else {res.statusCode=404;res.end();}});
await new Promise(r=>models.listen(0,'127.0.0.1',r));
try {
 const base=`http://127.0.0.1:${models.address().port}`;
 const compact=summarizeCandidate({id:'remote_model',name:'fixture',origin:'remote',remoteId:7,entryUrl:base+'/model.gltf',libraryMetadata:{units:'m'}});
 const folder=join(root,'downloaded');
 const pkg=await downloadCandidate(compact,folder,{endpoint:base,allowedOrigins:[base]});
 assert.equal(pkg.assets.length,1);assert.equal(pkg.assets[0].remoteId,7);assert.equal(pkg.assets[0].name,'fixture');
 assert.deepEqual(pkg.assets[0].libraryMetadata,{units:'m'});
 const entry=join(folder,'files',pkg.assets[0].entry);assert.ok(existsSync(entry));
 const gltf=JSON.parse(readFileSync(entry,'utf8'));
 const local=resolve(entry,'..',gltf.buffers[0].uri);
 assert.deepEqual(readFileSync(local),binary);
 assert.deepEqual(downloads,['/model.gltf','/mesh.bin']);
} finally {await new Promise(r=>models.close(r));}
console.log('PASS compact candidate -> actual model/dependency download and metadata preservation');
