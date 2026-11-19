import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const work=resolve(process.argv[2]),applied=process.argv.includes('--applied');
const sha=b=>createHash('sha256').update(b).digest('hex');
const plan=JSON.parse(await readFile(join(work,'sync-plan.json'),'utf8'));
const root=applied?plan.target:join(work,'proposed');
const manifest=JSON.parse(await readFile(join(root,'vendor/components-sync.json'),'utf8'));
for(const [p,h] of Object.entries(manifest.files))assert.equal(sha(await readFile(join(root,p))),h,p);
const tar=gunzipSync(await readFile(join(root,manifest.package.path))),files=new Map();
for(let at=0;at+512<=tar.length;){const h=tar.subarray(at,at+512);if(h.every(x=>!x))break;const name=h.subarray(0,100).toString().split('\0')[0],prefix=h.subarray(345,500).toString().split('\0')[0],n=parseInt(h.subarray(124,136).toString().replace(/\0/g,'').trim(),8);assert.ok(Number.isSafeInteger(n)&&n>=0&&at+512+n<=tar.length);files.set(prefix?prefix+'/'+name:name,tar.subarray(at+512,at+512+n));at+=512+Math.ceil(n/512)*512;}
const names=['MapExperience','LogicalScatter','GridHeat','BuildingTint','HeatField','MapScene','MapSurfaceParticleScan'];
const actual=await import(pathToFileURL(join(work,'library/dist/es/map.js')).href);
for(const n of names){assert.equal(typeof actual[n],'function',n);assert.ok((await readFile(join(root,'references/component-docs',n+'.md'),'utf8')).includes(n));}
assert.deepEqual(files.get('package/dist/es/map.js'),await readFile(join(work,'library/dist/es/map.js')));
assert.deepEqual(files.get('package/docs/components.json'),await readFile(join(root,'vendor/components.json')));
const docs=await readFile(join(root,'references/component-catalog.md'),'utf8');for(const n of names)assert.ok(docs.includes(n),n);
// Imported from this run's built library, not prototype source.
const field=new actual.HeatField();field.setData([]);field.dispose();
if(files.has('package/dist/node/map-adapter.mjs')){
 const adapter=await import(pathToFileURL(join(work,'library/dist/node/map-adapter.mjs')).href);
 const renderer=await readFile(join(work,'library/node_modules/maplibre-gl/dist/maplibre-gl-dev.js'),'utf8');
 assert.ok(adapter.patchMapLibre(renderer).includes('__heatAdapterVersion'));
 assert.throws(()=>adapter.patchMapLibre(renderer+'\n'),/fingerprint/);
 assert.deepEqual(files.get('package/dist/node/map-adapter.mjs'),await readFile(join(work,'library/dist/node/map-adapter.mjs')));
 const pkg=JSON.parse(files.get('package/package.json').toString());assert.equal(pkg.exports['./map-adapter'],'./dist/node/map-adapter.mjs');
}
const record={status:'passed',mode:applied?'applied':'prepared',package:manifest.package,verifiedFiles:Object.keys(manifest.files).length,exports:names,packageMatchesBuild:true,catalogMatchesPackage:true,heatFieldEmptyAndDispose:true,scene:'not-verified',editor:'not-verified',publication:'unpublished'};
await writeFile(join(work,applied?'applied-check.json':'prepared-check.json'),JSON.stringify(record,null,2));
console.log(JSON.stringify(record,null,2));
