import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {baseline,hash} from '../../tools/3d-component-studio/intake/core.mjs';
import {readZip} from '../../tools/3d-component-studio/native-template/example/zip.mjs';
const [workArg,zipArg]=process.argv.slice(2),work=resolve(workArg),zip=resolve(zipArg);
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
const verified=await read(join(work,'verification.json')),archive=readZip(new Uint8Array(await readFile(zip))),matches=[];
for(const file of verified.files){
 assert.ok(archive[file.path],file.path);assert.equal(hash(archive[file.path]),file.sha256);
 assert.equal(hash(await readFile(join(verified.candidate,file.path))),file.sha256);
 if(file.path.startsWith('src/')){assert.equal(hash(await readFile(join(work,'library',verified.destination,file.path.slice(4)))),file.sha256);matches.push(file.path);}
}
assert.equal(Object.keys(archive).length,verified.files.length);
assert.equal(await baseline(verified.target),verified.baseline);
assert.deepEqual(verified.results.map(r=>r.exitCode),[0,0]);
const regression=await read(join(work,'runtime/regression.json')),browser=await read(join(work,'runtime/browser.json')),scatter=await read(join(work,'scatter-runtime.json')),contract=await read(join(work,'contract-tests.json'));
assert.deepEqual(regression.failures,[]);assert.deepEqual(regression.errors,[]);assert.deepEqual(browser.errors,[]);assert.deepEqual(browser.audit.callErrors,[]);assert.deepEqual(browser.audit.drawErrors,[]);assert.deepEqual(scatter.errors,[]);assert.ok(Object.values(scatter.result).every(Boolean));assert.equal(contract.passed,9);
await writeFile(join(work,'acceptance.json'),JSON.stringify({status:'ready-for-independent-review',components:['MapExperience','LogicalScatter','GridHeat','BuildingTint'],shared:'HeatField',sourceCopy:{files:matches.length,allIdentical:true},zip:{path:zip,sha256:hash(await readFile(zip)),files:Object.keys(archive).length},typecheck:'passed',build:'passed',runtime:{mapAndHeatGroups:regression.passed.length,brightnessCases:browser.cases.length,scatterChecks:Object.keys(scatter.result).length},sharedBaselineUnchanged:true,design:'original-prototypes-user-confirmed',engineering:'self-verification-passed-independent-review-pending',publication:'not-published',r7:'not-started',r8:'not-started'},null,2));
console.log('R6 acceptance.json written');
