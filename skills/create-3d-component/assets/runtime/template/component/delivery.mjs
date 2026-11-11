import deliveryTemplate from '../delivery-template.json' with {type:'json'};
import {readZip,writeZip} from '../scripts/zip.mjs';
import {validate as validatePreset,canonical,check} from './schema.mjs';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
export async function digest(data){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function template(){return structuredClone(deliveryTemplate);}

export async function importPackage(bytes,known){const entries=readZip(bytes),manifest=JSON.parse(dec.decode(entries['manifest.json']||new Uint8Array()));const original=JSON.parse(known['manifest.json']);
 check(manifest.id==='__ID__'&&manifest.deliveryType==='candidate-component'&&manifest.formatVersion===1&&manifest.parameterFormatVersion===1&&manifest.version==='0.1.0','候选包格式或版本不支持');
 check(canonical(Object.keys(entries).sort())===canonical(Object.keys(known).sort()),'候选文件缺失或多余');check(canonical(manifest.dependencies)===canonical(original.dependencies)&&canonical(manifest.sources)===canonical(original.sources)&&canonical(manifest.assets)===canonical(original.assets),'依赖/来源/资产不兼容');check(canonical(manifest.states)===canonical(original.states),'不接受自动提升确认或发布状态');
 check(Array.isArray(manifest.files)&&manifest.files.length===Object.keys(entries).length-1,'文件清单无效');const seen=new Set();for(const f of manifest.files){check(f.path!=='manifest.json'&&Object.hasOwn(entries,f.path)&&!seen.has(f.path),'清单重复或未知');seen.add(f.path);check(f.bytes===entries[f.path].length&&f.sha256===await digest(entries[f.path]),'文件校验失败：'+f.path);
 // Imported component code is verified against this installed candidate, never executed or installed.
 if(f.path!=='preset.json')check(dec.decode(entries[f.path])===known[f.path],'候选源码/说明版本不同，需开发审查：'+f.path);
 }
 return validatePreset(JSON.parse(dec.decode(entries['preset.json'])));
}
export async function exportPackage(value,known){const p=validatePreset(value),files={...known,'preset.json':JSON.stringify(p,null,2)},manifest=JSON.parse(known['manifest.json']);manifest.files=[];for(const [path,text] of Object.entries(files)){if(path==='manifest.json')continue;const bytes=enc.encode(text);manifest.files.push({path,bytes:bytes.length,sha256:await digest(bytes)});}files['manifest.json']=JSON.stringify(manifest,null,2);const bytes=writeZip(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,enc.encode(v)])));check(canonical(await importPackage(bytes,known))===canonical(p),'导出往返失败');return {bytes,evidence:{status:'pass',artifactHash:await digest(bytes),actor:'__ID__-candidate/0.1.0',time:new Date().toISOString(),evidence:['完整文件SHA256校验','参数往返语义一致'],scope:'local-candidate-review',baselineVisualConfirmation:null,technicalReview:null,design:'unconfirmed',engineering:'not-run',publication:'unpublished'}};}
