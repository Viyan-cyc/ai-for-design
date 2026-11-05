// Read-only by default; recording accepts an explicitly reviewed baseline.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=path.join(repo,'skills/gts-charts-coder');
const manifestPath=path.join(repo,'docs/gts-charts-coder/upstream-sources.json');
function hashes(dir){const out={};function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){if(e.name==='.git')continue;const f=path.join(p,e.name);if(e.isSymbolicLink())throw Error('Linked source unsupported: '+f);if(e.isDirectory())walk(f);else out[path.relative(dir,f).split(path.sep).join('/')]=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');}}walk(dir);return out;}
function diff(a,b){return [...new Set([...Object.keys(a),...Object.keys(b)])].sort().filter(k=>a[k]!==b[k]).map(k=>`${!a[k]?'ADDED':!b[k]?'REMOVED':'CHANGED'}: ${k}`);}
function engineeringLocal(){return Object.fromEntries(Object.entries(hashes(root)).filter(([k])=>!k.startsWith('design/')));}
try{
 const args=process.argv.slice(2),o={};for(let i=0;i<args.length;i++){const k=args[i];if(!['--kind','--source','--version','--commit','--record'].includes(k)||Object.hasOwn(o,k))throw Error('Invalid/duplicate argument: '+k);if(k==='--record')o[k]=true;else{if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing value: '+k);o[k]=args[++i];}}
 const kind=o['--kind']||'design';if(!['design','engineering'].includes(kind))throw Error('Unknown kind');
 if(o['--record']&&(!o['--source']||!o['--version']))throw Error('--record requires --source and --version');
 if(!o['--record']&&(o['--version']||o['--commit']))throw Error('Version/commit require --record');
 const m=JSON.parse(fs.readFileSync(manifestPath,'utf8'));let changes=[];
 if(o['--source']){
  const source=path.resolve(o['--source']);if(!fs.existsSync(source)||!fs.statSync(source).isDirectory())throw Error('Source directory not found');
  const current=hashes(source);changes=diff(m[kind].files,current);
  if(o['--record']){
   const local=kind==='design'?hashes(path.join(root,'design')):engineeringLocal();
   if(kind==='design'&&diff(current,local).length)throw Error('Sync and review design/ before recording');
   m[kind]={version:o['--version'],source,commit:o['--commit']||null,files:current};
   if(kind==='engineering'){m[kind].classifications=Object.fromEntries(Object.keys(current).map(k=>[k,!local[k]?'excluded':local[k]===current[k]?'unchanged':'adapted']));m[kind].embeddedFiles=local;m[kind].added=Object.keys(local).filter(k=>!current[k]);}
   fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');console.log('RESULT: OK | reviewed baseline recorded');process.exit(0);
  }
 }else{const expected=kind==='design'?m.design.files:m.engineering.embeddedFiles;if(!expected)throw Error('Embedded baseline missing');changes=diff(expected,kind==='design'?hashes(path.join(root,'design')):engineeringLocal());}
 console.log(changes.length?'RESULT: FAIL | '+kind+' differs\n'+changes.join('\n'):'RESULT: OK | '+kind+' snapshot matches');if(changes.length)process.exitCode=1;
}catch(e){console.error('RESULT: FAIL | '+e.message);process.exitCode=2;}
