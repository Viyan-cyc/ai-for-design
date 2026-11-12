import assert from 'node:assert/strict';
import {cp,mkdir,readFile,writeFile,unlink,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {planIntake,validateIntake,applyIntake,baseline,hash} from '../../tools/3d-component-studio/intake/core.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const seed=resolve(process.argv[2]),out=resolve(process.argv[3]);
await mkdir(out);const target=join(out,'target'),candidate=join(out,'component');
await cp(join(seed,'target'),target,{recursive:true,dereference:true});
await cp(join(seed,'intake-host/component'),candidate,{recursive:true});
const production=await baseline('D:/cyc/project/octo/test/3d-components');
const args={candidate,target,category:'helper',names:['HostHighlight'],update:true};
const registryPath=join(target,'docs/intake/intake-host.json'),registryBytes=await readFile(registryPath);
const extra=join(target,'src/helper/intake-host/extra.ts');
await writeFile(join(candidate,'src/extra.ts'),'export const incomingValue = "candidate";\n');
const legitimatePlan=await planIntake(args);
const cases=[];
async function rejected(label,path){
  const before=await baseline(target);
  await assert.rejects(()=>planIntake(args),e=>e.message.includes('未登记的既存文件冲突')&&e.message.includes(path));
  assert.equal(await baseline(target),before);cases.push({label,path,targetUnchanged:true});
}
await writeFile(extra,'export const manualValue = "maintainer-only";\n');
await rejected('reviewer source collision','src/helper/intake-host/extra.ts');
// Model an older planner that accepted an unowned file into its current baseline.
// Validation must still reject ownership before creating a work directory.
const legacyPlan={...legitimatePlan,baseline:await baseline(target)};
await assert.rejects(()=>validateIntake(legacyPlan,join(out,'must-not-create'),{runtimeTest:join(repo,'tests/create-3d-component/intake-runtime.mjs')}),/未登记的既存文件冲突/);
await assert.rejects(()=>access(join(out,'must-not-create')));
await writeFile(extra,await readFile(join(candidate,'src/extra.ts')));
await rejected('same bytes do not grant ownership','src/helper/intake-host/extra.ts');await unlink(extra);
// Fixtures represent pre-existing manual files not owned by an earlier intake.
// Test both plan-time files and HTML whose bytes are only generated in validate.
for(const name of ['component-package.json','preset.json','index.html']){
  const rel='docs/components/intake-host/'+name,p=join(target,rel),original=await readFile(p);
  const registry=JSON.parse(registryBytes);delete registry.owned[rel];
  await writeFile(registryPath,JSON.stringify(registry));await writeFile(p,'maintainer-only '+name+'\n');
  await rejected('unowned generated document',rel);
  await writeFile(p,original);await writeFile(registryPath,registryBytes);
}
const before=await baseline(target),notes=await readFile(join(target,'docs/components/intake-host/notes.md'));
const plan=await planIntake(args);await writeFile(join(out,'plan.json'),JSON.stringify(plan,null,2));
const receipt=await validateIntake(plan,join(out,'validation'),{runtimeTest:join(repo,'tests/create-3d-component/intake-runtime.mjs')});
await assert.rejects(()=>applyIntake(receipt,{developerConfirmed:true,onWrite:()=>{throw Error('injected ownership regression rollback');}}),/injected/);
assert.equal(await baseline(target),before);await assert.rejects(()=>access(extra));
await applyIntake(receipt,{developerConfirmed:true});
assert.deepEqual(await readFile(extra),await readFile(join(candidate,'src/extra.ts')));
const registered=JSON.parse(await readFile(registryPath));assert.equal(registered.owned['src/helper/intake-host/extra.ts'],hash(await readFile(extra)));
assert.deepEqual(await readFile(join(target,'docs/components/intake-host/notes.md')),notes);
assert.equal((await planIntake(args)).status,'planned');
assert.equal(await baseline('D:/cyc/project/octo/test/3d-components'),production);
await writeFile(join(out,'result.json'),JSON.stringify({status:'pass',cases,legacyPlanRejected:true,legalNewSourceBuiltAndApplied:true,rollbackBaselinePreserved:true,normalUpdatePlanAccepted:true,notesPreserved:true,productionBaselineUnchanged:true},null,2));
console.log('PASS RN17-1 ownership conflicts, legitimate additions and rollback: '+out);
