import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'shots');
const load=mode=>JSON.parse(readFileSync(join(root,mode,`accept-${mode}.json`),'utf8'));
const file=load('file'),dist=load('dist');
assert.equal(file.status,'PASS');assert.equal(dist.status,'PASS');
const fields=['pairCount','imgCount','lightShown','darkShown','brokenImgs','epIconCount','tableRows',
  'buttons','tokenBackground','tokenFont','background','color','fontFamily','buttonHeight',
  'buttonBackground','inputShadow','pagePadding','tableHeaderBackground'];
for(const theme of ['light','dark']) {
  for(const key of fields) assert.deepEqual(file[theme][key],dist[theme][key],`${theme}.${key}`);
  assert.deepEqual(file[theme].visibleImages.map(i=>[i.width,i.height]),dist[theme].visibleImages.map(i=>[i.width,i.height]),`${theme} icon dimensions`);
}
writeFileSync(join(root,'consistency.json'),JSON.stringify({status:'PASS',comparedThemes:['light','dark'],fields,
  fileReport:'file/accept-file.json',distReport:'dist/accept-dist.json'},null,2));
console.log('RESULT: PASS | preview / dist icon and computed-style consistency');
