<script setup>
import { ref, computed, onMounted } from 'vue'
import { SweetButton, SweetIcon, SweetInput, SweetSelect, SweetOption, SweetTable, SweetTableColumn, SweetPagination, SweetDrawer, SweetAlert, SweetTag } from '@hw-seq/sweet-ui-base'
import { getResources } from '../api/workbench.js'
const records = ref([])
const query = ref('')
const status = ref('all')
const applied = ref({ query: '', status: 'all' })
const page = ref(1)
const detail = ref(null)
const loading = ref(false)
const error = ref('')
const filtered = computed(() => records.value.filter(r => (applied.value.status === 'all' || r.status === applied.value.status) && `${r.name} ${r.ip}`.toLowerCase().includes(applied.value.query.toLowerCase())))
const paged = computed(() => filtered.value.slice((page.value - 1) * 8, page.value * 8))
const stats = computed(() => [
  { id: 'total', label: '纳管资源', value: records.value.length, unit: '台', tone: 'accent' },
  { id: 'healthy', label: '运行正常', value: records.value.filter(r => r.status === '运行中').length, unit: '台', tone: 'success' },
  { id: 'attention', label: '需要关注', value: records.value.filter(r => r.status === '需关注').length, unit: '台', tone: 'warning' }
])
async function load() {
  loading.value = true
  try { records.value = await getResources(); error.value = '' }
  catch { error.value = '资源加载失败，请重试' }
  finally { loading.value = false }
}
onMounted(load)
function search() { applied.value = { query: query.value, status: status.value }; page.value = 1 }
function reset() { query.value = ''; status.value = 'all'; search() }
</script>
<template>
 <section class="resources">
  <header class="page-heading">
   <div>
    <div class="breadcrumb">基础设施 <SweetIcon icon-class="sweetui-icon-arrow-right" :size="12" /> 资源管理</div>
    <h1>资源总览</h1>
    <p>统一查看资源运行状态，快速定位需要关注的设备。</p>
   </div>
   <SweetButton :loading="loading" @click="load"><SweetIcon icon-class="sweetui-icon-refresh-l" />刷新数据</SweetButton>
  </header>
  <div class="summary-strip">
   <div v-for="item in stats" :key="item.id" class="stat">
    <span class="stat-icon" :class="item.tone"><SweetIcon icon-class="sweetui-icon-display-setting-l" :size="20" /></span>
    <div><span class="stat-label">{{ item.label }}</span><div><strong>{{ item.value }}</strong><span class="unit">{{ item.unit }}</span></div></div>
   </div>
   <span class="data-source">演示数据<br />更新于 09:42</span>
  </div>
  <div class="table-card">
   <div class="table-title"><h2>资源列表</h2><span>共 {{ records.length }} 台资源</span></div>
   <div class="filters">
    <label for="resource-query">关键词</label>
    <SweetInput id="resource-query" v-model="query" placeholder="资源名称 / IP 地址" class="query-input" clearable @keyup.enter="search" />
    <label for="resource-status">运行状态</label>
    <SweetSelect id="resource-status" v-model="status" class="status-select" aria-label="运行状态">
     <SweetOption label="全部状态" value="all" /><SweetOption label="运行中" value="运行中" /><SweetOption label="需关注" value="需关注" />
    </SweetSelect>
    <SweetButton type="primary" @click="search">查询</SweetButton>
    <SweetButton @click="reset">重置</SweetButton>
   </div>
   <SweetAlert v-if="error" type="error" :title="error" :closable="false"><SweetButton @click="load">重试</SweetButton></SweetAlert>
   <SweetTable v-else stripe :data="paged" row-key="id" empty-text="暂无匹配资源">
    <SweetTableColumn prop="name" label="资源名称" min-width="220"><template #default="{ row }"><button class="resource-link" @click="detail = row"><SweetIcon icon-class="sweetui-icon-display-setting-l" :size="16" />{{ row.name }}</button></template></SweetTableColumn>
    <SweetTableColumn prop="ip" label="IP 地址" min-width="150" />
    <SweetTableColumn prop="region" label="所属区域" min-width="120" />
    <SweetTableColumn prop="status" label="运行状态" min-width="120"><template #default="{ row }"><span class="resource-status" :class="{ attention: row.status === '需关注' }"><i />{{ row.status }}</span></template></SweetTableColumn>
    <SweetTableColumn prop="owner" label="负责团队" min-width="150" />
    <SweetTableColumn prop="updated" label="最近更新" min-width="180" />
    <SweetTableColumn label="操作" width="85"><template #default="{ row }"><SweetButton text type="primary" @click="detail = row">详情</SweetButton></template></SweetTableColumn>
   </SweetTable>
   <footer><span>共 {{ filtered.length }} 条 · 每页 8 条</span><SweetPagination v-model:current-page="page" :page-size="8" :total="filtered.length" layout="prev, pager, next" background /></footer>
  </div>
  <p class="bottom-note">同一工作台骨架 · 不同业务装配 · 该示例不显示对话输入组件</p>
  <SweetDrawer :model-value="!!detail" title="资源详情" size="420px" @update:model-value="detail = null">
   <dl v-if="detail" class="detail-dl">
    <dt>资源 ID</dt><dd>{{ detail.id }}</dd>
    <dt>名称</dt><dd>{{ detail.name }}</dd>
    <dt>IP 地址</dt><dd>{{ detail.ip }}</dd>
    <dt>区域</dt><dd>{{ detail.region }}</dd>
    <dt>状态</dt><dd><SweetTag :type="detail.status === '需关注' ? 'warning' : 'success'" size="small">{{ detail.status }}</SweetTag></dd>
    <dt>负责团队</dt><dd>{{ detail.owner }}</dd>
   </dl>
   <p class="detail-note">仅供演示，未连接实际设备。</p>
  </SweetDrawer>
 </section>
