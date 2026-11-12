import {readFile,writeFile,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
const out=resolve(process.env.COMPONENT_TEST_OUTPUT||'docs/create-3d-component/native-work/library-demo');
const {results}=JSON.parse(await readFile(join(out,'result.json'))),browser=await chromium.launch({channel:'msedge',headless:true});const checks=[];
try{for(const [i,result] of results.entries()){
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const token=randomUUID(),marker=join(result.library,'docs',token+'.txt');await writeFile(marker,token,{flag:'wx'});
 let exited=false;const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','docs','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:result.library,windowsHide:true,stdio:'ignore'});server.on('exit',()=>{exited=true;});server.on('error',()=>{exited=true;});
 try{
  let ready=false;for(let n=0;n<100;n++){try{assert.ok(!exited,'Vite exited before ready');const response=await fetch('http://127.0.0.1:'+port+'/'+token+'.txt');if(response.ok&&await response.text()===token){ready=true;break;}}catch{await new Promise(r=>setTimeout(r,200));}}assert.ok(ready&&!exited);
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],knownWarnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'){const message=m.text()+' '+m.location().url;(m.location().url==='http://127.0.0.1:'+port+'/favicon.ico'?knownWarnings:errors).push(message);}});
  await page.goto('http://127.0.0.1:'+port+'/#'+result.id);const canvas=page.locator('.demo-card canvas');await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.options);await page.waitForTimeout(400);
  const initial=JSON.parse(await canvas.getAttribute('data-options')),key=i?'opacity':'size',value=i?'0.25':'1.8';
  const shot1=await canvas.screenshot();await page.locator('input[data-key="'+key+'"]').fill(value);await page.locator('input[data-key="'+key+'"]').dispatchEvent('input');await page.waitForTimeout(150);
  assert.equal(JSON.parse(await canvas.getAttribute('data-options'))[key],Number(value));const shot2=await canvas.screenshot();assert.notEqual(createHash('sha256').update(shot1).digest('hex'),createHash('sha256').update(shot2).digest('hex'));
  await page.getByRole('button',{name:'恢复默认',exact:true}).click();assert.deepEqual(JSON.parse(await canvas.getAttribute('data-options')),initial);
  const cb=await canvas.boundingBox(),panel=await page.locator('.demo-ctrl').boundingBox();assert.ok(panel.x>cb.x+cb.width/2,'right panel');
  await page.screenshot({path:join(out,result.id+'.png'),fullPage:false});const old=await canvas.elementHandle();
  await page.evaluate(()=>location.hash='guide');await page.waitForFunction(()=>!document.querySelector('.demo-card canvas'));assert.equal(await old.evaluate(el=>el.dataset.disposed),'true');
  await page.evaluate(id=>location.hash=id,result.id);await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.options);assert.deepEqual(JSON.parse(await page.locator('canvas').getAttribute('data-options')),initial);
  assert.ok(!exited,'Vite exited during test');assert.deepEqual(errors,[]);checks.push({id:result.id,renderChanges:true,reset:true,rightPanel:true,navigationDispose:true,errors,knownWarnings});await page.close();
 }finally{server.kill();await unlink(marker);}
}}finally{await browser.close();}
await writeFile(join(out,'browser-result.json'),JSON.stringify({status:'PASS',checks},null,2));console.log('PASS real library demo browser checks');
