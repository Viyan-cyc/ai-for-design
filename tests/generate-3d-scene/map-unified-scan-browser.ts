import { MapScene, MapSurfaceParticleScan } from '@a3d/a3d-components/map';
const out=document.querySelector('#result')!;
const host=document.createElement('div');host.style.cssText='width:900px;height:600px';document.body.append(host);
const assert=(v:unknown,m:string)=>{if(!v)throw Error(m);out.textContent+='PASS '+m+'\n';};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
let scene:MapScene|undefined,scan:MapSurfaceParticleScan|undefined;
try {
 const ring=[[-.0004,-.0004],[.0004,-.0004],[.0004,.0004],[-.0004,.0004],[-.0004,-.0004]];
 const style={version:8,sources:{buildings:{type:'geojson',data:{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}}]}}},layers:[{id:'bg',type:'background',paint:{'background-color':'#eeeeee'}},{id:'buildings',type:'fill-extrusion',source:'buildings',paint:{'fill-extrusion-height':60,'fill-extrusion-base':10,'fill-extrusion-color':'#aaaaaa'}}]};
 scene=await MapScene.create({host,style:'data:application/json,'+encodeURIComponent(JSON.stringify(style)),origin:[0,0],zoom:17,pitch:50,appearance:{layerMapping:[{category:'building',layerIds:['buildings']}]}});
 scan=new MapSurfaceParticleScan(scene,{enabled:true,radius:150,buildings:[{id:'box',rings:[[[-44,-44],[44,-44],[44,44],[-44,44],[-44,-44]]],bottom:10,top:60}]});
 await wait(800);
 const stats=scan.getStats();assert(stats.count>0&&!stats.warnings.some(s=>s.includes('ground scan only')),'完整建筑数据参与采样');
 // Inspect actual GPU geometry in this maintenance test, not only a count including the ground.
 const geometry=(scan as any).points.geometry;
 assert(Array.from(geometry.getAttribute('kind').array as Float32Array).some(v=>v>.5),'包含建筑粒子而非仅地面');
 assert(scene.context.getError()===0,'统一地图与扫光共享GL无错误');
 let frames=0;scene.map.on('render',()=>frames++);
 scan.setOptions({paused:true});await wait(400);const paused=frames;await wait(250);assert(frames===paused,'暂停后停止额外绘制');
 scene.setTheme('dark');await wait(200);assert(scene.getState().theme==='dark','扫光存在时主题切换正常');
 scan.dispose();scan.dispose();scan=undefined;assert(!scene.map.getLayer('a3d-surface-scan'),'扫光独立释放');
 assert(!!scene.map.getLayer('buildings'),'关闭扫光保留建筑');
 scene.dispose();scene.dispose();scene=undefined;assert(host.children.length===0,'地图重复释放清理画布');
 out.textContent+='ALL PASS';
} catch(e) {out.textContent+='FAIL '+e;} finally {scan?.dispose();scene?.dispose();host.remove();}
