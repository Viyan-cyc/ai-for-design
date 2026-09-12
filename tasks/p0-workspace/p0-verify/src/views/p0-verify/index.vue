<script setup>
// P0Verify — P0 验证页：引用迁移后的 GButton 组件
import { ref } from 'vue'
import { Monitor } from '@element-plus/icons-vue'
import GButton from '../../components/basic/GButton/GButton.vue'

const clicks = ref(0)
</script>

<template>
  <div class="page-root">
    <el-card shadow="never">
      <template #header>
        <div class="header">
          <span class="title">P0 技术验证 — GButton 复用</span>
        </div>
      </template>
      <div class="row">
        <GButton type="primary" @click="clicks++">主要操作（G 组件）</GButton>
        <GButton>默认按钮（G 组件）</GButton>
        <el-button type="danger" :icon="Monitor">原生 EP 对照</el-button>
      </div>
      <p class="count">GButton 点击次数：{{ clicks }}</p>
    </el-card>
  </div>
</template>

<style lang="less" scoped>
.page-root {
  min-height: 100%;
  padding: 2.4rem;

  .header {
    display: flex;
    align-items: center;
  }

  .title {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--gts-text-1);
  }

  .row {
    display: flex;
    gap: 1.2rem;
  }

  .count {
    margin-top: 1.6rem;
    color: var(--gts-text-2);
  }
}
</style>
