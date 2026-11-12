import {readFile,writeFile,readdir,lstat,mkdir,cp,rename,unlink,rmdir} from 'node:fs/promises';
import {resolve,join,dirname,relative,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {inspectApi,renderDocs} from './docs.mjs';
import {checkTypeClosure} from '../native-template/example/check-types.mjs';

export const hash = b => createHash('sha256').update(b).digest('hex');
const json = b => JSON.parse(b.toString());
const bytes = async p => {try{return await readFile(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const exists = async p => (await bytes(p)) !== null;
export async function safe(p) {
  for(let a=resolve(p);;a=dirname(a)) {try{if((await lstat(a)).isSymbolicLink())throw Error('拒绝链接：'+a);}catch(e){if(e.code!=='ENOENT')throw e;} if(dirname(a)===a)break;}
}
async function files(root, prefix='') {
  await safe(root);const out={};
  for(const e of await readdir(join(root,prefix),{withFileTypes:true})) {
    const rel=(prefix?prefix+'/':'')+e.name, p=join(root,rel);
    if(e.isSymbolicLink())throw Error('拒绝链接：'+p);
    if(e.isDirectory())Object.assign(out,await files(root,rel));
    else if(e.isFile())out[rel]=(await readFile(p)).toString('base64');else throw Error('特殊文件：'+p);
  }return out;
}
const digest = map => hash(JSON.stringify(Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,hash(Buffer.from(v,'base64'))])));
export async function baseline(target) {
  const all={};
  for(const dir of ['src','docs','scripts'])Object.assign(all,Object.fromEntries(Object.entries(await files(join(target,dir))).map(([k,v])=>[dir+'/'+k,v])));
  for(const f of (await readdir(target)).filter(f=>/^(package.*\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|tsconfig.*\.json|vite\.config\..*)$/.test(f))) {await safe(join(target,f));all[f]=(await readFile(join(target,f))).toString('base64');}
  return digest(all);
}
export async function categories(target) {
  await safe(target);const pkg=json(await readFile(join(target,'package.json')));
  if(pkg.name!=='@a3d/a3d-components')throw Error('目标不是a3d组件库');
  const result=[];for(const k of Object.keys(pkg.exports))if(/^\.\/[a-z][a-z0-9-]*$/.test(k)&&await exists(join(target,'src',k.slice(2),'index.ts')))result.push(k.slice(2));return result;
}
function contained(parent,child){const r=relative(parent,child);return !r||(!r.startsWith('..'+sep)&&r!=='..'&&!resolve(child).startsWith('\\\\')&& !r.includes(':'));}
async function source(candidate) {
  const payload=await files(candidate), pkg=json(Buffer.from(payload['package.json']||'','base64')), c=pkg.component;
  if(c?.formatVersion!==1||!['object3d','borrowed-host'].includes(c.host)||c.entry!=='src/index.ts'||c.parameters!=='src/parameters.ts'||!Array.isArray(c.assets)||c.assets.length)throw Error('只接纳原生Three无资源组件契约1');
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(c.id))throw Error('无效component.id');
  if(JSON.stringify(pkg.peerDependencies)!==JSON.stringify({three:'>=0.183.0 <0.190.0'})||pkg.dependencies)throw Error('本批仅支持既定Three peer；依赖变化须单独计划');
  if(payload['component-source-manifest.json']) {
    const manifest=json(Buffer.from(payload['component-source-manifest.json'],'base64'));
    if(manifest.formatVersion!==2||manifest.deliveryType!=='native-component-source'||manifest.entry!==c.entry||!Array.isArray(manifest.files))throw Error('导出清单格式不兼容');
    const seen=new Set();for(const f of manifest.files){if(seen.has(f.path)||f.path==='component-source-manifest.json'||!payload[f.path])throw Error('导出清单文件冲突');seen.add(f.path);const b=Buffer.from(payload[f.path],'base64');if(f.bytes!==b.length||f.sha256!==hash(b))throw Error('导出清单与源码不符：'+f.path);}
    if(seen.size!==Object.keys(payload).length-1)throw Error('导出清单文件集合不符');
  }
  for(const f of Object.keys(payload))if(!/^src\/.+\.ts$/.test(f)&&!['package.json','preset.json','design.md','engineering.md','component-source-manifest.json'].includes(f))throw Error('组件混入非契约文件：'+f);
  for(const f of ['src/index.ts','src/parameters.ts','design.md','engineering.md'])if(!payload[f])throw Error('缺少 '+f);
  return {payload,pkg,c};
}
export async function planIntake({candidate,target,category,names,update=false,demo}) {
  candidate=resolve(candidate);target=resolve(target);if(contained(candidate,target)||contained(target,candidate))throw Error('候选和目标不能嵌套');
  if(!(await categories(target)).includes(category))throw Error('请指定已有分类；新分类须单独计划');
  if(!Array.isArray(names)||!names.length||new Set(names).size!==names.length||names.some(n=>!/^[$A-Z_a-z][$\w]*$/.test(n)))throw Error('显式指定公开类/工厂名称');
  const {payload,pkg,c}=await source(candidate), lib=json(await readFile(join(target,'package.json')));
  if(lib.peerDependencies?.three!==pkg.peerDependencies.three)throw Error('Three peer冲突');
  const registry='docs/intake/'+c.id+'.json', priorBytes=await bytes(join(target,registry)), prior=priorBytes&&json(priorBytes);
  if(prior?.owned?.['docs/components/'+c.id+'/demo.ts']&&!demo)throw Error('更新已有Demo必须重新提供适配器');
  if(prior&&!update)throw Error('已登记；更新须显式--update');
  if(!prior&&update)throw Error('未登记组件不能update');
  if(prior&&(prior.category!==category||JSON.stringify(prior.names)!==JSON.stringify(names)))throw Error('重分类/公开名改动须另行迁移');
  if(prior)for(const [f,h] of Object.entries(prior.owned)){await safe(join(target,f));if(hash(await readFile(join(target,f)))!==h)throw Error('生成文件已被修改：'+f);}
  const base='src/'+category+'/'+c.id, doc='docs/components/'+c.id;
  if(!prior)for(const p of [base,doc]){try{await lstat(join(target,p));throw Error('目标路径已存在：'+p);}catch(e){if(e.code!=='ENOENT')throw e;}}
  const {ts,api}=inspectApi(target,join(candidate,'src/index.ts'),names);
  await checkTypeClosure(ts,candidate,Object.keys(payload).filter(f=>f.startsWith('src/')));
  for(const [file,b] of Object.entries(payload).filter(([f])=>f.startsWith('src/'))) {
    const syntax=ts.createSourceFile(file,Buffer.from(b,'base64').toString(),ts.ScriptTarget.Latest,true);
    function visit(node){
      if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||(ts.isIdentifier(node.expression)&&node.expression.text==='require')))throw Error('动态加载须单独适配：'+file);
      if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='URL')throw Error('资源URL须单独适配：'+file);
      ts.forEachChild(node,visit);
    }visit(syntax);
  }
  // All exported category names matter, including inherited export-star names.
  const entries=(await categories(target)).map(k=>join(target,'src',k,'index.ts'));
  const program=ts.createProgram(entries,{moduleResolution:ts.ModuleResolutionKind.Bundler,module:ts.ModuleKind.ESNext,skipLibCheck:true}), checker=program.getTypeChecker();
  for(const entry of entries){const sf=program.getSourceFile(entry);for(const sym of checker.getExportsOfModule(checker.getSymbolAtLocation(sf)))if(names.includes(sym.name)&&!(prior&&entry===join(target,'src',category,'index.ts')))throw Error('库公开名称冲突：'+sym.name+' ('+entry+')');}
  const operations={};for(const [f,b] of Object.entries(payload))if(f.startsWith('src/'))operations[base+'/'+f.slice(4)]=b;
  if(prior&&Object.keys(prior.owned).some(f=>f.startsWith(base+'/')&&!(f in operations)))throw Error('更新包含删除/重命名；须另行迁移');
  const barrel='src/'+category+'/index.ts', marker=`// intake:${c.id}`;
  let barrelText=(await readFile(join(target,barrel),'utf8'));
  const line=`export { ${names.join(', ')} } from './${c.id}'; ${marker}`;
  if(prior){if(!barrelText.includes(prior.barrelLine))throw Error('入口登记被修改');barrelText=barrelText.replace(prior.barrelLine,line);}else barrelText+='\n'+line+'\n';
  operations[barrel]=Buffer.from(barrelText).toString('base64');
  let nav=await readFile(join(target,'docs/index.html'),'utf8');
  const navLine=`<a href="#${c.id}" class="nav-item nav-page" data-page="${c.id}">${names.join(', ')}</a><!-- intake:${c.id} -->`;
  if(prior){if(!nav.includes(prior.navLine))throw Error('导航登记被修改');nav=nav.replace(prior.navLine,navLine);}else {
    const pattern=new RegExp(`(<div class="nav-group" data-group="${category}">[\\s\\S]*?<div class="nav-children">)`);
    if(!pattern.test(nav))throw Error('分类缺少现有文档导航容器；需明确扩展计划');nav=nav.replace(pattern,'$1\n'+navLine);
  }
  operations['docs/index.html']=Buffer.from(nav).toString('base64');
  for(const f of ['design.md','engineering.md','preset.json'])if(payload[f])operations[doc+'/'+f]=payload[f];
  operations[doc+'/component-package.json']=payload['package.json'];
  let demoSource;
  if(demo){await safe(demo);demoSource=(await readFile(demo)).toString();
    const ts=inspectApi(target,join(candidate,'src/index.ts'),names).ts;
    const ast=ts.createSourceFile('demo.ts',demoSource,ts.ScriptTarget.Latest,true);
    let usesComponent=false;const edits=[];
    function inspect(node){
      if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)){
        const name=node.moduleSpecifier?.text;
        if(name!==undefined){if(!['@component','@parameters','three'].includes(name)&&!name.startsWith('three/addons/'))throw Error('Demo只允许组件、参数和Three导入：'+name);if(name==='@component')usesComponent=true;if(name==='@component'||name==='@parameters')edits.push({start:node.moduleSpecifier.getStart(ast),end:node.moduleSpecifier.end,text:JSON.stringify(name==='@component'?'../../../src/'+category+'/index':'../../../'+base+'/parameters')});}
      }
      if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||node.expression.getText(ast)==='require'))throw Error('Demo不允许动态导入/require');
      ts.forEachChild(node,inspect);
    }inspect(ast);if(!usesComponent)throw Error('Demo必须导入@component实际接纳组件');
    let rewritten=demoSource;for(const edit of edits.sort((a,b)=>b.start-a.start))rewritten=rewritten.slice(0,edit.start)+edit.text+rewritten.slice(edit.end);
    operations[doc+'/demo.ts']=Buffer.from(rewritten).toString('base64');
  }
  const plan={demo:demo?{path:resolve(demo),hash:hash(demoSource)}:null,version:1,id:c.id,candidate,target,category,names,host:c.host,api,sourceDigest:digest(payload),baseline:await baseline(target),payload,operations,base,doc,registry,barrelLine:line,navLine,prior:!!prior,status:'planned'};
  await checkOwnership(plan);
  return plan;
}
// A matching baseline proves freshness, not permission to take over existing files.
// Include the HTML destination now, even though validate generates its content later.
async function checkOwnership(plan) {
  const priorBytes=await bytes(join(plan.target,plan.registry));
  const owned=priorBytes?json(priorBytes).owned:{};
  const destinations=new Set([...Object.keys(plan.operations),plan.doc+'/index.html']);
  for(const rel of destinations){
    if(!rel.startsWith(plan.base+'/')&&!rel.startsWith(plan.doc+'/'))continue;
    if(Object.hasOwn(owned,rel))continue;
    await safe(join(plan.target,rel));
    try{await lstat(join(plan.target,rel));}
    catch(e){if(e.code==='ENOENT')continue;throw e;}
    throw Error('未登记的既存文件冲突，拒绝接管：'+rel);
  }
}
async function verifyPlan(plan) {
  if(plan.demo){await safe(plan.demo.path);if(hash(await readFile(plan.demo.path))!==plan.demo.hash)throw Error('Demo已变化；重新plan');}
  if(plan.version!==1)throw Error('未知计划版本');
  if(digest((await source(plan.candidate)).payload)!==plan.sourceDigest)throw Error('候选已变化；重新plan');
  if(await baseline(plan.target)!==plan.baseline)throw Error('目标已变化；重新plan/validate');
  await checkOwnership(plan);
}
function run(copy,args,log) {
  const r=spawnSync(process.execPath,args,{cwd:copy,encoding:'utf8',maxBuffer:32*1024*1024});
  return writeFile(log,(r.stdout||'')+(r.stderr||'')).then(()=>{if(r.status!==0)throw Error('验证失败：'+log);});
}
async function writeOperations(target,operations) {for(const [rel,b] of Object.entries(operations)){const p=join(target,rel);await safe(p);await mkdir(dirname(p),{recursive:true});await writeFile(p,Buffer.from(b,'base64'));}}

