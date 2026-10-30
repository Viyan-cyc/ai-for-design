<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElButton, ElRadioGroup, ElRadioButton, ElEmpty } from 'element-plus'
import * as echarts from 'echarts'
import { getCharts } from '../../api/charts.js'
import { createThemeState } from '../../theme/index.js'
const filter = ref('all'), count = ref(0), lineEl = ref(), parallelEl = ref()
const theme = createThemeState()
let line, parallel, resizeObserver, themeObserver, rows = [], sequence = 0, disposed = false
const colors = {a:'#2070F3',b:'#62B42E'}
function render() {
  if (!line || !parallel) return
  const style = getComputedStyle(lineEl.value)
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  const ink = dark ? style.getPropertyValue('--color-text-secondary').trim() : '#AEAEAE'
  const border = dark ? style.getPropertyValue('--color-border').trim() : '#E5E5E5'
  line.setOption({ animation:false, grid:{left:48,right:24,top:48,bottom:48},
    tooltip:{trigger:'axis'}, legend:{textStyle:{color:ink}},
    xAxis:{type:'category',data:['周一','周二','周三','周四'],axisLabel:{color:ink}},
    yAxis:{type:'value',name:'数量（件）',axisLabel:{color:ink},splitLine:{lineStyle:{color:border}}},
    series:rows.map(row=>({id:row.id,name:row.name,type:'line',data:row.values,itemStyle:{color:colors[row.id]}}))
  },{replaceMerge:['series']})
  parallel.setOption({animation:false,parallel:{left:60,right:60,top:48,bottom:32},
    parallelAxis:[{dim:0,name:'时长（分）'},{dim:1,name:'数量（件）'},{dim:2,name:'温度（℃）'}].map(axis=>({...axis,axisLabel:{color:ink},nameTextStyle:{color:ink},axisLine:{lineStyle:{color:border}}})),
    series:rows.map(row=>({id:row.id,name:row.name,type:'parallel',lineStyle:{color:colors[row.id],width:2},data:[row.metrics]}))
  },{replaceMerge:['series']})
}
async function load() { const current = ++sequence; const result = await getCharts(filter.value); if(disposed || current !== sequence)return; rows=result;count.value=rows.length;render() }
function reset() { filter.value='all'; load() }
function exportImage() { const link=document.createElement('a');link.href=line.getDataURL({type:'png',pixelRatio:2,backgroundColor:getComputedStyle(lineEl.value).getPropertyValue('--color-bg-2').trim()});link.download='trend.png';link.click() }
onMounted(()=>{
  line=echarts.init(lineEl.value);parallel=echarts.init(parallelEl.value)
  resizeObserver=new ResizeObserver(()=>{line.resize();parallel.resize()});resizeObserver.observe(lineEl.value);resizeObserver.observe(parallelEl.value)
  themeObserver=new MutationObserver(render);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})
  load()
})
onBeforeUnmount(()=>{disposed=true;++sequence;resizeObserver?.disconnect();themeObserver?.disconnect();line?.dispose();parallel?.dispose()})
</script>
<template>
<main class="page">
<h1>对象趋势与多指标比较</h1><p>集成验证用中性示例数据，不代表真实业务。</p>
<div class="controls"><ElRadioGroup v-model="filter" @change="load"><ElRadioButton value="all">全部</ElRadioButton><ElRadioButton value="a">对象 A</ElRadioButton><ElRadioButton value="none">空结果</ElRadioButton></ElRadioGroup><ElButton @click="reset">重置</ElButton><ElButton @click="theme.toggleTheme">切换主题</ElButton><ElButton @click="exportImage">导出图片</ElButton><span data-count>{{ count }} 个对象</span></div>
<ElEmpty v-if="count===0" description="没有匹配对象" />
<section><h2>数量趋势</h2><div ref="lineEl" class="chart" data-chart="line"></div></section>
<section><h2>多指标比较</h2><div ref="parallelEl" class="chart" data-chart="parallel"></div></section>
</main>
</template>
<style scoped lang="less">
.page { padding:var(--space-size-24);color:var(--color-text-primary);background:var(--color-bg-1); }
h1,h2 { font-size:var(--font-size-normal1); }
p { color:var(--color-text-secondary); }
.controls { display:flex;flex-wrap:wrap;gap:var(--space-size-16);align-items:center; }
section { margin-top:var(--space-size-24);padding:var(--space-size-16);background:var(--color-bg-2);border-radius:var(--radius-size-normal); }
.chart { height:320px;width:100%;min-width:0; }
</style>
