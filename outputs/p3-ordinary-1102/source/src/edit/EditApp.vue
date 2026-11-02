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
import type { MaterialLibService } from './MaterialLibService';
import SceneEditLauncher from '../SceneEditLauncher.vue';
import Toolbar from './Toolbar.vue';
import OutlineTree from './OutlineTree.vue';
import PropertyPanel from './PropertyPanel.vue';
import './styles/editor.css';
import ViewportTools from './ViewportTools.vue';
import LightList from './LightList.vue';
import SceneStats from './SceneStats.vue';

const props = defineProps<{
  onEditingChange: (value: boolean) => void;
  bridge: Bridge;
  save: SaveService;
  lightHelpers: LightHelperService;
  materialLib: MaterialLibService;

  /** edit-main 创建的 3D 视口容器（canvas + CSS2D 层），铺满视口层 */
  viewportEl: HTMLElement;
}>();

const editing = ref(true);
const setEditing = (value: boolean): void => {
  props.onEditingChange(value);
  editing.value = value;
};
const focused = ref(false);
const leftTab = ref<'models' | 'lights' | 'stats'>('models');
const propertyPanel = ref<InstanceType<typeof PropertyPanel> | null>(null);
const selectedLight = ref<string | null>(null);
const selectLight = (id: string): void => {
  selectedLight.value = id;
  propertyPanel.value?.selectLight(id);
};
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
      v-if="editing"
      :saving="props.save.saving.value"
      :status="props.save.status.value"
      :on-exit="() => setEditing(false)"
      :dirty="props.save.dirty.value"
      :bridge="props.bridge"
      :on-save="() => props.save.save()"
      :on-import="() => props.save.chooseImport()"
    />
    <aside v-if="editing" v-show="!focused" class="ed-panel ed-panel--left">
      <div class="editor-tabs" role="tablist" aria-label="场景分类">
        <button role="tab" :aria-selected="leftTab === 'models'" @click="leftTab = 'models'">模型</button>
        <button role="tab" :aria-selected="leftTab === 'lights'" @click="leftTab = 'lights'">灯光</button>
        <button role="tab" :aria-selected="leftTab === 'stats'" @click="leftTab = 'stats'">统计</button>
      </div>
      <OutlineTree v-show="leftTab === 'models'" :bridge="props.bridge" />
      <LightList v-show="leftTab === 'lights'" :bridge="props.bridge" :selected="selectedLight" @select="selectLight" />
      <SceneStats v-if="leftTab === 'stats' && !focused" :bridge="props.bridge" />
    </aside>
    <aside v-if="editing" v-show="!focused" class="ed-panel ed-panel--right">
      <PropertyPanel
        ref="propertyPanel"
        @light-selected="selectedLight = $event"
        :bridge="props.bridge"
        :light-helpers="props.lightHelpers"
        :material-lib="props.materialLib"
      />
    </aside>
    <SceneEditLauncher v-if="!editing" :dirty="props.save.dirty.value" @edit="setEditing(true)" />
    <ViewportTools v-if="editing" :bridge="props.bridge" :focused="focused" @toggle-focus="focused = !focused" />
  </div>
</template>

<style scoped>
.editor-return { position: absolute; top: 20px; right: 20px; padding: 10px 16px; background: white; box-shadow: var(--ed-shadow); }
.ed-panel--left :deep(.outline) { flex: 1; min-height: 0; height: auto; }
.editor-tabs { display: flex; gap: 6px; padding: 10px; border-bottom: 1px solid var(--ed-border); }
.editor-tabs button { flex: 1; border: 0; border-radius: 6px; padding: 7px; background: transparent; color: var(--ed-dim); cursor: pointer; }
.editor-tabs button[aria-selected="true"] { background: var(--ed-accent-soft); color: var(--ed-accent); }
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
  max-width: calc(100% - 28px);
}
@media (max-width: 720px) {
  .edit-app :deep(.toolbar__brand) { display: none; }
  .edit-app :deep(.toolbar) { gap: 0; }
  .edit-app :deep(.toolbar__sep) { margin: 0 2px; }
  .edit-app :deep(.tb-btn) { flex-shrink: 0; }
}
</style>
