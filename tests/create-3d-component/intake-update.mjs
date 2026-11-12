import assert from 'node:assert/strict';
import {readFile,writeFile,cp,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {planIntake,validateIntake,applyIntake,baseline} from '../../tools/3d-component-studio/intake/core.mjs';
const out=resolve(process.argv[2]),repo=fileURLToPath(new URL('../../',import.meta.url)),target=join(out,'target'),candidate=join(out,'intake-host/component');
const args={candidate,target,category:'helper',names:['HostHighlight'],update:true};
const notes=join(target,'docs/components/intake-host/notes.md'),beforeNotes=await readFile(notes);
const params=join(candidate,'src/parameters.ts'),text=await readFile(params,'utf8');assert(text.includes('opacity:1'));await writeFile(params,text.replace('opacity:1','opacity:0.8'));
const plan=await planIntake(args),receipt=await validateIntake(plan,join(out,'update-validation'),{runtimeTest:join(repo,'tests/create-3d-component/intake-runtime.mjs')});await applyIntake(receipt,{developerConfirmed:true});
assert.deepEqual(await readFile(notes),beforeNotes);assert((await readFile(join(target,'docs/components/intake-host/index.html'),'utf8')).includes('<td>0.8</td>'));assert.deepEqual(await readFile(params),await readFile(join(target,'src/helper/intake-host/parameters.ts')));
const nav=await readFile(join(target,'docs/index.html'),'utf8');assert.equal(nav.split('<!-- intake:intake-host -->').length,2);
await assert.rejects(()=>planIntake({...args,category:'core'}),/重分类/);
const collision=join(out,'collision');await cp(candidate,collision,{recursive:true});const packagePath=join(collision,'package.json'),pkg=JSON.parse(await readFile(packagePath));pkg.component.id='colliding-host';await writeFile(packagePath,JSON.stringify(pkg));await assert.rejects(()=>planIntake({...args,candidate:collision,update:false}),/公开名称冲突/);
// Invalid source fails inside the independent copy without touching the target.
const bad=join(out,'bad-component');await cp(candidate,bad,{recursive:true});const badPackage=join(bad,'package.json'),bp=JSON.parse(await readFile(badPackage));bp.component.id='invalid-host';await writeFile(badPackage,JSON.stringify(bp));const index=join(bad,'src/index.ts');await writeFile(index,(await readFile(index,'utf8')).replaceAll('HostHighlight','InvalidHost')+'\nconst invalid: number = "broken";\n');
const badPlan=await planIntake({...args,candidate:bad,names:['InvalidHost'],update:false}),before=await baseline(target);await assert.rejects(()=>validateIntake(badPlan,join(out,'failed-validation'),{runtimeTest:join(repo,'tests/create-3d-component/intake-runtime.mjs')}),/验证失败/);assert.equal(await baseline(target),before);
await writeFile(join(out,'update-result.json'),JSON.stringify({status:'pass',checks:['actual default update','manual notes retained','source bytes preserved','single navigation entry','recategory rejected','export name collision rejected','invalid type fails validation without target writes']},null,2));console.log('PASS update and failed validation');
