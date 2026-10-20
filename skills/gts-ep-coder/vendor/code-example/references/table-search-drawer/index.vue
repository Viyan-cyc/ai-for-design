<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElRow, ElCol, ElCard, ElAlert, ElButton } from 'element-plus'
import { getTaskList } from '../../api/tasks.js'
import SearchForm from './components/search-form.vue'
import DataTable from './components/data-table.vue'
import DetailDrawer from './components/detail-drawer.vue'

defineOptions({ name: 'TableSearchDrawerPage' })
const defaults = () => ({ keyword: '', type: '', dateRange: [] })
const searchParams = reactive(defaults())
const tableData = ref([])
const tableLoading = ref(false)
const tableTotal = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
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
  } catch (error) {
    if (seq === requestSeq) loadError.value = error.message || '加载失败'
  } finally {
    if (seq === requestSeq) tableLoading.value = false
  }
}
const handleSearch = params => {
  Object.assign(searchParams, defaults(), params)
  currentPage.value = 1
  fetchData()
}
const handleReset = () => handleSearch(defaults())
const handlePageChange = page => { currentPage.value = page; fetchData() }
const handleSizeChange = size => { pageSize.value = size; currentPage.value = 1; fetchData() }
const handleRowClick = row => { currentRow.value = row; drawerVisible.value = true }
onMounted(fetchData)
</script>

<template>
  <div class="page-root">
    <ElAlert v-if="loadError" :title="loadError" type="error" :closable="false">
      <ElButton @click="fetchData">重试</ElButton>
    </ElAlert>
    <ElRow :gutter="0">
      <ElCol :span="24">
        <ElCard shadow="never" class="search-card">
          <SearchForm
            :loading="tableLoading"
            @search="handleSearch"
            @reset="handleReset"
          />
        </ElCard>
      </ElCol>
    </ElRow>

    <ElRow :gutter="0">
      <ElCol :span="24">
        <ElCard shadow="never" class="table-card">
          <DataTable
            :data="tableData"
            :loading="tableLoading"
            :total="tableTotal"
            :current-page="currentPage"
            :page-size="pageSize"
            @row-click="handleRowClick"
            @page-change="handlePageChange"
            @size-change="handleSizeChange"
          />
        </ElCard>
      </ElCol>
    </ElRow>

    <DetailDrawer
      v-model="drawerVisible"
      :data="currentRow"
    />
  </div>
</template>

<style scoped lang="less">
.page-root {
  padding: var(--space-size-20);
  background: var(--color-bg-1);
  min-height: 100%;
}

.search-card {
  border-radius: var(--radius-size-medium);
  border: 1px solid var(--color-border-separator);
  background: var(--color-bg-5);
  margin-bottom: var(--space-size-16);
}

.table-card {
  border-radius: var(--radius-size-medium);
  border: 1px solid var(--color-border-separator);
  background: var(--color-bg-5);
}
</style>
