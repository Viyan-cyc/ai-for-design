<script setup>
// feedback-flow — 操作反馈流整页示例（全局消息 / 嵌入式消息 / 系统通知 / 确认与高危确认）
// 时长分档：提示/成功 5s、警告/错误 10s；通知最多同时 3 条、右上角距边 20px。
// 高危确认三原则：复选框默认不勾选、未确认禁用执行按钮、默认焦点置于取消按钮。
// 浮层（挂 body）的语义配色经 customClass + 本文件底部非 scoped 全局样式实现；
// 主题槽位接线进 bridge 是独立任务，当前为示例自实现口径（与 005 frost-material 相同路线）。
// EP 浮层组件仅 4 类型（success/warning/info/error）；告警/失效两组语义在嵌入式消息区补全演示。
// EP 通知组件无 max 参数（2.13.5 核验）——规范"最多同时 3 条"以队列守卫实现：超出先关最早一条。
import { ref, nextTick } from 'vue'
import { ElMessage, ElNotification, ElButton, ElCheckbox, ElIcon } from 'element-plus'
import {
  CircleCheckFilled,
  CircleCloseFilled,
  InfoFilled,
  WarningFilled,
} from '@element-plus/icons-vue'
import DangerDialog from './danger-dialog.vue'

defineOptions({ name: 'FeedbackFlowPage' })

const inlineVisible = ref(true)
const dangerOpen = ref(false)
const execResult = ref('')

const DUR = { prompt: 5000, success: 5000, warning: 10000, error: 10000 }

const MSG_DEFS = [
  { type: 'info', label: '提示', text: '草稿已保存（提示 5s 自动消失）' },
  { type: 'success', label: '成功', text: '配置下发成功（成功 5s 自动消失）' },
  { type: 'warning', label: '警告', text: '设备即将到达维保期限（警告 10s）' },
  { type: 'error', label: '错误', text: '下发失败：目标设备离线，请检查网络后重试（错误 10s）' },
]

const fireMessage = (def) => {
  ElMessage({
    type: def.type,
    message: def.text,
    offset: 20,
    duration: DUR[def.type],
    showClose: true,
    customClass: `gts-msg gts-msg-${def.type}`,
  })
}

const NOTIFY_DEFS = [
  { type: 'info', title: '巡检任务完成', text: '128 台设备巡检完成，生成报告已归档。' },
  { type: 'success', title: '备份成功', text: '数据库全量备份完成，耗时 3 分 12 秒。' },
  { type: 'warning', title: '容量告警', text: '存储池 usage 达 87%，建议扩容。' },
  { type: 'error', title: '同步失败', text: '节点 B 上报超时，已自动重试 2 次仍失败。' },
]

const notifyQueue = ref([])

const pushNotification = (opts) => {
  // 队列守卫：同时最多 3 条，超出先关最早一条（最新在顶由通知组件默认插入顺序保证）
  while (notifyQueue.value.length >= 3) {
    const oldest = notifyQueue.value.shift()
    oldest && oldest.close()
  }
  const handle = ElNotification(opts)
  notifyQueue.value.push(handle)
}

const fireNotification = (def) => {
  pushNotification({
    type: def.type,
    title: def.title,
    message: def.text,
    position: 'top-right',
    offset: 20,
    duration: DUR[def.type],
    customClass: `gts-notify gts-notify-${def.type}`,
  })
}

const burstNotifications = () => {
  for (let i = 0; i < 5; i++) {
    const def = NOTIFY_DEFS[i % NOTIFY_DEFS.length]
    pushNotification({
      type: def.type,
      title: `压力测试 ${i + 1}/5`,
      message: def.text,
      position: 'top-right',
      offset: 20,
      duration: DUR[def.type],
      customClass: `gts-notify gts-notify-${def.type}`,
    })
  }
}

const openDanger = () => {
  dangerOpen.value = true
  execResult.value = ''
}

const onDangerExecuted = async () => {
  dangerOpen.value = false
  execResult.value = '高危操作已执行，结果通过全局消息反馈'
  await nextTick()
  fireMessage(MSG_DEFS[3])
}

const SEVERITIES = [
  { key: 'error', label: '错误', text: '删除失败：资源被策略锁定，请解除锁定后重试。' },
  { key: 'alert', label: '告警', text: '链路抖动持续 5 分钟，已触发切换预案。' },
  { key: 'warning', label: '提醒', text: '当前浏览器版本较旧，部分功能受限。' },
  { key: 'success', label: '成功', text: '本区域配置已全部生效。' },
  { key: 'info', label: '信息', text: '系统将于 02:00–02:30 例行维护。' },
  { key: 'none', label: '失效', text: '该告警已随设备下线自动关闭。' },
]

