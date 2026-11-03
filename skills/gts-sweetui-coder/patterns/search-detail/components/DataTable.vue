<script setup>
import { SweetTable, SweetTableColumn, SweetPagination, SweetTag } from '@hw-seq/sweet-ui-base'
defineProps({ data: { type: Array, default: () => [] }, loading: { type: Boolean, default: false }, total: { type: Number, default: 0 }, currentPage: { type: Number, default: 1 }, pageSize: { type: Number, default: 10 } })
const emit = defineEmits(['row-click', 'page-change', 'size-change'])
const statusMap = { running: { type: 'success', label: '运行中' }, warning: { type: 'warning', label: '告警' }, error: { type: 'danger', label: '错误' }, idle: { type: 'info', label: '空闲' } }
const getStatus = (s) => statusMap[s] || { type: 'info', label: s }
const typeMap = { bug: 'danger', feature: '', task: 'info' }
</script>
<template>
 <div class="data-table-wrapper">
  <SweetTable :data="data" v-loading="loading" stripe highlight-current-row class="data-table" @row-click="(row) => emit('row-click', row)">
   <SweetTableColumn prop="id" label="ID" width="70" />
   <SweetTableColumn prop="name" label="名称" min-width="180" show-overflow-tooltip />
   <SweetTableColumn prop="type" label="类型" width="100"><template #default="{ row }"><SweetTag :type="typeMap[row.type]" size="small">{{ row.type }}</SweetTag></template></SweetTableColumn>
   <SweetTableColumn prop="status" label="状态" width="100"><template #default="{ row }"><SweetTag :type="getStatus(row.status).type" size="small">{{ getStatus(row.status).label }}</SweetTag></template></SweetTableColumn>
   <SweetTableColumn prop="region" label="区域" min-width="80" />
   <SweetTableColumn prop="date" label="日期" min-width="110" />
   <SweetTableColumn prop="value" label="数值" width="90" align="right" />
  </SweetTable>
  <div class="table-pagination"><SweetPagination :current-page="currentPage" :page-size="pageSize" :total="total" layout="total, sizes, prev, pager, next, jumper" :page-sizes="[10, 20, 50]" @current-change="(p) => emit('page-change', p)" @size-change="(s) => emit('size-change', s)" /></div>
 </div>
</template>
<style scoped>
.data-table-wrapper { width: 100%; }
.data-table { width: 100%; }
.table-pagination { display: flex; justify-content: flex-end; margin-top: var(--swt-space-size-16); }
</style>
