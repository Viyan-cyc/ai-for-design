import {readFile,writeFile,mkdir,readdir,cp,lstat,rename,unlink,open} from 'node:fs/promises';
import {join,resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {safe,baseline,hash} from './core.mjs';
import {pages} from './map-library-pages.mjs';
const here=dirname(fileURLToPath(import.meta.url)),json=b=>JSON.parse(b.toString().replace(/^\uFEFF/,''));
async function bytes(p){try{return await readFile(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function put(root,path,data){await safe(join(root,path));await mkdir(dirname(join(root,path)),{recursive:true});await writeFile(join(root,path),data);}
async function collect(root,prefix=''){const out={};await safe(root);for(const e of await readdir(join(root,prefix),{withFileTypes:true})){const f=prefix?prefix+'/'+e.name:e.name;if(e.isSymbolicLink())throw Error('拒绝目录链接 '+f);if(e.isDirectory())Object.assign(out,await collect(root,f));else out[f]=await readFile(join(root,f));}return out;}
async function run(copy,args,log){const p=spawnSync(process.execPath,args,{cwd:copy,encoding:'utf8',maxBuffer:32*1024*1024});await writeFile(log,(p.stdout||'')+(p.stderr||''));if(p.status!==0)throw Error('检查失败 '+log);}
export async function stage(accepted,target,work){
 accepted=resolve(accepted);target=resolve(target);work=resolve(work);
 for(const root of [target,accepted]){const r=relative(root,work);if(!r||(!r.startsWith('..')&&!r.includes(':')))throw Error('验证输出不可嵌套输入');}
 await safe(work);await mkdir(work);const prior=json(await readFile(join(accepted,'verification.json'))),acceptance=json(await readFile(join(accepted,'acceptance.json')));
 if(acceptance.status!=='ready-for-independent-review'||!acceptance.sourceCopy?.allIdentical||prior.target!==target)throw Error('非R6已验输入');
 const current=await baseline(target);if(current!==prior.baseline)throw Error('共享库自R6验证后已变化，先重核差异与验证');
 const payload=await collect(prior.candidate);for(const f of prior.files)if(!payload[f.path]||hash(payload[f.path])!==f.sha256)throw Error('R6候选变化 '+f.path);
 if(Object.keys(payload).length!==prior.files.length)throw Error('R6文件集合变化');
 const copy=join(work,'library');await mkdir(copy);
 for(const d of ['src','docs','scripts']){await collect(join(target,d));await cp(join(target,d),join(copy,d),{recursive:true});}
 for(const f of await readdir(target)){if(/^(package.*\.json|tsconfig.*\.json|vite\.config\..*)$/.test(f)){await safe(join(target,f));await cp(join(target,f),join(copy,f));}}
 await cp(join(target,'node_modules'),join(copy,'node_modules'),{recursive:true,dereference:true});
 const operations={};
 for(const [f,b] of Object.entries(payload))if(f.startsWith('src/'))operations['src/map/restored-map-suite/'+f.slice(4)]=b;
 operations['src/map/index.ts']=Buffer.from((await readFile(join(target,'src/map/index.ts'),'utf8'))+"\nexport * from './restored-map-suite'; // intake:restored-map-suite\n");
 operations['scripts/adapters/patch-maplibre.mjs']=Buffer.from(payload['adapters/patch-maplibre.mjs'].toString().replace('../src/heat-field/sampling.ts','../../src/map/restored-map-suite/heat-field/sampling.ts'));
 for(const [from,to] of Object.entries({'controls.ts':'docs/shared/restored-controls.ts','map-demo.ts':'docs/shared/restored-map-demo.ts','scatter-demo.ts':'docs/shared/restored-scatter-demo.ts','tint-model.ts':'docs/shared/restored-tint-model.ts','vite.docs.config.mts':'vite.docs.config.mts'}))operations[to]=await readFile(join(here,'map-library-template',from));
 const pkg=json(await readFile(join(target,'package.json')));pkg.scripts['docs:serve']='vite --config vite.docs.config.mts --open --port 7777';pkg.scripts['docs:build']='vite build --config vite.docs.config.mts';operations['package.json']=Buffer.from(JSON.stringify(pkg,null,2)+'\n');
 let nav=await readFile(join(target,'docs/index.html'),'utf8');const anchor=/(<div class="nav-group" data-group="map">[\s\S]*?<div class="nav-children">)/;
 if(!anchor.test(nav))throw Error('地图导航结构变化');
 nav=nav.replace(anchor,'$1\n'+Object.entries({MapExperience:'地图整体体验',LogicalScatter:'逻辑散点',GridHeat:'栅格热力',BuildingTint:'建筑染色'}).map(([name,title])=>`<a href="#${name}" class="nav-item nav-page" data-page="${name}">${name} · ${title}</a>`).join('\n'));
 operations['docs/index.html']=Buffer.from(nav);
 // Fresh intake cannot take over unrelated files, even if their contents happen to match.
 const allowedExisting=new Set(['src/map/index.ts','docs/index.html','docs/components.json','package.json']);
 for(const f of Object.keys(operations))if(!allowedExisting.has(f)&&await bytes(join(target,f)))throw Error('已有未登记文件 '+f);
 for(const [f,b] of Object.entries(operations))await put(copy,f,b);
 for(const [f,text] of Object.entries(await pages(copy,work))){if(await bytes(join(target,f)))throw Error('已有文档冲突 '+f);operations[f]=Buffer.from(text);await put(copy,f,text);}
 await run(copy,['scripts/gen-component-docs.mjs'],join(work,'catalog.log'));operations['docs/components.json']=await readFile(join(copy,'docs/components.json'));
 await run(copy,['node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.app.json'],join(work,'typecheck.log'));
 const ts=createRequire(join(copy,'package.json'))('typescript'),configResult=ts.readConfigFile(join(copy,'tsconfig.app.json'),ts.sys.readFile);if(configResult.error)throw Error(ts.flattenDiagnosticMessageText(configResult.error.messageText,'\n'));const cfg=configResult.config;cfg.include=[join(copy,'src/**/*.ts'),join(copy,'docs/components/MapExperience/demo.ts'),join(copy,'docs/components/LogicalScatter/demo.ts'),join(copy,'docs/components/GridHeat/demo.ts'),join(copy,'docs/components/BuildingTint/demo.ts')];cfg.compilerOptions.baseUrl=copy;cfg.compilerOptions.tsBuildInfoFile=join(work,'docs.tsbuildinfo');await writeFile(join(copy,'tsconfig.r7-docs.json'),JSON.stringify(cfg));
 await run(copy,['node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.r7-docs.json'],join(work,'docs-typecheck.log'));
 await run(copy,['node_modules/vite/bin/vite.js','build'],join(work,'build.log'));
 await run(copy,['node_modules/vite/bin/vite.js','build','--config','vite.docs.config.mts'],join(work,'docs-build.log'));
 const owned=Object.fromEntries(Object.entries(operations).filter(([f])=>!allowedExisting.has(f)).map(([f,b])=>[f,hash(b)]));
 const record='docs/intake/restored-map-suite.json';if(await bytes(join(target,record)))throw Error('套件已登记');
 operations[record]=Buffer.from(JSON.stringify({profile:'restored-map-suite',version:1,components:['MapExperience','LogicalScatter','GridHeat','BuildingTint'],owned,sourceZip:acceptance.zip.sha256,publication:'not-published'},null,2));
 const changes=[];for(const [f,b] of Object.entries(operations)){const old=await bytes(join(target,f));changes.push({path:f,before:old?hash(old):null,after:hash(b)});await put(work,'proposed/'+f,b);await put(copy,f,b);}
 const receipt={profile:'r7-library',target,work,baseline:current,status:'static-verified-runtime-pending',changes};await writeFile(join(work,'receipt.json'),JSON.stringify(receipt,null,2));return receipt;
}
export async function apply(receiptPath,confirmed){
 if(!confirmed)throw Error('需要显式developer-confirmed');const receipt=json(await readFile(receiptPath));
 if(receipt.profile!=='r7-library'||receipt.status!=='static-verified-runtime-pending')throw Error('未知回执');
 const runtime=json(await readFile(join(receipt.work,'browser.json')));if(runtime.profile!=='r7-docs'||runtime.receiptHash!==hash(await readFile(receiptPath))||runtime.status!=='passed'||runtime.errors.length)throw Error('先完成绑定本回执的R7实际文档运行验收');
 if(await baseline(receipt.target)!==receipt.baseline)throw Error('目标变化，停止apply');
 const operations=[];
 for(const c of receipt.changes){if(!/^(src\/map\/|docs\/|scripts\/adapters\/|package\.json$|vite\.docs\.config\.mts$)/.test(c.path)||c.path.split(/[\\/]/).includes('..'))throw Error('非法接纳路径');await safe(join(receipt.target,c.path));const data=await readFile(join(receipt.work,'proposed',c.path)),old=await bytes(join(receipt.target,c.path));if(hash(data)!==c.after||runtime.verifiedHashes[c.path]!==c.after||(old?hash(old):null)!==c.before)throw Error('写前冲突 '+c.path);operations.push({...c,data,old});}
 const lock=join(receipt.target,'.restored-map-intake.lock');await safe(lock);const handle=await open(lock,'wx'),written=[];
 try{
  for(const c of operations){const p=join(receipt.target,c.path);const now=await bytes(p);if((now?hash(now):null)!==c.before)throw Error('并发修改 '+c.path);if(c.old)await put(receipt.work,'backup/'+c.path,c.old);await mkdir(dirname(p),{recursive:true});const temp=p+'.intake-'+randomUUID();try{await writeFile(temp,c.data,{flag:'wx'});await rename(temp,p);}finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}written.push(c);}
  await writeFile(join(receipt.work,'applied.json'),JSON.stringify({status:'applied',target:receipt.target,files:receipt.changes,publication:'not-published',r8:'not-started'},null,2));
 }catch(e){for(const c of written.reverse()){const p=join(receipt.target,c.path);if(hash(await readFile(p))!==c.after)throw Error('回滚遇并发修改，保留备份 '+p,{cause:e});if(c.old)await writeFile(p,c.old);else await unlink(p);}throw e;}
 finally{await handle.close();await unlink(lock);}
 return {status:'applied',files:written.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [cmd,...a]=process.argv.slice(2);try{const r=cmd==='stage'&&a.length===3?await stage(...a):cmd==='apply'&&a.length===2?await apply(a[0],a[1]==='--developer-confirmed'):null;if(!r)throw Error('stage <R6验证目录> <目标库> <新工作目录> | apply <回执> --developer-confirmed');console.log(JSON.stringify({status:r.status,work:r.work,files:r.files??r.changes?.length}));}catch(e){console.error(e.stack);process.exitCode=1;}
}
