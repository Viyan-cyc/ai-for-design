<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElButton, ElInput, ElSelect, ElOption, ElTable, ElTableColumn, ElPagination, ElDrawer, ElDescriptions, ElDescriptionsItem, ElIcon, ElAlert } from 'element-plus'
import { Search, Refresh, ArrowRight, Monitor, CircleCheck, Warning } from '@element-plus/icons-vue'
import { getResources } from '../../../api/foundation.js'
const records=ref([])
const query=ref('')
const status=ref('all')
const applied=ref({query:'',status:'all'})
const page=ref(1)
const detail=ref(null)
const loading=ref(false)
const error=ref('')
const filtered=computed(()=>records.value.filter(r=>(applied.value.status==='all'||r.status===applied.value.status)&&`${r.name} ${r.ip}`.toLowerCase().includes(applied.value.query.toLowerCase())))
const paged=computed(()=>filtered.value.slice((page.value-1)*8,page.value*8))
const stats=computed(()=>[{id:'total',label:'纳管资源',value:records.value.length,unit:'台',icon:Monitor,tone:'brand'},{id:'healthy',label:'运行正常',value:records.value.filter(r=>r.status==='运行中').length,unit:'台',icon:CircleCheck,tone:'success'},{id:'attention',label:'需要关注',value:records.value.filter(r=>r.status==='需关注').length,unit:'台',icon:Warning,tone:'alert'}])
async function load(){loading.value=true;try{records.value=await getResources();error.value=''}catch{error.value='资源加载失败，请重试'}finally{loading.value=false}}
onMounted(load)
function search(){applied.value={query:query.value,status:status.value};page.value=1}
function reset(){query.value='';status.value='all';search()}
</script>
<template>
 <section class="resources">
  <header class="page-heading"><div><div class="breadcrumb">基础设施 <ElIcon :size="12"><ArrowRight /></ElIcon> 资源管理</div><h1>资源总览</h1><p>统一查看资源运行状态，快速定位需要关注的设备。</p></div><ElButton :icon="Refresh" :loading="loading" @click="load">刷新数据</ElButton></header>
  <div class="summary-strip"><div v-for="item in stats" :key="item.id" class="stat"><span class="stat-icon" :class="item.tone"><ElIcon :size="20"><component :is="item.icon"/></ElIcon></span><div><span class="stat-label">{{item.label}}</span><div><strong>{{item.value}}</strong><span class="unit">{{item.unit}}</span></div></div></div><span class="data-source">演示数据<br/>更新于 09:42</span></div>
  <div class="table-card"><div class="table-title"><h2>资源列表</h2><span>共 {{records.length}} 台资源</span></div>
   <div class="filters"><label for="resource-query">关键词</label><ElInput id="resource-query" v-model="query" :prefix-icon="Search" placeholder="资源名称 / IP 地址" class="query" clearable @keyup.enter="search"/><label for="resource-status">运行状态</label><ElSelect id="resource-status" v-model="status" class="status" aria-label="运行状态"><ElOption label="全部状态" value="all"/><ElOption label="运行中" value="运行中"/><ElOption label="需关注" value="需关注"/></ElSelect><ElButton type="primary" @click="search">查询</ElButton><ElButton @click="reset">重置</ElButton></div>
   <ElAlert v-if="error" :title="error" type="error" :closable="false"><ElButton @click="load">重试</ElButton></ElAlert>
   <ElTable stripe v-else :data="paged" row-key="id" empty-text="暂无匹配资源">
    <ElTableColumn prop="name" label="资源名称" min-width="220"><template #default="scope"><button class="resource-link" @click="detail=scope.row"><ElIcon :size="16"><Monitor /></ElIcon>{{scope.row.name}}</button></template></ElTableColumn>
    <ElTableColumn prop="ip" label="IP 地址" min-width="150"/><ElTableColumn prop="region" label="所属区域" min-width="120"/><ElTableColumn prop="status" label="运行状态" min-width="120"><template #default="scope"><span class="resource-status" :class="{attention:scope.row.status==='需关注'}"><i/>{{scope.row.status}}</span></template></ElTableColumn><ElTableColumn prop="owner" label="负责团队" min-width="150"/><ElTableColumn prop="updated" label="最近更新" min-width="180"/><ElTableColumn label="操作" width="85"><template #default="scope"><ElButton link type="primary" @click="detail=scope.row">详情</ElButton></template></ElTableColumn>
   </ElTable>
   <footer><span>共 {{filtered.length}} 条 · 每页 8 条</span><ElPagination v-model:current-page="page" :page-size="8" :total="filtered.length" layout="prev, pager, next" background /></footer>
  </div>
  <p class="bottom-note">同一工作台骨架 · 不同业务装配 · 该示例不显示对话输入组件</p>
  <ElDrawer :model-value="!!detail" title="资源详情" size="420px" @close="detail=null"><ElDescriptions v-if="detail" :column="1" border><ElDescriptionsItem v-for="field in [{key:'id',label:'资源 ID'},{key:'name',label:'名称'},{key:'ip',label:'IP 地址'},{key:'region',label:'区域'},{key:'status',label:'状态'},{key:'owner',label:'负责团队'}]" :key="field.key" :label="field.label">{{detail[field.key]}}</ElDescriptionsItem></ElDescriptions><p>仅供演示，未连接实际设备。</p></ElDrawer>
 </section>
