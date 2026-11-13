import { createScene3D } from './src/scene3d/create-scene';
const host=document.querySelector('#host') as HTMLElement, out=document.querySelector('#result')!;
const lines:string[]=[];
function check(ok:unknown,label:string){if(!ok)throw Error(label);lines.push('PASS '+label);out.textContent=lines.join('\n');}
let handle:any;
const style=URL.createObjectURL(new Blob([JSON.stringify({version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#eee'}}]})],{type:'application/json'}));
try{
 const data=await(await fetch('/scene3d/scene-data.json')).json();data.map.styleUrl=style;data.map.overlays=[];
 for(const value of [null,{},[{id:'legacy',kind:'heat'}]]){
  const bad=structuredClone(data);bad.map.overlays=value;let error='';try{await createScene3D(host,{data:bad});}catch(e){error=String(e);}
  check(error.includes('overlays')&&host.children.length===0,'invalid initial overlays rejected before resources');
 }
 handle=await createScene3D(host,{data});await handle.whenReady({timeoutMs:20000});
 const before=JSON.stringify(handle.serialize()),canvas=host.querySelector('canvas');
 for(const value of [null,{},[{id:'legacy',kind:'scatter'}]]){
  const bad=structuredClone(handle.serialize().map);bad.overlays=value;bad.zoom=12;bad.theme='dark';let error='';try{handle.update({map:bad});}catch(e){error=String(e);}
  check(error.includes('overlays'),'invalid update rejected');check(JSON.stringify(handle.serialize())===before&&host.querySelector('canvas')===canvas,'snapshot and resources preserved');
 }
 handle.update({map:{...handle.serialize().map,overlays:[],theme:'dark'}});
 check(handle.serialize().map.theme==='dark','valid update after rejection');
 const saved=handle.serialize();handle.dispose();handle=null;check(host.children.length===0,'dispose removes host resources');
 handle=await createScene3D(host,{data:saved});await handle.whenReady({timeoutMs:20000});
 check(handle.serialize().map.theme==='dark'&&handle.serialize().map.overlays.length===0,'saved configuration recreates');
 out.textContent=lines.join('\n')+'\nALL PASS';
}catch(e){out.textContent=lines.join('\n')+'\nFAIL '+e;}finally{handle?.dispose();URL.revokeObjectURL(style);}
