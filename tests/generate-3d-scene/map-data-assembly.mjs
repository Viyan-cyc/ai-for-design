import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkAssembly } from '../../skills/generate-3d-scene/scripts/lib/assembly-check.mjs';
const skill=fileURLToPath(new URL('../../skills/generate-3d-scene/',import.meta.url));
const root=mkdtempSync(join(tmpdir(),'map-data-assembly-'));
try {
  cpSync(join(skill,'template'),root,{recursive:true});
  cpSync(join(skill,'extensions/map/src'),join(root,'src'),{recursive:true});
  symlinkSync(resolve(process.argv[2]),join(root,'node_modules'),process.platform==='win32'?'junction':'dir');
  const p={lng:121.49517,lat:31.24194,value:180};
  const check=async map=>{writeFileSync(join(root,'public/data/scene.json'),JSON.stringify({map}));return checkAssembly(root);};
  let result=await check({heat:{data:[p,p]}});
  assert.equal(result.ok,false,JSON.stringify(result));assert.match(result.errors.join('\n'),/map.heat.*同单元/s);
  result=await check({heat:{data:[p]},geographicScatter:{data:[{id:'a',lng:p.lng,lat:p.lat}]}});
  assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.checked,2);assert.ok(result.skipped.some(s=>s.startsWith('map:')));
  result=await check({heat:{data:[{...p,value:256}]}});assert.equal(result.ok,false);
  result=await check({geographicScatter:{data:[{id:'bad',lng:999,lat:0}]}});assert.equal(result.ok,false);
  result=await check(null);assert.equal(result.ok,false);
  console.log('PASS map data preflight: duplicates/invalid fail; valid heat+scatter checked=2; render explicitly unchecked');
} finally {rmSync(root,{recursive:true,force:true});}
