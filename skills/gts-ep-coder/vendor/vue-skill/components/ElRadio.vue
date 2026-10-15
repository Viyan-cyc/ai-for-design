<script setup>
import { ref } from 'vue'
import { ElRadioGroup, ElRadio } from 'element-plus'

defineOptions({ name: 'RadioDemo' })

const selected = ref('daily')
</script>

<template>
  <div class="demo-block">
    <ElRadioGroup v-model="selected">
      <ElRadio value="daily">按日</ElRadio>
      <ElRadio value="weekly">按周</ElRadio>
      <ElRadio value="monthly">按月</ElRadio>
    </ElRadioGroup>

    <ElRadioGroup v-model="selected" disabled>
      <ElRadio value="daily">按日</ElRadio>
      <ElRadio value="weekly">按周</ElRadio>
    </ElRadioGroup>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}
</style>
