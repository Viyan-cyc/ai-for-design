#!/usr/bin/env node
// Maintainer regression suite. Not part of ordinary page generation.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {scripts,compilerRequire,resolveSource} from './source-tools.mjs';
const work=fs.mkdtempSync(path.join(os.tmpdir(),'gts-ep-regression-')),project=path.join(work,'test-page'),src=path.join(project,'src');
const results=[];
function run(script,args=[]){const p=spawnSync(process.execPath,[path.join(scripts,script),...args],{encoding:'utf8',timeout:30000});return {status:p.status,text:p.stdout+p.stderr};}
function test(name,fn){const result=fn();if(result?.then)return result.then(()=>results.push(name));results.push(name);}
function write(rel,text){const file=path.join(src,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);}
function clean(dir){const target=path.resolve(dir);assert(target.startsWith(path.resolve(work)+path.sep));fs.rmSync(target,{recursive:true,force:true});}
try{
  const init=run('init.mjs',[work,'test-page']);assert.equal(init.status,0,init.text);
  test('new preview entry contract',()=>{
    assert(init.text.includes('HTML_PATH: '+path.join(project,'index.gts-ep.html')),init.text);
    assert(init.text.includes('PAGE: TestPage'),init.text);
    assert(fs.existsSync(path.join(project,'index.gts-ep.html')));
    assert(!fs.existsSync(path.join(project,'index.gts.html')));
  });
  const baseline=path.join(work,'baseline');fs.cpSync(src,baseline,{recursive:true});
  const vue=(script="const title='ok'",template='<div>{{title}}</div>',style='')=>`<script setup>${script}</script><template>${template}</template><style scoped lang="less">${style}</style>`;
  function fixture(source,extra={}){clean(src);fs.cpSync(baseline,src,{recursive:true});write('pages/TestPage/index.vue',source);for(const [rel,value]of Object.entries(extra))write(rel,value);}
  function check(name,source,expected,extra={}){fixture(source,extra);test(name,()=>{const p=run('build.mjs',['--dir',project]);assert.equal(p.status,expected,p.text);if(expected)assert(p.text.includes('RESULT: FAIL'));});}
  check('basic page',vue(),0);
  test('existing project publishes new entry and preserves old file',()=>{
    const legacy=path.join(project,'index.gts.html');
    fs.writeFileSync(legacy,'legacy entry retained');
    fs.unlinkSync(path.join(project,'index.gts-ep.html'));
    const p=run('build.mjs',['--dir',project]);
    assert.equal(p.status,0,p.text);
    assert(p.text.includes('HTML_PATH: '+path.join(project,'index.gts-ep.html')),p.text);
    assert(fs.existsSync(path.join(project,'index.gts-ep.html')));
    assert.equal(fs.readFileSync(legacy,'utf8'),'legacy entry retained');
  });
  check('extensionless JS',vue("import {value} from '../../api/portal';const title=value"),0,{'api/portal.js':'export const value=1'});
  await test('published resolver matches loader',()=>{const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(project,'preview-data.js'),'utf8'),ctx);assert.equal(ctx.window.__UX_RESOLVE_SOURCE__('/src/api/portal','/src/App.vue',ctx.window.__UX_PROTO_SRC__),'/src/api/portal.js');const html=fs.readFileSync(path.join(project,'index.gts-ep.html'),'utf8');const fragment=html.split('getFile: function (path) {')[1].split('                handleModule:')[0].trim().replace(/,$/,'');const fn=vm.runInNewContext('(function(path){'+fragment+')',{window:ctx.window,SRC:ctx.window.__UX_PROTO_SRC__,ASSET_EXT:[],Promise,Error});return fn('/src/api/portal').then(r=>assert.equal(r.type,'.mjs'));});
  check('directory index',vue("import {value} from '../../api/portal';const title=value"),0,{'api/portal/index.js':'export const value=1'});
  check('explicit mjs',vue("import {value} from '../../api/portal.mjs';const title=value"),0,{'api/portal.mjs':'export const value=1'});
  check('missing named service export',vue("import {missing} from '../../api/portal.js';const title=missing"),1,{'api/portal.js':'export const value=1'});
  check('bad EP import in helper',vue("import {value} from '../../api/portal.js';const title=value"),1,{'api/portal.js':"import {ElImaginary} from 'element-plus';export const value=ElImaginary"});
  check('bad Vue export',vue("import {notRealVue} from 'vue';const title=notRealVue"),1);
  check('export-from unknown package',vue("import {value} from '../../api/portal.js';const title=value"),1,{'api/portal.js':"export {value} from 'not-mapped'"});
  check('re-export chain',vue("import {value} from '../../api/index.js';const title=value"),0,{'api/index.js':"export * from './portal.js'",'api/portal.js':'export const value=1'});
  check('unmapped dynamic import',vue("const title='ok';const load=()=>import('not-mapped')"),1);
  check('nonliteral dynamic import',vue("const title='ok';const load=(p)=>import(p)"),1);
  check('valid literal dynamic import',vue("const title='ok';const load=()=>import('../../api/portal.js')"),0,{'api/portal.js':'export const value=1'});
  check('script style token typo',vue("const style={color:'var(--color-no-such-token)'}",'<div :style="style"/>'),1);
  check('service token typo',vue("import {value} from '../../api/portal.js';const title=value"),1,{'api/portal.js':"export const value='var(--color-no-such-token)'"});
  check('EP runtime token typo',vue(undefined,undefined,'.box{color:var(--el-no-such-token)}'),1);
  check('valid semantic token',vue(undefined,undefined,'.box{color:var(--color-text-primary)}'),0);
  check('invalid CSS',vue(undefined,undefined,'.box{color red;}'),1);
  check('invalid Less',vue(undefined,undefined,'.box{color:@not-defined}'),1);
  check('valid Less',vue(undefined,undefined,'.box{.child{color:var(--color-text-primary)}}'),0);
  check('Vue built-in',vue(undefined,'<Teleport to="body"><div>ok</div></Teleport>'),0);
  check('local declared component',vue("import {defineComponent} from 'vue';const Local=defineComponent({template:'<div>ok</div>'})",'<Local />'),0);
  check('unbound kebab component',vue(undefined,'<missing-widget />'),1);
  check('unbound component',vue(undefined,'<MissingWidget />'),1);
  check('unsupported TS reported',vue().replace('<script setup>','<script setup lang="ts">'),1);
  check('missing template','<script setup>const x=1</script>',1);
  check('missing static image',vue(undefined,'<img src="../../assets/uploads/absent.png" alt="logo"/>'),1);
  check('missing imported image',vue("import logo from '../../assets/uploads/absent.png';const title='ok'",'<img :src="logo"/>'),1);
  fixture(vue());const runtime=path.join(project,'public/library/element-plus.full.min.js'),held=runtime+'.held';fs.renameSync(runtime,held);try{test('missing runtime rejected',()=>assert.equal(run('build.mjs',['--dir',project]).status,1));}finally{fs.renameSync(held,runtime);}
  fixture(vue());write('assets/broken.css','.a{background:url(./missing.woff2)}');test('missing CSS resource',()=>assert.equal(run('build.mjs',['--dir',project]).status,1));
  fixture(vue());write('api/demo.js',fs.readFileSync(path.join(src,'api/demo.js'),'utf8')+'\nexport const businessFlag=true\n');test('edited starter and its mock retained',()=>{const p=run('cleanup-starter.mjs',['--dir',project]);assert.equal(p.status,0,p.text);assert(fs.existsSync(path.join(src,'api/demo.js')));assert(fs.existsSync(path.join(src,'api/mock/demo-data.js')));});
  fixture(fs.readFileSync(path.join(baseline,'pages/TestPage/index.vue'),'utf8'));test('referenced original starter retained',()=>{assert.equal(run('cleanup-starter.mjs',['--dir',project]).status,0);assert(fs.existsSync(path.join(src,'api/demo.js')));assert(fs.existsSync(path.join(src,'api/mock/demo-data.js')));});
  fixture(vue());test('unused exact starter removed',()=>{assert.equal(run('cleanup-starter.mjs',['--dir',project]).status,0);assert(!fs.existsSync(path.join(src,'api/demo.js')));assert(!fs.existsSync(path.join(src,'api/mock/demo-data.js')));});
  fixture(vue("import {Search as SearchIcon} from '@element-plus/icons-vue';const title='ok'",'<SearchIcon />'));write('assets/icons/Search.light.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');write('assets/icons/Search.dark.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');
  test('cached company icon uses portable entry',()=>{let p=run('fetch-icons.mjs',['--dir',project]);assert.equal(p.status,0,p.text);assert(p.text.includes('CACHED: 1'));assert(fs.readFileSync(path.join(src,'pages/TestPage/index.vue'),'utf8').includes('assets/icons/entry.js'));p=run('build.mjs',['--dir',project]);assert.equal(p.status,0,p.text);const again=run('fetch-icons.mjs',['--dir',project]);assert.equal(again.status,0,again.text);assert(again.text.includes('CACHED: 1'));});
  fixture(vue("/* import {Fake} from '@element-plus/icons-vue' */const title='ok'"));test('comment is not icon import',()=>{const p=run('fetch-icons.mjs',['--dir',project]);assert.equal(p.status,0,p.text);assert(p.text.includes('RESOLVED: 0, MISSED: 0'));});
  fixture(vue("import {DefinitelyNotAnIcon} from '@element-plus/icons-vue';const title='ok'"));test('nonexistent icon rejected before lookup',()=>{const p=run('fetch-icons.mjs',['--dir',project]);assert.equal(p.status,1,p.text);assert(p.text.includes('Unknown EP icon'));});
  fixture(vue(undefined,undefined,'.box{background:url(../../assets/uploads/logo.svg)}'));write('assets/uploads/logo.svg','<svg xmlns="http://www.w3.org/2000/svg"/>');test('CSS image path rebased for offline injection',()=>{const p=run('build.mjs',['--dir',project]);assert.equal(p.status,0,p.text);const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(project,'preview-data.js'),'utf8'),ctx);assert(ctx.window.__UX_PROTO_SRC__['/src/pages/TestPage/index.vue'].includes('./src/assets/uploads/logo.svg'));});
  const sourceKeys={'/src/api/a.js':true,'/src/pages/X/index.vue':true};test('resolver bounds',()=>{assert.equal(resolveSource('../../../outside','/src/pages/X/index.vue',sourceKeys),null);assert.equal(resolveSource('../../api/a','/src/pages/X/index.vue',sourceKeys),'/src/api/a.js');});
  console.log('RESULT: OK\nCHECKS: '+results.length+'\nRUNTIME: static checks and isolated loader only; browser not run');
}catch(e){console.error('RESULT: FAIL | '+e.stack);console.error('PASSED: '+results.length);process.exitCode=1;}
finally{assert(path.resolve(work).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(work,{recursive:true,force:true});}
