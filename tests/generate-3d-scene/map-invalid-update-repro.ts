import { MapRuntime } from '@a3d/a3d-components/map';
import { MapOverlays } from './src/scene3d/map/map-overlays';
const out=document.querySelector('#result')!;
const host=document.querySelector('#host') as HTMLElement;
const lines:string[]=[];
const check=(value:unknown,label:string)=>{if(!value)throw Error(label);lines.push('PASS '+label);out.textContent=lines.join('\n');};
let runtime:MapRuntime|undefined, overlays:MapOverlays|undefined;
const style=URL.createObjectURL(new Blob([JSON.stringify({version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#eee'}}]})],{type:'application/json'}));
try {
 runtime=await MapRuntime.create({host,style,origin:[121.49,31.23]});
 overlays=new MapOverlays(runtime.map,'light',{});
 overlays.replace([{id:'traffic',kind:'heat',options:{valueRange:[0,100]},data:[{id:'a',lng:121.49,lat:31.23,value:50}]}]);
 const before=overlays.snapshot(), source=runtime.map.getSource('a3d_heat_traffic:source');
 const bad=structuredClone(before); (bad[0].options as any).thresholds=[0.9,0.2,0.7,0.93];
 let rejected=false;try{overlays.replace(bad);}catch{rejected=true;}
 check(rejected,'invalid thresholds rejected');
 check(runtime.map.getSource('a3d_heat_traffic:source')===source,'preflight leaves original source intact');
 check(JSON.stringify(overlays.snapshot())===JSON.stringify(before),'invalid update preserves saved document');
 const batch=structuredClone(before);batch[0].data[0].value=90;batch.push({...bad[0],id:'second'});
 rejected=false;try{overlays.replace(batch);}catch{rejected=true;}
 check(rejected&&runtime.map.getSource('a3d_heat_traffic:source')===source,'invalid second layer rejected before first layer mutation');
 check(JSON.stringify(overlays.snapshot())===JSON.stringify(before),'invalid batch preserves snapshot');
 const changed=structuredClone(before);changed[0].data[0].value=90;changed.push({...structuredClone(before[0]),id:'second'});
 const add=runtime.map.addLayer.bind(runtime.map);let injected=false;
 runtime.map.addLayer=((layer:any,...args:any[])=>{if(layer.id==='a3d_heat_second'&&!injected){injected=true;throw Error('injected creation failure');}return (add as any)(layer,...args);}) as any;
 rejected=false;try{overlays.replace(changed);}catch{rejected=true;}finally{runtime.map.addLayer=add;}
 check(rejected&&injected,'runtime creation failure propagated');
 check(!!runtime.map.getLayer('a3d_heat_traffic')&&!runtime.map.getSource('a3d_heat_second:source'),'old layer restored and partial new source cleaned');
 check(JSON.stringify(overlays.snapshot())===JSON.stringify(before),'runtime failure restores saved document');
 const restored=await (runtime.map.getSource('a3d_heat_traffic:source') as any).getData();
 check(restored.features[0].properties.traffic===0.5,'old rendered source data restored');
 overlays.replace(changed);
 check(overlays.snapshot()[0].data[0].value===90&&!!runtime.map.getLayer('a3d_heat_second'),'valid update succeeds after failure');
 const saved=overlays.snapshot();overlays.dispose();overlays=new MapOverlays(runtime.map,'light',{});overlays.replace(saved);
 check(JSON.stringify(overlays.snapshot())===JSON.stringify(saved),'post-recovery save can recreate scene');
 out.textContent=lines.join('\n')+'\nALL PASS';
}catch(e){out.textContent=lines.join('\n')+'\nFAIL '+String(e);}finally{overlays?.dispose();runtime?.dispose();URL.revokeObjectURL(style);}
