<script setup>
import { reactive, ref } from 'vue'
import {
  SweetCard,
  SweetForm,
  SweetFormItem,
  SweetInput,
  SweetSelect,
  SweetOption,
  SweetButton,
  SweetTable,
  SweetTableColumn,
  SweetTag,
  SweetPagination,
  SweetDialog,
} from '@hw-seq/sweet-ui-base'

defineOptions({ name: 'TablePage' })

const searchForm = reactive({ username: '', status: '' })
const loading = ref(false)
const tableData = ref([])
const selectedRows = ref([])
const pagination = reactive({ page: 1, size: 10, total: 0 })

const dialogVisible = ref(false)
const dialogTitle = ref('新增')
const editForm = reactive({ id: '', username: '', email: '' })

const handleSearch = () => {
  pagination.page = 1
  fetchData()
}

const handleReset = () => {
  searchForm.username = ''
  searchForm.status = ''
  handleSearch()
}

const fetchData = async () => {
  loading.value = true
  setTimeout(() => {
    tableData.value = []
    pagination.total = 0
    loading.value = false
  }, 500)
}

const handleSizeChange = (size) => {
  pagination.size = size
  fetchData()
}

const handleCurrentChange = (page) => {
  pagination.page = page
  fetchData()
}

const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

const handleAdd = () => {
  dialogTitle.value = '新增'
  Object.assign(editForm, { id: '', username: '', email: '' })
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑'
  Object.assign(editForm, row)
  dialogVisible.value = true
}

const handleBatchDelete = () => {
  if (!selectedRows.value.length) return
}

const handleConfirm = () => {
  dialogVisible.value = false
  fetchData()
}

fetchData()
</script>

<template>
  <div class="table-page">
    <sweet-card class="search-card">
      <sweet-form :model="searchForm" inline>
        <sweet-form-item label="用户名">
          <sweet-input
            v-model="searchForm.username"
            placeholder="请输入用户名"
            clearable
          />
        </sweet-form-item>
        <sweet-form-item label="状态">
          <sweet-select
            v-model="searchForm.status"
            placeholder="请选择状态"
            clearable
          >
            <sweet-option label="启用" value="enabled" />
            <sweet-option label="禁用" value="disabled" />
          </sweet-select>
        </sweet-form-item>
        <sweet-form-item>
          <sweet-button type="primary" @click="handleSearch">查询</sweet-button>
          <sweet-button @click="handleReset">重置</sweet-button>
        </sweet-form-item>
      </sweet-form>
    </sweet-card>

    <sweet-card>
      <div class="table-toolbar">
        <sweet-button type="primary" @click="handleAdd">新增</sweet-button>
        <sweet-button
          type="danger"
          :disabled="!selectedRows.length"
          @click="handleBatchDelete"
        >
          批量删除
        </sweet-button>
      </div>

      <sweet-table
        v-model:selection="selectedRows"
        :data="tableData"
        :loading="loading"
        stripe
        border
        @selection-change="handleSelectionChange"
      >
        <sweet-table-column type="selection" width="55" />
        <sweet-table-column prop="id" label="ID" width="80" />
        <sweet-table-column prop="username" label="用户名" min-width="120" />
        <sweet-table-column prop="email" label="邮箱" min-width="180" />
        <sweet-table-column prop="status" label="状态" width="80">
          <template #default="{ row }">
            <sweet-tag :type="row.status === 'enabled' ? 'success' : 'info'">
              {{ row.status === 'enabled' ? '启用' : '禁用' }}
            </sweet-tag>
          </template>
        </sweet-table-column>
        <sweet-table-column prop="createTime" label="创建时间" width="180" />
        <sweet-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <sweet-button type="primary" link @click="handleEdit(row)">编辑</sweet-button>
            <sweet-button type="danger" link @click="handleEdit(row)">删除</sweet-button>
          </template>
        </sweet-table-column>
        <template #empty>
          <div class="table-empty">暂无数据</div>
        </template>
      </sweet-table>

      <div class="pagination-wrapper">
        <sweet-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </sweet-card>

    <sweet-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      draggable
      :close-on-click-modal="false"
    >
      <sweet-form :model="editForm" label-width="80px">
        <sweet-form-item label="用户名">
          <sweet-input v-model="editForm.username" />
        </sweet-form-item>
        <sweet-form-item label="邮箱">
          <sweet-input v-model="editForm.email" />
        </sweet-form-item>
      </sweet-form>
      <template #footer>
        <sweet-button @click="dialogVisible = false">取消</sweet-button>
        <sweet-button type="primary" @click="handleConfirm">确定</sweet-button>
      </template>
    </sweet-dialog>
  </div>
</template>

<style scoped lang="less">
.table-page {
  padding: var(--space-size-16);
  background: var(--color-bg-1);
  min-height: 100%;
}

.search-card {
  margin-bottom: var(--space-size-16);
}

.table-toolbar {
  display: flex;
  gap: var(--space-size-8);
  margin-bottom: var(--space-size-16);
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-size-16);
}

.table-empty {
  padding: var(--space-size-32) 0;
  color: var(--color-text-secondary);
}
</style>
