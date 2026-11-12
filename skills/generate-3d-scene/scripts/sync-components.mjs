#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {prepareSync,applySync} from './lib/component-sync.mjs';
const args=process.argv.slice(2),opt={};
try{
 for(let i=0;i<args.length;i++){const key=args[i];if(!['--src','--target','--work','--apply','--confirmed','--adopt-generated'].includes(key))throw Error('未知参数或已停用模式：'+key);opt[key]=['--confirmed','--adopt-generated'].includes(key)?true:args[++i];}
 if(opt['--apply'])console.log(JSON.stringify(await applySync(JSON.parse(await readFile(opt['--apply'])),{confirmed:opt['--confirmed']===true}),null,2));
 else{if(!opt['--src']||!opt['--target']||!opt['--work'])throw Error('用法：--src <组件库> --target <generate-3d-scene> --work <新的验证目录> [--adopt-generated]；审阅后 --apply <sync-plan.json> --confirmed');const p=await prepareSync({source:opt['--src'],target:opt['--target'],work:opt['--work'],adoptGenerated:!!opt['--adopt-generated']});console.log('SYNC_PLAN='+p.work+'/sync-plan.json');}
}catch(e){console.error(e.message);process.exitCode=1;}
