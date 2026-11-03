<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import { getChartData } from '../../api/charts.js'
import '../../assets/charts/test.css'
const host=ref(null)
let chart, observer, disposed=false
onMounted(async()=>{const data=await getChartData();if(disposed)return;chart=echarts.init(host.value);chart.setOption({tooltip:{trigger:'axis'},xAxis:{type:'category',data:data.categories},yAxis:{type:'value'},series:[{type:'bar',data:data.values,itemStyle:{color:getComputedStyle(host.value).getPropertyValue('--page-chart-series').trim()}}]});observer=new ResizeObserver(()=>chart.resize());observer.observe(host.value)})
onUnmounted(()=>{disposed=true;observer?.disconnect();chart?.dispose()})
</script>
<template><div ref="host" class="chart-test"></div></template>
<style scoped lang="less">.chart-test { width:100%; height:400px; }</style>