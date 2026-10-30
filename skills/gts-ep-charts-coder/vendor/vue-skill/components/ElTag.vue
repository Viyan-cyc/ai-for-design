<script setup>
import { ref } from 'vue'
import { ElTag } from 'element-plus'

defineOptions({ name: 'TagDemo' })
</script>

<template>
  <div class="demo-block">
    <ElTag>默认标签</ElTag>
    <ElTag type="success">成功</ElTag>
    <ElTag type="warning">告警</ElTag>
    <ElTag type="danger">错误</ElTag>
    <ElTag type="info">空闲</ElTag>
    <ElTag closable>可关闭</ElTag>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  align-items: center;
  gap: var(--space-size-8);
}
</style>
