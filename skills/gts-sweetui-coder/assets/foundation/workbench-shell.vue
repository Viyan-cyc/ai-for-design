<script setup>
import { ref, computed } from 'vue'
import { SweetInput, SweetButton, SweetIcon } from '@hw-seq/sweet-ui-base'
const props = defineProps({ brand:String, workspaceName:String, menus:{type:Array,default:()=>[]}, tabs:{type:Array,default:()=>[]}, activeMenu:String, activeTab:String, labels:{type:Object,default:()=>({})} })
const emit = defineEmits(['select-menu','select-tab','close-tab','new-tab','sessions'])
const expanded = ref(false)
const query = ref('')
const labels = computed(()=>({navigation:'主导航',toggle:'展开或收起导航',search:'搜索应用',empty:'暂无匹配应用',tabs:'工作区',close:'关闭',newTab:'新建工作区',sessions:'最近会话',...props.labels}))
const visibleMenus = computed(()=>props.menus.filter(m=>m.label.toLowerCase().includes(query.value.toLowerCase())))
</script>
<template>
  <div class="shell">
    <header class="topnav">
      <SweetButton text :aria-expanded="expanded" :aria-label="labels.toggle" @click="expanded=!expanded"><SweetIcon icon-class="sweetui-icon-menu-l" :size="18" /></SweetButton>
      <span class="brand">{{ brand }}</span><span class="workspace">{{ workspaceName }}</span>
      <div class="tools"><slot name="tools" /></div>
    </header>
    <div class="body">
      <aside class="navigation" :class="{expanded}" :aria-label="labels.navigation">
        <div v-if="expanded" class="search"><SweetInput v-model="query" clearable :placeholder="labels.search" :aria-label="labels.search" /></div>
        <nav class="menu-list">
          <button v-for="item in visibleMenus" :key="item.id" type="button" class="menu" :class="{selected:activeMenu===item.id}" :title="item.label" :aria-label="item.label" :aria-current="activeMenu===item.id?'page':undefined" @click="emit('select-menu',item.id)">
            <SweetIcon v-if="item.icon" :icon-class="item.icon" :size="18" /><span v-else class="initial">{{ item.label.slice(0,1) }}</span><span v-if="expanded" class="menu-label">{{ item.label }}</span>
          </button>
          <p v-if="expanded&&!visibleMenus.length" class="empty">{{ labels.empty }}</p>
        </nav>
      </aside>
      <main class="main">
        <div class="tabbar">
          <SweetButton text :aria-label="labels.sessions" @click="emit('sessions')"><SweetIcon icon-class="sweetui-icon-nav-fold" /></SweetButton>
          <nav class="tabs" :aria-label="labels.tabs">
            <div v-for="tab in tabs" :key="tab.id" class="tab" :class="{active:activeTab===tab.id}">
              <button type="button" :aria-current="activeTab===tab.id?'page':undefined" :title="tab.title" @click="emit('select-tab',tab.id)">{{ tab.title }}</button>
              <SweetButton v-if="tab.closable!==false" text :aria-label="labels.close+' '+tab.title" @click="emit('close-tab',tab.id)"><SweetIcon icon-class="sweetui-icon-close" /></SweetButton>
            </div>
          </nav>
          <SweetButton text :aria-label="labels.newTab" @click="emit('new-tab')"><SweetIcon icon-class="sweetui-icon-add-l" /></SweetButton>
        </div>
        <div class="content"><slot /></div>
      </main>
    </div>
  </div>
</template>
<style scoped>
.shell { height:100%; min-height:0; min-width:0; display:flex; flex-direction:column; background:var(--swt-color-bg-primary); color:var(--swt-color-text-primary); --page-line:color-mix(in srgb,var(--swt-color-text-secondary) 20%,var(--swt-color-bg-primary)); }
.topnav { min-height:48px; display:flex; gap:var(--swt-space-size-12); align-items:center; padding:var(--swt-space-size-4) var(--swt-space-size-16); border-bottom:1px solid var(--page-line); }
.brand { font-size:var(--swt-font-size-normal1); font-weight:var(--swt-font-weight-bold); }
.workspace { font-size:var(--swt-font-size-small); color:var(--swt-color-text-secondary); }
.tools { margin-left:auto; display:flex; gap:var(--swt-space-size-8); }
.body { flex:1; min-height:0; display:flex; }
.navigation { width:56px; flex-shrink:0; border-right:1px solid var(--page-line); display:flex; flex-direction:column; min-height:0; }
.navigation.expanded { width:216px; max-width:45%; }
.search { padding:var(--swt-space-size-12); }
.menu-list { overflow:auto; padding:var(--swt-space-size-8); }
.menu { display:flex; align-items:center; width:100%; gap:var(--swt-space-size-12); min-height:40px; padding:var(--swt-space-size-8); text-align:left; border-radius:var(--swt-radius-size-normal); }
button { cursor:pointer; font:inherit; color:inherit; background:transparent; border:0; }
button:focus-visible { outline:2px solid var(--swt-color-accent-focus); outline-offset:-2px; }
.menu.selected,.tab.active { color:var(--swt-color-accent-text-normal); background:var(--swt-color-overlay-gray1-and-accent-normal-opacity10); }
.menu-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.initial { min-width:18px; }
.empty { color:var(--swt-color-text-secondary); font-size:var(--swt-font-size-small); }
.main { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; }
.tabbar { display:flex; align-items:center; min-height:48px; gap:var(--swt-space-size-8); border-bottom:1px solid var(--page-line); padding:0 var(--swt-space-size-8); }
.tabs { display:flex; flex:1; min-width:0; overflow:auto; gap:var(--swt-space-size-8); }
.tab { display:flex; align-items:center; min-width:120px; max-width:240px; border-radius:var(--swt-radius-size-normal); }
.tab>button:first-child { padding:var(--swt-space-size-8); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.content { flex:1; min-width:0; min-height:0; display:flex; overflow:hidden; }
@media(max-width:768px) { .workspace { display:none; } }
</style>
