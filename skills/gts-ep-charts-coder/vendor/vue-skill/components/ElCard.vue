<script setup>
import { ElCard } from 'element-plus'

defineOptions({ name: 'CardDemo' })
</script>

<template>
  <div class="demo-block">
    <ElCard shadow="hover" class="demo-card">
      <template #header>
        <span class="card-title">卡片标题</span>
      </template>
      <p class="card-body">卡片内容区，承载文字、图表、列表或表单。</p>
    </ElCard>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
}

.demo-card {
  width: 360px;
  border-radius: var(--radius-size-medium);
  border: 1px solid var(--color-border-separator);
}

.card-title {
  font-size: var(--font-size-normal);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.card-body {
  margin: 0;
  font-size: var(--font-size-normal);
  line-height: var(--font-line-height-normal);
  color: var(--color-text-secondary);
}
</style>
