<script setup>
import { ref } from 'vue'
import { ElCard } from 'element-plus'
import VChart from 'vue-echarts'

defineOptions({ name: 'MixedChartPage' })

const readToken = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

const chartColors = ['--color-chart-1', '--color-chart-2', '--color-chart-3']
  .map(readToken)
  .filter(Boolean)

const months = ['1月', '2月', '3月', '4月', '5月', '6月']

const mixedOption = ref({
  color: chartColors,
  tooltip: { trigger: 'axis' },
  legend: { data: ['产量', '增长率'] },
  grid: { left: 48, right: 48, top: 48, bottom: 28 },
  xAxis: { type: 'category', data: months },
  yAxis: [
    { type: 'value', name: '产量' },
    { type: 'value', name: '增长率(%)', axisLabel: { formatter: '{value}%' } }
  ],
  series: [
    { name: '产量', type: 'bar', data: [120, 200, 150, 80, 170, 110] },
    { name: '增长率', type: 'line', yAxisIndex: 1, smooth: true, data: [12, 20, 15, 8, 17, 11] }
  ]
})
</script>

<template>
  <div class="page-root">
    <ElCard shadow="never" class="chart-card">
      <template #header>
        <span class="card-title">产量与增长率</span>
      </template>
      <VChart class="chart-canvas" :option="mixedOption" autoresize />
    </ElCard>
  </div>
</template>

<style scoped lang="less">
.page-root {
  padding: var(--space-size-20);
  background: var(--color-bg-1);
  min-height: 100%;
}

.chart-card {
  border-radius: var(--radius-size-medium);
  border: 1px solid var(--color-border-separator);
  background: var(--color-bg-5);
}

.card-title {
  font-size: var(--font-size-normal);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.chart-canvas {
  width: 100%;
  height: 360px;
}
</style>
