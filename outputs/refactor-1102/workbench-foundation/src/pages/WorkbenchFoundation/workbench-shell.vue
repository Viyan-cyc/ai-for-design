<script setup>
import { ref, computed } from 'vue'
import { ElIcon, ElTooltip, ElInput } from 'element-plus'
import { Menu, ArrowLeft, ArrowRight, Close, Plus, Fold, Search, Star, StarFilled, Monitor } from '@element-plus/icons-vue'
const props = defineProps({ brand: String, workspaceName: String, menus: Array, tabs: Array, activeTab: String, activeMenu: String })
const emit = defineEmits(['select-menu','select-tab','close-tab','new-tab','sessions'])
const expanded = ref(false)
const query = ref('')
const favoritesOnly = ref(false)
const favorites = ref([])
const visibleMenus = computed(() => props.menus.filter(m => m.label.includes(query.value) && (!favoritesOnly.value || favorites.value.includes(m.id))))
function favorite(id) { favorites.value = favorites.value.includes(id) ? favorites.value.filter(x => x !== id) : [...favorites.value, id] }
</script>
<template>
  <div class="shell">
    <header class="topnav">
      <button class="icon-button" :aria-expanded="expanded" aria-label="切换主导航" @click="expanded = !expanded"><ElIcon :size="18"><Menu /></ElIcon></button>
      <span class="brand">{{ brand }}</span>
      <span class="product"><ElIcon :size="15"><Monitor /></ElIcon>{{ workspaceName }}</span>
      <div class="top-tools"><slot name="tools" /></div>
    </header>
    <div class="body">
      <aside class="navigation" :class="{ expanded }" aria-label="主导航">
        <div v-if="expanded" class="nav-search"><div class="nav-filters"><button :class="{ selected: !favoritesOnly }" @click="favoritesOnly = false">全部应用</button><button :class="{ selected: favoritesOnly }" @click="favoritesOnly = true">我的收藏</button></div><ElInput v-model="query" :prefix-icon="Search" placeholder="搜索应用" aria-label="搜索应用" clearable /></div>
        <nav class="nav-list">
          <div v-for="item in visibleMenus" :key="item.id" class="nav-row" :class="{ current: activeMenu === item.id }">
            <ElTooltip :content="item.label" placement="right" :disabled="expanded"><button class="nav-action" :aria-label="item.label" :aria-current="activeMenu === item.id ? 'page' : undefined" @click="emit('select-menu', item.id)"><span class="nav-symbol" :class="item.tone"><ElIcon :size="18"><component :is="item.icon" /></ElIcon></span><span v-if="expanded" class="nav-label">{{ item.label }}</span></button></ElTooltip>
            <button v-if="expanded" class="favorite" :aria-label="`${favorites.includes(item.id) ? '取消收藏' : '收藏'}${item.label}`" @click="favorite(item.id)"><ElIcon :size="14"><StarFilled v-if="favorites.includes(item.id)" /><Star v-else /></ElIcon></button>
          </div>
          <p v-if="expanded && !visibleMenus.length" class="empty">暂无匹配应用</p>
        </nav>
        <button class="collapse-button" :aria-label="expanded ? '收起导航' : '展开导航'" @click="expanded = !expanded"><ElIcon :size="16"><ArrowLeft v-if="expanded" /><ArrowRight v-else /></ElIcon><span v-if="expanded">收起导航</span></button>
      </aside>
      <main class="main">
        <div class="tabbar">
          <button class="session-toggle icon-button" aria-label="最近会话面板" @click="emit('sessions')"><ElIcon :size="17"><Fold /></ElIcon></button>
          <div class="tabs" role="tablist" aria-label="工作区页签">
            <div v-for="tab in tabs" :key="tab.id" class="tab" :class="{ active: activeTab === tab.id }">
              <button role="tab" :aria-selected="activeTab === tab.id" :title="tab.title" @click="emit('select-tab', tab.id)"><span class="status-dot" :class="tab.status" /><span class="tab-title">{{ tab.title }}</span></button>
              <button v-if="tab.closable !== false" class="tab-close" :aria-label="`关闭${tab.title}`" @click="emit('close-tab', tab.id)"><ElIcon :size="13"><Close /></ElIcon></button>
            </div>
          </div>
          <button class="icon-button" aria-label="新建工作区" @click="emit('new-tab')"><ElIcon :size="17"><Plus /></ElIcon></button>
        </div>
        <div class="content"><slot /></div>
      </main>
    </div>
  </div>
