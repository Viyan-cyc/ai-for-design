<script setup lang="ts">
import {onBeforeUnmount,ref} from 'vue';
import type {Bridge} from './Bridge';
const props=defineProps<{bridge:Bridge}>();
type MapState={geographicScatter?:{data?:unknown[];visible?:boolean;stopClusterZoom?:number;options?:Record<string,unknown>};runtime?:string;experience?:{parameters?:Record<string,number|string|boolean>};heat?:{data?:unknown[];gridVisible?:boolean;options?:Record<string,unknown>;tint?:{enabled?:boolean;strength?:number;brightness?:number}};logicalScatter?:{data?:unknown[];zoom?:number;visible?:boolean;options?:Record<string,unknown>}};
const read=()=>props.bridge.handle.serialize().map as MapState;
const state=ref(read()),error=ref(''),json=ref('');
const off=props.bridge.onState(()=>{state.value=read();});onBeforeUnmount(off);
function apply(change:(next:MapState)=>void,label:string,live=false){try{const next=structuredClone(read());change(next);props.bridge.handle.validateUpdate?.({map:next});const run=()=>props.bridge.handle.update({map:next});if(live)props.bridge.commitLive(label,run);else props.bridge.commit(label,run);error.value='';}catch(e){error.value=String(e);}}
const number=(e:Event)=>Number((e.target as HTMLInputElement).value);
const checked=(e:Event)=>(e.target as HTMLInputElement).checked;
function heat(key:string,value:unknown){apply(n=>{n.heat!.options={...n.heat!.options,[key]:value};},'热力参数',true);}
function tint(key:'brightness'|'strength',value:number){apply(n=>{n.heat!.tint={...n.heat!.tint,[key]:value};},'建筑染色参数',true);}
function loadJSON(){apply(n=>{const input=JSON.parse(json.value);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['experience','heat','logicalScatter','geographicScatter'].includes(k)))throw Error('只接受experience、heat、logicalScatter、geographicScatter配置');for(const key of ['experience','heat','logicalScatter','geographicScatter'] as const){if(Object.prototype.hasOwnProperty.call(input,key))n[key]=input[key];}},'导入地图组件配置');}
</script>
<template>
 <section v-if="state.runtime==='experience'||state.heat||state.logicalScatter||state.geographicScatter" class="map-components-panel" aria-label="地图组件参数">
  <h3>地图组件</h3>
  <template v-if="state.runtime==='experience'">
   <label>水域颜色 <input aria-label="地图水域颜色" type="color" :value="props.bridge.handle.mapParameters?.().water ?? '#CEE3FD'" @input="apply(n=>{n.experience={...n.experience,parameters:{...n.experience?.parameters,water:($event.target as HTMLInputElement).value}};},'地图颜色',true)"></label>
   <button class="ed-btn" @click="apply(n=>{n.experience={...n.experience,parameters:{}};},'恢复地图主题默认')">恢复地图主题默认</button>
  </template>
  <template v-if="state.heat">
   <label><input aria-label="显示栅格" type="checkbox" :checked="state.heat.gridVisible!==false" @change="apply(n=>{n.heat!.gridVisible=checked($event);},'栅格显示')">显示栅格</label>
   <label>显示阈值 {{Number(state.heat.options?.threshold ?? .17).toFixed(2)}}<input aria-label="热力显示阈值" type="range" min="0" max="1" step="0.01" :value="state.heat.options?.threshold ?? .17" @input="heat('threshold',number($event))" @change="props.bridge.endLiveEdit()"></label>
   <label>颜色虚化 {{Number(state.heat.options?.colorBlur ?? 2.63).toFixed(2)}}<input aria-label="热力颜色虚化" type="range" min="0" max="10" step="0.01" :value="state.heat.options?.colorBlur ?? 2.63" @input="heat('colorBlur',number($event))" @change="props.bridge.endLiveEdit()"></label>
   <template v-if="state.heat.tint">
    <label><input aria-label="建筑染色" type="checkbox" :checked="state.heat.tint.enabled!==false" @change="apply(n=>{n.heat!.tint!.enabled=checked($event);},'建筑染色开关')">建筑染色</label>
    <label>建筑明度 {{Number(state.heat.tint.brightness ?? 1.5).toFixed(2)}}<input aria-label="建筑明度" type="range" min="0" max="2" step="0.01" :value="state.heat.tint.brightness ?? 1.5" @input="tint('brightness',number($event))" @change="props.bridge.endLiveEdit()"></label>
   </template>
   <button class="ed-btn" @click="apply(n=>{n.heat!.data=[];},'清空热力数据')">清空热力数据</button>
   <button class="ed-btn" @click="apply(n=>{n.heat={...n.heat,options:{...(n.heat!.options?.origin?{origin:n.heat!.options.origin}:{})},gridVisible:true,...(n.heat!.tint?{tint:{}}:{})};},'恢复热力参数')">恢复热力参数</button>
  </template>
  <template v-if="state.logicalScatter">
   <label><input aria-label="逻辑散点显示" type="checkbox" :checked="state.logicalScatter.visible!==false" @change="apply(n=>{n.logicalScatter!.visible=checked($event);},'逻辑散点显示')">逻辑散点（非地理图层）</label>
   <label>点半径 {{Number(state.logicalScatter.options?.pointRadius ?? 3.4).toFixed(2)}} px<input aria-label="散点半径" type="range" min="2" max="8" step="0.2" :value="state.logicalScatter.options?.pointRadius ?? 3.4" @input="apply(n=>{n.logicalScatter!.options={...n.logicalScatter!.options,pointRadius:number($event)};},'散点半径',true)" @change="props.bridge.endLiveEdit()"></label>
   <button class="ed-btn" @click="apply(n=>{n.logicalScatter={...n.logicalScatter,options:{},zoom:.12,visible:true};},'恢复散点参数')">恢复散点参数</button>
  </template>
  <template v-if="state.geographicScatter">
   <label><input aria-label="地图散点显示" type="checkbox" :checked="state.geographicScatter.visible!==false" @change="apply(n=>{n.geographicScatter!.visible=checked($event);},'地图散点显示')">地图散点</label>
   <label>点半径 {{Number(state.geographicScatter.options?.pointRadius ?? 3.4).toFixed(2)}} px<input aria-label="地图散点半径" type="range" min="2" max="8" step="0.2" :value="state.geographicScatter.options?.pointRadius ?? 3.4" @input="apply(n=>{n.geographicScatter!.options={...n.geographicScatter!.options,pointRadius:number($event)};},'地图散点半径',true)" @change="props.bridge.endLiveEdit()"></label>
   <label>聚合网格 {{Number(state.geographicScatter.options?.clusterDistance ?? 28).toFixed(0)}} px<input aria-label="地图散点聚合距离" type="range" min="12" max="60" step="1" :value="state.geographicScatter.options?.clusterDistance ?? 28" @input="apply(n=>{n.geographicScatter!.options={...n.geographicScatter!.options,clusterDistance:number($event)};},'地图散点聚合',true)" @change="props.bridge.endLiveEdit()"></label>
   <button class="ed-btn" @click="apply(n=>{n.geographicScatter={...n.geographicScatter,options:{},stopClusterZoom:17,visible:true};},'恢复地图散点参数')">恢复地图散点参数</button>
  </template>
  <details><summary>完整参数与业务数据</summary><button class="ed-btn" @click="json=JSON.stringify({experience:state.experience,heat:state.heat,logicalScatter:state.logicalScatter,geographicScatter:state.geographicScatter},null,2)">读取当前配置</button><textarea v-model="json" aria-label="地图组件JSON" spellcheck="false"/><button class="ed-btn" @click="loadJSON">校验并应用</button></details>
  <p v-if="error" role="alert">{{error}}</p>
 </section>
</template>
<style scoped>
.map-components-panel{padding:12px;border-bottom:1px solid var(--ed-border);font:12px/1.6 sans-serif}.map-components-panel label{display:block;margin:8px 0}.map-components-panel input[type=range]{display:block;width:100%}.map-components-panel textarea{width:100%;min-height:160px;background:var(--ed-panel);color:inherit}.map-components-panel p{color:#c43c32}.map-components-panel button{margin:3px}
</style>
