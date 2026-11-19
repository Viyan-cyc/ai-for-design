import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {hash} from '../../tools/3d-component-studio/intake/core.mjs';
const work=resolve(process.argv[2]),base=process.argv[3]||'http://127.0.0.1:17918';
const receipt=JSON.parse(await readFile(join(work,'receipt.json'),'utf8'));
for(const c of receipt.changes)assert.equal(hash(await readFile(join(receipt.target,c.path))),c.after,c.path);
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 for(const name of ['LogicalScatter','MapExperience','GridHeat','BuildingTint']){
  await page.goto(base+'/#'+name);
  await page.waitForFunction(n=>document.querySelector('#page-host h2')?.textContent===n,name);
  await page.waitForSelector('.restored-stage canvas');
  if(name!=='LogicalScatter')await page.waitForFunction(async()=>{const m=await import('/shared/restored-map-demo.ts');return m.getDemoState(document.querySelector('.restored-stage'))?.ready;},null,{timeout:60000});
  assert.ok(await page.locator('pre code.hljs .hljs-keyword').count());
  checks.push(name+' actual-target load/highlight');
 }
 assert.deepEqual(errors,[]);
 await writeFile(join(work,'applied-browser.json'),JSON.stringify({status:'passed',target:receipt.target,base,checks,errors,filesMatched:receipt.changes.length,visual:'not-evaluated'},null,2));
 console.log(JSON.stringify({status:'passed',checks,filesMatched:receipt.changes.length}));
}catch(e){await writeFile(join(work,'applied-browser.json'),JSON.stringify({status:'failed',checks,errors,error:e.message},null,2));throw e;}
finally{await browser.close();}
