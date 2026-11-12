import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
const out=resolve(process.argv[2]),{html}=JSON.parse(await readFile(join(out,'scene.json')));
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({offline:true,permissions:['clipboard-read','clipboard-write'],viewport:{width:1280,height:800}}),errors=[];
async function open(){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(html).href+'?edit=1&debug=1');await p.waitForFunction(()=>window.__scene3dEdit?.save&&window.__scene3d?.getNodeData('object_1'));return p;}
try{
 let page=await open();
 const changed=await page.evaluate(()=>{
  const h=window.__scene3d,e=h.internals.sceneEngine,o=e.getObject('object_1'),r=e.getObject('effect_1'),m=r.getObjectByName('borrowed_body');
  const original={geometry:m.geometry,material:m.material,color:m.material.color.getHexString()};
  h.patchNodeParams('object_1',{size:1.8,color:'#aa3388'});h.patchNodeParams('effect_1',{enabled:false});
  const hidden=!r.getObjectByName('effect').visible;
  h.patchNodeParams('effect_1',{enabled:true,opacity:0.4,color:'#22aa44'});
  return {sameObject:o===e.getObject('object_1'),options:o.getOptions(),hidden,borrowedUnchanged:m.geometry===original.geometry&&m.material===original.material&&m.material.color.getHexString()===original.color,encoded:window.__scene3dEdit.save.encode()};
 });
 assert(changed.sameObject&&changed.hidden&&changed.borrowedUnchanged);assert.equal(changed.options.size,1.8);
 await page.evaluate(()=>window.__scene3dEdit.save.save());
 const manual=page.locator('textarea[aria-label="场景修改内容"]');
 const changeText=await manual.count()?await manual.inputValue():await page.evaluate(()=>navigator.clipboard.readText());
 const payload=JSON.parse(changeText.slice(changeText.indexOf('{')));assert.equal(payload.format,'scene3d-changes');assert(payload.changes.some(c=>c.path[0]==='authored'&&c.before&&c.after));await writeFile(join(out,'saved-changes.json'),JSON.stringify(payload,null,2));
 if(await manual.count())await page.locator('dialog button').click();
 await writeFile(join(out,'saved-scene.json'),JSON.stringify(changed.encoded,null,2));
 await page.screenshot({path:join(out,'scene.png')});await page.close();page=await open();
 assert.equal(await page.evaluate(()=>window.__scene3d.getNodeData('object_1').node.params.size),1.5);
 await page.evaluate(text=>window.__scene3dEdit.save.importText(text),await readFile(join(out,'saved-scene.json'),'utf8'));
 assert.equal(await page.evaluate(()=>window.__scene3d.getNodeData('object_1').node.params.size),1.8);
 const conflict=await page.evaluate(()=>{const h=window.__scene3d,s=window.__scene3dEdit.save,before=JSON.stringify(h.serialize()),bad=s.encode();bad.sourceId='foreign';let rejected=false;try{s.importText(JSON.stringify(bad));}catch{rejected=true;}return rejected&&before===JSON.stringify(h.serialize());});assert(conflict);
 const disposed=await page.evaluate(()=>{
  const h=window.__scene3d,e=h.internals.sceneEngine,counts={};
  for(const id of ['object_1','effect_1'])e.getObject(id).traverse(o=>{for(const [kind,v] of [['geometry',o.geometry],['material',o.material]])if(v){const key=id+':'+o.name+':'+kind;counts[key]=0;v.addEventListener('dispose',()=>counts[key]++);}});
  h.update({remove:['object_1','effect_1']});return {counts,removed:!e.getObject('object_1')&&!e.getObject('effect_1')};
 });assert(disposed.removed);assert(Object.keys(disposed.counts).length>=6);for(const v of Object.values(disposed.counts))assert.equal(v,1);
 assert.deepEqual(errors,[]);await writeFile(join(out,'browser-result.json'),JSON.stringify({status:'pass',createUpdate:true,borrowedHostPreserved:true,saveChangePayload:true,saveEncodeFileAndCloseRestore:true,foreignSourceRejectedWithoutMutation:true,dispose:disposed,errors,sourceWrite:'not performed; offline snapshot restore only'},null,2));console.log('PASS actual generated scene and SaveService');
}finally{await browser.close();}
