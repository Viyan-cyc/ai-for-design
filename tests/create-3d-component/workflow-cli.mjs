import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {commands,runSteps} from '../../tools/3d-component-studio/workflow.mjs';
const c={project:'project with spaces',candidate:'candidate',library:'library',generator:'generator',category:'core',exports:['Example'],runtimeTest:'test.mjs',intakePlan:'plan.json',intakeWork:'validation',syncWork:'sync'};
const base=resolve('workflow-test');
const exp=commands('export',c,base);
assert.equal(exp.length,2);assert.equal(exp[0][0],resolve(base,c.project,'example/build.mjs'));assert.equal(exp[1][1],'--export-component');
const p=commands('prepare-intake',c,base);assert.equal(p.length,2);assert.equal(p[0][1],'plan');assert.equal(p[1][1],'validate');assert.ok(p[1].includes(resolve(base,c.runtimeTest)));
for(const action of ['apply-intake','apply-sync'])assert.throws(()=>commands(action,c,base),/confirmed/);
assert.ok(commands('apply-intake',c,base,{confirmed:true})[0].includes('--developer-confirmed'));
assert.ok(commands('apply-sync',c,base,{confirmed:true})[0].includes('--confirmed'));
assert.ok(!commands('prepare-sync',c,base)[0].includes('--adopt-generated'));
assert.ok(commands('prepare-sync',c,base,{adopt:true})[0].includes('--adopt-generated'));
assert.throws(()=>commands('prepare-intake',{...c,exports:[]},base));
assert.throws(()=>commands('bad',c,base));
let count=0;assert.throws(()=>runSteps(p,()=>{count++;return {status:1};}),/后续未执行/);assert.equal(count,1);
count=0;runSteps(p,()=>{count++;return {status:0};});assert.equal(count,2);
const cli=fileURLToPath(new URL('../../tools/3d-component-studio/workflow.mjs',import.meta.url));
for(const args of [['build','absent.json','--confirmed'],['build','absent.json','--bad'],['export','absent.json','--adopt-generated']]){
 const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});assert.equal(r.status,1);assert.ok(!r.stderr.includes('ENOENT'));
}
const help=spawnSync(process.execPath,[cli,'--help'],{encoding:'utf8'});assert.equal(help.status,0);assert.match(help.stdout,/prepare-intake/);
console.log('PASS workflow command mapping, confirmation, strict flags, path handling and stop-on-failure; no target apply performed');
