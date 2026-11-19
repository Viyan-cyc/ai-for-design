// Explicit map-suite profile. Does not relax the native Three intake contract.
import {readFile,writeFile,mkdir,readdir,lstat,cp} from 'node:fs/promises';
import {resolve,join,dirname,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {safe,baseline,hash} from './core.mjs';
import {writeZip,readZip} from '../native-template/example/zip.mjs';
import {engineering,adapterGuide} from './map-suite-docs.mjs';

const entries={MapExperience:'map-experience',LogicalScatter:'logical-scatter',GridHeat:'grid-heat',BuildingTint:'building-tint'};
const json=b=>JSON.parse(Buffer.from(b).toString('utf8'));
async function inventory(root,prefix=''){
 await safe(root);const result={};
 for(const e of await readdir(join(root,prefix),{withFileTypes:true})){
  const p=prefix?prefix+'/'+e.name:e.name;if(e.isSymbolicLink())throw Error('拒绝链接 '+p);
  if(e.isDirectory())Object.assign(result,await inventory(root,p));else if(e.isFile())result[p]=await readFile(join(root,p));else throw Error('拒绝特殊文件');
 }return result;
}
async function fresh(root){await safe(root);await mkdir(root,{recursive:false});}
async function put(root,p,b){await mkdir(dirname(join(root,p)),{recursive:true});await writeFile(join(root,p),b);}
function separate(a,b){const p=relative(resolve(a),resolve(b));if(!p||(!isAbsolute(p)&&p!=='..'&&!p.startsWith('..\\')&&!p.startsWith('../')))throw Error('输出不可位于输入内');}
const manifest=files=>Object.entries(files).map(([path,b])=>({path,bytes:b.length,sha256:hash(b)}));
async function prepare(sources,out){
 separate(sources,out);await fresh(out);const provenance=[];
 async function copy(from,to,transform){const original=await readFile(join(sources,from));const b=transform?Buffer.from(transform(original.toString())):original;await put(out,to,b);provenance.push({source:from,target:to,sourceHash:hash(original),targetHash:hash(b),transformed:!!transform});}
 const map='map-experience-restored/component',scatter='map-scatter-restored/component',heat='grid-building-heat/component';
 for(const [source,id] of [[map,'map-experience'],[scatter,'logical-scatter']]){
  for(const file of Object.keys(await inventory(join(sources,source,'src'))))await copy(source+'/src/'+file,'src/'+id+'/'+file);
  for(const file of ['design.md','engineering.md','preset.json'])await copy(source+'/'+file,'components/'+id+'/'+file,file==='engineering.md'?()=>engineering[id]:file==='design.md'?design:undefined);
 }
 // The R5 host is the explicitly reviewed R3 engine plus heat events/camera cancellation fix.
 // Retain both fingerprints; never claim byte-identical reuse of the older R3 engine.
 await copy('grid-building-heat/example/host/component/src/source-engine.js','src/map-experience/source-engine.js');
 for(const file of ['field.ts','sampling.ts'])await copy(heat+'/src/'+file,'src/heat-field/'+file);
 await put(out,'src/heat-field/index.ts',"export * from './field';\n");
 for(const [id,file,name] of [['grid-heat','grid.ts','GridHeat'],['building-tint','tint.ts','BuildingTint']]){
  await copy(heat+'/src/'+file,'src/'+id+'/index.ts',s=>{
   s=s.replaceAll("'./field'","'../heat-field/field'").replaceAll("'./sampling'","'../heat-field/sampling'");
   if(id==='grid-heat')s=s.replace('constructor(private map:Map,readonly field:HeatField){','private map:Map;readonly field:HeatField;\n constructor(map:Map,field:HeatField){this.map=map;this.field=field;');
   if(id==='building-tint')s=s.replace('private native:Hook=(id,','private native:Hook=(_id,');
   return s;
  });
  for(const doc of ['design.md','engineering.md','preset.json'])await copy(heat+'/'+doc,'components/'+id+'/'+doc,doc==='engineering.md'?()=>engineering[id]:doc==='design.md'?design:undefined);
 }
 await copy('grid-building-heat/example/patch-maplibre.mjs','adapters/patch-maplibre.mjs',s=>s.replace('../component/src/sampling.ts','../src/heat-field/sampling.ts'));
 await put(out,'src/index.ts',Object.entries(entries).map(([name,id])=>`export {${name}} from './${id}';`).join('\n')+"\nexport {HeatField} from './heat-field';\nexport type {HeatOptions,HeatRecord,FieldSnapshot} from './heat-field';\nexport type {MapExperienceOptions,MapParameters} from './map-experience';\nexport type {ScatterOptions,ScatterPatch,ScatterPoint} from './logical-scatter';\nexport type {TintOptions} from './building-tint';\n");
 await put(out,'package.json',JSON.stringify({name:'map-restoration-source-suite',version:'0.1.0',private:true,type:'module',devDependencies:{'@types/geojson':'7946.0.16'},componentSuite:{formatVersion:1,entries,shared:['heat-field'],adapter:'adapters/patch-maplibre.mjs'},peerDependencies:{three:'>=0.183.0 <0.190.0','maplibre-gl':'5.24.0','@turf/turf':'^7.2.0'}},null,2));
 await put(out,'provenance.json',JSON.stringify(provenance,null,2));
 await put(out,'README.md','# 四组件候选源码\n\nMapExperience地图整体；LogicalScatter逻辑坐标散点（不是经纬度图层）；GridHeat经纬度栅格；BuildingTint建筑逐片段染色。后两者共用一个HeatField实例。\n\n源码src可原样放入组件库src/map/restored-map-suite并登记入口。适配器adapters/patch-maplibre.mjs须在应用构建阶段处理准确版本MapLibre开发包；未处理时BuildingTint明确拒绝启动。导入Three、Turf、MapLibre均由宿主提供。地标资源通过MapExperienceOptions.assets显式传入，不随本源码包分发；原始资产许可未确认。\n\n本包不包含地图样例、面板、node_modules或演示数据。组件参数见components各目录。导出不等于工程验证、正式入库或发布。\n');
 await writeFile(join(out,'README.md'),(await readFile(join(out,'README.md'),'utf8'))+adapterGuide);
 return {candidate:out,components:Object.keys(entries),status:'prepared-not-validated'};
}
function design(s){return s.split(/\r?\n/).filter(line=>!line.includes('导出仍锁定')&&!line.includes('R4等待')).join('\n')+'\n\n原型效果已由用户确认；本套件为工程整理版本，设计确认不替代工程接纳。\n';}
async function check(root){
 const files=await inventory(root),pkg=json(files['package.json']);
 if(JSON.stringify(pkg.componentSuite?.entries)!==JSON.stringify(entries)||pkg.componentSuite?.formatVersion!==1)throw Error('未知地图套件契约');
 for(const p of ['src/index.ts','src/heat-field/field.ts','src/heat-field/sampling.ts','adapters/patch-maplibre.mjs',...Object.values(entries).map(id=>'src/'+id+'/index.ts')])if(!files[p])throw Error('缺少依赖 '+p);
 for(const p of Object.keys(files))if(!/^(src\/[a-z0-9./-]+\.(ts|js|json)|adapters\/patch-maplibre\.mjs|components\/[a-z-]+\/(design|engineering)\.md|components\/[a-z-]+\/preset\.json|package\.json|provenance\.json|README\.md|suite-manifest\.json)$/.test(p))throw Error('非法套件文件 '+p);
 if(files['suite-manifest.json']){const m=json(files['suite-manifest.json']);const actual={...files};delete actual['suite-manifest.json'];if(JSON.stringify(m.files)!==JSON.stringify(manifest(actual)))throw Error('清单与源码不符');}
 return files;
}
export async function exportSuite(candidate,zip){
 const files=await check(candidate);delete files['suite-manifest.json'];files['suite-manifest.json']=Buffer.from(JSON.stringify({format:'map-component-suite',version:1,files:manifest(files),states:{design:'user-confirmed-R3-R4-R5',export:'generated',engineering:'pending',publication:'not-published'}},null,2));
 await safe(zip);await writeFile(zip,writeZip(files),{flag:'wx'});return {zip,files:Object.keys(files).length};
}
export async function unpackSuite(zip,out){
 const files=readZip(new Uint8Array(await readFile(zip)));
 if(!files['suite-manifest.json'])throw Error('缺少套件清单');
 const m=json(files['suite-manifest.json']),payload={...files};delete payload['suite-manifest.json'];
 if(m.format!=='map-component-suite'||m.version!==1||JSON.stringify(m.files)!==JSON.stringify(manifest(payload)))throw Error('清单与归档不符');
 await fresh(out);for(const [p,b] of Object.entries(files))await put(out,p,b);await check(out);return {unpacked:out};
}
async function plan(candidate,target,out){
 separate(candidate,out);separate(target,out);const files=await check(candidate),pkg=json(await readFile(join(target,'package.json')));
 if(pkg.name!=='@a3d/a3d-components')throw Error('目标不是组件库');
 const require=createRequire(join(target,'package.json'));
 for(const [name,version] of Object.entries({three:'0.185.1','maplibre-gl':'5.24.0','@turf/turf':'7.2.0'})){
  const installed=json(await readFile(join(target,'node_modules',name,'package.json'))).version;if(installed!==version)throw Error('待验证依赖版本 '+name+' '+installed);
 }
 const ts=require('typescript');
 for(const [file,data] of Object.entries(files).filter(([f])=>f.startsWith('src/')&&/\.(ts|js)$/.test(f))){
  const ast=ts.createSourceFile(file,data.toString(),ts.ScriptTarget.Latest,true);
  const inspect=node=>{
   if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||node.expression.getText(ast)==='require'))throw Error('地图套件不允许动态模块加载 '+file);
   if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier){
    const spec=node.moduleSpecifier.text;
    if(typeof spec!=='string')throw Error('非静态模块路径');
    if(spec.startsWith('.')){
     const dest=relative(resolve(candidate),resolve(candidate,dirname(file),spec)).replaceAll('\\','/');
     if(!dest.startsWith('src/')||![dest,dest+'.ts',dest+'.js',dest+'.json',dest+'/index.ts'].some(p=>files[p]))throw Error('未闭合依赖 '+file+' -> '+spec);
    }else if(spec==='geojson'&&node.importClause?.isTypeOnly){if(json(files['package.json']).devDependencies?.['@types/geojson']!=='7946.0.16')throw Error('缺少GeoJSON类型依赖');}
    else if(!['three','maplibre-gl','@turf/turf'].includes(spec)&&!spec.startsWith('three/addons/'))throw Error('未声明依赖 '+spec);
   }ts.forEachChild(node,inspect);
  };inspect(ast);
 }
 const entry=join(target,'src/map/index.ts');const program=ts.createProgram([entry],{moduleResolution:ts.ModuleResolutionKind.Bundler,module:ts.ModuleKind.ESNext,skipLibCheck:true});const checker=program.getTypeChecker(),sf=program.getSourceFile(entry);const names=checker.getExportsOfModule(checker.getSymbolAtLocation(sf)).map(s=>s.name);
 for(const name of [...Object.keys(entries),'HeatField'])if(names.includes(name))throw Error('公开名称冲突 '+name);
 const destination=join(target,'src/map/restored-map-suite');try{await lstat(destination);throw Error('目标已存在');}catch(e){if(e.code!=='ENOENT')throw e;}
 const result={format:'map-suite-plan',version:1,candidate:resolve(candidate),target:resolve(target),baseline:await baseline(target),files:manifest(files),destination:'src/map/restored-map-suite',status:'planned',sharedApply:false};await safe(out);await writeFile(out,JSON.stringify(result,null,2),{flag:'wx'});return result;
}
async function verify(planPath,work){
 const p=json(await readFile(planPath));if(p.format!=='map-suite-plan'||p.version!==1)throw Error('未知计划');
 if(p.destination!=='src/map/restored-map-suite'||!isAbsolute(p.target)||!isAbsolute(p.candidate)||p.sharedApply!==false)throw Error('非法计划目标');
 separate(p.target,work);separate(p.candidate,work);const files=await check(p.candidate);
 if(JSON.stringify(manifest(files))!==JSON.stringify(p.files)||await baseline(p.target)!==p.baseline)throw Error('输入已变化，须重新plan');
 await fresh(work);const copy=join(work,'library');await mkdir(copy);
 for(const e of await readdir(p.target,{withFileTypes:true})){
  if(['.git','node_modules','dist'].includes(e.name))continue;const f=join(p.target,e.name);await safe(f);if(e.isDirectory())await inventory(f);await cp(f,join(copy,e.name),{recursive:true,dereference:false});
 }
 await cp(join(p.target,'node_modules'),join(copy,'node_modules'),{recursive:true,dereference:true});
 for(const [f,b] of Object.entries(files))if(f.startsWith('src/'))await put(copy,p.destination+'/'+f.slice(4),b);
 // Adapters are explicit build inputs, never a hidden rewrite of the installed dependency.
 for(const [f,b] of Object.entries(files))if(f.startsWith('adapters/'))await put(work,'adapter/'+f.slice(9),Buffer.from(b.toString().replace('../src/heat-field/sampling.ts','../library/'+p.destination+'/heat-field/sampling.ts')));
 const barrel=join(copy,'src/map/index.ts');await writeFile(barrel,(await readFile(barrel,'utf8'))+"\nexport * from './restored-map-suite';\n");
 const results=[];function run(label,args){const r=spawnSync(process.execPath,args,{cwd:copy,encoding:'utf8',maxBuffer:32*1024*1024});results.push({label,exitCode:r.status});return writeFile(join(work,label+'.log'),(r.stdout||'')+(r.stderr||''));}
 await run('typecheck',['node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.app.json']);
 if(results.at(-1).exitCode===0)await run('build',['node_modules/vite/bin/vite.js','build']);
 const unchanged=await baseline(p.target)===p.baseline;
 const result={...p,work,results,sharedUnchanged:unchanged,engineering:results.length===2&&results.every(r=>r.exitCode===0)&&unchanged?'static-passed-runtime-pending':'failed',runtime:'not-run',publication:'not-published'};
 await writeFile(join(work,'verification.json'),JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [cmd,...a]=process.argv.slice(2);
 try{let r;if(cmd==='prepare'&&a.length===2)r=await prepare(...a);else if(cmd==='export'&&a.length===2)r=await exportSuite(...a);else if(cmd==='unpack'&&a.length===2)r=await unpackSuite(...a);else if(cmd==='plan'&&a.length===3)r=await plan(...a);else if(cmd==='verify'&&a.length===2)r=await verify(...a);else throw Error('map-suite.mjs prepare <sources> <new-candidate> | export <candidate> <new.zip> | unpack <zip> <new-dir> | plan <candidate> <library> <new-plan> | verify <plan> <new-work>');console.log(JSON.stringify(r,null,2));if(r.engineering==='failed')process.exitCode=1;}catch(e){console.error(e.stack);process.exitCode=1;}
}
