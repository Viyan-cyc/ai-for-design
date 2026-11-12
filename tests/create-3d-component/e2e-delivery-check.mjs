import {readFile,writeFile,access} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
const out=resolve(process.argv[2]),result=JSON.parse(await readFile(join(out,'result.json')));
assert.equal(result.status,'pass');const browser=await chromium.launch({channel:'msedge',headless:true});
const checked=[];try{
 for(const sample of result.checks){
  const context=await browser.newContext({offline:true,viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(join(sample.project,'index.3d.html')).href);await page.waitForFunction(()=>window.studio?.renders()>0);
  assert.deepEqual(await page.evaluate(()=>studio.snapshot().design),sample.parameters);
  await page.screenshot({path:join(out,sample.id+'-final.png')});assert.deepEqual(errors,[]);
  assert.deepEqual(JSON.parse(await readFile(join(out,'library/docs/components',sample.id,'preset.json'))),sample.parameters);
  checked.push({id:sample.id,rebuiltPreviewPresetMatches:true,libraryDesignPresetMatches:true});await context.close();
 }
 const scene=JSON.parse(await readFile(join(out,'scene.json'))),manifest=JSON.parse(await readFile(join(out,'skill/vendor/components-sync.json')));
 assert.deepEqual(await readFile(join(scene.project,'vendor',manifest.package.path.split('/').at(-1))),await readFile(join(out,'skill',manifest.package.path)));
 const links=[...result.checks.map(s=>({name:s.profile==='native-object'?'对象组件：尺寸与颜色':'附加效果：开关、颜色与亮度',path:relative(out,join(s.project,'index.3d.html')).replaceAll('\\','/')})),{name:'在生成场景中使用两个组件',path:relative(out,scene.html).replaceAll('\\','/')}];
 for(const l of links)await access(join(out,l.path));
 await writeFile(join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>组件创作与交付验收</title><style>body{font:16px/1.7 system-ui;background:#eef0f3;color:#1b2633;max-width:1040px;margin:48px auto;padding:24px}h1{font-size:30px}section{background:white;border-radius:16px;padding:24px;margin:18px 0}a{color:#2477ed}li{margin:12px 0}.tag{color:#526477}</style><h1>从组件创作到场景使用</h1><p>两份技术流程样本，用来验证交付链。它们不是地图、货架或扫光的新业务设计。</p><section><h2>打开体验</h2><ol>${links.map(l=>`<li><a href="${l.path}">${l.name}</a></li>`).join('')}</ol><p>前两个页面：在右侧调参，导出参数、恢复默认、再导入检查；修改参数只影响当前页面，不会自动写回源码。</p><p>第三个页面：查看组件进入真实生成场景后的结果。编辑、导入和保存适配已经过技术测试；不代表所有业务参数都有编辑器控件。</p></section><section><h2>交付物怎样流转</h2><p>设计师描述需求 → 创作并调参 → 导出组件源码包 → 开发审核并选择分类 → 在组件库副本验证、生成说明 → 同步生成器副本 → 实际场景使用。</p><p>组件本体在 component 中；相机、宿主和面板在 example 中。入库使用本轮ZIP解包源码，保持源码字节一致；演示没有混入组件库。</p></section><section><h2>当前状态</h2><p class="tag">技术链路自检通过 · 独立总体验收待进行 · 用户设计确认待进行 · 生产入库未执行 · 未发布</p><p>这次无需评价内部校验记录。你可以确认右侧调参和交付入口是否符合使用习惯；技术正确性交给独立 review。对这两份样本的确认不会自动批准其他业务组件。</p></section></html>`);
 const hub=await browser.newPage({viewport:{width:1280,height:1000}});await hub.goto(pathToFileURL(join(out,'index.html')).href);assert.equal(await hub.locator('a').count(),3);await hub.screenshot({path:join(out,'overview.png'),fullPage:true});await hub.close();
 await writeFile(join(out,'delivery-check.json'),JSON.stringify({status:'pass',checked,sceneConsumesSyncedArchive:true,linksVerified:true},null,2));console.log('PASS final previews/presets/package and delivery entry');
}finally{await browser.close();}
