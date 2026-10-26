<script setup>
import { onMounted,onBeforeUnmount,ref } from 'vue'
import { DtChart } from '@hw-dtn/dt-ui'
import { SweetButton } from '@hw-seq/sweet-ui-base'
import { getMetrics } from '../../api/metrics.js'
import { nativeChartOptions } from '../../chart-tokens.js'
const options=ref({}),error=ref(''),loading=ref(false)
async function load(){
  loading.value=true;error.value=''
  try{
    const points=await getMetrics()
    options.value=nativeChartOptions({tooltip:{trigger:'axis'},xAxis:{type:'category',data:points.map(x=>x.label)},yAxis:{type:'value'},series:[{type:'line',data:points.map(x=>x.value)}]})
  }catch(e){error.value=e.message}
  finally{loading.value=false}
}
onMounted(()=>{load();window.addEventListener('gts-theme-change',load)})
onBeforeUnmount(()=>window.removeEventListener('gts-theme-change',load))
</script>
<template>
  <main class="page-root">
    <header><h1>业务趋势</h1><SweetButton :loading="loading" @click="load">刷新</SweetButton></header>
    <p v-if="error" role="alert">{{ error }}</p>
    <section class="chart-panel"><DtChart v-if="!error && Object.keys(options).length" :options="options" :show-theme="false" height="360px" /></section>
  </main>
</template>
<style scoped>
.page-root{padding:var(--swt-space-size-24)}
header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:var(--swt-space-size-16);margin-bottom:var(--swt-space-size-24)}
h1{margin:0;font-size:var(--swt-font-size-medium)}
.chart-panel{min-height:360px;background:var(--swt-color-bg-primary);border-radius:var(--swt-radius-size-normal);padding:var(--swt-space-size-16)}
</style>
