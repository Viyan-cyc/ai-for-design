<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElButton, ElInput, ElIcon, ElEmpty } from 'element-plus'
import { Close, Search, Plus, ChatDotRound } from '@element-plus/icons-vue'
import { getSessions } from '../../../api/foundation.js'
defineProps({business:Boolean})
defineEmits(['close','open','new'])
const sessions=ref([])
const query=ref('')
const error=ref('')
const filtered=computed(()=>sessions.value.filter(x=>x.title.includes(query.value)))
async function load(){try{sessions.value=await getSessions();error.value=''}catch{error.value='会话加载失败'}}
onMounted(load)
</script>
<template><aside class="panel"><header><strong>{{ business?'工作区入口':'最近会话' }}</strong><ElButton text :icon="Close" aria-label="关闭会话面板" @click="$emit('close')" /></header><div class="controls"><ElButton type="primary" :icon="Plus" @click="$emit('new')">{{ business?'新建查询页':'新建会话' }}</ElButton><ElInput v-if="!business" v-model="query" :prefix-icon="Search" placeholder="搜索会话" aria-label="搜索会话" clearable /></div><div v-if="error">{{error}}<ElButton @click="load">重试</ElButton></div><template v-if="!business"><button v-for="item in filtered" :key="item.id" class="session" @click="$emit('open',item)"><ElIcon :size="18"><ChatDotRound /></ElIcon><span><strong>{{ item.title }}</strong><small>{{item.time}} · {{item.status}}</small></span></button><ElEmpty v-if="!filtered.length" description="暂无匹配会话" :image-size="60" /></template><p class="foot">{{ business?'同一骨架，可装配不同业务内容。':'演示会话 · 不连接生产数据' }}</p></aside></template>
<style scoped lang="less">
.panel { position: absolute; left: 0; top: 0; bottom: 0; width: 336px; max-width: 100%; z-index: 20; background: var(--color-bg-3); border-right: 1px solid var(--color-border-separator-subtle); box-shadow: var(--shadow-1); padding: var(--space-size-20); box-sizing: border-box; overflow: auto; }
header{display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-size-20)}.controls{display:flex;flex-direction:column;gap:var(--space-size-12);margin-bottom:var(--space-size-20)}
.session{display:flex;gap:var(--space-size-12);text-align:left;width:100%;padding:var(--space-size-16) var(--space-size-8);background:transparent;color:var(--color-text-primary);border:0;border-bottom:1px solid var(--color-border-separator-subtle);cursor:pointer;font:inherit}.session:hover{background:var(--color-select)}.session .el-icon{color:var(--color-brand)}.session strong{font-size:var(--font-size-small)}small{display:block;color:var(--color-text-secondary);margin-top:var(--space-size-4)}.foot{font-size:var(--font-size-small);color:var(--color-text-secondary);margin-top:var(--space-size-24)}
</style>
