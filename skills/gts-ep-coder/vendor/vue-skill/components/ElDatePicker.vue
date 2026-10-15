<script setup>
import { ref } from 'vue'
import { ElDatePicker } from 'element-plus'

defineOptions({ name: 'DatePickerDemo' })

const date = ref('')
const dateRange = ref([])
</script>

<template>
  <div class="demo-block">
    <ElDatePicker v-model="date" type="date" placeholder="选择日期" class="demo-picker" />

    <ElDatePicker
      v-model="dateRange"
      type="daterange"
      range-separator="至"
      start-placeholder="开始日期"
      end-placeholder="结束日期"
      class="demo-range"
    />
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}

.demo-picker {
  width: 200px;
}

.demo-range {
  width: 280px;
}
</style>
