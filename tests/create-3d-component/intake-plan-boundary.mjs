import assert from 'node:assert/strict';
import {cp,readFile,writeFile,mkdir,symlink,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {planIntake,baseline} from '../../tools/3d-component-studio/intake/core.mjs';
const out=resolve(process.argv[2]),target=join(out,'target'),candidate=join(out,'plan-boundary');
await cp(join(out,'intake-host/component'),candidate,{recursive:true});const packagePath=join(candidate,'package.json'),pkg=JSON.parse(await readFile(packagePath));pkg.component.id='boundary-component';await writeFile(packagePath,JSON.stringify(pkg));
const index=join(candidate,'src/index.ts'),code=(await readFile(index,'utf8')).replaceAll('HostHighlight','BoundaryComponent');
// Re-exported class declarations are the common multi-file layout.
await writeFile(join(candidate,'src/implementation.ts'),code);await writeFile(index,"export {BoundaryComponent} from './implementation';\n");
const args={candidate,target,category:'helper',names:['BoundaryComponent']},before=await baseline(target);
const p=await planIntake(args);assert(p.api[0].methods.some(m=>m.signature.startsWith('setOptions(')));assert(p.api[0].parameterTypes.some(t=>t.name==='HighlightHost'));
assert(!p.api[0].parameterTypes.some(t=>t.name==='AnimationMode'));
assert(p.api[0].properties.some(p=>p.name==='animation'));assert(!p.api[0].properties.some(p=>p.name==='group'));
await assert.rejects(()=>planIntake({...args,category:'new-category'}),/已有分类/);
const valid=await readFile(index);
for(const [suffix,pattern] of [["\nconst hidden = import('./implementation');\n",/动态加载/],["\nexport type Missing = import('../../example/main').Thing;\n",/TypeScript/],["\nconst asset = new URL('asset.png', import.meta.url);\n",/资源URL/]]){await writeFile(index,Buffer.concat([valid,Buffer.from(suffix)]));await assert.rejects(()=>planIntake(args),pattern);await writeFile(index,valid);}
pkg.peerDependencies.three='^0.190.0';await writeFile(packagePath,JSON.stringify(pkg));await assert.rejects(()=>planIntake(args),/Three peer/);pkg.peerDependencies.three='>=0.183.0 <0.190.0';await writeFile(packagePath,JSON.stringify(pkg));
const link=join(candidate,'src/linked');
// Use an explicit directory junction on Windows; remove only the junction itself.
await symlink(join(target,'src'),link,'junction');try{await assert.rejects(()=>planIntake(args),/链接/);}finally{await unlink(link);}
assert.equal(await baseline(target),before);await writeFile(join(out,'plan-boundary-result.json'),JSON.stringify({status:'pass',checks:['re-exported API methods and host fields','new category rejected','dynamic import rejected','type-only escape rejected','resource URL rejected','peer mismatch rejected','junction rejected','target unchanged']},null,2));console.log('PASS plan boundaries');
