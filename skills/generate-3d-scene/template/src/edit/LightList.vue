<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { Bridge } from './Bridge';
const props = defineProps<{ bridge: Bridge; selected: string | null }>();
const emit = defineEmits<{ select: [id: string] }>();
const lights = ref(props.bridge.handle.serialize().lights);
const query = ref('');
const unsubscribe = props.bridge.onState(() => {
  lights.value = props.bridge.handle.serialize().lights;
});
onBeforeUnmount(unsubscribe);
const names: Record<string, string> = {
  AmbientLight: '环境光', HemisphereLight: '半球光', DirectionalLight: '平行光', PointLight: '点光源', SpotLight: '聚光灯', RectAreaLight: '区域光',
};
const filtered = computed(() => lights.value.filter((light) => (`${light.id } ${ names[light.type]}`).toLowerCase().includes(query.value.trim().toLowerCase())));
</script>
<template>
  <div class="light-list">
    <input v-model="query" type="text" placeholder="搜索灯光" aria-label="搜索灯光" />
    <div class="light-list__items">
      <button v-for="light in filtered" :key="light.id" class="light-list__row" :class="{ active: selected === light.id }" :aria-pressed="selected === light.id" @click="emit('select', light.id)">
        <span class="light-list__color" :style="{ background: light.color ?? '#ffffff' }" />
        <span class="light-list__name">{{ light.id }}<small>{{ names[light.type] }} · 强度 {{ light.intensity }}</small></span>
      </button>
      <p v-if="!filtered.length">{{ lights.length ? '没有匹配的灯光' : '暂无灯光，可在右侧场景面板添加' }}</p>
    </div>
  </div>
</template>
<style scoped>
.light-list { display: flex; flex-direction: column; min-height: 0; padding: 10px; gap: 10px; }
.light-list__items { overflow: auto; }
.light-list__row { width: 100%; display: flex; align-items: center; gap: 9px; text-align: left; padding: 9px 6px; border: 0; border-radius: 6px; background: transparent; color: var(--ed-text); cursor: pointer; }
.light-list__row:hover, .light-list__row.active { background: var(--ed-accent-soft); }
.light-list__color { width: 12px; height: 12px; border: 1px solid var(--ed-border); border-radius: 50%; flex-shrink: 0; }
.light-list__name { min-width: 0; overflow-wrap: anywhere; font-size: 12px; }
.light-list small { display: block; color: var(--ed-dim); margin-top: 3px; }
.light-list p { color: var(--ed-dim); font-size: 12px; }
</style>
