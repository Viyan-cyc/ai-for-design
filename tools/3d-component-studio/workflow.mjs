import {readFile} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export function commands(action,c,base,{confirmed=false,adopt=false}={}) {
 const path=k=>{if(typeof c[k]!=='string'||!c[k].trim())throw Error('配置缺少 '+k);return resolve(base,c[k]);};
 const intake=join(root,'tools/3d-component-studio/intake/cli.mjs');
 const sync=()=>join(path('generator'),'scripts/sync-components.mjs');
 if(action==='build')return [[join(path('project'),'example/build.mjs')]];
 if(action==='export')return [[join(path('project'),'example/build.mjs')],[join(path('project'),'example/build.mjs'),'--export-component']];
 if(action==='prepare-intake') {
  if(typeof c.category!=='string'||!c.category.trim()||!Array.isArray(c.exports)||!c.exports.length||c.exports.some(n=>typeof n!=='string'||!n.trim()))throw Error('配置须指定category及exports数组');
  return [[intake,'plan','--candidate',path('candidate'),'--target',path('library'),'--category',c.category,'--exports',c.exports.join(','),'--out',path('intakePlan'),...(c.update===true?['--update']:[]),...(c.demo?['--demo',path('demo')]:[])],
   [intake,'validate','--plan',path('intakePlan'),'--work',path('intakeWork'),'--test',path('runtimeTest')]];
 }
 if(action==='apply-intake'){if(!confirmed)throw Error('开发审阅后必须显式添加 --confirmed');return [[intake,'apply','--receipt',join(path('intakeWork'),'receipt.json'),'--developer-confirmed']];}
 if(action==='prepare-sync')return [[sync(),'--src',path('library'),'--target',path('generator'),'--work',path('syncWork'),...(adopt?['--adopt-generated']:[])]];
 if(action==='apply-sync'){if(!confirmed)throw Error('审阅同步差异后必须显式添加 --confirmed');return [[sync(),'--apply',join(path('syncWork'),'sync-plan.json'),'--confirmed']];}
 throw Error('未知步骤：'+action);
}
export function runSteps(steps,run=args=>spawnSync(process.execPath,args,{stdio:'inherit',shell:false})){
 for(const args of steps){const result=run(args);if(result.error)throw result.error;if(result.status!==0)throw Error('步骤失败，后续未执行：'+args[0]+' (exit '+result.status+')');}
}
async function main(){
 const [action,config,...flags]=process.argv.slice(2);
 if(action==='--help'||!action){console.log('node workflow.mjs <步骤> <配置.json> [--confirmed] [--adopt-generated]\n步骤：build | export | prepare-intake | apply-intake | prepare-sync | apply-sync\napply必须显式确认；adopt仅用于首次prepare-sync。详见docs/create-3d-component/workflow-guide.md');return;}
 if(!config||config.startsWith('--'))throw Error('请指定配置JSON');
 if(new Set(flags).size!==flags.length||flags.some(f=>!['--confirmed','--adopt-generated'].includes(f)))throw Error('未知或重复选项');
 if(flags.includes('--confirmed')&&!action.startsWith('apply-'))throw Error('--confirmed仅用于apply步骤');
 if(flags.includes('--adopt-generated')&&action!=='prepare-sync')throw Error('--adopt-generated仅用于prepare-sync');
 const file=resolve(config), c=JSON.parse(await readFile(file,'utf8'));
 runSteps(commands(action,c,dirname(file),{confirmed:flags.includes('--confirmed'),adopt:flags.includes('--adopt-generated')}));
 console.log('本步骤完成：'+action+'；不代表设计确认或发布完成。');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
