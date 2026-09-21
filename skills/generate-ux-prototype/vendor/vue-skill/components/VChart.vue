<script setup>
import { ref } from 'vue'
import VChart from 'vue-echarts'

defineOptions({ name: 'VChartDemo' })

const readToken = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const chartColors = ['--color-chart-1', '--color-chart-2', '--color-chart-3']
  .map(readToken)
  .filter(Boolean)

const barOption = ref({
  color: chartColors,
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 16, top: 32, bottom: 28 },
  xAxis: { type: 'category', data: ['一月', '二月', '三月', '四月'] },
  yAxis: { type: 'value' },
  series: [
    { name: '指标 A', type: 'bar', data: [120, 200, 150, 80] },
    { name: '指标 B', type: 'bar', data: [60, 90, 110, 130] }
  ]
})
</script>

<template>
  <div class="demo-block">
    <VChart class="demo-chart" :option="barOption" autoresize />
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
}

.demo-chart {
  width: 100%;
  height: 320px;
}
</style>
