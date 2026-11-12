import {mkdtemp,readFile,writeFile,rm,mkdir,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const repo=fileURLToPath(new URL('../../',import.meta.url));
const temp=await mkdtemp(repo+'tools/3d-component-studio/boundary-test-');
const run=(args,cwd=repo)=>{const p=spawnSync(process.execPath,args,{cwd,encoding:'utf8'});assert.equal(p.status,0,p.stdout+p.stderr);return p.stdout;};
try {
  run(['skills/create-3d-component/scripts/init.mjs',temp,'boundary-cube','--profile','legacy']);
  const project=temp+'/boundary-cube';
  const buildLog=run(['example/build.mjs'],project);
  const cache=buildLog.match(/BUILD_WORKSPACE=(.+)/)[1].trim();
  const runs=cache+'/dependencies/runs';
  const root=runs+'/'+(await readdir(runs))[0];
  assert.deepEqual((await readdir(project)).sort(),['component','example','index.3d.html']);
  assert((await readFile(project+'/component/design.md','utf8')).length>0);
  run(['scripts/prepare.mjs'],root);
  run(['scripts/build-preview.mjs'],root);
  run(['scripts/export-component.mjs'],root);
  const delivery=await import(pathToFileURL(root+'/component/delivery.mjs'));
  const known=await delivery.template();const baseline=JSON.parse(known['preset.json']);
  const demo=await delivery.exportPackage(baseline,known);
  assert.deepEqual(await delivery.importPackage(demo.bytes,known),baseline);
  const {readZip}=await import(pathToFileURL(root+'/scripts/zip.mjs'));
  const entries=readZip(new Uint8Array(await readFile(root+'/dist/component-source.zip')));
  assert(entries['component/component.mjs']);assert(entries['vendor/LICENSE']);
  assert(!Object.keys(entries).some(p=>p.startsWith('example/')||p.startsWith('scripts/')||p==='component/delivery.mjs'));
  const {collectComponent}=await import(pathToFileURL(root+'/scripts/component-source.mjs'));
  const entry=root+'/component/component.mjs',original=await readFile(entry,'utf8');
  await writeFile(root+'/example/demo-only.mjs','export const demo=1;');
  for(const code of ["import '../example/demo-only.mjs';", "import './delivery.mjs';", "export const bad=()=>import('../example/demo-only.mjs');", "export const bad=p=>import(p);"]) {
    await writeFile(entry,original+'\n'+code);
    await assert.rejects(collectComponent(root));
  }
  await writeFile(entry,original);
  const boundaryPath=root+'/component-boundary.json';
  const boundary=JSON.parse(await readFile(boundaryPath,'utf8'));
  const asset=Buffer.from([137,80,78,71,13,10,26,10,0,255,128,42]);
  await mkdir(root+'/assets');await writeFile(root+'/assets/probe.png',asset);
  const urlCode="\nexport const textureURL=new URL('../assets/probe.png',import.meta.url).href;";
  await writeFile(entry,original+urlCode);
  await assert.rejects(collectComponent(root),/Undeclared/);
  for(const code of ["new URL('../example/demo-only.mjs',import.meta.url)","new URL(name,import.meta.url)","new URL('../assets/probe.png',base)"]) {
    await writeFile(entry,original+'\nexport const probe=()=>'+code+';');
    await assert.rejects(collectComponent(root),/asset URL/);
  }
  boundary.assets=['assets/probe.png'];await writeFile(boundaryPath,JSON.stringify(boundary));
  await writeFile(entry,original+urlCode);
  run(['scripts/export-component.mjs'],root);
  const assetEntries=readZip(new Uint8Array(await readFile(root+'/dist/component-source.zip')));
  assert.deepEqual(Buffer.from(assetEntries['assets/probe.png']),asset);
  // Exported source works with two different hosts; disposing leaves borrowed objects intact.
  const extracted=temp+'/extracted';await mkdir(extracted);
  for(const [p,b] of Object.entries(assetEntries)){const dest=extracted+'/'+p;await mkdir(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});await writeFile(dest,b);}
  const THREE=await import(pathToFileURL(extracted+'/vendor/three.module.js'));
  const {create,textureURL}=await import(pathToFileURL(extracted+'/component/component.mjs'));
  assert.deepEqual(await readFile(new URL(textureURL)),asset);
  const preset=JSON.parse(new TextDecoder().decode(entries['preset.json']));
  for(let i=0;i<2;i++){const scene=new THREE.Scene(),host=new THREE.Group();scene.add(host);const c=create(scene,preset);c.update(preset);assert.equal(scene.children.length,2);c.dispose();c.dispose();assert.deepEqual(scene.children,[host]);}
  console.log('PASS: fresh init/build/export, demo roundtrip, source-only ZIP, four forbidden module cases; undeclared/demo/dynamic/base asset URL rejection; declared binary ZIP and extracted URL bytes; two hosts and repeat dispose');
} finally {await rm(temp,{recursive:true,force:true});}
