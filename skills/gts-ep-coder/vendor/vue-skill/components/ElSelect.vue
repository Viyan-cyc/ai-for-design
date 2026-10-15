<script setup>
import { ref } from 'vue'
import { ElSelect, ElOption } from 'element-plus'

defineOptions({ name: 'SelectDemo' })

const value = ref('')
const valueMultiple = ref([])

const options = [
  { value: 'sh', label: '上海' },
  { value: 'bj', label: '北京' },
  { value: 'sz', label: '深圳' },
  { value: 'gz', label: '广州' }
]
</script>

<template>
  <div class="demo-block">
    <ElSelect v-model="value" placeholder="请选择" clearable class="demo-select">
      <ElOption
        v-for="item in options"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </ElSelect>

    <ElSelect
      v-model="valueMultiple"
      multiple
      placeholder="请选择（多选）"
      class="demo-select"
    >
      <ElOption
        v-for="item in options"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </ElSelect>

    <ElSelect v-model="value" disabled placeholder="禁用状态" class="demo-select" />
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}

.demo-select {
  width: 240px;
}
</style>
