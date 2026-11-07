/** Maintenance only: pass isolated C4 fixture with edit=1&debug=1. */
import assert from 'node:assert/strict';
import {openBrowserSession} from '../../skills/generate-3d-scene/scripts/lib/cdp.mjs';
const url=process.argv[2];if(!url)throw Error('Pass isolated editor URL');
const s=await openBrowserSession({url,port:9409,deadlineMs:20000});
try {
 await s.rpc('Emulation.setFocusEmulationEnabled',{enabled:true});
 await s.evaluate(`new Promise((r,j)=>{let n=0,t=setInterval(()=>{if(window.__scene3dEdit){clearInterval(t);r(true)}else if(++n>200){clearInterval(t);j(Error('Editor unavailable'))}},50)})`);
 await s.evaluate(`window.h=__scene3d;window.b=__scene3dEdit.bridge;window.pause=()=>new Promise(r=>setTimeout(r,120));window.button=t=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t);`);
 const hint=await s.evaluate(`button('保存').title`);
 assert.match(hint,/整个场景/);assert.match(hint,/不会直接修改此预览文件/);
 await s.evaluate(`(async()=>{b.select('physical_on');await pause();button('物体').click();await pause();document.querySelector('[title="点击编辑材质"]').click();await pause()})()`);
 assert.match(await s.evaluate(`document.querySelector('[data-material-save-scope]').textContent`),/关闭面板不撤销/);
 await s.evaluate(`window.f=document.querySelector('.mp [data-param="roughness"] input[type=number]');f.focus();f.select()`);
 await s.rpc('Input.insertText',{text:'0.6234'});
 await s.evaluate(`(async()=>{f.blur();await pause();window.edited=JSON.stringify(h.serialize());document.querySelector('.mp').closest('.fpanel').querySelector('.fpanel__close').click();await pause()})()`);
 assert.equal(await s.evaluate(`JSON.stringify(h.serialize())===edited`),true,'closing does not revert');
 assert.equal(await s.evaluate(`h.serialize().__visuals.physical_on.roughness`),0.6234);
 // Capture offline save through its real entry, replacing clipboard only; not an OS clipboard test.
 await s.evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.copied=t}}});`);
 await s.evaluate(`__scene3dEdit.save.save()`);
 assert.match(await s.evaluate(`window.copied`),/0.6234/);
 assert.equal(await s.evaluate(`__scene3dEdit.save.dirty.value`),true,'offline copy does not mark source saved');
 await s.evaluate(`(async()=>{button('场景').click();await pause();window.before=h.serialize();window.baseline=JSON.stringify(before);button('机房冷色').click();await pause()})()`);
 const after=await s.evaluate(`h.serialize()`);
 const before=await s.evaluate(`before`);
 assert.deepEqual(after.camera,before.camera);assert.deepEqual(after.__visuals,before.__visuals);
 assert.equal(after.scene.background,'#e6eef7');assert.equal(after.scene.environment.intensity,0.9);
 assert.equal(after.renderer.exposure,1.05);assert.equal(after.renderer.toneMapping,'ACESFilmic');
 assert.deepEqual(after.lights.map(x=>x.id),['preset_sky','preset_key','preset_fill']);
 await s.evaluate(`(async()=>{b.undo();await pause()})()`);
 assert.equal(await s.evaluate(`JSON.stringify(h.serialize())===baseline`),true,'preset undo restores snapshot');
 console.log('editor-scope-browser: passed offline hint, material close, copy/dirty, preset scope and undo');
}finally{await s.close()}
