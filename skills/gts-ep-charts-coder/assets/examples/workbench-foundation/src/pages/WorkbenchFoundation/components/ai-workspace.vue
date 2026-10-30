<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ElIcon, ElButton, ElTable, ElTableColumn, ElPagination, ElEmpty, ElAlert } from 'element-plus'
import { ArrowDown, ArrowUp, ArrowRight, CircleCheckFilled, DataAnalysis, Warning, Document, Close, MoreFilled, Connection } from '@element-plus/icons-vue'
import ConversationComposer from './conversation-composer.vue'
import { getEvidence, getReport, getDemoReply } from '../../../api/foundation.js'
const props=defineProps({session:Object})
const input=ref('')
const model=ref('qwen')
const busy=ref(false)
const messages=ref([])
const evidence=ref([])
const evidencePage=ref(1)
const evidencePageSize=5
const pagedEvidence=computed(()=>evidence.value.slice((evidencePage.value-1)*evidencePageSize,evidencePage.value*evidencePageSize))
const report=ref(null)
const error=ref('')
const analysisOpen=ref(true)
const resultOpen=ref(true)
const showEvidence=ref(true)
const selected=ref('query')
const conversation=ref(null)
const models=[{id:'qwen',label:'Qwen3.6-35B-A38'},{id:'deepseek',label:'DeepSeek-V3.2'},{id:'glm',label:'GLM-4.6-Plus'}]
const references=[{id:'alarm',label:'关联告警.json'},{id:'runbook',label:'应急处置手册.pdf'}]
const commands=[{id:'diagnose',label:'开始关联诊断',value:'请分析当前告警的关联关系'},{id:'summary',label:'总结当前会话',value:'请总结当前会话的结论与建议'}]
let timer
let generation=0
async function load(){try{[evidence.value,report.value]=await Promise.all([getEvidence(),getReport()]);error.value=''}catch{error.value='加载示例失败，请重试'}}
onMounted(load)
onUnmounted(()=>{clearTimeout(timer);generation++})
async function scrollBottom(){await nextTick();conversation.value?.scrollTo({top:conversation.value.scrollHeight,behavior:'smooth'})}
function send(payload){
 if(busy.value)return
 const text=payload.text||'请分析附件'
 messages.value.push({id:`u-${Date.now()}`,role:'user',text,files:payload.files.map(f=>f.name)})
 busy.value=true
 const id=++generation
 scrollBottom()
 timer=setTimeout(async()=>{
  try{const text=await getDemoReply(payload.text||'请分析附件');if(id===generation)messages.value.push({id:`a-${Date.now()}`,role:'assistant',text})}
  catch{if(id===generation)messages.value.push({id:`e-${Date.now()}`,role:'assistant',text:'演示回复失败，请重试。'})}
  finally{if(id===generation){busy.value=false;scrollBottom()}}
 },1800)
}
function stop(){clearTimeout(timer);generation++;busy.value=false;messages.value.push({id:`stop-${Date.now()}`,role:'assistant',text:'已停止生成。'});scrollBottom()}
function focusEvidence(id){selected.value=id;showEvidence.value=true}
</script>
<template>
 <section class="ai-workspace" :class="{'without-evidence':!showEvidence}">
  <div class="chat-pane">
   <header class="pane-header"><strong>{{session.title}}</strong><span class="round">轮次 {{session.id==='mail'?6+messages.filter(m=>m.role==='user').length:messages.filter(m=>m.role==='user').length}} / 100</span><button class="plain-icon" aria-label="切换关联面板" title="切换关联面板" @click="showEvidence=!showEvidence"><ElIcon :size="17"><Connection /></ElIcon></button></header>
   <ElAlert v-if="error" :title="error" type="error"><ElButton @click="load">重试</ElButton></ElAlert>
   <div ref="conversation" class="conversation">
    <template v-if="report && session.id==='mail'">
     <div class="user-message">{{report.question}}</div>
     <div class="thought"><ElIcon :size="16"><CircleCheckFilled /></ElIcon>已深度思考 · 2.3s<span class="demo-label">演示分析</span></div>
     <p class="intro">{{report.summary}}</p>
     <section class="analysis-card">
      <button class="card-heading" :aria-expanded="analysisOpen" @click="analysisOpen=!analysisOpen"><ElIcon :size="16"><DataAnalysis /></ElIcon><strong>告警分析</strong><ElIcon><ArrowUp v-if="analysisOpen"/><ArrowDown v-else/></ElIcon></button>
      <div v-if="analysisOpen" class="pipeline">
       <article v-for="step in report.steps" :key="step.id" class="step"><span class="step-marker"><ElIcon :size="22"><CircleCheckFilled /></ElIcon></span><div class="step-main"><div class="step-head"><strong>{{step.title}}</strong><span class="duration">耗时 {{step.time}}</span></div><p>{{step.text}}</p><button class="outline-action" :class="{chosen:selected===step.id}" @click="focusEvidence(step.id)"><ElIcon :size="13"><Document /></ElIcon>{{step.action}}</button></div></article>
      </div>
     </section>
     <section class="analysis-card result-card"><button class="card-heading" :aria-expanded="resultOpen" @click="resultOpen=!resultOpen"><ElIcon :size="16"><Warning /></ElIcon><strong>需重点关注的分析结论</strong><ElIcon><ArrowUp v-if="resultOpen"/><ArrowDown v-else/></ElIcon></button><div v-if="resultOpen" class="conclusion"><span class="eyebrow">潜在根因</span><h3>{{report.conclusion}}</h3><p>{{report.description}}</p></div></section>
    </template>
    <div v-else-if="!messages.length" class="welcome"><span class="welcome-mark"><ElIcon :size="28"><DataAnalysis /></ElIcon></span><h2>让问题更快得到解答</h2><p>描述当前现象，或引用文件作为分析上下文。</p><button class="outline-action" @click="input='请分析当前告警的关联关系'">分析关联告警 <ElIcon><ArrowRight /></ElIcon></button></div>
    <article v-for="message in messages" :key="message.id" :class="message.role==='user'?'user-message':'assistant-message'">{{message.text}}<div v-if="message.files?.length" class="message-files">{{message.files.join(' · ')}}</div></article>
    <p v-if="busy" class="generating">正在整理演示回复…</p>
   </div>
   <div class="composer-area"><ConversationComposer v-model="input" v-model:model="model" :models="models" :busy="busy" :references="references" :commands="commands" @send="send" @stop="stop" /></div>
  </div>
  <aside v-if="showEvidence" class="evidence-pane">
   <header class="pane-header"><span class="view-active">关联信息</span><span class="context-label">随对话同步的上下文</span><button class="plain-icon" aria-label="收起关联信息" @click="showEvidence=false"><ElIcon :size="16"><Close /></ElIcon></button></header>
   <div class="evidence-scroll">
    <section class="context-card"><div class="section-heading"><ElIcon :size="17"><Document /></ElIcon><h3>{{ selected==='clean'?'清洗后的关联告警':'关联告警信息' }}</h3><span class="small-badge">{{evidence.length}} 条</span></div><p class="context-summary">10:20:15 — 10:35:42 · 按业务异常时间窗口关联</p><ElTable stripe :data="pagedEvidence" size="small"><ElTableColumn prop="name" label="告警标题" min-width="160"/><ElTableColumn prop="level" label="级别" width="66"><template #default="scope"><span class="severity" :class="scope.row.level==='紧急'?'critical':'major'">{{scope.row.level}}</span></template></ElTableColumn><ElTableColumn prop="time" label="发生时间" width="90"/><ElTableColumn prop="device" label="设备" min-width="150" show-overflow-tooltip/></ElTable><div class="table-foot"><span>共 {{evidence.length}} 条</span><ElPagination v-model:current-page="evidencePage" :page-size="evidencePageSize" :total="evidence.length" :pager-count="5" layout="prev, pager, next" background small /></div></section>
    <section class="context-card"><div class="section-heading"><ElIcon :size="17"><Connection /></ElIcon><h3>业务影响链路</h3><span class="small-badge">关联路径</span></div><div class="dependency"><div v-for="(item,index) in ['设备供电异常','网络会话中断','邮件连接超时']" :key="item" class="dependency-item"><span class="dependency-dot" :class="{error:index===0}"/><strong>{{item}}</strong><small>{{['基础设施','网络层','应用层'][index]}}</small></div></div><p class="context-note">时间先后与依赖关系可用于辅助判断，不能单独证明因果。</p></section>
    <section v-if="report" class="context-card" :class="{'highlight-card':selected==='root'}"><div class="section-heading"><ElIcon :size="17"><CircleCheckFilled /></ElIcon><h3>建议核查事项</h3></div><ol class="recommendations"><li v-for="item in report.suggestions" :key="item">{{item}}</li></ol><div class="note">执行前，请结合真实设备日志与变更记录确认。</div></section>
    <div class="context-footer">独立辅助区域 · 可通过标题右侧按钮收起</div>
   </div>
  </aside>
 </section>
