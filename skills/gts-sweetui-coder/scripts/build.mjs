#!/usr/bin/env node
// One build: compile sources, link supported imports, check resources/names, then publish preview data.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

import {refresh} from './build-data.mjs';
import {compilerRequire,resolveSource,walkFiles,dependencies,visitAST,scripts} from './source-tools.mjs';
const args=process.argv.slice(2),i=args.findIndex(a=>a==='--dir'||a==='-d');
const errors=new Set(),warnings=new Set();
const fail=s=>errors.add(s),warn=s=>warnings.add(s);
async function build(){
  if(i<0||!args[i+1]||args[i+1].startsWith('-'))throw Error('Usage: node build.mjs --dir "<project>"');
  const root=path.resolve(args[i+1]),src=path.join(root,'src');
  if(!fs.existsSync(src))throw Error('src folder not found: '+src);
  // The loader is a fixed skill asset, not a business file. Sync it for existing projects too.
  fs.copyFileSync(path.join(scripts,'preview/index.gts.html'),path.join(root,'index.gts.html'));
  const req=compilerRequire(),sfc=req('@vue/compiler-sfc'),postcss=req('postcss');
  const files=walkFiles(src),key=f=>'/src/'+path.relative(src,f).split(path.sep).join('/');
  const byKey=Object.fromEntries(files.map(f=>[key(f),f]));
  const assets=/\.(png|jpe?g|gif|svg|webp|ico|bmp|woff2?|ttf|eot|otf|avif)$/i;
  const texts=/\.(vue|m?js|css|json)$/;
  for(const rel of ['App.vue','main.js','runtime.js','theme.js','i18n/index.js','assets/base.css'])if(!byKey['/src/'+rel])fail('Missing src/'+rel);
  const pages=files.filter(f=>/[\\/]pages[\\/][^\\/]+[\\/]index\.vue$/.test(f));if(!pages.length)fail('No src/pages/{Name}/index.vue');
  function localResource(value,from){
    if(!value||/^(?:data:|https?:|blob:|#|\/\/)/i.test(value))return;
    let clean;try{clean=decodeURIComponent(value.split(/[?#]/)[0]);}catch{fail(from+': invalid resource URL '+value);return;}
    const target=(clean.startsWith('/')?path.resolve(root,'.'+clean):path.resolve(path.dirname(from),clean));
    if(!target.startsWith(root+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())fail(from+': missing/outside local resource '+value);
  }
  function cssResources(text,file){const ast=postcss.parse(text,{from:file});ast.walkDecls(d=>{for(const m of d.value.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))localResource(m[1].trim(),file);});ast.walkAtRules('import',n=>{const m=n.params.match(/^(?:url\(\s*)?["']([^"']+)["']/);if(m)localResource(m[1],file);});}
  function previewCSS(css,file){
    const ast=postcss.parse(css,{from:file});
    ast.walkAtRules('import',()=>{throw Error('Use JS imports for local CSS dependencies; CSS @import is unsupported in offline injected styles');});
    ast.walkDecls(d=>{d.value=d.value.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g,(all,url)=>{if(/^(data:|https?:|blob:|#|\/\/)/i.test(url))return all;const clean=url.split(/[?#]/)[0],suffix=url.slice(clean.length),target=clean.startsWith('/')?path.resolve(root,'.'+decodeURIComponent(clean)):path.resolve(path.dirname(file),decodeURIComponent(clean));return 'url("./'+encodeURI(path.relative(root,target).split(path.sep).join('/'))+suffix+'")';});});
    return ast.toString();
  }
  const sourceOnly=args.includes('--source-only');
  if(!sourceOnly){
    const html=fs.readFileSync(path.join(root,'index.gts.html'),'utf8');
    for(const m of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/g))if(m[1]!=='./preview-data.js')localResource(m[1],path.join(root,'index.gts.html'));
    if(fs.existsSync(path.join(root,'public')))for(const f of walkFiles(path.join(root,'public')).filter(f=>f.endsWith('.css')))try{cssResources(fs.readFileSync(f,'utf8'),f);}catch(e){fail(f+': CSS '+e.message);}
  }
  const context=vm.createContext({console:{warn(){},error(){},log(){}},setTimeout,clearTimeout});
  for(const name of ['vue.global.prod.js','dayjs.min.js'])vm.runInContext(fs.readFileSync(path.join(scripts,'preview/public/library',name),'utf8'),context,{timeout:5000});
  const read=name=>JSON.parse(fs.readFileSync(path.join(scripts,'verify/whitelists',name+'.json'),'utf8'));
  const packageExports=new Map([
    ['vue',new Set(Object.keys(context.Vue))],
    ['dayjs',new Set(['default'])],
    ['@hw-seq/sweet-ui-base',new Set(read('sweetui-exports'))]
  ]);
  const knownTokens=new Set(read('sweetui-tokens').map(t=>t.name));
  const icons=new Set(read('sweetui-icons').map(i=>i.cssClass));
  const runtimeSources={},records=new Map(),tokenTexts=[],defined=new Set();
  function tokenSource(text,label){
    for(const m of text.matchAll(/\bsweetui-icon-[A-Za-z0-9_-]+/g))if(!icons.has(m[0]))fail(label+': unknown icon '+m[0]);
    tokenTexts.push([text.replace(/\/\*[\s\S]*?\*\//g,''),label]);}
  function getNames(pattern,out){if(!pattern)return;if(pattern.type==='Identifier')out.add(pattern.name);else if(pattern.type==='ObjectPattern')pattern.properties.forEach(p=>getNames(p.value||p.argument,out));else if(pattern.type==='ArrayPattern')pattern.elements.forEach(p=>getNames(p,out));else if(pattern.type==='AssignmentPattern')getNames(pattern.left,out);else if(pattern.type==='RestElement')getNames(pattern.argument,out);}
  for(const file of files){const k=key(file);if(file.endsWith('.less'))fail(k+': only ordinary CSS is supported');if(!texts.test(file))continue;const source=fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'');let ast=[],bindings={};const sourceEdits=[];
    try{
      if(file.endsWith('.vue')){
        const parsed=sfc.parse(source,{filename:file});if(parsed.errors.length)throw Error(parsed.errors.map(e=>e.message||e).join('; '));const d=parsed.descriptor;
        if([d.script,d.scriptSetup].some(b=>b?.lang&&!['js','javascript'].includes(b.lang)))fail(k+': offline SFC scripts support JavaScript only');
        if(d.script||d.scriptSetup){const c=sfc.compileScript(d,{id:'gts-verify'});bindings=c.bindings||{};ast=[...(c.scriptAst||[]),...(c.scriptSetupAst||[])];}
        if(!d.template){fail(k+': missing template');}else{
          const c=sfc.compileTemplate({source:d.template.content,filename:file,id:'gts-verify',compilerOptions:{bindingMetadata:bindings}});c.errors.forEach(e=>fail(k+': template '+(e.message||e)));
          const builtin=new Set(['Teleport','Suspense','KeepAlive','Transition','TransitionGroup']);
          for(const m of d.template.content.matchAll(/<([A-Z][A-Za-z0-9]*)[\s/>]/g))if(!builtin.has(m[1])&&!Object.hasOwn(bindings,m[1]))fail(k+': unbound component <'+m[1]+'>');
          for(const m of d.template.content.matchAll(/<((?:sweet-)[a-z0-9-]+)[\s/>]/g)){const tag=m[1].replace(/(^|-)(\w)/g,(_,a,b)=>b.toUpperCase());if(!packageExports.get('@hw-seq/sweet-ui-base').has(tag))fail(k+': unknown component '+m[1]);if(!Object.hasOwn(bindings,tag))fail(k+': use explicitly imported '+tag);}
          const shared=req('@vue/shared');
          for(const m of d.template.content.matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]+)[\s/>]/g)){const tag=m[1];if(tag.startsWith('sweet-')||shared.isHTMLTag(tag)||shared.isSVGTag(tag)||['keep-alive','transition-group'].includes(tag))continue;const name=tag.replace(/(^|-)(\w)/g,(_,a,b)=>b.toUpperCase());if(!Object.hasOwn(bindings,name))fail(k+': unbound component <'+tag+'>');}
          // Static image/media resources; bound paths use checked asset imports or business runtime data.
          const tree=d.template.ast;function nodeWalk(n){if(!n||typeof n!=='object')return;if(n.type===1){for(const p of n.props||[])if(p.type===6&&['src','poster'].includes(p.name)&&p.value){
              const value=p.value.content;localResource(value,file);
              if(value&&!/^(?:data:|https?:|blob:|#|\/\/)/i.test(value)){
                const clean=value.split(/[?#]/)[0],suffix=value.slice(clean.length);
                const target=clean.startsWith('/')?path.resolve(root,'.'+decodeURIComponent(clean)):path.resolve(path.dirname(file),decodeURIComponent(clean));
                const url='./'+encodeURI(path.relative(root,target).split(path.sep).join('/'))+suffix;
                sourceEdits.push({start:p.value.loc.start.offset,end:p.value.loc.end.offset,css:JSON.stringify(url)});
              }
            }nodeWalkChildren(n);}else nodeWalkChildren(n);}function nodeWalkChildren(n){for(const c of n.children||[])nodeWalk(c);}nodeWalk(tree);
          tokenSource(d.template.content,k);
          function checkIconProps(n){
            if(!n||typeof n!=='object')return;
            if(n.type===1)for(const p of n.props||[]){
              if(p.type===6&&['icon-class','iconClass'].includes(p.name)&&p.value&&!icons.has(p.value.content))fail(k+': unknown icon '+p.value.content);
              if(p.type===7&&p.name==='bind'&&['icon-class','iconClass'].includes(p.arg?.content)&&p.exp){
                try {const expr=sfc.babelParse('('+p.exp.content+')',{sourceType:'module'}).program.body[0].expression;
                  if(expr.type==='StringLiteral'&&!icons.has(expr.value))fail(k+': unknown icon '+expr.value);
                }catch{}
              }
            }
            for(const child of n.children||[])checkIconProps(child);
          }
          checkIconProps(d.template.ast);

          for(const m of d.template.content.matchAll(/:(?:icon-class|iconClass)\s*=\s*(["'])(.*?)\1/g)){
            const expr=m[2];if(!/^(['"]).*\1$/.test(expr))warn(k+': dynamic icon binding; verify configuration against sweetui-icons.json: '+expr);
          }
        }
        const styleEdits=sourceEdits;
        for(const st of d.styles){
          if(st.src){fail(k+': external SFC style src is unsupported; import CSS explicitly');continue;}
          if(st.lang&&st.lang!=='css'){fail(k+': unsupported style language '+st.lang);continue;}
          const raw=st.content;
          const c=sfc.compileStyle({source:raw,filename:file,id:'gts-verify',scoped:!!st.scoped});c.errors.forEach(e=>fail(k+': style '+(e.message||e)));if(!c.errors.length){cssResources(raw,file);styleEdits.push({start:st.loc.start.offset,end:st.loc.end.offset,css:previewCSS(raw,file)});}
          if(st.module)fail(k+': CSS modules are unsupported in this offline preview');
          if(!st.scoped)warn(k+': unscoped style; keep global overrides narrowly targeted');
          if(/:root|\[theme|\[data-theme|(?:^|[},])\s*(?:html|body)\b/.test(st.content))fail(k+': page style must not replace global theme scope');
          for(const m of st.content.matchAll(/(--[A-Za-z][A-Za-z0-9-]*)\s*:/g)){if(!m[1].startsWith('--page-'))fail(k+': local custom property requires --page-: '+m[1]);else defined.add(m[1]);}
          if(/#[0-9a-f]{3,8}\b/i.test(st.content))warn(k+': hardcoded hex; prefer design tokens');
          if(/\bzoom\s*:|font-size\s*:[^;}]*\d(?:vw|vh)\b/.test(st.content))warn(k+': viewport/page scaling; use fluid layout');tokenSource(st.content,k);
        }
        let previewSource=source;for(const edit of styleEdits.sort((a,b)=>b.start-a.start))previewSource=previewSource.slice(0,edit.start)+edit.css+previewSource.slice(edit.end);runtimeSources[k]=previewSource;
      }else if(/\.m?js$/.test(file))ast=sfc.babelParse(source,{sourceType:'module'}).program.body;
      else if(/\.css$/.test(file)){
        const css=source;postcss.parse(css,{from:file});cssResources(css,file);runtimeSources[k]=previewCSS(css,file);tokenSource(source,k);
        for(const m of source.matchAll(/(--[A-Za-z][A-Za-z0-9-]*)\s*:/g)){if(m[1].startsWith('--page-'))defined.add(m[1]);else fail(k+': local custom property requires --page-: '+m[1]);}
      }else if(file.endsWith('.json')){
        const data=JSON.parse(source);
        function strings(value){if(typeof value==='string')tokenSource(value,k);else if(Array.isArray(value))value.forEach(strings);else if(value&&typeof value==='object')Object.values(value).forEach(strings);}
        strings(data);
      }
      const rec={file,k,ast,deps:dependencies(ast),exports:new Set(file.endsWith('.vue')?['default']:file.endsWith('.json')?['default']:[])};
      for(const n of ast){if(n.type==='ExportDefaultDeclaration')rec.exports.add('default');if(n.type==='ExportNamedDeclaration'){for(const spec of n.specifiers||[])rec.exports.add(spec.exported.name||spec.exported.value);const dec=n.declaration;if(dec?.id)getNames(dec.id,rec.exports);for(const d of dec?.declarations||[])getNames(d.id,rec.exports);}}
      visitAST(ast,n=>{if(n.type==='StringLiteral')tokenSource(n.value,k);if(n.type==='TemplateElement')tokenSource(n.value.raw,k);});
      if(file.endsWith('.json'))rec.exports.add('default');records.set(k,rec);
    }catch(e){fail(k+': '+e.message);}
  }
  function targetOf(dep,from){
    if(typeof dep.spec!=='string'){fail(from+': dynamic import must use a literal module path');return null;}
    if(packageExports.has(dep.spec))return {exports:packageExports.get(dep.spec)};
    if(dep.spec==='@hw-seq/sweet-ui-base/dist/sweet-ui-base.css')return {exports:new Set()};
    if(!dep.spec.startsWith('.')&&!dep.spec.startsWith('/')){fail(from+': unmapped module '+dep.spec);return null;}
    const target=resolveSource(dep.spec,from,byKey);if(!target){fail(from+': missing/outside import '+dep.spec);return null;}
    if(assets.test(target))return {exports:new Set(['default'])};
    if(!texts.test(target)){fail(from+': unsupported module type '+target);return null;}
    return records.get(target)||{exports:new Set()};
  }
  // Resolve export-star chains to a fixed point, then validate named bindings.
  for(let pass=0;pass<=records.size;pass++){let changed=false;for(const rec of records.values())for(const dep of rec.deps)if(dep.node.type==='ExportAllDeclaration'){const target=targetOf(dep,rec.k);for(const name of target?.exports||[])if(name!=='default'&&!rec.exports.has(name)){rec.exports.add(name);changed=true;}}if(!changed)break;}
  for(const rec of records.values())for(const dep of rec.deps){const target=targetOf(dep,rec.k);if(!target)continue;for(const spec of dep.node.specifiers||[]){let name;if(spec.type==='ImportDefaultSpecifier')name='default';else if(spec.type==='ImportSpecifier')name=spec.imported.name||spec.imported.value;else if(spec.type==='ExportSpecifier'&&dep.node.source)name=spec.local.name||spec.local.value;if(name&&!target.exports.has(name))fail(rec.k+': '+dep.spec+' has no export '+name);}}
  for(const [text,label]of tokenTexts)for(const m of text.matchAll(/var\(\s*(--[A-Za-z][A-Za-z0-9-]*)\s*([,)])/g)){const name=m[1];if(defined.has(name)||knownTokens.has(name))continue;const message=label+': unknown token '+name;fail(message);}
  for(const message of warnings)console.log('WARN: '+message);
  if(errors.size){console.log('RESULT: FAIL | '+errors.size+' error(s)');for(const message of errors)console.log('ERROR: '+message);process.exitCode=1;return;}
  if(sourceOnly){console.log('RESULT: SOURCE_OK\nRUNTIME: not-checked; no preview published');return;}
  const result=refresh(root,runtimeSources);if(!result.ok)throw Error(result.reason);
  console.log('RESULT: OK\nHTML_PATH: '+path.join(root,'index.gts.html')+'\nPAGES: '+pages.length+'\nRUNTIME: not-run');
}
build().catch(e=>{console.log('RESULT: FAIL | '+e.message+'\nHINT: ensure shared compiler dependencies are ready; inspect the reported source/resource.');process.exitCode=1;});