</template>
<style scoped>
.resources { flex: 1; min-width: 0; overflow: auto; padding: var(--swt-space-size-24); background: var(--swt-color-overlay-gray1-and-accent-normal-opacity5); }
.page-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--swt-space-size-24); }
.breadcrumb { display: inline-flex; gap: var(--swt-space-size-8); align-items: center; color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); }
h1 { font-size: var(--swt-font-size-medium); margin: var(--swt-space-size-12) 0 var(--swt-space-size-8); }
.page-heading p { margin: 0; color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); }
.summary-strip { display: flex; flex-wrap: wrap; align-items: center; background: var(--swt-color-bg-primary); border: 1px solid var(--swt-color-overlay-gray1-and-accent-normal-opacity10); border-radius: var(--swt-radius-size-big); padding: var(--swt-space-size-20) var(--swt-space-size-24); gap: var(--swt-space-size-24); margin-bottom: var(--swt-space-size-20); }
.stat { display: flex; align-items: center; gap: var(--swt-space-size-16); flex: 1; min-width: 160px; }
.stat-icon { display: grid; place-items: center; width: 44px; height: 44px; background: var(--swt-color-overlay-gray1-and-accent-normal-opacity10); color: var(--swt-color-accent-normal); border-radius: var(--swt-radius-size-big); }
.stat-icon.success { background: var(--swt-color-function-success-background); color: var(--swt-color-function-success-normal); }
.stat-icon.warning { background: var(--swt-color-function-warning-background); color: var(--swt-color-function-warning-normal); }
.stat-label { font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); }
.stat strong { font-size: var(--swt-font-size-big); line-height: var(--swt-font-line-height-big); font-weight: var(--swt-font-weight-bold); }
.unit { font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); margin-left: var(--swt-space-size-8); }
.data-source { text-align: right; font-size: var(--swt-font-size-small); color: var(--swt-color-text-extra); }
.table-card { background: var(--swt-color-bg-primary); border: 1px solid var(--swt-color-overlay-gray1-and-accent-normal-opacity10); border-radius: var(--swt-radius-size-big); padding: var(--swt-space-size-20) var(--swt-space-size-24); }
.table-title { display: flex; gap: var(--swt-space-size-12); align-items: center; margin-bottom: var(--swt-space-size-20); }
h2 { font-size: var(--swt-font-size-normal1); margin: 0; }
.table-title span { color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); }
.filters { display: flex; flex-wrap: wrap; align-items: center; gap: var(--swt-space-size-12); margin-bottom: var(--swt-space-size-20); font-size: var(--swt-font-size-small); }
.query-input { width: 260px; max-width: 100%; }
.status-select { width: 150px; max-width: 100%; }
button { cursor: pointer; font: inherit; }
button:focus-visible { outline: 2px solid var(--swt-color-accent-focus); outline-offset: 2px; }
.resource-link { display: inline-flex; align-items: center; gap: var(--swt-space-size-8); border: 0; background: transparent; color: var(--swt-color-accent-text-normal); cursor: pointer; font: inherit; }
.resource-status { display: inline-flex; align-items: center; gap: var(--swt-space-size-8); color: var(--swt-color-function-success-normal); font-size: var(--swt-font-size-small); }
.resource-status i { width: 6px; height: 6px; background: currentColor; border-radius: var(--swt-radius-size-infinity); display: inline-block; }
.resource-status.attention { color: var(--swt-color-function-warning-normal); }
footer { display: flex; justify-content: space-between; align-items: center; gap: var(--swt-space-size-16); margin-top: var(--swt-space-size-20); }
footer > span, .bottom-note { font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); }
.bottom-note { text-align: center; margin: var(--swt-space-size-20) 0; }
.detail-dl { margin: 0; }
.detail-dl dt { color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); margin-top: var(--swt-space-size-16); }
.detail-dl dd { margin: var(--swt-space-size-4) 0 0; }
.detail-note { font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); margin-top: var(--swt-space-size-24); }
</style>
