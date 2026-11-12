import {readFile,writeFile,mkdir,readdir,lstat,rename,copyFile,realpath} from 'node:fs/promises';
import {resolve,dirname,join,posix} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';

export function cleanPath(p,mode='template') {
  if(p==='component/delivery.mjs')return 'example/delivery.mjs';
  if(p.startsWith('component/'))return 'component/src/'+p.slice(10);
  if(p.startsWith('vendor/')&&!p.endsWith('.tgz'))return 'component/'+p;
  if(p.startsWith('assets/'))return 'component/'+p;
  if(p.startsWith('scripts/'))return 'example/'+p;
  if(mode==='scene'&&p.startsWith('example/'))return p;
  if(mode==='template'&&p.startsWith('example/'))return 'example/src/'+p.slice(8);
  if(['preset.json','controls.json','sources.json','component-boundary.json','design.md','engineering.md','flow.md'].includes(p))return 'component/'+p;
  return 'example/'+p;
}
export function legacyPath(p,mode='template') {
  if(p==='example/delivery.mjs')return 'component/delivery.mjs';
  if(p.startsWith('component/src/'))return 'component/'+p.slice(14);
  if(p.startsWith('component/'))return p.slice(10);
  if(mode==='scene'&&p.startsWith('example/scan/'))return p;
  if(mode==='template'&&p.startsWith('example/src/'))return 'example/'+p.slice(12);
  return p.slice(8);
}
export {remap} from './build-support/remap.mjs';
import {remap} from './build-support/remap.mjs';
export async function safe(path) {
  for(let p=resolve(path);;p=dirname(p)) {
    try{if((await lstat(p)).isSymbolicLink())throw Error('Linked path refused: '+p);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(dirname(p)===p)break;
  }
}
export async function walk(root,prefix='') {
  const result=[];
  for(const e of await readdir(join(root,prefix),{withFileTypes:true})) {
    if(e.isSymbolicLink())throw Error('Linked input refused: '+e.name);
    if(['node_modules','.cache','.history','offline','dist'].includes(e.name))continue;
    const p=prefix+e.name;
    if(e.isDirectory())result.push(...await walk(root,p+'/'));else result.push(p);
  }
  return result;
}
export function cacheRoot(project) {
  return join(process.env.LOCALAPPDATA||join(homedir(),'.cache'),'OctoComponentBuild',createHash('sha256').update(resolve(project)).digest('hex').slice(0,20));
}
async function run(project) {
  await safe(project);
  const config=JSON.parse(await readFile(join(project,'example/build-config.json'),'utf8'));
  const mode=config.mode;
  if(!['scene','template'].includes(mode))throw Error('Unknown build mode');
  const requestedCache=cacheRoot(project);await safe(requestedCache);await mkdir(requestedCache,{recursive:true});
  // Windows packaged apps may virtualize LOCALAPPDATA; use one canonical path for Rollup.
  const cache=await realpath(requestedCache),deps=join(cache,'dependencies'),stage=join(deps,'runs',randomUUID());
  await mkdir(stage,{recursive:true});
  const projectFiles=(await walk(project)).filter(p=>p.startsWith('component/')||p.startsWith('example/'));
  for(const p of projectFiles) {
    if(['example/build.mjs','example/build-config.json'].includes(p)||p.startsWith('example/build-support/'))continue;
    const legacy=legacyPath(p,mode);const target=join(stage,legacy);await mkdir(dirname(target),{recursive:true});
    let bytes=await readFile(join(project,p));
    if(p==='example/package.json'&&config.canonicalScripts){const pkg=JSON.parse(bytes);pkg.scripts=config.canonicalScripts;bytes=Buffer.from(JSON.stringify(pkg,null,2)+'\n');}
    if(p==='component/component-boundary.json') {const b=JSON.parse(bytes);b.entry='component/'+b.entry.replace(/^src\//,'');b.schema='component/'+b.schema.replace(/^src\//,'');bytes=Buffer.from(JSON.stringify(b));}
    else if(/\.(mjs|js|ts|mts|vue|css)$/.test(p))bytes=Buffer.from(remap(bytes.toString('utf8'),p,legacy,x=>legacyPath(x,mode)));
    await writeFile(target,bytes);
  }
  const pkg=await readFile(join(stage,'package.json'));const fingerprint=createHash('sha256').update(pkg).digest('hex');
  let previous='';try{previous=await readFile(join(deps,'.dependencies-hash'),'utf8');}catch{}
  if(previous!==fingerprint) {
    await writeFile(join(deps,'package.json'),pkg);
    try{await copyFile(join(stage,'package-lock.json'),join(deps,'package-lock.json'));}catch(e){if(e.code!=='ENOENT')throw e;}
    // Local dependency archives are copied, never linked to a shared library.
    for(const p of await walk(stage))if(p.startsWith('vendor/')&&p.endsWith('.tgz')) {await mkdir(join(deps,'vendor'),{recursive:true});await copyFile(join(stage,p),join(deps,p));}
    const npm=process.platform==='win32'?'npm.cmd':'npm';
    const install=spawnSync(npm,['install','--ignore-scripts','--no-audit','--no-fund'],{cwd:deps,stdio:'inherit',shell:process.platform==='win32'});
    if(install.status!==0)throw Error('External local dependency install failed');
    await writeFile(join(deps,'.dependencies-hash'),fingerprint);
  }
  const exec=(script,env={})=>{const p=spawnSync(process.execPath,[join(stage,script)],{cwd:stage,stdio:'inherit',env:{...process.env,...env}});if(p.status!==0)throw Error('Build step failed: '+script);};
  const {collectComponent}=await import(pathToFileURL(join(stage,'scripts/component-source.mjs')));
  const closure=await collectComponent(stage);
  if(process.argv.includes('--export-component')) {
    const {writeZip}=await import(pathToFileURL(join(stage,'scripts/zip.mjs')));
    const files={};
    for(const legacy of Object.keys(closure.files)) {
      const path=cleanPath(legacy,mode);if(!path.startsWith('component/'))throw Error('Non-component export');
      files[path.slice(10)]=await readFile(join(project,path));
    }
    for(const p of projectFiles.filter(p=>p.startsWith('component/')&&(/\.md$|\.d\.mts$/.test(p))))files[p.slice(10)]=await readFile(join(project,p));
    const boundary=JSON.parse(files['component-boundary.json']);
    files['component-source-manifest.json']=Buffer.from(JSON.stringify({formatVersion:1,deliveryType:'component-source',entry:boundary.entry,design:'unconfirmed',engineering:'not-run',publication:'unpublished',files:Object.entries(files).map(([path,b])=>({path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')}))},null,2));
    const output=join(cache,'component-source.zip');await safe(output);await writeFile(output,writeZip(files));console.log('COMPONENT_SOURCE_PATH='+output);return;
  }
  let html;
  if(mode==='template') {exec('scripts/prepare.mjs');exec('scripts/build-preview.mjs');html=await readFile(join(stage,'index.3d.html'),'utf8');}
  else {
    exec('scripts/build-offline.mjs',{SCENE3D_BUILD_ONLY:'1'});
    html=await readFile(join(stage,'offline/index.3d.html'),'utf8');
    // Preserve execution order while making local preview resources self-contained.
    for(const match of [...html.matchAll(/<script src="\.\/([^"?#]+)"><\/script>/g)]) {
      const bytes=await readFile(join(stage,'offline',match[1]));
      html=html.replace(match[0],'<script src="data:text/javascript;base64,'+bytes.toString('base64')+'"></script>');
    }
    for(const match of [...html.matchAll(/<link rel="stylesheet" href="\.\/([^"?#]+)">/g)]) {
      const bytes=await readFile(join(stage,'offline',match[1]));
      html=html.replace(match[0],'<link rel="stylesheet" href="data:text/css;base64,'+bytes.toString('base64')+'">');
    }
    if(/(?:src|href)="\.\//.test(html))throw Error('Unembedded local HTML dependency');
  }
  const output=join(project,'index.3d.html'),temp=output+'.'+randomUUID()+'.tmp';await safe(output);await writeFile(temp,html);await rename(temp,output);
  console.log('HTML_PATH='+output);console.log('BUILD_WORKSPACE='+cache);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await run(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
