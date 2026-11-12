import {readFile,writeFile,readdir,mkdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const tool=new URL('../',import.meta.url),target=new URL('../../../skills/create-3d-component/assets/runtime/',import.meta.url),files={},sources=[];
const sha=b=>createHash('sha256').update(b).digest('hex');
async function collect(base,prefix,relative=''){for(const e of await readdir(new URL(relative,base),{withFileTypes:true})){if(e.isSymbolicLink())throw Error('No linked resources');const name=relative+e.name;if(e.isDirectory())await collect(base,prefix,name+'/');else{const bytes=await readFile(new URL(name,base));files[prefix+name]=bytes;sources.push({output:prefix+name,sha256:sha(bytes)});}}}
// Share actual generator theme tokens; generated skill remains standalone.
const editorCSS=await readFile(new URL('../../../skills/generate-3d-scene/template/src/edit/styles/editor.css',import.meta.url),'utf8');
const tokens=editorCSS.match(/\.edit-scope\s*\{[^}]+\}/)?.[0];
if(!tokens||!tokens.includes('--ed-accent:'))throw Error('Generator editor tokens missing');
const previewURL=new URL('authoring-template/example/index.html',tool);
const previewHTML=await readFile(previewURL,'utf8');
if(!previewHTML.includes('/* editor-tokens:start */'))throw Error('Preview theme markers missing');
await writeFile(previewURL,previewHTML.replace(/\/\* editor-tokens:start \*\/[\s\S]*?\/\* editor-tokens:end \*\//,()=> '/* editor-tokens:start */\n'+tokens+'\n/* editor-tokens:end */'));
await collect(new URL('dist/',tool),'debug/');await collect(new URL('authoring-template/',tool),'template/');
await collect(new URL('layout/',tool),'layout/');
await writeFile(new URL('native-template/example/index.html',tool),await readFile(previewURL));
await writeFile(new URL('native-template/example/zip.mjs',tool),(await readFile(new URL('src/zip.mjs',tool),'utf8')).replace("import {requireThat as check} from './contract.mjs';","const check=(ok,message)=>{if(!ok)throw Error(message);};").replace('LIMIT=2*','LIMIT=8*').replace('count<=16','count<=64'));
await collect(new URL('native-template/',tool),'native/');
for(const name of ['build.mjs','check-types.mjs','zip.mjs','index.html'])await writeFile(new URL('host-template/example/'+name,tool),await readFile(new URL('native-template/example/'+name,tool)));
await collect(new URL('host-template/',tool),'host/');
// Built entry is relocatable under either its own server root or a subdirectory.
files['debug/index.html']=Buffer.from(files['debug/index.html'].toString().replaceAll('"/assets/','"./assets/'));
const three=JSON.parse(await readFile(new URL('node_modules/three/package.json',tool),'utf8'));if(three.version!=='0.185.1')throw Error('Unexpected Three version');
for(const name of ['three.module.js','three.core.js'])files['template/vendor/'+name]=await readFile(new URL('node_modules/three/build/'+name,tool));
files['template/vendor/LICENSE']=await readFile(new URL('node_modules/three/LICENSE',tool));
files['debug/licenses/three-LICENSE']=files['template/vendor/LICENSE'];
files['debug/licenses/gsap-package.json']=await readFile(new URL('node_modules/gsap/package.json',tool));
files['debug/licenses/gsap-notice.txt']=Buffer.from((await readFile(new URL('node_modules/gsap/dist/gsap.js',tool),'utf8')).match(/\/\*![\s\S]*?\*\//)?.[0]+'\nLocal review bundle; redistribution terms remain those declared by GSAP. Not a publication grant.\n');
files['debug/baseline.json']=await readFile(new URL('src/baseline.json',tool));
const zip=await readFile(new URL('src/zip.mjs',tool),'utf8');
files['template/scripts/zip.mjs']=Buffer.from('// Generated from Studio src/zip.mjs; 8MB/64-file candidate profile.\n'+zip.replace("import {requireThat as check} from './contract.mjs';","const check=(ok,message)=>{if(!ok)throw Error(message);};").replace('LIMIT=2*','LIMIT=8*').replace('超过2MB','超过8MB').replace('count<=16','count<=64'));
for(const [name,bytes]of Object.entries(files)){const url=new URL(name,target);await mkdir(new URL('./',url),{recursive:true});await writeFile(url,bytes);}
await writeFile(new URL('runtime-manifest.json',target),JSON.stringify({version:'0.1.0',toolVersion:JSON.parse(await readFile(new URL('package.json',tool),'utf8')).version,threeVersion:three.version,zipSourceSHA256:sha(zip),files:Object.entries(files).map(([path,b])=>({path,bytes:b.length,sha256:sha(b)}))},null,2));
console.log('Generated portable runtime: '+Object.keys(files).length+' files');
