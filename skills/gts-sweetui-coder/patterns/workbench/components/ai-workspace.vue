<script setup>
const emit = defineEmits(['send', 'stop'])
import { ref, computed, onMounted, nextTick } from 'vue'
import { SweetButton, SweetIcon, SweetTable, SweetTableColumn, SweetPagination, SweetAlert, SweetTag } from '@hw-seq/sweet-ui-base'
import ConversationComposer from './foundation/conversation-composer.vue'
import { getEvidence, getReport } from '../api/workbench.js'
const props = defineProps({ session: Object, busy: Boolean })
const input = ref('')
const model = ref('qwen')
const busy = computed(() => props.busy)
const messages = ref([])
const evidence = ref([])
const evidencePage = ref(1)
const evidencePageSize = 5
const pagedEvidence = computed(() => evidence.value.slice((evidencePage.value - 1) * evidencePageSize, evidencePage.value * evidencePageSize))
const report = ref(null)
const error = ref('')
const analysisOpen = ref(true)
const resultOpen = ref(true)
const showEvidence = ref(true)
const selected = ref('query')
const conversation = ref(null)
const models = [{ id: 'qwen', label: 'Qwen3.6-35B-A38' }, { id: 'deepseek', label: 'DeepSeek-V3.2' }, { id: 'glm', label: 'GLM-4.6-Plus' }]
const references = [{ id: 'alarm', label: '关联告警.json' }, { id: 'runbook', label: '应急处置手册.pdf' }]
const commands = [{ id: 'diagnose', label: '开始关联诊断', value: '请分析当前告警的关联关系' }, { id: 'summary', label: '总结当前会话', value: '请总结当前会话的结论与建议' }]
async function load() {
  try {
    [evidence.value, report.value] = await Promise.all([getEvidence(), getReport()])
    error.value = ''
  } catch { error.value = '加载示例失败，请重试' }
}
onMounted(load)
async function scrollBottom() { await nextTick(); conversation.value?.scrollTo({ top: conversation.value.scrollHeight, behavior: 'smooth' }) }
function send(payload) {
  if (busy.value) return
  emit('send', payload)
  const text = payload.text || '请分析附件'
  messages.value.push({ id: `u-${Date.now()}`, role: 'user', text, files: payload.files.map(f => f.name) })
  scrollBottom()
}
function stop() { emit('stop') }
function focusEvidence(id) { selected.value = id; showEvidence.value = true }
const levelType = (level) => level === '紧急' ? 'danger' : 'warning'
</script>
<template>
 <section class="ai-workspace" :class="{ 'without-evidence': !showEvidence }">
  <div class="chat-pane">
   <header class="pane-header">
    <strong>{{ session.title }}</strong>
    <span class="round">轮次 {{ session.id === 'mail' ? 6 + messages.filter(m => m.role === 'user').length : messages.filter(m => m.role === 'user').length }} / 100</span>
    <SweetButton text :aria-label="'切换关联面板'" @click="showEvidence = !showEvidence"><SweetIcon icon-class="sweetui-icon-single-cell-connection-l" :size="17" /></SweetButton>
   </header>
   <SweetAlert v-if="error" type="error" :title="error" :closable="false"><SweetButton @click="load">重试</SweetButton></SweetAlert>
   <div ref="conversation" class="conversation">
    <template v-if="report && session.id === 'mail'">
     <div class="user-message">{{ report.question }}</div>
     <div class="thought"><SweetIcon icon-class="sweetui-icon-circle-check-l" :size="16" />已深度思考 · 2.3s<span class="demo-label">演示分析</span></div>
     <p class="intro">{{ report.summary }}</p>
     <section class="analysis-card">
      <button class="card-heading" :aria-expanded="analysisOpen" @click="analysisOpen = !analysisOpen">
       <SweetIcon icon-class="sweetui-icon-search-l" :size="16" /><strong>告警分析</strong>
       <SweetIcon :icon-class="analysisOpen ? 'sweetui-icon-arrow-up' : 'sweetui-icon-arrow-down'" />
      </button>
      <div v-if="analysisOpen" class="pipeline">
       <article v-for="step in report.steps" :key="step.id" class="step">
        <span class="step-marker"><SweetIcon icon-class="sweetui-icon-circle-check-l" :size="22" /></span>
        <div class="step-main">
         <div class="step-head"><strong>{{ step.title }}</strong><span class="duration">耗时 {{ step.time }}</span></div>
         <p>{{ step.text }}</p>
         <button class="outline-action" :class="{ chosen: selected === step.id }" @click="focusEvidence(step.id)">
          <SweetIcon icon-class="sweetui-icon-file-l" :size="13" />{{ step.action }}
         </button>
        </div>
       </article>
      </div>
     </section>
     <section class="analysis-card result-card">
      <button class="card-heading" :aria-expanded="resultOpen" @click="resultOpen = !resultOpen">
       <SweetIcon icon-class="sweetui-icon-circle-close-l" :size="16" /><strong>需重点关注的分析结论</strong>
       <SweetIcon :icon-class="resultOpen ? 'sweetui-icon-arrow-up' : 'sweetui-icon-arrow-down'" />
      </button>
      <div v-if="resultOpen" class="conclusion">
       <span class="eyebrow">潜在根因</span>
       <h3>{{ report.conclusion }}</h3>
       <p>{{ report.description }}</p>
      </div>
     </section>
    </template>
    <div v-else-if="!messages.length" class="welcome">
     <span class="welcome-mark"><SweetIcon icon-class="sweetui-icon-search-l" :size="28" /></span>
     <h2>让问题更快得到解答</h2>
     <p>描述当前现象，或引用文件作为分析上下文。</p>
     <button class="outline-action" @click="input = '请分析当前告警的关联关系'">分析关联告警 <SweetIcon icon-class="sweetui-icon-arrow-right" /></button>
    </div>
    <article v-for="message in messages" :key="message.id" :class="message.role === 'user' ? 'user-message' : 'assistant-message'">
     {{ message.text }}
     <div v-if="message.files?.length" class="message-files">{{ message.files.join(' · ') }}</div>
    </article>
    <p v-if="busy" class="generating">正在生成…</p>
   </div>
   <div class="composer-area"><ConversationComposer v-model="input" v-model:model="model" :models="models" :busy="busy" :references="references" :commands="commands" @send="send" @stop="stop" /></div>
  </div>
  <aside v-if="showEvidence" class="evidence-pane">
   <header class="pane-header">
    <span class="view-active">关联信息</span>
    <span class="context-label">随对话同步的上下文</span>
    <SweetButton text aria-label="收起关联信息" @click="showEvidence = false"><SweetIcon icon-class="sweetui-icon-close" :size="16" /></SweetButton>
   </header>
   <div class="evidence-scroll">
    <section class="context-card">
     <div class="section-heading"><SweetIcon icon-class="sweetui-icon-file-l" :size="17" /><h3>{{ selected === 'clean' ? '清洗后的关联告警' : '关联告警信息' }}</h3><span class="small-badge">{{ evidence.length }} 条</span></div>
     <p class="context-summary">10:20:15 — 10:35:42 · 按业务异常时间窗口关联</p>
     <SweetTable stripe :data="pagedEvidence" size="small">
      <SweetTableColumn prop="name" label="告警标题" min-width="160" />
      <SweetTableColumn prop="level" label="级别" width="80"><template #default="{ row }"><SweetTag :type="levelType(row.level)" size="small">{{ row.level }}</SweetTag></template></SweetTableColumn>
      <SweetTableColumn prop="time" label="发生时间" width="90" />
      <SweetTableColumn prop="device" label="设备" min-width="150" show-overflow-tooltip />
     </SweetTable>
     <div class="table-foot"><span>共 {{ evidence.length }} 条</span><SweetPagination v-model:current-page="evidencePage" :page-size="evidencePageSize" :total="evidence.length" :pager-count="5" layout="prev, pager, next" background small /></div>
    </section>
    <section class="context-card">
     <div class="section-heading"><SweetIcon icon-class="sweetui-icon-single-cell-connection-l" :size="17" /><h3>业务影响链路</h3><span class="small-badge">关联路径</span></div>
     <div class="dependency">
      <div v-for="(item, index) in ['设备供电异常', '网络会话中断', '邮件连接超时']" :key="item" class="dependency-item">
       <span class="dependency-dot" :class="{ error: index === 0 }" />
       <strong>{{ item }}</strong>
       <small>{{ ['基础设施', '网络层', '应用层'][index] }}</small>
      </div>
     </div>
     <p class="context-note">时间先后与依赖关系可用于辅助判断，不能单独证明因果。</p>
    </section>
    <section v-if="report" class="context-card" :class="{ 'highlight-card': selected === 'root' }">
     <div class="section-heading"><SweetIcon icon-class="sweetui-icon-circle-check-l" :size="17" /><h3>建议核查事项</h3></div>
     <ol class="recommendations"><li v-for="item in report.suggestions" :key="item">{{ item }}</li></ol>
     <div class="note">执行前，请结合真实设备日志与变更记录确认。</div>
    </section>
    <div class="context-footer">独立辅助区域 · 可通过标题右侧按钮收起</div>
   </div>
  </aside>
 </section>
