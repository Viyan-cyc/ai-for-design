import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {inspectApi,renderDocs} from './docs.mjs';

const descriptions={
 MapExperience:'完整地图体验：统一管理底图、建筑、光影、双主题及地图交互。新创作地图使用此入口；MapScene保留为既有工程兼容入口，不要在同一容器同时创建两个地图。',
 LogicalScatter:'逻辑坐标散点与缩放聚合。接收0–1的x/y坐标，标记保持固定CSS尺寸；不接收经纬度，也不自动投影到地图。',
 GridHeat:'经纬度栅格热力。接收0–255整数值，通过共享HeatField分档着色，支持空数据、独立显示开关和实时更新。',
 BuildingTint:'按建筑表面每个片段的地面投影染色，同时适配原生建筑和普通Three模型；保持原几何、材质明暗与不透明度。'
};
const notes={
 MapExperience:['容器必须为空且具有明确尺寸。style、center由应用提供；本示例采用在线底图及3D视角。构造默认mode为2d，示例的3D相机不是源码默认值。','地标通过assets显式注入，本页不内置原始地标模型。MapExperience拥有地图和自有资源；销毁前先释放挂接的业务图层。需要共享深度扫描的既有MapScene工程继续使用原接口，不能直接替换类型。'],
 LogicalScatter:['data为{id,x,y,label?}数组，id唯一，x/y均在0–1内。聚合依据逻辑缩放网格，不能与经纬度地图聚合混用。','默认业务数据为空；示例页显式载入模拟数据。setData与setOptions原位更新，dispose移除自有画布和监听。'],
 GridHeat:['先创建HeatField，再传入已创建的MapLibre map。setData/setOptions修改共享场，其他使用同一场的组件也会更新；setVisible仅影响地面格子。','value为0–255整数；同一单元不允许重复数据。空数组不补演示数据；无数据孔洞与范围外不着色。格子缩小的视觉间隙仍属该单元有效范围。','五档默认颜色及非均匀分界来自HeatField默认配置。尺寸、透明度同样按档插值；threshold按value/255过滤。示例参数表描述HeatField配置，构造函数的field应传实例。','dispose不释放借用的map或field。共享场由创建者在所有消费者释放后销毁。'],
 BuildingTint:['必须使用随组件提供的MapLibre构建适配，普通未适配MapLibre会拒绝启动。适配用于MapLibre5.24.0、Mercator和无图案fill-extrusion；构建接法见下方示例。','与GridHeat共用一个HeatField实例。格子透明度和显示开关不影响建筑染色；关闭染色使用setOptions({enabled:false})。','普通不透明Three MeshStandardMaterial模型需宿主发布heatmodelrender/heatmodelremove事件并传入scene、sceneToMercator和renderer。MapExperience已包含该地标接点；本页的球体与塔身是程序生成的演示模型，不代表东方明珠。','不支持蒙皮或实例化网格。无数据孔洞/范围外保留原状。dispose还原材质回调并释放自有纹理，不释放借用模型、地图或共享场。']
};
const usage={
 MapExperience:`import { MapExperience } from '@a3d/a3d-components/map';
import 'maplibre-gl/dist/maplibre-gl.css';
// container与styleUrl由应用提供；地标资产可通过assets显式传入。
const scene = new MapExperience({ container, style: styleUrl,
  center: [121.49517, 31.24194], mode: '3d', zoom: 16.2 });
scene.setParameters({ water: '#CEE3FD' });
scene.setTheme('dark');
scene.dispose();`,
 LogicalScatter:`import { LogicalScatter } from '@a3d/a3d-components/map';
const scatter = new LogicalScatter(container);
scatter.setData([{ id: 'fault-1', x: 0.45, y: 0.55 }]);
scatter.setOptions({ pointRadius: 4, markerTone: 'red' });
scatter.setZoom(0.6);
scatter.dispose();`,
 GridHeat:`import { HeatField, GridHeat } from '@a3d/a3d-components/map';
const field = new HeatField();
const grid = new GridHeat(map, field);
field.setData([{ lng: 121.49517, lat: 31.24194, value: 180 }]);
grid.setOptions({ alphaStart: 0.8, alphaEnd: 0.8 });
grid.setVisible(false); // 不影响使用同一场的建筑染色
grid.dispose();
field.dispose(); // 所有消费者释放后再释放共享场`,
 BuildingTint:`import { HeatField, GridHeat, BuildingTint } from '@a3d/a3d-components/map';
// map必须来自已完成渲染适配的MapLibre；Three模型另需宿主事件接点。
const field = new HeatField();
const grid = new GridHeat(map, field);
const tint = new BuildingTint(map, field, { brightness: 1.5 });
field.setData([{ lng: 121.49517, lat: 31.24194, value: 180 }]);
grid.setVisible(false); // 关闭格子后建筑仍染色
tint.setOptions({ enabled: false }); // 恢复原建筑表现
tint.dispose(); grid.dispose(); field.dispose();`
};
const methodDescriptions={
 getBuildingState:'读取当前普通建筑的满高比例heightScale、生长比例growth与visible；独立模型使用自己的变换，不应套用此比例。',
 setData:'更新业务数据；空数组清空，不补入模拟数据。',setOptions:'验证并更新选项，通过公开接口立即应用。',dispose:'幂等释放自身资源及监听；借用资源由其创建者管理。',setVisible:'只切换该地面栅格显示，不改变共享数据或建筑染色。',getVisible:'读取地面栅格开关。',getOptions:'读取当前配置。',setZoom:'设置0–1逻辑缩放并重新聚合。',getState:'读取当前逻辑缩放、标记及运行状态。',setFieldOptions:'更新共享HeatField配置，会通知同一场的消费者。',diagnostics:'读取运行统计和释放状态，不用于业务数据。',getParameters:'读取当前地图外观参数。',setParameters:'验证并更新地图外观；样式加载期间保存待应用值。',setTheme:'切换light/dark主题并应用对应默认外观。',setMode:'切换2d/3d地图视角。',setPitch:'设置15–75度目标俯仰。',getView:'读取地图相机及目标俯仰。',restoreView:'恢复已验证的完整相机快照。',flyTo:'按经纬度定位并平滑移动。',resize:'按宿主容器重新调整显示尺寸。',setOutside:'设置范围外表现；传null关闭。',outsideDiagnostics:'读取范围外合成状态。',validateOptions:'验证配置并返回新值；不会应用到实例。'
};

