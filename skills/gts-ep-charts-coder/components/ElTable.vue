<script setup>
import { ElTable, ElTableColumn, ElTag, ElEmpty } from 'element-plus'

defineOptions({ name: 'TableDemo' })

defineProps({ tableData: { type: Array, default: () => [] } })

const statusMap = {
  running: { type: 'success', label: '运行中' },
  warning: { type: 'warning', label: '告警' },
  error: { type: 'danger', label: '错误' }
}
</script>

<template>
  <ElTable :data="tableData" stripe class="demo-table">
    <ElTableColumn prop="id" label="ID" width="80" />
    <ElTableColumn prop="name" label="名称" min-width="160" show-overflow-tooltip />
    <ElTableColumn prop="status" label="状态" width="100">
      <template #default="{ row }">
        <ElTag :type="statusMap[row.status]?.type || 'info'" size="small">
          {{ statusMap[row.status]?.label || row.status }}
        </ElTag>
      </template>
    </ElTableColumn>
    <ElTableColumn prop="date" label="日期" width="140" />
    <ElTableColumn prop="value" label="数值" width="120" align="right" />

    <template #empty>
      <div class="table-empty">
        <ElEmpty description="暂无数据" />
      </div>
    </template>
  </ElTable>
</template>

<style scoped lang="less">
.demo-table {
  width: 100%;
}

.table-empty {
  padding: var(--space-size-16) 0;
}
</style>
