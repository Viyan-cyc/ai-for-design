import {mkdtemp,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
const script=fileURLToPath(new URL('../../skills/create-3d-component/scripts/init.mjs',import.meta.url));const root=await mkdtemp(join(tmpdir(),'component-init-'));
async function snapshot(dir){let result={};for(const name of await readdir(dir)){const p=join(dir,name);result[name]=(await stat(p)).isDirectory()?await snapshot(p):(await readFile(p)).toString('base64');}return result;}
for(const profile of ['native-object','legacy','native-host']){const parent=join(root,profile);const flags=profile==='native-object'?[]:['--profile',profile];const run=args=>spawnSync(process.execPath,[script,...args,...flags],{encoding:'utf8'});
 let x=run([parent,'sample-object']);assert.equal(x.status,0,x.stderr);const project=join(parent,'sample-object');assert((await readFile(join(project,profile==='legacy'?'component/src/component.mjs':'component/src/index.ts'),'utf8')).length>0);
 await writeFile(join(project,'user.txt'),'preserved');const before=await snapshot(project);x=run([parent,'sample-object']);assert.equal(x.status,0,x.stderr);assert.deepEqual(await snapshot(project),before);assert((await stat(join(parent,'sample-object-2'))).isDirectory());
 const all=await snapshot(parent);assert.notEqual(run([project,'sample-object','--project-dir']).status,0);assert.deepEqual(await snapshot(parent),all);
}
const invalid=spawnSync(process.execPath,[script,root,'bad-profile','--profile','unsupported'],{encoding:'utf8'});assert.notEqual(invalid.status,0);assert(!(await readdir(root)).includes('bad-profile'));console.log('PASS both initializer profiles, collision preservation, exact path rejection, unsupported profile; '+root);
