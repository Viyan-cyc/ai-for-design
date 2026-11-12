import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {planIntake,validateDemoTypes} from '../../tools/3d-component-studio/intake/core.mjs';
const root=resolve('docs/create-3d-component/native-work/library-demo'),out=resolve('docs/create-3d-component/native-work/rn40-fix');await mkdir(out,{recursive:true});
const {results}=JSON.parse(await readFile(join(root,'result.json'))),library=results[0].library;
const demo=join(out,'literal.ts');
const source=`import {AuthoredComponent} from '@component';
import {defaults} from "@parameters";
export {defaults as exportedDefaults} from '@parameters';
export {AuthoredComponent as ExportedComponent} from "@component";
// '@component' "@parameters"
export function run(ctrl){const c=new AuthoredComponent(defaults);ctrl.textContent='@component';ctrl.other="@parameters";c.dispose();return ctrl;}`;
await writeFile(demo,source);
const plan=await planIntake({candidate:join(root,'interactive-object/component'),target:'D:/cyc/project/octo/test/3d-components',category:'core',names:['AuthoredComponent'],demo});
const transformed=Buffer.from(plan.operations[plan.doc+'/demo.ts'],'base64').toString();assert.ok(transformed.includes('// \'@component\' "@parameters"'));
const testFile=join(library,plan.doc,'rn40-literal.ts');await writeFile(testFile,transformed);
try{const esbuild=createRequire(join(library,'package.json'))('esbuild');await esbuild.build({entryPoints:[testFile],outfile:join(out,'literal.mjs'),bundle:true,platform:'node',format:'esm'});const module=await import(pathToFileURL(join(out,'literal.mjs')));assert.deepEqual(module.run({}),{textContent:'@component',other:'@parameters'});assert.equal(module.exportedDefaults.size,1);assert.equal(typeof module.ExportedComponent,'function');}finally{await unlink(testFile);}
const cases=[['wrong-input',`export function initDemo(a:number,b:number){a.toFixed();return ()=>{};}`,false],['required-disposer',`export function initDemo(a:HTMLCanvasElement,b:HTMLElement){return (required:number)=>required.toFixed();}`,false],['async-init',`export async function initDemo(a:HTMLCanvasElement,b:HTMLElement){return ()=>{};}`,false],['async-disposer',`export function initDemo(a:HTMLCanvasElement,b:HTMLElement){return async ()=>{};}`,false],['compatible',`export function initDemo(a:HTMLElement,b:Element){return (optional?:number)=>optional;}`,true],['fewer-parameters',`export function initDemo(){return ()=>{};}`,true]];
const outcomes=[];
for(const [name,code,valid] of cases){const file=join(out,name+'.ts');await writeFile(file,code);let accepted=true;try{await validateDemoTypes(library,file,out);}catch{accepted=false;}assert.equal(accepted,valid,name);outcomes.push({name,accepted});}
for(const result of results)await validateDemoTypes(result.library,join(result.library,'docs/components',result.id,'demo.ts'),out);
await writeFile(join(out,'result.json'),JSON.stringify({status:'PASS',literalRuntime:true,importExportRuntime:true,commentsPreserved:true,outcomes,templates:2},null,2));console.log('PASS RN40 regressions');
