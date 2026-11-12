import {exampleHTML} from '../template/example.mjs';
import {BASELINE,CONTROLS,DEPENDENCIES,initialStates,validatePreset,validateManifest,requireThat as check,same} from './contract.mjs';
import {readZip,writeZip} from './zip.mjs';
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
export const REQUIRED=['design.md','preset.json','controls.json','example/index.html','example/README.md','engineering.md'];
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
const json=x=>encoder.encode(JSON.stringify(x,null,2));
export async function validateDelivery(bytes){
 const entries=readZip(bytes);check(Object.keys(entries).length===REQUIRED.length+1&&['manifest.json',...REQUIRED].every(n=>Object.hasOwn(entries,n)),'交付文件缺失或含未知文件');
 const manifest=JSON.parse(decoder.decode(entries['manifest.json']));validateManifest(manifest);
 check(manifest.files.length===REQUIRED.length,'文件清单数量不一致');const seen=new Set();
 for(const f of manifest.files){check(REQUIRED.includes(f.path)&&!seen.has(f.path),'清单路径未知或重复');seen.add(f.path);check(Number.isSafeInteger(f.bytes)&&f.bytes===entries[f.path].length&&f.sha256===await sha256(entries[f.path]),'文件hash或大小不一致: '+f.path);}
 const preset=validatePreset(JSON.parse(decoder.decode(entries['preset.json'])));
 check(same(JSON.parse(decoder.decode(entries['controls.json'])),CONTROLS),'控件与参数契约不一致');
 return {preset,manifest,packageHash:await sha256(bytes)};
}
export async function exportDelivery(value){
 const preset=validatePreset(value);
 const example=exampleHTML(preset);
 const entries={
  'design.md':encoder.encode('# 已有Grid调试预设\n\n方案：已有网格参数调试。布局：沿用固定示例。默认表现：以preset.json为准。操作：调间距和颜色。开放设置：两个控件。确认依据：仅参数往返，视觉未由设计师确认。不是从零创作成果。\n'),
  'preset.json':json(preset),'controls.json':json(CONTROLS),'example/index.html':encoder.encode(example),
  'example/README.md':encoder.encode('# 运行前提\n需要独立Studio 0.1.0及manifest登记的Grid基线。于工具目录npm ci --ignore-scripts，再npm run dev；浏览器打开本目录index.html点击复现，或直接在Studio导入完整ZIP。链接只提供参数，完整文件真实性检查必须导入ZIP。端口固定4173。没有匹配运行时不能独立预览；preset按契约不复制已有组件源码。\n'),
  'engineering.md':encoder.encode('# 工程边界\n已有Grid复用；primaryScale对应setPrimaryScale，color对应setColor。布局和相机固定。无生产接入、无新算法。许可未知资产未装包。原型、导出证据由Studio在包外生成；design未确认、engineering未运行、publication未发布。\n')};
 const manifest={formatVersion:1,parameterFormatVersion:1,id:'grid-debug',version:'0.1.0',deliveryType:'preset',dependencies:DEPENDENCIES,assets:[],sources:BASELINE.sources,states:initialStates(),files:[]};
 for(const [path,data] of Object.entries(entries))manifest.files.push({path,bytes:data.length,sha256:await sha256(data)});
 entries['manifest.json']=json(manifest);const bytes=writeZip(entries),validated=await validateDelivery(bytes);
 check(same(validated.preset,preset),'导出再导入语义不一致');
 return {bytes,evidence:{status:'pass',artifactHash:validated.packageHash,evidence:['完整结构/hash检查','导出后重新解析并核对预设与控件'],actor:'component-studio-n2/0.1.0',time:new Date().toISOString()}};
}
