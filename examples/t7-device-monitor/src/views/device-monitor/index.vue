<script setup>
// DeviceMonitor — 设备监控列表页（hybrid：GMetricCard/GStatusTag 复用，其余按规范手写）
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus } from '@element-plus/icons-vue'
import { fetchList, fetchSummary, createRecord, deleteRecord } from '../../api/device-monitor.js'
import { t } from '../../locales/pages/device-monitor.js'
import { COMPONENT_MODE, DEVICE_STATUS_MAP, REGION_OPTIONS } from './js/constants.js'
import GMetricCard from '../../components/GMetricCard/GMetricCard.vue'
import GStatusTag from '../../components/GStatusTag/GStatusTag.vue'

const loading = ref(false)
const dataList = ref([])
const total = ref(0)
const summary = ref(null)

const query = reactive({ keyword: '', page: 1, pageSize: 20 })

const metrics = computed(() => {
  if (!summary.value) return []
  return [
    { title: t.metricOnline, ...summary.value.online, surface: 'brand' },
    { title: t.metricAlarm, ...summary.value.alarm },
    { title: t.metricOffline, ...summary.value.offline },
    { title: t.metricCpu, ...summary.value.cpu },
  ]
})

async function loadSummary() {
  summary.value = await fetchSummary()
}

async function fetchData() {
  loading.value = true
  try {
    const res = await fetchList({ keyword: query.keyword, page: query.page, pageSize: query.pageSize })
    dataList.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function onSearch() {
  query.page = 1
  fetchData()
}

function onReset() {
  query.keyword = ''
  query.page = 1
  fetchData()
}

async function onCreate() {
  const res = await createRecord({ name: `新建设备-${Date.now() % 1000}`, region: 'east' })
  ElMessage.success(t.createOk)
  await fetchData()
  await loadSummary()
  return res
}

async function onDelete(row) {
  await ElMessageBox.confirm(t.confirmDelete, { type: 'warning' })
  await deleteRecord(row.id)
  ElMessage.success(t.deleteOk)
  await fetchData()
  await loadSummary()
}

function onPageChange(page) {
  query.page = page
  fetchData()
}

onMounted(() => {
  fetchData()
  loadSummary()
})
</script>

<template>
  <div class="page-root">
    <div class="frost-backdrop g-frost-backdrop" aria-hidden="true"></div>
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ t.title }}</h1>
        <p class="page-subtitle">{{ t.subtitle }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="fetchData">{{ t.refresh }}</el-button>
        <el-button type="primary" :icon="Plus" @click="onCreate">{{ t.create }}</el-button>
      </div>
    </header>

    <section v-if="metrics.length" class="metric-row">
      <GMetricCard
        v-for="m in metrics"
        :key="m.title"
        :title="m.title"
        :value="m.value"
        :delta="m.delta"
        :trend="m.trend"
        :data-surface="m.surface"
        :data-decoration="m.surface === 'brand' ? 'frosted' : undefined"
      />
    </section>

    <el-card shadow="never" class="list-card">
      <div class="filter-bar">
        <el-input
          v-model="query.keyword"
          :placeholder="t.searchPlaceholder"
          clearable
          class="search-input"
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <el-button type="primary" :icon="Search" @click="onSearch">{{ t.search }}</el-button>
        <el-button @click="onReset">{{ t.reset }}</el-button>
      </div>

      <el-table :data="dataList" v-loading="loading">
        <el-table-column prop="name" :label="t.name" min-width="180px" />
        <el-table-column :label="t.region" width="110px">
          <template #default="{ row }">
            {{ REGION_OPTIONS.find((r) => r.value === row.region)?.label || row.region }}
          </template>
        </el-table-column>
        <el-table-column :label="t.status" width="110px">
          <template #default="{ row }">
            <GStatusTag
              :status="DEVICE_STATUS_MAP[row.status]?.status || 'normal'"
              :label="DEVICE_STATUS_MAP[row.status]?.label || row.status"
            />
          </template>
        </el-table-column>
        <el-table-column :label="t.cpu" width="140px">
          <template #default="{ row }">
            <el-progress :percentage="row.cpu" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" :label="t.updated" width="150px" />
        <el-table-column :label="t.actions" width="120px" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="onCreate">{{ t.edit }}</el-button>
            <el-button link type="danger" @click="onDelete(row)">{{ t.remove }}</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t.emptyHint" />
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          layout="total, prev, pager, next, sizes"
          :total="total"
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :page-sizes="[10, 20, 50]"
          @current-change="onPageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style lang="less" scoped>
.page-root {
  position: relative;
  min-height: 100%;
  padding: 24px;
}

.frost-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.page-header,
.metric-row,
.list-card {
  position: relative;
  z-index: 1;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--g-text-primary);
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--g-text-secondary);
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--g-panel-gap);
  margin-bottom: 16px;
}

.list-card {
  border-radius: var(--g-control-radius);
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.search-input {
  width: 260px;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
