/** Run against an isolated built editor: node camera-focal-browser.mjs <file-or-http-url>. */
import assert from 'node:assert/strict';
import {openBrowserSession} from '../../skills/generate-3d-scene/scripts/lib/cdp.mjs';
const url=process.argv[2];
if(!url)throw Error('Pass an isolated editor URL with edit=1&debug=1');
const s=await openBrowserSession({url,port:9407,deadlineMs:20000});
try {
 await s.rpc('Emulation.setFocusEmulationEnabled',{enabled:true});
 await s.evaluate(`new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(window.__scene3dEdit){clearInterval(t);resolve(true)}else if(++n>200){clearInterval(t);reject(Error('Editor unavailable'))}},50)})`);
 const first=await s.evaluate(`(async()=>{window.h=__scene3d;window.b=__scene3dEdit.bridge;window.pause=()=>new Promise(r=>setTimeout(r,60));[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='场景')?.click();await pause();window.f=document.querySelector('[aria-label="焦距 mm"]');const initial=JSON.stringify(h.serialize()),depth=b.undoStack.length;f.focus();const full=f.value,expected=12/Math.tan(h.serialize().camera.fov*Math.PI/360),active=document.activeElement===f&&document.hasFocus();f.blur();await pause();return {full,expected,active,unchanged:initial===JSON.stringify(h.serialize()),undoUnchanged:depth===b.undoStack.length}})()`);
 assert.equal(first.active,true);assert.equal(Number(first.full),first.expected);assert.equal(first.unchanged,true);assert.equal(first.undoUnchanged,true);
 await s.evaluate('f.focus();f.select()');await s.rpc('Input.insertText',{text:'35.123456789'});
 const after=await s.evaluate(`(async()=>{f.blur();await pause();const fov=h.serialize().camera.fov,display=f.value;f.focus();const full=f.value,expected=12/Math.tan(fov*Math.PI/360);const before=JSON.stringify(h.serialize()),depth=b.undoStack.length;f.blur();await pause();return {fov,display,full,expected,unchanged:before===JSON.stringify(h.serialize()),undoUnchanged:depth===b.undoStack.length}})()`);
 assert.ok(Math.abs(after.fov-2*Math.atan(12/35.123456789)*180/Math.PI)<1e-12);assert.equal(after.display,'35.123');assert.equal(Number(after.full),after.expected);assert.ok(Math.abs(Number(after.full)-35.123456789)<1e-12);assert.equal(after.unchanged,true);assert.equal(after.undoUnchanged,true);
 console.log(JSON.stringify({pass:true,first,after},null,2));
}finally{await s.close()}
