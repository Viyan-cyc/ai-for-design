/** Import a complete browser-confirmed delivery as a new, immutable package. */
import {existsSync,mkdirSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {inputFiles,receive,loadPackage,safePath,outsideSkill,atomicJSON,digest} from './designer-assets.mjs';
import {importReview,packageIdentity,intakeLimits} from './intake-page.mjs';
import {CHECKER_VERSION} from './viewer-version.mjs';
import {RULES_VERSION} from './model-policy.mjs';
export function importDelivery(originalDir,zip,out){
  originalDir=resolve(originalDir);out=resolve(out);outsideSkill(out);
  if(out===originalDir||out.startsWith(originalDir+'/')||out.startsWith(originalDir+'\\'))throw new Error('交付必须写入独立的新目录');
  const source=loadPackage(originalDir),identity=packageIdentity(source),files=inputFiles(zip),manifestFile=files.find(f=>f.name==='models.3d.json');
  if(!manifestFile||manifestFile.data.length>intakeLimits.fileBytes)throw new Error('缺少有效的 models.3d.json');
  const m=JSON.parse(manifestFile.data.toString('utf8')),receipt=digest(files.map(f=>f.name+':'+digest(f.data)).sort().join('\n'));
  if(m.kind!=='model-delivery'||m.schemaVersion!==1||m.packageId!==identity.packageId||m.packageDigest!==identity.packageDigest||m.baseRevision!==source.revision)throw new Error('交付包来源或版本不匹配，请使用对应原包');
  if(m.checkerVersion!==CHECKER_VERSION||m.rulesVersion!==RULES_VERSION)throw new Error('检查规则已变化，请重新检查');
  if(m.confirmAll!==true||!Array.isArray(m.entries)||!m.entries.length||m.entries.length!==source.assets.length)throw new Error('交付必须包含并确认全部模型');
  const seen=new Set();for(const e of m.entries){if(seen.has(e.sourceAssetId)||!source.assets.some(a=>a.id===e.sourceAssetId))throw new Error('原模型清单缺失或重复');seen.add(e.sourceAssetId);if(!e.result?.ok||!e.confirmFront||!e.confirmScale)throw new Error('存在未完成检查或确认的模型');}
  if(existsSync(out)){const old=loadPackage(out);if(old.deliveryReceipt===receipt)return {status:'duplicate',package:out,assets:old.assets.length};throw new Error('输出目录已存在，请使用新的目录');}
  const input=out+'.input-'+randomUUID(),stage=out+'.pending-'+randomUUID();mkdirSync(input,{recursive:true});
  try{
    for(const f of files){if(f===manifestFile)continue;if(!f.name.startsWith('models/'))throw new Error('交付包包含非模型文件：'+f.name);const path=safePath(input,f.name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,f.data);}
    const pkg=receive(input,stage,m.packageDescription);
    if(pkg.assets.length!==m.entries.length)throw new Error('模型文件与清单数量不符');
    const used=new Set(pkg.assets.flatMap(a=>a.files));if(pkg.unassociatedFiles.length||files.some(f=>f!==manifestFile&&!used.has(f.name)))throw new Error('交付包存在未引用文件');
    const targets=new Set();const entries=m.entries.map(e=>{
      const a=pkg.assets.find(a=>a.entry===e.entry);if(!a||targets.has(a.id)||a.technicalStatus==='invalid'||a.contentHash!==e.contentHash)throw new Error('模型内容与检查清单不一致：'+e.entry);targets.add(a.id);
      return {...e,assetId:a.id,selected:true};
    });
    const result=importReview(stage,{...m,...packageIdentity(pkg),kind:'model-intake',schemaVersion:2,mode:'upload',purpose:'confirm',baseRevision:pkg.revision,confirmSelection:true,allowPartial:false,entries});
    const final=loadPackage(stage);final.parentPackageId=source.id;final.deliveryReceipt=receipt;atomicJSON(resolve(stage,'package.json'),final);renameSync(stage,out);
    return {...result,package:out};
  }finally{rmSync(input,{recursive:true,force:true});if(existsSync(stage))rmSync(stage,{recursive:true,force:true});}
}
