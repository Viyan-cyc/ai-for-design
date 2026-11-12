import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});const checks=[];
try{for(const [port,id] of [[17911,'interactive-object-docs'],[17912,'interactive-host-docs']]){
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+port+'/#'+id);await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.options);
 const headings=await page.locator('.page h3').allTextContents();assert.equal(headings.at(-1),'Examples');assert.ok(!headings.includes('设计说明'));if(id.includes('object'))assert.ok(!headings.includes('Properties'));
 await page.locator('.page h3').filter({hasText:'Examples'}).scrollIntoViewIfNeeded();const code=page.locator('pre code.language-ts');assert.ok(await code.count()>0);assert.ok(await code.first().evaluate(el=>el.classList.contains('hljs')));assert.ok(await code.first().locator('.hljs-keyword').count()>0);const colors=await code.first().evaluate(el=>({base:getComputedStyle(el).color,keyword:getComputedStyle(el.querySelector('.hljs-keyword')).color}));assert.notEqual(colors.base,colors.keyword);await page.screenshot({path:'docs/create-3d-component/native-work/library-demo/'+id+'.png'});assert.deepEqual(errors,[]);
 checks.push({id,headings,colors,highlighted:true,errors});await page.close();
}}finally{await browser.close();}
await writeFile('docs/create-3d-component/native-work/library-demo/docs-browser-result.json',JSON.stringify({status:'PASS',checks},null,2));console.log('PASS docs browser');
