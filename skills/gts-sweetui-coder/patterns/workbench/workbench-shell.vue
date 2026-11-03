<script setup>
import { ref, computed } from 'vue'
import { SweetInput, SweetButton, SweetIcon } from '@hw-seq/sweet-ui-base'
const props = defineProps({ brand: String, workspaceName: String, menus: { type: Array, default: () => [] }, tabs: { type: Array, default: () => [] }, activeMenu: String, activeTab: String, labels: { type: Object, default: () => ({}) } })
const emit = defineEmits(['select-menu', 'select-tab', 'close-tab', 'new-tab', 'sessions'])
const expanded = ref(false)
const query = ref('')
const labels = computed(() => ({ navigation: '主导航', toggle: '展开或收起导航', search: '搜索应用', empty: '暂无匹配应用', tabs: '工作区', close: '关闭', newTab: '新建工作区', sessions: '最近会话', favorites: '我的收藏', allApps: '全部应用', collapse: '收起导航', expand: '展开导航', ...props.labels }))
const favoritesOnly = ref(false)
const favorites = ref([])
const visibleMenus = computed(() => props.menus.filter(m => m.label.toLowerCase().includes(query.value.toLowerCase()) && (!favoritesOnly.value || favorites.value.includes(m.id))))
function favorite(id) { favorites.value = favorites.value.includes(id) ? favorites.value.filter(x => x !== id) : [...favorites.value, id] }
</script>
<template>
 <div class="shell">
  <header class="topnav">
   <SweetButton text :aria-expanded="expanded" :aria-label="labels.toggle" @click="expanded = !expanded"><SweetIcon icon-class="sweetui-icon-menu-l" :size="18" /></SweetButton>
   <span class="brand">{{ brand }}</span>
   <span class="workspace"><SweetIcon icon-class="sweetui-icon-display-setting-l" :size="15" />{{ workspaceName }}</span>
   <div class="tools"><slot name="tools" /></div>
  </header>
  <div class="body">
   <aside class="navigation" :class="{ expanded }" :aria-label="labels.navigation">
    <div v-if="expanded" class="nav-search">
     <div class="nav-filters">
      <button :class="{ selected: !favoritesOnly }" @click="favoritesOnly = false">{{ labels.allApps }}</button>
      <button :class="{ selected: favoritesOnly }" @click="favoritesOnly = true">{{ labels.favorites }}</button>
     </div>
     <SweetInput v-model="query" clearable :placeholder="labels.search" :aria-label="labels.search"><template #prefix><SweetIcon icon-class="sweetui-icon-search-l" :size="14" /></template></SweetInput>
    </div>
    <nav class="menu-list">
     <div v-for="item in visibleMenus" :key="item.id" class="nav-row" :class="{ current: activeMenu === item.id }">
      <button type="button" class="nav-action" :aria-label="item.label" :aria-current="activeMenu === item.id ? 'page' : undefined" :title="item.label" @click="emit('select-menu', item.id)">
       <span class="nav-symbol" :class="item.tone"><SweetIcon v-if="item.icon" :icon-class="item.icon" :size="18" /></span>
       <span v-if="expanded" class="menu-label">{{ item.label }}</span>
      </button>
      <button v-if="expanded" type="button" class="favorite" :aria-label="`${favorites.includes(item.id) ? '取消收藏' : '收藏'}${item.label}`" @click="favorite(item.id)">
       <SweetIcon :icon-class="favorites.includes(item.id) ? 'sweetui-icon-circle-check-l' : 'sweetui-icon-circle-check-l'" :size="14" :style="{ opacity: favorites.includes(item.id) ? 1 : 0.3 }" />
      </button>
     </div>
     <p v-if="expanded && !visibleMenus.length" class="empty">{{ labels.empty }}</p>
    </nav>
    <button class="collapse-button" :aria-label="expanded ? labels.collapse : labels.expand" @click="expanded = !expanded">
     <SweetIcon :icon-class="expanded ? 'sweetui-icon-arrow-left' : 'sweetui-icon-arrow-right'" :size="16" />
     <span v-if="expanded">{{ labels.collapse }}</span>
    </button>
   </aside>
   <main class="main">
    <div class="tabbar">
     <SweetButton text class="session-toggle" :aria-label="labels.sessions" @click="emit('sessions')"><SweetIcon icon-class="sweetui-icon-nav-fold" :size="17" /></SweetButton>
     <nav class="tabs" :aria-label="labels.tabs">
      <div v-for="tab in tabs" :key="tab.id" class="tab" :class="{ active: activeTab === tab.id }">
       <button type="button" :aria-current="activeTab === tab.id ? 'page' : undefined" :title="tab.title" @click="emit('select-tab', tab.id)">
        <span class="status-dot" :class="tab.status" />
        <span class="tab-title">{{ tab.title }}</span>
       </button>
       <SweetButton v-if="tab.closable !== false" text :aria-label="labels.close + ' ' + tab.title" @click="emit('close-tab', tab.id)"><SweetIcon icon-class="sweetui-icon-close" /></SweetButton>
      </div>
     </nav>
     <SweetButton text :aria-label="labels.newTab" @click="emit('new-tab')"><SweetIcon icon-class="sweetui-icon-add-l" :size="17" /></SweetButton>
    </div>
    <div class="content"><slot /></div>
   </main>
  </div>
 </div>
