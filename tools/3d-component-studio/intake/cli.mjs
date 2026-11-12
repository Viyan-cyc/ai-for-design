import {readFile,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {resolve,relative,isAbsolute} from 'node:path';
import {categories,planIntake,validateIntake,applyIntake,safe} from './core.mjs';
const [command,...args]=process.argv.slice(2), opts={};
for(let i=0;i<args.length;i++){if(!args[i].startsWith('--'))throw Error('参数须使用--名称');const key=args[i].slice(2);opts[key]=args[i+1]?.startsWith('--')||i===args.length-1?true:args[++i];}
try {
 if(command==='plan'){
  if(!opts.candidate||!opts.target||!opts.out)throw Error('plan --candidate <component> --target <library> --category <分类> --exports <类或工厂,名称> --out <plan.json> [--update]');
  for(const root of [opts.target,opts.candidate]){const rel=relative(resolve(root),resolve(opts.out));if(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..\\')&&!rel.startsWith('../'))throw Error('plan输出必须在候选与目标之外');}
  await safe(opts.out);
  if(!opts.category){const list=await categories(opts.target);if(!stdin.isTTY)throw Error('请选择--category：'+list.join(', '));const ui=createInterface({input:stdin,output:stdout});try{opts.category=await ui.question('组件分类 ['+list.join(', ')+']: ');}finally{ui.close();}}
  const plan=await planIntake({candidate:opts.candidate,target:opts.target,category:opts.category,names:String(opts.exports||'').split(',').filter(Boolean),update:!!opts.update,demo:opts.demo});
  await writeFile(opts.out,JSON.stringify(plan,null,2),{flag:'wx'});console.log(JSON.stringify({status:plan.status,category:plan.category,exports:plan.names,files:Object.keys(plan.operations),additionalGenerated:['API页面','人工notes（首次）','文档索引','入库登记']},null,2));
 }else if(command==='validate'){
  if(!opts.plan||!opts.work||!opts.test)throw Error('validate --plan <plan.json> --work <新验证目录> --test <运行断言.mjs>');
  const result=await validateIntake(JSON.parse(await readFile(opts.plan)),opts.work,{runtimeTest:opts.test});console.log('已验证：'+result.validationWork+'/receipt.json');
 }else if(command==='apply'){
  if(!opts.receipt)throw Error('apply --receipt <receipt.json> --developer-confirmed');
  console.log(await applyIntake(JSON.parse(await readFile(opts.receipt)),{developerConfirmed:opts['developer-confirmed']===true}));
 }else throw Error('用法：node intake/cli.mjs plan|validate|apply ...');
}catch(e){console.error(e.message);process.exitCode=1;}
