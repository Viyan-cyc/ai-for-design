import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {prepareSync,syncBaseline} from '../../skills/generate-3d-scene/scripts/lib/component-sync.mjs';
const out=resolve(process.argv[2]),source=join(out,'source'),target=join(out,'skill');
const entry=join(source,'src/core/index.ts'),before=await readFile(entry),file=join(source,'src/core/undocumented-sync.ts');
const targetBefore=await syncBaseline(target);
try {
 await writeFile(file,'export class UndocumentedSync {}\n');await writeFile(entry,Buffer.concat([before,Buffer.from("\nexport { UndocumentedSync } from './undocumented-sync';\n")]));
 await assert.rejects(()=>prepareSync({source,target,work:join(out,'missing-doc-prepare')}),/同步准备失败/);
 const log=await readFile(join(out,'missing-doc-prepare/build-docs.log'),'utf8');assert(log.includes('UndocumentedSync'));assert.equal(await syncBaseline(target),targetBefore);
 await writeFile(join(out,'missing-doc-result.json'),JSON.stringify({status:'pass',undocumentedExportRejected:true,targetUnchanged:true},null,2));console.log('PASS missing docs leaves target unchanged');
}finally{await writeFile(entry,before);await unlink(file);}
