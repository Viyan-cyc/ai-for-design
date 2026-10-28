<script setup lang="ts">
// eslint-disable-next-line lines-around-comment -- 文件首部文档注释与 prettier 输出冲突
/**
 * App.vue — 二开态页面壳（3D 视口全屏 + 业务 UI 挂载点）
 *
 * 二开者改这里：加侧栏/图表/按钮，经 props.handle 驱动场景。
 * 3D canvas 与 CSS2D 卡片层由 scene-core 管理，本组件只提供容器。
 */
import SceneEditLauncher from './SceneEditLauncher.vue';
import type { SceneHandle } from '@/scene-core';

defineProps<{ handle: SceneHandle }>();
</script>

<template>
  <div class="app-root">
    <SceneEditLauncher href="?edit=1" />
  </div>
</template>

<style scoped>
.app-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
}


</style>
