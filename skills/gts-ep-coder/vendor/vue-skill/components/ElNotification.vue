<script setup>
import { ElNotification, ElButton } from 'element-plus'

defineOptions({ name: 'NotificationDemo' })

const showNotification = () => {
  ElNotification({
    title: '任务完成',
    message: '数据导出任务已完成',
    type: 'success',
    duration: 4500
  })
}
</script>

<template>
  <div class="demo-block">
    <ElButton type="primary" @click="showNotification">显示通知</ElButton>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
}
</style>
