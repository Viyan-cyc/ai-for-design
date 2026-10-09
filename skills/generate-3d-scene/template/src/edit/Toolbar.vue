<script setup lang="ts">

/**
 * edit/Toolbar.vue — Spline 风格悬浮工具条（顶部居中）
 *
 * 结构：+ 添加菜单（盒/球/柱/锥/环/面 收纳进下拉）| 移动/旋转/缩放/磁吸
 *      | 撤销/重做/复制/删除 | 保存。
 * 全 SVG 图标（stroke 风格，hover 提亮，激活态 accent 底色）。
 */
import { ref } from 'vue';
import type { Bridge, EditorState } from './Bridge';

const props = defineProps<{
  bridge: Bridge;
  onSave: () => void;
}>();

const state = ref<EditorState>(props.bridge.getState());
props.bridge.onState((s) => {
  state.value = s;
});

const PRIMITIVES = [
  { key: 'Box', label: '立方体' },
  { key: 'Sphere', label: '球体' },
  { key: 'Cylinder', label: '圆柱' },
  { key: 'Cone', label: '圆锥' },
  { key: 'Torus', label: '圆环' },
  { key: 'Plane', label: '平面' },
] as const;

/** 下拉展开态（点外部关闭） */
const addOpen = ref(false);
const toggleAdd = (): void => {
  addOpen.value = !addOpen.value;
};
const closeAdd = (): void => {
  addOpen.value = false;
};

let counter = 0;

const duplicateSelected = (): void => {
  const anchorId = props.bridge.anchorId;
  if (!anchorId) {
    return;
  }
  const def = props.bridge.handle.serialize().objects.find((o) => o.id === anchorId);
  if (!def) {
    return;
  }
  counter += 1;
  const newId = `${def.id}_copy_${String(counter).padStart(3, '0')}`;
  props.bridge.commit('复制', () => {
    props.bridge.handle.update({
      upsert: [{
        ...def,
        id: newId,
        position: [def.position[0] + 1, def.position[1], def.position[2]],
      }],
    });
  });
};

const addPrimitive = (kind: string): void => {
  counter += 1;
  const id = `${kind}_${String(counter).padStart(3, '0')}`;
  props.bridge.commit(`添加${kind}`, () => {
    props.bridge.handle.update({
      upsert: [{
        id,
        type: 'primitive',
        primitive: kind as 'Box' | 'Sphere' | 'Cylinder' | 'Plane' | 'Cone' | 'Torus',
        position: [0, 0.5, 0],
        rotation: [0, 0, 0],
        scale: 1,
      }],
    });
  });
  closeAdd();
};

const deleteSelected = (): void => {
  props.bridge.removeObjects(props.bridge.selectedIds);
};
</script>

