<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Bridge } from './Bridge';
import type { FrameStats } from '../scene3d/scene-core/index';

const props = defineProps<{ bridge: Bridge }>();
const objects = ref(0);
const selected = ref(0);
const lights = ref(0);
const frame = ref<FrameStats | null>(null);
const { sceneEngine, lightEngine, renderLoop } = props.bridge.handle.internals;
const refreshCounts = (): void => {
  const ids = new Set(sceneEngine.getAllIds());
  objects.value = ids.size;
  selected.value = props.bridge.selectedIds.filter((id) => ids.has(id)).length;
  lights.value = lightEngine.getLightIds().length;
};
const unsubscribe = props.bridge.onState(refreshCounts);
let timer: ReturnType<typeof setInterval> | undefined;
const refresh = (): void => { refreshCounts(); frame.value = renderLoop.getStats(); };
const format = (value: number | undefined): string => value === undefined ? '—' : value.toLocaleString('zh-CN');
onMounted(() => {
  refresh();
  timer = setInterval(refresh, 500);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  unsubscribe();

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
      <div><dt>帧率（FPS）</dt><dd>{{ !frame || frame.paused ? '已暂停' : frame.idle ? '空闲' : frame.sampling ? '采样中' : format(frame.fps) }}</dd></div>
      <div><dt>绘制次数（Draw Calls）</dt><dd>{{ format(frame?.calls) }}</dd></div>
      <div><dt>绘制三角面</dt><dd>{{ format(frame?.triangles) }}</dd></div>
    </dl>
    <p v-if="frame?.idle && !frame.paused">按需渲染 · 静止时不绘制，交互和内容变化会自动恢复。</p>
    <p v-if="frame && !frame.paused">帧率上限：{{ frame.maxFps || '不限制' }}{{ frame.maxFps ? ' FPS' : '' }}</p>
    <p>每半秒刷新。帧率统计最近一秒实际绘制的帧；绘制次数和三角面取最近一次完整场景绘制，包含阴影和编辑辅助元素。空闲不代表性能不足。</p>

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
