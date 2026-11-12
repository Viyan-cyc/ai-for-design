import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve,join,dirname} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
import {readZip} from '../../skills/create-3d-component/assets/runtime/native/example/zip.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url)),out=resolve(process.env.COMPONENT_TEST_OUTPUT||join(repo,'docs/create-3d-component/native-work/rn11-fix'));
await mkdir(out,{recursive:true});
function run(args,pass=true,cwd=repo){const p=spawnSync(process.execPath,args,{cwd,encoding:'utf8'});if(pass)assert.equal(p.status,0,p.stdout+p.stderr);else assert.notEqual(p.status,0);return p.stdout+p.stderr;}
const project=run(['skills/create-3d-component/scripts/init.mjs',out,'type-closure','--profile',process.env.COMPONENT_PROFILE||'native-object']).match(/WORKSPACE_PATH=(.+)/)[1].trim(),build=join(project,'example/build.mjs');
run([build]);const html=await readFile(join(project,'index.3d.html')),entry=join(project,'component/src/index.ts'),original=await readFile(entry,'utf8');
await writeFile(join(project,'example/external.ts'),'export interface DemoOnly { value: string }');
await writeFile(join(project,'example/external.d.ts'),'interface OutsideDemo { value: string }');
const cases=[
 ['export-type',"export type {DemoOnly} from '../../example/external';"],
 ['import-type',"import type {DemoOnly} from '../../example/external';export type Leaked=DemoOnly;"],
 ['type-expression',"export type Leaked=import('../../example/external').DemoOnly;"],
 ['import-equals',"import External = require('../../example/external'); export type Leaked=External.DemoOnly;"],
 ['path-reference',"/// <reference path=\"../../example/external.d.ts\" />\nexport type Leaked=OutsideDemo;"],
 ['module-augmentation',"declare module '../../example/external' { interface DemoOnly { extra: string } }"],
 ['types-reference',"/// <reference types=\"node\" />"],
 ['undeclared-type-peer',"export type Leaked=import('node:fs').Stats;"]
];
for(const [name,code] of cases){await writeFile(entry,code+'\n'+original);const log=run([build,'--export-component'],false);assert.match(log,/TypeScript (dependency|types reference)/);await writeFile(join(out,name+'.log'),log);assert.deepEqual(await readFile(join(project,'index.3d.html')),html);}
await writeFile(join(project,'component/src/local-types.ts'),'export interface Local { value: string }');
const positive=original+"\nimport type {Local} from './local-types';export type {Local} from './local-types';export type LocalImport=import('./local-types').Local;export const identity=(v:Local)=>v;\n";
await writeFile(entry,positive);const exported=run([build,'--export-component']);await writeFile(join(out,'export.log'),exported);
const zip=exported.match(/COMPONENT_SOURCE_PATH=(.+)/)[1].trim(),files=readZip(new Uint8Array(await readFile(zip)));assert.deepEqual(Buffer.from(files['src/index.ts']),Buffer.from(positive));
// A fresh consumer outside both the repository and demo, with only declared peer + compiler dependencies.
const consumer=await mkdtemp(join(tmpdir(),'native-type-consumer-'));
for(const [p,b] of Object.entries(files)){const dest=join(consumer,'component',p);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,b);}
await writeFile(join(consumer,'package.json'),JSON.stringify({private:true,type:'module',dependencies:{three:'0.185.1'},devDependencies:{typescript:'5.8.3','@types/three':'0.185.0'}}));
const install=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['install','--ignore-scripts','--no-audit','--no-fund'],{cwd:consumer,encoding:'utf8',shell:process.platform==='win32'});await writeFile(join(out,'consumer-install.log'),install.stdout+install.stderr);assert.equal(install.status,0,install.stderr);
await writeFile(join(consumer,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'bundler',strict:true,skipLibCheck:true,types:[],declaration:true,emitDeclarationOnly:true,rootDir:'component/src',outDir:'types'},include:['component/src/**/*.ts']}));
const compiled=run([join(consumer,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json'],true,consumer);await writeFile(join(out,'consumer-tsc.log'),compiled);
assert((await readFile(join(consumer,'types/index.d.ts'),'utf8')).includes('LocalImport'));
await writeFile(join(out,'result.json'),JSON.stringify({status:'pass',project,consumer,cases:cases.map(x=>x[0]),positive:'internal type import/export/import expression preserved',independentDeclarations:true,noExampleOrDemoDependencies:true,sourceBytesPreserved:true},null,2));
console.log('PASS original TS type boundaries and independently extracted declaration compilation');
