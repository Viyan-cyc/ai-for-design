import assert from 'node:assert/strict';
import {readFile,writeFile,unlink,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareSync,applySync,syncBaseline} from '../../skills/generate-3d-scene/scripts/lib/component-sync.mjs';
const out=resolve(process.argv[2]),source=join(out,'source'),target=join(out,'skill'),before=await syncBaseline(target);
const params=join(source,'src/helper/intake-host/parameters.ts'),original=await readFile(params);await writeFile(params,Buffer.concat([original,Buffer.from('\n// stale native documentation\n')]));
await assert.rejects(()=>prepareSync({source,target,work:join(out,'stale-native')}),/入库源码\/文档已变化/);await assert.rejects(()=>access(join(out,'stale-native')));await writeFile(params,original);assert.equal(await syncBaseline(target),before);
// A real documented factory proves ReflectionKind.Function and signature comments.
await writeFile(join(source,'src/core/sync-factory.ts'),`import {AuthoredComponent} from './intake-object';
/** Create a library object for the synchronization integration test.
 * @example
 * const object = createSyncExample({size:1.2});
 * scene.add(object);
 */
export function createSyncExample(options: ConstructorParameters<typeof AuthoredComponent>[0] = {}) { return new AuthoredComponent(options); }
`);
const barrel=join(source,'src/core/index.ts');await writeFile(barrel,(await readFile(barrel,'utf8'))+"\nexport {createSyncExample} from './sync-factory';\n");
const plan=await prepareSync({source,target,work:join(out,'update-prepare')});
const sourceMarker=join(source,'src/changed-after-plan.ts');await writeFile(sourceMarker,'export const changed = true;\n');await assert.rejects(()=>applySync(plan,{confirmed:true}),/源库变化/);await unlink(sourceMarker);
const manual='references/component-docs/createSyncExample.md',path=join(target,manual);await writeFile(path,'# Human-owned factory guidance\n');const manualBaseline=await syncBaseline(target);
await assert.rejects(()=>applySync({...plan,targetBaseline:manualBaseline},{confirmed:true}),/未登记的既存同步文件冲突/);assert.equal(await syncBaseline(target),manualBaseline);await unlink(path);
await assert.rejects(()=>applySync(plan,{confirmed:true,onWrite:(_p,n)=>{if(n===2)throw Error('injected update failure');}}),/injected/);assert.equal(await syncBaseline(target),before);
await applySync(plan,{confirmed:true});assert((await readFile(path,'utf8')).includes('createSyncExample'));
const core=await import(pathToFileURL(join(out,'update-prepare/library/dist/es/core.js')));const instance=core.createSyncExample({size:1.2});assert.equal(instance.getOptions().size,1.2);instance.dispose();
await writeFile(join(out,'update-result.json'),JSON.stringify({status:'pass',staleNativeRejected:true,sourceChangeRejected:true,manualDocumentPreserved:true,rollbackPreserved:true,factoryDocumentGenerated:true,factoryRuntimePassed:true,statesSeparate:true},null,2));console.log('PASS synchronization update and factory');
