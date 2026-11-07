/** Isolated C4 fixture only; no production/user files are written. */
import assert from 'node:assert/strict';
import {openBrowserSession} from '../../skills/generate-3d-scene/scripts/lib/cdp.mjs';
const url=process.argv[2];if(!url)throw Error('Pass isolated editor URL');
const s=await openBrowserSession({url,port:9412,deadlineMs:20000});
async function type(label,value){await s.evaluate(`window.input=document.querySelector('[aria-label="${label}"]');input.focus();input.select()`);await s.rpc('Input.insertText',{text:value});await s.evaluate(`(async()=>{input.blur();await pause()})()`)}
async function mode(label,value){await s.evaluate(`(async()=>{const el=document.querySelector('[aria-label="${label}输入方式"]');el.value='${value}';el.dispatchEvent(new Event('change',{bubbles:true}));await pause()})()`)}
try {
 await s.rpc('Emulation.setFocusEmulationEnabled',{enabled:true});
 await s.evaluate(`new Promise((r,j)=>{let n=0,t=setInterval(()=>{if(window.__scene3dEdit){clearInterval(t);r(true)}else if(++n>200){clearInterval(t);j(Error('Editor unavailable'))}},50)})`);
 await s.evaluate(`window.h=__scene3d;window.b=__scene3dEdit.bridge;window.pause=()=>new Promise(r=>setTimeout(r,120));window.button=t=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t);button('场景').click()`);
 const initial=await s.evaluate(`JSON.stringify(h.serialize())`);
 const depth=await s.evaluate('b.undoStack.length');
 await mode('背景','hsv');
 const layout=await s.evaluate(`(()=>{const c=document.querySelector('[data-color-label="背景"]');return {duplicate:/#[0-9a-f]{6}/i.test(c.textContent),align:getComputedStyle(c.parentElement).alignItems,overflow:c.scrollWidth>c.clientWidth+1}})()`);
 assert.deepEqual(layout,{duplicate:false,align:'flex-start',overflow:false});
 await s.evaluate(`(async()=>{const i=document.querySelector('[aria-label="背景 H °"]');i.focus();i.blur();await pause()})()`);
 assert.equal(await s.evaluate('JSON.stringify(h.serialize())'),initial);assert.equal(await s.evaluate('b.undoStack.length'),depth);
 await mode('背景','hex');assert.equal(await s.evaluate(`document.querySelector('[aria-label="背景 HEX"]').getAttribute('type')`),'text');await type('背景 HEX','#ff0000');await mode('背景','hsv');await type('背景 H °','120');
 assert.equal(await s.evaluate('h.serialize().scene.background'),'#00ff00');
 await s.evaluate(`(async()=>{b.undo();await pause()})()`);assert.equal(await s.evaluate('h.serialize().scene.background'),'#ff0000');
 await s.evaluate(`(async()=>{b.redo();await pause()})()`);assert.equal(await s.evaluate('h.serialize().scene.background'),'#00ff00');
 await type('背景 S %','101');assert.equal(await s.evaluate('h.serialize().scene.background'),'#00ff00');
 assert.ok(await s.evaluate(`document.querySelector('[data-color-label="背景"] [role=alert]')!==null`));
 await mode('背景','hex');await type('背景 HEX','broken');assert.equal(await s.evaluate('h.serialize().scene.background'),'#00ff00');
 await mode('灯光颜色','temperature');assert.equal(await s.evaluate(`document.querySelector('[aria-label="灯光颜色 色温 K"]').value`),'');
 const temperatureLayout=await s.evaluate(`(()=>{const c=document.querySelector('[data-color-label="灯光颜色"]');const k=c.querySelector('input[type=number]');return {duplicate:/#[0-9a-f]{6}/i.test(c.textContent),firstLine:k.parentElement===c.querySelector('.color-input__line'),overflow:c.scrollWidth>c.clientWidth+1}})()`);
 assert.deepEqual(temperatureLayout,{duplicate:false,firstLine:true,overflow:false});
 const lightBefore=await s.evaluate('h.serialize().lights[0].color');
 await type('灯光颜色 色温 K','3000');
 const warm=await s.evaluate('h.serialize().lights[0].color');assert.notEqual(warm,lightBefore);
 assert.equal(await s.evaluate(`document.querySelector('[aria-label="灯光颜色 色温 K"]').value`),'3000');
 await type('灯光颜色 色温 K','999');assert.equal(await s.evaluate('h.serialize().lights[0].color'),warm);
 await s.evaluate(`(async()=>{b.undo();await pause()})()`);assert.equal(await s.evaluate('h.serialize().lights[0].color'),lightBefore);
 assert.equal(await s.evaluate(`document.querySelector('[aria-label="灯光颜色 色温 K"]').value`),'');
 await s.evaluate(`(async()=>{b.redo();await pause()})()`);assert.equal(await s.evaluate('h.serialize().lights[0].color'),warm);
 // Selecting a different light resets K and leaves its actual stored color untouched.
 await s.evaluate(`(async()=>{const el=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='AmbientLight_001'));el.value='AmbientLight_001';el.dispatchEvent(new Event('change',{bubbles:true}));await pause()})()`);
 await mode('灯光颜色','temperature');assert.equal(await s.evaluate(`document.querySelector('[aria-label="灯光颜色 色温 K"]').value`),'');
 await s.evaluate(`(async()=>{b.select('physical_off');await pause();button('物体').click();await pause();document.querySelector('[title="点击编辑材质"]').click();await pause();for(const g of document.querySelectorAll('.mp .pp__grp-t'))if(g.textContent.includes('▸'))g.click();await pause()})()`);
 assert.equal(await s.evaluate(`document.querySelector('[data-param="sheenColor"] select').matches(':disabled')`),true);
 assert.equal(await s.evaluate(`document.querySelector('.mp option[value=temperature]')===null`),true);
 const label=await s.evaluate(`document.querySelector('.mp [data-param="color"] .color-input').dataset.colorLabel`);
 await mode(label,'hex');await type(label+' HEX','#123456');
 assert.equal(await s.evaluate('h.serialize().__visuals.physical_off.color'),'#123456');
 const materialDepth=await s.evaluate('b.undoStack.length');
 await s.evaluate(`(async()=>{window.mpPicker=document.querySelector('.mp [data-param="color"] input[type=color]');mpPicker.value='#234567';mpPicker.dispatchEvent(new Event('input',{bubbles:true}));await pause()})()`);
 await new Promise(r=>setTimeout(r,1300));
 await s.evaluate(`(async()=>{mpPicker.value='#345678';mpPicker.dispatchEvent(new Event('input',{bubbles:true}));mpPicker.dispatchEvent(new Event('change',{bubbles:true}));await pause()})()`);
 assert.equal(await s.evaluate('b.undoStack.length'),materialDepth+1,'material gesture spans pause');
 await s.evaluate(`(async()=>{b.undo();await pause()})()`);assert.equal(await s.evaluate('h.serialize().__visuals.physical_off.color'),'#123456');

 await s.evaluate(`(async()=>{b.undo();await pause()})()`);assert.notEqual(await s.evaluate('h.serialize().__visuals.physical_off.color'),'#123456');
 assert.equal(await s.evaluate(`/"(?:hsv|kelvin|temperature)"\s*:/.test(JSON.stringify(h.serialize()))`),false);
 await s.evaluate(`(async()=>{button('场景').click();await pause();window.beforePicker=JSON.stringify(h.serialize());window.picker=document.querySelector('[aria-label="背景"]');picker.value='#223344';picker.dispatchEvent(new Event('input',{bubbles:true}));await pause()})()`);
 assert.equal(await s.evaluate('h.serialize().scene.background'),'#223344','picker previews on input');
 await new Promise(r=>setTimeout(r,1300));
 await s.evaluate(`(async()=>{picker.value='#334455';picker.dispatchEvent(new Event('input',{bubbles:true}));picker.dispatchEvent(new Event('change',{bubbles:true}));await pause();b.undo();await pause()})()`);
 assert.equal(await s.evaluate('JSON.stringify(h.serialize())'),await s.evaluate('beforePicker'),'one picker session undoes together');
 await s.evaluate(`(async()=>{b.redo();await pause()})()`);assert.equal(await s.evaluate('h.serialize().scene.background'),'#334455');
 await type('背景 HEX','#556677');
 await s.evaluate(`(async()=>{b.undo();await pause()})()`);assert.equal(await s.evaluate('h.serialize().scene.background'),'#334455','next edit has its own snapshot');
 await s.evaluate(`(async()=>{b.undo();await pause()})()`);assert.equal(await s.evaluate('JSON.stringify(h.serialize())'),await s.evaluate('beforePicker'));
 await s.evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.savedColorText=text}}})`);
 await s.evaluate('__scene3dEdit.save.save()');
 assert.match(await s.evaluate('savedColorText'),/scene3d-changes/);
 assert.equal(await s.evaluate('__scene3dEdit.save.dirty.value'),true);
 assert.equal(s.pageErrors.length,0,JSON.stringify(s.pageErrors));
 console.log('color-input-browser: passed HEX/HSV, no-op, invalid inputs, K conversion, undo/redo, light switch, disabled material and unchanged storage fields');
}finally{await s.close()}
