<script setup>
import { SweetDrawer } from '@hw-seq/sweet-ui-base'
defineProps({modelValue:Boolean,record:Object})
const emit=defineEmits(['update:modelValue'])
</script>
<template><SweetDrawer :model-value="modelValue" title="设备详情" size="40%" @update:model-value="emit('update:modelValue',$event)"><dl v-if="record"><dt>名称</dt><dd>{{ record.name }}</dd><dt>状态</dt><dd>{{ record.status === 'enabled' ? '已启用' : '已停用' }}</dd><dt>更新时间</dt><dd>{{ record.updatedAt }}</dd></dl></SweetDrawer></template>
<style scoped>dt { color:var(--swt-color-text-secondary); }dd { margin:var(--swt-space-size-8) 0 var(--swt-space-size-24); overflow-wrap:anywhere; }</style>
