import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {inspectApi,renderDocs} from '../../tools/3d-component-studio/intake/docs.mjs';
const root=resolve('.'),out=join(root,'docs/create-3d-component/native-work/library-demo');
const {results}=JSON.parse(await readFile(join(out,'result.json')));
for(const [i,item] of results.entries()){
 const profile=i?'host':'native',category=i?'helper':'core',name=i?'HostHighlight':'AuthoredComponent',id=item.id+'-docs',base='src/'+category+'/'+id,doc='docs/components/'+id;
 await mkdir(join(item.library,base),{recursive:true});await mkdir(join(item.library,doc),{recursive:true});
 for(const f of ['index.ts','parameters.ts'])await writeFile(join(item.library,base,f),(await readFile(join(root,'tools/3d-component-studio',profile+'-template/component/src',f),'utf8')).replaceAll('__ANIMATION__','none'));
 const require=createRequire(join(item.library,'package.json')),esbuild=require('esbuild');const paramFile=join(out,id+'-parameters.cjs');await esbuild.build({entryPoints:[join(item.library,base,'parameters.ts')],outfile:paramFile,bundle:true,platform:'node',format:'cjs'});
 const {api}=inspectApi(item.library,join(item.library,base,'index.ts'),[name]),params=require(paramFile),plan={names:[name],id,category,demo:true,payload:{}};
 const html=renderDocs(plan,api,params,'设计尚未确认','尚未发布或自动入库');
 assert.ok(!html.includes('设计尚未确认'));assert.ok(!html.includes('尚未发布'));assert.ok(html.indexOf('<h3>Examples')>html.indexOf('<h3>Methods'));
 assert.ok(html.includes('使用限制'));assert.ok(html.includes('返回当前配置'));if(!i)assert.ok(!html.includes('<h3>Properties'));
 const demo=(await readFile(join(root,'tools/3d-component-studio',profile+'-template/example/library-demo.ts'),'utf8')).replaceAll("'@component'",JSON.stringify('../../../'+base+'/index')).replaceAll("'@parameters'",JSON.stringify('../../../'+base+'/parameters'));
 await writeFile(join(item.library,doc,'demo.ts'),demo);await writeFile(join(item.library,doc,'index.html'),html);
 await writeFile(join(out,id+'-api.json'),JSON.stringify(api,null,2));
}
await writeFile(join(out,'docs-result.json'),JSON.stringify({status:'PASS',checks:['example after methods','maintenance prose excluded','empty properties hidden','method prose and limits retained'],previewIds:results.map(x=>x.id+'-docs')},null,2));
console.log('PASS docs rendering and preview generation');
