import {readFile,writeFile,mkdir,readdir,lstat,realpath,rename} from 'node:fs/promises';
import {resolve,dirname,join,relative,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {homedir} from 'node:os';
import {writeZip} from './zip.mjs';
import {checkTypeClosure} from './check-types.mjs';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
async function safe(p){for(let x=resolve(p);;x=dirname(x)){try{if((await lstat(x)).isSymbolicLink())throw Error('Linked path refused: '+x);}catch(e){if(e.code!=='ENOENT')throw e;}if(dirname(x)===x)break;}}
async function walk(root,prefix=''){const result=[];for(const e of await readdir(join(root,prefix),{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Linked input refused');if(['node_modules','.history','.cache','dist'].includes(e.name))continue;const p=prefix+e.name;if(e.isDirectory())result.push(...await walk(root,p+'/'));else result.push(p);}return result;}
await safe(project);
const component=join(project,'component'),meta=JSON.parse(await readFile(join(component,'package.json'),'utf8'));
if(meta.component?.formatVersion!==1||!['object3d','borrowed-host'].includes(meta.component.host)||meta.component.entry!=='src/index.ts'||meta.component.parameters!=='src/parameters.ts')throw Error('Unsupported native component contract');
if(Object.keys(meta.peerDependencies||{}).join(',')!=='three'||meta.peerDependencies.three!=='>=0.183.0 <0.190.0')throw Error('Native object profile requires the declared Three peer contract');
if(!Array.isArray(meta.component.assets)||meta.component.assets.length)throw Error('Native object asset adapter not implemented');
const base=join(process.env.LOCALAPPDATA||join(homedir(),'.cache'),'OctoComponentNative',createHash('sha256').update(project).digest('hex').slice(0,20));
await safe(base);await mkdir(base,{recursive:true});const cache=await realpath(base),stage=join(cache,'runs',randomUUID());await mkdir(stage,{recursive:true});
const sourceFiles=await walk(component);
for(const p of sourceFiles){if(!(/^src\/[\w/.-]+\.ts$/.test(p)||['package.json','preset.json','design.md','engineering.md'].includes(p)))throw Error('Unsupported component file: '+p);}
for(const group of ['component','example'])for(const p of await walk(join(project,group))){const dest=join(stage,group,p);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,await readFile(join(project,group,p)));}
const pkg=await readFile(join(project,'example/package.json'));const fingerprint=createHash('sha256').update(pkg).digest('hex');let previous='';try{previous=await readFile(join(cache,'.dependencies-hash'),'utf8');}catch{}
if(fingerprint!==previous){await writeFile(join(cache,'package.json'),pkg);const proc=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['install','--ignore-scripts','--no-audit','--no-fund'],{cwd:cache,stdio:'inherit',shell:process.platform==='win32'});if(proc.status!==0)throw Error('Native dependency installation failed');await writeFile(join(cache,'.dependencies-hash'),fingerprint);}
const tsModule=await import(pathToFileURL(join(cache,'node_modules/typescript/lib/typescript.js')));
await checkTypeClosure(tsModule.default||tsModule,join(stage,'component'),sourceFiles);
await writeFile(join(stage,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'bundler',strict:true,noUnusedLocals:true,noUnusedParameters:true,skipLibCheck:true,noEmit:true},include:['component/src/**/*.ts']}));
const tc=spawnSync(process.execPath,[join(cache,'node_modules/typescript/bin/tsc'),'-p',join(stage,'tsconfig.json')],{cwd:stage,stdio:'inherit'});if(tc.status!==0)throw Error('Native component typecheck failed');
const {build,transformWithEsbuild}=await import(pathToFileURL(join(cache,'node_modules/vite/dist/node/index.js')));
const componentStage=join(stage,'component');
function visit(node){if(!node||typeof node!=='object')return;if(node.type==='ImportExpression')throw Error('Native dynamic imports need a packaging adapter');if(node.type==='NewExpression'&&node.callee?.name==='URL')throw Error('Native resource URLs need an asset adapter');for(const x of Object.values(node))if(Array.isArray(x))x.forEach(visit);else if(x&&typeof x==='object')visit(x);}
await build({root:stage,configFile:false,logLevel:'silent',plugins:[{name:'native-boundary',enforce:'pre',async load(id){const p=relative(componentStage,id);if(p.startsWith('..')||p.includes('?')||!p.startsWith('src'+sep)||!p.endsWith('.ts'))throw Error('Component imports non-component source: '+id);const code=await readFile(id,'utf8');const parsed=await transformWithEsbuild(code,id,{loader:'ts',target:'esnext'});visit(this.parse(parsed.code));return null;}}],build:{write:false,minify:false,rollupOptions:{input:sourceFiles.filter(p=>p.endsWith('.ts')).map(p=>join(componentStage,p)),external:id=>id==='three'||id.startsWith('three/'),onwarn(w){if(w.code!=='EMPTY_BUNDLE')throw Error(w.message);},preserveEntrySignatures:'strict'}}});
if(process.argv.includes('--export-component')){const files={};for(const p of sourceFiles)files[p]=await readFile(join(component,p));files['component-source-manifest.json']=Buffer.from(JSON.stringify({formatVersion:2,deliveryType:'native-component-source',entry:meta.component.entry,states:{export:'generated',design:'unconfirmed',engineering:'not-run',publication:'unpublished'},files:Object.entries(files).map(([path,b])=>({path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')}))},null,2));const output=join(cache,'component-source.zip');await safe(output);await writeFile(output,writeZip(files));console.log('COMPONENT_SOURCE_PATH='+output);process.exit(0);}
const built=await build({root:stage,configFile:false,logLevel:'warn',build:{write:false,target:'esnext',minify:false,lib:{entry:join(stage,'example/main.mjs'),formats:['es']},rollupOptions:{output:{inlineDynamicImports:true}}}});
const outputs=(Array.isArray(built)?built:[built]).flatMap(x=>x.output);if(outputs.length!==1||outputs[0].type!=='chunk'||outputs[0].imports.length||outputs[0].dynamicImports.length)throw Error('Preview requires one inline module');
let html=await readFile(join(stage,'example/index.html'),'utf8');const entry=/<script type="module" src="main\.mjs"><\/script>/;if(!entry.test(html))throw Error('Preview entry missing');const payload=Buffer.from(outputs[0].code).toString('base64');
html=html.replace(entry,()=>`<script>(async()=>{let u;try{u=URL.createObjectURL(new Blob([Uint8Array.from(atob('${payload}'),c=>c.charCodeAt(0))],{type:'text/javascript'}));await import(u);}catch(e){document.getElementById('status').textContent='启动失败：'+e.message;console.error(e);}finally{if(u)URL.revokeObjectURL(u);}})();</script>`);
const output=join(project,'index.3d.html'),tmp=output+'.'+randomUUID()+'.tmp';await safe(output);await writeFile(tmp,html);await rename(tmp,output);console.log('HTML_PATH='+output);console.log('BUILD_WORKSPACE='+cache);
