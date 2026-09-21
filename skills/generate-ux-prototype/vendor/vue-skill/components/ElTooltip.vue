<script setup>
import { ElTooltip, ElButton } from 'element-plus'

defineOptions({ name: 'TooltipDemo' })
</script>

<template>
  <div class="demo-block">
    <ElTooltip content="这是文字提示说明" placement="top">
      <ElButton>悬停查看提示</ElButton>
    </ElTooltip>

    <ElTooltip content="图标操作说明" placement="top">
      <ElButton circle aria-label="操作" />
    </ElTooltip>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  gap: var(--space-size-16);
}
</style>
