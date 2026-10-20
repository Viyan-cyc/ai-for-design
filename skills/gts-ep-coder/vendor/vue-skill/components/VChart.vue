<script setup>
import VChart from 'vue-echarts'

defineOptions({ name: 'VChartDemo' })

defineProps({ barOption: { type: Object, required: true } })
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
