<script setup>
import { ref, computed } from 'vue'
import { SweetButton, SweetIcon, SweetDialog, SweetEmpty } from '@hw-seq/sweet-ui-base'
import { theme as currentTheme, setTheme as applyTheme } from '../../theme.js'
import WorkbenchShell from './workbench-shell.vue'
import AiWorkspace from './components/ai-workspace.vue'
import ResourceWorkspace from './components/resource-workspace.vue'
import SessionPanel from './components/session-panel.vue'
const props = defineProps({ busyBySession: { type: Object, default: () => ({}) } })
const emit = defineEmits(['send', 'stop'])
const mode = ref('ai')
const sessionsOpen = ref(false)
const info = ref('')
const tabs = ref([
  { id: 'mail', title: '邮件应用发送失败排查', status: 'done' },
  { id: 'network', title: '核心交换机链路诊断', status: 'pending' },
  { id: 'storage', title: '存储容量趋势分析', status: 'idle' }
])
const resourceTabs = ref([{ id: 'resources', title: '资源总览', status: 'done', closable: false }])
const activeTab = ref('mail')
const activeResource = ref('resources')
const activeMenu = ref('monitor')
const currentTabs = computed(() => mode.value === 'ai' ? tabs.value : resourceTabs.value)
const currentActive = computed(() => mode.value === 'ai' ? activeTab.value : activeResource.value)
const active = computed(() => currentTabs.value.find(t => t.id === currentActive.value))
const menus = computed(() => [
  { id: 'monitor', label: mode.value === 'ai' ? '智能监控' : '资源总览', icon: 'sweetui-icon-display-setting-l', tone: 'accent' },
  { id: 'flow', label: mode.value === 'ai' ? '运维流程' : '服务目录', icon: 'sweetui-icon-single-cell-connection-l', tone: 'green' },
  { id: 'jobs', label: '作业中心', icon: 'sweetui-icon-menu-l', tone: 'accent' },
  { id: 'visual', label: '可视化中心', icon: 'sweetui-icon-search-l', tone: 'purple' },
  { id: 'files', label: '知识与文档', icon: 'sweetui-icon-folder-opened-l', tone: 'purple' },
  { id: 'settings', label: '系统设置', icon: 'sweetui-icon-property-setting-l', tone: 'accent' }
])
function switchMode() { sessionsOpen.value = false; activeMenu.value = 'monitor' }
function toggleTheme() {
  const next = currentTheme.value === 'uDesign2.2-dark' ? 'uDesign2.2-light' : 'uDesign2.2-dark'
  applyTheme(next)
}
function closeTab(id) {
  const isAi = mode.value === 'ai'
  const list = isAi ? tabs : resourceTabs
  const current = isAi ? activeTab : activeResource
  const i = list.value.findIndex(t => t.id === id)
  list.value = list.value.filter(t => t.id !== id)
  if (current.value === id) current.value = list.value[Math.max(0, i - 1)]?.id || ''
}
function newTab() {
  const item = { id: `workspace-${Date.now()}`, title: mode.value === 'ai' ? '新排障会话' : '资源查询', status: 'idle' }
  if (mode.value === 'ai') { tabs.value.push(item); activeTab.value = item.id }
  else { resourceTabs.value.push(item); activeResource.value = item.id }
}
function selectMenu(id) { activeMenu.value = id; if (id === 'monitor') return; const name = menus.value.find(m => m.id === id)?.label; info.value = `${name}为可配置导航入口。本次聚焦骨架复用，该业务模块尚未接入。` }
function openSession(item) { if (!tabs.value.some(t => t.id === item.id)) tabs.value.push({ ...item, status: 'idle' }); activeTab.value = item.id; sessionsOpen.value = false }
async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() } catch { info.value = '当前浏览器不支持页面全屏，请使用浏览器全屏功能。' } }
</script>
<template>
 <div class="foundation">
  <WorkbenchShell :brand="mode === 'ai' ? 'MindOps' : 'CloudOps'" :workspace-name="mode === 'ai' ? '智能运维工作台' : '资源管理工作台'" :menus="menus" :tabs="currentTabs" :active-tab="currentActive" :active-menu="activeMenu" @select-menu="selectMenu" @select-tab="mode === 'ai' ? activeTab = $event : activeResource = $event" @close-tab="closeTab" @new-tab="newTab" @sessions="sessionsOpen = !sessionsOpen">
   <template #tools>
    <div class="preview-mode"><span>骨架预览</span><select v-model="mode" aria-label="切换示例" @change="switchMode"><option value="ai">AI 工作台</option><option value="resources">普通查询页</option></select></div>
    <div class="tool-group">
     <SweetButton text aria-label="最近会话" @click="sessionsOpen = !sessionsOpen"><SweetIcon icon-class="sweetui-icon-file-l" :size="17" /></SweetButton>
     <SweetButton text aria-label="通知" @click="info = '当前为离线预览，没有新的业务通知。'"><SweetIcon icon-class="sweetui-icon-circle-check-l" :size="17" /></SweetButton>
     <SweetButton text aria-label="全屏预览" @click="fullscreen"><SweetIcon icon-class="sweetui-icon-display-setting-l" :size="17" /></SweetButton>
     <SweetButton text aria-label="切换深浅主题" @click="toggleTheme"><SweetIcon icon-class="sweetui-icon-display-setting-l" :size="17" /></SweetButton>
     <span class="avatar">运</span>
    </div>
   </template>
   <SessionPanel v-if="sessionsOpen" :business="mode === 'resources'" @close="sessionsOpen = false" @open="openSession" @new="newTab(); sessionsOpen = false" />
   <template v-if="mode === 'ai'">
    <template v-for="tab in tabs" :key="tab.id"><AiWorkspace v-show="activeTab === tab.id" :session="tab" :busy="!!props.busyBySession[tab.id]" @send="emit('send', { sessionId: tab.id, ...$event })" @stop="emit('stop', tab.id)" /></template>
    <SweetEmpty v-if="!active" description="开始一个新的工作区"><SweetButton type="primary" @click="newTab">新建会话</SweetButton></SweetEmpty>
   </template>
   <template v-else><template v-for="tab in resourceTabs" :key="tab.id"><ResourceWorkspace v-show="activeResource === tab.id" /></template></template>
  </WorkbenchShell>
  <SweetDialog :model-value="!!info" title="预览说明" width="440" draggable :close-on-click-modal="false" @update:model-value="info = ''">
   <p>{{ info }}</p>
   <template #footer><SweetButton type="primary" @click="info = ''">知道了</SweetButton></template>
  </SweetDialog>
 </div>
