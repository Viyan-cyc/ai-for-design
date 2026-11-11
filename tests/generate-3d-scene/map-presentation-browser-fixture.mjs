// Creates an isolated browser fixture; no user project is changed.
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const skill=resolve('skills/generate-3d-scene');
const modules=process.env.SCENE3D_TEST_MAP_MODULES;
if(!modules)throw Error('Set SCENE3D_TEST_MAP_MODULES to existing dependencies');
const root=fs.mkdtempSync(join(tmpdir(),'map-presentation-browser-')),source=join(root,'project/source');
function run(file,args){const r=spawnSync(process.execPath,[join(skill,'scripts',file),...args],{encoding:'utf8'});if(r.status)throw Error(r.stdout+r.stderr);}
run('init.mjs',[join(root,'project'),'--project-dir','--name','test-scene','--deps','skip','--defer-build']);run('enable-map.mjs',[join(root,'project')]);
fs.cpSync(resolve(modules),join(source,'node_modules'),{recursive:true,dereference:true,filter:p=>p!==join(resolve(modules),'@a3d','a3d-components')});
const installed=join(source,'node_modules/@a3d/a3d-components');fs.mkdirSync(installed,{recursive:true});
const archive=fs.readdirSync(join(skill,'vendor')).find(n=>n.endsWith('.tgz'));
const r=spawnSync('tar',['-xzf',join(skill,'vendor',archive),'--strip-components','1','-C',installed],{encoding:'utf8'});if(r.status)throw Error(r.stderr);
fs.copyFileSync(new URL('./map-presentation-adapter.browser.html',import.meta.url),join(source,'acceptance.html'));
console.log(source);
