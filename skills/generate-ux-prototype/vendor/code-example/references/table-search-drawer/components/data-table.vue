<script setup>
import { ElTable, ElTableColumn, ElPagination, ElTag } from 'element-plus'

defineOptions({ name: 'DataTable' })

defineProps({
  data: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  total: {
    type: Number,
    default: 0
  },
  currentPage: {
    type: Number,
    default: 1
  },
  pageSize: {
    type: Number,
    default: 20
  }
})

const emit = defineEmits(['row-click', 'page-change', 'size-change'])

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
  <div class="data-table-wrapper">
    <ElTable
      :data="data"
      v-loading="loading"
      stripe
      highlight-current-row
      class="data-table"
      @row-click="(row) => emit('row-click', row)"
    >
      <ElTableColumn prop="id" label="ID" width="80" />
      <ElTableColumn prop="name" label="名称" min-width="160" show-overflow-tooltip />
      <ElTableColumn prop="type" label="类型" width="120" />
      <ElTableColumn prop="status" label="状态" width="100">
        <template #default="{ row }">
          <ElTag :type="getStatusConfig(row.status).type" size="small">
            {{ getStatusConfig(row.status).label }}
          </ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="date" label="日期" width="140" />
      <ElTableColumn prop="value" label="数值" width="120" align="right" />
    </ElTable>

    <div class="table-pagination">
      <ElPagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        :page-sizes="[10, 20, 50, 100]"
        @current-change="(page) => emit('page-change', page)"
        @size-change="(size) => emit('size-change', size)"
      />
    </div>
  </div>
</template>

<style scoped lang="less">
.data-table-wrapper {
  width: 100%;
}

.data-table {
  width: 100%;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-size-16);
}
</style>
