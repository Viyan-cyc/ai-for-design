import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const scriptDir=path.dirname(fileURLToPath(import.meta.url));
export function checkRuntime(root=path.join(scriptDir,'preview')) {
  const library=path.resolve(root,'public/library'),file=path.join(library,'runtime.config.js'),errors=[];
  let config;
  try {
    const context={window:{}};
    vm.runInNewContext(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''),context,{timeout:1000,filename:file});
    config=context.window.GTS_SWEETUI_RUNTIME;
    if(!config||config.ready!==true) throw new Error('SWEETUI_RUNTIME_PENDING: 内网补齐真实UMD、字体样式及runtime.config.js后才能交付预览');
    if(!Array.isArray(config.scripts)||!config.scripts.length) errors.push('runtime.config.js必须声明真实私有UMD脚本');
    if(!Array.isArray(config.styles)||!config.styles.length) errors.push('runtime.config.js必须声明真实SweetUI样式');
    if(typeof config.modules!=='function') errors.push('runtime.config.js缺少modules()映射函数');
    for(const entry of [...(config.scripts||[]),...(config.styles||[])]) {
      if(typeof entry.file!=='string'||!entry.file.startsWith('./public/library/')||entry.file.includes('..')||entry.file.includes('\\')) {errors.push('非法runtime相对路径: '+entry.file);continue;}
      const candidate=path.resolve(root,entry.file);
      if(!candidate.startsWith(library+path.sep)||!fs.existsSync(candidate)||!fs.statSync(candidate).isFile()) errors.push('运行时文件不存在: '+entry.file);
    }
  } catch(error) {errors.push(error.message);}
  for(const name of ['vue.global.prod.js','dayjs.min.js','vue3-sfc-loader.js']) if(!fs.existsSync(path.join(library,name))) errors.push('通用运行时缺少 '+name);
  const cssSeen=new Set();
  function checkCSS(file){
    if(cssSeen.has(file))return;cssSeen.add(file);
    if(!fs.existsSync(file))return;
    const text=fs.readFileSync(file,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
    const urls=[...text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(m=>m[1].trim());
    for(const m of text.matchAll(/@import\s+["']([^"']+)["']/g))urls.push(m[1]);
    for(const url of urls){if(/^(data:|#)/.test(url))continue;if(/^(https?:|\/\/)/.test(url)){errors.push('Offline CSS uses remote resource: '+url);continue;}
      let decoded;try{decoded=decodeURIComponent(url.split(/[?#]/)[0]);}catch{errors.push('Invalid CSS URL: '+url);continue;}
      const target=path.resolve(path.dirname(file),decoded);
      if(!target.startsWith(library+path.sep)||!fs.existsSync(target))errors.push('CSS resource missing/outside runtime: '+target);else if(target.endsWith('.css'))checkCSS(target);
    }
  }
  for(const entry of config?.styles||[])if(typeof entry.file==='string'&&entry.file.startsWith('./public/library/')&&!entry.file.includes('..'))checkCSS(path.resolve(root,entry.file));
  return {ok:errors.length===0,errors,prepared:config?.prepared,mappedModules:config?.mappedModules};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),i=args.indexOf('--dir'),root=i>=0?path.resolve(args[i+1]||''):undefined;
  const report=checkRuntime(root);
  console.log('RESULT: '+(report.ok?'OK':'FAIL'));
  report.errors.forEach(e=>console.log('ERROR: '+e));
  if(!report.ok){console.log('HINT: references/runtime-setup.md');process.exitCode=1;}
}
