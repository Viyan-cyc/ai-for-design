import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mapRenderer} from '../../skills/generate-3d-scene/template/scripts/map-renderer.mjs';
const repo=resolve(import.meta.dirname,'../..'),work=join(repo,'docs/create-3d-component/native-work'),library='D:/cyc/project/octo/test/3d-components';
const sha=b=>createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(await readFile(join(work,'r7-library-final/receipt.json'),'utf8'));
const unchanged=receipt.changes.filter(c=>c.path.startsWith('src/map/restored-map-suite/'));
assert.equal(unchanged.length,15);
for(const c of unchanged)assert.equal(sha(await readFile(join(library,c.path))),c.after,c.path);
assert.deepEqual(await mapRenderer(join(repo,'skills/generate-3d-scene/template')),[]);
const generated=join(work,'r8-map-scene/source'),generator=join(repo,'skills/generate-3d-scene');
const matches=[];
for(const p of ['experience-host.ts','map-components.ts','create-map-scene.ts']){
 const relative='src/scene3d/map/'+p;assert.deepEqual(await readFile(join(generated,relative)),await readFile(join(generator,'extensions/map',relative)));matches.push(relative);
}
for(const p of ['src/edit/Bridge.ts','src/edit/EditApp.vue','src/edit/MapComponentsPanel.vue','src/scene3d/scene-core/createScene.ts','scripts/map-renderer.mjs','scripts/build-offline.mjs','vite.config.ts']){
 assert.deepEqual(await readFile(join(generated,p)),await readFile(join(generator,'template',p)));matches.push(p);
}
const result={status:'passed',unchangedR7Sources:unchanged.map(c=>c.path),ordinaryTemplateNeedsNoMapDependency:true,generatedMatchesCurrent:matches,html:sha(await readFile(join(work,'r8-map-scene/index.3d.html')))};
result.preview={};for(const file of await readdir(join(work,'r8-map-scene/preview'),{recursive:true,withFileTypes:true})){if(file.isFile()){const path=join(file.parentPath,file.name);result.preview[path]=sha(await readFile(path));}}
await writeFile(join(work,'r8-map-scene/boundaries.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
