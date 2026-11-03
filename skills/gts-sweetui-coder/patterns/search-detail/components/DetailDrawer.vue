<script setup>
import { SweetDrawer, SweetTag, SweetDescriptions, SweetDescriptionsItem, SweetDivider } from '@hw-seq/sweet-ui-base'
defineProps({ modelValue: { type: Boolean, default: false }, data: { type: Object, default: null } })
const emit = defineEmits(['update:modelValue'])
const statusMap = { running: { type: 'success', label: '运行中' }, warning: { type: 'warning', label: '告警' }, error: { type: 'danger', label: '错误' }, idle: { type: 'info', label: '空闲' } }
const getStatus = (s) => statusMap[s] || { type: 'info', label: s }
const typeMap = { bug: 'danger', feature: '', task: 'info' }
</script>
<template>
 <SweetDrawer :model-value="modelValue" title="任务详情" size="480px" @update:model-value="(val) => emit('update:modelValue', val)">
  <template v-if="data">
   <SweetDescriptions :column="1" border>
    <SweetDescriptionsItem label="ID">{{ data.id }}</SweetDescriptionsItem>
    <SweetDescriptionsItem label="名称">{{ data.name }}</SweetDescriptionsItem>
    <SweetDescriptionsItem label="类型"><SweetTag :type="typeMap[data.type]" size="small">{{ data.type }}</SweetTag></SweetDescriptionsItem>
    <SweetDescriptionsItem label="状态"><SweetTag :type="getStatus(data.status).type" size="small">{{ getStatus(data.status).label }}</SweetTag></SweetDescriptionsItem>
    <SweetDescriptionsItem label="区域">{{ data.region }}</SweetDescriptionsItem>
    <SweetDescriptionsItem label="日期">{{ data.date }}</SweetDescriptionsItem>
    <SweetDescriptionsItem label="数值">{{ data.value }}</SweetDescriptionsItem>
    <SweetDescriptionsItem label="负责团队">{{ data.owner }}</SweetDescriptionsItem>
    <SweetDescriptionsItem label="更新时间">{{ data.updated }}</SweetDescriptionsItem>
   </SweetDescriptions>
   <SweetDivider />
   <div class="detail-extra"><slot name="extra" :data="data" /></div>
  </template>
 </SweetDrawer>
</template>
<style scoped>
.detail-extra { padding: var(--swt-space-size-8) 0; }
</style>
