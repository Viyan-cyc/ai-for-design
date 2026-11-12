import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
const out=resolve(process.argv[2]),{html}=JSON.parse(await readFile(join(out,'scene.json')));
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({offline:true}),errors=[];
async function open(){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(html).href+'?edit=1&debug=1');await p.waitForFunction(()=>window.__scene3dEdit?.save&&window.__scene3d?.getNodeData('effect_1'));return p;}
try{
 let page=await open();
 const result=await page.evaluate(()=>{
  const h=window.__scene3d,{save,bridge}=window.__scene3dEdit,e=h.internals.sceneEngine;
  function snapshot(){const object=e.getObject('object_1'),root=e.getObject('effect_1'),mesh=root.getObjectByName('borrowed_body'),line=root.getObjectByName('outline_0');return JSON.parse(JSON.stringify({scene:h.serialize(),encoded:save.encode(),dirty:save.dirty.value,status:save.status.value,history:bridge.getState(),live:{object:object.getOptions(),objectId:object.uuid,scale:object.getObjectByName('body').scale.toArray(),position:object.position.toArray(),meshId:mesh.uuid,material:mesh.material.uuid,color:mesh.material.color.getHexString(),lineColor:line.material.color.getHexString(),opacity:line.material.opacity,visible:root.getObjectByName('effect').visible}}));}
  const cases=[];function rejected(name,action){const before=snapshot();let error;try{action();}catch(e){error=e.message;}const after=snapshot();if(!error||JSON.stringify(before)!==JSON.stringify(after))throw Error(name+': missing rejection or state changed '+JSON.stringify({error,before,after}));cases.push({name,error,unchanged:true});}
  function imported(mutator){const envelope=save.encode();mutator(envelope.scene);save.importText(JSON.stringify(envelope));}
  rejected('object range',()=>h.patchNodeParams('object_1',{size:99}));
  rejected('host range',()=>h.patchNodeParams('effect_1',{opacity:2}));
  rejected('object null fragment',()=>h.update({authored:[{id:'object_1',params:null}]}));
  rejected('new object null',()=>h.update({authored:[{id:'new_object',params:null}]}));
  rejected('new host null',()=>h.update({highlighted:[{id:'new_effect',params:null}]}));
  rejected('host null fragment',()=>h.update({highlighted:[{id:'effect_1',params:null}]}));
  rejected('same-source object null',()=>imported(d=>{d.authored[0].params=null;}));
  rejected('same-source host null',()=>imported(d=>{d.highlighted[0].params=null;}));
  rejected('multi-node later null',()=>imported(d=>{d.authored[0].params.size=1.7;d.highlighted[0].params=null;}));
  rejected('direct engine null batch',()=>e.applyFragment({authored:[{id:'object_1',params:{size:1.7}}],highlighted:[{id:'effect_1',params:null}]}));
  for(const value of [[],true,42,'bad']) {
   rejected('object malformed '+JSON.stringify(value),()=>h.update({authored:[{id:'object_1',params:value}]}));
   rejected('host malformed '+JSON.stringify(value),()=>h.update({highlighted:[{id:'effect_1',params:value}]}));
  }
  rejected('same-source object',()=>imported(d=>{d.authored[0].params.size=99;}));
  rejected('same-source host',()=>imported(d=>{d.highlighted[0].params.opacity=2;}));
  rejected('multi-node later failure',()=>imported(d=>{d.authored[0].params.size=1.7;d.highlighted[0].params.opacity=2;}));
  rejected('import remove and environment',()=>imported(d=>{d.authored=[];d.camera.position=[99,99,99];d.highlighted[0].params.opacity=2;}));
  rejected('fragment remove and environment',()=>h.update({remove:['object_1'],camera:{position:[99,99,99]},highlighted:[{id:'effect_1',params:{opacity:2}}]}));
  rejected('direct engine batch',()=>e.applyFragment({authored:[{id:'object_1',params:{size:1.7}}],highlighted:[{id:'effect_1',params:{opacity:2}}]}));
  // Real editor history path, not a fake dirty flag or direct save shortcut.
  imported(d=>{d.authored[0].params.size=1.8;d.highlighted[0].params.opacity=0.4;});
  if(!save.dirty.value||bridge.getState().undoDepth!==1)throw Error('Legal editor import did not enter history');
  bridge.undo();if(e.getObject('object_1').getOptions().size!==1.5)throw Error('Undo failed');
  rejected('invalid import preserves redo',()=>imported(d=>{d.authored[0].params.size=1.7;d.highlighted[0].params.opacity=2;}));
  rejected('null import preserves redo',()=>imported(d=>{d.authored[0].params.size=1.7;d.highlighted[0].params=null;}));
  rejected('object null import preserves redo',()=>imported(d=>{d.authored[0].params=null;}));
  bridge.redo();if(e.getObject('object_1').getOptions().size!==1.8||e.getObject('effect_1').getObjectByName('outline_0').material.opacity!==0.4)throw Error('Redo failed');
  return {cases,encoded:save.encode()};
 });
 await writeFile(join(out,'rejection-saved.json'),JSON.stringify(result.encoded,null,2));await page.close();page=await open();
 await page.evaluate(text=>window.__scene3dEdit.save.importText(text),await readFile(join(out,'rejection-saved.json'),'utf8'));
 const restored=await page.evaluate(()=>{const e=window.__scene3d.internals.sceneEngine;return {size:e.getObject('object_1').getOptions().size,scale:e.getObject('object_1').getObjectByName('body').scale.x,opacity:e.getObject('effect_1').getObjectByName('outline_0').material.opacity};});
 assert.deepEqual(restored,{size:1.8,scale:1.8,opacity:0.4});assert.deepEqual(errors,[]);
 await writeFile(join(out,'rejection-result.json'),JSON.stringify({status:'pass',cases:result.cases,historyUndoRedo:true,reopenedLiveValues:restored,errors},null,2));console.log('PASS rejected updates and imports preserve live/save/history');
}finally{await browser.close();}
