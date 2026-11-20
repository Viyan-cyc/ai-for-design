import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { prepareProjectEnvironment } from '../../skills/generate-3d-scene/scripts/lib/project-environment.mjs';
const work=resolve(process.argv[2]),source=join(work,'map-fixture/source');
const skill=fileURLToPath(new URL('../../skills/generate-3d-scene/',import.meta.url));
const {heatCellCenter}=await import(pathToFileURL(resolve(process.argv[3])));
const file=join(source,'public/data/scene.json'),data=JSON.parse(readFileSync(file));
const initialPackage=JSON.parse(readFileSync(join(source,'package.json'))),initialLock=readFileSync(join(source,'package-lock.json'));
const options={origin:[121.49517,31.24194],cellSizeMeters:70};
const records=[];for(let y=-16;y<16;y++)for(let x=-16;x<17;x++){const [lng,lat]=heatCellCenter(x,y,options);records.push({lng,lat,value:[70,150,180,188,220][(x+16)%5]});}
data.map={runtime:'experience',styleUrl:'https://tiles.openfreemap.org/styles/liberty',origin:options.origin,zoom:15,pitch:45,theme:'light',heat:{options,data:[records[0],records[0]],tint:{}}};
writeFileSync(file,JSON.stringify(data));
function build(name){const start=Date.now();const p=spawnSync(process.execPath,[join(skill,'scripts/build-offline.mjs'),source],{encoding:'utf8',maxBuffer:16*1024*1024});writeFileSync(join(work,name+'.log'),(p.stdout??'')+(p.stderr??''));return {status:p.status,ms:Date.now()-start,output:(p.stdout??'')+(p.stderr??'')};}
const bad=build('duplicate');assert.notEqual(bad.status,0);assert.match(bad.output,/同单元重复/);assert.doesNotMatch(bad.output,/BUILD_COMPLETE:/);assert.equal(existsSync(join(source,'../index.3d.html')),false);
data.map.heat.data=records;writeFileSync(file,JSON.stringify(data));
const good=build('valid');assert.equal(good.status,0,good.output);assert.match(good.output,/checked=1/);assert.match(good.output,/RESULT: OK/);
const peer=join(work,'renamed/source');mkdirSync(peer,{recursive:true});
cpSync(join(source,'vendor'),join(peer,'vendor'),{recursive:true});
writeFileSync(join(peer,'package.json'),JSON.stringify({...initialPackage,name:'renamed-map'}));
const lock=JSON.parse(initialLock);lock.name='renamed-map';if(lock.packages?.[''])lock.packages[''].name='renamed-map';writeFileSync(join(peer,'package-lock.json'),JSON.stringify(lock));
const started=Date.now(),reuse=prepareProjectEnvironment(peer),original=prepareProjectEnvironment(source);
assert.equal(reuse.reused,true);assert.equal(reuse.modules,original.modules);
const result={duplicate:{status:bad.status,ms:bad.ms,blockedBeforeBundle:true},valid:{status:good.status,ms:good.ms,records:records.length},renamed:{reused:reuse.reused,ms:Date.now()-started,sameModules:reuse.modules===original.modules},boundary:'Node checks/build only; no browser, screenshots, visual acceptance'};
writeFileSync(join(work,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
