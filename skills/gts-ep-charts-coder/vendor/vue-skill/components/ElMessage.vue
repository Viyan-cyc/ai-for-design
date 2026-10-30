<script setup>
import { ElMessage, ElButton } from 'element-plus'

defineOptions({ name: 'MessageDemo' })

const showSuccess = () => {
  ElMessage.success('保存成功')
}

const showError = () => {
  ElMessage.error('查询失败')
}

const showInfo = () => {
  ElMessage.info('已刷新')
}

const showWarning = () => {
  ElMessage.warning('请先选择数据')
}
</script>

<template>
  <div class="demo-block">
    <ElButton @click="showSuccess">成功</ElButton>
    <ElButton @click="showError">失败</ElButton>
    <ElButton @click="showInfo">信息</ElButton>
    <ElButton @click="showWarning">警告</ElButton>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  gap: var(--space-size-16);
}
</style>
