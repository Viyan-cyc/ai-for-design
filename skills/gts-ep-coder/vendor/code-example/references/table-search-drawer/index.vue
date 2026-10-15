<script setup>
import { ref, reactive } from 'vue'
import { ElRow, ElCol, ElCard } from 'element-plus'
import SearchForm from './components/search-form.vue'
import DataTable from './components/data-table.vue'
import DetailDrawer from './components/detail-drawer.vue'

defineOptions({ name: 'TableSearchDrawerPage' })

const searchFormRef = ref()
const searchParams = reactive({
  keyword: '',
  type: '',
  dateRange: []
})

const tableData = ref([])
const tableLoading = ref(false)
const tableTotal = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const drawerVisible = ref(false)
const currentRow = ref(null)

const fetchData = async (params, page, size) => {
  tableLoading.value = true
  try {
    // await api.getTableData({ ...params, page, size })
    // tableData.value = res.data.list
    // tableTotal.value = res.data.total
    tableData.value = [
      { id: 1, name: '任务 A', type: 'Bug', status: 'running', date: '2026-09-01', value: 120 },
      { id: 2, name: '任务 B', type: 'Feature', status: 'warning', date: '2026-09-02', value: 80 },
      { id: 3, name: '任务 C', type: 'Task', status: 'idle', date: '2026-09-03', value: 66 }
    ]
    tableTotal.value = 3
  } finally {
    tableLoading.value = false
  }
}

const handleSearch = (params) => {
  Object.assign(searchParams, params)
  currentPage.value = 1
  fetchData(searchParams, currentPage.value, pageSize.value)
}

const handleReset = () => {
  currentPage.value = 1
  fetchData(searchParams, currentPage.value, pageSize.value)
}

const handlePageChange = (page) => {
  currentPage.value = page
  fetchData(searchParams, currentPage.value, pageSize.value)
}

const handleSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
  fetchData(searchParams, currentPage.value, pageSize.value)
}

const handleRowClick = (row) => {
  currentRow.value = row
  drawerVisible.value = true
}

fetchData(searchParams, currentPage.value, pageSize.value)
</script>

<template>
  <div class="page-root">
    <ElRow :gutter="0">
      <ElCol :span="24">
        <ElCard shadow="never" class="search-card">
          <SearchForm
            ref="searchFormRef"
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
