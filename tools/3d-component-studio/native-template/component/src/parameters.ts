export interface ComponentOptions { 
 /** 立方体边长，世界单位，范围0.5–2。 */
 size?: number; 
 /** 六位十六进制颜色。 */
 color?: string; 
 /** 对象名称。 */
 name?: string; 
 /** 对象是否可见。 */
 visible?: boolean; 
 /** 附加业务数据。 */
 userData?: Record<string, unknown> }
export const defaults = Object.freeze({size:1,color:'#45b8ff'});
export const controls = Object.freeze([
 {key:'size',type:'range',label:'尺寸',unit:'世界单位',min:.5,max:2,step:.1},
 {key:'color',type:'color',label:'颜色',unit:'sRGB'}
]);
export function normalize(value: ComponentOptions = {}) {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['size','color','name','visible','userData'].includes(k)))throw Error('无效或未知组件参数');
 if(value.name!==undefined&&typeof value.name!=='string')throw Error('name须为文本');
 if(value.visible!==undefined&&typeof value.visible!=='boolean')throw Error('visible须为布尔值');
 if(value.userData!==undefined&&(!value.userData||typeof value.userData!=='object'||Array.isArray(value.userData)))throw Error('userData须为对象');
 const p={...defaults,...value};
 if(!Number.isFinite(p.size)||p.size<.5||p.size>2)throw Error('尺寸范围为0.5–2');
 if(typeof p.color!=='string'||!/^#[0-9a-f]{6}$/i.test(p.color))throw Error('颜色须为六位十六进制');
 return p;
}
