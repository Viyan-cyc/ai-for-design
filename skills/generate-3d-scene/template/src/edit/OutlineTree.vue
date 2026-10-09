<script setup lang="ts">

/**
 * edit/OutlineTree.vue — 物体树（左悬浮面板）
 *
 * 列出场景全部物体；点选 = 选中（Shift 累计）；双击 = F 聚焦。
 */
import { onMounted, ref } from 'vue';
import type { Bridge } from './Bridge';

const props = defineProps<{ bridge: Bridge }>();

interface Item {
  id: string;
  type: string;
}

const items = ref<Item[]>([]);
const selected = ref<string[]>([]);

const refresh = (): void => {
  const data = props.bridge.handle.serialize();
  items.value = data.objects.map((o) => ({ id: o.id, type: o.type }));
};

onMounted(() => {
  refresh();
  props.bridge.onState((s) => {
    selected.value = s.selection;
    refresh();
  });
});

const onSelect = (id: string, ev: MouseEvent): void => {
  props.bridge.select(id, ev.shiftKey);
};

const onDblClick = (id: string): void => {
  props.bridge.handle.frameObject(id);
};
</script>

<template>
  <div class="outline">
    <div class="outline__title">
      物体（{{ items.length }}）
    </div>
    <ul class="outline__list">
      <li
        v-for="item in items"
        :key="item.id"
        :class="{ 'outline__item--active': selected.includes(item.id) }"
        class="outline__item"
        @click.stop="onSelect(item.id, $event)"
        @dblclick.stop="onDblClick(item.id)"
      >
        <span class="outline__type">{{ item.type }}</span>
        <span class="outline__id">{{ item.id }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.outline {
  height: 100%;
  overflow-y: auto;
  color: var(--ed-text);
  font-size: 12px;
  padding: 10px 8px;
  box-sizing: border-box;
}

.outline__title {
  font-weight: 600;
  margin: 0 4px 8px;
  color: var(--ed-dim);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.outline__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.outline__item {
  display: flex;
  gap: 6px;
  padding: 4px 8px;
  border-radius: var(--ed-radius-s);
  cursor: pointer;
  align-items: baseline;
}

.outline__item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.outline__item--active {
  background: var(--ed-accent-soft);
}

.outline__item--active .outline__id {
  color: var(--ed-accent);
}

.outline__type {
  color: var(--ed-dim);
  min-width: 56px;
  font-size: 10px;
}

.outline__id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
