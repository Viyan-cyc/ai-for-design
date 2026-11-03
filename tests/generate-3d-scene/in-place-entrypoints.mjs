import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const base=fs.mkdtempSync(join(tmpdir(),'in-place-cli-')),out=join(base,'project'),skill=resolve('skills/generate-3d-scene');
function run(script,args){const r=spawnSync(process.execPath,[join(skill,'scripts',script),...args],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);return r;}
try {
 run('init.mjs',[out,'--profile','empty','--assets','referenced','--deps','shared','--defer-build']);
 assert(fs.existsSync(join(out,'source/package.json')));
 run('build-offline.mjs',[out]);
 fs.mkdirSync(join(out,'.history'));fs.writeFileSync(join(out,'.history/user.txt'),'history');
 const scene=join(out,'source/public/scene3d/scene-data.json'),data=JSON.parse(fs.readFileSync(scene));data.camera.position[0]+=5;fs.writeFileSync(scene,JSON.stringify(data));
 run('build-offline.mjs',[join(out,'source')]);assert.equal(fs.readFileSync(join(out,'.history/user.txt'),'utf8'),'history');assert.equal(JSON.parse(fs.readFileSync(scene)).camera.position[0],data.camera.position[0]);
 const r=spawnSync(process.execPath,[join(out,'source/scripts/build-offline.mjs')],{cwd:join(out,'source'),encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);
 console.log('PASS real init to project/source, unified project/source paths, direct offline build, same preview and history preserved');
}finally{assert(base.startsWith(join(tmpdir(),'in-place-cli-')));fs.rmSync(base,{recursive:true,force:true});}