const ICONS = {
  error: CircleCloseFilled,
  success: CircleCheckFilled,
  warning: WarningFilled,
  info: InfoFilled,
}
</script>

<template>
  <div class="feedback-flow-page">
    <header class="page-header">
      <h3 class="page-title">操作反馈流</h3>
      <p class="page-desc">
        用户操作的三层反馈：即时结果用全局消息；系统级持续提醒用通知；需要确认或风险告知用对话框。
        短暂消息不承载必须持续查阅的关键信息；错误信息必须说明可采取的后续动作。
      </p>
    </header>

    <section class="demo-section">
      <div class="section-head">
        <span class="section-title">全局消息</span>
        <span class="section-note-inline">页面顶部居中 · 距顶 20px · 提示/成功 5s · 警告/错误 10s</span>
      </div>
      <div class="btn-row">
        <ElButton
          v-for="def in MSG_DEFS"
          :key="def.type"
          size="small"
          @click="fireMessage(def)"
        >
          {{ def.label }}
        </ElButton>
      </div>
      <p class="section-note">
        EP 类型仅 info/success/warning/error 四类；showClose 提供手动关闭路径，
        有关闭图标时可配置超时消失或仅手动关闭。错误消息含原因与后续动作，不留只有颜色图标的提示。
      </p>
    </section>

    <section class="demo-section">
      <div class="section-head">
        <span class="section-title">嵌入式消息（6 组语义全对照）</span>
        <ElButton size="small" @click="inlineVisible = !inlineVisible">
          {{ inlineVisible ? '关闭消息（演示挤开内容）' : '恢复消息' }}
        </ElButton>
      </div>
      <div class="inline-zone">
        <div class="inline-placeholder">内容区域（消息出现时挤开本区域，不悬浮）</div>
        <div
          v-for="sev in SEVERITIES"
          v-show="inlineVisible"
          :key="sev.key"
          class="msg-inline"
          :data-severity="sev.key"
        >
          <ElIcon :size="16" class="msg-inline-icon">
            <component :is="ICONS[sev.key] || InfoFilled" />
          </ElIcon>
          <span class="msg-inline-text">{{ sev.text }}</span>
          <ElButton size="small" link class="msg-inline-close" @click="inlineVisible = false">
            关闭
          </ElButton>
        </div>
      </div>
      <p class="section-note">
        嵌入式消息仅作用于当前内容区：不自动消失、可手动关闭、不用阴影；
        边框 1px（border-width-normal）取 color-brand。告警（alert）与失效（none）
        两组语义 EP 浮层不提供，按规范在此补全——嵌入式区 6 组背景/图标色一一成对。
      </p>
    </section>

    <section class="demo-section">
      <div class="section-head">
        <span class="section-title">系统通知</span>
        <span class="section-note-inline">右上角 · 距边 20px · 最多同时 3 条 · 最新在顶</span>
      </div>
      <div class="btn-row">
        <ElButton
          v-for="def in NOTIFY_DEFS"
          :key="def.type"
          size="small"
          @click="fireNotification(def)"
        >
          {{ def.label }}
        </ElButton>
        <ElButton size="small" type="primary" plain @click="burstNotifications">
          连发 5 条（验证最多 3 条截断）
        </ElButton>
      </div>
      <p class="section-note">
        通知承载需要用户关注的异步结果（标题 + 说明）；超过 3 条以队列守卫截断，
        避免通知堆积挡住关键操作；不自动关闭的通知必须保留关闭入口。
      </p>
    </section>

    <section class="demo-section">
      <div class="section-head">
        <span class="section-title">确认与高危确认</span>
      </div>
      <div class="btn-row">
        <ElButton size="small" @click="execResult = '普通确认示例：ElMessageBox 或 L1 对话框均可承载'">
          普通确认（说明）
        </ElButton>
        <ElButton size="small" type="danger" plain @click="openDanger">高危确认（L1 对话框）</ElButton>
      </div>
      <p v-if="execResult" class="exec-result">{{ execResult }}</p>
      <p class="section-note">
        高危确认三原则：确认复选框默认不勾选；未确认前禁用执行按钮；对话框打开时默认焦点置于取消按钮。
        右上角关闭与取消等效；执行中按钮进入 loading，防重复触发。
      </p>
    </section>

    <DangerDialog v-model="dangerOpen" @executed="onDangerExecuted" />
  </div>
