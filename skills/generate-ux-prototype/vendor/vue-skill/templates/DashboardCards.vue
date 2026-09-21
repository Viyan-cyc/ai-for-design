<script setup>
import { ElCard, ElRow, ElCol, ElSkeleton } from 'element-plus'

defineOptions({ name: 'DashboardCards' })

defineProps({
  metrics: {
    type: Array,
    default: () => []
  },
  chartRows: {
    type: Number,
    default: 2
  }
})
</script>

<template>
  <div class="dashboard-container">
    <div class="metrics-row">
      <ElCard
        v-for="(metric, index) in metrics"
        :key="index"
        shadow="hover"
        class="metric-card"
      >
        <div class="metric-content">
          <div class="metric-title">{{ metric.title }}</div>
          <div class="metric-value">
            {{ metric.value }}
            <span v-if="metric.unit" class="metric-unit">{{ metric.unit }}</span>
          </div>
          <div
            v-if="metric.trend"
            class="metric-trend"
            :class="{
              'trend-up': metric.trend === 'up',
              'trend-down': metric.trend === 'down',
              'trend-flat': metric.trend === 'flat'
            }"
          >
            {{ metric.trendValue }}
          </div>
        </div>
        <slot :name="`metric-${index}`" />
      </ElCard>

      <ElCard v-if="metrics.length === 0" shadow="hover" class="metric-card">
        <ElSkeleton :rows="2" animated />
      </ElCard>
    </div>

    <div class="chart-area">
      <ElRow v-for="row in chartRows" :key="row" :gutter="16" class="chart-row">
        <ElCol :span="12">
          <ElCard shadow="hover" class="chart-card">
            <slot :name="`chart-row${row}-left`" />
          </ElCard>
        </ElCol>
        <ElCol :span="12">
          <ElCard shadow="hover" class="chart-card">
            <slot :name="`chart-row${row}-right`" />
          </ElCard>
        </ElCol>
      </ElRow>
    </div>
  </div>
</template>

<style scoped lang="less">
.dashboard-container {
  padding: var(--space-size-20);
  background: var(--color-bg-1);
  min-height: 100%;
}

.metrics-row {
  display: flex;
  gap: var(--space-size-16);
  margin-bottom: var(--space-size-16);
}

.metric-card {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius-size-medium);
  border: 1px solid var(--color-border-separator);
  background: var(--color-bg-5);
}

.metric-content {
  padding: var(--space-size-4);
}

.metric-title {
  font-size: var(--font-size-small);
  line-height: var(--font-line-height-small);
  color: var(--color-text-secondary);
  margin-bottom: var(--space-size-4);
}

.metric-value {
  font-size: var(--font-size-big);
  line-height: var(--font-line-height-big);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.metric-unit {
  font-size: var(--font-size-normal);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-secondary);
  margin-left: 4px;
}

.metric-trend {
  font-size: var(--font-size-small);
  margin-top: var(--space-size-4);
}

.trend-up { color: var(--color-success); }
.trend-down { color: var(--color-error); }
.trend-flat { color: var(--color-text-secondary); }

.chart-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}

.chart-row {
  margin-bottom: 0;
}

.chart-card {
  border-radius: var(--radius-size-medium);
  border: 1px solid var(--color-border-separator);
  background: var(--color-bg-5);
  min-height: 300px;
}
</style>
