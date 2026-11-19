import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {hash} from '../../tools/3d-component-studio/intake/core.mjs';
const work=resolve(process.argv[2]),library=join(work,'library'),port=Number(process.argv[3]||17917),base='http://127.0.0.1:'+port;
const receiptBytes=await readFile(join(work,'receipt.json')),receipt=JSON.parse(receiptBytes),verifiedHashes={};
for(const c of receipt.changes){const h=hash(await readFile(join(library,c.path)));assert.equal(h,c.after,c.path);verifiedHashes[c.path]=h;}
let log='',browser,page;const errors=[],warnings=[],checks=[],layouts={},networkFailures=[];
const server=spawn(process.execPath,[join(library,'node_modules/vite/bin/vite.js'),'--config','vite.docs.config.mts','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:library,windowsHide:true,stdio:['ignore','pipe','pipe']});
server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
async function ready(){for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error('文档服务退出 '+log);try{const r=await fetch(base);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw Error('服务启动超时');}
try{
 await ready();browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('requestfailed',r=>networkFailures.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'){const text=m.text();if(/shader|GL_INVALID|VALIDATE_STATUS|TypeError|ReferenceError|demo load failed/i.test(text))errors.push(text);else warnings.push(text);}});
 async function go(name){await page.evaluate(n=>location.hash=n,name);await page.waitForFunction(n=>document.querySelector('#page-host h2')?.textContent===n,name);await page.waitForSelector('.restored-stage');
  await page.evaluate(async n=>{const el=document.querySelector('.restored-stage');const m=await import(n==='LogicalScatter'?'/shared/restored-scatter-demo.ts':'/shared/restored-map-demo.ts');window.demo=n==='LogicalScatter'?m.getScatterDemoState(el):m.getDemoState(el);},name);
  if(name!=='LogicalScatter')await page.waitForFunction(async()=>{const m=await import('/shared/restored-map-demo.ts');window.demo=m.getDemoState(document.querySelector('.restored-stage'));return window.demo?.ready;},null,{timeout:60000});
  layouts[name]=await page.evaluate(()=>{const card=document.querySelector('.demo-card').getBoundingClientRect(),stage=document.querySelector('.restored-stage').getBoundingClientRect(),ctrl=document.querySelector('.demo-ctrl').getBoundingClientRect(),canvas=document.querySelector('.restored-stage canvas').getBoundingClientRect();return {stageTop:stage.top-card.top,canvasTop:canvas.top-stage.top,canvasHeight:canvas.height,controlRight:card.right-ctrl.right,controlOnRight:ctrl.left>card.left+card.width/2,highlight:!!document.querySelector('pre code.hljs .hljs-keyword'),lastHeading:[...document.querySelectorAll('#page-host h3')].at(-1)?.textContent};});
  const l=layouts[name];assert.ok(Math.abs(l.stageTop)<=2&&Math.abs(l.canvasTop)<=2&&l.canvasHeight>400&&l.controlOnRight);assert.ok(l.highlight&&l.lastHeading==='Examples');checks.push(name+'布局与末尾高亮');
 }
 async function input(key,value){await page.locator('[data-control="'+key+'"]').evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);}
 await page.goto(base+'/#guide');await page.waitForSelector('#page-host h2');
 await go('LogicalScatter');await input('pointRadius',5);assert.equal(await page.evaluate(()=>window.demo.scatter.getOptions().pointRadius),5);
 await page.locator('[data-action="empty"]').click();assert.equal(await page.evaluate(()=>window.demo.scatter.getState().pointCount),0);
 await page.locator('[data-action="sample"]').click();assert.equal(await page.evaluate(()=>window.demo.scatter.getState().pointCount),600);
 await page.locator('[data-action="reset"]').click();assert.equal(await page.evaluate(()=>window.demo.scatter.getOptions().pointRadius),3.4);
 await page.evaluate(()=>{window.retiredScatter=window.demo;window.retiredCanvas=document.querySelector('.restored-stage canvas');});
 await go('MapExperience');assert.ok(await page.evaluate(()=>window.retiredScatter.disposed&&window.retiredScatter.scatter.getState().disposed&&!window.retiredCanvas.isConnected));checks.push('散点调参/空数据/默认/切页释放');
 await input('water','#abcdef');assert.equal(await page.evaluate(()=>window.demo.map.getParameters().water),'#abcdef');
 await page.selectOption('[data-control="theme"]','dark');await page.selectOption('[data-control="mode"]','2d');await page.selectOption('[data-control="mode"]','3d');
 await page.locator('[data-action="reset"]').click();assert.equal(await page.evaluate(()=>window.demo.map.getParameters().water),'#CEE3FD');
 await page.evaluate(()=>{window.retiredMap=window.demo.map.map;window.retiredState=window.demo;});
 await go('GridHeat');assert.ok(await page.evaluate(()=>window.retiredState.disposed&&window.retiredMap._removed));checks.push('地图外观/主题/模式/默认/切页释放');
 await input('opacity',.4);assert.equal(await page.evaluate(()=>window.demo.field.getOptions().alphaStart),.4);
 await input('color-0','#aabbcc');assert.equal(await page.evaluate(()=>window.demo.field.getOptions().colors[0]),'#aabbcc');
 await input('break-0',40);assert.equal(await page.evaluate(()=>window.demo.field.getOptions().breaks[0]),.4);
 await page.locator('[data-action="empty"]').click();assert.equal(await page.evaluate(()=>window.demo.field.getSnapshot().cells.length),0);
 await page.locator('[data-action="sample"]').click();assert.ok(await page.evaluate(()=>window.demo.field.getSnapshot().cells.length>0));
 await page.locator('[data-action="reset"]').click();assert.equal(await page.evaluate(()=>window.demo.field.getOptions().alphaStart),1);checks.push('栅格调参/颜色/分界/空数据/恢复');
 await go('BuildingTint');await page.waitForFunction(()=>window.demo.tint.diagnostics().nativeDraws>0&&window.demo.tint.diagnostics().compiledMaterials>0,null,{timeout:60000});
 await page.uncheck('[data-control="grid-visible"]');assert.ok(await page.evaluate(()=>!window.demo.grid.getVisible()&&window.demo.tint.getOptions().enabled));
 await input('brightness',1.2);assert.equal(await page.evaluate(()=>window.demo.tint.getOptions().brightness),1.2);
 await page.uncheck('[data-control="tint-enabled"]');assert.equal(await page.evaluate(()=>window.demo.tint.getOptions().enabled),false);
 await page.check('[data-control="tint-enabled"]');await page.locator('[data-action="empty"]').click();assert.equal(await page.evaluate(()=>window.demo.field.getSnapshot().cells.length),0);
 await page.locator('[data-action="sample"]').click();await page.locator('[data-action="reset"]').click();assert.ok(await page.evaluate(()=>window.demo.grid.getVisible()&&window.demo.tint.getOptions().brightness===1.5));
 await page.evaluate(()=>{window.retiredTint=window.demo.tint;window.retiredField=window.demo.field;window.retiredState=window.demo;});
 await go('LogicalScatter');assert.ok(await page.evaluate(()=>{let closed=false;try{window.retiredField.setData([]);}catch{closed=true;}return closed&&window.retiredState.disposed&&window.retiredTint.diagnostics().disposed;}));checks.push('双宿主编译/独立开关/明度/空数据/销毁');
 // Leave while a new online map is still loading; late completion must not revive it.
 await page.evaluate(()=>location.hash='MapExperience');await page.waitForSelector('.restored-stage .maplibregl-canvas');await page.evaluate(()=>location.hash='Wall');
 await page.waitForFunction(()=>document.querySelector('#page-host h2')?.textContent==='Wall');await page.waitForSelector('.demo-card canvas');assert.equal(await page.locator('.restored-stage').count(),0);checks.push('快速切页与Wall回归');
 await page.evaluate(()=>location.hash='MapScene');await page.waitForFunction(()=>document.querySelector('#page-host h2')?.textContent==='MapScene');await page.waitForSelector('[data-theme]',{timeout:60000});checks.push('既有MapScene入口回归');
 await go('LogicalScatter');assert.equal(await page.locator('.maplibregl-canvas').count(),0);
 const catalog=await (await fetch(base+'/components.json')).json();for(const name of ['MapExperience','LogicalScatter','GridHeat','BuildingTint']){const c=catalog.find(c=>c.name===name);assert.equal(c?.importPath,'@a3d/a3d-components/map');assert.ok(c.examples?.length);}checks.push('四组件机器索引');
 assert.deepEqual(errors,[]);
 for(const c of receipt.changes)assert.equal(hash(await readFile(join(library,c.path))),c.after,'运行期间输入变更');
 await writeFile(join(work,'browser.json'),JSON.stringify({profile:'r7-docs',status:'passed',receiptHash:hash(receiptBytes),verifiedHashes,checks,layouts,errors,warnings,visual:'not-evaluated'},null,2));console.log(JSON.stringify({status:'passed',checks:checks.length,warnings:warnings.length}));
}catch(e){errors.push(e.stack);const diagnostic=await page?.evaluate(()=>({url:location.href,status:document.querySelector('[role=status]')?.textContent,state:window.demo?{ready:window.demo.ready,disposed:window.demo.disposed,hasMap:!!window.demo.map,diagnostics:window.demo.map?.diagnostics(),style:window.demo.map?.map?.isStyleLoaded()}:null})).catch(()=>null);await writeFile(join(work,'browser.json'),JSON.stringify({profile:'r7-docs',status:'failed',checks,layouts,errors,warnings,networkFailures,diagnostic},null,2));throw e;}
finally{await browser?.close();server.kill();await writeFile(join(work,'server.log'),log);}