export async function validateDemoTypes(copy,entryPath,work){
    const ts=createRequire(join(copy,'package.json'))('typescript');
    entryPath=resolve(entryPath);
    const virtual=join(dirname(entryPath),'.demo-contract-check.ts');
    const code=`import {initDemo} from ${JSON.stringify('./'+entryPath.split(/[\\/]/).pop().replace(/\.ts$/,''))};
declare const canvas: HTMLCanvasElement;
declare const ctrl: HTMLElement;
const original = initDemo;
const mount: (canvas:HTMLCanvasElement,ctrl:HTMLElement)=>()=>void = initDemo;
const dispose = mount(canvas,ctrl);
const completed = dispose();`;
    const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,skipLibCheck:true,noEmit:true,strictNullChecks:true,strictFunctionTypes:true};
    const host=ts.createCompilerHost(options),original=host.getSourceFile.bind(host);
    host.getSourceFile=(file,...args)=>resolve(file)===virtual?ts.createSourceFile(file,code,ts.ScriptTarget.ES2022,true):original(file,...args);
    const program=ts.createProgram([entryPath,virtual],options,host);
    const baselineProgram=ts.createProgram([entryPath],{...options,strictNullChecks:false,strictFunctionTypes:false});
    const errors=[...ts.getPreEmitDiagnostics(baselineProgram),...ts.getPreEmitDiagnostics(program).filter(d=>!d.file||[entryPath,virtual].includes(resolve(d.file.fileName)))];await writeFile(join(work,'demo-types.log'),ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>copy,getNewLine:()=> '\n'}));if(errors.length)throw Error('Demo调用契约类型检查失败：须接收DOM并返回可无参调用的同步释放函数');
    const checker=program.getTypeChecker(),fixture=program.getSourceFile(virtual);
    for(const statement of fixture.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){
      if(!['original','dispose','completed'].includes(declaration.name.getText(fixture)))continue;
      const type=checker.getTypeAtLocation(declaration.name);const expanded=[type];if(declaration.name.getText(fixture)==='original')for(const sig of type.getCallSignatures()){const returned=checker.getReturnTypeOfSignature(sig);expanded.push(returned);for(const cleanup of returned.getCallSignatures())expanded.push(checker.getReturnTypeOfSignature(cleanup));}const parts=expanded.flatMap(t=>t.isUnion()?t.types:[t]);
      if(parts.some(t=>t.flags&(ts.TypeFlags.Any|ts.TypeFlags.Unknown)||t.getProperty('then')))throw Error('Demo释放契约不允许any/unknown或异步返回');
    }

}