</template>
<style scoped>
.ai-workspace { display: flex; flex: 1; min-width: 0; min-height: 0; --page-line: color-mix(in srgb, var(--swt-color-accent-normal) 11%, var(--swt-color-bg-primary)); --page-soft: color-mix(in srgb, var(--swt-color-overlay-gray1-and-accent-normal-opacity20) 30%, var(--swt-color-bg-primary)); }
.chat-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid var(--page-line); }
.pane-header { height: 48px; flex: 0 0 48px; display: flex; align-items: center; gap: var(--swt-space-size-12); padding: 0 var(--swt-space-size-16); border-bottom: 1px solid var(--page-line); box-sizing: border-box; background: var(--swt-color-bg-primary); }
.pane-header > strong { flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: var(--swt-font-size-normal); }
.round { color: var(--swt-color-accent-text-normal); background: var(--swt-color-overlay-gray1-and-accent-normal-opacity10); padding: 0 var(--swt-space-size-8); border-radius: var(--swt-radius-size-infinity); font-size: var(--swt-font-size-small); white-space: nowrap; }
button { font: inherit; cursor: pointer; }
button:focus-visible { outline: 2px solid var(--swt-color-accent-focus); outline-offset: 2px; }
.conversation { flex: 1; min-height: 0; overflow: auto; padding: var(--swt-space-size-20) 8% var(--swt-space-size-24); }
.user-message { width: fit-content; max-width: 86%; margin: 0 0 var(--swt-space-size-20) auto; background: linear-gradient(120deg, var(--swt-color-accent-hover), var(--swt-color-accent-normal)); color: var(--swt-color-white); border-radius: var(--swt-radius-size-big1) var(--swt-radius-size-big1) var(--swt-radius-size-normal) var(--swt-radius-size-big1); padding: var(--swt-space-size-12) var(--swt-space-size-16); box-shadow: var(--swt-shadow1); font-size: var(--swt-font-size-normal); overflow-wrap: anywhere; }
.thought { display: flex; gap: var(--swt-space-size-8); align-items: center; color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); padding-bottom: var(--swt-space-size-16); border-bottom: 1px solid var(--page-line); }
.demo-label { margin-left: auto; color: var(--swt-color-text-extra); }
.intro { margin: var(--swt-space-size-16) 0; font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); }
.analysis-card { border: 1px solid var(--page-line); border-radius: var(--swt-radius-size-big); overflow: hidden; margin-bottom: var(--swt-space-size-12); }
.card-heading { display: flex; align-items: center; width: 100%; gap: var(--swt-space-size-8); background: var(--page-soft); border: 0; padding: var(--swt-space-size-8) var(--swt-space-size-12); color: var(--swt-color-accent-text-normal); font-size: var(--swt-font-size-small); text-align: left; }
.card-heading strong { flex: 1; }
.pipeline { padding: var(--swt-space-size-20) var(--swt-space-size-16); }
.step { display: flex; gap: var(--swt-space-size-12); position: relative; padding-bottom: var(--swt-space-size-24); }
.step:last-child { padding-bottom: 0; }
.step:not(:last-child)::before { content: ''; position: absolute; left: 10px; top: 28px; bottom: var(--swt-space-size-4); width: 2px; background: color-mix(in srgb, var(--swt-color-function-success-normal) 38%, var(--swt-color-bg-primary)); }
.step-marker { color: var(--swt-color-function-success-normal); height: 24px; flex-shrink: 0; }
.step-main { min-width: 0; }
.step-head { display: flex; align-items: center; gap: var(--swt-space-size-12); flex-wrap: wrap; }
.step-head strong { font-weight: var(--swt-font-weight-bold); }
.duration { background: var(--swt-color-bg-secondary); color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); border-radius: var(--swt-radius-size-infinity); padding: 0 var(--swt-space-size-8); }
.step p { font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); margin: var(--swt-space-size-12) 0; }
.outline-action { display: inline-flex; align-items: center; gap: var(--swt-space-size-8); border: 1px solid var(--page-line); border-radius: var(--swt-radius-size-medium); padding: var(--swt-space-size-4) var(--swt-space-size-12); background: var(--swt-color-bg-primary); color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); }
.outline-action:hover, .outline-action.chosen { color: var(--swt-color-accent-text-normal); border-color: var(--swt-color-accent-normal); background: var(--swt-color-overlay-gray1-and-accent-normal-opacity10); }
.conclusion { padding: var(--swt-space-size-16); }
.eyebrow { color: var(--swt-color-accent-text-normal); font-size: var(--swt-font-size-small); }
.conclusion h3 { font-size: var(--swt-font-size-normal); line-height: var(--swt-font-line-height-normal1); margin: var(--swt-space-size-8) 0; }
.conclusion p { color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); margin: 0; }
.composer-area { padding: var(--swt-space-size-8) 8% var(--swt-space-size-12); background: var(--swt-color-bg-primary); }
.evidence-pane { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--page-soft); }
.view-active { background: var(--swt-color-overlay-gray1-and-accent-normal-opacity10); color: var(--swt-color-accent-text-normal); font-weight: var(--swt-font-weight-bold); font-size: var(--swt-font-size-small); padding: var(--swt-space-size-4) var(--swt-space-size-12); border-radius: var(--swt-radius-size-normal); }
.context-label { flex: 1; font-size: var(--swt-font-size-small); color: var(--swt-color-text-extra); }
.evidence-scroll { flex: 1; min-height: 0; overflow: auto; padding: var(--swt-space-size-16); }
.context-card { background: var(--swt-color-bg-primary); border: 1px solid var(--page-line); border-radius: var(--swt-radius-size-big); padding: var(--swt-space-size-16); margin-bottom: var(--swt-space-size-12); }
.section-heading { display: flex; align-items: center; gap: var(--swt-space-size-8); }
.section-heading > .sweet-icon { color: var(--swt-color-accent-normal); }
.section-heading h3 { font-size: var(--swt-font-size-normal); margin: 0; flex: 1; }
.small-badge { font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); background: var(--swt-color-bg-secondary); border-radius: var(--swt-radius-size-infinity); padding: 0 var(--swt-space-size-8); }
.context-summary { font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); background: var(--page-soft); padding: var(--swt-space-size-8) var(--swt-space-size-12); border-radius: var(--swt-radius-size-normal); margin: var(--swt-space-size-12) 0; }
.table-foot { display: flex; align-items: center; flex-wrap: wrap; gap: var(--swt-space-size-16); justify-content: space-between; color: var(--swt-color-text-extra); font-size: var(--swt-font-size-small); margin-top: var(--swt-space-size-16); }
.dependency { display: flex; margin: var(--swt-space-size-24) 0; gap: var(--swt-space-size-16); }
.dependency-item { flex: 1; min-width: 0; position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--swt-space-size-8); }
.dependency-item:not(:last-child)::after { content: ''; position: absolute; left: 60%; right: -40%; top: 7px; border-top: 1px dashed var(--swt-color-dividing-line-primary); }
.dependency-dot { width: 14px; height: 14px; border-radius: var(--swt-radius-size-infinity); background: var(--swt-color-overlay-gray1-and-accent-normal-opacity10); border: 1px solid var(--swt-color-accent-normal); z-index: 1; }
.dependency-dot.error { background: var(--swt-color-function-urgent-background); border-color: var(--swt-color-function-urgent-normal); }
.dependency-item strong { font-size: var(--swt-font-size-small); }
.dependency-item small { color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); }
.context-note, .context-footer { color: var(--swt-color-text-extra); font-size: var(--swt-font-size-small); }
.context-footer { text-align: center; padding: var(--swt-space-size-12); }
.recommendations { padding-left: var(--swt-space-size-20); margin: var(--swt-space-size-16) 0; }
.recommendations li { padding: var(--swt-space-size-8) 0; font-size: var(--swt-font-size-small); }
.recommendations li::marker { color: var(--swt-color-accent-normal); }
.note { background: var(--page-soft); font-size: var(--swt-font-size-small); color: var(--swt-color-text-secondary); padding: var(--swt-space-size-12); border-radius: var(--swt-radius-size-medium); }
.highlight-card { border-color: var(--swt-color-accent-normal); }
.assistant-message { padding: var(--swt-space-size-16) 0; overflow-wrap: anywhere; }
.message-files, .generating { font-size: var(--swt-font-size-small); }
.generating { color: var(--swt-color-text-secondary); }
.welcome { padding: var(--swt-space-size-48) 0; text-align: center; }
.welcome-mark { color: var(--swt-color-accent-normal); }
.welcome h2 { font-size: var(--swt-font-size-medium); }
.welcome p { color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); }
@media (max-width: 1200px) { .chat-pane { flex: 1.2; } .conversation { padding-left: var(--swt-space-size-24); padding-right: var(--swt-space-size-24); } .composer-area { padding-left: var(--swt-space-size-20); padding-right: var(--swt-space-size-20); } .context-label { visibility: hidden; } }
@media (max-width: 992px) { .evidence-pane { position: absolute; inset: 0; z-index: 10; } .chat-pane { border: 0; } }
</style>
