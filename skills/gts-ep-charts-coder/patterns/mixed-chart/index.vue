<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElCard, ElAlert, ElButton } from 'element-plus'
import VChart from 'vue-echarts'
import { getMetrics } from '../../api/metrics.js'
defineOptions({ name: 'MixedChartPage' })
const data = ref(null)
const loading = ref(false)
const error = ref('')
const themeRevision = ref(0)
let observer
let requestSeq = 0
const readToken = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const mixedOption = computed(() => {
  themeRevision.value
  if (!data.value) return {}
  return {
    color: ['--color-chart-1', '--color-chart-2', '--color-chart-3'].map(readToken),
    textStyle: { color: readToken('--color-text-primary') },
    tooltip: { trigger: 'axis' }, legend: { data: ['产量', '增长率'], textStyle: { color: readToken('--color-text-primary') } },
    grid: { left: 48, right: 48, top: 48, bottom: 28 },
    xAxis: { type: 'category', data: data.value.months },
    yAxis: [{ type: 'value', name: '产量' }, { type: 'value', name: '增长率(%)', axisLabel: { formatter: '{value}%' } }],
    series: [
      { name: '产量', type: 'bar', data: data.value.production },
      { name: '增长率', type: 'line', yAxisIndex: 1, smooth: true, data: data.value.growth },
    ],
  }
})
const load = async () => {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try { const result = await getMetrics(); if (seq === requestSeq) data.value = result }
  catch (e) { if (seq === requestSeq) error.value = e.message || '加载失败' }
  finally { if (seq === requestSeq) loading.value = false }
}
onMounted(() => {
  observer = new MutationObserver(() => { themeRevision.value++ })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  load()
})
onUnmounted(() => { requestSeq++; observer?.disconnect() })
</script>

<template>
  <div class="page-root">
    <ElCard shadow="never" class="chart-card">
      <template #header>
        <span class="card-title">产量与增长率</span>
      </template>
      <ElAlert v-if="error" :title="error" type="error" :closable="false"><ElButton @click="load">重试</ElButton></ElAlert>
      <VChart v-if="data" class="chart-canvas" :option="mixedOption" :loading="loading" autoresize />
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