/** The original target is read-only during validation. */
export async function validateIntake(plan,work,{runtimeTest}={}) {
  await verifyPlan(plan);work=resolve(work);await safe(work);
  if(contained(plan.target,work)||contained(work,plan.target)||contained(plan.candidate,work))throw Error('验证目录必须独立');
  try{await lstat(work);throw Error('验证目录已存在，使用新目录');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(!runtimeTest)throw Error('必须指定开发审阅过的独立运行验证脚本');
  await safe(runtimeTest);const testBytes=await readFile(runtimeTest);
  await mkdir(work,{recursive:true});const copy=join(work,'library');await mkdir(copy);
  for(const e of await readdir(plan.target,{withFileTypes:true})){
    if(['.git','dist','node_modules'].includes(e.name))continue;
    const p=join(plan.target,e.name);await safe(p);
    if(e.isDirectory())await files(p); // reject nested links before copying
    await cp(p,join(copy,e.name),{recursive:true,dereference:false});
  }
  // Real dependency copies; no junction back into the shared workspace.
  await cp(join(plan.target,'node_modules'),join(copy,'node_modules'),{recursive:true,dereference:true});
  await writeOperations(copy,plan.operations);
  await run(copy,['node_modules/typescript/bin/tsc','--noEmit','-p','tsconfig.app.json'],join(work,'typecheck.log'));
  await run(copy,['node_modules/vite/bin/vite.js','build'],join(work,'build.log'));
  const require=createRequire(join(copy,'package.json')), esbuild=require('esbuild');
  const paramsFile=join(copy,'.intake-parameters.cjs');
  await esbuild.build({entryPoints:[join(copy,plan.base,'parameters.ts')],outfile:paramsFile,bundle:true,platform:'node',format:'cjs',external:['three','three/*']});
  const params=require(paramsFile), {api}=inspectApi(copy,join(copy,plan.base,'index.ts'),plan.names);
  const operations={...plan.operations};
  operations[plan.doc+'/index.html']=Buffer.from(renderDocs(plan,api,params,Buffer.from(plan.payload['design.md'],'base64').toString(),Buffer.from(plan.payload['engineering.md'],'base64').toString())).toString('base64');
  if(!plan.prior)operations[plan.doc+'/notes.md']=Buffer.from('# 补充说明\n\n此文件由维护者编辑，组件更新不会覆盖。\n').toString('base64');
  await writeOperations(copy,operations);
  if(plan.demo){
    await esbuild.build({entryPoints:[join(copy,plan.doc,'demo.ts')],outfile:join(work,'demo-bundle.js'),bundle:true,platform:'browser',format:'esm'});
    await validateDemoTypes(copy,join(copy,plan.doc,'demo.ts'),work);
  }
  await run(copy,['scripts/gen-component-docs.mjs'],join(work,'docs.log'));
  operations['docs/components.json']=(await readFile(join(copy,'docs/components.json'))).toString('base64');
  const catalog=json(Buffer.from(operations['docs/components.json'],'base64'));
  if(!JSON.stringify(catalog).includes('@a3d/a3d-components/'+plan.category)||!JSON.stringify(catalog).includes(plan.names[0]))throw Error('文档索引缺少接纳组件');
  const localTest=join(copy,'.intake-runtime.mjs');await writeFile(localTest,testBytes);
  await run(copy,[localTest,copy,plan.category,...plan.names],join(work,'runtime.log'));
  await verifyPlan(plan);
  const owned=Object.fromEntries(Object.entries(operations).filter(([f])=>f.startsWith(plan.base+'/')||(f.startsWith(plan.doc+'/')&&!f.endsWith('/notes.md'))).map(([f,b])=>[f,hash(Buffer.from(b,'base64'))]));
  operations[plan.registry]=Buffer.from(JSON.stringify({id:plan.id,category:plan.category,names:plan.names,owned,barrelLine:plan.barrelLine,navLine:plan.navLine},null,2)+'\n').toString('base64');
  await writeOperations(join(work,'proposed'),operations);
  const changes=[];
  for(const [file,b] of Object.entries(operations)){const old=await bytes(join(plan.target,file)),next=Buffer.from(b,'base64');changes.push({file,action:old===null?'add':old.equals(next)?'unchanged':'modify',before:old&&hash(old),after:hash(next)});}
  await writeFile(join(work,'changes.json'),JSON.stringify(changes,null,2));
  await writeFile(join(work,'changes.md'),'# 拟应用文件\n\n所有拟写内容在 proposed/ 内，按目标库相对路径排列。原文件仍在目标库；apply之前可逐文件对照。\n\n'+changes.map(c=>'- '+c.action+': `'+c.file+'`').join('\n')+'\n');
  const receipt={...plan,operations,status:'validated',runtimeTest:resolve(runtimeTest),runtimeTestHash:hash(testBytes),validationWork:work};
  receipt.payloadDigest=digest(operations);await writeFile(join(work,'receipt.json'),JSON.stringify(receipt,null,2));return receipt;
}

/** All inputs are trusted local review artifacts, not cryptographically signed approvals. */
export async function applyIntake(receipt,{developerConfirmed=false,onWrite}={}) {
  if(!developerConfirmed||receipt.status!=='validated'||receipt.payloadDigest!==digest(receipt.operations))throw Error('需要已验证回执和显式开发确认');
  await verifyPlan(receipt);
  const lock=join(receipt.target,'.component-intake.lock');await safe(lock);
  const handle=await (await import('node:fs/promises')).open(lock,'wx');
  const backup={},written=[],createdDirs=new Set();let failure;
  try {
    await verifyPlan(receipt);
    for(const rel of Object.keys(receipt.operations)){
      if(!rel||rel.includes('\\')||rel.split('/').some(s=>!s||s==='.'||s==='..')||!['src/','docs/'].some(s=>rel.startsWith(s)))throw Error('非法写入路径');
      const p=join(receipt.target,rel);await safe(p);backup[rel]=await bytes(p);
    }
    await verifyPlan(receipt);
    for(const [rel,b] of Object.entries(receipt.operations)){
      const p=join(receipt.target,rel);await safe(p);
      if(backup[rel]?.equals(Buffer.from(b,'base64')))continue;
      for(let d=dirname(p);d!==receipt.target;d=dirname(d)){try{await lstat(d);break;}catch(e){if(e.code!=='ENOENT')throw e;createdDirs.add(d);}}
      await mkdir(dirname(p),{recursive:true});const temp=p+'.intake-'+randomUUID();
      try{await writeFile(temp,Buffer.from(b,'base64'),{flag:'wx'});const now=await bytes(p);if((now===null)!==(backup[rel]===null)||(now&&!now.equals(backup[rel])))throw Error('写入前检测到并发修改：'+rel);await rename(temp,p);}finally{await unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
      written.push(rel);await onWrite?.(rel,written.length);
    }
  } catch(e) {
    failure=e;
    for(const rel of written.reverse()){
      const p=join(receipt.target,rel),now=await bytes(p);
      if(!now?.equals(Buffer.from(receipt.operations[rel],'base64'))){failure=new Error(e.message+'；并发修改未覆盖，需人工恢复：'+rel);continue;}
      if(backup[rel]===null)await unlink(p);else await writeFile(p,backup[rel]);
    }
    // Never recursively remove a directory: a concurrent writer may have added a file.
    for(const dir of [...createdDirs].sort((a,b)=>b.length-a.length))await rmdir(dir).catch(e=>{if(!['ENOENT','ENOTEMPTY','EEXIST'].includes(e.code))throw e;});
  } finally {await handle.close();await unlink(lock);}
  if(failure)throw failure;return {status:'applied',id:receipt.id,files:written};
}
