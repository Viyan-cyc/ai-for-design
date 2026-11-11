import {mkdir,writeFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {collectComponent} from './component-source.mjs';
import {writeZip} from './zip.mjs';
const root=new URL('../',import.meta.url);
const {files,boundary}=await collectComponent(fileURLToPath(root));
const {validate}=await import('../component/schema.mjs');validate(JSON.parse(files['preset.json']));
const sha=b=>createHash('sha256').update(b).digest('hex');
files['component-source-manifest.json']=Buffer.from(JSON.stringify({formatVersion:1,deliveryType:'component-source',entry:boundary.entry,hostContract:boundary.hostContract,design:'unconfirmed',engineering:'not-run',publication:'unpublished',files:Object.entries(files).map(([path,b])=>({path,bytes:b.length,sha256:sha(b)}))},null,2));
const out=new URL('dist/',root);await mkdir(out,{recursive:true});if((await lstat(out)).isSymbolicLink())throw Error('Linked export output');
const target=new URL('component-source.zip',out);
try{if((await lstat(target)).isSymbolicLink())throw Error('Linked export file');}catch(e){if(e.code!=='ENOENT')throw e;}
await writeFile(target,writeZip(files));console.log('COMPONENT_SOURCE_PATH='+fileURLToPath(target));
