/** Maintenance integration: new template -> real builds -> editor -> stripped runtime. */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { initProject } from '../../skills/generate-3d-scene/scripts/init.mjs';
import { stripEdit } from '../../skills/generate-3d-scene/scripts/strip-edit.mjs';
import { checkProject } from '../../skills/generate-3d-scene/scripts/build.mjs';
import {
  checkEnvironment,
  npmEntry,
} from '../../skills/generate-3d-scene/scripts/lib/environment.mjs';
import { openBrowserSession } from '../../skills/generate-3d-scene/scripts/lib/cdp.mjs';
import { seedProject } from './asset-fixture-data.mjs';
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '../../skills/generate-3d-scene');
const env = checkEnvironment(),
  temp = mkdtempSync(join(tmpdir(), 'scene3d-secondary-')),
  project = join(temp, 'source'),
  out = join(temp, 'stripped');
const init = initProject(project, { profile: 'demo', deferBuild: true });
assert.equal(init.ok, true, JSON.stringify(init.errors));
seedProject(project);
// Business card remains outside the package; exercises state and host Vue context.
writeFileSync(join(project,'src/business/cards/StatefulCard.vue'), `<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted } from 'vue';
import ExampleCard from './ExampleCard.vue';
defineProps<{id: string; status?: string; speed?: number}>();
const text=ref(''); const tenant=inject('tenant');
onMounted(()=>{const w=window as unknown as Record<string,number>;w.cardMounts=(w.cardMounts||0)+1;});
onUnmounted(()=>{const w=window as unknown as Record<string,number>;w.cardUnmounts=(w.cardUnmounts||0)+1;});
</script><template><div class="card-test"><input aria-label="card-note" v-model="text"/><span class="tenant">{{tenant}}</span><GlobalBadge/><ExampleCard v-bind="$props"/></div></template>
<style scoped>.card-test{padding:6px;border:1px solid blue}</style>`);
writeFileSync(join(project,'src/business/cards/index.ts'),`import StatefulCard from './StatefulCard.vue';
import { h } from 'vue';
export const cards={example:StatefulCard, alternate:{render:()=>h('div',{class:'alternate-card'},'alternate')}};
`);
const bootPath=join(project,'src/boot-scene.ts');
let bootCode=readFileSync(bootPath,'utf8');
bootCode="import { createApp, defineComponent, getCurrentInstance, h, type AppContext } from 'vue';\n"+bootCode;
bootCode=bootCode.replace('  const handle = await createScene3D(host, { cards, ...options });', `
  let context:AppContext|undefined;
  const owner=createApp(defineComponent({setup(){context=getCurrentInstance()!.appContext;return ()=>null;}}));
  owner.use({install(app){app.provide('tenant','business-context');app.component('GlobalBadge',{render:()=>h('b',{class:'global-badge'},'host-plugin')});}});
  owner.mount(document.createElement('div'));
  const handle = await createScene3D(host, { cards, cardContext:context, ...options });
  handle.onDispose(()=>owner.unmount());`);
