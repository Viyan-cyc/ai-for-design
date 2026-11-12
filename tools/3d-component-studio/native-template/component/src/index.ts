import {Group,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {normalize,type ComponentOptions} from './parameters';
export {defaults,controls,normalize} from './parameters';
export type {ComponentOptions} from './parameters';
/** 可调尺寸和颜色的立方体对象。
 * @remarks 相机、灯光和渲染器由宿主提供。移出场景且不再使用时调用dispose释放资源。
 * @example
 * import { AuthoredComponent } from '@a3d/a3d-components/core';
 * const component = new AuthoredComponent({size: 1.5});
 * scene.add(component);
 * component.setOptions({color: '#aabbcc'});
 * component.dispose();
 */
export class AuthoredComponent extends Group {
 private readonly mesh: Mesh<BoxGeometry,MeshStandardMaterial>;
 private disposed=false;
 private options=normalize();
 constructor(options: ComponentOptions={}) {
  super();this.mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());this.add(this.mesh);this.setOptions(options);
 }
 /** 更新指定参数；未传字段保持当前值。尺寸改变几何缩放，颜色改变材质颜色。 */
 setOptions(options: ComponentOptions) {
  if(this.disposed)throw Error('组件已释放');
  normalize(options);
  const next=normalize({...this.options,...options});this.options=next;
  this.mesh.scale.setScalar(next.size);this.mesh.material.color.set(next.color);
  if(next.name!==undefined)this.name=next.name;
  if(next.visible!==undefined)this.visible=next.visible;
  if(next.userData!==undefined)this.userData={...next.userData};
 }
 /** 返回当前配置的副本。 */
 getOptions(){return {...this.options};}
 /** 从父节点移除并释放自身几何和材质；可重复调用，释放后不可再调参。 */
 dispose(){if(this.disposed)return;this.disposed=true;this.removeFromParent();this.remove(this.mesh);this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
