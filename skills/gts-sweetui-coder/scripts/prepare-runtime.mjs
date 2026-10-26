// One-time internal maintenance. Reads installed packages; never changes their dependencies.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {optionsOf,packageAt,compilerRequire,exportsFromUMD,allowedNativeIcons,scripts,skill} from './native-tools.mjs';
import {nativeStyles,writeTokenCatalog} from './native-styles.mjs';

export async function prepareRuntime(options){
  if(!options.project)throw new Error('Required: --project <existing internal Vue project>');
  const project=path.resolve(options.project),library=path.join(scripts,'preview','public','library');
  const configFile=path.join(library,'runtime.config.js');
  fs.writeFileSync(configFile,'window.GTS_SWEETUI_RUNTIME={ready:false,scripts:[],styles:[]};\n');
  const sweet=packageAt(project,'@hw-seq/sweet-ui-base'),dt=packageAt(project,'@hw-dtn/dt-ui');
  if(sweet.info.version!=='5.7.0')throw new Error('Page library must be SweetUI 5.7.0; installed: '+sweet.info.version);
  const vue=packageAt(project,'vue'),lodash=packageAt(sweet.dir,'lodash'),xss=packageAt(sweet.dir,'xss'),g6=packageAt(dt.dir,'@antv/g6');
  const echarts=packageAt(dt.dir,'echarts'),three=packageAt(dt.dir,'three');
  const cr=compilerRequire(),sfc=cr('@vue/compiler-sfc'),postcss=cr('postcss');
  let esbuild;
  for(const req of [createRequire(path.join(project,'package.json')),cr]){try{esbuild=req('esbuild');break;}catch{}}
  if(!esbuild)throw new Error('esbuild missing. Run node scripts/setup-env.mjs once, then retry (or reuse esbuild from this project).');
  const sweetUMD=path.join(sweet.dir,'dist','sweet-ui-base.umd.cjs'),dtUMD=path.join(dt.dir,'dist','dt-ui.umd.cjs');
  for(const file of [sweetUMD,dtUMD])if(!fs.existsSync(file))throw new Error('Actual UMD missing: '+file);
  const sweetText=fs.readFileSync(sweetUMD,'utf8'),dtText=fs.readFileSync(dtUMD,'utf8');
  if(!/\[\s*["']sweet-ui-base["']\s*\]/.test(sweetText)||!/\[\s*["']dtn-ui["']\s*\]/.test(dtText))throw new Error('Installed UMD globals differ from supplied notes; use the matching distribution, do not invent a global.');
  const sweetExports=exportsFromUMD(sweetText,sfc.babelParse),dtExports=exportsFromUMD(dtText,sfc.babelParse);
  for(const name of ['default','SweetButton','SweetTable','SweetConfigProvider'])if(!sweetExports.includes(name))throw new Error('Required actual SweetUI export missing: '+name);
  for(const name of ['install','DtChart'])if(!dtExports.includes(name))throw new Error('Required actual dt-ui export missing: '+name);
  const helper=options['js-xss-entry']?path.resolve(options['js-xss-entry']):['es/utils/js-xss-options.mjs','lib/utils/js-xss-options.js'].map(p=>path.join(dt.dir,p)).find(p=>fs.existsSync(p));
  if(!helper||!fs.existsSync(helper))throw new Error('Real js-xss-options implementation missing. Supply --js-xss-entry <actual module>; a no-op substitute is not permitted.');
  const helperExport=options['helper-export']||'default';if(!/^[$A-Z_a-z][$\w]*$/.test(helperExport))throw new Error('Invalid --helper-export');
  const styleEntry=path.join(sweet.dir,'theme-chalk','sweet','index.css');
  if(!fs.existsSync(styleEntry))throw new Error('Missing namespace=sweet CSS: '+styleEntry);
  const styles=nativeStyles({entry:styleEntry,postcss});
  allowedNativeIcons(styles.iconCSS);
  const dtStyle=path.join(dt.dir,'dist','index.css');if(!fs.existsSync(dtStyle))throw new Error('Missing actual dt-ui dist/index.css');
  // Invalidate readiness first. A failed preparation must never retain an old "ready" marker.
  fs.writeFileSync(configFile,'window.GTS_SWEETUI_RUNTIME={ready:false,scripts:[],styles:[],modules:function(){throw new Error("Runtime preparation incomplete");}};\n');
  const native=path.join(library,'native');fs.mkdirSync(native,{recursive:true});
  function copyTree(src,dest){fs.cpSync(src,dest,{recursive:true,filter:source=>!source.endsWith('.map')&&!source.endsWith('.less')});}
  for(const [pkg,name] of [[sweet,'sweetui'],[dt,'dtui']]){
    copyTree(path.join(pkg.dir,'dist'),path.join(native,name,'dist'));
    if(fs.existsSync(path.join(pkg.dir,'theme-chalk')))copyTree(path.join(pkg.dir,'theme-chalk'),path.join(native,name,'theme-chalk'));
  }
  fs.copyFileSync(path.join(vue.dir,'dist','vue.global.prod.js'),path.join(library,'vue.global.prod.js'));
  const vueNames=Object.keys(vue.require('vue')).filter(n=>n!=='default'&&/^[$A-Z_a-z][$\w]*$/.test(n));
  const vueShim='const V=window.Vue;export default V;'+vueNames.map(n=>`export const ${n}=V[${JSON.stringify(n)}];`).join('');
  const vuePlugin={name:'shared-real-vue-global',setup(build){build.onResolve({filter:/^vue$/},()=>({path:'vue',namespace:'gts-global'}));build.onLoad({filter:/.*/,namespace:'gts-global'},()=>({contents:vueShim,loader:'js'}));}};
  const optionsBase={bundle:true,platform:'browser',format:'iife',target:['es2020'],plugins:[vuePlugin],sourcemap:false,logLevel:'silent',loader:{'.svg':'dataurl','.png':'dataurl','.jpg':'dataurl','.wasm':'file','.woff':'file','.woff2':'file'},assetNames:'assets/[name]-[hash]'};
  async function bundle(code,name){await esbuild.build({...optionsBase,stdin:{contents:code,resolveDir:project,loader:'js'},outfile:path.join(native,name)});}
  await bundle(`import L from ${JSON.stringify(lodash.entry)};import X from ${JSON.stringify(xss.entry)};window._=L;window._$1=L;window._$z=L;window.xss=X;`,'shared.js');
  const importHelper=helperExport==='default'?`import H from ${JSON.stringify(helper)}`:`import {${helperExport} as H} from ${JSON.stringify(helper)}`;
  await bundle(`${importHelper};if(typeof H!=='function'&&typeof H?.install!=='function')throw new Error('Actual jsXssOptions must be a plugin');window.jsXssOptions=H;`,'js-xss-options.js');
  await bundle(`import * as G from ${JSON.stringify(g6.entry)};window.g6=G;`,'g6.js');
  await bundle(`import * as E from ${JSON.stringify(echarts.entry)};window.echarts=E;`,'echarts.js');
  await bundle(`import * as T from ${JSON.stringify(three.entry)};window.GtsThree=T;`,'three.js');
  const prefix='./public/library/';
  const scriptEntries=[
    {file:prefix+'native/shared.js'},
    {file:prefix+'native/js-xss-options.js',for:['@hw-dtn/dt-ui']},
    {file:prefix+'native/g6.js',for:['@hw-dtn/dt-ui','@antv/g6']},
    {file:prefix+'native/sweetui/dist/sweet-ui-base.umd.cjs'},
    {file:prefix+'native/dtui/dist/dt-ui.umd.cjs',for:['@hw-dtn/dt-ui']},
    {file:prefix+'native/echarts.js',for:['echarts','vue-echarts']},
    {file:prefix+'native/three.js',for:['three']},
    {file:prefix+'vue-echarts.iife.min.js',for:['vue-echarts']},
  ];
  const styleEntries=[{file:prefix+'native/sweetui/theme-chalk/sweet/index.css'},{file:prefix+'native/dtui/dist/index.css',for:['@hw-dtn/dt-ui']},{file:prefix+'vue-echarts.style.css',for:['vue-echarts']}];
  for(const [name,condition] of [['shared',null],['js-xss-options',['@hw-dtn/dt-ui']],['g6',['@hw-dtn/dt-ui','@antv/g6']],['echarts',['echarts','vue-echarts']],['three',['three']]])if(fs.existsSync(path.join(native,name+'.css')))styleEntries.push({file:prefix+'native/'+name+'.css',...(condition?{for:condition}:{})});
  function vueInfo(pkg){try{const p=packageAt(pkg.dir,'vue');return {version:p.info.version,entry:p.entry};}catch(e){return {error:e.message};}}
  const report={preparedAt:new Date().toISOString(),pageSweetui:sweet.info.version,dtui:dt.info.version,dtuiDeclaredSweetui:dt.info.dependencies?.['@hw-seq/sweet-ui-base'],dependencyPolicy:'Original dt-ui UMD/dependencies retained; no overrides, dedupe or package mutation',vue:vue.info.version,vueResolution:{project:vueInfo(vue),sweetui:vueInfo(sweet),dtui:vueInfo(dt)},sourcePackages:{sweetui:sweet.dir,dtui:dt.dir},jsXssSource:helper,g6:g6.info.version,darkAliasGenerated:styles.css.includes('uDesign2.2-dark'),runtime:'not-run'};
  const config=`/* Generated from actual installed UMD packages. Browser acceptance is still required. */\nwindow.GTS_SWEETUI_RUNTIME={ready:true,prepared:${JSON.stringify(report)},mappedModules:['vue','dayjs','@hw-seq/sweet-ui-base','@hw-dtn/dt-ui','@antv/g6','echarts','three','vue-echarts'],scripts:${JSON.stringify(scriptEntries)},styles:${JSON.stringify(styleEntries)},modules:function(){\nvar S=window['sweet-ui-base'];if(!S?.default?.install)throw new Error('Actual SweetUI default installer missing');\nvar result={'@hw-seq/sweet-ui-base':Object.assign({__esModule:true},S)};\nif(window['dtn-ui'])result['@hw-dtn/dt-ui']=Object.assign({__esModule:true},window['dtn-ui']);\nif(window.echarts)result.echarts=window.echarts;\nif(window.GtsThree)result.three=Object.assign({__esModule:true},window.GtsThree);\nif(window.VueECharts)result['vue-echarts']=window.VueECharts;\nif(window.g6)result['@antv/g6']=Object.assign({__esModule:true},window.g6);return result;}};\n`;
  fs.writeFileSync(path.join(scripts,'preview','src','assets','themes','native-compat.css'),styles.css);
  const whitelist=path.join(scripts,'verify','whitelists');
  for(const [name,values] of [['sweetui-exports',sweetExports],['dt-ui-exports',dtExports],['sweetui-tokens',styles.tokens]])fs.writeFileSync(path.join(whitelist,name+'.json'),JSON.stringify(values,null,2)+'\n');
  writeTokenCatalog(path.join(skill,'references','token-catalog.md'),styles.tokens,styles.values);
  const iconClasses=allowedNativeIcons(styles.iconCSS);
  fs.writeFileSync(path.join(whitelist,'sweetui-icons.json'),JSON.stringify(iconClasses,null,2)+'\n');
  fs.writeFileSync(configFile,config);
  const md=['# Runtime preparation','',`SweetUI ${report.pageSweetui}; dt-ui ${report.dtui}; dt-ui declared SweetUI ${report.dtuiDeclaredSweetui}.`,'','Original dt-ui distribution retained. jsXssOptions uses the actual module; no empty filters.','',`Shared external Vue: ${report.vue}.`, `G6: ${report.g6}; packaged for the complete dt-ui UMD until omission is proven safe.`, '', 'Browser render: not-run. Next: init → build → open index.gts.html.', '', '```',JSON.stringify(report,null,2),'```',''].join('\n');
  fs.writeFileSync(path.join(skill,'runtime-preparation.md'),md);
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const report=await prepareRuntime(optionsOf());console.log(`RESULT: OK\nSweetUI: ${report.pageSweetui}\nDtUI: ${report.dtui}\nRUNTIME: not-run\nNEXT: init → build → open index.gts.html`);}
  catch(e){console.log('RESULT: FAIL | '+e.message);process.exitCode=1;}
}
