<script setup>
// IconIndep — 页面主组件（交付入口；真实工程中由路由挂载）
// 文案默认直接写中文。用户要求国际化时才 key 化（按需能力，参考实现由生成方提供）。
import { ref, onMounted } from 'vue'
import { ElButton, ElInput, ElPagination, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { Search, Plus, Edit, Delete, Download } from "../../assets/icons/index.js"
import { getDeviceList } from '../../api/demo.js'

const keyword = ref('')
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const loading = ref(false)

// 数据一律经服务层（src/api/）获取，页面不直接接触 mock 数据文件
const fetchList = async () => {
  loading.value = true
  try {
    const res = await getDeviceList({ keyword: keyword.value, page: page.value, pageSize: pageSize.value })
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
      <span class="page-title">演示工作台</span>
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
      <ElButton :icon="Plus">新增</ElButton>
      <ElButton :icon="Edit">编辑</ElButton>
      <ElButton :icon="Delete">删除</ElButton>
      <ElButton :icon="Download">导出</ElButton>
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
