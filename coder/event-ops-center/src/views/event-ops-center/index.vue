<script setup>
// EventOpsCenter — 页面主组件（交付入口；真实工程中由路由挂载）
import { ref, onMounted } from 'vue'
import { Monitor } from '@element-plus/icons-vue'
import { fetchList } from '../../api/event-ops-center.js'
import { t } from '../../locales/pages/event-ops-center.js'
import { STATUS_MAP } from './js/constants.js'

const loading = ref(false)
const dataList = ref([])
const total = ref(0)

async function fetchData() {
  loading.value = true
  try {
    const res = await fetchList()
    dataList.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="page-root">
    <el-card shadow="never">
      <template #header>
        <div class="header">
          <span class="title">{{ t.title }}</span>
          <el-button type="primary" :icon="Monitor" @click="fetchData">{{ t.refresh }}</el-button>
        </div>
      </template>
      <el-table :data="dataList" v-loading="loading">
        <el-table-column type="index" label="序号" width="60px" />
        <el-table-column prop="name" label="名称" min-width="140px" />
        <el-table-column label="状态" width="100px">
          <template #default="{ row }">
            <el-tag :type="STATUS_MAP[row.status]?.type || 'info'">
              {{ STATUS_MAP[row.status]?.label || row.status }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style lang="less" scoped>
.page-root {
  min-height: 100%;
  padding: 24px;

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    font-size: 16px;
    font-weight: 700;
    color: var(--color-text-primary);
  }
}
</style>
