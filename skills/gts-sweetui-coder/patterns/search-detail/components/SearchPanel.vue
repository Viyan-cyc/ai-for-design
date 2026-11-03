<script setup>
import { SweetInput, SweetButton, SweetIcon, SweetSelect, SweetOption, SweetForm, SweetFormItem } from '@hw-seq/sweet-ui-base'
import { ref, reactive } from 'vue'
defineProps({ loading: Boolean })
const emit = defineEmits(['search', 'reset'])
const formRef = ref()
const formData = reactive({ keyword: '', type: '', status: '' })
const typeOptions = [{ value: 'bug', label: 'Bug' }, { value: 'feature', label: 'Feature' }, { value: 'task', label: 'Task' }]
const statusOptions = [{ value: 'running', label: '运行中' }, { value: 'warning', label: '告警' }, { value: 'error', label: '错误' }, { value: 'idle', label: '空闲' }]
function handleSearch() { emit('search', { ...formData }) }
function handleReset() { Object.assign(formData, { keyword: '', type: '', status: '' }); formRef.value?.clearValidate(); emit('reset') }
</script>
<template>
 <SweetForm ref="formRef" :model="formData" inline class="search-form">
  <SweetFormItem label="关键词"><SweetInput v-model="formData.keyword" placeholder="任务名称" clearable class="input-keyword" @keyup.enter="handleSearch" /></SweetFormItem>
  <SweetFormItem label="类型"><SweetSelect v-model="formData.type" placeholder="全部类型" clearable class="input-type"><SweetOption v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" /></SweetSelect></SweetFormItem>
  <SweetFormItem label="状态"><SweetSelect v-model="formData.status" placeholder="全部状态" clearable class="input-status"><SweetOption v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" /></SweetSelect></SweetFormItem>
  <SweetFormItem><SweetButton type="primary" :loading="loading" @click="handleSearch"><SweetIcon icon-class="sweetui-icon-search-l" />查询</SweetButton><SweetButton @click="handleReset">重置</SweetButton></SweetFormItem>
 </SweetForm>
</template>
<style scoped>
.search-form { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--swt-space-size-8); }
.input-keyword { width: 200px; max-width: 100%; }
.input-type { width: 140px; max-width: 100%; }
.input-status { width: 140px; max-width: 100%; }
</style>
