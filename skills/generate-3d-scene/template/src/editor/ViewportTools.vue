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
const setView = (top: boolean): void => {
  const handle = props.bridge.handle;
  props.bridge.commit(top ? '俯视' : '鸟瞰', () => {
    const data = handle.serialize();
    if (handle.viewMode === 'map') {
      const map = data.map as Record<string, unknown>;
      handle.update({ map: { ...map, view: top ? '2d' : '3d', pitch: Number(map.pitch) || 45 } });
      return;
    }
    const { camera, controlsEngine } = handle.internals;
    const target = controlsEngine.controls.target.clone();
    const distance = Math.max(1, camera.position.distanceTo(target));
    const direction = top ? new THREE.Vector3(0, 1, 0.0001) : new THREE.Vector3(1, 1, 1).normalize();
    const position = target.clone().add(direction.multiplyScalar(distance));
    handle.update({ camera: { position: position.toArray(), lookAt: target.toArray() } });
  });
};
const setTheme = (theme: 'light' | 'dark'): void => {
  const handle = props.bridge.handle;
  props.bridge.commit(theme === 'light' ? '浅色外观' : '深色外观', () => {
    const data = handle.serialize();
    if (handle.viewMode === 'map') {
      handle.update({ map: { ...(data.map as Record<string, unknown>), theme } });
    } else {
      const color = theme === 'light' ? '#eef0f3' : '#202733';
      handle.update({ scene: { ...data.scene, background: color, fog: data.scene.fog ? { ...data.scene.fog, color } : null } });
    }
  });
};
const themeSelected = (theme: string): boolean => {
  void state.value;
  const data = props.bridge.handle.serialize();
  return props.bridge.handle.viewMode === 'map' ? (data.map as Record<string, unknown>).theme === theme
    : data.scene.background === (theme === 'light' ? '#eef0f3' : '#202733');
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
    <button class="ed-btn" title="从上方观察，保留当前投影类型" @click="setView(true)">俯视</button>
    <button class="ed-btn" title="倾斜观察场景" @click="setView(false)">鸟瞰</button>
    <button v-for="theme in (['light', 'dark'] as const)" :key="theme" class="ed-btn" :class="{ 'ed-btn--active': themeSelected(theme) }" :aria-pressed="themeSelected(theme)" title="切换场景外观，保留模型材质" @click="setTheme(theme)">{{ theme === 'light' ? '浅色' : '深色' }}</button>
    <button class="ed-btn" :class="{ 'ed-btn--active': gridVisible }" :aria-pressed="gridVisible" title="显示或隐藏编辑辅助网格" @click="toggleGrid">网格</button>
    <button class="ed-btn" :aria-pressed="state.transformSpace === 'local'" title="切换变换手柄的世界／局部坐标；缩放沿局部轴" @click="props.bridge.toggleTransformSpace()">{{ state.transformSpace === 'world' ? '世界坐标' : '局部坐标' }}</button>
    <button class="ed-btn" :aria-pressed="focused" title="收起两侧面板，保留视口工具" @click="emit('toggle-focus')">{{ focused ? '退出专注' : '专注显示' }}</button>
  </nav>
</template>

<style scoped>
.viewport-tools { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); display: flex; gap: 5px; padding: 7px; max-width: calc(100% - 28px); overflow-x: auto; background: var(--ed-panel); border: 1px solid var(--ed-border); border-radius: 10px; box-shadow: var(--ed-shadow); pointer-events: auto; z-index: 5; }
</style>