</template>

<style scoped lang="less">
.feedback-flow-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--space-size-24);
  display: flex;
  flex-direction: column;
  gap: var(--space-size-32);
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-8);
}

.page-title {
  margin: 0;
  font-size: var(--font-size-big);
  color: var(--color-text-primary);
  line-height: var(--font-line-height-normal);
}

.page-desc {
  margin: 0;
  max-width: 720px;
  font-size: var(--font-size-normal);
  color: var(--color-text-secondary);
  line-height: var(--font-line-height-normal);
}

.demo-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}

.section-head {
  display: flex;
  align-items: center;
  gap: var(--space-size-12);
}

.section-title {
  font-size: var(--font-size-medium);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.section-note-inline {
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
}

.section-note {
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  line-height: var(--font-line-height-normal);
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-size-12);
}

.inline-zone {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-8);
  padding: var(--space-size-16);
  border: 1px solid var(--color-border-separator-subtle);
  border-radius: var(--radius-size-medium);
}

.inline-placeholder {
  padding: var(--space-size-12) var(--space-size-16);
  border-radius: var(--radius-size-normal);
  background: var(--color-fill-subtle);
  color: var(--color-text-secondary);
  font-size: var(--font-size-small);
  text-align: center;
}

.msg-inline {
  display: flex;
  align-items: center;
  gap: var(--space-size-8);
  padding: var(--space-size-8) var(--space-size-16);
  border: var(--border-width-normal) solid var(--color-brand);
  border-radius: var(--radius-size-normal);
}

.msg-inline-icon {
  color: var(--color-info);
}

.msg-inline-text {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-small);
  color: var(--color-text-primary);
}

.msg-inline-close {
  flex-shrink: 0;
}

.msg-inline[data-severity='error'] { background: var(--color-error-subtle); .msg-inline-icon { color: var(--color-error); } }
.msg-inline[data-severity='alert'] { background: var(--color-alert-subtle); .msg-inline-icon { color: var(--color-alert); } }
.msg-inline[data-severity='warning'] { background: var(--color-warning-subtle); .msg-inline-icon { color: var(--color-warning); } }
.msg-inline[data-severity='success'] { background: var(--color-success-subtle); .msg-inline-icon { color: var(--color-success); } }
.msg-inline[data-severity='info'] { background: var(--color-info-subtle); .msg-inline-icon { color: var(--color-info); } }
.msg-inline[data-severity='none'] { background: var(--color-none-subtle); .msg-inline-icon { color: var(--color-none); } }

.exec-result {
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-text-primary);
}
</style>

<style lang="less">
/* 浮层（挂 body）语义映射：ElMessage / ElNotification 的 scoped 样式不可达，
   经 customClass + 全局样式实现；值全部引用主题 token，双主题自动跟随。 */
.gts-msg,
.gts-notify {
  border-radius: var(--radius-size-normal);
  box-shadow: var(--shadow-3);
}

.gts-msg {
  padding: var(--space-size-8) var(--space-size-16);
  border: none;

  .el-message__content {
    color: var(--color-text-primary);
  }

  .el-message__icon {
    color: var(--color-info);
  }
}

.gts-msg.gts-msg-success {
  background: var(--color-success-subtle);
  .el-message__icon { color: var(--color-success); }
}

.gts-msg.gts-msg-warning {
  background: var(--color-warning-subtle);
  .el-message__icon { color: var(--color-warning); }
}

.gts-msg.gts-msg-error {
  background: var(--color-error-subtle);
  .el-message__icon { color: var(--color-error); }
}

.gts-msg.gts-msg-info {
  background: var(--color-info-subtle);
  .el-message__icon { color: var(--color-info); }
}

.gts-notify {
  padding: var(--space-size-16);
  border: none;

  .el-notification__title {
    margin-bottom: var(--space-size-8);
    color: var(--color-text-primary);
  }

  .el-notification__content {
    color: var(--color-text-primary);
  }
}

.gts-notify.gts-notify-success {
  background: var(--color-success-subtle);
  .el-notification__icon { color: var(--color-success); }
}

.gts-notify.gts-notify-warning {
  background: var(--color-warning-subtle);
  .el-notification__icon { color: var(--color-warning); }
}

.gts-notify.gts-notify-error {
  background: var(--color-error-subtle);
  .el-notification__icon { color: var(--color-error); }
}

.gts-notify.gts-notify-info {
  background: var(--color-info-subtle);
  .el-notification__icon { color: var(--color-info); }
}
</style>
