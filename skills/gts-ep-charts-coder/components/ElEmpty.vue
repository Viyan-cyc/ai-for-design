<script setup>
import { ElEmpty } from 'element-plus'

defineOptions({ name: 'EmptyDemo' })
</script>

<template>
  <div class="demo-block">
    <ElEmpty description="暂无数据" />
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  justify-content: center;
  padding: var(--space-size-32) 0;
}
</style>
