import assert from 'node:assert/strict';
import {checkCompositeSource as check} from '../../skills/generate-3d-scene/scripts/lib/composite-check.mjs';
const wrap=s=>`function create(){const b=createComposite();${s}}`;
for(const [src,pattern] of [
 ["b.mesh('skylight',g,m);b.mesh('skylight',g,m);",/Duplicate slot/],
 ["b.finish();b.mesh('label',g,m);",/finish\(\) 后/],
 ["b.mesh('wall_-1',g,m);",/Invalid slot/],
 ["for(const z of [-1,1]){b.mesh(`wall_${z}`,g,m);}",/负号/],
 ["for(const i of [0,1]){b.mesh('skylight',g,m);}",/循环内重复/],
 ["b.finish();b.finish();",/finish\(\) 后/]
])assert(check(wrap(src)).some(x=>pattern.test(x)),src);
for(const src of ["b.mesh('a',g,m);b.mesh('b',g,m);return b.finish();","const batch=b.batchSlot('frame',m);for(const x of [-1,1])batch.add(g);return b.finish();","for(const side of ['neg','pos'])b.mesh(`wall_${side}`,g,m);return b.finish();","b.mesh('a',g,m);if(flag)return b.finish();b.mesh('b',g,m);return b.finish();"] )assert.deepEqual(check(wrap(src)),[]);
console.log('PASS composite source diagnostics: names, duplicates, lifecycle, safe batching and conditional return');
