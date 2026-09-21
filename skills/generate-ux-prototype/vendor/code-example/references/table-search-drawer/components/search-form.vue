<script setup>
import { reactive, ref } from 'vue'
import { ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElDatePicker, ElButton } from 'element-plus'

defineOptions({ name: 'SearchForm' })

defineProps({
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['search', 'reset'])

const formRef = ref()
const formData = reactive({
  keyword: '',
  type: '',
  dateRange: []
})

const typeOptions = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'task', label: 'Task' }
]

const handleSearch = () => {
  emit('search', { ...formData })
}

const handleReset = () => {
  formRef.value?.resetFields()
  emit('reset')
}
</script>

<template>
  <ElForm ref="formRef" :model="formData" inline class="search-form">
    <ElFormItem label="关键词">
      <ElInput v-model="formData.keyword" placeholder="请输入关键词" clearable class="input-keyword" />
    </ElFormItem>

    <ElFormItem label="类型">
      <ElSelect v-model="formData.type" placeholder="请选择" clearable class="input-type">
        <ElOption
          v-for="item in typeOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>

    <ElFormItem label="日期范围">
      <ElDatePicker
        v-model="formData.dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        class="input-date"
      />
    </ElFormItem>

    <ElFormItem>
      <ElButton type="primary" :loading="loading" @click="handleSearch">搜索</ElButton>
      <ElButton @click="handleReset">重置</ElButton>
    </ElFormItem>
  </ElForm>
</template>

<style scoped lang="less">
.search-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-size-8);
}

.input-keyword {
  width: 200px;
}

.input-type {
  width: 160px;
}

.input-date {
  width: 260px;
}
</style>
