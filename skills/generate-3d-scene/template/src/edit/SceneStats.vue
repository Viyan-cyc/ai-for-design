<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Bridge } from './Bridge';

const props = defineProps<{ bridge: Bridge }>();
const objects = ref(0);
const selected = ref(0);
const lights = ref(0);
const frame = ref<{ fps: number; calls: number; triangles: number } | null>(null);
const { sceneEngine, lightEngine, renderLoop } = props.bridge.handle.internals;
const refreshCounts = (): void => {
  const ids = new Set(sceneEngine.getAllIds());
  objects.value = ids.size;
  selected.value = props.bridge.selectedIds.filter((id) => ids.has(id)).length;
  lights.value = lightEngine.getLightIds().length;
};
const unsubscribe = props.bridge.onState(refreshCounts);
let timer: ReturnType<typeof setInterval> | undefined;
let lastFrameAt = 0;
let startedAt = 0;
const unsubscribeFrame = renderLoop.onAfterFrame(() => {
  lastFrameAt = performance.now();
});
const refresh = (): void => {
  refreshCounts();
  const now = performance.now();
  // A full sampling window avoids displaying startup FPS as steady-state performance.
  frame.value = document.hidden || now - startedAt < 1000 || !lastFrameAt || now - lastFrameAt > 1500
    ? null
    : renderLoop.getStats();
};
const format = (value: number | undefined): string => value === undefined ? '—' : value.toLocaleString('zh-CN');
onMounted(() => {
  startedAt = performance.now();
  timer = setInterval(refresh, 500);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  unsubscribe();
  unsubscribeFrame();
});
</script>

<template>
  <section class="scene-stats" aria-label="场景统计">
    <h3>场景概况</h3>
    <dl>
      <div><dt>对象</dt><dd>{{ format(objects) }}</dd></div>
      <div><dt>已选对象</dt><dd>{{ format(selected) }}</dd></div>
      <div><dt>灯光</dt><dd>{{ format(lights) }}</dd></div>
    </dl>
    <p>对象按场景节点计数，包含隐藏节点，不含模型内部子网格和编辑辅助线。</p>
    <h3>实时性能</h3>
    <dl>
      <div><dt>帧率（FPS）</dt><dd>{{ format(frame?.fps) }}</dd></div>
      <div><dt>绘制调用（Draw Calls）</dt><dd>{{ format(frame?.calls) }}</dd></div>
      <div><dt>绘制三角形</dt><dd>{{ format(frame?.triangles) }}</dd></div>
    </dl>
    <p>每半秒刷新。帧率取最近一秒；绘制调用和三角形为当前帧统计，包含编辑辅助元素，不代表全部模型的资源总量。</p>
    <p v-if="!frame">等待渲染采样，或页面已暂停渲染。</p>
  </section>
</template>

<style scoped>
.scene-stats {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px;
  color: var(--ed-text);
  font-size: 12px;
}
h3 { margin: 4px 0 12px; font-size: 12px; }
h3:not(:first-child) { margin-top: 24px; }
dl { margin: 0; }
dl > div { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 9px 0; border-bottom: 1px solid var(--ed-border); }
dt { color: var(--ed-dim); }
dd { margin: 0; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
p { color: var(--ed-dim); font-size: 11px; line-height: 1.7; }
</style>
