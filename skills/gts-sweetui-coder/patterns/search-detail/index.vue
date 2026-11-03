<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { SweetAlert, SweetButton } from '@hw-seq/sweet-ui-base'
import { getTaskList } from './api/tasks.js'
import SearchPanel from './components/SearchPanel.vue'
import DataTable from './components/DataTable.vue'
import DetailDrawer from './components/DetailDrawer.vue'
const defaults = () => ({ keyword: '', type: '', status: '' })
const searchParams = reactive(defaults())
const tableData = ref([])
const tableLoading = ref(false)
const tableTotal = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const drawerVisible = ref(false)
const currentRow = ref(null)
const loadError = ref('')
let requestSeq = 0
onUnmounted(() => { requestSeq++ })
const fetchData = async () => {
  const seq = ++requestSeq
  tableLoading.value = true
  loadError.value = ''
  try {
    const result = await getTaskList({ ...searchParams, page: currentPage.value, pageSize: pageSize.value })
    if (seq !== requestSeq) return
    tableData.value = result.list
    tableTotal.value = result.total
  } catch (e) {
    if (seq === requestSeq) loadError.value = e.message || '加载失败'
  } finally {
    if (seq === requestSeq) tableLoading.value = false
  }
}
const handleSearch = (params) => { Object.assign(searchParams, defaults(), params); currentPage.value = 1; fetchData() }
const handleReset = () => handleSearch(defaults())
const handlePageChange = (page) => { currentPage.value = page; fetchData() }
const handleSizeChange = (size) => { pageSize.value = size; currentPage.value = 1; fetchData() }
const handleRowClick = (row) => { currentRow.value = row; drawerVisible.value = true }
onMounted(fetchData)
</script>
<template>
 <div class="page-root">
   <header class="heading"><h1>任务管理</h1><p>查询任务运行状态与历史记录</p></header>
  <SweetAlert v-if="loadError" type="error" :title="loadError" :closable="false"><SweetButton @click="fetchData">重试</SweetButton></SweetAlert>
  <section class="card search-card"><SearchPanel :loading="tableLoading" @search="handleSearch" @reset="handleReset" /></section>
  <section class="card table-card"><DataTable :data="tableData" :loading="tableLoading" :total="tableTotal" :current-page="currentPage" :page-size="pageSize" @row-click="handleRowClick" @page-change="handlePageChange" @size-change="handleSizeChange" /></section>
  <DetailDrawer v-model="drawerVisible" :data="currentRow" />
 </div>
</template>
<style scoped>
.page-root { padding: var(--swt-space-size-24); background: var(--swt-color-bg-secondary); min-height: 100%; color: var(--swt-color-text-primary); }
.heading { display: flex; align-items: center; gap: var(--swt-space-size-12); margin-bottom: var(--swt-space-size-24); flex-wrap: wrap; }
.heading h1 { margin: 0; font-size: var(--swt-font-size-medium); line-height: var(--swt-font-line-height-medium); }
.heading p { color: var(--swt-color-text-secondary); margin: 0; flex: 1; }
.card { background: var(--swt-color-bg-primary); border-radius: var(--swt-radius-size-medium); border: 1px solid var(--swt-color-dividing-line-secondary); padding: var(--swt-space-size-24); }
.search-card { margin-bottom: var(--swt-space-size-16); }
</style>
