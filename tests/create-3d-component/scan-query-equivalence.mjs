import {chromium} from '../../tools/3d-component-studio/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import assert from 'node:assert/strict';
const w=resolve(process.argv[2]),url=process.argv[3],b=await chromium.launch({channel:'msedge',headless:true,args:['--ignore-certificate-errors']});
try{const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto(url);await p.waitForFunction(()=>window.__performanceScene?.scan.getState().count>0,null,{timeout:90000});await p.addScriptTag({path:join(w,'old-host.js')});
 const result=await p.evaluate(async()=>{
  const {map,scan,buildingState}=window.__performanceScene;scan.pause();await new Promise(r=>setTimeout(r,3500));
  // Compare actual current host data with the 104 whole-viewport adapter on the SAME map.
  const meshData=scan.data.meshes;let binding;
  const done=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('legacy query timeout')),20000);
   binding=oldScan.attachSurfaceParticleScan({map,scene:new oldScan.THREE.Scene(),origin:[121.499708,31.239703],invalidate(){},onFrame:()=>()=>{},getMeshes:()=>meshData,acceptsLayer:id=>id==='sh-buildings-3d'||id.startsWith('sh-rounded-buildings-3d'),completeLayer:id=>id.startsWith('sh-rounded-buildings-3d'),buildingHeight:f=>Number(f.properties?.render_height??f.properties?.height??6)*buildingState().heightScale,growth:()=>1,visible:()=>true,onStatus:s=>{clearTimeout(timer);if(s.startsWith('采样失败'))reject(Error(s));else resolve();}},scan.getOptions());});
  await done;
  const rows=c=>{const g=c.children[0].geometry,p=g.getAttribute('position').array,n=g.getAttribute('aSurfaceNormal').array,k=g.getAttribute('aKind').array;return Array.from(k,(kind,i)=>{const normal=[n[i*3],n[i*3+1],n[i*3+2]],sign=normal.find(v=>v!==0)<0?-1:1;return JSON.stringify([p[i*3],p[i*3+1],p[i*3+2],...normal.map(v=>v*sign),kind]);}).sort();};
  const oldRows=rows(binding.component),newRows=rows(scan),oldSet=new Set(oldRows),newSet=new Set(newRows);
  const out={before:binding.component.getState(),after:scan.getState(),missingRows:oldRows.filter(r=>!newSet.has(r)),extraRows:newRows.filter(r=>!oldSet.has(r)),missing:oldRows.filter(r=>!newSet.has(r)).length,extra:newRows.filter(r=>!oldSet.has(r)).length,sameRows:JSON.stringify(oldRows)===JSON.stringify(newRows),oldSurfaces:binding.component.userData.surfaceDiagnostics,newSurfaces:scan.userData.surfaceDiagnostics};binding.dispose();return out;
 });await writeFile(join(w,'scan-query-equivalence.json'),JSON.stringify(result,null,2));assert.equal(result.sameRows,true);assert.equal(result.before.effectiveSpacing,result.after.effectiveSpacing);console.log(JSON.stringify(result));
}finally{await b.close();}