</template>
<style scoped>
.shell { height: 100%; min-height: 0; min-width: 0; display: flex; flex-direction: column; background: var(--swt-color-bg-primary); color: var(--swt-color-text-primary); --page-line: color-mix(in srgb, var(--swt-color-accent-normal) 11%, var(--swt-color-bg-primary)); }
.topnav { min-height: 48px; display: flex; gap: var(--swt-space-size-12); align-items: center; padding: var(--swt-space-size-4) var(--swt-space-size-16); border-bottom: 1px solid var(--page-line); }
.brand { font-size: var(--swt-font-size-normal1); font-weight: var(--swt-font-weight-bold); color: var(--swt-color-accent-text-normal); letter-spacing: .3px; }
.workspace { display: inline-flex; gap: var(--swt-space-size-8); align-items: center; border-radius: var(--swt-radius-size-normal); background: var(--swt-color-overlay-gray1-and-accent-normal-opacity10); padding: var(--swt-space-size-4) var(--swt-space-size-12); font-size: var(--swt-font-size-small); font-weight: var(--swt-font-weight-bold); color: var(--swt-color-accent-text-normal); }
.tools { margin-left: auto; display: flex; gap: var(--swt-space-size-12); align-items: center; }
.body { flex: 1; min-height: 0; display: flex; }
.navigation { width: 56px; flex-shrink: 0; border-right: 1px solid var(--page-line); display: flex; flex-direction: column; min-height: 0; }
.navigation.expanded { width: 216px; max-width: 45%; }
.nav-search { padding: var(--swt-space-size-12) var(--swt-space-size-12) var(--swt-space-size-16); }
.nav-filters { display: flex; gap: var(--swt-space-size-12); margin-bottom: var(--swt-space-size-12); font-size: var(--swt-font-size-small); }
.nav-filters button { color: var(--swt-color-text-secondary); }
.nav-filters .selected { color: var(--swt-color-accent-text-normal); }
.menu-list { overflow: auto; padding: var(--swt-space-size-8); flex: 1; }
button { cursor: pointer; font: inherit; color: inherit; background: transparent; border: 0; }
button:focus-visible { outline: 2px solid var(--swt-color-accent-focus); outline-offset: -2px; }
.nav-row { display: flex; align-items: center; border-radius: var(--swt-radius-size-normal); margin: 0 var(--swt-space-size-4) var(--swt-space-size-8); }
.nav-row.current { background: color-mix(in srgb, var(--swt-color-overlay-gray1-and-accent-normal-opacity10) 65%, var(--swt-color-bg-primary)); }
.nav-action { height: 40px; flex: 1; display: flex; align-items: center; gap: var(--swt-space-size-12); padding: 0 var(--swt-space-size-8); min-width: 0; }
.nav-symbol { width: 24px; height: 24px; border-radius: var(--swt-radius-size-normal); display: grid; place-items: center; color: var(--swt-color-accent-normal); background: color-mix(in srgb, var(--swt-color-accent-normal) 10%, var(--swt-color-bg-primary)); flex-shrink: 0; }
.nav-symbol.green { color: var(--swt-color-function-success-normal); background: color-mix(in srgb, var(--swt-color-function-success-normal) 12%, var(--swt-color-bg-primary)); }
.nav-symbol.purple { color: var(--swt-color-chart-A3); background: color-mix(in srgb, var(--swt-color-chart-A3) 12%, var(--swt-color-bg-primary)); }
.menu-label { white-space: nowrap; font-size: var(--swt-font-size-small); overflow: hidden; text-overflow: ellipsis; }
.favorite { padding: var(--swt-space-size-8); color: var(--swt-color-text-extra); }
.favorite:hover { color: var(--swt-color-accent-normal); }
.collapse-button { height: 44px; display: flex; align-items: center; gap: var(--swt-space-size-12); padding: 0 var(--swt-space-size-16); color: var(--swt-color-text-secondary); border-top: 1px solid var(--page-line); }
.empty { color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); padding: var(--swt-space-size-12); }
.main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.tabbar { display: flex; align-items: center; min-height: 48px; gap: var(--swt-space-size-8); border-bottom: 1px solid var(--page-line); padding: 0 var(--swt-space-size-8); }
.session-toggle { border-right: 1px solid var(--page-line); border-radius: 0; }
.tabs { display: flex; flex: 1; min-width: 0; overflow: auto; gap: var(--swt-space-size-8); scrollbar-width: thin; }
.tab { display: flex; align-items: center; flex: 0 1 245px; min-width: 150px; border-radius: var(--swt-radius-size-normal); color: var(--swt-color-text-secondary); }
.tab.active { background: var(--swt-color-overlay-gray1-and-accent-normal-opacity10); color: var(--swt-color-accent-text-normal); }
.tab > button:first-child { flex: 1; display: flex; align-items: center; gap: var(--swt-space-size-8); min-width: 0; padding: var(--swt-space-size-8) var(--swt-space-size-12); }
.tab.active > button:first-child { font-weight: var(--swt-font-weight-bold); }
.tab-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--swt-font-size-small); }
.status-dot { width: 8px; height: 8px; border: 1.5px solid var(--swt-color-function-prompt-normal); border-radius: var(--swt-radius-size-infinity); flex-shrink: 0; }
.status-dot.done { border-color: var(--swt-color-function-success-normal); background: color-mix(in srgb, var(--swt-color-function-success-normal) 15%, transparent); }
.status-dot.pending { border-color: var(--swt-color-function-warning-normal); }
.tab-close { padding: var(--swt-space-size-8); display: grid; }
.content { flex: 1; min-width: 0; min-height: 0; display: flex; overflow: hidden; position: relative; }
@media (max-width: 992px) { .workspace { display: none; } }
@media (max-width: 768px) { .nav-filters { display: none; } }
</style>
