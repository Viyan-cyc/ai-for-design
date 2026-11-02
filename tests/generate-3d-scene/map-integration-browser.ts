import { MapRuntime } from '@a3d/a3d-components/map';
import { createScreenLabel } from '@a3d/a3d-components/labels';
import * as THREE from 'three';
import {Bridge} from './src/edit/Bridge';
import {createScene3D} from './src/scene3d/create-scene';
import {localToMercator} from './src/scene3d/map/create-map-scene';
const output=document.querySelector('#result')!;
const host=document.querySelector('#host') as HTMLElement;
const lines:string[]=[];
const assert=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);lines.push('PASS '+message);output.textContent=lines.join('\n');};
const frame=(h:any)=>new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('frame timeout')),10000);const off=h.internals.renderLoop.onAfterFrame(()=>{clearTimeout(timeout);off();resolve();});h.internals.renderLoop.invalidate();});
let handle:any;
try {
 const data=await (await fetch('/scene3d/scene-data.json')).json();
 data.map.overlays=[]; // P1 baseline independent of optional P2 maintenance demo data.
 data.Box[0].position=[0,15,0]; data.map.theme='light';data.map.view='3d';data.map.pitch=45;
 handle=await createScene3D(host,{data});
 await handle.whenReady({timeoutMs:20000});await frame(handle);
 assert(handle.getDiagnostics().firstFrame,'真实 WebGL 首帧');
 assert(handle.internals.rendererEngine.renderer.getContext().getError()===0,'共享上下文无 GL 错误');
 assert(handle.getDiagnostics().failedAssets.length===0,'GLB 实际加载');
 const label=createScreenLabel({text:'测试标签'});label.position.set(0,35,0);handle.internals.scene.add(label);
 for (const zoom of [15,17]) {
   handle.update({map:{...handle.serialize().map,zoom}});await frame(handle);
   const c=handle.internals.camera, rect=handle.internals.canvas.getBoundingClientRect();
   const v=new THREE.Vector4(...label.getWorldPosition(new THREE.Vector3()).toArray(),1).applyMatrix4(c.matrixWorldInverse);
   const centerClip=v.clone().applyMatrix4(c.projectionMatrix),size=label.getWorldScale(new THREE.Vector3());
   const edge=v.clone();edge.x+=size.x;edge.applyMatrix4(c.projectionMatrix);
   assert(Math.abs((edge.x/edge.w-centerClip.x/centerClip.w)*rect.width/2-180)<0.01,'共享地图相机标签 180 CSS px，zoom '+zoom);
 }
 label.dispose();
 handle.update({map:{...handle.serialize().map,zoom:data.map.zoom??16}});await frame(handle);

 const camera=handle.internals.camera;
 const rect=handle.internals.canvas.getBoundingClientRect();
 const center=new THREE.Vector3(0,15,0).project(camera);
 const hit=handle.pick(rect.x+(center.x+1)*rect.width/2,rect.y+(1-center.y)*rect.height/2);
 assert(hit?.id==='editable_equipment','投影与屏幕拾取一致');
 const local=new THREE.Vector3(100,20,-50), basis=localToMercator(data.map.origin);
 assert(local.clone().applyMatrix4(basis).applyMatrix4(basis.clone().invert()).distanceTo(local)<1e-6,'米制坐标往返');
 handle.update({Box:[{id:'editable_equipment',position:[10,15,0]}]});await frame(handle);
 const saved=handle.serialize();assert(saved.Box[0].position[0]===10,'编辑变换已序列化');
 const next={...saved.map,theme:'dark',view:'2d',pitch:0};
 handle.update({map:next});await frame(handle);
 assert(handle.serialize().map.theme==='dark'&&handle.serialize().map.view==='2d','主题与二维视角保存');
 for(const ratio of [0.75,1.25,1]) {handle.update({renderer:{pixelRatio:ratio}});await frame(handle);assert(Math.abs(handle.internals.canvas.width/rect.width-ratio)<0.01,'DPR '+ratio);}
 for (const enabled of [true,false,true]) {handle.update({renderer:{shadowMapEnabled:enabled,shadowMap:'PCF',shadowMapSize:512}});await frame(handle);assert(handle.internals.rendererEngine.renderer.getContext().getError()===0,'阴影切换 '+enabled);}
 const bridge=new Bridge(handle);
 assert(handle.surfaces.list().filter((item:any)=>!item.parentId).length===5,'五类地图整体条目');
 bridge.selectSurface('building');
 assert(bridge.getState().selectedSurface==='building'&&bridge.selectedIds.length===0,'地图选择不产生伪模型或变换手柄');
 const beforeColor=handle.serialize().map;
 const colorFrame=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('颜色修改未主动重绘')),5000);const off=handle.internals.renderLoop.onAfterFrame(()=>{clearTimeout(timer);off();resolve();});});
 bridge.commit('建筑颜色',()=>handle.surfaces.update('building',{color:'#ff8800',visible:false}));
 await colorFrame;
 assert(true,'颜色修改主动绘制，无额外点击或 invalidate');
 const afterColor=handle.serialize().map;
 assert(JSON.stringify(beforeColor.center)===JSON.stringify(afterColor.center)&&beforeColor.zoom===afterColor.zoom&&beforeColor.pitch===afterColor.pitch,'调色保留地图视角');
 assert(handle.serialize().map.surfaces.building.color==='#ff8800'&&!handle.surfaces.list()[0].visible,'整体外观保存');
 bridge.undo();
 assert(!handle.serialize().map.surfaces.building,'撤销整体外观');
 bridge.redo();
 assert(handle.serialize().map.surfaces.building.color==='#ff8800','重做整体外观');
 const child=handle.surfaces.list().find((item:any)=>item.parentId==='road');
 assert(child,'道路存在实际子项');
 bridge.selectSurface(child.id);
 bridge.commit('道路子项',()=>handle.surfaces.update(child.id,{color:'#cc3344'}));
 assert(handle.serialize().map.surfaces[child.id].color==='#cc3344','子项单独编辑与保存');
 bridge.undo();assert(!handle.serialize().map.surfaces[child.id],'子项撤销');
 bridge.commit('锁定建筑',()=>handle.surfaces.update('building',{locked:true}));
 let blocked=false;try{handle.surfaces.update('building',{color:'#ffffff'});}catch{blocked=true;}
 assert(blocked&&handle.serialize().map.surfaces.building.locked,'锁定禁止编辑并保存');
 bridge.undo();assert(!handle.surfaces.list()[0].locked,'撤销锁定');
 bridge.redo();assert(handle.surfaces.list()[0].locked,'重做锁定');
 bridge.select('editable_equipment',false);
 assert(bridge.getState().selectedSurface===null,'选模型清除整体条目选择');
 bridge.dispose();
 const roundtrip=handle.serialize();handle.dispose();handle=null;
 assert(host.querySelectorAll('canvas').length===0,'销毁清理地图画布');
 assert(document.querySelectorAll('[id^="scene3d-map-shadow-"]').length===0,'销毁清理投影画布');
 handle=await createScene3D(host,{data:roundtrip});await handle.whenReady({timeoutMs:20000});await frame(handle);
 assert(handle.serialize().Box[0].position[0]===10,'重建恢复编辑位置');
 assert(handle.surfaces.list()[0].locked,'重建恢复锁定');
 assert(handle.serialize().map.surfaces.building.color==='#ff8800'&&!handle.surfaces.list()[0].visible,'重建恢复整体颜色和显隐');
 assert(handle.serialize().map.theme==='dark'&&handle.serialize().map.view==='2d','重建恢复地图状态');
 assert(handle.internals.rendererEngine.renderer.getContext().getError()===0,'重建后无 GL 错误');
 handle.dispose();handle=null;
 let rejected=false;
 try { await MapRuntime.create({host,style:'data:application/json,%7B',origin:[121,31],loadTimeoutMs:3000}); }
 catch { rejected=true; }
 assert(rejected&&host.children.length===0,'地图初始化失败释放容器与画布');
 const runtime=await MapRuntime.create({host,style:'data:application/json,'+encodeURIComponent(JSON.stringify({version:8,sources:{},layers:[]})),origin:[121,31]});
 runtime.requestFrame();runtime.dispose();runtime.dispose();runtime.requestFrame();
 assert(host.children.length===0,'独立地图重复释放及销毁后重绘安全');
 lines.push('ALL PASS');output.textContent=lines.join('\n');
} catch(error){handle?.dispose();output.textContent=lines.join('\n')+'\nFAIL '+String(error);}
