// Library-only adapter. @component/@parameters are resolved by intake, not the authoring preview.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {controls, defaults, animationMode} from '@parameters';
import {HostHighlight} from '@component';
export function initDemo(canvas:HTMLCanvasElement,ctrl:HTMLElement){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e8edf3');
 const camera=new THREE.PerspectiveCamera(45,1,.1,100);camera.position.set(4,3,5);
 const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,.5,0);orbit.update();
 scene.add(new THREE.HemisphereLight(0xffffff,0x667788,3));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(3,7,4);scene.add(sun);
 let disposed=false;
 const render=()=>{if(!disposed)renderer.render(scene,camera);};
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.5,1.5),new THREE.MeshStandardMaterial({color:'#a5b4c4'}));mesh.position.y=.75;scene.add(mesh);const component=new HostHighlight({root:scene,targets:[mesh],invalidate:render},{...defaults},animationMode);
 let frame=0,last=0;
 if(animationMode==='pulse'){
  component.restart();
  const tick=(time:number)=>{if(disposed)return;component.tick(last?Math.min(.1,(time-last)/1000):0);last=time;render();frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
  for(const [label,action] of [['暂停',()=>component.pause()],['继续',()=>component.play()],['重播',()=>component.restart()]] as const){const button=document.createElement('button');button.textContent=label;button.onclick=action;ctrl.append(button);}
 }
 const fields=new Map<string,HTMLInputElement>();
 const sync=()=>{const current=component.getOptions() as Record<string,unknown>;for(const [key,input] of fields){if(input.type==='checkbox')input.checked=Boolean(current[key]);else input.value=String(current[key]);const output=input.parentElement!.querySelector('output')!;output.textContent=String(current[key]);}canvas.dataset.options=JSON.stringify(current);render();};
 for(const control of controls){
  const c=control as {key:string;type:string;label:string;unit?:string;min?:number;max?:number;step?:number};
  if(!['range','color','checkbox'].includes(c.type))throw Error('请为控件实现Demo适配：'+c.type);
  const row=document.createElement('label');row.style.cssText='display:block;margin-bottom:12px';
  const title=document.createElement('span');title.textContent=c.label+(c.unit?' ('+c.unit+')':'')+'：';
  const output=document.createElement('output'),input=document.createElement('input');input.type=c.type;input.dataset.key=c.key;input.setAttribute('aria-label',c.label);input.style.width=c.type==='checkbox'?'auto':'100%';
  for(const k of ['min','max','step'] as const)if(c[k]!==undefined)input[k]=String(c[k]);
  input.oninput=()=>{try{component.setOptions({[c.key]:input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value});sync();}catch(e){sync();throw e;}};
  row.append(title,output,input);ctrl.append(row);fields.set(c.key,input);
 }
 const reset=document.createElement('button');reset.textContent='恢复默认';reset.onclick=()=>{component.setOptions({...defaults});sync();};ctrl.append(reset);
 const resize=()=>{const box=canvas.parentElement!.getBoundingClientRect();renderer.setSize(box.width,box.height,false);camera.aspect=box.width/Math.max(1,box.height);camera.updateProjectionMatrix();render();};
 const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement!);orbit.addEventListener('change',render);resize();sync();
 return ()=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();orbit.removeEventListener('change',render);orbit.dispose();component.dispose();mesh.geometry.dispose();mesh.material.dispose(); renderer.dispose();renderer.forceContextLoss();for(const input of fields.values())input.oninput=null;reset.onclick=null;ctrl.replaceChildren();canvas.dataset.disposed='true';};
}
