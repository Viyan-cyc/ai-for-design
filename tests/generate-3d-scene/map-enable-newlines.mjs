import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const skill=resolve('skills/generate-3d-scene');
for(const newline of ['\n','\r\n']) {
 const root=join(mkdtempSync(join(tmpdir(),'map-enable-newline-')),'source');
 mkdirSync(join(root,'src/scene3d'),{recursive:true});
 const entry=join(root,'src/scene3d/create-scene.ts');
 writeFileSync(entry,readFileSync(join(skill,'template/src/scene3d/create-scene.ts'),'utf8').replace(/\r?\n/g,newline));
 writeFileSync(join(root,'package.json'),JSON.stringify({dependencies:{}}));
 for(let i=0;i<2;i++)execFileSync(process.execPath,[join(skill,'scripts/enable-map.mjs'),root],{stdio:'pipe'});
 const code=readFileSync(entry,'utf8');
 assert.ok(!code.includes('地图能力未启用'));
 assert.equal((code.match(/import \{ createMapScene \}/g)||[]).length,1);
 assert.equal((code.match(/await createMapScene/g)||[]).length,1);
}
console.log('PASS actual enable-map LF/CRLF and repeated activation');
