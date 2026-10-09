<script setup lang="ts">

/**
 * edit/EditApp.vue — 编辑态根组件（Spline 风格悬浮面板布局）
 *
 * 3D 视口全屏铺底，左树/右属性为悬浮玻璃面板（视口真实占满全窗，
 * canvas 尺寸与相机 aspect 始终等于窗口，resize 不变形）。
 */
import { onMounted, ref } from 'vue';
import type { Bridge } from './Bridge';
import type { LightHelperService } from './LightHelperService';
import type { SaveService } from './SaveService';
import Toolbar from './Toolbar.vue';
import OutlineTree from './OutlineTree.vue';
import PropertyPanel from './PropertyPanel.vue';
import './styles/editor.css';

const props = defineProps<{
  bridge: Bridge;
  save: SaveService;
  lightHelpers: LightHelperService;

  /** edit-main 创建的 3D 视口容器（canvas + CSS2D 层），铺满视口层 */
  viewportEl: HTMLElement;
}>();

const viewport = ref<HTMLElement | null>(null);
onMounted(() => {
  if (viewport.value) {
    viewport.value.appendChild(props.viewportEl);
  }
});
</script>

<template>
  <div class="edit-scope edit-app">
    <div
      ref="viewport"
      class="edit-app__viewport"
    />
    <Toolbar
      :bridge="props.bridge"
      :on-save="() => props.save.save()"
    />
    <aside class="ed-panel ed-panel--left">
      <OutlineTree :bridge="props.bridge" />
    </aside>
    <aside class="ed-panel ed-panel--right">
      <PropertyPanel
        :bridge="props.bridge"
        :light-helpers="props.lightHelpers"
      />
    </aside>
  </div>
</template>

<style scoped>
.edit-app {
  position: relative;
  height: 100vh;
  overflow: hidden;
}

.edit-app__viewport {
  position: absolute;
  inset: 0;
}

.edit-app__viewport :deep(#edit-viewport) {
  width: 100%;
  height: 100%;
}

.edit-app :deep(.toolbar) {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
}
</style>
