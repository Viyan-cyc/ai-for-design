<script setup lang="ts">

/**
 * App.vue — 二开态页面壳（3D 视口全屏 + 业务 UI 挂载点）
 *
 * 二开者改这里：加侧栏/图表/按钮，经 props.handle 驱动场景。
 * 3D canvas 与 CSS2D 卡片层由 scene-core 管理，本组件只提供容器。
 */
import type { SceneHandle } from '@/scene-core';

defineProps<{ handle: SceneHandle }>();
</script>

<template>
  <div class="app-root">
    <div class="app-root__hint">
      二开态运行中 — 改 src/App.vue 与 handlers/，scene-data.json 驱动场景。
      <a href="/?edit=1">打开编辑态</a>
    </div>
  </div>
</template>

<style scoped>
.app-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.app-root__hint {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(20, 30, 40, 0.8);
  color: #9fb3c8;
  font-size: 12px;
  pointer-events: auto;
}

.app-root__hint a {
  color: #8fd3ff;
  margin-left: 8px;
}
</style>
