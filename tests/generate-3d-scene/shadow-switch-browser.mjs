/** Targeted GPU regression, not a visual acceptance gate. */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { openBrowserSession } from '../../skills/generate-3d-scene/scripts/lib/cdp.mjs';
const browser=await openBrowserSession({url:pathToFileURL(resolve(process.argv[2])).href+'?edit=1&debug=1',port:9391,gpu:true,deadlineMs:15000});
try {
  for(let i=0;i<150;i++) {
    if(await browser.evaluate('!!window.__scene3dEdit && !!document.querySelector(".presets")'))break;
    await new Promise(r=>setTimeout(r,100));
  }
  const results=await browser.evaluate(`(async()=>{
    const h=window.__scene3d, e=h.internals.rendererEngine, gl=e.renderer.getContext();
    const rows=[];
    const checkSelection=()=>{
      if(document.querySelectorAll('.presets button').length!==3)throw new Error('Quality controls must stay fixed');
      const custom=!!document.querySelector('.render-settings .custom');
      if(document.querySelectorAll('.presets button[aria-pressed="true"]').length!==(custom?0:1))throw new Error('Incorrect quality selection');
      if(!document.querySelector('.render-settings [role="status"]').textContent.includes('当前：'))throw new Error('Missing quality status');
    };
    checkSelection();
    for(const index of [0,1,2,0,2,1,0]) {
      document.querySelectorAll('.presets button')[index].click();
      await new Promise(r=>setTimeout(r,150));
      checkSelection();
      rows.push({index,error:gl.getError(),lost:gl.isContextLost(),selected:document.querySelectorAll('.presets button')[index].getAttribute('aria-pressed')});
    }
    for(const type of ['Basic','PCF','VSM','PCF','Basic']) {
      h.update({renderer:{shadowMapEnabled:true,shadowMap:type}});
      await new Promise(r=>setTimeout(r,150));
      rows.push({type,error:gl.getError(),lost:gl.isContextLost(),selected:'true'});
    }
    window.__scene3dEdit.bridge.undo();
    await new Promise(r=>setTimeout(r,150));
    rows.push({undo:true,error:gl.getError(),lost:gl.isContextLost(),selected:'true'});
    return rows;
  })()`);
  console.log(JSON.stringify(results));
  for(const row of results){assert.equal(row.error,0);assert.equal(row.lost,false);assert.equal(row.selected,'true');}
  assert.deepEqual(browser.pageErrors,[]);
  console.log('PASS: real GPU quality switches and active states');
}finally{await browser.close();}
