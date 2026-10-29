import * as THREE from 'three';
import type { SceneEngine } from '../../scene-core';
import type { SceneNode } from '../../scene-core/types';
import { handlerUtils } from '../../scene-core/handlers';
import { createComposite } from '../../scene-core/handlers/procedural/composite';

// A small shared palette. Each building, tree, car and fixture remains a scene node.
const palette: Record<string, THREE.MeshStandardMaterial> = {};
const colors: Record<string, string> = {
  ivory:'#f3f4f3', white:'#fafbf9', silver:'#c6d6e3', glass:'#a4b7c1',
  dark:'#54758d', road:'#95a4b0', line:'#ffffff', paving:'#d2d9df',
  grass:'#a2ceb5', hedge:'#71ad91', leaf:'#69b295', leaf2:'#93cdb0',
  trunk:'#a6a196', water:'#72c9ed', roof:'#d2dfea', panel:'#8cb6d4',
  yellow:'#e4cfab', red:'#d99b91', blue:'#7cb4db', base:'#cad9e5',
};
function material(key: string) {
  return palette[key] ??= new THREE.MeshStandardMaterial({
    color: colors[key] ?? key, roughness:key==='glass'?0.3:key==='water'?0.28:0.72,
    metalness:key==='glass'?0.08:key==='silver'?0.18:0,
  });
}
function assemble(node: SceneNode) {
  const b=createComposite();
  const slots=new Map<string, ReturnType<typeof b.batchSlot>>();
  const part=(key:string,geo:THREE.BufferGeometry,x:number,y:number,z:number,rotation?:[number,number,number])=>{
    let slot=slots.get(key);
    if(!slot){slot=b.batchSlot(key,material(key));slots.set(key,slot);}
    slot.add(geo,{position:[x,y,z],rotation});
  };
  const box=(key:string,w:number,h:number,d:number,x=0,y=h/2,z=0)=>part(key,new THREE.BoxGeometry(w,h,d),x,y,z);
  const cylinder=(key:string,rt:number,rb:number,h:number,x:number,y:number,z:number)=>part(key,new THREE.CylinderGeometry(rt,rb,h,12),x,y,z);
  const p=node.params ?? {};
  const num=(key:string,fallback:number)=>typeof p[key]==='number'?p[key] as number:fallback;
  const kind=String(p.kind ?? 'office'),w=num('w',20),d=num('d',18),h=num('h',20);

  if(kind==='site') {
    box('base',328,2.8,266,0,-1.5,0);
    box('paving',320,0.3,258,0,0.05,0);
    // Narrow perimeter landscape, with a deliberate break at the south entrance.
    box('grass',318,0.24,5,0,0.32,-125);
    for(const x of [-156,156])box('grass',5,0.24,246,x,0.32,0);
    for(const x of [-86,86])box('grass',137,0.24,5,x,0.32,125);
  } else if(kind==='road') {
    box('road',w,0.12,d,0,0.3,0);
    const long=Math.max(w,d),horizontal=w>d;
    for(let t=-long/2+5;t<long/2-3;t+=9) {
      // Keep intersections free of lane markings.
      const world=horizontal?t+(node.position?.[0]??0):t+(node.position?.[2]??0);
      if(horizontal&&Math.abs(Math.abs(world)-75)<9)continue;
      part('line',new THREE.BoxGeometry(horizontal?4:0.16,0.025,horizontal?0.16:4),horizontal?t:0,0.375,horizontal?0:t);
    }
    if(horizontal){box('paving',w,0.17,1.5,0,0.36,-d/2-0.75);box('paving',w,0.17,1.5,0,0.36,d/2+0.75);}
    else {box('paving',1.5,0.17,d,-w/2-0.75,0.36,0);box('paving',1.5,0.17,d,w/2+0.75,0.36,0);}
  } else if(kind==='crossing') {
    for(let x=-4;x<=4;x+=1.5)box('line',0.75,0.025,4,x,0.39,0);
  } else if(kind==='lawn') {
    box('grass',w,0.23,d,0,0.35,0);
    box('silver',w+0.5,0.16,d+0.5,0,0.2,0);
  } else if(kind==='pool') {
    box('white',w+1.2,0.55,d+1.2,0,0.45,0);
    box('water',w,0.08,d,0,0.74,0);
    for(let x=-w/2+1;x<w/2;x+=2.8)box('silver',0.06,0.02,d-0.4,x,0.79,0);
  } else if(kind==='landmark') {
    box('paving',w+7,0.45,d+7,0,0.5,0);
    // One continuous curtain-wall envelope. Opaque piers frame it without stacked boxes.
    box('glass',w,h,d,0,h/2+0.75,0);
    for(const x of [-w/2,w/2])box('white',1.1,h+0.8,d+0.6,x,h/2+0.75,0);
    const bays=Math.max(2,Math.round((w-2)/4));
    for(let i=1;i<bays;i++) {
      const x=-w/2+1+i*(w-2)/bays;
      for(const z of [-d/2-0.18,d/2+0.18])box('silver',0.15,h,0.22,x,h/2+0.75,z);
    }
    for(let y=4.5;y<h;y+=3.6) {
      for(const z of [-d/2-0.14,d/2+0.14])box('silver',w-1,0.13,0.18,0,y,z);
      for(const x of [-w/2-0.14,w/2+0.14])box('silver',0.18,0.13,d, x,y,0);
    }
    box('white',w+1.4,0.6,d+1.2,0,h+1,0);
    box('roof',w-2,0.15,d-2,0,h+1.4,0);
    box('silver',6,1.2,4,0,h+2.1,-3);
    box('white',14,0.4,6,0,4.7,d/2+1.8);
    for(const x of [-5,5])box('silver',0.2,4,0.2,x,2.5,d/2+4.5);
  } else if(kind==='office'||kind==='research') {
    box('paving',w+7,0.45,d+7,0,0.5,0);
    box('ivory',w,h,d,0,h/2+0.75,0);
    // Identical spacing on each facade, with visible solid wall between windows.
    // Positive separation from the wall avoids coincident faces and flickering.
    const rows=Math.max(1,Math.floor((h-2)/3.6));
    const facade=(length:number,side:boolean)=>{
      const count=Math.max(2,Math.floor((length-2)/3.8));
      const bay=(length-2)/count;
      for(let row=0;row<rows;row++)for(let col=0;col<count;col++) {
        const offset=-length/2+1+bay*(col+0.5);
        const y=2.5+row*3.6;
        for(const sign of [-1,1]) {
          if(side)box('glass',0.12,2.15,bay-0.8,sign*(w/2+0.13),y,offset);
          else box('glass',bay-0.8,2.15,0.12,offset,y,sign*(d/2+0.13));
        }
      }
    };
    facade(w,false); facade(d,true);
    box('white',w+0.6,0.45,d+0.6,0,h+0.9,0);
    box('roof',w-1.2,0.15,d-1.2,0,h+1.2,0);
    // Entrance glazing is a separate ground-floor bay, below the upper window rows.
    box('dark',5.5,2.8,0.18,0,2.05,d/2+0.25);
    box('white',8,0.3,3.5,0,3.65,d/2+1.5);
    box('silver',4.5,1,2.5,0,h+1.8,-d/4);
    if(kind==='research')box('panel',w-8,0.18,3,0,h+1.5,d/4);
  } else if(kind==='hall'||kind==='warehouse') {
    box('paving',w+6,0.3,d+6,0,0.45,0);
    box('ivory',w,h,d,0,h/2+0.6,0);
    box('silver',w+1.6,0.65,d+1.6,0,h+0.85,0);
    box('roof',w,0.18,d,0,h+1.26,0);
    for(let x=-w/2+2;x<w/2;x+=4){
      box('white',0.18,h,0.3,x,h/2+0.6,d/2+0.16);
      box('white',0.18,h,0.3,x,h/2+0.6,-d/2-0.16);
    }
    box('glass',w-2,1.35,0.2,0,h-1.4,d/2+0.19);
    for(let x=-w/2+5;x<w/2-3;x+=9){
      box('dark',4,4.2,0.2,x,2.7,d/2+0.3);
      for(let y=1.1;y<4.7;y+=0.55)box('silver',3.7,0.12,0.25,x,y,d/2+0.45);
      box('white',5,0.25,2.5,x,5,d/2+1.2);
      box('yellow',0.25,1.2,0.25,x-2.4,1.1,d/2+1.4);
      box('yellow',0.25,1.2,0.25,x+2.4,1.1,d/2+1.4);
    }
    for(const x of [-w/4,w/4])
      box(kind==='hall'?'panel':'glass',w/3,0.25,d/2,x,h+1.5,0);
  } else if(kind==='tree') {
    const size=num('size',1);
    cylinder('trunk',0.2*size,0.3*size,2.5*size,0,1.6*size,0);
    part('leaf',new THREE.IcosahedronGeometry(2.1*size,1),0,4.1*size,0);
    part('leaf2',new THREE.IcosahedronGeometry(1.6*size,1),0.65*size,4.8*size,0.2*size);
    cylinder('paving',1.25*size,1.25*size,0.2,0,0.4,0);
  } else if(kind==='car'||kind==='truck') {
    const truck=kind==='truck';
    box(String(p.paint??'blue'),truck?2.5:1.9,truck?1.3:0.75,truck?7:4.5,0,truck?1.1:0.85,0);
    box('glass',truck?2.2:1.65,truck?1.2:0.65,truck?1.8:2.45,0,truck?2.1:1.5,truck?2.2:-0.1);
    if(truck)box('white',2.5,2.5,4.7,0,2.3,-1.1);
    for(const x of [-0.95,0.95])for(const z of [-1.4,1.4])part('dark',new THREE.CylinderGeometry(0.39,0.39,0.22,12),x,0.58,z,[0,0,Math.PI/2]);
    box('line',1.5,0.15,0.08,0,0.95,truck?3.52:2.27);
  } else if(kind==='parking') {
    box('road',w,0.12,d,0,0.3,0);
    for(let x=-w/2+1;x<w/2;x+=3)for(const z of [-d/2+3,d/2-3])box('line',0.1,0.025,5.1,x,0.38,z);
    for(const z of [-d/2+0.45,d/2-0.45])box('line',w-1,0.025,0.1,0,0.38,z);
  } else if(kind==='energy') {
    box('paving',w,0.4,d,0,0.5,0);
    for(const x of [-6,0,6]) {
      box('silver',3.2,3.5,4.5,x,2.4,0);
      for(let z=-1.9;z<2;z+=0.4)box('dark',3.6,2.4,0.12,x,2,z);
      for(const dx of [-0.85,0.85])cylinder('dark',0.18,0.25,1.4,x+dx,4.7,0);
    }
    for(let x=-w/2;x<=w/2;x+=3)box('silver',0.12,2.2,0.12,x,1.6,-d/2);
    box('silver',w,0.12,0.12,0,2.6,-d/2);
    for(const x of [-w/2,w/2])box('silver',0.12,0.12,d,x,2.6,0);
  } else if(kind==='bench') {
    box('yellow',2.4,0.18,0.65,0,0.9,0);
    box('yellow',2.4,0.55,0.12,0,1.25,-0.3);
    for(const x of [-0.9,0.9])box('dark',0.16,0.55,0.6,x,0.55,0);
  } else if(kind==='lamp') {
    cylinder('silver',0.09,0.15,6,0,3.3,0);
    box('silver',1.7,0.12,0.2,0.65,6.3,0);
    box('white',0.8,0.15,0.45,1.1,6.2,0);
  } else if(kind==='gate') {
    box('ivory',7,3.5,5,0,2.05,0);
    box('glass',6.5,1.7,0.12,0,2.4,2.55);
    box('dark',8.5,0.35,6.5,0,3.95,0);
    box('silver',0.3,1,0.3,6,0.9,0);
    box('line',7,0.15,0.2,9,1.35,0);
  }
  const root=b.finish();
  root.traverse(object=>{
    if(object instanceof THREE.Mesh) {
      const architecture=['landmark','office','research','hall','warehouse'].includes(kind);
      // Fine facade pieces must not cast coarse shadow-map stripes onto adjacent glazing.
      object.castShadow=architecture
        ? object.name===(kind==='landmark'?'glass':'ivory')
        : !['site','road','crossing','lawn','parking','pool'].includes(kind);
      object.receiveShadow=architecture ? ['roof','paving'].includes(object.name) : true;
    }
  });
  handlerUtils.applyTransform(root,node);
  return root;
}
export function registerCampus(engine:SceneEngine):void {
  engine.registerFactory('campus',{create:assemble,update(){return 'rebuild';}});
}
