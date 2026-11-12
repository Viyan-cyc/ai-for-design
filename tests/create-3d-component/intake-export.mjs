import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import assert from 'node:assert/strict';
import {readZip} from '../../skills/create-3d-component/assets/runtime/native/example/zip.mjs';
import {planIntake,baseline} from '../../tools/3d-component-studio/intake/core.mjs';
const [folder,zip]=process.argv.slice(2),out=resolve(folder),candidate=join(out,'export-extracted'),target=join(out,'target');
const files=readZip(new Uint8Array(await readFile(zip)));for(const [file,b] of Object.entries(files)){const p=join(candidate,file);await mkdir(dirname(p),{recursive:true});await writeFile(p,b);}
const before=await baseline(target),args={candidate,target,category:'helper',names:['HostHighlight'],update:true};
const plan=await planIntake(args);assert.equal(plan.status,'planned');const p=join(candidate,'src/index.ts'),original=await readFile(p);await writeFile(p,Buffer.concat([original,Buffer.from('\n')]));await assert.rejects(()=>planIntake(args),/导出清单与源码不符/);await writeFile(p,original);
const manifest=join(candidate,'component-source-manifest.json'),data=JSON.parse(await readFile(manifest));data.files.pop();await writeFile(manifest,JSON.stringify(data));await assert.rejects(()=>planIntake(args),/导出清单文件集合不符/);await writeFile(manifest,files['component-source-manifest.json']);
assert.equal(await baseline(target),before);await writeFile(join(out,'export-result.json'),JSON.stringify({status:'pass',zip:resolve(zip),files:Object.keys(files),checks:['real exported ZIP accepted','source mutation rejected','missing manifest item rejected','target unchanged']},null,2));console.log('PASS real ZIP intake plan');
