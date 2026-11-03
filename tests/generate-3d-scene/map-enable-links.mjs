import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=fs.mkdtempSync(join(tmpdir(),'map-links-')),skill=resolve('skills/generate-3d-scene');
let passed=0,skipped=0;
const snapshot=dir=>{const out={};function visit(p,k){for(const name of fs.readdirSync(p)){const f=join(p,name),key=k+name,st=fs.lstatSync(f);if(st.isSymbolicLink())out[key]=`link:${fs.readlinkSync(f)}`;else if(st.isDirectory()){out[key+'/']='';visit(f,key+'/');}else out[key]=fs.readFileSync(f).toString('base64');}}visit(dir,'');return out;};
try {
 for(const [i,path] of ['package.json','src/scene3d/create-scene.ts','src/scene3d','vendor'].entries()) {
  const work=join(root,String(i)),external=join(root,'external-'+i);
  fs.cpSync(join(skill,'template'),work,{recursive:true});
  const dest=join(work,path);
  if(!fs.existsSync(dest))fs.mkdirSync(dest,{recursive:true});
  const directory=fs.statSync(dest).isDirectory();
  fs.renameSync(dest,external);
  try{fs.symlinkSync(external,dest,directory?'junction':'file');}
  catch(e){if(['EPERM','EACCES'].includes(e.code)){skipped++;console.log(`SKIP ${path}: ${e.code}`);continue;}throw e;}
  const before=snapshot(root);
  const r=spawnSync(process.execPath,[join(skill,'scripts/enable-map.mjs'),work],{encoding:'utf8'});
  assert.notEqual(r.status,0);assert.match(r.stderr,/链接路径/);assert.doesNotMatch(r.stdout,/MAP_ENABLED/);assert.deepEqual(snapshot(root),before);passed++;
 }
 console.log(`PASS ${passed} real link/junction rejection cases; SKIP ${skipped} permission-limited cases`);
}finally{assert(root.startsWith(join(tmpdir(),'map-links-')));fs.rmSync(root,{recursive:true,force:true});}
