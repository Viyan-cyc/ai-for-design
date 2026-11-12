import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {join,resolve} from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('../../',import.meta.url)),out=resolve(process.argv[2]),target=join(out,'target'),require=createRequire(join(repo,'tools/3d-component-studio/package.json')), {chromium}=require('playwright');
const server=spawn(process.execPath,[join(target,'node_modules/vite/bin/vite.js'),'docs','--host','127.0.0.1','--port','17839','--strictPort'],{cwd:target,stdio:['ignore','pipe','pipe']});let log='';server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
let browser;
try{
 for(let i=0;i<100;i++){if(log.includes('127.0.0.1:17839'))break;if(server.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [id,name] of [['intake-object','AuthoredComponent'],['intake-host','HostHighlight']]){
  await page.goto('http://127.0.0.1:17839/#'+id);await page.locator('#page-host h2').filter({hasText:name}).waitFor();assert(await page.locator('[data-page="'+id+'"]').count());assert(await page.locator('#page-host .pt tbody tr').count()>1);
  if(id==='intake-host'){assert.equal(await page.locator('#page-host h4 code').filter({hasText:'AnimationMode'}).count(),0);assert.equal(await page.locator('#page-host td').filter({hasText:/^animation$/}).count(),1);}
  await page.screenshot({path:join(out,id+'-docs.png'),fullPage:true});await page.getByRole('heading',{name:'接入说明',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:join(out,id+'-docs-details.png'),fullPage:true});
 }assert.deepEqual(errors,[]);await writeFile(join(out,'browser-result.json'),JSON.stringify({status:'pass',pages:['intake-object','intake-host'],pageErrors:errors},null,2));
}finally{await browser?.close();server.kill();await writeFile(join(out,'docs-server.log'),log);}

