<script setup>
import { onMounted, ref } from 'vue'
import { SweetButton, SweetInput, SweetTable, SweetTableColumn, SweetPagination,SweetDrawer } from '@hw-seq/sweet-ui-base'
import { getDeviceList } from '../../api/demo.js'

const detail=ref(null)
const keyword=ref(''),list=ref([]),total=ref(0),page=ref(1),pageSize=ref(10),loading=ref(false),error=ref('')
async function fetchList(){
  loading.value=true;error.value=''
  try{const result=await getDeviceList({keyword:keyword.value,page:page.value,pageSize:pageSize.value});list.value=result.list;total.value=result.total}
  catch(e){error.value='加载失败：'+e.message}
  finally{loading.value=false}
}
function search(){page.value=1;fetchList()}
onMounted(fetchList)
</script>

<template>
  <main class="page-root">
    <header><h1>设备管理</h1><span>{{ total }} 台设备</span></header>
    <section class="panel">
      <div class="search-bar">
        <SweetInput v-model="keyword" class="search-input" placeholder="输入设备名称" clearable @keyup.enter="search" />
        <SweetButton type="primary" :loading="loading" @click="search"><i class="sweetui-icon-search-l" aria-hidden="true"></i>查询</SweetButton>
      </div>
      <p v-if="error" role="alert">{{ error }}</p>
      <SweetTable :data="list" row-key="id" :height="360">
        <SweetTableColumn prop="name" label="设备名称" min-width="180" />
        <SweetTableColumn label="状态" min-width="120"><template #default="{ row }">{{ row.status==='enabled'?'已启用':'已停用' }}</template></SweetTableColumn>
        <SweetTableColumn prop="updatedAt" label="更新时间" min-width="180" />
      <SweetTableColumn label="操作" width="100"><template #default="{row}"><SweetButton text @click="detail=row">详情</SweetButton></template></SweetTableColumn></SweetTable>
      <SweetPagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, prev, pager, next" class="pagination" @current-change="fetchList" />
    </section>
  <SweetDrawer :model-value="!!detail" title="设备详情" @update:model-value="value=>{if(!value)detail=null}"><template v-if="detail"><h2>{{ detail.name }}</h2><p>{{ detail.updatedAt }}</p></template></SweetDrawer></main>
</template>

<style scoped>
.page-root{min-height:100%;padding:var(--swt-space-size-24)}
header{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--swt-space-size-16);margin-bottom:var(--swt-space-size-24)}
h1{margin:0;font-size:var(--swt-font-size-medium);color:var(--swt-color-text-primary)}
header span{color:var(--swt-color-text-secondary)}
.panel{padding:var(--swt-space-size-24);background:var(--swt-color-bg-primary);border-radius:var(--swt-radius-size-normal)}
.search-bar{display:flex;flex-wrap:wrap;gap:var(--swt-space-size-12);margin-bottom:var(--swt-space-size-16)}
.search-input{width:260px;max-width:100%}
.pagination{margin-top:var(--swt-space-size-16);justify-content:flex-end}
</style>
