<script setup>
// AlarmInsight — 告警洞察看板（free 模式：未命中资产库组件，全部手写）
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { fetchTrend, fetchOpenAlarms, acknowledgeAlarm } from '../../api/alarm-insight.js'
import { t } from '../../locales/pages/alarm-insight.js'
import { COMPONENT_MODE, LEVEL_MAP } from './js/constants.js'

const trend = ref([])
const alarms = ref([])
const total = ref(0)
const loading = ref(true)
const maxTotal = computed(() => Math.max(...trend.value.map((d) => d.critical + d.warning + d.info), 1))

async function load() {
  loading.value = true
  try {
    const [tr, al] = await Promise.all([fetchTrend(), fetchOpenAlarms({})])
    trend.value = tr.list
    alarms.value = al.list
    total.value = al.total
  } finally {
    loading.value = false
  }
}

async function onAck(row) {
  await acknowledgeAlarm(row.id)
  ElMessage.success(t.ackOk)
  alarms.value = alarms.value.filter((a) => a.id !== row.id)
  total.value = alarms.value.length
}

onMounted(load)
</script>

<template>
  <div class="page-root" v-loading="loading">
    <header class="page-header">
      <div>
        <h1 class="page-title">{{ t.title }}</h1>
        <p class="page-subtitle">{{ t.subtitle }}</p>
      </div>
      <el-icon :size="28" class="header-icon"><Warning /></el-icon>
    </header>

    <el-card shadow="never" class="trend-card">
      <template #header>{{ t.trend }}</template>
      <div class="trend-chart">
        <div v-for="d in trend" :key="d.date" class="trend-col">
          <div class="trend-stack">
            <div class="seg seg-critical" :style="{ height: `${(d.critical / maxTotal) * 100}%` }" />
            <div class="seg seg-warning" :style="{ height: `${(d.warning / maxTotal) * 100}%` }" />
            <div class="seg seg-info" :style="{ height: `${(d.info / maxTotal) * 100}%` }" />
          </div>
          <span class="trend-date">{{ d.date }}</span>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="list-card">
      <template #header>{{ t.openList }}（{{ total }}）</template>
      <el-table :data="alarms">
        <el-table-column prop="id" label="ID" width="90px" />
        <el-table-column :label="t.level" width="100px">
          <template #default="{ row }">
            <el-tag :type="LEVEL_MAP[row.level]?.type || 'info'">
              {{ LEVEL_MAP[row.level]?.label || row.level }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="device" :label="t.device" min-width="180px" />
        <el-table-column prop="message" label="" min-width="200px" />
        <el-table-column prop="time" :label="t.time" width="150px" />
        <el-table-column :label="t.ack" width="90px" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="onAck(row)">{{ t.ack }}</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="t.openList" />
        </template>
      </el-table>
    </el-card>
  </div>
</template>

<style lang="less" scoped>
.page-root {
  min-height: 100%;
  padding: 24px;
  background: var(--g-bg-page);
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

.header-icon {
  color: var(--color-warning);
}

.trend-card {
  margin-bottom: 16px;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  height: 180px;
  padding: 8px 4px 0;
}

.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  height: 100%;
}

.trend-stack {
  display: flex;
  flex-direction: column-reverse;
  justify-content: flex-start;
  width: 36px;
  flex: 1;
}

.seg {
  width: 100%;
}

.seg-critical {
  background: var(--color-error);
}

.seg-warning {
  background: var(--color-warning);
}

.seg-info {
  background: var(--color-info);
}

.trend-date {
  font-size: 12px;
  color: var(--g-text-secondary);
}

.list-card {
  border-radius: var(--g-control-radius);
}
</style>
