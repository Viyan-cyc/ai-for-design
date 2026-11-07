/** Pass the isolated C4 fixture URL with edit=1&debug=1. Never runs during generation. */
import assert from 'node:assert/strict';
import {openBrowserSession} from '../../skills/generate-3d-scene/scripts/lib/cdp.mjs';
const url=process.argv[2];
if(!url)throw Error('Pass isolated C4 editor URL');
const s=await openBrowserSession({url,port:9408,deadlineMs:20000});
try {
 await s.rpc('Emulation.setFocusEmulationEnabled',{enabled:true});
 await s.evaluate(`new Promise((r,j)=>{let n=0,t=setInterval(()=>{if(window.__scene3dEdit){clearInterval(t);r(true)}else if(++n>200){clearInterval(t);j(Error('Editor unavailable'))}},50)})`);
 await s.evaluate(`window.h=__scene3d;window.b=__scene3dEdit.bridge;window.pause=()=>new Promise(r=>setTimeout(r,100));window.openMaterial=async(id)=>{b.select(id);await pause();[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='物体')?.click();await pause();document.querySelector('[title="点击编辑材质"]')?.click();await pause();for(const g of document.querySelectorAll('.mp .pp__grp-t'))if(g.textContent.includes('▸'))g.click();await pause()};window.field=k=>document.querySelector('.mp [data-param="'+k+'"]');`);
 await s.evaluate(`openMaterial('physical_off')`);
 const spacing=await s.evaluate(`(()=>{const a=field('thickness'),b=field('ior');return {margin:getComputedStyle(a).marginBottom,gap:b.getBoundingClientRect().top-a.getBoundingClientRect().bottom}})()`);
 assert.equal(spacing.margin,'6px','reuse common row spacing');
 assert.ok(spacing.gap>=5.9,'adjacent material rows must not touch');
 const groups={clearcoat:['clearcoatRoughness','clearcoatNormalScale'],sheen:['sheenColor','sheenRoughness'],iridescence:['iridescenceIOR','iridescenceThicknessRange'],anisotropy:['anisotropyRotation']};
 for(const [strength,children] of Object.entries(groups)) {
   const before=await s.evaluate(`JSON.stringify(h.serialize().__visuals.physical_off)`);
   for(const child of children)assert.equal(await s.evaluate(`field('${child}')?.disabled`),true,child);
   await s.evaluate(`window.f=field('${strength}').querySelector('input[type=number]');f.focus();f.select()`);
   await s.rpc('Input.insertText',{text:'0.5'});
   await s.evaluate(`(async()=>{f.blur();await pause()})()`);
   for(const child of children)assert.equal(await s.evaluate(`field('${child}')?.disabled`),false,child);
   await s.evaluate(`(async()=>{b.undo();await pause()})()`);
   assert.equal(await s.evaluate(`JSON.stringify(h.serialize().__visuals.physical_off)`),before,'undo preserves all dormant properties');
   for(const child of children)assert.equal(await s.evaluate(`field('${child}')?.disabled`),true,child);
   await s.evaluate(`(async()=>{b.redo();await pause()})()`);
   for(const child of children)assert.equal(await s.evaluate(`field('${child}')?.disabled`),false,'redo '+child);
   await s.evaluate(`(async()=>{b.undo();await pause()})()`);
   assert.equal(await s.evaluate(`JSON.stringify(h.serialize().__visuals.physical_off)`),before);
 }
 await s.evaluate(`openMaterial('physical_on')`);
 for(const children of Object.values(groups))for(const child of children)assert.equal(await s.evaluate(`field('${child}')?.disabled`),false,'object switch '+child);
 await s.evaluate(`openMaterial('standard')`);
 assert.equal(await s.evaluate(`field('clearcoat')===null`),true,'standard hides physical groups');
 await s.evaluate(`openMaterial('physical_off')`);
 assert.equal(await s.evaluate(`field('clearcoatRoughness')?.disabled`),true,'return to disabled object');
 console.log('material-conditions-browser: passed four groups, undo/value retention, object/material switch');
} finally {await s.close()}
