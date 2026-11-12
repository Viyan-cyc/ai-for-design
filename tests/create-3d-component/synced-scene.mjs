import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const repo=fileURLToPath(new URL('../../',import.meta.url)),out=resolve(process.argv[2]),skill=join(out,'skill');
function run(args,cwd=repo){const r=spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:20*1024*1024});if(r.status!==0)throw Error((r.stdout||'')+(r.stderr||''));return r.stdout+r.stderr;}
const init=process.env.SCENE_TEST_RESUME ? 'WORKSPACE_PATH: '+process.env.SCENE_TEST_RESUME : run([join(skill,'scripts/init.mjs'),out,'--name','synced-scene','--profile','empty','--assets','referenced','--deps','external','--with-components','--defer-build']);await writeFile(join(out,'scene-init.log'),init);
const project=init.match(/WORKSPACE_PATH[:=]\s*(.+)/)?.[1].trim();if(!project)throw Error('No WORKSPACE_PATH');
await copyFile(join(repo,'tests/create-3d-component/fixtures/synced-handler.ts'),join(project,'src/scene3d/scene/handlers/synced.ts'));
const profile=join(project,'src/scene3d/scene-profile.ts');let text=await readFile(join(repo,'tests/create-3d-component/fixtures/synced-profile.ts'),'utf8');text=text.replace(/import \{ registerSyncedObject, registerSyncedHost \} from '\.\/scene\/handlers\/synced';\r?\n/g,'');text="import { registerSyncedObject, registerSyncedHost } from './scene/handlers/synced';\n"+text;text=text.replace(/(export const BUSINESS_REGISTRARS[^\n]*=\s*\{)/,'$1\n  authored: ({sceneEngine}) => registerSyncedObject(sceneEngine),\n  highlighted: ({sceneEngine}) => registerSyncedHost(sceneEngine),');await writeFile(profile,text);
const dataPath=join(project,'public/scene3d/scene-data.json'),data=JSON.parse(await readFile(dataPath));
data.authored=[{id:'object_1',position:[-2,1,0],params:{size:1.5,color:'#45b8ff'}}];
data.highlighted=[{id:'effect_1',position:[2,1,0],params:{enabled:true,color:'#ff8800',opacity:0.8}}];
if(process.env.SCENE_TEST_PARAMETERS_FILE){const samples=JSON.parse(await readFile(process.env.SCENE_TEST_PARAMETERS_FILE,'utf8'));data.authored[0].params=samples[0].parameters;data.highlighted[0].params=samples[1].parameters;}
await writeFile(dataPath,JSON.stringify(data,null,2));
const packagePath=join(project,'package.json'),pkg=JSON.parse(await readFile(packagePath));
pkg.dependencies={...pkg.dependencies,gsap:'3.15.0','three-bvh-csg':'0.0.18','three-mesh-bvh':'0.9.10'};await writeFile(packagePath,JSON.stringify(pkg,null,2));
const r=spawnSync(process.execPath,[join(skill,'scripts/build-offline.mjs'),project],{cwd:repo,encoding:'utf8',maxBuffer:30*1024*1024});await writeFile(join(out,'scene-build.log'),(r.stdout||'')+(r.stderr||''));if(r.status!==0)throw Error('Scene build failed: '+join(out,'scene-build.log'));
const html=r.stdout.match(/HTML_PATH[:=]\s*(.+)/)?.[1].trim();if(!html)throw Error('No HTML_PATH');
await writeFile(join(out,'scene.json'),JSON.stringify({project,html,status:'built'},null,2));console.log('PASS generated scene build '+project);
