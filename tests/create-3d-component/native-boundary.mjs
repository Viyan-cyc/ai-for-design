import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {readZip} from '../../skills/create-3d-component/assets/runtime/native/example/zip.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url));const out=resolve(process.env.COMPONENT_TEST_OUTPUT||join(repo,'docs/create-3d-component/native-work/native-boundary'));await mkdir(out,{recursive:true});
const run=(args,pass=true)=>{const p=spawnSync(process.execPath,args,{cwd:repo,encoding:'utf8'});if(pass)assert.equal(p.status,0,p.stdout+p.stderr);else assert.notEqual(p.status,0);return p.stdout+p.stderr;};
const init=run(['skills/create-3d-component/scripts/init.mjs',out,'native-boundary','--profile','native-object']);const project=init.match(/WORKSPACE_PATH=(.+)/)[1].trim(),build=join(project,'example/build.mjs');
run([build]);const html=await readFile(join(project,'index.3d.html'));const source=join(project,'component/src/index.ts'),original=await readFile(source,'utf8');const cases=[];
for(const [name,suffix]of [['demo-import',"\nimport {bad} from '../../example/bad';export {bad};"],['undeclared-peer',"\nimport fs from 'node:fs';export {fs};"],['dynamic-import',"\nexport const load=()=>import('./parameters');"],['resource-url',"\nexport const asset=new URL('../asset.png',import.meta.url);"],['type-error',"\nexport const invalid:number='bad';"]]) {
 await writeFile(join(project,'example/bad.ts'),'export const bad=1;');await writeFile(source,original+suffix);const log=run([build],false);await writeFile(join(out,name+'.log'),log);assert.deepEqual(await readFile(join(project,'index.3d.html')),html);cases.push(name);await writeFile(source,original);
}
const log=run([build,'--export-component']),zip=log.match(/COMPONENT_SOURCE_PATH=(.+)/)[1].trim(),files=readZip(new Uint8Array(await readFile(zip)));
assert(!Object.keys(files).some(p=>/^(example|vendor|node_modules)\//.test(p)));assert.deepEqual(Buffer.from(files['src/index.ts']),Buffer.from(original));assert.equal(JSON.parse(new TextDecoder().decode(files['package.json'])).peerDependencies.three,'>=0.183.0 <0.190.0');
assert.deepEqual((await readdir(project)).sort(),['component','example','index.3d.html']);
await writeFile(join(out,'result.json'),JSON.stringify({status:'pass',project,cases,sourceBytePreserved:true,zip,scope:'native object source and boundaries; target library acceptance tested separately'},null,2));console.log('PASS native source ZIP and negative boundaries');
