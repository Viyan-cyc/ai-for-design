import baseline from './baseline.json' with {type:'json'};
export const BASELINE=baseline;
export const DEFAULT={formatVersion:1,design:{primaryScale:5,color:'#333333'},project:{adapter:'grid',baseline:baseline.id},view:{camera:[7,5,9],target:[0,0,0]},performance:{maxDpr:2}};
export const CONTROLS=[{pointer:'/design/primaryScale',type:'number',label:'主网格间距',unit:'世界单位',minimum:1,maximum:20,step:0.5,group:'常用'},{pointer:'/design/color',type:'color',label:'网格颜色',unit:'sRGB #RRGGBB',group:'常用'}];
export const DEPENDENCIES=[{name:'grid-existing-baseline',version:baseline.id,source:'n2-isolated-grid',required:true},{name:'three',version:baseline.three,source:'npm',required:true},{name:'component-studio-n2',version:'0.1.0',source:'local-runtime',required:true}];
export function requireThat(ok,message){if(!ok)throw new Error(message);}
export function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
export function same(a,b){return canonical(a)===canonical(b);}
export function validatePreset(p){
 requireThat(p&&typeof p==='object'&&!Array.isArray(p),'预设必须是对象');
 requireThat(same(Object.keys(p).sort(),Object.keys(DEFAULT).sort()),'预设分区不支持');
 requireThat(p.formatVersion===1,'未知参数版本');
 requireThat(p.design&&same(Object.keys(p.design).sort(),['color','primaryScale']),'设计参数不支持');
 requireThat(Number.isFinite(p.design.primaryScale)&&p.design.primaryScale>=1&&p.design.primaryScale<=20&&Number.isInteger(p.design.primaryScale*2),'主网格间距须为1–20，步长0.5');
 requireThat(typeof p.design.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(p.design.color),'颜色必须为#RRGGBB');
 requireThat(same(p.project,DEFAULT.project),'缺少或不兼容的Grid基线');
 requireThat(same(p.view,DEFAULT.view)&&same(p.performance,DEFAULT.performance),'本版本不支持修改取景或性能设置');
 return structuredClone(p);
}
export function initialStates(){return Object.fromEntries(['prototype','export','design','engineering','publication'].map(k=>[k,{status:k==='design'?'unconfirmed':k==='publication'?'unpublished':'not-run',artifactHash:null,evidence:[],actor:null,time:null}]));}
export function validateManifest(m){
 requireThat(m?.formatVersion===1&&m.parameterFormatVersion===1,'未知交付格式版本');
 requireThat(m.id==='grid-debug'&&m.version==='0.1.0'&&m.deliveryType==='preset','不支持的包类型、身份或版本');
 requireThat(same(m.dependencies,DEPENDENCIES),'依赖不兼容');
 requireThat(same(m.assets,[])&&same(m.sources,baseline.sources),'来源或资产不支持');
 // N2 accepts only its own unconfirmed preset workflow; evidence cannot grant design/release approval.
 requireThat(same(m.states,initialStates()),'N2不接受提升验证或发布状态的包');
 requireThat(Array.isArray(m.files),'缺少文件清单');
}
