<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';
import type { Bridge } from './Bridge';

const props = defineProps<{ bridge: Bridge; focused: boolean }>();
const emit = defineEmits<{ 'toggle-focus': [] }>();
const state = ref(props.bridge.getState());
const unsubscribe = props.bridge.onState((value) => {
  state.value = value;
});
const gridVisible = ref(false);
let grid: THREE.GridHelper | null = null;
const toggleGrid = (): void => {
  if (!grid) {
    const engine = props.bridge.handle.internals.sceneEngine;
    const bounds = new THREE.Box3();
    for (const id of engine.getAllIds()) {
      const object = engine.getObject(id);
      if (object) {
        bounds.expandByObject(object);
      }
    }
    const size = bounds.isEmpty() ? 20 : Math.max(10, bounds.getSize(new THREE.Vector3()).length());
    grid = new THREE.GridHelper(size, 20, '#8b9bb0', '#c8d0dc');
    if (!bounds.isEmpty()) {
      const center = bounds.getCenter(new THREE.Vector3());
      grid.position.set(center.x, 0, center.z);
    }
    grid.raycast = () => {};
    props.bridge.handle.internals.scene.add(grid);
  }
  gridVisible.value = !gridVisible.value;
  grid.visible = gridVisible.value;
};
const isometric = (): void => {
  const { camera, controlsEngine } = props.bridge.handle.internals;
  const target = controlsEngine.controls.target.clone();
  const distance = Math.max(1, camera.position.distanceTo(target));
  const position = target.clone().add(new THREE.Vector3(1, 1, 1).normalize().multiplyScalar(distance));
  props.bridge.commit('等角观察', () => props.bridge.handle.update({ camera: { position: position.toArray(), lookAt: target.toArray() } }));
};
const frameSelection = (): void => {
  const id = props.bridge.anchorId;
  if (id) {
    props.bridge.handle.frameObject(id);
  }
};
onBeforeUnmount(() => {
  unsubscribe();
  if (grid) {
    grid.removeFromParent();
    grid.dispose();
  }
});
</script>

<template>
  <nav class="viewport-tools" aria-label="视口快捷操作">
    <button class="ed-btn" :disabled="!state.selection.length" title="聚焦当前选中对象（F）" @click="frameSelection">聚焦</button>
    <button class="ed-btn" title="从 XYZ 等角方向观察，保留当前投影类型" @click="isometric">等角</button>
    <button class="ed-btn" :class="{ 'ed-btn--active': gridVisible }" :aria-pressed="gridVisible" title="显示或隐藏编辑辅助网格" @click="toggleGrid">网格</button>
    <button class="ed-btn" :aria-pressed="state.transformSpace === 'local'" title="切换变换手柄的世界／局部坐标；缩放沿局部轴" @click="props.bridge.toggleTransformSpace()">{{ state.transformSpace === 'world' ? '世界坐标' : '局部坐标' }}</button>
    <button class="ed-btn" :aria-pressed="focused" title="收起两侧面板，保留视口工具" @click="emit('toggle-focus')">{{ focused ? '退出专注' : '专注显示' }}</button>
  </nav>
</template>

<style scoped>
.viewport-tools { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 5px; padding: 7px; max-width: calc(100% - 28px); overflow-x: auto; background: var(--ed-panel); border: 1px solid var(--ed-border); border-radius: 10px; box-shadow: var(--ed-shadow); pointer-events: auto; z-index: 5; }
</style>
