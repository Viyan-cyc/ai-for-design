import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {planIntake,validateDemoTypes} from '../../tools/3d-component-studio/intake/core.mjs';
const out=resolve(process.env.COMPONENT_TEST_OUTPUT||'docs/create-3d-component/native-work/library-demo');
const {results}=JSON.parse(await readFile(join(out,'result.json')));
for(const item of results){await validateDemoTypes(item.library,join(item.library,'docs/components',item.id,'demo.ts'),join(out,item.id+'-validation'));}
const item=results[0],bad=join(item.library,'docs/components',item.id,'invalid-demo-test.ts');
try{await writeFile(bad,'export function initDemo(canvas: HTMLCanvasElement,ctrl:HTMLElement) {}',{flag:'wx'});
 await assert.rejects(validateDemoTypes(item.library,bad,out),/释放函数/);
}finally{await unlink(bad);}
const project=join(out,item.id),demo=join(project,'example/library-demo.ts'),original=await readFile(demo);
try{await writeFile(demo,"import {AuthoredComponent} from '@component'; import '../component/src/index';");
 await assert.rejects(planIntake({candidate:join(project,'component'),target:'D:/cyc/project/octo/test/3d-components',category:'core',names:['AuthoredComponent'],demo}),/只允许/);
}finally{await writeFile(demo,original);}
await writeFile(join(out,'contract-result.json'),JSON.stringify({status:'PASS',finalTypes:true,missingDisposerRejected:true,candidateBypassRejected:true},null,2));console.log('PASS demo contract guards');
