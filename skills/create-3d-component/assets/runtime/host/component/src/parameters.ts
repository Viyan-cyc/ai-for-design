export type AnimationMode = 'none' | 'pulse';
export interface HighlightOptions { 
 /** 是否显示轮廓高亮。 */
 enabled?: boolean; 
 /** 六位十六进制颜色。 */
 color?: string; 
 /** 亮度比例，范围0–1。 */
 opacity?: number; 
 /** 脉冲周期，单位秒，范围0.2–10。 */
 duration?: number; 
 /** 动画是否循环。 */
 loop?: boolean }
export const animationMode: AnimationMode='__ANIMATION__';
export const defaults=Object.freeze({enabled:true,color:'#3d7eff',opacity:1,duration:2,loop:false});
export const controls=[{key:'enabled',type:'checkbox',label:'显示效果',unit:''},{key:'color',type:'color',label:'颜色',unit:'sRGB'},{key:'opacity',type:'range',label:'亮度',unit:'比例',min:0,max:1,step:.05},...(String(animationMode)==='pulse'?[{key:'duration',type:'range',label:'周期',unit:'秒',min:.2,max:10,step:.1},{key:'loop',type:'checkbox',label:'循环播放',unit:''}]:[])];
export function normalize(value:HighlightOptions={}){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!Object.hasOwn(defaults,k)))throw Error('未知或无效参数');
 const p={...defaults,...value};if(typeof p.enabled!=='boolean'||typeof p.loop!=='boolean')throw Error('开关须为布尔值');
 if(typeof p.color!=='string'||!/^#[0-9a-f]{6}$/i.test(p.color))throw Error('颜色无效');
 if(!Number.isFinite(p.opacity)||p.opacity<0||p.opacity>1)throw Error('亮度范围0–1');
 if(!Number.isFinite(p.duration)||p.duration<.2||p.duration>10)throw Error('周期范围0.2–10秒');return p;
}
