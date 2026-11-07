/** Maintenance only; isolated C4 editor URL required. */
import assert from 'node:assert/strict';
import {openBrowserSession} from '../../skills/generate-3d-scene/scripts/lib/cdp.mjs';
const url=process.argv[2];if(!url)throw Error('Pass isolated C4 editor URL');
const s=await openBrowserSession({url,port:9411,deadlineMs:20000});
try {
 await s.rpc('Emulation.setFocusEmulationEnabled',{enabled:true});
 await s.evaluate(`new Promise((r,j)=>{let n=0,t=setInterval(()=>{if(window.__scene3dEdit){clearInterval(t);r(true)}else if(++n>200){clearInterval(t);j(Error('Editor unavailable'))}},50)})`);
 await s.evaluate(`(async()=>{window.h=__scene3d;window.b=__scene3dEdit.bridge;window.pause=()=>new Promise(r=>setTimeout(r,120));b.commit('test vector',()=>h.internals.sceneEngine.applyVisual('physical_on',{normalScale:[0.7,0.9]}));b.select('physical_on');await pause();[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='物体').click();await pause();document.querySelector('[title="点击编辑材质"]').click();await pause();window.typeSelect=()=>[...document.querySelector('.mp').closest('.fpanel').querySelectorAll('select')].find(x=>[...x.options].some(o=>o.value==='MeshStandardMaterial'));window.snap=()=>({ui:typeSelect().value,visual:h.serialize().__visuals.physical_on});window.initial=snap()})()`);
 const initial=await s.evaluate('initial');
 for(const next of ['MeshStandardMaterial','MeshPhysicalMaterial']) {
   await s.evaluate(`(async()=>{b.endLiveEdit();const el=typeSelect();el.value='${next}';el.dispatchEvent(new Event('change',{bubbles:true}));await pause()})()`);
   const state=await s.evaluate('snap()');
   assert.equal(state.ui,next);assert.equal(state.visual.materialType,next);
   assert.deepEqual(state.visual.normalScale,[0.7,0.9]);
 }
 await s.evaluate(`(async()=>{b.undo();await pause()})()`);
 assert.equal((await s.evaluate('snap()')).ui,'MeshStandardMaterial');
 await s.evaluate(`(async()=>{b.undo();await pause()})()`);
 assert.deepEqual(await s.evaluate('snap()'),initial,'two undos restore complete physical material');
 await s.evaluate(`(async()=>{b.redo();await pause()})()`);
 const redone=await s.evaluate('snap()');assert.equal(redone.ui,'MeshStandardMaterial');assert.equal(redone.visual.materialType,'MeshStandardMaterial');assert.deepEqual(redone.visual.normalScale,[0.7,0.9]);
 assert.equal(s.pageErrors.length,0,JSON.stringify(s.pageErrors));
 console.log('material-type-browser: passed vector-preserving type transitions, undo/redo, UI/data consistency, no page errors');
}finally{await s.close()}
