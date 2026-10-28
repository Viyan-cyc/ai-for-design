<script setup>
import { ref, computed } from 'vue'
import { ElIcon, ElTooltip, ElDialog, ElButton, ElEmpty } from 'element-plus'
import { Monitor, Connection, Grid, DataAnalysis, FolderOpened, Setting, Moon, Sunny, Bell, FullScreen, MagicStick } from '@element-plus/icons-vue'
import WorkbenchShell from './components/workbench-shell.vue'
import AiWorkspace from './components/ai-workspace.vue'
import ResourceWorkspace from './components/resource-workspace.vue'
import SessionPanel from './components/session-panel.vue'
const mode=ref('ai')
const theme=ref('default')
const sessionsOpen=ref(false)
const info=ref('')
const tabs=ref([{id:'mail',title:'邮件应用发送失败排查',status:'done'},{id:'network',title:'核心交换机链路诊断',status:'pending'},{id:'storage',title:'存储容量趋势分析',status:'idle'}])
const resourceTabs=ref([{id:'resources',title:'资源总览',status:'done',closable:false}])
const activeTab=ref('mail')
const activeResource=ref('resources')
const activeMenu=ref('monitor')
const active=computed(()=>tabs.value.find(t=>t.id===activeTab.value))
const menus=computed(()=>[
 {id:'monitor',label:mode.value==='ai'?'智能监控':'资源总览',icon:Monitor,tone:'blue'},
 {id:'flow',label:mode.value==='ai'?'运维流程':'服务目录',icon:Connection,tone:'green'},
 {id:'jobs',label:'作业中心',icon:Grid,tone:'blue'},
 {id:'visual',label:'可视化中心',icon:DataAnalysis,tone:'purple'},
 {id:'files',label:'知识与文档',icon:FolderOpened,tone:'purple'},
 {id:'settings',label:'系统设置',icon:Setting,tone:'blue'}
])
function switchMode(){sessionsOpen.value=false;activeMenu.value='monitor'}
function setTheme(){theme.value=theme.value==='default'?'dark':'default';document.documentElement.setAttribute('data-theme',theme.value)}
function closeTab(id){const list=mode.value==='ai'?tabs:resourceTabs;const current=mode.value==='ai'?activeTab:activeResource;const i=list.value.findIndex(t=>t.id===id);list.value=list.value.filter(t=>t.id!==id);if(current.value===id)current.value=list.value[Math.max(0,i-1)]?.id||''}
function newTab(){const item={id:`workspace-${Date.now()}`,title:mode.value==='ai'?'新排障会话':'资源查询',status:'idle'};if(mode.value==='ai'){tabs.value.push(item);activeTab.value=item.id}else{resourceTabs.value.push(item);activeResource.value=item.id}}
function selectMenu(id){activeMenu.value=id;if(id==='monitor')return;const name=menus.value.find(m=>m.id===id)?.label;info.value=`${name}为可配置导航入口。本次聚焦骨架复用，该业务模块尚未接入。`}
function openSession(item){if(!tabs.value.some(t=>t.id===item.id))tabs.value.push({...item,status:'idle'});activeTab.value=item.id;sessionsOpen.value=false}
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{info.value='当前浏览器不支持页面全屏，请使用浏览器全屏功能。'}}
</script>
<template>
 <div class="foundation">
  <WorkbenchShell :brand="mode==='ai'?'MindOps':'CloudOps'" :workspace-name="mode==='ai'?'智能运维工作台':'资源管理工作台'" :menus="menus" :tabs="mode==='ai'?tabs:resourceTabs" :active-tab="mode==='ai'?activeTab:activeResource" :active-menu="activeMenu" @select-menu="selectMenu" @select-tab="mode==='ai'?activeTab=$event:activeResource=$event" @close-tab="closeTab" @new-tab="newTab" @sessions="sessionsOpen=!sessionsOpen">
   <template #tools>
    <div class="preview-mode"><span>骨架预览</span><select v-model="mode" aria-label="切换示例" @change="switchMode"><option value="ai">AI 工作台</option><option value="resources">普通查询页</option></select></div>
    <div class="tool-group"><ElTooltip content="最近会话"><button aria-label="打开最近会话" @click="sessionsOpen=!sessionsOpen"><ElIcon :size="17"><MagicStick /></ElIcon></button></ElTooltip><ElTooltip content="通知"><button aria-label="查看通知" @click="info='当前为离线预览，没有新的业务通知。'"><ElIcon :size="17"><Bell /></ElIcon></button></ElTooltip><ElTooltip content="全屏"><button aria-label="全屏预览" @click="fullscreen"><ElIcon :size="17"><FullScreen /></ElIcon></button></ElTooltip><ElTooltip content="切换深浅主题"><button aria-label="切换深浅主题" @click="setTheme"><ElIcon :size="17"><Sunny v-if="theme==='dark'"/><Moon v-else /></ElIcon></button></ElTooltip><span class="avatar">运</span></div>
   </template>
   <SessionPanel v-if="sessionsOpen" :business="mode==='resources'" @close="sessionsOpen=false" @open="openSession" @new="newTab();sessionsOpen=false" />
   <template v-if="mode==='ai'">
    <template v-for="tab in tabs" :key="tab.id"><AiWorkspace v-show="activeTab===tab.id" :session="tab" /></template>
    <ElEmpty v-if="!active" description="开始一个新的工作区"><ElButton type="primary" @click="newTab">新建会话</ElButton></ElEmpty>
   </template>
   <template v-else><template v-for="tab in resourceTabs" :key="tab.id"><ResourceWorkspace v-show="activeResource===tab.id" /></template></template>
  </WorkbenchShell>
  <ElDialog :model-value="!!info" title="预览说明" width="440" draggable :close-on-click-modal="false" @close="info=''"><p>{{ info }}</p><template #footer><ElButton type="primary" @click="info=''">知道了</ElButton></template></ElDialog>
 </div>
</template>
<style scoped lang="less">
.foundation { height: 100vh; overflow: hidden; font-size: var(--font-size-normal); line-height: var(--font-line-height-normal); color: var(--color-text-primary); }
.preview-mode { display: flex; gap: var(--space-size-8); align-items: center; font-size: var(--font-size-small); color: var(--color-text-secondary); border-right: 1px solid var(--color-border-separator-subtle); padding-right: var(--space-size-16); }
.preview-mode select { font: inherit; color: var(--color-brand); border: 0; background: var(--color-bg-2); cursor: pointer; outline-color: var(--color-brand); }
.tool-group { display: flex; align-items: center; gap: var(--space-size-12); }.tool-group button { display: grid; place-items: center; background: transparent; color: var(--color-text-secondary); border: 0; cursor: pointer; padding: var(--space-size-4); }.tool-group button:hover { color: var(--color-brand); }
.avatar { width: 28px; height: 28px; max-width: 100%; display: grid; place-items: center; border-radius: var(--radius-size-full); color: var(--color-text-inverse); background: linear-gradient(140deg,var(--color-brand-hover),var(--color-brand)); font-size: var(--font-size-small); border: 2px solid var(--color-select); }
@media(max-width: 992px){.preview-mode>span{display:none}.tool-group{gap:var(--space-size-4)}}
</style>
