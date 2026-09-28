<script setup>
import { getCurrentInstance } from 'vue'

defineOptions({ name: 'MessageFeedback' })

// 命令式 API 经 proxy 取用（不需 import；code-rules 规则 2.1）
const proxy = getCurrentInstance().proxy
const { $msgbox, $alert, $confirm, $prompt, $sweetNotify } = proxy

// 消息（操作结果即时反馈，用 sweet-message / $message）
const showMessage = () => {
  proxy.$message.success('操作成功')
}

// 通知（系统级提醒，4 种快捷方法 success/warning/info/error）
const showNotification = () => {
  $sweetNotify({
    title: '提示',
    message: '这是一条通知消息',
    type: 'success',
  })
}

// 确认框（Promise 返回，与 EP 一致）
const showConfirm = async () => {
  try {
    await $confirm('确定要执行此操作吗？', '提示', { type: 'warning' })
    showMessage()
  } catch {
    // 用户取消，不需提示
  }
}

// 警告框
const showAlert = () => {
  $alert('内容已更新', '提示')
}
</script>

<template>
  <div class="message-feedback">
    <div class="trigger-row">
      <sweet-button @click="showMessage">消息</sweet-button>
      <sweet-button @click="showNotification">通知</sweet-button>
      <sweet-button @click="showConfirm">确认框</sweet-button>
      <sweet-button @click="showAlert">警告框</sweet-button>
    </div>
  </div>
</template>

<style scoped lang="less">
.trigger-row {
  display: flex;
  gap: var(--space-size-8);
  padding: var(--space-size-20);
}
</style>
