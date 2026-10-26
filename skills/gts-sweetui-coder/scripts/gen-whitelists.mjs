// Maintenance: export inputs and outputs are JSON arrays, as in the EP package.
import fs from 'node:fs';
import path from 'node:path';
import {scripts,readWhitelist,allowedNativeIcons} from './native-tools.mjs';
try{
  const args=process.argv.slice(2),options={};
  const supported=new Set(['sweetui-exports','dtui-exports','icons-css']);
  for(let i=0;i<args.length;i+=2){
    const name=args[i]?.replace(/^--/,'');
    if(!args[i]?.startsWith('--')||!supported.has(name)||!args[i+1]||args[i+1].startsWith('--'))throw new Error('Use --sweetui-exports <json>, --dtui-exports <json>, or --icons-css <css>');
    options[name]=path.resolve(args[i+1]);
  }
  const outputs=[];
  for(const [option,target] of [['sweetui-exports','sweetui-exports'],['dtui-exports','dt-ui-exports']])if(options[option]){
    const names=readWhitelist(options[option]);
    if(names.some(x=>!/^[$A-Z_a-z][$\w]*$/.test(x)))throw new Error(option+': invalid JavaScript export name');
    outputs.push([target,[...names].sort()]);
  }
  if(options['icons-css'])outputs.push(['sweetui-icons',allowedNativeIcons(fs.readFileSync(options['icons-css'],'utf8'))]);
  if(!outputs.length)throw new Error('No maintenance input provided');
  for(const [name,values] of outputs)fs.writeFileSync(path.join(scripts,'verify','whitelists',name+'.json'),JSON.stringify(values,null,2)+'\n');
  console.log('RESULT: OK\n'+outputs.map(([name,values])=>name+': '+values.length).join('\n'));
}catch(e){console.log('RESULT: FAIL | '+e.message);process.exitCode=1;}
