/** Controlled-browser check backend: drives the same checker page the local viewer serves.
 * The link-based viewer path never depends on this; it stays available for hosts that own a browser. */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBrowserSession } from './cdp.mjs';
import { dependencyPath } from './environment.mjs';
import { loadPackage, verifyContent, safePath, markCheckFailed, applyCheckResult, checkCacheState } from './designer-assets.mjs';
import { CHECKER_VERSION } from './viewer-version.mjs';
const skill=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const viewerRoot=resolve(skill,'scripts/lib/viewer');
const page=`<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script><script type="module" src="/viewer/checker.js"></script>`;
const readyWait=`new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{if(window.checkerReady){clearInterval(timer);resolve(true);}else if(Date.now()-start>5000){clearInterval(timer);reject(new Error('Preview setup timeout'));}},50);})`;
async function freePort() {
  const probe=createServer();
  await new Promise((ok)=>probe.listen(0,'127.0.0.1',ok));
  const port=probe.address().port;
  await new Promise((ok)=>probe.close(ok));
  return port;
}
export async function previewPackage(dir,{port,timeoutMs=20000,retryFailed=false}={}) {
 const pkg=loadPackage(dir),root=resolve(dir,'files');
 const retryable=pkg.assets.filter(a=>a.technicalStatus!=='invalid');
 if(retryable.length && retryable.every(a=>checkCacheState(dir,a)==='hit')) {
   for(const a of retryable)verifyContent(dir,a);
   return pkg;
 }
 if(!retryable.some(a=>checkCacheState(dir,a)!=='hit'&&(retryFailed||!['preview_failed','preview_unavailable'].includes(a.technicalStatus))))return pkg;
 const debugPort=port ?? await freePort();
 const server=createServer((req,res)=>{
  try{
   const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   let data,mime='application/octet-stream';
   if(path==='/'){data=page;mime='text/html';}
   else {
    let file;
    if(path.startsWith('/viewer/'))file=safePath(viewerRoot,path.slice(8));
    else if(path.startsWith('/three/'))file=safePath(dependencyPath('three'),path.slice(7));
    else if(path.startsWith('/draco/'))file=safePath(resolve(skill,'template/public/assets/draco'),path.slice(7));
    else if(path.startsWith('/files/'))file=safePath(root,path.slice(7));
    else throw new Error('Unknown path');
    data=readFileSync(file);mime=({'.js':'text/javascript','.wasm':'application/wasm','.png':'image/png','.jpg':'image/jpeg','.gltf':'model/gltf+json'})[extname(file)]??mime;
   }
   res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
 const url=`http://127.0.0.1:${server.address().port}/`;let browser;
 try {
  browser=await openBrowserSession({url,port:debugPort,rpcTimeoutMs:timeoutMs+2000});
  await browser.evaluate(readyWait);
  for(const a of pkg.assets){
   if(a.technicalStatus==='invalid'||(!retryFailed&&['preview_failed','preview_unavailable'].includes(a.technicalStatus)))continue;
   try { verifyContent(dir,a); }
   catch(e){ markCheckFailed(dir,a.id,e.message); continue; }
   if(checkCacheState(dir,a)==='hit')continue;
   try {
    const input='/files/'+a.entry.split('/').map(encodeURIComponent).join('/');
    const r=await browser.evaluate(`Promise.race([window.checker.check(${JSON.stringify(input)}),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Asset load timeout')),${timeoutMs}))])`);
    applyCheckResult(dir,{assetId:a.id,contentHash:a.contentHash,checkerVersion:CHECKER_VERSION,ok:true,...r});
   }catch(e){
    applyCheckResult(dir,{assetId:a.id,contentHash:a.contentHash,checkerVersion:CHECKER_VERSION,ok:false,error:String(e.message).slice(0,600)});
    // Stop the failed asset's work before proceeding, rather than letting a timed-out load run in the background.
    await browser.navigateTo(url);await browser.evaluate(readyWait);
   }
  }
 }catch(e){for(const a of pkg.assets)if(a.technicalStatus==='structure_valid'||a.technicalStatus==='unchecked')markCheckFailed(dir,a.id,'Preview environment unavailable','preview_unavailable');}
 finally{await browser?.close();await new Promise(ok=>server.close(ok));}
 return loadPackage(dir);
}
