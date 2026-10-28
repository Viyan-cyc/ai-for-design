<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { SweetButton, SweetIcon, SweetInput, SweetTable, SweetTableColumn, SweetPagination, SweetAlert } from '@hw-seq/sweet-ui-base'
import { getDeviceList } from '../../api/demo.js'
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)
const rows = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
let sequence = 0
onUnmounted(() => { sequence++ })
async function load() {
  const request = ++sequence
  loading.value = true
  error.value = ''
  try {
    const result = await getDeviceList({ keyword: keyword.value, page: page.value, pageSize: pageSize.value })
    if (request !== sequence) return
    rows.value = result.list
    total.value = result.total
  } catch (e) {
    if (request === sequence) error.value = e.message || '加载失败'
  } finally {
    if (request === sequence) loading.value = false
  }
}
function search() { page.value = 1; load() }
function reset() { keyword.value = ''; search() }
onMounted(load)
</script>
<template>
  <main class="page">
    <header class="heading"><h1>设备管理</h1><p>查询设备状态与更新时间</p></header>
    <section class="panel" aria-label="设备列表" :aria-busy="loading">
      <div class="toolbar">
        <SweetInput v-model="keyword" class="search" clearable placeholder="输入设备名称" aria-label="设备名称" @keyup.enter="search" />
        <SweetButton type="primary" :loading="loading" @click="search"><SweetIcon icon-class="sweetui-icon-search-l" />查询</SweetButton>
        <SweetButton :disabled="loading" @click="reset">重置</SweetButton>
      </div>
      <SweetAlert v-if="error" type="error" :title="error" :closable="false" />
      <SweetButton v-if="error" @click="load">重试</SweetButton>
      <SweetTable :data="rows">
        <SweetTableColumn prop="name" label="名称" min-width="180" />
        <SweetTableColumn label="状态" width="120"><template #default="{ row }">{{ row.status === 'enabled' ? '已启用' : '已停用' }}</template></SweetTableColumn>
        <SweetTableColumn prop="updatedAt" label="更新时间" min-width="180" />
      </SweetTable>
      <SweetPagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, prev, pager, next" class="pagination" @current-change="load" />
    </section>
  </main>
</template>
<style scoped>
.page { padding: var(--swt-space-size-24); }
.heading { margin-bottom: var(--swt-space-size-24); }
.heading h1 { margin: 0; font-size: var(--swt-font-size-big2); }
.heading p { color: var(--swt-color-text-secondary); margin-bottom: 0; }
.panel { background: var(--swt-color-bg-primary); padding: var(--swt-space-size-24); border-radius: var(--swt-radius-size-medium); }
.toolbar { display: flex; flex-wrap: wrap; gap: var(--swt-space-size-12); margin-bottom: var(--swt-space-size-16); }
.search { width: 280px; max-width: 100%; }
.pagination { display: flex; justify-content: flex-end; margin-top: var(--swt-space-size-16); }
</style>
