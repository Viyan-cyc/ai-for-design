import {MapExperience, localToMercator, type MapFrameTarget, type MapExperienceOptions, type MapParameters} from '@a3d/a3d-components/map';
import * as THREE from 'three';
import type {CustomLayerInterface,CustomRenderMethodInput} from 'maplibre-gl';
interface MapPresentationState {theme:'light'|'dark';view:'2d'|'3d';pitch:number;overrides:Record<string,never>}
export interface ExperienceConfig {parameters?:Partial<MapParameters>;assets?:MapExperienceOptions['assets'];outside?:Parameters<MapExperience['setOutside']>[0]}
interface HostConfig {getMaxFps?:()=>number;styleUrl:string;origin:[number,number];center?:[number,number];zoom?:number;pitch?:number;bearing?:number;theme?:'light'|'dark';view?:'2d'|'3d';experience?:ExperienceConfig}

/** Generator bridge only: the component continues to own its map and appearance. */
export class ExperienceHost {
 readonly experience:MapExperience;readonly container:HTMLElement;readonly basis:THREE.Matrix4;
 private target?:MapFrameTarget;private gl?:WebGLRenderingContext|WebGL2RenderingContext;
 private dead=false;private timer?:ReturnType<typeof setTimeout>;private theme:'light'|'dark';
 private lastRequest=0;private getMaxFps:()=>number=()=>60;
 private matrix=new THREE.Matrix4();private readonly layerId='a3d-experience-models';
 private constructor(host:HTMLElement,config:HostConfig){
  this.getMaxFps=config.getMaxFps??(()=>60);this.container=host;this.basis=localToMercator(config.origin);this.theme=config.theme??'light';
  this.experience=new MapExperience({container:host,style:config.styleUrl,center:config.center??config.origin,zoom:config.zoom??16,pitch:config.pitch??45,bearing:config.bearing??0,theme:this.theme,mode:config.view??'3d',parameters:config.experience?.parameters,assets:config.experience?.assets});
 }
 static async create(host:HTMLElement,config:Parameters<typeof ExperienceHost.createInternal>[1]){return ExperienceHost.createInternal(host,config);}
 private static async createInternal(host:HTMLElement,config:HostConfig){
  const h=new ExperienceHost(host,config);
  try{await new Promise<void>((resolve,reject)=>{const clean=()=>{clearTimeout(timer);h.map.off('load',ready);h.map.off('error',fail);};const ready=()=>{clean();resolve();};const fail=(e:{error:Error})=>{clean();reject(e.error);};const timer=setTimeout(()=>{clean();reject(Error('地图加载超时'));},60000);h.map.on('load',ready);h.map.on('error',fail);if(h.map.loaded())ready();});h.install();h.map.on('style.load',h.install);return h;}catch(e){h.dispose();throw e;}
 }
 get map(){return this.experience.map;}
 get canvas(){return this.map.getCanvas();}
 get context(){if(!this.gl||this.dead)throw Error('地图未就绪');return this.gl;}
 private install=()=>{if(this.dead||this.map.getLayer(this.layerId))return;const layer:CustomLayerInterface={id:this.layerId,type:'custom',renderingMode:'3d',onAdd:(_map,gl)=>{this.gl=gl;},render:(_gl,input)=>this.render(input)};this.map.addLayer(layer);};
 private render(input:CustomRenderMethodInput){if(!this.target||this.dead)return;const {camera,draw}=this.target;camera.matrixAutoUpdate=false;camera.matrixWorldAutoUpdate=false;camera.projectionMatrix.fromArray(input.projectionMatrix);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.matrixWorldInverse.copy(camera.projectionMatrixInverse).multiply(this.matrix.fromArray(input.defaultProjectionData.mainMatrix)).multiply(this.basis);camera.matrixWorld.copy(camera.matrixWorldInverse).invert();camera.matrix.copy(camera.matrixWorld);camera.matrixWorld.decompose(camera.position,camera.quaternion,camera.scale);camera.fov=THREE.MathUtils.radToDeg(input.fov);draw();}
 setFrameTarget(target?:MapFrameTarget){this.target=target;if(target)this.map.moveLayer(this.layerId);this.requestFrame();}
 requestFrame=()=>{if(this.dead||this.timer!==undefined||document.hidden)return;const fps=this.getMaxFps();const interval=Number.isFinite(fps)&&fps>0?1000/fps:0;const delay=Math.max(0,interval-(performance.now()-this.lastRequest));this.timer=setTimeout(()=>{this.timer=undefined;if(!this.dead&&!document.hidden){this.lastRequest=performance.now();this.map.triggerRepaint();}},delay);};
 resize=(ratio:number)=>{if(this.dead)return;if(!Number.isFinite(ratio)||ratio<=0)throw Error('非法像素比');this.map.setPixelRatio(ratio);this.experience.resize();};
 getState():MapPresentationState {const v=this.experience.getView();return {theme:this.theme,view:v.mode,pitch:v.mode==='2d'?v.targetPitch:v.pitch,overrides:{}};}
 applyState(state:MapPresentationState){if(this.theme!==state.theme){this.experience.setTheme(state.theme);this.theme=state.theme;}this.experience.restoreView({...this.experience.getView(),mode:state.view,targetPitch:state.pitch,pitch:state.view==='2d'?0:state.pitch});}
 dispose(){if(this.dead)return;this.dead=true;clearTimeout(this.timer);this.target=undefined;this.map.off('style.load',this.install);this.experience.dispose();this.gl=undefined;}
}
