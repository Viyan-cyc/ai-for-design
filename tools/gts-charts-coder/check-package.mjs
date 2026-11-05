import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const root=path.join(repo,'skills/gts-charts-coder'),errors=[];
let markdown=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.name==='.git'){errors.push('Nested repository: '+f);continue;}if(e.isDirectory())walk(f);else if(e.name.endsWith('.md')){
 markdown++;if(e.name==='SKILL.md'&&f!==path.join(root,'SKILL.md'))errors.push('Nested skill: '+f);
 for(const m of fs.readFileSync(f,'utf8').matchAll(/\]\(([^\s)]+)\)/g)){const link=m[1].split('#')[0];if(!link||/^[a-z][a-z0-9+.-]*:/i.test(link)||link.includes('<'))continue;let target;try{target=path.resolve(path.dirname(f),decodeURIComponent(link));}catch{errors.push('Invalid URL: '+link);continue;}if(!fs.existsSync(target))errors.push(path.relative(root,f)+' -> '+link);}
}}}
walk(root);
const m=JSON.parse(fs.readFileSync(path.join(repo,'docs/gts-charts-coder/upstream-sources.json'),'utf8'));
for(const [name,status]of Object.entries(m.engineering.classifications||{})){
 const exists=fs.existsSync(path.join(root,name));if(status==='excluded'?exists:!exists)errors.push('Classification mismatch: '+status+' '+name);
}
console.log(errors.length?'RESULT: FAIL\n'+errors.join('\n'):'RESULT: OK\nMARKDOWN_FILES: '+markdown);if(errors.length)process.exitCode=1;