writeFileSync(bootPath,bootCode);
const hashes=(dir)=>Object.fromEntries(readdirSync(dir,{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>{const f=join(e.parentPath,e.name);return[f,readFileSync(f,'utf8')];}));
const businessBefore=hashes(join(project,'src/business')), bootBefore=readFileSync(bootPath,'utf8');
const donor=join(temp,'replacement');
const fresh=initProject(donor,{profile:'demo',deferBuild:true});assert.equal(fresh.ok,true,JSON.stringify(fresh.errors));seedProject(donor);
const freshDataPath=join(donor,'public/scene3d/scene-data.json');
const freshData=JSON.parse(readFileSync(freshDataPath,'utf8'));freshData.meta={...freshData.meta,name:'replacement scene'};writeFileSync(freshDataPath,JSON.stringify(freshData));
cpSync(join(donor,'src/scene3d'),join(project,'src/scene3d'),{recursive:true});
cpSync(join(donor,'public/scene3d'),join(project,'public/scene3d'),{recursive:true});
assert.deepEqual(hashes(join(project,'src/business')),businessBefore);assert.equal(readFileSync(bootPath,'utf8'),bootBefore);
console.log('PASS copy replacement: external business/cards/boot unchanged');
const packageEntry=join(project,'src/scene3d/index.ts'), entryCode=readFileSync(packageEntry,'utf8');
try {
 writeFileSync(packageEntry,entryCode+"\nimport '../business/cards';\n");
 assert(checkProject(project).errors.some(error=>error.includes('3D 包禁止反向依赖')));
}finally{writeFileSync(packageEntry,entryCode);}


const dataPath = join(project, 'public/scene3d/scene-data.json');
const data = JSON.parse(readFileSync(dataPath, 'utf8'));
data.cars[0].params = { assetId: 'example', status: 'normal', capacity: 2 };
data.cars[0].card = { type: 'example', trigger: 'always' };
writeFileSync(dataPath, JSON.stringify(data));
// Test-only observation seam. No debug API is added to the distributed template.
for (const rel of ['src/main.ts', 'src/edit/edit-main.ts']) {
  const p = join(project, rel);
  let code = readFileSync(p, 'utf8');
  code = code.replace(
    'const { handle } = await bootScene(',
    'const { handle, adapter } = await bootScene(',
  );
  code = code.replace('  handle.refreshCards();', '  handle.refreshCards();');
  const line = code.indexOf(');', code.indexOf('const { handle, adapter }')) + 2;
  code =
    code.slice(0, line) +
    '\n  Object.assign(window, { testHandle: handle, testAdapter: adapter });' +
    code.slice(line);
  writeFileSync(p, code);
}
function run(args, cwd = project) {
  const r = spawnSync(env.node, args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
}
run([npmEntry(env.node), 'run', 'build']);
console.log('PASS generated demo source: real TypeScript + Vite build');
run([join(skill, 'scripts/build-offline.mjs'), project]);
console.log('PASS offline build with relocated handlers/cards/compiled appearance');
const browser = await openBrowserSession({
  url: pathToFileURL(join(project, 'offline/index.3d.html')).href + '?edit=1&debug=1',
  port: 9391,
  gpu: true,
  deadlineMs: 15000,
});
const wait = async (browser, expression) => {
  const end = Date.now() + 30000;
  while (Date.now() < end) {
    if (await browser.evaluate(expression)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('Timed out: ' + expression + JSON.stringify(browser.pageErrors));
};
let saved;
try {
  await wait(browser, '!!window.testAdapter && !!window.__scene3dEdit');
  await browser.evaluate('window.testHandle.whenReady({timeoutMs:30000})');
  await wait(browser, `!!document.querySelector('.card-test input')`);
  assert.equal(await browser.evaluate(`document.querySelector('.tenant').textContent`),'business-context');
  assert.equal(await browser.evaluate(`document.querySelector('.global-badge').textContent`),'host-plugin');
  await browser.evaluate(`window.mountCount=window.cardMounts;var input=document.querySelector('[aria-label="card-note"]');input.value='keep my draft';input.dispatchEvent(new Event('input',{bubbles:true}));`);

  assert.deepEqual(
    await browser.evaluate(
      `(()=>{const h=window.testHandle;const n=h.getNodeData('car_01');n.node.params.capacity=999;return h.getNodeData('car_01').node.params.capacity})()`,
    ),
    2,
  );
  await browser.evaluate(
    `window.originalCar=window.testHandle.internals.sceneEngine.getObject('car_01');window.draws=0;window.stopDraws=window.testHandle.internals.renderLoop.onAfterFrame(()=>window.draws++);`,
  );
  assert.deepEqual(
    await browser.evaluate(`window.testAdapter.apply([{id:'car_01',status:'alarm'}]).updated`),
    ['car_01'],
  );
  await wait(browser, `document.querySelector('.example-card--alarm') && window.draws>0`);
  assert.equal(await browser.evaluate(`document.querySelector('[aria-label="card-note"]').value`),'keep my draft');
  assert.equal(await browser.evaluate(`window.cardMounts===window.mountCount`),true,'data refresh must not remount business card');

  assert.equal(
    await browser.evaluate(
      `window.originalCar===window.testHandle.internals.sceneEngine.getObject('car_01')`,
    ),
    true,
  );
  assert.equal(
    await browser.evaluate(`window.testHandle.getNodeData('car_01').node.params.assetId`),
    'example',
  );
  // Editing, undo and latest-data merging on the actual handle/Bridge.
  await browser.evaluate(
    `window.__scene3dEdit.bridge.commit('capacity',()=>window.testHandle.update({cars:[{id:'car_01',params:{assetId:'example',status:'alarm',capacity:7}}]}));window.testAdapter.apply([{id:'car_01',status:'maintenance'}]);`,
  );
  assert.equal(
    await browser.evaluate(`window.testHandle.getNodeData('car_01').node.params.capacity`),
    7,
  );
  await browser.evaluate(`window.__scene3dEdit.bridge.undo();`);
  assert.equal(
    await browser.evaluate(`window.testHandle.getNodeData('car_01').node.params.capacity`),
    2,
  );
  await browser.evaluate(
    `window.__scene3dEdit.bridge.commit('color',()=>window.testHandle.internals.sceneEngine.applyVisual('car_01',{color:'#12ab34'}));window.testHandle.refreshCards();`,
  );
  await browser.evaluate(`window.testAdapter.apply([{id:'car_01',status:'maintenance'}]);`);
  assert.equal(
    await browser.evaluate(
      `(()=>{let color;window.testHandle.internals.sceneEngine.getObject('car_01').traverse(o=>{if(o.isMesh)color=o.material.color.getHexString();});return color;})()`,
    ),
    '12ab34',
  );
  saved = await browser.evaluate('window.testHandle.serialize()');
  await browser.evaluate(`window.testHandle.patchNodeParams('car_01',{speed:12,status:undefined});`);
  assert.equal(await browser.evaluate(`window.testHandle.getNodeData('car_01').node.params.status`),'maintenance');
  await wait(browser,`document.querySelector('.example-card').textContent.includes('12.0')`);

  assert.equal(saved.__visuals.car_01.color, '#12ab34');
  await browser.evaluate(`window.testHandle.update({cars:[{id:'car_01',card:{type:'alternate',trigger:'always'}}]});`);
  await wait(browser,`!!document.querySelector('.alternate-card')`);
  assert.equal(await browser.evaluate(`document.querySelectorAll('.card-test').length`),0);
  await browser.evaluate(`window.testHandle.update({cars:[{id:'car_01',card:{type:'example',trigger:'always'}}]});`);
  await wait(browser,`!!document.querySelector('.card-test input')`);
  assert.equal(await browser.evaluate(`document.querySelector('[aria-label="card-note"]').value`),'','type switch creates new component');
  await browser.evaluate(`window.testHandle.update({remove:['car_01']});`);
  assert.equal(await browser.evaluate(`document.querySelectorAll('.card-test').length`),0,'node removal unmounts card');

  await browser.evaluate(`window.testHandle.dispose();window.testHandle.dispose();`);
  assert.equal(
    await browser.evaluate(
      `window.testAdapter.apply([{id:'car_01',status:'normal'}]).issues[0].code`,
    ),
    'disposed',
  );
  assert.equal(await browser.evaluate(`window.testHandle.getNodeData('car_01')`), null);
  assert.equal(await browser.evaluate('window.cardMounts===window.cardUnmounts'),true,'cards unmounted exactly once');
  assert.deepEqual(browser.pageErrors, []);
  console.log(
    'PASS real editor: GLB, card/status, on-demand draw, node snapshot isolation, patch after edit/undo, material preservation, disposal',
  );
} finally {
  await browser.close();
}
writeFileSync(dataPath, JSON.stringify(saved));
const stripped = await stripEdit(project, out);
assert.equal(stripped.ok, true, JSON.stringify(stripped.errors));
assert.equal(existsSync(join(out, 'src/edit')), false);
assert.equal(checkProject(out, { stripped: true }).ok, true);
symlinkSync(
  env.modules,
  join(out, 'node_modules'),
  process.platform === 'win32' ? 'junction' : 'dir',
);
run([npmEntry(env.node), 'run', 'build'], out);
console.log('PASS stripped source: standalone TypeScript + Vite build');
const dist = join(out, 'dist');
const server = createServer((req, res) => {
  try {
    const file = resolve(
      dist,
      '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
    );
    if (file !== dist && !file.startsWith(dist + (process.platform === 'win32' ? '\\' : '/')))
      throw Error('outside fixture');
    const target = file === dist || file.endsWith('index.html') ? join(dist, 'index.html') : file;
    res.setHeader(
      'Content-Type',
      target.endsWith('.js')
        ? 'application/javascript'
        : target.endsWith('.css')
          ? 'text/css'
          : target.endsWith('.html')
            ? 'text/html'
            : 'application/octet-stream',
    );
    res.end(readFileSync(target));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
let runtime;
try {
  runtime = await openBrowserSession({
    url: `http://127.0.0.1:${server.address().port}/index.html`,
    port: 9392,
    gpu: true,
    deadlineMs: 15000,
  });
  await wait(runtime, '!!window.testHandle');
  await runtime.evaluate('window.testHandle.whenReady({timeoutMs:30000})');
  assert.equal(
    await runtime.evaluate(
      `(()=>{let c;window.testHandle.internals.sceneEngine.getObject('car_01').traverse(o=>{if(o.isMesh)c=o.material.color.getHexString()});return c})()`,
    ),
    '12ab34',
  );
  assert.deepEqual(
    await runtime.evaluate(`window.testAdapter.apply([{id:'car_01',status:'alarm'}]).updated`),
    ['car_01'],
  );
  await wait(runtime, `!!document.querySelector('.example-card--alarm')`);
  assert.equal(
    await runtime.evaluate(`window.testHandle.getNodeData('car_01').node.params.capacity`),
    2,
  );
  console.log(
    'PASS stripped runtime: compiled appearance preserved, data connection and cards work',
  );
} finally {
  if (runtime) await runtime.close();
  await new Promise((r) => server.close(r));
}
console.log('FIXTURE: ' + project);
