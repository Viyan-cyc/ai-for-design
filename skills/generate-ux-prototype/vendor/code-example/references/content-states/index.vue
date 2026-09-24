<script setup>
import { ref, computed } from 'vue'
import {
  ElSegmented,
  ElInput,
  ElButton,
  ElTable,
  ElTableColumn,
  ElTag,
  ElEmpty,
  ElResult,
  ElSkeleton,
  ElSkeletonItem,
} from 'element-plus'
import { Search, RefreshRight, Plus, Delete, Back } from '@element-plus/icons-vue'

defineOptions({ name: 'ContentStates' })

// 内容状态演示页：数据是展示物本身，写死在页面内（业务页面数据应走 src/api/ 服务层）。
const allRows = [
  { id: 1, name: '事件-华东区网关超时', level: 'P1', owner: '陈磊', status: '处理中' },
  { id: 2, name: '事件-华南区存储容量告警', level: 'P2', owner: '王倩', status: '已确认' },
  { id: 3, name: '事件-北区调度延迟', level: 'P3', owner: '刘洋', status: '处理中' },
  { id: 4, name: '事件-西区证书临期', level: 'P2', owner: '赵敏', status: '已恢复' },
  { id: 5, name: '事件-东区队列堆积', level: 'P1', owner: '孙浩', status: '处理中' },
  { id: 6, name: '事件-数据库主从延迟', level: 'P2', owner: '李婷', status: '已确认' },
  { id: 7, name: '事件-缓存命中率下降', level: 'P3', owner: '周斌', status: '已恢复' },
  { id: 8, name: '事件-限流策略误触发', level: 'P2', owner: '吴静', status: '已恢复' },
]

const STATES = [
  { label: '首次使用', value: 'idle' },
  { label: '加载中', value: 'loading' },
  { label: '有数据', value: 'success' },
  { label: '空结果', value: 'empty' },
  { label: '筛选无结果', value: 'filtered-empty' },
  { label: '无权限', value: 'no-permission' },
  { label: '加载失败', value: 'error' },
  { label: '已删除', value: 'gone' },
  { label: '部分模块失败', value: 'partial-fail' },
]

const state = ref('success')
const keyword = ref('')

// 演示"旧请求晚到不覆盖新结果"：每次模拟请求携带序号，回包时序号不是最新则丢弃。
let requestSeq = 0

const filteredRows = computed(() =>
  keyword.value
    ? allRows.filter((r) => r.name.includes(keyword.value.trim()))
    : allRows,
)

const hasFilter = computed(() => Boolean(keyword.value.trim()))

function applyDemoState(next) {
  state.value = next
  if (next === 'filtered-empty') keyword.value = '不存在的关键字'
  if (next !== 'filtered-empty' && next !== 'success' && next !== 'partial-fail') return
  if (next !== 'filtered-empty' && next !== 'partial-fail') keyword.value = ''
}

function simulateLoad(target) {
  const seq = ++requestSeq
  state.value = 'loading'
  setTimeout(() => {
    if (seq !== requestSeq) return
    state.value = target
  }, 600)
}

function retry() {
  simulateLoad('success')
}

function clearFilter() {
  keyword.value = ''
  state.value = 'success'
}

const levelTagType = (level) => (level === 'P1' ? 'danger' : level === 'P2' ? 'warning' : 'info')

const showToolbar = computed(() =>
  ['success', 'filtered-empty', 'error', 'loading'].includes(state.value),
)
</script>

