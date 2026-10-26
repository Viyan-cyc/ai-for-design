// Compile Vue SFCs, validate imports/resources and refresh preview sources.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {refresh} from './build-data.mjs';
import {checkRuntime} from './check-runtime.mjs';
import {projectModules,writeNativePlugins} from './project-modules.mjs';
import {readWhitelist} from './native-tools.mjs';

const scripts=path.dirname(fileURLToPath(import.meta.url)),skill=path.dirname(scripts);
const errors=[],warnings=[];
const args=process.argv.slice(2),idx=args.findIndex(x=>x==='--dir'||x==='-d');
function list(name){return new Set(readWhitelist(path.join(scripts,'verify','whitelists',name+'.json')));}
try {
  if(idx<0||!args[idx+1]||args[idx+1].startsWith('--')) throw new Error('Usage: node build.mjs --dir "<project>"');
  const root=path.resolve(args[idx+1]),src=path.join(root,'src');
  const state=path.join(root,'preview-build.js');
  fs.writeFileSync(state,'window.__GTS_BUILD_OK__ = false;\n');
  const runtime=checkRuntime(root);errors.push(...runtime.errors);
  const envCfg=JSON.parse(fs.readFileSync(path.join(skill,'references','env-config.json'),'utf8'));
  const envRoot=process.env[envCfg.envDirEnvVar]||(process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(process.env.USERPROFILE,'AppData','Local'),envCfg.envDirName):process.platform==='darwin'?path.join(process.env.HOME,'Library','Application Support',envCfg.envDirName):path.join(process.env.XDG_DATA_HOME||path.join(process.env.HOME,'.local','share'),envCfg.envDirName));
  const require=createRequire(path.join(envRoot,'compiler','package.json')),sfc=require('@vue/compiler-sfc');
  const requested=projectModules(root,sfc,{ignorePlugins:true});errors.push(...requested.errors);
  writeNativePlugins(root,requested.modules.includes('@hw-dtn/dt-ui'));
  const reachable=projectModules(root,sfc);errors.push(...reachable.errors);
  if(runtime.ok&&runtime.mappedModules)for(const name of reachable.modules)if(!runtime.mappedModules.includes(name))errors.push('Runtime has no actual mapping for '+name);
  const exportsByModule={'@hw-seq/sweet-ui-base':list('sweetui-exports'),'@hw-dtn/dt-ui':list('dt-ui-exports')};
  const modules=list('modules'),tokens=list('sweetui-tokens'),icons=list('sweetui-icons');
  const files=[];
  function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.')||e.name==='node_modules'||e.isSymbolicLink())continue;const full=path.join(dir,e.name);if(e.isDirectory())walk(full);else files.push(full);}}
  if(!fs.existsSync(src)) throw new Error('src missing');walk(src);
  for(const rel of ['App.vue','main.js','native-adapter.js','native-plugins.js','assets/themes/base.css','assets/themes/native-compat.css']) if(!fs.existsSync(path.join(src,rel))) errors.push('Missing src/'+rel);
  const html=fs.readFileSync(path.join(root,'index.gts.html'),'utf8');
  for(const needed of ['runtime.config.js','vue3-sfc-loader.js','preview-data.js','preview-build.js']) if(!html.includes(needed))errors.push('Offline loader missing '+needed);
  const sourceMap=Object.fromEntries(files.filter(f=>/\.(vue|js|mjs|css|json)$/.test(f)).map(f=>['/src/'+path.relative(src,f).split(path.sep).join('/'),fs.readFileSync(f,'utf8')]));
  const localTokens=new Set();let pageCount=0;
  for(const file of files.filter(f=>/\.(vue|js|mjs|css)$/.test(f))){const text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/(--page-[\w-]+)\s*:/g))localTokens.add(m[1]);}
  function importCheck(nodes,file){
    for(const node of nodes){
      if(!['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)||!node.source) continue;
      const spec=node.source.value;
      if(spec.startsWith('.')){
        const abs=path.resolve(path.dirname(file),spec);
        if(!abs.startsWith(src+path.sep))errors.push(`${file}: import escapes src: ${spec}`);
        else if(![abs,abs+'.vue',abs+'.js',abs+'.mjs',abs+'/index.vue',abs+'/index.js'].some(f=>fs.existsSync(f)))errors.push(`${file}: unresolved ${spec}`);
      } else {
        const style=/\.(css)$/.test(spec)&&['@hw-seq/sweet-ui-base/','@hw-dtn/dt-ui/'].some(prefix=>spec.startsWith(prefix));
        if(!style&&!modules.has(spec))errors.push(`${file}: offline module not mapped/listed: ${spec}`);
        if(spec==='@hw-dtn/dt-ui'&&(node.specifiers||[]).some(s=>s.type==='ImportDefaultSpecifier'))errors.push(`${file}: dt-ui UMD has named exports/install; use named components or import * as DtUI, not an invented default plugin`);
        const allowed=exportsByModule[spec];
        for(const s of node.specifiers||[])if(allowed&&s.type==='ImportSpecifier'&&!allowed.has(s.imported.name||s.imported.value))errors.push(`${file}: unknown collected ${spec} export ${s.imported.name||s.imported.value}; verify real export and update JSON whitelist`);
      }
    }
  }
  for(const file of files){
    if(file.endsWith('.less'))errors.push(file+': use ordinary CSS; Less is not supported');
    if(!/\.(vue|js|mjs|css)$/.test(file))continue;
    const rel=path.relative(root,file),text=fs.readFileSync(file,'utf8');
    if(file.endsWith('.vue')){
      if(/[\\/]pages[\\/][^\\/]+[\\/]index\.vue$/.test(file))pageCount++;
      const parsed=sfc.parse(text,{filename:file});
      if(parsed.errors.length){errors.push(rel+': '+parsed.errors.map(e=>e.message||e).join('; '));continue;}
      const d=parsed.descriptor;
      if(!d.template){errors.push(rel+': missing template');continue;}
      let bindings={};
      try{
        if(d.script||d.scriptSetup){const c=sfc.compileScript(d,{id:'gts-sweetui-verify'});bindings=c.bindings;importCheck([...(c.scriptAst||[]),...(c.scriptSetupAst||[])],file);}
      }catch(e){errors.push(rel+': script '+e.message);}
      const compiled=sfc.compileTemplate({source:d.template.content,filename:file,id:'gts-sweetui-verify',compilerOptions:{bindingMetadata:bindings}});
      errors.push(...compiled.errors.map(e=>rel+': template '+(e.message||e)));
      const builtins=new Set(['Teleport','Suspense','KeepAlive','Transition','TransitionGroup']);
      for(const m of d.template.content.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g))if(!builtins.has(m[1])&&!Object.hasOwn(bindings,m[1]))errors.push(`${rel}: <${m[1]}> is not imported/bound in this file`);
      for(const m of d.template.content.matchAll(/<((?:sweet|dt)-[a-z0-9-]+)[\s/>]/g)){const pascal=m[1].split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('');if(!Object.hasOwn(bindings,pascal))errors.push(`${rel}: <${m[1]}> missing explicit ${pascal} import`);}
      for(const style of d.styles){
        if(style.lang&&style.lang!=='css')errors.push(rel+': use ordinary CSS; unsupported style language '+style.lang);
        const compiledStyle=sfc.compileStyle({source:style.content,filename:file,id:'gts-sweetui-verify',scoped:!!style.scoped});
        errors.push(...compiledStyle.errors.map(e=>rel+': style '+(e.message||e)));
        for(const match of style.content.matchAll(/(--[A-Za-z][A-Za-z0-9-]*)\s*:/g))if(!match[1].startsWith('--page-'))errors.push(rel+': page-local custom property must use --page-: '+match[1]);
        if(/:root|\[data-theme|\[theme\s*=|(?:^|[},])\s*(?:html|body)\b/.test(style.content))errors.push(rel+': page styles must not replace theme scope');if(/\bzoom\s*:|font-size\s*:[^;}]*\d(?:vw|vh)\b/.test(style.content))warnings.push(rel+': use fluid layout instead of page/font scaling');if(/#[0-9a-f]{3,8}\b/i.test(style.content))warnings.push(rel+': prefer native --swt token over hardcoded colors');}
    }else if(/\.(?:js|mjs)$/.test(file)){
      try{importCheck(sfc.babelParse(text,{sourceType:'module'}).program.body,file);}catch(e){errors.push(rel+': JS '+e.message);}
    }
    if(/\.(vue|css|js|mjs)$/.test(file)){
      for(const m of text.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g))if(!tokens.has(m[1])&&!localTokens.has(m[1]))(m[2]===')'?errors:warnings).push(rel+': unknown token '+m[1]+'; check spelling against native CSS');
      for(const m of text.matchAll(/\bsweetui-icon-[a-z0-9-]+(?=[\s"'`<])/g))if(!icons.has(m[0]))errors.push(rel+': unknown font icon '+m[0]);
    }
  }
  if(!pageCount)errors.push('No src/pages/{PAGE}/index.vue');
  [...new Set(warnings)].forEach(w=>console.log('WARN: '+w));
  const uniqueErrors=[...new Set(errors)];
  if(uniqueErrors.length){uniqueErrors.forEach(e=>console.log('ERROR: '+e));throw new Error(uniqueErrors.length+' error(s)');}
  const result=refresh(root);if(!result.ok)throw new Error(result.reason);
  fs.writeFileSync(state,'window.__GTS_BUILD_OK__ = true;\nwindow.__GTS_BUILT_SOURCE__ = '+JSON.stringify(sourceMap)+';\nwindow.__GTS_REQUIRED_MODULES__ = '+JSON.stringify(reachable.modules)+';\n');
  console.log(`RESULT: OK\nHTML_PATH: ${path.join(root,'index.gts.html')}\nPAGES: ${pageCount}\nRUNTIME: not-run`);
}catch(e){console.log('RESULT: FAIL | '+e.message);process.exitCode=1;}
