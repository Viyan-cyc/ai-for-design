import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {countPhysicalLines,checkFileLength,checkFunctionLengths,shouldCheckSourceSize} from '../../skills/gts-ep-charts-coder/scripts/source-size.mjs';
import {compilerRequire} from '../../skills/gts-ep-charts-coder/scripts/source-tools.mjs';
const sfc=compilerRequire()('@vue/compiler-sfc');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS: '+name);}
const parse=s=>sfc.babelParse(s,{sourceType:'module'});
const fn=(start,end,n)=>[start,...Array(n-2).fill('// body'),end].join('\n');
test('physical newline boundaries',()=>{
 assert.equal(countPhysicalLines(''),0);assert.equal(countPhysicalLines('\ufeff'),0);
 for(const eol of ['\n','\r\n','\r']) for(const n of [500,501]) for(const tail of ['',eol]){
  const source='\ufeff'+Array(n).fill('// comment').join(eol)+tail;
  assert.equal(countPhysicalLines(source),n);assert.equal(checkFileLength(source,'x.js').length,n===501?1:0);
 }
 assert.equal(countPhysicalLines('x\n\n'),2);
});
for(const [name,start,end] of [
 ['declaration','function f(){','}'],['expression','const f=function(){','}'],
 ['arrow','const f=()=>{','}'],['callback','[].map(()=>{','})'],
 ['object','const o={f(){','}}'],['class','class C { f(){','}}'],
 ['private','class C { #f(){','}}'],['async','async function f(){','}'],
 ['generator','function* f(){','}'],['getter','const o={get x(){','}}'],
 ['setter','class C { set x(v){','}}'],['expression arrow','const f=()=>(','1)'],
])test(name+' 100/101',()=>{for(const n of [100,101]){const d=checkFunctionLengths(parse(fn(start,end,n)),'x.js');assert.equal(d.length,n===101?1:0);if(d.length)assert.equal(d[0].actual,n);}});
test('nested and non-code text',()=>{
 assert.equal(checkFunctionLengths(parse('function outer(){\n'+fn('function inner(){','}',101)+'\n}'),'x.js').length,2);
 assert.equal(checkFunctionLengths(parse('const s="function fake(){}"; // function comment(){}'),'x.js').length,0);
});
test('scope and immutable templates',()=>{
 assert.equal(shouldCheckSourceSize('assets/themes/base.less','a\r\n','\ufeffa\n'),false);
 assert.equal(shouldCheckSourceSize('assets/themes/base.less','changed','a'),true);
 for(const file of ['api/mock/data.json','assets/charts/colors.css','assets/themes/new.less','App.vue'])assert.equal(shouldCheckSourceSize(file,'',''),true);
 for(const file of ['assets/icons/entry.js','README.md','image.png'])assert.equal(shouldCheckSourceSize(file,'',null),false);
});
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const scripts=path.join(repo,'skills/gts-ep-charts-coder/scripts');
const work=fs.mkdtempSync(path.join(os.tmpdir(),'charts-size-'));
const project=path.join(work,'size-check');
function run(name,args){const r=spawnSync(process.execPath,[path.join(scripts,name),...args],{encoding:'utf8',timeout:30000});return {code:r.status,text:r.stdout+r.stderr};}
assert.equal(run('init.mjs',[work,'size-check']).code,0);
const page=path.join(project,'src/pages/SizeCheck/index.vue');
const original=fs.readFileSync(page,'utf8');
function build(ok,pattern){const r=run('build.mjs',['--dir',project]);assert.equal(r.code,ok?0:1,r.text);if(pattern)assert.match(r.text,pattern);return r;}
test('readable starter compiles',()=>{assert(!original.split('\n').some(l=>l.length>150));build(true);});
const preview=fs.readFileSync(path.join(project,'preview-data.js'));
test('SFC original positions, both script blocks, stale preview protected',()=>{
 fs.writeFileSync(page,'<template><div /></template>\n<script>\n'+fn('function regular(){','}',101)+'\nexport default {}\n</script>\n<script setup>\n'+fn('const callback=()=>{','}',101)+'\n</script>');
 const r=build(false,/index.vue:3: FUNCTION_LINES 101 exceeds 100/);
 assert.match(r.text,/index.vue:107: FUNCTION_LINES 101 exceeds 100/);
 assert.deepEqual(fs.readFileSync(path.join(project,'preview-data.js')),preview);
});
test('long setup top level is not a function',()=>{
 fs.writeFileSync(page,'<script setup>\n'+Array.from({length:110},(_,i)=>'const x'+i+'='+i).join('\n')+'\n</script>\n<template><div /></template>');build(true);
});
test('SFC template style aggregate and multi-file errors',()=>{
 fs.writeFileSync(page,'<template><div /></template>\n<style scoped>\n'+Array(499).fill('/* layout */').join('\n')+'\n</style>');
 fs.writeFileSync(path.join(project,'src/api/oversized.js'),fn('export function large(){','}',101));
 const r=build(false,/FILE_LINES 502 exceeds 500/);assert.match(r.text,/oversized.js:1: FUNCTION_LINES/);
});
test('repair restores build and invalid syntax still fails',()=>{
 fs.writeFileSync(page,original);fs.writeFileSync(path.join(project,'src/api/oversized.js'),'export function small(){ return 1 }\n');build(true);
 fs.writeFileSync(page,'<script setup>function {</script><template><div /></template>');build(false);
 fs.writeFileSync(page,original);build(true);
});
console.log('RESULT: OK\nCHECKS: '+checks+'\nFIXTURE_DIR: '+project);
