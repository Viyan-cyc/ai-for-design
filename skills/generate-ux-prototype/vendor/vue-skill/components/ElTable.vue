<script setup>
import { ref } from 'vue'
import { ElTable, ElTableColumn, ElTag, ElEmpty } from 'element-plus'

defineOptions({ name: 'TableDemo' })

const tableData = ref([
  { id: 1, name: '设备 A', status: 'running', date: '2026-09-01', value: 120 },
  { id: 2, name: '设备 B', status: 'warning', date: '2026-09-02', value: 80 },
  { id: 3, name: '设备 C', status: 'error', date: '2026-09-03', value: 0 }
])

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