<template>
  <div class="toolbar">
    <!-- 添加（下拉收纳） -->
    <div class="toolbar__menu">
      <button
        class="tb-btn"
        :class="{ 'tb-btn--active': addOpen }"
        title="添加物体"
        @click="toggleAdd"
      >
        <svg
          viewBox="0 0 16 16"
          width="15"
          height="15"
        ><path
          d="M8 3v10M3 8h10"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        /></svg>
      </button>
      <div
        v-if="addOpen"
        class="toolbar__dropdown"
      >
        <button
          v-for="p in PRIMITIVES"
          :key="p.key"
          class="toolbar__dd-item"
          @click="addPrimitive(p.key)"
        >
        <svg
          v-if="p.key === 'Box'"
          class="toolbar__dd-icon"
          viewBox="0 0 16 16"
        ><path
          d="M8 2l5 3v6l-5 3-5-3V5l5-3zM3 5l5 3 5-3M8 8v6"
          fill="none"
          stroke="currentColor"
          stroke-width="1.1"
        /></svg>
          <svg
            v-else-if="p.key === 'Sphere'"
            class="toolbar__dd-icon"
            viewBox="0 0 16 16"
          ><circle
            cx="8"
            cy="8"
            r="5.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.1"
          /><ellipse
            cx="8"
            cy="8"
            rx="5.5"
            ry="2.2"
            fill="none"
            stroke="currentColor"
            stroke-width="0.9"
          /></svg>
          <svg
            v-else-if="p.key === 'Cylinder'"
            class="toolbar__dd-icon"
            viewBox="0 0 16 16"
          ><ellipse
            cx="8"
            cy="3.5"
            rx="4.5"
            ry="1.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.1"
          /><path
            d="M3.5 3.5v9M12.5 3.5v9M3.5 12.5c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.1"
          /></svg>
          <svg
            v-else-if="p.key === 'Cone'"
            class="toolbar__dd-icon"
            viewBox="0 0 16 16"
          ><path
            d="M8 2l4.5 10.5h-9L8 2z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.1"
            stroke-linejoin="round"
          /><ellipse
            cx="8"
            cy="12.5"
            rx="4.5"
            ry="1.5"
            fill="none"
            stroke="currentColor"
            stroke-width="0.9"
          /></svg>
          <svg
            v-else-if="p.key === 'Torus'"
            class="toolbar__dd-icon"
            viewBox="0 0 16 16"
          ><ellipse
            cx="8"
            cy="8"
            rx="5.5"
            ry="3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.1"
          /><ellipse
            cx="8"
            cy="8"
            rx="2"
            ry="1"
            fill="none"
            stroke="currentColor"
            stroke-width="0.9"
          /></svg>
          <svg
            v-else
            class="toolbar__dd-icon"
            viewBox="0 0 16 16"
          ><path
            d="M2 11l6-6 6 6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.1"
            stroke-linejoin="round"
          /></svg>
          {{ p.label }}
        </button>
      </div>
    </div>

    <span class="toolbar__sep" />

    <!-- 移动 / 旋转 / 缩放 / 磁吸 -->
    <button
      :class="{ 'tb-btn--active': state.gizmoMode === 'translate' }"
      class="tb-btn"
      title="移动 (G)"
      @click="props.bridge.setGizmoMode('translate')"
    >
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
      ><path
        d="M8 2v12M2 8h12M8 2l-2 2M8 2l2 2M8 14l-2-2M8 14l2-2M2 8l2-2M2 8l2 2M14 8l-2-2M14 8l-2 2"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
      /></svg>
    </button>
    <button
      :class="{ 'tb-btn--active': state.gizmoMode === 'rotate' }"
      class="tb-btn"
      title="旋转 (R)"
      @click="props.bridge.setGizmoMode('rotate')"
    >
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
      ><path
        d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.6h-2.6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.3"
        stroke-linecap="round"
      /></svg>
    </button>
    <button
      :class="{ 'tb-btn--active': state.gizmoMode === 'scale' }"
      class="tb-btn"
      title="缩放 (S)"
      @click="props.bridge.setGizmoMode('scale')"
    >
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
      ><rect
        x="2.5"
        y="8.5"
        width="5"
        height="5"
        rx="0.8"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
      /><rect
        x="7.5"
        y="2.5"
        width="6"
        height="6"
        rx="0.8"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
      /></svg>
    </button>
    <button
      :class="{ 'tb-btn--active': state.snapping }"
      class="tb-btn"
      title="吸附开关"
      @click="props.bridge.toggleSnapping()"
    >
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
      ><path
        d="M5 2v5a3 3 0 0 0 6 0V2M8 10v4M4 2h8"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
      /></svg>
    </button>

    <span class="toolbar__sep" />

    <!-- 撤销 / 重做 / 复制 / 删除 -->
    <button
      :disabled="state.undoDepth === 0"
      class="tb-btn"
      title="撤销 (Ctrl+Z)"
      @click="props.bridge.undo()"
    >
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
      ><path
        d="M6 3L2.5 6.5 6 10M3 6.5h6.5a4 4 0 0 1 0 8H6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.3"
        stroke-linecap="round"
        stroke-linejoin="round"
      /></svg>
    </button>
    <button
      :disabled="state.redoDepth === 0"
      class="tb-btn"
      title="重做 (Ctrl+Shift+Z)"
      @click="props.bridge.redo()"
    >
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
      ><path
        d="M10 3l3.5 3.5L10 10M13 6.5H6.5a4 4 0 0 0 0 8H10"
        fill="none"
        stroke="currentColor"
        stroke-width="1.3"
        stroke-linecap="round"
        stroke-linejoin="round"
      /></svg>
    </button>
    <button
      :disabled="state.selection.length === 0"
      class="tb-btn"
      title="复制 (Ctrl+D)"
      @click="duplicateSelected"
    >
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
      ><rect
        x="5.5"
        y="5.5"
        width="8"
        height="8"
        rx="1.2"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
      /><path
        d="M10.5 3.5v-.7A1.8 1.8 0 0 0 8.7 1H3.8A1.8 1.8 0 0 0 2 2.8v4.9a1.8 1.8 0 0 0 1.8 1.8h.7"
        fill="none"
        stroke="currentColor"
        stroke-width="1.1"
      /></svg>
    </button>
    <button
      :disabled="state.selection.length === 0"
      class="tb-btn tb-btn--danger"
      title="删除 (Del)"
      @click="deleteSelected"
    >
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
      ><path
        d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.7 8.6a1.2 1.2 0 0 0 1.2 1.1h3.2a1.2 1.2 0 0 0 1.2-1.1l.7-8.6M6.5 7v4.5M9.5 7v4.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.1"
        stroke-linecap="round"
      />
      </svg>
    </button>
    <span class="toolbar__sep" />

    <button
      class="tb-btn tb-btn--primary"
      title="保存 (Ctrl+S)"
      @click="props.onSave()"
    >
      <svg
        viewBox="0 0 16 16"
        width="15"
        height="15"
      ><path
        d="M3 2.5h8.5L14 5v8.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1zM4.5 2.5v4h6v-4M4.5 14v-4.5h7V14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.1"
        stroke-linejoin="round"
      /></svg>
    </button>
  </div>

  <!-- 点击外部关闭下拉（透明遮罩层） -->
  <div
    v-if="addOpen"
    class="toolbar__backdrop"
    @click="closeAdd"
  />
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 6px;
  background: var(--ed-panel);
  border: 1px solid var(--ed-border);
  border-radius: 12px;
  box-shadow: var(--ed-shadow);
  backdrop-filter: blur(12px);
  color: var(--ed-text);
  pointer-events: auto;
}