</template>
<style scoped lang="less">
.ai-workspace { --page-line: color-mix(in srgb,var(--color-brand) 11%,var(--color-bg-2)); --page-soft: color-mix(in srgb,var(--color-select) 24%,var(--color-bg-2)); display: flex; flex: 1; min-width: 0; min-height: 0; }
.chat-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--page-line); }
.pane-header { height: 48px; flex: 0 0 48px; display: flex; align-items: center; gap: var(--space-size-12); padding: 0 var(--space-size-16); border-bottom: 1px solid var(--page-line); box-sizing: border-box; background: var(--color-bg-2); }
.pane-header>strong { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: var(--font-size-normal); }.round { color: var(--color-brand); background: var(--page-soft); padding: 0 var(--space-size-8); border-radius: var(--radius-size-full); font-size: var(--font-size-small); white-space: nowrap; }
button { font: inherit; cursor: pointer; }.plain-icon { background: transparent; border: 0; color: var(--color-text-secondary); display: grid; place-items: center; padding: var(--space-size-4); }.plain-icon:hover { color: var(--color-brand); }button:focus-visible{outline:2px solid var(--color-brand);outline-offset:2px}
.conversation { flex: 1; min-height: 0; overflow: auto; padding: var(--space-size-20) 8% var(--space-size-24); }
.user-message { width: fit-content; max-width: 86%; margin: 0 0 var(--space-size-20) auto; background: linear-gradient(120deg,var(--color-brand-hover),var(--color-brand)); color: var(--color-text-inverse); border-radius: var(--radius-size-big1) var(--radius-size-big1) var(--radius-size-normal) var(--radius-size-big1); padding: var(--space-size-12) var(--space-size-16); box-shadow: var(--shadow-1); font-size: var(--font-size-normal); overflow-wrap: anywhere; }
.thought { display: flex; gap: var(--space-size-8); align-items: center; color: var(--color-text-secondary); font-size: var(--font-size-small); padding-bottom: var(--space-size-16); border-bottom: 1px solid var(--page-line); }.demo-label { margin-left: auto; color: var(--color-text-placeholder); }
.intro { margin: var(--space-size-16) 0; font-size: var(--font-size-small); color: var(--color-text-secondary); }
.analysis-card { border: 1px solid var(--page-line); border-radius: var(--radius-size-big); overflow: hidden; margin-bottom: var(--space-size-12); }
.card-heading { display: flex; align-items: center; width: 100%; gap: var(--space-size-8); background: var(--page-soft); border: 0; padding: var(--space-size-8) var(--space-size-12); color: var(--color-brand); font-size: var(--font-size-small); text-align: left; }.card-heading strong { flex: 1; }
.pipeline { padding: var(--space-size-20) var(--space-size-16); }
.step { display: flex; gap: var(--space-size-12); position: relative; padding-bottom: var(--space-size-24); }.step:last-child{padding-bottom:0}.step:not(:last-child)::before{content:'';position:absolute;left:10px;top:28px;bottom:var(--space-size-4);width:2px;background:color-mix(in srgb,var(--color-success) 38%,var(--color-bg-2))}
.step-marker { color: var(--color-success); height: 24px; flex-shrink: 0; }.step-main{min-width:0}.step-head{display:flex;align-items:center;gap:var(--space-size-12);flex-wrap:wrap}.step-head strong{font-weight:var(--font-weight-bold)}.duration{background:var(--color-fill);color:var(--color-text-secondary);font-size:var(--font-size-small);border-radius:var(--radius-size-full);padding:0 var(--space-size-8)}
.step p { font-size: var(--font-size-small); color: var(--color-text-secondary); margin: var(--space-size-12) 0; }
.outline-action { display: inline-flex; align-items: center; gap: var(--space-size-8); border: 1px solid var(--page-line); border-radius: var(--radius-size-medium); padding: var(--space-size-4) var(--space-size-12); background: var(--color-bg-2); color: var(--color-text-secondary); font-size: var(--font-size-small); }.outline-action:hover,.outline-action.chosen { color: var(--color-brand); border-color: var(--color-brand); background: var(--page-soft); }
.conclusion { padding: var(--space-size-16); }.eyebrow { color: var(--color-brand); font-size: var(--font-size-small); }.conclusion h3 { font-size: var(--font-size-normal); line-height: var(--font-line-height-normal1); margin: var(--space-size-8) 0; }.conclusion p { color: var(--color-text-secondary); font-size: var(--font-size-small); margin: 0; }
.composer-area { padding: var(--space-size-8) 8% var(--space-size-12); background: var(--color-bg-2); }
.evidence-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--page-soft); }.view-active{background:var(--color-select);color:var(--color-brand);font-weight:var(--font-weight-bold);font-size:var(--font-size-small);padding:var(--space-size-4) var(--space-size-12);border-radius:var(--radius-size-normal)}.context-label{flex:1;font-size:var(--font-size-small);color:var(--color-text-placeholder)}
.evidence-scroll { flex: 1; min-height: 0; overflow: auto; padding: var(--space-size-16); }.context-card{background:var(--color-bg-2);border:1px solid var(--page-line);border-radius:var(--radius-size-big);padding:var(--space-size-16);margin-bottom:var(--space-size-12)}.section-heading{display:flex;align-items:center;gap:var(--space-size-8)}.section-heading>.el-icon{color:var(--color-brand)}.section-heading h3{font-size:var(--font-size-normal);margin:0;flex:1}.small-badge{font-size:var(--font-size-small);color:var(--color-text-secondary);background:var(--color-fill);border-radius:var(--radius-size-full);padding:0 var(--space-size-8)}
.context-summary{font-size:var(--font-size-small);color:var(--color-text-secondary);background:var(--page-soft);padding:var(--space-size-8) var(--space-size-12);border-radius:var(--radius-size-normal);margin:var(--space-size-12) 0}.severity{font-size:var(--font-size-small);border-radius:var(--radius-size-normal);padding:0 var(--space-size-4);white-space:nowrap}.critical{color:var(--color-error);background:var(--color-error-subtler)}.major{color:var(--color-alert);background:var(--color-alert-subtler)}
.table-foot{display:flex;align-items:center;flex-wrap:wrap;gap:var(--space-size-16);justify-content:space-between;color:var(--color-text-placeholder);font-size:var(--font-size-small);margin-top:var(--space-size-16)}
.dependency{display:flex;margin:var(--space-size-24) 0;gap:var(--space-size-16)}.dependency-item{flex:1;min-width:0;position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-size-8)}.dependency-item:not(:last-child)::after{content:'';position:absolute;left:60%;right:-40%;top:7px;border-top:1px dashed var(--color-border)}.dependency-dot{width:14px;height:14px;border-radius:var(--radius-size-full);background:var(--color-info-primary-subtler);border:1px solid var(--color-brand);z-index:1}.dependency-dot.error{background:var(--color-error-subtler);border-color:var(--color-error)}.dependency-item strong{font-size:var(--font-size-small)}.dependency-item small{color:var(--color-text-secondary);font-size:var(--font-size-small)}
.context-note,.context-footer{color:var(--color-text-placeholder);font-size:var(--font-size-small)}.context-footer{text-align:center;padding:var(--space-size-12)}.recommendations{padding-left:var(--space-size-20);margin:var(--space-size-16) 0}.recommendations li{padding:var(--space-size-8) 0;font-size:var(--font-size-small)}.recommendations li::marker{color:var(--color-brand)}.note{background:var(--page-soft);font-size:var(--font-size-small);color:var(--color-text-secondary);padding:var(--space-size-12);border-radius:var(--radius-size-medium)}.highlight-card{border-color:var(--color-brand)}
.assistant-message{padding:var(--space-size-16) 0;overflow-wrap:anywhere}.message-files,.generating{font-size:var(--font-size-small)}.generating{color:var(--color-text-secondary)}.welcome{padding:var(--space-size-48) 0;text-align:center}.welcome-mark{color:var(--color-brand)}.welcome h2{font-size:var(--font-size-medium)}.welcome p{color:var(--color-text-secondary);font-size:var(--font-size-small)}
@media(max-width:1200px){.chat-pane{flex:1.2}.conversation{padding-left:var(--space-size-24);padding-right:var(--space-size-24)}.composer-area{padding-left:var(--space-size-20);padding-right:var(--space-size-20)}.context-label{visibility:hidden}}
@media(max-width:992px){.evidence-pane{position:absolute;inset:0;z-index:10}.chat-pane{border:0}}
</style>
