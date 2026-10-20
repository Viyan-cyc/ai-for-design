/** Maintenance only: never invoked by the default generation/build command. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openBrowserSession } from '../lib/cdp.mjs';

const html = resolve(process.argv[2] ?? 'template/offline/index.3d.html');
const base = pathToFileURL(html).href;
const session = await openBrowserSession({ port: 9376, gpu: true, deadlineMs: 15000 });
let saved;
const wait = async (page, expression) => {
  const until = Date.now() + 30000;
  while (Date.now() < until) {
    const value = await page.evaluate(expression);
    if (value) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`页面未就绪：${await page.evaluate('document.body.innerText.slice(0,1000)')}`);
};
try {
  for (const mode of ['', '&edit=1', '&edit=1']) {
    const page = await session.newPage({
      onEvents: [async (p) => {
        await p.rpc('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
        await p.rpc('Page.addScriptToEvaluateOnNewDocument', { source: `const firstFramePoll=setInterval(()=>{if(window.__gts3d?.getDiagnostics().firstFrame){window.__firstFrameMs=performance.now();clearInterval(firstFramePoll)}},5);` });
      }],
      url: `${base}?debug=1${mode}`,
    });
    try {
      await wait(page, '!!window.__gts3d');
      const ready = await page.evaluate('window.__gts3d.whenReady({timeoutMs:25000})');
      assert.equal(ready.failed, 0);
      assert.equal(ready.firstFrame, true);
      assert.equal(await page.evaluate('document.querySelectorAll("canvas#scene-canvas").length'), 1, 'only one mode boots');
      if (mode && !saved) {
        saved = await page.evaluate(`(async () => {
          const {bridge,save}=window.__gts3dEdit;
          const se=bridge.handle.internals.sceneEngine;
          const id=se.getAllIds().find(id=>se.getNode(id));
          const snapshot=bridge.handle.serialize();
          const type=Object.keys(snapshot).find(key=>Array.isArray(snapshot[key])&&snapshot[key].some(n=>n.id===id));
          const node=snapshot[type].find(n=>n.id===id);
          const position=[(node.position?.[0]??0)+2,3,4];
          const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;
          canvas.getContext('2d').fillRect(0,0,2,2);const image=canvas.toDataURL();
          bridge.commit('测试编辑',()=>{se.patchVisual(id,{color:'#12ab34',map:image});bridge.handle.update({[type]:[{...node,position}]});});
          bridge.undo();bridge.redo();
          let download;
          const click=HTMLAnchorElement.prototype.click;
          HTMLAnchorElement.prototype.click=function(){download={name:this.download,text:fetch(this.href).then(r=>r.text())}};
          try{save.save()}finally{HTMLAnchorElement.prototype.click=click}
          if(download.name!=='scene.3d.json')throw new Error('wrong download name');
          const data=JSON.parse(await download.text);
          return {id,data,type,position};
        })()`);
        assert.equal(saved.data.format, 'gts3d-scene');
        assert.equal(Object.keys(saved.data.textures).length, 1);
        await page.evaluate(`window.__gts3dEdit.bridge.select(${JSON.stringify(saved.id)},false)`);
        await wait(page, '!!document.querySelector(".ms__entry")');
        await page.evaluate('document.querySelector(".ms__entry").click()');
        await wait(page, '[...document.querySelectorAll(".pp__grp-t")].some(b=>b.textContent.includes("贴图"))');
        await page.evaluate('if(!document.querySelector(".pp__tex")){[...document.querySelectorAll(".pp__grp-t")].find(b=>b.textContent.includes("贴图")).click()}');
        await wait(page, '!!document.querySelector(".pp__tex button")');
        await page.evaluate(`(async()=>{
          const canvas=document.createElement('canvas');canvas.width=3;canvas.height=3;
          const ctx=canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,3,3);
          window.__testImage=canvas.toDataURL();
          const blob=await new Promise(r=>canvas.toBlob(r));
          const click=HTMLInputElement.prototype.click;
          HTMLInputElement.prototype.click=function(){
            if(this.type!=='file')return click.call(this);
            const transfer=new DataTransfer();transfer.items.add(new File([blob],'本地 贴图.png',{type:'image/png'}));
            this.files=transfer.files;this.dispatchEvent(new Event('change'));
          };
          try{document.querySelector('.pp__tex button').click()}finally{HTMLInputElement.prototype.click=click}
        })()`);
        await wait(page, 'JSON.stringify(window.__gts3d.serialize()).includes(window.__testImage)');
        saved.data = await page.evaluate('window.__gts3dEdit.save.encode()');
      } else if (mode && saved) {
        const restored = await page.evaluate(`(() => {
          const {bridge,save}=window.__gts3dEdit;
          save.importText(${JSON.stringify(JSON.stringify(saved.data))});
          const scene=bridge.handle.serialize();
          const v=scene.__visuals[${JSON.stringify(saved.id)}];
          const before=JSON.stringify(scene);
          let rejected=false;try{save.importText(JSON.stringify({...${JSON.stringify(saved.data)},sourceId:'wrong'}))}catch{rejected=true}
          return {color:v.color,map:v.map,textures:Object.keys(save.encode().textures).length,position:scene[${JSON.stringify(saved.type)}].find(n=>n.id===${JSON.stringify(saved.id)}).position,rejected,unchanged:before===JSON.stringify(bridge.handle.serialize())};
        })()`);
        assert.equal(restored.color, '#12ab34');
        assert.deepEqual(restored.position, saved.position);
        assert.ok(restored.map.startsWith('data:image/png;base64,'));
        assert.equal(restored.rejected, true);
        assert.equal(restored.unchanged, true);
        assert.equal(restored.textures, Object.keys(saved.data.textures).length);
      }
      assert.deepEqual(page.pageErrors, []);
      assert.deepEqual(page.netMisses, []);
      console.log(`PASS file:// ${mode ? 'edit/upload/save/import' : 'run'} ${ready.succeeded} assets; sampled first frame ${Math.round(await page.evaluate('window.__firstFrameMs'))}ms`);
    } finally { await page.close(); }
  }
} finally { await session.close(); }
