import './style.css';
import {DEFAULT,BASELINE,validatePreset} from './contract.mjs';
import {validateDelivery,exportDelivery} from './package.mjs';
import {StudioState} from './state.mjs';
import {createGridPreview} from './adapters/grid';
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`<header><a class="brand" href="/">◈ <strong>组件 Studio</strong></a><span class="badge">N2 · 已有能力调试</span></header>
<main><section class="stage"><div class="stage-title"><div><p class="eyebrow">PARAMETER WORKSPACE</p><h1>网格的尺度与颜色</h1><p>调整已有 Grid，保存为可复现的参数交付包。</p></div><button id="reset-view" class="quiet">重置视角</button></div><div id="preview"></div><div class="stage-footer"><span>拖动旋转 · 滚轮缩放</span><span>已有组件副本 · 非从零创作</span></div></section>
<aside><h2>设计参数</h2><p class="muted">两项已实现设置，即时预览。</p><label for="scale">主网格间距 <output id="scale-value">5</output></label><input id="scale" type="range" min="1" max="20" step="0.5" value="5"><small>世界单位 · 1–20</small><label for="color">网格颜色</label><div class="color-row"><input id="color" type="color" value="#333333"><code id="color-value">#333333</code></div><hr><h2>参数交付</h2><p class="muted">导出 ZIP，重开页面后可重新导入。</p><button id="export" class="primary">导出参数包</button><label class="file-button" for="import">导入参数包</label><input id="import" type="file" accept=".zip" hidden><button id="reset" class="quiet wide">恢复默认参数</button><p id="status" role="status" aria-live="polite">正在准备预览…</p><a id="evidence" hidden>下载导出检查记录</a><hr><div class="states"><span>设计确认</span><b>未确认</b><span>工程验证</span><b>未执行</b><span>正式发布</span><b>未发布</b></div><details><summary>复现与验证边界</summary><p>仅支持本工具生成的无压缩 ZIP。依赖独立 Studio 0.1.0 和匹配的 Grid 基线；不覆盖用户源码。</p><p>视角旋转仅用于临时观察，导出使用固定取景。参数往返不代表视觉确认、工程接入或发布。</p><code id="baseline"></code></details></aside></main>`;
const host=document.querySelector<HTMLElement>('#preview')!,status=document.querySelector<HTMLElement>('#status')!,scale=document.querySelector<HTMLInputElement>('#scale')!,color=document.querySelector<HTMLInputElement>('#color')!,file=document.querySelector<HTMLInputElement>('#import')!;
const store=new StudioState(DEFAULT,(preset:unknown)=>createGridPreview(host,preset));
const sync=()=>{const p=store.snapshot();scale.value=String(p.design.primaryScale);color.value=p.design.color;document.querySelector('#scale-value')!.textContent=scale.value;document.querySelector('#color-value')!.textContent=color.value;};
const show=(message:string,error=false)=>{status.textContent=message;status.classList.toggle('error',error);};
const evidence=document.querySelector<HTMLAnchorElement>('#evidence')!;let evidenceUrl='';
function clearEvidence(){if(evidenceUrl)URL.revokeObjectURL(evidenceUrl);evidenceUrl='';evidence.hidden=true;}
async function replace(load:()=>unknown|Promise<unknown>,message:string){try{if(await store.replace(load)){sync();clearEvidence();show(message);}}catch(e){sync();show(`未应用：${e instanceof Error?e.message:String(e)}。原状态保持。`,true);}}
// Small edits use the existing adapter; importing uses detached construction and atomic replacement.
function change(){try{const p=store.snapshot();p.design.primaryScale=Number(scale.value);p.design.color=color.value;validatePreset(p);store.ticket++;store.preview!.applyPreset(p);store.value=p;sync();clearEvidence();show('参数已更新，尚未导出。');}catch(e){sync();show(String(e),true);}}
scale.addEventListener('input',change);color.addEventListener('input',change);
file.addEventListener('change',()=>{const selected=file.files?.[0];file.value='';if(!selected)return;void replace(async()=>{if(selected.size>2*1024*1024)throw new Error('交付包超过2MB');return (await validateDelivery(new Uint8Array(await selected.arrayBuffer()))).preset;},'导入成功：参数及预览已恢复。');});
document.querySelector('#reset')!.addEventListener('click',()=>void replace(()=>structuredClone(DEFAULT),'已恢复默认参数。'));
document.querySelector('#reset-view')!.addEventListener('click',()=>store.preview?.resetView());
function download(bytes:Uint8Array,name:string,type:string){const url=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
document.querySelector('#export')!.addEventListener('click',async()=>{const snapshot=store.snapshot();try{const result=await exportDelivery(snapshot);download(result.bytes,'grid-debug.preset.zip','application/zip');clearEvidence();evidenceUrl=URL.createObjectURL(new Blob([JSON.stringify(result.evidence,null,2)],{type:'application/json'}));evidence.href=evidenceUrl;evidence.download='grid-debug.export-evidence.json';evidence.hidden=false;show('导出成功：结构、hash及参数往返检查通过。设计仍未确认。');}catch(e){show('导出失败：'+String(e),true);}});
document.querySelector('#baseline')!.textContent='基线 '+BASELINE.id.slice(0,16);
let initial=DEFAULT;let initialError="";try{if(location.hash.startsWith('#preset='))initial=validatePreset(JSON.parse(decodeURIComponent(location.hash.slice(8))));}catch(e){initialError='样例参数无效，已保留默认值：'+String(e);}
void replace(()=>initial,'预览就绪。修改参数开始调试。').then(()=>{if(initialError)show(initialError,true);});
window.addEventListener('pagehide',()=>{store.dispose();clearEvidence();});
