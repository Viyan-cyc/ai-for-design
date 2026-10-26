/** Designer asset CLI: users speak naturally; the agent operates these internal commands. */
import { resolve } from 'node:path';
import { receive, readJSON, loadPackage, describe, confirm, inject, exportPackage, uploadAdapter, sceneScope } from './lib/designer-assets.mjs';
import { previewPackage } from './lib/asset-preview.mjs';
import { generateIntakePage, importReview } from './lib/intake-page.mjs';
import {importDelivery} from './lib/delivery-import.mjs';
import { updatePackage } from './lib/package-update.mjs';
import { serviceConfig, searchRemote, downloadCandidate } from './lib/asset-service.mjs';
const [command,...args]=process.argv.slice(2);
const opts={},pos=[];
for(let i=0;i<args.length;i++) {if(args[i].startsWith('--')){const key=args[i].slice(2);if(['allow-partial','all','headless','retry-failed','confirm-front','confirm-scale'].includes(key))opts[key]=true;else {if(!args[i+1]||args[i+1].startsWith('--'))throw new Error(`Missing --${key} value`);opts[key]=args[++i];}}else pos.push(args[i]);}
const need=(v,name)=>{if(!v)throw new Error(`Required: ${name}`);return v;};
const summary=(pkg)=>({revision:pkg.revision,description:pkg.description,confirmation:pkg.confirmation,assets:pkg.assets.map(a=>{
 const {id,number,name,entry,description,technicalStatus,semanticStatus,thumbnail,error,confirmed,editability,sceneCount,selectedScene,sceneSelection,checkerVersion}=a;
 return {id,number,name,entry,description,technicalStatus,semanticStatus,thumbnail,error,confirmed,editability,sceneCount,selectedScene,sceneSelection,checkerVersion,sceneScope:sceneScope(a),
  namePending:a.namePending,nameSource:a.nameSource,forbidden:a.forbidden,placementViolations:a.placementViolations,budgetWarnings:a.budgetWarnings,tier:a.tier,
  triangles:a.triangles??null,nodeCount:a.nodeCount??null,drawCalls:a.drawCalls??null,textureCount:a.textureCount??null,maxTextureSize:a.maxTextureSize??null,frontConfirmed:a.frontConfirmed,scaleConfirmed:a.scaleConfirmed,mapping:a.mapping};
}),unsupportedFiles:pkg.unsupportedFiles,unassociatedFiles:pkg.unassociatedFiles,parentPackageId:pkg.parentPackageId??null,updateSummary:pkg.updateSummary??null});
try {
 let result;
 switch(command){
 case 'import-delivery':result=importDelivery(need(pos[0],'original package'),need(pos[1],'delivery ZIP'),need(opts.out,'--out'));break;
 case 'receive':result=summary(receive(need(pos[0],'input'),need(opts.out,'--out'),opts.description??'',opts.limits?readJSON(opts.limits):undefined));break;
 case 'update-package':result=summary(updatePackage(need(pos[0],'original package'),need(pos[1],'new ZIP'),need(opts.out,'--out'),{...(opts.review?{review:opts.review}:{})}));break;
 case 'preview':result=opts.headless?summary(await previewPackage(need(pos[0],'package'),{retryFailed:!!opts['retry-failed'],...(opts.port?{port:Number(opts.port)}:{})})):generateIntakePage(need(pos[0],'package'));break;
 case 'import-check':result=importReview(need(pos[0],'package'),need(opts.file,'--file'),{technicalOnly:true});break;
 case 'import-review':result=importReview(need(pos[0],'package'),need(opts.file,'--file'));break;
 case 'list':result=summary(loadPackage(need(pos[0],'package')));break;
 case 'describe':result=summary(describe(need(pos[0],'package'),readJSON(need(opts.changes,'--changes'))));break;
 case 'confirm':result=summary(confirm(need(pos[0],'package'),Number(need(opts.revision,'--revision')),{allowPartial:!!opts['allow-partial'],confirmFront:!!opts['confirm-front'],confirmScale:!!opts['confirm-scale']}));break;
 case 'accept-remote':{
  const pkg=loadPackage(need(pos[0],'package'));
  if(pkg.assets.some(a=>a.origin!=='remote'))throw new Error('Uploaded packages require user confirmation');
  result=summary(confirm(pos[0],pkg.revision));break;
 }
 case 'inject':result=inject(need(pos[0],'package'),need(opts.project,'--project'),opts.ids?.split(','));break;
  case 'search':result=await searchRemote(opts.queries?readJSON(opts.queries):[need(pos.join(' '),'query')],serviceConfig());break;
  case 'download':result=summary(await downloadCandidate(readJSON(need(pos[0],'candidate.json')),need(opts.out,'--out'),serviceConfig()));break;
 case 'export':result=exportPackage(need(pos[0],'package'),need(opts.out,'--out'),readJSON(need(opts.target,'--target')));break;
 case 'upload':result=await uploadAdapter(need(pos[0],'zip'),opts.target?readJSON(opts.target):{},{});break;
 default:throw new Error('Commands: import-delivery, receive, update-package, preview, import-review, import-check, list, describe, confirm, accept-remote, inject, search, download, export, upload');
 }
 console.log(JSON.stringify({ok:true,...(Array.isArray(result)?{assets:result}:result)},null,2));
}catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;}