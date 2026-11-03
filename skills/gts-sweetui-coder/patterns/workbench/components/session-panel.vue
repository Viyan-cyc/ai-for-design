<script setup>
import { ref, onMounted, computed } from 'vue'
import { SweetButton, SweetIcon, SweetInput, SweetEmpty } from '@hw-seq/sweet-ui-base'
import { getSessions } from '../api/workbench.js'
defineProps({ business: Boolean })
defineEmits(['close', 'open', 'new'])
const sessions = ref([])
const query = ref('')
const error = ref('')
const filtered = computed(() => sessions.value.filter(x => x.title.includes(query.value)))
async function load() {
  try { sessions.value = await getSessions(); error.value = '' }
  catch { error.value = '会话加载失败' }
}
onMounted(load)
</script>
<template>
  <aside class="panel">
   <header><strong>{{ business ? '工作区入口' : '最近会话' }}</strong><SweetButton text :aria-label="'关闭面板'" @click="$emit('close')"><SweetIcon icon-class="sweetui-icon-close" /></SweetButton></header>
   <div class="controls">
    <SweetButton type="primary" size="small" class="new-btn" @click="$emit('new')"><SweetIcon icon-class="sweetui-icon-plus" :size="14" />{{ business ? '新建查询页' : '新建会话' }}</SweetButton>
    <SweetInput v-if="!business" v-model="query" placeholder="搜索会话" aria-label="搜索会话" size="small" clearable><template #prefix><SweetIcon icon-class="sweetui-icon-search-l" :size="14" /></template></SweetInput>
   </div>
  <div v-if="error" class="panel-error">{{ error }}<SweetButton @click="load">重试</SweetButton></div>
  <template v-if="!business">
   <button v-for="item in filtered" :key="item.id" class="session" @click="$emit('open', item)">
    <SweetIcon icon-class="sweetui-icon-file-l" :size="18" />
    <span><strong>{{ item.title }}</strong><small>{{ item.time }} · {{ item.status }}</small></span>
   </button>
   <SweetEmpty v-if="!filtered.length" description="暂无匹配会话" />
  </template>
  <p class="foot">{{ business ? '同一骨架，可装配不同业务内容。' : '演示会话 · 不连接生产数据' }}</p>
 </aside>
</template>
<style scoped>
.panel { position: absolute; left: 0; top: 0; bottom: 0; width: 336px; max-width: 100%; z-index: 20; background: var(--swt-color-bg-primary); border-right: 1px solid var(--swt-color-dividing-line-secondary); box-shadow: var(--swt-shadow3); padding: var(--swt-space-size-16) var(--swt-space-size-16) var(--swt-space-size-20); box-sizing: border-box; overflow: auto; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--swt-space-size-12); }
header strong { font-size: var(--swt-font-size-normal); }
.controls { display: flex; flex-direction: column; gap: var(--swt-space-size-8); margin-bottom: var(--swt-space-size-12); }
.new-btn { width: 100%; }
.session { font: inherit; cursor: pointer; border: 0; background: transparent; color: inherit; display: flex; gap: var(--swt-space-size-12); text-align: left; width: 100%; padding: var(--swt-space-size-16) var(--swt-space-size-8); border-bottom: 1px solid var(--swt-color-dividing-line-secondary); }
.session:focus-visible { outline: 2px solid var(--swt-color-accent-focus); outline-offset: 2px; }
.session:hover { background: var(--swt-color-overlay-gray1-and-accent-normal-opacity10); }
.session strong { font-size: var(--swt-font-size-small); }
small { display: block; color: var(--swt-color-text-secondary); margin-top: var(--swt-space-size-4); }
.foot { font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); margin-top: var(--swt-space-size-24); }
.panel-error { color: var(--swt-color-function-urgent-normal); font-size: var(--swt-font-size-small); margin-bottom: var(--swt-space-size-12); }
</style>