export async function pages(target,work){
 const require=createRequire(join(target,'package.json')),esbuild=require('esbuild'),base=join(target,'src/map/restored-map-suite');
 async function load(file){const out=join(work,file.split('/')[0]+'-params.cjs');await esbuild.build({entryPoints:[join(base,file)],outfile:out,bundle:true,platform:'node',format:'cjs'});return require(out);}
 const map=await load('map-experience/parameters.ts'),scatter=await load('logical-scatter/parameters.ts'),heat=await load('heat-field/field.ts');
 const tintSource=await readFile(join(base,'building-tint/index.ts'),'utf8'),match=tintSource.match(/validateOptions\(options,\{enabled:(true|false),strength:([\d.]+),brightness:([\d.]+)\}\)/);
 if(!match)throw Error('染色默认配置结构变化，须核对文档生成');
 const tint={enabled:match[1]==='true',strength:Number(match[2]),brightness:Number(match[3])};
 const params={
  MapExperience:{defaults:map.themes.light,controls:map.controls},
  LogicalScatter:{defaults:scatter.defaults,controls:Object.entries(scatter.controls).map(([key,c])=>({key,label:c[0],min:c[1],max:c[2],unit:c[4]}))},
  GridHeat:{defaults:heat.defaults,controls:Object.keys(heat.defaults).map(key=>({key,label:({origin:'栅格原点，经纬度',cellSizeMeters:'中心间距',bins:'档数',colorMode:'双色或五色插值',colors:'颜色节点',sizeStart:'首档边长比例',sizeEnd:'末档边长比例',alphaStart:'首档不透明度',alphaEnd:'末档不透明度',breaks:'非均匀分界',bandMode:'均匀/非均匀分档',threshold:'最低显示值/255',colorBlur:'颜色平滑标准差'})[key],unit:key==='cellSizeMeters'?'米':key==='colorBlur'?'单元':''}))},
  BuildingTint:{defaults:tint,controls:[{key:'enabled',label:'开启染色',unit:''},{key:'strength',label:'染色强度',unit:'0–1',min:0,max:1},{key:'brightness',label:'建筑明度',unit:'0–2',min:0,max:2}]}
 };
 const result={};
 for(const name of Object.keys(descriptions)){
  const {api}=inspectApi(target,join(base,'index.ts'),[name]);const a=api[0];a.description=descriptions[name];a.remarks=notes[name];a.examples=[usage[name]];
  a.parameterTypes=a.parameterTypes.filter(t=>t.name!=='HeatField');
  if(name==='BuildingTint')a.examples.push(`// 在应用的Node构建脚本中（不是浏览器运行时）：
import { readFileSync, writeFileSync } from 'node:fs';
import { patchMapLibre } from './scripts/adapters/patch-maplibre.mjs';
const source = readFileSync('node_modules/maplibre-gl/dist/maplibre-gl-dev.js', 'utf8');
writeFileSync('maplibre-heat.cjs', patchMapLibre(source));
// 将构建工具中精确匹配maplibre-gl的JS导入alias到此文件。
// CSS仍从maplibre-gl/dist/maplibre-gl.css导入；不可修改node_modules。`);
  for(const p of a.properties.filter(p=>p.type.startsWith('(')&&p.type.includes('=>')))a.methods.push({signature:p.name+p.type.replace(' => ',': '),description:methodDescriptions[p.name]||''});
  a.properties=a.properties.filter(p=>!p.type.includes('=>'));
  for(const m of a.methods)m.description=methodDescriptions[m.signature.split('(')[0]]||m.description;
  let html=renderDocs({names:[name],category:'map',demo:true},api,params[name],'','');
  html=html.replace(/>(0\.\d{5,})</g,(_,n)=>` title="${n}">≈${Number(n).toFixed(2)}<`);
  result['docs/components/'+name+'/index.html']=html;
  result['docs/components/'+name+'/demo.ts']=name==='LogicalScatter'?"import {scatterDemo} from '../../shared/restored-scatter-demo';\nexport const initDemo=scatterDemo;\n":`import {restoredMapDemo} from '../../shared/restored-map-demo';\nexport function initDemo(canvas:HTMLCanvasElement,ctrl:HTMLElement){return restoredMapDemo(canvas,ctrl,'${name}');}\n`;
 }
 return result;
}
