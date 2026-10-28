/** Maintenance-only integration checks; never a generation delivery gate. */
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openBrowserSession } from '../../skills/generate-3d-scene/scripts/lib/cdp.mjs';
const html = resolve(process.argv[2]);
const baseUrl = /^https?:/.test(process.argv[2]) ? process.argv[2] : pathToFileURL(html).href;
const browser = await openBrowserSession({ url: baseUrl + '?edit=1&debug=1', port: 9387, gpu: true, deadlineMs: 15000 });
const wait = async expression => {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const result = await browser.evaluate(expression);
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out: ' + expression + ' / ' + JSON.stringify(browser.pageErrors));
};
try {
  await wait('!!window.__scene3dEdit && !!document.querySelector(".render-settings")');
  await wait('window.__scene3d.internals.renderLoop.getStats().idle');
  assert.equal(await browser.evaluate('document.querySelector(".render-settings").parentElement.querySelector(".ed-sec") === document.querySelector(".render-settings")'), true, 'quality section first');
  assert.equal(await browser.evaluate('document.querySelector(".render-settings > details").open'), false);
  await browser.evaluate(`var choice=document.querySelector('[aria-label="帧率上限"]');choice.value='custom';choice.dispatchEvent(new Event('change',{bubbles:true}));`);
  await wait(`!!document.querySelector('[aria-label="自定义帧率"]')`);
  await browser.evaluate(`var customInput=document.querySelector('[aria-label="自定义帧率"]');customInput.value='45';customInput.dispatchEvent(new Event('change',{bubbles:true}));`);
  assert.equal(await browser.evaluate('window.__scene3d.serialize().renderer.maxFps'), 45);
  await browser.evaluate(`var choice=document.querySelector('[aria-label="帧率上限"]');choice.value='60';choice.dispatchEvent(new Event('change',{bubbles:true}));`);
  await wait(`!document.querySelector('[aria-label="自定义帧率"]')`);

  await wait('window.__scene3d.internals.renderLoop.getStats().idle');
  const initial = await browser.evaluate(`({ config: window.__scene3d.serialize().renderer, ratio: window.__scene3d.internals.rendererEngine.renderer.getPixelRatio() })`);
  assert.equal(initial.ratio, 1); assert.equal(initial.config.renderMode, 'demand');
  await browser.evaluate(`window.__draws=0; window.__off=window.__scene3d.internals.renderLoop.onAfterFrame(()=>window.__draws++);`);
  await new Promise(resolve => setTimeout(resolve, 600));
  assert.equal(await browser.evaluate('window.__draws'), 0, 'idle editor must not draw');
  await browser.evaluate(`document.querySelectorAll('.render-settings .presets button')[1].click()`);
  await wait('window.__scene3d.serialize().renderer.pixelRatio === 1.25');
  assert(await browser.evaluate('window.__draws > 0'));
  assert.equal(await browser.evaluate('window.__scene3d.internals.rendererEngine.renderer.getPixelRatio()'), 1.25);
  await browser.evaluate(`var el=document.querySelector('[aria-label="实际像素比"]'); el.value='0.75';el.dispatchEvent(new Event('change',{bubbles:true}));`);
  await wait('!!document.querySelector(".render-settings .custom")');
  assert.equal(await browser.evaluate('window.__scene3d.internals.rendererEngine.renderer.getPixelRatio()'), 0.75);
  await browser.evaluate(`window.__scene3dEdit.bridge.undo()`);
  assert.equal(await browser.evaluate('window.__scene3d.serialize().renderer.pixelRatio'), 1.25);
  await browser.evaluate(`var el=document.querySelector('[aria-label="帧率上限"]');el.value='30';el.dispatchEvent(new Event('change',{bubbles:true})); var mode=document.querySelector('[aria-label="渲染方式"]');mode.value='continuous';mode.dispatchEvent(new Event('change',{bubbles:true}));`);
  await wait('window.__scene3d.serialize().renderer.maxFps === 30 && window.__scene3d.serialize().renderer.renderMode === "continuous"');
  await browser.evaluate(`document.querySelectorAll('.render-settings .presets button')[2].click()`);
  assert.equal(await browser.evaluate('window.__scene3d.serialize().renderer.maxFps'), 30);
  assert.equal(await browser.evaluate('window.__scene3d.serialize().renderer.renderMode'), 'continuous');
  // Observe live mutation, individual light overrides and exact undo restoration.
  await browser.evaluate(`window.__scene3dEdit.bridge.commit('individual shadow',()=>{const lights=window.__scene3d.serialize().lights;lights[0].shadowMapSize=256;window.__scene3d.update({lights});});`);
  await wait('!!document.querySelector(".render-settings .custom")');
  await browser.evaluate(`document.querySelectorAll('.render-settings .presets button')[1].click()`);
  assert.equal(await browser.evaluate('window.__scene3d.serialize().lights[0].shadowMapSize'), 512);
  await browser.evaluate('window.__scene3dEdit.bridge.undo()');
  assert.equal(await browser.evaluate('window.__scene3d.serialize().lights[0].shadowMapSize'), 256);
  await browser.evaluate(`document.querySelector('[aria-label="大尺度深度精度"]').click()`);
  await wait('!!document.querySelector(".render-settings .pending")');
  const pending = await browser.evaluate(`({ requested: window.__scene3d.serialize().renderer.logarithmicDepthBuffer, active: window.__scene3d.internals.rendererEngine.initialOptions.logarithmicDepthBuffer, saved: window.__scene3dEdit.save.encode() })`);
  assert.equal(pending.requested, true); assert.equal(pending.active, false);
  assert.equal((pending.saved.format === 'scene3d-scene' ? pending.saved.scene : pending.saved).renderer.logarithmicDepthBuffer, true);
  await browser.evaluate(`window.__scene3d.update({renderer:{renderMode:'demand'}});`);
  await wait('window.__scene3d.internals.renderLoop.getStats().idle');
  await browser.evaluate(`window.__draws=0; const h=window.__scene3d; h.update({camera:{position:[10,8,14]}});`);
  await wait('window.__draws > 0');
  await wait('window.__scene3d.internals.renderLoop.getStats().idle');
  assert.deepEqual(browser.pageErrors, []);
  console.log('PASS real WebGL editor idle/wake, quality UI, fractional ratio, custom state, undo/per-light overrides, independent frame settings, pending initialization options and saved data');
} finally { await browser.close(); }
