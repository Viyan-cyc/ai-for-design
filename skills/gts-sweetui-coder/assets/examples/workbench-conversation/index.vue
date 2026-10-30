<script setup>
import { ref, onUnmounted } from 'vue'
import { SweetButton } from '@hw-seq/sweet-ui-base'
import WorkbenchShell from './components/foundation/workbench-shell.vue'
import ConversationComposer from './components/foundation/conversation-composer.vue'
const tabs=ref([{id:'first',title:'工作区 1'}])
const active=ref('first')
const activeMenu=ref('assistant')
const sessions=ref(false)
const menus=[{id:'assistant',label:'助手',icon:'sweetui-icon-menu-l'}]
const models=[{id:'demo',label:'本地演示'}]
const states=ref({first:{draft:'',model:'demo',busy:false,notice:'',lastRequest:null}})
const timers=new Map()
let serial=1
function add(){const id='workspace-'+(++serial);tabs.value.push({id,title:'工作区 '+serial});states.value[id]={draft:'',model:'demo',busy:false,notice:'',lastRequest:null};active.value=id}
function stop(id){clearTimeout(timers.get(id));timers.delete(id);states.value[id].busy=false;states.value[id].notice='已停止演示任务'}
function close(id){const i=tabs.value.findIndex(x=>x.id===id);stop(id);tabs.value.splice(i,1);delete states.value[id];if(active.value===id)active.value=tabs.value[Math.min(i,tabs.value.length-1)]?.id||''}
function send(id,request){states.value[id].lastRequest=request;states.value[id].busy=true;states.value[id].notice='本地定时演示，不调用模型、不上传附件';timers.set(id,setTimeout(()=>{states.value[id].busy=false;states.value[id].notice='演示完成：'+request.text;timers.delete(id)},800))}
onUnmounted(()=>{for(const timer of timers.values())clearTimeout(timer)})
</script>
<template>
  <div class="page">
    <WorkbenchShell brand="工作台" workspace-name="本地交互演示" :menus="menus" :tabs="tabs" :active-tab="active" :active-menu="activeMenu" @select-menu="activeMenu=$event" @select-tab="active=$event" @close-tab="close" @new-tab="add" @sessions="sessions=!sessions">
      <aside v-if="sessions" class="sessions"><h2>当前工作区</h2><SweetButton v-for="tab in tabs" :key="tab.id" text @click="active=tab.id">{{ tab.title }}</SweetButton></aside>
      <section v-for="tab in tabs" v-show="active===tab.id" :key="tab.id" class="workspace">
        <div class="messages" aria-live="polite"><h1>{{ tab.title }}</h1><p>{{ states[tab.id].notice || '输入内容以体验布局与事件，不代表模型服务已接入。' }}</p></div>
        <ConversationComposer v-model="states[tab.id].draft" v-model:model="states[tab.id].model" :models="models" :busy="states[tab.id].busy" disclaimer="本地交互演示，不上传附件" @send="send(tab.id,$event)" @stop="stop(tab.id)" />
      </section>
      <div v-if="!tabs.length" class="empty"><SweetButton @click="add">新建工作区</SweetButton></div>
    </WorkbenchShell>
  </div>
</template>
<style scoped>
.page { height:100dvh; min-width:0; }
.workspace { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; padding:var(--swt-space-size-24); gap:var(--swt-space-size-16); }
.messages { flex:1; min-height:0; overflow:auto; overflow-wrap:anywhere; }
h1 { font-size:var(--swt-font-size-medium); } h2 { font-size:var(--swt-font-size-normal1); }
.sessions { width:180px; max-width:35%; overflow:auto; padding:var(--swt-space-size-12); background:var(--swt-color-bg-secondary); }
.empty { margin:auto; }
</style>