</template>
<style scoped lang="less">
.shell { --page-line: color-mix(in srgb, var(--color-brand) 10%, var(--color-bg-2)); height: 100%; display: flex; flex-direction: column; background: var(--color-bg-2); color: var(--color-text-primary); }
button { font: inherit; color: inherit; border: 0; background: transparent; cursor: pointer; }
button:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
.topnav { height: 48px; flex: 0 0 48px; display: flex; align-items: center; gap: var(--space-size-12); border-bottom: 1px solid var(--page-line); padding: 0 var(--space-size-16) 0 var(--space-size-8); }
.icon-button { width: 32px; height: 32px; max-width: 100%; display: grid; place-items: center; color: var(--color-text-secondary); border-radius: var(--radius-size-medium); flex-shrink: 0; }
.icon-button:hover { background: var(--color-hover); color: var(--color-brand); }
.brand { font-size: var(--font-size-medium); font-weight: var(--font-weight-bold); color: var(--color-brand); letter-spacing: .3px; }
.product { display: flex; gap: var(--space-size-8); align-items: center; border-radius: var(--radius-size-normal); background: var(--color-fill); padding: var(--space-size-4) var(--space-size-12); font-size: var(--font-size-small); font-weight: var(--font-weight-bold); color: var(--color-brand); }
.top-tools { display: flex; align-items: center; margin-left: auto; gap: var(--space-size-12); }
.body { flex: 1; display: flex; min-height: 0; }
.navigation { width: 48px; max-width: 100%; flex-shrink: 0; border-right: 1px solid var(--page-line); display: flex; flex-direction: column; padding-top: var(--space-size-8); }
.navigation.expanded { width: 216px; }
.nav-list { overflow: auto; flex: 1; }
.nav-row { display: flex; align-items: center; border-radius: var(--radius-size-normal); margin: 0 var(--space-size-4) var(--space-size-8); }
.nav-row.current { background: color-mix(in srgb, var(--color-select) 65%, var(--color-bg-2)); }
.nav-action { height: 40px; flex: 1; display: flex; align-items: center; gap: var(--space-size-12); padding: 0 var(--space-size-8); min-width: 0; }
.nav-symbol { width: 24px; height: 24px; max-width: 100%; border-radius: var(--radius-size-normal); display: grid; place-items: center; color: var(--color-brand); background: color-mix(in srgb, var(--color-brand) 10%, var(--color-bg-2)); }
.nav-symbol.green { color: var(--color-success); background: color-mix(in srgb, var(--color-success) 12%, var(--color-bg-2)); }.nav-symbol.purple { color: var(--color-chart-3); background: color-mix(in srgb, var(--color-chart-3) 12%, var(--color-bg-2)); }
.nav-label { white-space: nowrap; font-size: var(--font-size-small); }
.favorite { padding: var(--space-size-8); color: var(--color-text-placeholder); }
.favorite:hover { color: var(--color-brand); }
.nav-search { padding: var(--space-size-8) var(--space-size-12) var(--space-size-16); }
.nav-filters { display: flex; gap: var(--space-size-12); margin-bottom: var(--space-size-12); font-size: var(--font-size-small); }.nav-filters .selected { color: var(--color-brand); }
.collapse-button { height: 44px; display: flex; align-items: center; gap: var(--space-size-12); padding: 0 var(--space-size-16); color: var(--color-text-secondary); border-top: 1px solid var(--page-line); }
.empty { padding: var(--space-size-12); color: var(--color-text-secondary); font-size: var(--font-size-small); }
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.tabbar { display: flex; align-items: center; gap: var(--space-size-8); height: 48px; flex: 0 0 48px; padding: 0 var(--space-size-8); border-bottom: 1px solid var(--page-line); }
.session-toggle { border-right: 1px solid var(--page-line); border-radius: 0; }
.tabs { flex: 1; display: flex; gap: var(--space-size-8); overflow: auto; min-width: 0; scrollbar-width: thin; }
.tab { display: flex; align-items: center; flex: 0 1 245px; min-width: 150px; border-radius: var(--radius-size-normal); color: var(--color-text-secondary); }
.tab.active { background: var(--color-fill); color: var(--color-brand); }
.tab > button:first-child { flex: 1; display: flex; align-items: center; gap: var(--space-size-8); min-width: 0; padding: var(--space-size-8) var(--space-size-12); }
.tab.active > button:first-child { font-weight: var(--font-weight-bold); }
.tab-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-size-small); }
.status-dot { width: 8px; height: 8px; border: 1.5px solid var(--color-info); border-radius: var(--radius-size-full); flex-shrink: 0; }.status-dot.done { border-color: var(--color-success); background: color-mix(in srgb, var(--color-success) 15%, transparent); }.status-dot.pending { border-color: var(--color-alert); }
.tab-close { padding: var(--space-size-8); display: grid; color: var(--color-text-placeholder); }.tab-close:hover { color: var(--color-text-primary); }
.content { flex: 1; min-height: 0; position: relative; display: flex; }
@media(max-width: 768px) { .product { display: none; } }
</style>
