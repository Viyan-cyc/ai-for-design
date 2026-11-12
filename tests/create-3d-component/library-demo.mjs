import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {planIntake,validateIntake,baseline} from '../../tools/3d-component-studio/intake/core.mjs';
const out=resolve(process.env.COMPONENT_TEST_OUTPUT||'docs/create-3d-component/native-work/library-demo');await mkdir(out,{recursive:true});
const library='D:/cyc/project/octo/test/3d-components',before=await baseline(library),results=[];
for(const [profile,id,category,name] of [['native-object','interactive-object','core','AuthoredComponent'],['native-host','interactive-host','helper','HostHighlight']]){
 const project=join(out,id),init=spawnSync(process.execPath,['skills/create-3d-component/scripts/init.mjs','--profile',profile,'--project-dir',project,id],{encoding:'utf8'});assert.equal(init.status,0,init.stderr);
 const demo=join(project,'example/library-demo.ts'),candidate=join(project,'component');
 const plan=await planIntake({candidate,target:library,category,names:[name],demo});
 assert.ok(plan.operations[plan.doc+'/demo.ts']);assert.ok(Buffer.from(plan.operations[plan.doc+'/demo.ts'],'base64').toString().includes('../../../src/'+category+'/index'));
 const original=await readFile(demo);await writeFile(demo,Buffer.concat([original,Buffer.from('\n// changed')]));
 await assert.rejects(validateIntake(plan,join(out,id+'-reject'),{runtimeTest:resolve('tests/create-3d-component/intake-runtime.mjs')}),/Demo已变化/);await writeFile(demo,original);
 const receipt=await validateIntake(plan,join(out,id+'-validation'),{runtimeTest:resolve('tests/create-3d-component/intake-runtime.mjs')});
 results.push({id,library:join(receipt.validationWork,'library'),demo:receipt.demo});
}
assert.equal(await baseline(library),before);await writeFile(join(out,'result.json'),JSON.stringify({status:'PASS',results},null,2));console.log('PASS '+out);
