import {MapScene} from '@a3d/a3d-components/map';
import {createScene3D} from './src/scene3d/create-scene';
const host=document.querySelector('#host') as HTMLElement, out=document.querySelector('#result')!;
let handle:any, runtime:MapScene|undefined;
const create=MapScene.create;
MapScene.create=async options=>{runtime=await create(options);return runtime;};
try{
 const data=await(await fetch('/scene3d/scene-data.json')).json();delete data.map.overlays;
 handle=await createScene3D(host,{data});await handle.whenReady({timeoutMs:20000});
 const check=(ok:unknown,label:string)=>{if(!ok)throw Error(label);out.textContent+='PASS '+label+'\n';};
 check(handle.serialize().map.overlays.length===0,'omitted overlays serialize empty');
 check(!handle.surfaces.list().some((x:any)=>x.id.startsWith('overlay_')),'no legacy surface entries');
 check(host.querySelectorAll('canvas').length===1,'no scatter canvas');
 check(!runtime!.map.getStyle().layers.some(x=>x.type==='heatmap'),'no heatmap layer');
 check(!Object.keys(runtime!.map.getStyle().sources).some(x=>x.startsWith('a3d_heat_')||x.startsWith('a3d_scatter_')),'no legacy source');
 check(handle.internals.rendererEngine.renderer.getContext().getError()===0,'shared GL context valid');
 const saved=handle.serialize();handle.update({map:saved.map});check(handle.serialize().map.overlays.length===0,'empty roundtrip');
 handle.dispose();handle=null;check(host.children.length===0,'lifecycle cleanup');out.textContent+='ALL PASS';
}catch(e){out.textContent+='FAIL '+e;}finally{handle?.dispose();MapScene.create=create;}
