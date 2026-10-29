// Initial layout recipe, metres. Re-running overwrites the initial scene; preserve edits separately.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const path=fileURLToPath(new URL('../public/scene3d/scene-data.json',import.meta.url));
const data=JSON.parse(readFileSync(path,'utf8'));
const nodes=[];
function add(id,kind,x,z,params={},rotation=0){nodes.push({id,position:[x,0,z],rotation:[0,rotation,0],scale:1,params:{kind,...params}});}
add('campus_foundation','site',0,0);
for(const z of [-70,70])add(`boulevard_${z<0?'north':'south'}`,'road',0,z,{w:300,d:12});
for(const x of [-75,75])add(`avenue_${x<0?'west':'east'}`,'road',x,0,{w:12,d:242});
add('main_entry_avenue','road',0,103,{w:16,d:54});
add('central_north_access','road',0,-48,{w:10,d:32});
for(const x of [-75,0,75])add(`south_crosswalk_${x+75}`,'crossing',x,63);
for(const x of [-75,75])add(`north_crosswalk_${x+75}`,'crossing',x,-63);

// Central landmark: staggered towers and low exhibition wing, rather than equal boxes.
add('headquarters_east_tower','landmark',23,-8,{w:27,d:27,h:48});
add('headquarters_west_tower','landmark',-17,-18,{w:25,d:25,h:34});
add('exhibition_pavilion','office',-24,23,{w:43,d:20,h:9});
add('innovation_forum','research',28,29,{w:27,d:18,h:13});
add('arrival_reflecting_pool','pool',-25,47,{w:27,d:6});
add('central_garden','lawn',25,49,{w:25,d:8});
add('north_court','lawn',34,-48,{w:44,d:12});
add('west_court','lawn',-40,-44,{w:28,d:16});

// West: research courtyard. East: applied research and compact utility campus.
add('research_west_01','research',-116,-33,{w:38,d:22,h:21});
add('research_west_02','research',-130,13,{w:19,d:35,h:17});
add('research_west_03','research',-103,39,{w:35,d:17,h:12});
add('research_courtyard','lawn',-104,5,{w:21,d:22});
add('research_east_01','research',110,-32,{w:47,d:22,h:24});
add('research_east_02','research',119,18,{w:31,d:26,h:16});
add('east_garden','lawn',113,47,{w:48,d:10});

// North: production and warehouse halls with separate loading aprons.
add('production_hall_a','hall',-119,-104,{w:49,d:32,h:11});
add('production_hall_b','hall',-35,-105,{w:53,d:30,h:13});
add('warehouse_a','warehouse',35,-105,{w:48,d:30,h:10});
add('warehouse_b','warehouse',116,-104,{w:46,d:32,h:10});
for(const [i,x] of [20,35,49,105,119,133].entries())add(`loading_truck_${i}`,'truck',x,-82,{paint:'white'});

// Front: visitor parking / energy compound / entrance.
add('visitor_parking','parking',-113,100,{w:65,d:36});
add('staff_parking','parking',44,103,{w:40,d:31});
add('energy_transformers','energy',113,91,{w:29,d:19});
add('energy_service_building','hall',132,116,{w:28,d:13,h:6});
add('security_gatehouse','gate',-15,118);
add('front_garden_left','lawn',-38,105,{w:32,d:25});
add('energy_lawn','lawn',110,113,{w:8,d:17});
for(let i=0;i<17;i++){
  const x=-142+(i%11)*5.5,z=i<11?85:115;
  add(`visitor_car_${i}`,'car',x,z,{paint:['white','blue','silver','dark','red'][i%5]},i<11?0:Math.PI);
}
for(let i=0;i<8;i++)add(`staff_car_${i}`,'car',27+i*4.4,92,{paint:i%3===0?'blue':'white'});
add('avenue_car_01','car',-72,32,{paint:'blue'});
add('avenue_car_02','car',78,-38,{paint:'silver'},Math.PI);
add('boulevard_car_03','car',43,73,{paint:'white'},Math.PI/2);
add('entry_car_04','car',4,98,{paint:'dark'},Math.PI);

// Trees frame streets and courtyards; none cover tower entrances or road intersections.
let t=0;
for(const x of [-63,63])for(const z of [-51,-34,-16,2,20,38,52])add(`avenue_tree_${t++}`,'tree',x,z,{size:0.9+(t%3)*0.1});
for(const z of [-124,124])for(let x=-143;x<=145;x+=18){if(z>0&&Math.abs(x)<24)continue;add(`boundary_tree_${t++}`,'tree',x,z,{size:0.85});}
for(const [x,z] of [[-52,48],[-52,34],[-52,16],[51,48],[51,34],[-113,0],[-113,12],[-96,-1],[-96,12],[97,48],[114,48],[131,48],[-48,96],[-31,96],[-48,113],[-31,113]])add(`garden_tree_${t++}`,'tree',x,z,{size:0.9});
for(const [i,x] of [-39,-30,-21,-12].entries())add(`plaza_bench_${i}`,'bench',x,55);
for(const [i,z] of [-45,-10,25,50].entries())for(const x of [-84,84])add(`street_lamp_${i}_${x<0?'west':'east'}`,'lamp',x,z);

data.meta={name:'现代科技园区',description:'约 320 × 258 米的示意科技园区；独立建筑、车辆、景观节点均可编辑。检索服务不可达，本次采用几何组合。'};
data.scene={background:'#f6f7f9',environment:{intensity:0.35},fog:null};
data.camera={type:'PerspectiveCamera',position:[225,235,280],lookAt:[0,7,0],fov:36,near:0.5,far:1800};
data.controls={type:'OrbitControls',target:[0,7,0],minDistance:25,maxDistance:780,minPolarAngle:0.08,maxPolarAngle:1.48,enablePan:true,enableDamping:true,dampingFactor:0.07};
data.lights=[{id:'daylight',type:'DirectionalLight',color:'#ffffff',intensity:2.2,position:[-140,230,110],target:[0,0,0],castShadow:true,shadowMapSize:1024,shadowBias:-0.0003,shadowCameraNear:1,shadowCameraFar:650,shadowCameraLeft:-210,shadowCameraRight:210,shadowCameraTop:190,shadowCameraBottom:-190},
{id:'sky_fill',type:'HemisphereLight',color:'#f4f7fa',groundColor:'#c3cbd2',intensity:0.55},
{id:'east_fill',type:'DirectionalLight',color:'#ffffff',intensity:0.15,position:[140,90,-110],target:[0,0,0],castShadow:false}];
data.renderer={toneMapping:'Neutral',exposure:1,shadowMap:'PCF',shadowMapEnabled:true,pixelRatio:1.25,shadowMapSize:1024,antialias:false,logarithmicDepthBuffer:false,maxFps:60,renderMode:'demand'};
data.campus=nodes;
writeFileSync(path,JSON.stringify(data,null,2));
console.log(`Campus layout: ${nodes.length} independently editable nodes`);
