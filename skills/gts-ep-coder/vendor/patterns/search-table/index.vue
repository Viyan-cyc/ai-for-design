<script setup>
import { ref, onMounted } from 'vue'
import { ElButton, ElInput, ElPagination, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { getDevices } from '../../api/devices.js'

const keyword = ref('')
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

const fetchList = async () => {
  loading.value = true
  try {
    const res = await getDevices({ keyword: keyword.value, page: page.value, pageSize: pageSize.value })
    list.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

const onSearch = () => {
  page.value = 1
  fetchList()
}

const statusText = (status) => (status === 'enabled' ? '已启用' : '已停用')

onMounted(fetchList)
</script>

<template>
  <div class="page-root">
    <div class="page-header">
      <span class="page-title">设备管理</span>
    </div>

    <div class="search-bar">
      <ElInput
        v-model="keyword"
        placeholder="输入名称搜索"
        class="search-input"
        clearable
        @keyup.enter="onSearch"
      />
      <ElButton type="primary" :icon="Search" @click="onSearch">查询</ElButton>
    </div>

    <ElTable v-loading="loading" :data="list" class="table">
      <ElTableColumn prop="name" label="名称" min-width="180" />
      <ElTableColumn prop="status" label="状态" width="120">
        <template #default="{ row }">
          <ElTag :type="row.status === 'enabled' ? 'success' : 'info'">{{ statusText(row.status) }}</ElTag>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="updatedAt" label="更新时间" width="180" />
    </ElTable>

    <ElPagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      class="pagination"
      @current-change="fetchList"
    />
  </div>
</template>

<style scoped lang="less">
.page-root {
  min-height: 100%;
  padding: var(--space-size-24);
}

.page-header {
  margin-bottom: var(--space-size-16);

  .page-title {
    font-size: var(--font-size-normal1);
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
  }
}

.search-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-size-12);
  margin-bottom: var(--space-size-16);

  .search-input {
    width: 240px;
    max-width: 100%;
  }
}

.table {
  width: 100%;
}

.pagination {
  margin-top: var(--space-size-16);
  justify-content: flex-end;
}
</style>
