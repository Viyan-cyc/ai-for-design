import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {planIntake,validateIntake,applyIntake,hash,baseline} from '../../tools/3d-component-studio/intake/core.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url)),out=resolve(process.env.COMPONENT_TEST_OUTPUT||join(repo,'docs/create-3d-component/native-work/intake-'+Date.now()));
const original='D:/cyc/project/octo/test/3d-components',originalBaseline=await baseline(original);await mkdir(out,{recursive:true});const target=join(out,'target');await mkdir(target);
for(const e of await readdir(original,{withFileTypes:true})){if(['.git','dist'].includes(e.name))continue;await cp(join(original,e.name),join(target,e.name),{recursive:true,dereference:true});}
const checks=[],runtimeTest=join(repo,'tests/create-3d-component/intake-runtime.mjs');
for(const [profile,id,category,name] of [['native-object','intake-object','core','AuthoredComponent'],['native-host','intake-host','helper','HostHighlight']]){
 const project=join(out,id);const r=spawnSync(process.execPath,[join(repo,'skills/create-3d-component/scripts/init.mjs'),'--profile',profile,'--project-dir',project,id],{encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);
 const candidate=join(project,'component'),args={candidate,target,category,names:[name]};
 const plan=await planIntake(args);await writeFile(join(out,id+'-plan.json'),JSON.stringify(plan,null,2));
 assert.equal(plan.status,'planned');const entry=join(target,'src',category,'index.ts'),before=await readFile(entry);
 const candidateEntry=join(candidate,'src/index.ts'),src=await readFile(candidateEntry);await writeFile(candidateEntry,Buffer.concat([src,Buffer.from('\n')]));await assert.rejects(()=>validateIntake(plan,join(out,id+'-stale'),{runtimeTest}),/候选已变化/);await writeFile(candidateEntry,src);
 const receipt=await validateIntake(plan,join(out,id+'-validation'),{runtimeTest});
 await assert.rejects(()=>applyIntake(receipt),/显式开发确认/);
 await writeFile(entry,Buffer.concat([before,Buffer.from('\n// concurrent\n')]));await assert.rejects(()=>applyIntake(receipt,{developerConfirmed:true}),/目标已变化/);await writeFile(entry,before);
 const preRollback=await baseline(target);
 await assert.rejects(()=>applyIntake(receipt,{developerConfirmed:true,onWrite:(_f,n)=>{if(n===3)throw Error('injected write failure');}}),/injected/);assert.deepEqual(await readFile(entry),before);assert.equal(await baseline(target),preRollback);
 const concurrent=Buffer.concat([before,Buffer.from('\n// edit during apply\n')]);
 await assert.rejects(()=>applyIntake(receipt,{developerConfirmed:true,onWrite:async(_f,n)=>{if(n===1)await writeFile(entry,concurrent);}}),/并发修改/);assert.deepEqual(await readFile(entry),concurrent);await writeFile(entry,before);assert.equal(await baseline(target),preRollback);
 await applyIntake(receipt,{developerConfirmed:true});
 for(const f of ['index.ts','parameters.ts'])assert.deepEqual(await readFile(join(target,'src',category,id,f)),await readFile(join(candidate,'src',f)));
 const catalog=JSON.parse(await readFile(join(target,'docs/components.json')));assert(JSON.stringify(catalog).includes(name));
 await assert.rejects(()=>planIntake(args),/已登记/);
 const notes=join(target,'docs/components',id,'notes.md');await writeFile(notes,'人工内容保持\n');
 const repeat=await planIntake({...args,update:true});assert.equal(repeat.status,'planned');assert.equal(await readFile(notes,'utf8'),'人工内容保持\n');
 // Owned changes are conflicts, unlike manual notes.
 const owned=join(target,'src',category,id,'index.ts'),old=await readFile(owned);await writeFile(owned,'// hand edit\n');await assert.rejects(()=>planIntake({...args,update:true}),/生成文件已被修改/);await writeFile(owned,old);
 checks.push({profile,status:'pass',sourceHash:hash(src),validation:receipt.validationWork});
}
assert.equal(await baseline(original),originalBaseline);
await writeFile(join(out,'result.json'),JSON.stringify({status:'pass',checks,target,productionApply:false,productionBaselineUnchanged:originalBaseline},null,2));console.log('PASS M3 '+out);
