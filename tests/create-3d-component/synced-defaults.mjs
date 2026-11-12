import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
const out=resolve(process.argv[2]),{html}=JSON.parse(await readFile(join(out,'scene.json')));
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({offline:true}),errors=[],results=[];
async function open(){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(html).href+'?edit=1&debug=1');await p.waitForFunction(()=>window.__scene3dEdit?.save&&window.__scene3d?.getNodeData('effect_1'));return p;}
async function live(p){return p.evaluate(()=>{const e=window.__scene3d.internals.sceneEngine,o=e.getObject('object_1'),r=e.getObject('effect_1'),line=r.getObjectByName('outline_0');return {size:o.getOptions().size,scale:o.getObjectByName('body').scale.x,color:o.getObjectByName('body').material.color.getHexString(),opacity:line.material.opacity,hostColor:line.material.color.getHexString(),visible:r.getObjectByName('effect').visible};});}
const expected={size:1,scale:1,color:'45b8ff',opacity:0.8,hostColor:'3d7eff',visible:true};
try{
 for(const mode of ['omitted','empty']){
  let p=await open();
  const encoded=await p.evaluate(mode=>{
   const h=window.__scene3d,s=window.__scene3dEdit.save;
   h.patchNodeParams('object_1',{size:1.8,color:'#aa3388',name:'temporary',visible:false,userData:{temporary:true}});h.patchNodeParams('effect_1',{opacity:0.4,color:'#22aa44',enabled:false});
   h.update({authored:[{id:'object_1',params:undefined}],highlighted:[{id:'effect_1'}]});
   if(h.internals.sceneEngine.getObject('object_1').getOptions().size!==1.8)throw Error('Fragment omission lost state');
   if(h.internals.sceneEngine.getObject('effect_1').getObjectByName('outline_0').material.opacity!==0.4)throw Error('Host fragment omission lost state');
   h.update({authored:[{id:'default_object'}],highlighted:[{id:'default_host',params:undefined}]});
   if(h.internals.sceneEngine.getObject('default_object').getOptions().size!==1||h.internals.sceneEngine.getObject('default_host').getObjectByName('outline_0').material.opacity!==0.8)throw Error('Creation defaults failed');
   h.update({remove:['default_object','default_host']});
   const data=s.encode();for(const group of ['authored','highlighted']){if(mode==='empty')data.scene[group][0].params={};else delete data.scene[group][0].params;}
   s.importText(JSON.stringify(data));const reset=h.internals.sceneEngine.getObject('object_1');if(reset.getOptions().name!==undefined||reset.getOptions().visible!==undefined||reset.getOptions().userData!==undefined||!reset.visible||reset.userData.temporary)throw Error('Public optional state retained');return s.encode();
  },mode);
  assert.deepEqual(await live(p),expected);assert.deepEqual(encoded.scene.authored[0].params,{});assert.deepEqual(encoded.scene.highlighted[0].params,{});
  await writeFile(join(out,'defaults-'+mode+'.json'),JSON.stringify(encoded,null,2));
  // Reapply the same saved state over a different live state.
  await p.evaluate(data=>{const h=window.__scene3d;h.patchNodeParams('object_1',{size:0.6,color:'#112233'});h.patchNodeParams('effect_1',{opacity:0.2,color:'#445566'});window.__scene3dEdit.save.importText(JSON.stringify(data));},encoded);
  assert.deepEqual(await live(p),expected);await p.close();p=await open();
  await p.evaluate(text=>window.__scene3dEdit.save.importText(text),await readFile(join(out,'defaults-'+mode+'.json'),'utf8'));assert.deepEqual(await live(p),expected);
  results.push({mode,replayedOverDifferentState:true,reopened:await live(p)});await p.close();
 }
 assert.deepEqual(errors,[]);await writeFile(join(out,'defaults-result.json'),JSON.stringify({status:'pass',results,errors},null,2));console.log('PASS omitted/empty full params replay default state');
}finally{await browser.close();}
