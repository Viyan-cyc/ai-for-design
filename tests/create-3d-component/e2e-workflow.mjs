import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {readZip} from '../../skills/create-3d-component/assets/runtime/native/example/zip.mjs';
import {planIntake,validateIntake,applyIntake,baseline,hash} from '../../tools/3d-component-studio/intake/core.mjs';
import {prepareSync,applySync} from '../../skills/generate-3d-scene/scripts/lib/component-sync.mjs';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const out=resolve(process.env.COMPONENT_TEST_OUTPUT||join(repo,'docs/create-3d-component/native-work/e2e-final'));
await mkdir(out);const original='D:/cyc/project/octo/test/3d-components',productionBefore=await baseline(original),target=join(out,'library');
async function run(label,args){const r=spawnSync(process.execPath,args,{cwd:repo,encoding:'utf8',maxBuffer:30*1024*1024});await writeFile(join(out,label+'.log'),(r.stdout||'')+(r.stderr||''));assert.equal(r.status,0,label+' failed: '+r.stderr);return r.stdout;}
await run('verify-skill',['skills/create-3d-component/scripts/verify.mjs']);
await mkdir(target);for(const e of await readdir(original,{withFileTypes:true})){if(['.git','dist'].includes(e.name))continue;await cp(join(original,e.name),join(target,e.name),{recursive:true,dereference:true});}
const checks=[],browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const [profile,id,category,name,key,value,color] of [['native-object','e2e-object','core','AuthoredComponent','size','1.5','#45b8ff'],['native-host','e2e-host','helper','HostHighlight','opacity','0.8','#ff8800']]){
  const project=join(out,id);await run(id+'-init',['skills/create-3d-component/scripts/init.mjs','--profile',profile,'--project-dir',project,id]);
  await writeFile(join(project,'component/design.md'),`# ${id}\n\n技术流程样本，非用户已确认的业务设计。\n${profile==='native-object'?'需求：可调尺寸与颜色的独立对象。':'需求：借用现有Mesh的静态描边效果，可开关、改色及调节亮度；关闭不改变宿主。'}\n使用创作模板提供的能力，未声称额外新业务实现。视觉及功能必要性待用户确认。\n`);
  await run(id+'-build',[join(project,'example/build.mjs')]);
  const context=await browser.newContext({offline:true,acceptDownloads:true,viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(join(project,'index.3d.html')).href);await page.waitForFunction(()=>window.studio?.renders()>0);
  assert((await page.locator('#panel').boundingBox()).x>800);
  await page.locator('#control-'+key).fill(value);await page.locator('#control-color').fill(color);
  const expected=await page.evaluate(()=>studio.snapshot().design);assert.equal(expected[key],Number(value));
  const download=page.waitForEvent('download');await page.locator('#export').click();const paramsFile=join(out,id+'-parameters.json');await (await download).saveAs(paramsFile);
  await page.locator('#reset').click();await page.locator('#import').setInputFiles(paramsFile);await page.waitForFunction(()=>document.getElementById('status').textContent==='导入通过');
  assert.deepEqual(await page.evaluate(()=>studio.snapshot().design),expected);await page.screenshot({path:join(out,id+'.png')});assert.deepEqual(errors,[]);await context.close();
  const exported=JSON.parse(await readFile(paramsFile,'utf8'));assert.deepEqual(exported.parameters,expected);
  await writeFile(join(project,'component/preset.json'),JSON.stringify(exported.parameters,null,2));
  await run(id+'-rebuild',[join(project,'example/build.mjs')]);
  const output=await run(id+'-export',[join(project,'example/build.mjs'),'--export-component']);const zip=output.match(/COMPONENT_SOURCE_PATH=(.+)/)?.[1].trim();assert(zip);
  const archive=join(out,id+'-source.zip');await cp(zip,archive);const entries=readZip(new Uint8Array(await readFile(archive))),candidate=join(out,id+'-unpacked');await mkdir(candidate);
  for(const [path,bytes] of Object.entries(entries)){assert(!path.includes('..')&&!path.includes('\\')&&!path.startsWith('/')&&!path.includes(':'));assert(!/^(example|node_modules|host)\//.test(path));await mkdir(dirname(join(candidate,path)),{recursive:true});await writeFile(join(candidate,path),bytes);}
  assert.deepEqual(JSON.parse(await readFile(join(candidate,'preset.json'),'utf8')),expected);
  const plan=await planIntake({candidate,target,category,names:[name]});await writeFile(join(out,id+'-plan.json'),JSON.stringify(plan,null,2));
  const receipt=await validateIntake(plan,join(out,id+'-validation'),{runtimeTest:join(repo,'tests/create-3d-component/intake-runtime.mjs')});await applyIntake(receipt,{developerConfirmed:true});
  const sourceFiles={};for(const path of Object.keys(entries).filter(p=>p.startsWith('src/'))){const a=await readFile(join(project,'component',path)),b=await readFile(join(target,'src',category,id,path.slice(4)));assert.deepEqual(a,Buffer.from(entries[path]));assert.deepEqual(a,b);sourceFiles[path]=hash(a);}
  checks.push({id,profile,project,archive,candidate,category,name,parameters:expected,sourceFiles,archiveHash:hash(await readFile(archive)),preview:'passed',export:'passed',design:'pending-user',engineering:'passed-in-copy',developerApproval:'isolated-test-only',publication:'unpublished'});
  await writeFile(join(out,'progress.json'),JSON.stringify(checks,null,2));console.log('PASS preview -> ZIP -> library: '+id);
 }
}finally{await browser.close();}
const skill=join(out,'skill');await cp(join(repo,'skills/generate-3d-scene'),skill,{recursive:true});const plan=await prepareSync({source:target,target:skill,work:join(out,'sync-prepare'),adoptGenerated:true});await applySync(plan,{confirmed:true});
process.env.SCENE_TEST_PARAMETERS_FILE=join(out,'progress.json');
await run('generated-scene',['tests/create-3d-component/synced-scene.mjs',out]);
const scene=JSON.parse(await readFile(join(out,'scene.json'))),data=JSON.parse(await readFile(join(scene.project,'public/scene3d/scene-data.json')));
for(const [i,group] of ['authored','highlighted'].entries())for(const key of Object.keys(checks[i].parameters))assert.deepEqual(data[group][0].params[key],checks[i].parameters[key],group+' preset mapping '+key);
await run('scene-browser',['tests/create-3d-component/synced-browser.mjs',out]);await run('scene-rejection',['tests/create-3d-component/synced-rejection.mjs',out]);
assert.equal(await baseline(original),productionBefore);
await writeFile(join(out,'result.json'),JSON.stringify({status:'pass',checks,productionUnchanged:true,productionBaseline:productionBefore,scene,design:'pending-user',engineering:'passed-in-isolated-copy',synchronization:'passed-in-skill-copy',publication:'unpublished'},null,2));console.log('PASS E2E '+out);
