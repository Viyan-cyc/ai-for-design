import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const evidence=new URL('../../docs/create-3d-component/native-work/five-closeout/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
try{
 for(const name of ['GeographicScatter','SurfaceParticleScan']){
  await page.goto('http://127.0.0.1:17918/#'+name);await page.getByRole('heading',{name,exact:true}).waitFor();
  await page.locator('[data-control]').first().waitFor();
  assert.ok(await page.locator('pre code.hljs').count());
  assert.ok(await page.locator('.demo-card canvas').count());
  const slider=page.locator('input[type=range]').first();await slider.fill(name==='GeographicScatter'?'4':'10');await slider.dispatchEvent('input');
  if(name==='GeographicScatter'){await page.getByRole('button',{name:'业务空数据'}).click();await page.getByRole('button',{name:'恢复演示'}).click();}
  else{await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'继续',exact:true}).click();await page.getByRole('button',{name:'重播',exact:true}).click();}
  checks.push(name+': route, demo, public controls, highlighted last example');
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('docs-browser.json',evidence),JSON.stringify({passed:true,checks,errors},null,2));
}finally{await browser.close();}
