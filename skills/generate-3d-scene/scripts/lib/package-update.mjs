/** New immutable package versions. Match all paths before considering unique content renames. */
import {readFileSync,existsSync,copyFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,extname,dirname,posix} from 'node:path';
import {createHash} from 'node:crypto';
import {receive,loadPackage,safePath,atomicJSON,outsideSkill,checkCacheState,verifyContent} from './designer-assets.mjs';
import {readIntakeManifest,packageIdentity} from './intake-page.mjs';
import {validateManifest} from './viewer/intake-contract.js';
import {RULES_VERSION} from './model-policy.mjs';
import {CHECKER_VERSION} from './viewer-version.mjs';
import {withFileLock} from './file-lock.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
function fingerprint(dir,a){
  try{
    verifyContent(dir,a);
    const root=resolve(dir,'files'),bytes=readFileSync(safePath(root,a.entry));
    if(extname(a.entry).toLowerCase()==='.glb')return sha(bytes);
    const json=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
    for(const item of [...(json.buffers??[]),...(json.images??[])]){
      if(item.uri&&!item.uri.startsWith('data:'))item.uri='sha256:'+sha(readFileSync(safePath(root,posix.join(posix.dirname(a.entry),decodeURIComponent(item.uri)))));
    }
    return sha(JSON.stringify(canonical(json)));
  }catch{return null;}
}
function loadOldReview(oldPkg,dir,file){
  const m=readIntakeManifest(file);
  validateManifest(m,{...packageIdentity(oldPkg),mode:'upload',checkerVersion:CHECKER_VERSION,rulesVersion:RULES_VERSION,
    assets:oldPkg.assets.map(a=>({...a,assetId:a.id,cacheState:checkCacheState(dir,a)}))});
  const prior=oldPkg.importedManifests?.find(x=>x.submissionId===m.submissionId);
  const identical=prior?.contentHash===sha(JSON.stringify(canonical(m)));
  if(m.baseRevision!==oldPkg.revision && !(identical&&oldPkg.importedManifests.at(-1)===prior))throw new Error('旧清单版本已过期，请使用最新草稿或重新导出清单');
  return m;
}
export function matchAssets(oldDir,newDir,newPkg){
  const old=loadPackage(oldDir),used=new Set(),byNew=new Map();
  for(const a of newPkg.assets){
    const source=old.assets.find(o=>o.entry===a.entry);
    if(source){used.add(source.id);byNew.set(a.id,{newAsset:a,oldAsset:source,kind:source.contentHash===a.contentHash?'unchanged':'updated'});}
    else if(a.technicalStatus==='invalid')byNew.set(a.id,{newAsset:a,kind:'invalid'});
  }
  const remaining=newPkg.assets.filter(a=>!byNew.has(a.id));
  const oldFP=old.assets.filter(a=>!used.has(a.id)).map(a=>[a,fingerprint(oldDir,a)]);
  const newFP=new Map(remaining.map(a=>[a.id,fingerprint(newDir,a)]));
  for(const a of remaining){
    const fp=newFP.get(a.id),candidates=fp?oldFP.filter(([,f])=>f===fp).map(([o])=>o):[];
    const uniqueNew=remaining.filter(n=>newFP.get(n.id)===fp).length===1;
    if(candidates.length===1&&uniqueNew){used.add(candidates[0].id);byNew.set(a.id,{newAsset:a,oldAsset:candidates[0],kind:'renamed'});}
    else byNew.set(a.id,{newAsset:a,kind:candidates.length?'ambiguous':'added',candidates});
  }
  return {mappings:newPkg.assets.map(a=>byNew.get(a.id)),removed:old.assets.filter(a=>!used.has(a.id))};
}
export function updatePackage(oldDir,newInput,out,{review}={}){
  oldDir=resolve(oldDir);out=resolve(out);outsideSkill(out);
  if(!existsSync(resolve(oldDir,'package.json')))throw new Error('原包目录不是有效资产包');
  if(existsSync(out))throw new Error('Package output must be a new directory; existing package is preserved');
  return withFileLock(resolve(oldDir,'.package-write.lock'),()=>{
    const old=loadPackage(oldDir),intent=review?loadOldReview(old,oldDir,review):old.draft;
    const intents=new Map((intent?.entries??[]).map(e=>[e.assetId,e]));
    const describe=a=>{const e=intents.get(a.id);return {id:a.id,entry:a.entry,name:e?.name??a.name,description:e?.description??a.description,selected:e?.selected??(old.confirmation?.revision===old.revision?old.confirmation.usable.includes(a.id):a.inheritedSelection??true)};};
    let created=false;
    try{
      const pkg=receive(newInput,out,intent?.packageDescription??old.description??'');created=true;
      const {mappings,removed}=matchAssets(oldDir,out,pkg);
      for(const m of mappings){
        const a=m.newAsset,source=m.oldAsset;
        a.mapping={kind:m.kind,oldEntry:source?.entry??null,oldId:source?.id??null};
        a.mappingPending=['updated','renamed','ambiguous'].includes(m.kind);
        if(m.kind==='ambiguous')a.mapping.candidates=m.candidates.map(describe);
        if(!source)continue;
        const d=describe(source),entry=intents.get(source.id);
        Object.assign(a,{name:d.name,description:d.description,inheritedSelection:!!d.selected,namePending:source.namePending,nameSource:source.nameSource,
          semanticStatus:entry?'user_named':source.semanticStatus,semanticSource:source.semanticSource,semanticEvidence:source.semanticEvidence,tier:entry?.tier??source.tier??'medium'});
        const reuse=['unchanged','renamed'].includes(m.kind)&&source.checkerVersion===CHECKER_VERSION&&source.rulesVersion===RULES_VERSION&&checkCacheState(oldDir,source)==='hit';
        if(reuse){
          for(const key of ['technicalStatus','checkerVersion','thumbnail','bbox','meshCount','triangles','nodeCount','drawCalls','textureCount','maxTextureSize','editability','placementViolations','placementPending','budgetWarnings'])a[key]=source[key];
          const target=safePath(out,source.thumbnail);mkdirSync(dirname(target),{recursive:true});copyFileSync(safePath(oldDir,source.thumbnail),target);
          a.frontConfirmed=entry?.confirmFront??source.frontConfirmed;
          a.scaleConfirmed=entry?.confirmScale??source.scaleConfirmed;
          if(m.kind==='unchanged'&&a.tier===source.tier)a.budgetAck=source.budgetAck;
        }
      }
      pkg.parentPackageId=old.id;
      pkg.updateSummary=Object.fromEntries(['unchanged','updated','renamed','ambiguous','added'].map(k=>[k,mappings.filter(m=>m.kind===k).length]));
      pkg.updateSummary.removed=removed.map(describe);
      atomicJSON(resolve(out,'package.json'),pkg);return pkg;
    }catch(error){if(created)rmSync(out,{recursive:true,force:true});throw error;}
  });
}
