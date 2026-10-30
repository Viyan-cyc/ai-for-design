<script setup>
import { ref } from 'vue'
import { ElCheckboxGroup, ElCheckbox } from 'element-plus'

defineOptions({ name: 'CheckboxDemo' })

const checkedList = ref(['sh'])
const agree = ref(false)

const cityOptions = [
  { value: 'sh', label: '上海' },
  { value: 'bj', label: '北京' },
  { value: 'sz', label: '深圳' }
]
</script>

<template>
  <div class="demo-block">
    <ElCheckboxGroup v-model="checkedList">
      <ElCheckbox v-for="item in cityOptions" :key="item.value" :value="item.value">
        {{ item.label }}
      </ElCheckbox>
    </ElCheckboxGroup>

    <ElCheckbox v-model="agree">我已阅读并同意相关条款</ElCheckbox>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}
</style>