<template>
  <div class="content-states-page">
    <header class="page-header">
      <h3 class="page-title">内容状态</h3>
      <p class="page-desc">
        状态判定：初始 → 加载 → 有数据 / 空结果 / 失败；重试回到加载。
        无权限、失败、无结果不统一显示为"暂无数据"；错误态用错误语义，不是中性空态。
      </p>
    </header>

    <ElSegmented
      class="state-switcher"
      :options="STATES"
      v-model="state"
      @change="(v) => applyDemoState(v)"
    />

    <section class="table-region">
      <div v-if="showToolbar" class="toolbar">
        <ElInput
          v-model="keyword"
          class="toolbar-search"
          placeholder="搜索事件名称"
          :prefix-icon="Search"
          clearable
        />
        <ElButton v-if="hasFilter" :icon="RefreshRight" @click="clearFilter">清除筛选</ElButton>
        <ElButton type="primary" :icon="Plus">新建事件</ElButton>
      </div>

      <!-- 部分模块失败：成功区域照常展示，只有失败区域显示重试 -->
      <template v-if="state === 'partial-fail'">
        <ElTable :data="filteredRows" class="region-table">
          <ElTableColumn prop="name" label="事件名称" min-width="220" />
          <ElTableColumn prop="level" label="级别" width="90">
            <template #default="{ row }">
              <ElTag :type="levelTagType(row.level)" size="small">{{ row.level }}</ElTag>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="owner" label="负责人" width="120" />
          <ElTableColumn prop="status" label="状态" width="110" />
        </ElTable>
        <div class="partial-fail-panel">
          <div class="partial-fail-text">
            <span class="partial-fail-title">此区域暂不可用</span>
            <span class="partial-fail-meta">统计模块加载失败 · 数据更新于 09:32</span>
          </div>
          <ElButton size="small" :icon="RefreshRight" @click="retry">重试</ElButton>
        </div>
      </template>

      <!-- 无权限：说明访问受限，不泄露受限数据（表格行数为 0） -->
      <ElResult
        v-else-if="state === 'no-permission'"
        icon="info"
        title="暂无查看权限"
        sub-title="你没有该页面的访问权限。仅当真实流程存在时才提供申请入口。"
      >
        <template #extra>
          <ElButton size="small">申请权限</ElButton>
        </template>
      </ElResult>

      <!-- 请求失败：错误语义 + 可执行重试 -->
      <ElResult
        v-else-if="state === 'error'"
        icon="error"
        title="加载失败，请重试"
        sub-title="网络异常导致数据加载失败，已保留你的筛选条件。"
      >
        <template #extra>
          <ElButton type="primary" :icon="RefreshRight" @click="retry">重试</ElButton>
        </template>
      </ElResult>

      <!-- 对象已删除：返回列表，不显示可编辑的虚假空表单 -->
      <ElResult
        v-else-if="state === 'gone'"
        icon="warning"
        title="内容不存在或已移除"
        sub-title="该事件可能已被删除或链接已过期。"
      >
        <template #extra>
          <ElButton :icon="Back">返回列表</ElButton>
        </template>
      </ElResult>

      <!-- 首次使用：提供创建入口（有创建权限时） -->
      <ElEmpty
        v-else-if="state === 'idle'"
        description="尚未添加数据"
        class="region-empty"
      >
        <ElButton type="primary" :icon="Plus">新建事件</ElButton>
      </ElEmpty>

      <!-- 成功请求返回零条：中性文字，不展示错误图标 -->
      <ElEmpty v-else-if="state === 'empty'" description="暂无数据" class="region-empty" />

      <!-- 搜索筛选无结果：保留已输入条件，提供清除筛选 -->
      <ElEmpty v-else-if="state === 'filtered-empty'" description="未找到符合条件的结果" class="region-empty">
        <ElButton :icon="Delete" @click="clearFilter">清除筛选</ElButton>
      </ElEmpty>

      <!-- 加载中：表格骨架 -->
      <div v-else-if="state === 'loading'" class="skeleton-region">
        <ElSkeleton :rows="5" animated :loading="true">
          <span></span>
        </ElSkeleton>
      </div>

      <!-- 有数据 -->
      <ElTable v-else :data="filteredRows" class="region-table">
        <ElTableColumn prop="name" label="事件名称" min-width="220" />
        <ElTableColumn prop="level" label="级别" width="90">
          <template #default="{ row }">
            <ElTag :type="levelTagType(row.level)" size="small">{{ row.level }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="owner" label="负责人" width="120" />
        <ElTableColumn prop="status" label="状态" width="110" />
      </ElTable>
    </section>

    <p class="state-note" aria-live="polite">
      当前演示状态：{{ STATES.find((s) => s.value === state)?.label }}
      <template v-if="state === 'loading'">（模拟请求 600ms，重复点击切换可验证旧请求不覆盖新结果）</template>
    </p>
  </div>
</template>

<style scoped lang="less">
.content-states-page {
  --page-gutter: var(--space-size-24);
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--page-gutter);
  display: flex;
  flex-direction: column;
  gap: var(--space-size-24);
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-8);
}

.page-title {
  margin: 0;
  font-size: var(--font-size-big);
  color: var(--color-text-primary);
  line-height: var(--font-line-height-normal);
}

.page-desc {
  margin: 0;
  max-width: 720px;
  font-size: var(--font-size-normal);
  color: var(--color-text-secondary);
  line-height: var(--font-line-height-normal);
}

.state-switcher {
  align-self: flex-start;
}

.table-region {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-size-12);
}

.toolbar-search {
  width: 280px;
  max-width: 100%;
}

.region-table {
  width: 100%;
}

.region-empty {
  padding: var(--space-size-32) 0;
}

.skeleton-region {
  padding: var(--space-size-16) 0;
}

.partial-fail-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-size-16);
  padding: var(--space-size-16) var(--space-size-20);
  border: var(--border-width-normal) solid var(--color-border);
  border-radius: var(--radius-size-normal);
}

.partial-fail-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-4);
}

.partial-fail-title {
  font-size: var(--font-size-normal);
  font-weight: 600;
  color: var(--color-error);
  line-height: var(--font-line-height-normal);
}

.partial-fail-meta {
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  line-height: var(--font-line-height-normal);
}

.state-note {
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  line-height: var(--font-line-height-normal);
}
</style>
