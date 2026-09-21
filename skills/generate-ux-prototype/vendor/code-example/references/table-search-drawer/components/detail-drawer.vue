<script setup>
import { ElDrawer, ElDescriptions, ElDescriptionsItem, ElTag, ElDivider } from 'element-plus'

defineOptions({ name: 'DetailDrawer' })

defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  data: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const statusMap = {
  running: { type: 'success', label: '运行中' },
  warning: { type: 'warning', label: '告警' },
  error: { type: 'danger', label: '错误' },
  idle: { type: 'info', label: '空闲' }
}

const getStatusConfig = (status) => {
  return statusMap[status] || { type: 'info', label: status }
}
</script>

<template>
  <ElDrawer
    :model-value="modelValue"
    title="详情"
    size="480px"
    @update:model-value="(val) => emit('update:modelValue', val)"
  >
    <template v-if="data">
      <ElDescriptions :column="1" border>
        <ElDescriptionsItem label="ID">{{ data.id }}</ElDescriptionsItem>
        <ElDescriptionsItem label="名称">{{ data.name }}</ElDescriptionsItem>
        <ElDescriptionsItem label="类型">{{ data.type }}</ElDescriptionsItem>
        <ElDescriptionsItem label="状态">
          <ElTag :type="getStatusConfig(data.status).type" size="small">
            {{ getStatusConfig(data.status).label }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="日期">{{ data.date }}</ElDescriptionsItem>
        <ElDescriptionsItem label="数值">{{ data.value }}</ElDescriptionsItem>
      </ElDescriptions>

      <ElDivider />

      <div class="detail-extra">
        <slot name="extra" :data="data" />
      </div>
    </template>
  </ElDrawer>
</template>

<style scoped lang="less">
.detail-extra {
  padding: var(--space-size-8) 0;
}
</style>
