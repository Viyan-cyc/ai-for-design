<script setup>
import { ElButton } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

defineOptions({ name: 'ButtonDemo' })
</script>

<template>
  <div class="demo-block">
    <div class="demo-row">
      <ElButton type="primary">主要按钮</ElButton>
      <ElButton>次要按钮</ElButton>
      <ElButton text>文本按钮</ElButton>
      <ElButton type="danger">告警按钮</ElButton>
    </div>

    <div class="demo-row">
      <ElButton type="primary" loading>加载中</ElButton>
      <ElButton disabled>禁用状态</ElButton>
      <ElButton type="primary" :icon="Search" circle aria-label="搜索" />
    </div>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}

.demo-row {
  display: flex;
  align-items: center;
  gap: var(--space-size-16);
}
</style>