</template>
<style scoped lang="less">
.resources { flex: 1; min-width: 0; overflow: auto; padding: var(--space-size-24) var(--space-size-24); background: color-mix(in srgb,var(--color-select) 20%,var(--color-bg-2)); }
.page-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-size-24)}.breadcrumb{display:flex;gap:var(--space-size-8);align-items:center;color:var(--color-text-secondary);font-size:var(--font-size-small)}h1{font-size:var(--font-size-medium);margin:var(--space-size-12) 0 var(--space-size-8)}.page-heading p{margin:0;color:var(--color-text-secondary);font-size:var(--font-size-small)}
.summary-strip{display:flex;flex-wrap:wrap;align-items:center;background:var(--color-bg-2);border:1px solid color-mix(in srgb,var(--color-brand) 10%,var(--color-bg-2));border-radius:var(--radius-size-big);padding:var(--space-size-20) var(--space-size-24);gap:var(--space-size-24);margin-bottom:var(--space-size-20)}.stat{display:flex;align-items:center;gap:var(--space-size-16);flex:1;min-width:160px}.stat-icon{display:grid;place-items:center;width:44px;height:44px;max-width:100%;background:var(--color-select);color:var(--color-brand);border-radius:var(--radius-size-big)}.stat-icon.success{background:var(--color-success-subtler);color:var(--color-success)}.stat-icon.alert{background:var(--color-alert-subtler);color:var(--color-alert)}.stat-label{font-size:var(--font-size-small);color:var(--color-text-secondary)}.stat strong{font-size:var(--font-size-big);line-height:var(--font-line-height-big);font-weight:var(--font-weight-bold)}.unit{font-size:var(--font-size-small);color:var(--color-text-secondary);margin-left:var(--space-size-8)}.data-source{text-align:right;font-size:var(--font-size-small);color:var(--color-text-placeholder)}
.table-card{background:var(--color-bg-2);border:1px solid color-mix(in srgb,var(--color-brand) 10%,var(--color-bg-2));border-radius:var(--radius-size-big);padding:var(--space-size-20) var(--space-size-24)}.table-title{display:flex;gap:var(--space-size-12);align-items:center;margin-bottom:var(--space-size-20)}h2{font-size:var(--font-size-normal1);margin:0}.table-title span{color:var(--color-text-secondary);font-size:var(--font-size-small)}
.filters{display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-size-12);margin-bottom:var(--space-size-20);font-size:var(--font-size-small)}.query{width:260px;max-width:100%}.status{width:150px;max-width:100%}.resource-link{display:flex;align-items:center;gap:var(--space-size-8);border:0;background:transparent;color:var(--color-brand);cursor:pointer;font:inherit}.resource-status{display:inline-flex;align-items:center;gap:var(--space-size-8);color:var(--color-success);font-size:var(--font-size-small)}.resource-status i{width:6px;height:6px;background:currentColor;border-radius:var(--radius-size-full)}.resource-status.attention{color:var(--color-alert)}footer{display:flex;justify-content:space-between;align-items:center;gap:var(--space-size-16);margin-top:var(--space-size-20)}footer>span,.bottom-note{font-size:var(--font-size-small);color:var(--color-text-secondary)}.bottom-note{text-align:center;margin:var(--space-size-20) 0}
</style>
