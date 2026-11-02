<script setup>
import { ref } from 'vue'
import {
  ElRow, ElCol, ElContainer, ElHeader, ElAside, ElMain, ElCard
} from 'element-plus'

defineOptions({ name: 'LayoutDemo' })

const gutter = ref(16)
</script>

<template>
  <div class="demo-block">
    <ElRow :gutter="gutter">
      <ElCol :span="8">
        <ElCard shadow="never" class="grid-card">span=8</ElCard>
      </ElCol>
      <ElCol :span="8" :offset="4">
        <ElCard shadow="never" class="grid-card">span=8 offset=4</ElCard>
      </ElCol>
    </ElRow>

    <ElContainer class="page-frame">
      <ElAside width="200px" class="frame-aside">侧边栏</ElAside>
      <ElContainer>
        <ElHeader class="frame-header">顶部</ElHeader>
        <ElMain class="frame-main">主内容</ElMain>
      </ElContainer>
    </ElContainer>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}

.grid-card {
  text-align: center;
  border: 1px solid var(--color-border-separator);
  border-radius: var(--radius-size-normal);
}

.page-frame {
  height: 240px;
  border: 1px solid var(--color-border-separator);
  border-radius: var(--radius-size-normal);
  overflow: hidden;
}

.frame-aside {
  background: var(--color-bg-2);
  color: var(--color-text-secondary);
}

.frame-header {
  background: var(--color-bg-4);
  color: var(--color-text-primary);
}

.frame-main {
  background: var(--color-bg-1);
}
</style>
