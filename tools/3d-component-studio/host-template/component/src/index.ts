import {Group,Mesh,EdgesGeometry,LineBasicMaterial,LineSegments,Matrix4,type Object3D} from 'three';
import {normalize,type HighlightOptions,type AnimationMode} from './parameters';
export {controls,defaults,normalize,animationMode} from './parameters';export type {HighlightOptions,AnimationMode} from './parameters';
export interface HighlightHost { 
 /** 挂载效果的宿主根节点。 */
 root:Object3D; 
 /** 需要描边的普通Mesh集合；资源仍由宿主所有。 */
 targets:readonly Mesh[]; 
 /** 通知宿主重新渲染。 */
 invalidate:()=>void }
/** 为现有Mesh添加可开关的轮廓高亮，保留宿主几何与材质。
 * @remarks 仅支持普通Three Mesh。宿主变换后调用syncTargets；几何拓扑变化时需重建效果。动画模式下由宿主按秒调用tick；静态模式无需动画循环。
 * @example
 * const effect = new HostHighlight({root:scene, targets:buildings, invalidate});
 * effect.setOptions({enabled:false});
 * effect.dispose();
 */
export class HostHighlight {
 private readonly host:HighlightHost;private readonly group=new Group();private readonly lines:LineSegments[]=[];private readonly targets:readonly Mesh[];
 private readonly material:LineBasicMaterial;private options=normalize();private disposed=false;private elapsed=0;private playing=false;
 /** 动画模式：none为静态，pulse为脉冲。 */
 readonly animation:AnimationMode;
 constructor(host:HighlightHost,options:HighlightOptions={},animation:AnimationMode='none'){
  if(!host?.root?.isObject3D||!Array.isArray(host.targets)||!host.targets.every(x=>x?.isMesh)||typeof host.invalidate!=='function')throw Error('宿主接口无效');
  if(!['none','pulse'].includes(animation))throw Error('动画模式无效');
  normalize(options);this.host=host;this.targets=[...host.targets];this.animation=animation;
  this.material=new LineBasicMaterial({transparent:true,depthTest:true,depthWrite:false});
  for(const target of this.targets){const line=new LineSegments(new EdgesGeometry(target.geometry),this.material);line.matrixAutoUpdate=false;this.group.add(line);this.lines.push(line);}
  host.root.add(this.group);this.setOptions(options);this.syncTargets();
 }
 private assertLive(){if(this.disposed)throw Error('效果已释放');}
 /** 更新指定效果参数，未传字段保留当前值。 */
 setOptions(value:HighlightOptions){this.assertLive();normalize(value);this.options=normalize({...this.options,...value});this.group.visible=this.options.enabled;this.paint();this.host.invalidate();}
 /** 返回当前配置副本。 */
 getOptions(){return {...this.options};}
 /** 同步目标的世界变换，不重建几何。 */
 syncTargets(){this.assertLive();this.host.root.updateWorldMatrix(true,true);const inverse=new Matrix4().copy(this.host.root.matrixWorld).invert();for(let i=0;i<this.lines.length;i++){this.targets[i].updateWorldMatrix(true,false);this.lines[i].matrix.multiplyMatrices(inverse,this.targets[i].matrixWorld);this.lines[i].matrixWorldNeedsUpdate=true;}this.host.invalidate();}
 private paint(){this.material.color.set(this.options.color);const wave=this.animation==='pulse'?(.2+.8*Math.sin(Math.PI*Math.min(1,this.elapsed/this.options.duration))):1;this.material.opacity=this.options.opacity*wave;}
 /** 继续动画；静态模式无操作。 */
 play(){this.assertLive();if(this.animation==='none')return;this.playing=true;this.host.invalidate();}
 /** 暂停动画并保留进度。 */
 pause(){this.assertLive();this.playing=false;this.host.invalidate();}
 /** 从起点重播；静态模式无操作。 */
 restart(){this.assertLive();if(this.animation==='none')return;this.elapsed=0;this.playing=true;this.paint();this.host.invalidate();}
 /** 推进动画，dt单位为秒；返回是否仍在播放。 */
 tick(dt:number){this.assertLive();if(!Number.isFinite(dt)||dt<0)throw Error('dt须为非负秒数');if(this.animation==='none'||!this.playing||!this.options.enabled)return false;
  this.elapsed+=dt;if(this.elapsed>=this.options.duration){if(this.options.loop)this.elapsed%=this.options.duration;else{this.elapsed=this.options.duration;this.playing=false;}}this.paint();return this.playing;
 }
 /** 返回动画模式、播放进度和开关状态。 */
 getState(){return {animation:this.animation,playing:this.playing,elapsed:this.elapsed,enabled:this.options.enabled};}
 /** 移除并释放效果自身资源，保留借用的宿主Mesh；可重复调用。 */
 dispose(){if(this.disposed)return;this.disposed=true;this.playing=false;this.group.removeFromParent();for(const line of this.lines)line.geometry.dispose();this.material.dispose();this.group.clear();this.host.invalidate();}
}
