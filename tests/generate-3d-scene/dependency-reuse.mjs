import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { dependencyPath } from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';
import { dependencyKey } from '../../skills/generate-3d-scene/scripts/lib/project-environment.mjs';
import { checkDependencyHealth } from '../../skills/generate-3d-scene/scripts/lib/dependency-health.mjs';
import { installDependencies, registries } from '../../skills/generate-3d-scene/scripts/lib/npm-install.mjs';
test('cache ignores name only; dependencies/local bytes/scripts remain significant', () => {
  const pkg={name:'a',dependencies:{foo:'1'},scripts:{postinstall:'node setup.js'}}, env={version:'v22'};
  const lock=name=>JSON.stringify({name,packages:{'':{name,dependencies:{foo:'1'}}}});
  const key=dependencyKey(pkg,lock('a'),[['vendor/x','hash']],env);
  assert.equal(key,dependencyKey({...pkg,name:'b'},lock('b'),[['vendor/x','hash']],env));
  assert.notEqual(key,dependencyKey({...pkg,dependencies:{foo:'2'}},lock('a'),[['vendor/x','hash']],env));
  assert.notEqual(key,dependencyKey(pkg,lock('a'),[['vendor/x','new']],env));
  assert.notEqual(key,dependencyKey({...pkg,scripts:{}},lock('a'),[['vendor/x','hash']],env));
});
test('missing type files fail even when package.json exists', () => {
  const root=mkdtempSync(join(tmpdir(),'dependency-health-'));
  try {
    const dir=join(root,'example');mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'package.json'),JSON.stringify({types:'index.d.ts'}));
    const pkg={devDependencies:{example:'1'}};
    assert.throws(()=>checkDependencyHealth(root,pkg),/DEPENDENCY_INCOMPLETE/);
    writeFileSync(join(dir,'index.d.ts'),'export {};');
    checkDependencyHealth(root,pkg);
    rmSync(join(dir,'index.d.ts'));
    assert.throws(()=>checkDependencyHealth(root,pkg),/example\/index.d.ts/);
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('compiler diagnoses missing submodules and source errors beyond entry health', () => {
  const ts=createRequire(import.meta.url)(dependencyPath('typescript'));
  const root=mkdtempSync(join(tmpdir(),'dependency-compiler-'));
  try {
    const modules=join(root,'node_modules'),dir=join(modules,'example');mkdirSync(dir,{recursive:true});
    writeFileSync(join(dir,'package.json'),JSON.stringify({types:'index.d.ts'}));
    writeFileSync(join(dir,'index.d.ts'),'export {};');
    const part=join(dir,'part.d.ts'),entry=join(root,'entry.ts');
    writeFileSync(part,'export const n: number;');
    writeFileSync(entry,'import {n} from "example/part"; const x: number = n;');
    const diagnostics=()=>ts.getPreEmitDiagnostics(ts.createProgram([entry],{noEmit:true,strict:true,types:[],module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext}));
    assert.equal(diagnostics().length,0);
    rmSync(part);checkDependencyHealth(modules,{dependencies:{example:'1'}});
    assert.ok(diagnostics().some(d=>d.code===2307));
    writeFileSync(part,'export const n: number;');
    writeFileSync(entry,'const x: number = "invalid"; export {};');
    checkDependencyHealth(modules,{dependencies:{example:'1'}});
    assert.ok(diagnostics().some(d=>d.code===2322));
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('declared runtime entry must resolve before cache reuse', () => {
  const root=mkdtempSync(join(tmpdir(),'dependency-entry-'));
  try {
    const dir=join(root,'foo');mkdirSync(dir);writeFileSync(join(dir,'package.json'),JSON.stringify({main:'index.js'}));
    assert.throws(()=>checkDependencyHealth(root,{dependencies:{foo:'1'}}),/foo\/index.js/);
    writeFileSync(join(dir,'index.js'),'module.exports = {};');
    checkDependencyHealth(root,{dependencies:{foo:'1'}});
    writeFileSync(join(dir,'package.json'),JSON.stringify({main:'',types:'index.d.ts'}));
    writeFileSync(join(dir,'index.d.ts'),'export {};');
    rmSync(join(dir,'index.js'));
    checkDependencyHealth(root,{dependencies:{foo:'1'}});
  } finally {rmSync(root,{recursive:true,force:true});}
});
test('recent successful source first; failure fallback; expired/unconfigured hint ignored', () => {
  const cwd=mkdtempSync(join(tmpdir(),'registry-health-')),stateFile=join(cwd,'health.json');
  try {
    let calls=[], retryCleanup=0;
    writeFileSync(stateFile,JSON.stringify({registry:registries[1],time:100}));
    installDependencies({node:'node',npm:'npm',cwd,stateFile,now:()=>200,beforeRetry:()=>retryCleanup++,run:(_,args)=>{const r=args[args.indexOf('--registry')+1];calls.push(r);assert.equal(retryCleanup,calls.length-1);return calls.length===1?{status:1,stderr:'npm error code ENOTFOUND'}:{status:0};}});
    assert.deepEqual(calls,[registries[1],registries[0]]);
    assert.equal(JSON.parse(readFileSync(stateFile)).registry,registries[0]);
    for(const hint of [{registry:registries[1],time:0},{registry:'https://invalid.test',time:4000000}]) {
      writeFileSync(stateFile,JSON.stringify(hint));
      installDependencies({node:'node',npm:'npm',cwd,stateFile,now:()=>4000001,run:(_,args)=>{assert.equal(args[args.indexOf('--registry')+1],registries[0]);return {status:0};}});
    }
  } finally {rmSync(cwd,{recursive:true,force:true});}
});
test('recent source uses the full install budget; process timeout does not trigger reinstall', () => {
  const cwd=mkdtempSync(join(tmpdir(),'registry-budget-')),stateFile=join(cwd,'health.json');
  try {
    let time=10,calls=0;writeFileSync(stateFile,JSON.stringify({registry:registries[1],time:0}));
    assert.throws(()=>installDependencies({node:'node',npm:'npm',cwd,stateFile,now:()=>time,run:(_,args,options)=>{
      assert.ok(args.includes('--prefer-offline'));
      if(calls++===0)assert.equal(options.timeout,300000);
      time+=options.timeout;return {error:{code:'ETIMEDOUT'}};
    }}));
    assert.equal(calls,1);assert.equal(time,300010);
  } finally {rmSync(cwd,{recursive:true,force:true});}
});
