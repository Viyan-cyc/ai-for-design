import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const skill=resolve('skills/generate-3d-scene'), root=join(mkdtempSync(join(tmpdir(),'map-conflict-')),'source');
const snap=()=>Object.fromEntries(readdirSync(root,{recursive:true,withFileTypes:true}).filter(x=>x.isFile()).map(x=>{const p=join(x.parentPath??x.path,x.name);return [p,readFileSync(p).toString('base64')];}));
const run=()=>spawnSync(process.execPath,[join(skill,'scripts/enable-map.mjs'),root],{encoding:'utf8'});
try {
 cpSync(join(skill,'template'),root,{recursive:true});
 let r=run(); assert.equal(r.status,0,r.stderr);
 const initial=snap(); r=run(); assert.equal(r.status,0,r.stderr); assert.deepEqual(snap(),initial);
 const file=join(root,'src/scene3d/map/create-map-scene.ts');
 writeFileSync(file,readFileSync(file,'utf8')+'\n// USER_CUSTOMIZATION_SENTINEL\n');
 // A missing earlier file must not be recreated before a later conflict is discovered.
 const candidates=readdirSync(join(root,'src/scene3d/map')).filter(x=>x.endsWith('.ts')&&x!=='create-map-scene.ts');
 assert(candidates.length); rmSync(join(root,'src/scene3d/map',candidates[0]));
 const before=snap(); r=run(); assert.notEqual(r.status,0); assert.match(r.stderr,/create-map-scene.ts/); assert.doesNotMatch(r.stdout,/MAP_ENABLED/); assert.deepEqual(snap(),before);
 console.log('PASS first enable, identical repeat, modified map rejection, no partial source/vendor/package/entry writes');
} finally {assert(root.startsWith(join(tmpdir(),'map-conflict-')));rmSync(root,{recursive:true,force:true});}
