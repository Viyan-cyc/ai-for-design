import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import assert from 'node:assert/strict';
const w=resolve(process.argv[2]),url=process.argv[3],b=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-certificate-errors']});
try{
 const page=await b.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto(url);
 await page.waitForFunction(()=>window.__performanceScene?.scan.getState().count>0,null,{timeout:90000});
 await page.addScriptTag({path:join(w,'query-browser.js')});
 const results=await page.evaluate(async()=>{
  const {map,scan}=window.__performanceScene;scan.pause();const delay=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
  const key=f=>JSON.stringify([f.layer.id,f.source,f.sourceLayer,f.id,f.geometry,f.properties]);
  for(const camera of [{pitch:45,bearing:0},{pitch:65,bearing:55},{pitch:0,bearing:0}]){
   map.jumpTo(camera);await delay(3000);
   const layers=map.getStyle().layers.filter(l=>l.type==='fill-extrusion'&&(l.id==='sh-buildings-3d'||l.id.startsWith('sh-rounded-buildings-3d'))&&map.getLayoutProperty(l.id,'visibility')!=='none').map(l=>l.id);
   for(const layer of layers){
    const start=performance.now(),full=map.queryRenderedFeatures({layers:[layer]}),fullMs=performance.now()-start;
    const times=[],original=map.queryRenderedFeatures.bind(map);map.queryRenderedFeatures=(...args)=>{const t=performance.now(),v=original(...args);times.push(performance.now()-t);return v;};
    let chunked;try{chunked=await buildingQuery.queryBuildings(map,[layer]);}finally{map.queryRenderedFeatures=original;}
    if(!chunked){results.push({camera,layer,cancelled:true});continue;}
    const expected=new Set(full.map(key)),actual=new Set(chunked.map(key));
    results.push({camera,layer,fullMs,maxChunkMs:Math.max(0,...times),calls:times.length,full:full.length,unique:expected.size,chunked:actual.size,missingDetails:[...expected].filter(k=>!actual.has(k)),missing:[...expected].filter(k=>!actual.has(k)).length,extra:[...actual].filter(k=>!expected.has(k)).length});
   }
  }
  return results;
 });
 await writeFile(join(w,'query-browser-observed.json'),JSON.stringify({results,errors},null,2));
 for(const r of results){assert.ok(!r.cancelled,'unstable viewport must be rerun');assert.equal(r.missing,0);assert.equal(r.extra,0);}
 assert.ok(results.some(r=>r.unique>0));assert.deepEqual(errors,[]);
 await writeFile(join(w,'query-browser.json'),JSON.stringify({passed:true,results,errors},null,2));console.log(JSON.stringify(results));
}finally{await b.close();}
