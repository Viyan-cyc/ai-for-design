/** Tiny deterministic GLB used by maintenance tests; never distributed as an asset. */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
export function triangleGlb(nested=false) {
 const bin=Buffer.from(new Float32Array([-0.5,0,0,0.5,0,0,0,1,0]).buffer);
 const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'body',mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{name:'surface',doubleSided:true}],buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:bin.length,target:34962}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-0.5,0,0],max:[0.5,1,0]}]};
 if(nested){json.nodes=[{name:'assembly',children:[1]},{name:'part',mesh:0}];}
 const raw=Buffer.from(JSON.stringify(json)),text=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,0x20)]),head=Buffer.alloc(20),bh=Buffer.alloc(8);
 head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+text.length+bin.length,8);head.writeUInt32LE(text.length,12);head.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([head,text,bh,bin]);
}
export function seedLibrary(root) {
 mkdirSync(join(root,'assets/models'),{recursive:true});mkdirSync(join(root,'assets/manifests'),{recursive:true});
 const ids=['example','person','rack'];for(const id of ids)writeFileSync(join(root,'assets/models',id+'.glb'),triangleGlb());
 writeFileSync(join(root,'assets/manifests/test.json'),JSON.stringify({entries:ids.map(id=>({id,name:id,format:'glb',modelPath:`assets/models/${id}.glb`}))}));return root;
}
export const pixelPNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=','base64');

export function seedProject(project) {
 const dir=join(project,'public/scene3d/assets/models');mkdirSync(dir,{recursive:true});
 writeFileSync(join(dir,'example.glb'),triangleGlb());writeFileSync(join(dir,'person.glb'),triangleGlb(true));
 const scenePath=join(project,'public/scene3d/scene-data.json');const data=JSON.parse(readFileSync(scenePath,'utf8'));
 data.examples=[{id:'example_01',params:{assetId:'example'}},{id:'person_01',params:{assetId:'person'}}];data.cars=[{id:'car_01',params:{assetId:'example'}},{id:'car_02',params:{assetId:'example'}}];
 writeFileSync(scenePath,JSON.stringify(data));
 writeFileSync(join(project,'public/scene3d/assets/asset-manifest.json'),JSON.stringify({example:{model:'models/example.glb',format:'glb'},person:{model:'models/person.glb',format:'glb'}}));
}
