import {readFile,writeFile,mkdir,readdir,lstat,rename,realpath} from 'node:fs/promises';
import {resolve,join,dirname,relative,sep} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
const [sourceArg,projectArg,...extra]=process.argv.slice(2);if(!sourceArg||!projectArg||extra.length)throw Error('Usage: node copy-host.mjs <scene-root> <component-project>');
async function safe(path){for(let p=resolve(path);;p=dirname(p)){try{const s=await lstat(p);if(s.isSymbolicLink())throw Error('Linked path refused: '+p);}catch(e){if(e.code!=='ENOENT')throw e;}if(dirname(p)===p)break;}}
await safe(sourceArg);await safe(projectArg);const source=await realpath(sourceArg),project=await realpath(projectArg);
const inside=(a,b)=>{const p=relative(a,b);return p===''||(!p.startsWith('..'+sep)&&p!=='..'&&!p.startsWith(sep)&&!p.includes(':'));};
if(inside(source,project)||inside(project,source))throw Error('Source and destination projects must not contain each other');
const meta=JSON.parse(await readFile(join(project,'component/package.json'),'utf8'));if(meta.component?.host!=='borrowed-host')throw Error('Destination must be a native-host project');
const example=join(project,'example');await safe(example);const target=join(example,'host');try{await lstat(target);throw Error('Host copy already exists; edit that copy, do not overwrite');}catch(e){if(e.code!=='ENOENT')throw e;}
const excluded=new Set(['node_modules','.git','.cache','.npm-cache','.history','dist','preview','offline','index.3d.html']);
async function list(root,prefix=''){const files=[];for(const e of await readdir(join(root,prefix),{withFileTypes:true})){if(excluded.has(e.name))continue;if(e.isSymbolicLink())throw Error('Linked source refused: '+e.name);const p=prefix+e.name;if(e.isDirectory())files.push(...await list(root,p+'/'));else if(e.isFile())files.push(p);else throw Error('Unsupported source entry');}return files.sort();}
const files=await list(source);if(!files.length)throw Error('No scene source files to copy');const stage=join(example,'.host-copy-'+randomUUID());await mkdir(stage);const records=[];const hash=b=>createHash('sha256').update(b).digest('hex');
for(const p of files){const bytes=await readFile(join(source,p)),dest=join(stage,p);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'});records.push({path:p,sha256:hash(bytes),bytes:bytes.length});}
if(JSON.stringify(files)!==JSON.stringify(await list(source)))throw Error('Source changed during copy; staging copy retained, source untouched');
for(const x of records)if(hash(await readFile(join(source,x.path)))!==x.sha256)throw Error('Source changed during copy; staging copy retained, source untouched');
await rename(stage,target);await writeFile(join(example,'host-copy.json'),JSON.stringify({source,files:records,excluded:[...excluded],integration:'not-adapted'},null,2),{flag:'wx'});
console.log('HOST_COPY_PATH='+target);console.log('Source is unchanged. Adapt only this copy; copying does not connect the component automatically.');