.toolbar__menu {
  position: relative;
  display: flex;
}

.toolbar__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px;
  background: var(--ed-panel);
  border: 1px solid var(--ed-border);
  border-radius: var(--ed-radius);
  box-shadow: var(--ed-shadow);
  backdrop-filter: blur(12px);
  z-index: 30;
}

.toolbar__dd-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 9px;
  border: 0;
  border-radius: var(--ed-radius-s);
  background: transparent;
  color: var(--ed-text);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.toolbar__dd-item:hover {
  background: rgba(255, 255, 255, 0.07);
}

.toolbar__dd-icon {
  width: 15px;
  height: 15px;
  color: var(--ed-dim);
  flex-shrink: 0;
}

.toolbar__dd-item:hover .toolbar__dd-icon {
  color: var(--ed-accent);
}

.toolbar__backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.tb-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--ed-dim);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.tb-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--ed-text);
}

.tb-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.tb-btn--active {
  background: var(--ed-accent-soft) !important;
  color: var(--ed-accent) !important;
}

.tb-btn--danger:hover:not(:disabled) {
  background: rgba(229, 72, 77, 0.18);
  color: var(--ed-danger);
}

.tb-btn--primary {
  background: var(--ed-accent);
  color: #fff;
}

.tb-btn--primary:hover:not(:disabled) {
  background: #5590ff;
  color: #fff;
}

.toolbar__sep {
  width: 1px;
  height: 16px;
  margin: 0 5px;
  background: var(--ed-border);
}
</style>
