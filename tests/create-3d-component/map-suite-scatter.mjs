import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
const work=resolve(process.argv[2]),library=join(work,'library');
const {build}=await import(pathToFileURL(join(library,'node_modules/esbuild/lib/main.js')));
const r=await build({stdin:{contents:`import {LogicalScatter} from ${JSON.stringify(join(library,'dist/es/map.js').replaceAll('\\','/'))};window.Scatter=LogicalScatter;`,resolveDir:library},bundle:true,write:false,format:'iife',platform:'browser'});
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.setContent('<div id="host" style="width:800px;height:600px"><span id="owned-by-host">宿主内容</span></div>');await page.addScriptTag({content:r.outputFiles[0].text});
 const result=await page.evaluate(()=>{
  const host=document.querySelector('#host'),s=new window.Scatter(host);const empty=s.getState().pointCount===0;
  s.setData([{id:'a',x:.5,y:.5},{id:'b',x:.501,y:.501}]);const updated=s.getState().pointCount===2;
  const before=s.getOptions();s.setOptions({pointRadius:before.pointRadius+1});const options=s.getOptions().pointRadius===before.pointRadius+1;
  let rejected=false;try{s.setData([{id:'bad',x:121,y:31}]);}catch{rejected=true;}const rollback=s.getState().pointCount===2;
  s.setZoom(1);const zoom=s.getState().zoomTarget===1;
  s.setData([]);const cleared=s.getState().pointCount===0;
  s.dispose();s.dispose();const disposed=!host.querySelector('canvas')&&s.getState().disposed&&!s.getState().pendingFrame&&!!host.querySelector('#owned-by-host');
  const again=new window.Scatter(host);again.dispose();return {empty,updated,options,rejected,rollback,zoom,cleared,disposed,remount:!host.querySelector('canvas')};
 });
 await writeFile(join(work,'scatter-runtime.json'),JSON.stringify({result,errors,entry:'library/dist/es/map.js',visual:'not-evaluated'},null,2));
 assert.ok(Object.values(result).every(Boolean));assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser.close();}
