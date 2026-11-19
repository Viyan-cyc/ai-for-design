// R6 runtime harness: imports the independently built library, not prototype component code.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const [workArg,sourcesArg]=process.argv.slice(2),work=resolve(workArg),sources=resolve(sourcesArg),library=join(work,'library');
const evidence=JSON.parse(await readFile(join(work,'verification.json')));
if(evidence.engineering!=='static-passed-runtime-pending')throw Error('先完成独立库类型与构建');
const deps=join(library,'node_modules'),{build}=await import(pathToFileURL(join(deps,'esbuild/lib/main.js')));
const {patchMapLibre}=await import(pathToFileURL(join(work,'adapter/patch-maplibre.mjs')));
await writeFile(join(work,'maplibre-heat.cjs'),patchMapLibre(await readFile(join(deps,'maplibre-gl/dist/maplibre-gl-dev.js'),'utf8')));
const runtime=join(work,'runtime');await mkdir(runtime,{recursive:true});
const dist=join(library,'dist/es/map.js').replaceAll('\\','/');
await writeFile(join(runtime,'heat-entry.mjs'),`export {HeatField,GridHeat,BuildingTint} from ${JSON.stringify(dist)};\nexport {defaults} from ${JSON.stringify(join(library,evidence.destination,'heat-field/field.ts').replaceAll('\\','/'))};\n`);
const project=join(sources,'grid-building-heat'),example=join(project,'example');
const bundle=await build({entryPoints:[join(example,'main.mjs')],bundle:true,format:'iife',platform:'browser',write:false,outdir:'out',nodePaths:[deps],alias:{'maplibre-gl/dist/maplibre-gl.css':join(deps,'maplibre-gl/dist/maplibre-gl.css'),'maplibre-gl':join(work,'maplibre-heat.cjs')},plugins:[{name:'installed-library-only',setup(b){b.onResolve({filter:/field[.]ts$/},args=>args.path==='../component/src/field.ts'?{path:join(library,evidence.destination,'heat-field/field.ts')}:undefined);b.onResolve({filter:/host\/component\/src\/index\.ts$/},()=>({path:join(library,'dist/es/map.js')}));b.onResolve({filter:/^\.\.\/component\/src\/index\.ts$/},()=>({path:join(runtime,'heat-entry.mjs')}));}}],metafile:true});
const wrong=Object.keys(bundle.metafile.inputs).filter(p=>p.replaceAll('\\','/').includes('/grid-building-heat/component/'));
if(wrong.length)throw Error('运行验证错误使用原型组件 '+wrong.join(','));
let html=await readFile(join(example,'index.html'),'utf8');html=html.replace('<script type="module" src="main.mjs"></script>',()=>'<style>'+(bundle.outputFiles.find(f=>f.path.endsWith('.css'))?.text??'')+'</style><script>'+bundle.outputFiles.find(f=>f.path.endsWith('.js')).text.replaceAll('</script','<\\/script')+'</script>');
await writeFile(join(runtime,'index.3d.html'),html);await writeFile(join(runtime,'bundle-inputs.json'),JSON.stringify(bundle.metafile.inputs,null,2));
for(const name of ['regression','browser']){
 let script=await readFile(join(sources,'r5-evidence/remove71',name+'.mjs'),'utf8');
 script=script.replace("new URL('../../grid-building-heat/index.3d.html',import.meta.url).href",JSON.stringify(pathToFileURL(join(runtime,'index.3d.html')).href));
 if(script.includes('../../grid-building-heat'))throw Error('测试页面路径未替换');
 await writeFile(join(runtime,name+'.mjs'),script);
 const result=spawnSync(process.execPath,[join(runtime,name+'.mjs')],{encoding:'utf8',maxBuffer:8*1024*1024});
 await writeFile(join(runtime,name+'.log'),(result.stdout??'')+(result.stderr??''));
 if(result.status!==0)throw Error('运行回归失败 '+join(runtime,name+'.log'));
}
console.log(JSON.stringify({runtime,heatAndMap:'passed',scatter:'pending',visual:'not-evaluated'}));