</template>
<style scoped>
.foundation { height: 100vh; overflow: hidden; font-size: var(--swt-font-size-normal); line-height: var(--swt-font-line-height-normal); color: var(--swt-color-text-primary); }
.preview-mode { display: flex; gap: var(--swt-space-size-8); align-items: center; font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); border-right: 1px solid var(--swt-color-dividing-line-secondary); padding-right: var(--swt-space-size-16); }
.preview-mode select { font: inherit; color: var(--swt-color-accent-text-normal); border: 0; background: var(--swt-color-bg-secondary); cursor: pointer; outline-color: var(--swt-color-accent-normal); border-radius: var(--swt-radius-size-normal); }
.tool-group { display: flex; align-items: center; gap: var(--swt-space-size-12); }
.avatar { width: 28px; height: 28px; display: grid; place-items: center; border-radius: var(--swt-radius-size-infinity); color: var(--swt-color-white); background: linear-gradient(140deg, var(--swt-color-accent-hover), var(--swt-color-accent-normal)); font-size: var(--swt-font-size-small); border: 2px solid var(--swt-color-overlay-gray1-and-accent-normal-opacity20); }
@media (max-width: 992px) { .preview-mode > span { display: none; } .tool-group { gap: var(--swt-space-size-4); } }
</style>
