<script setup lang="ts">

/**
 * ExampleCard.vue — 示例 2D 卡片（纯展示 + props，二开者参照写自己的卡片）
 *
 * v3 数据流：节点 params（生产数据源）+ id 由卡片系统自动注入为 props，
 * 组件只管把业务字段渲染出来，不管定位/显隐（cards/registry 的 CSS2D 锚点托管）。
 * starter 数据（cars 分组）注入：{ id, name?, status?, speed? }。
 * 状态徽章颜色走状态语义（normal/alarm/maintenance），与 materials.ts 的状态视觉同源。
 */
import { computed } from 'vue';

const props = defineProps<{
  id: string;
  name?: string;
  status?: string;
  speed?: number;
}>();

const STATUS_LABEL: Record<string, string> = {
  normal: '运行',
  alarm: '告警',
  maintenance: '检修',
};

const title = computed(() => props.name ?? props.id);
const statusLabel = computed(() =>
  props.status ? (STATUS_LABEL[props.status] ?? props.status) : null,
);
const statusClass = computed(() =>
  props.status && props.status in STATUS_LABEL ? props.status : 'ok',
);
const speedText = computed(() =>
  typeof props.speed === 'number' ? `${props.speed.toFixed(1)} m/s` : null,
);
</script>

<template>
  <div
    class="example-card"
    :class="`example-card--${statusClass}`"
  >
    <div class="example-card__head">
      <span class="example-card__title">{{ title }}</span>
      <span
        v-if="statusLabel"
        class="example-card__badge"
      >{{ statusLabel }}</span>
    </div>
    <div
      v-if="speedText"
      class="example-card__row"
    >
      <span class="example-card__key">速度</span>
      <span class="example-card__val">{{ speedText }}</span>
    </div>
    <div class="example-card__row">
      <span class="example-card__key">编号</span>
      <span class="example-card__val">{{ id }}</span>
    </div>
  </div>
</template>

<style scoped>
.example-card {
  min-width: 132px;
  padding: 8px 11px;
  border-radius: 8px;
  background: rgba(20, 30, 40, 0.88);
  color: #fff;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(6px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}

.example-card--alarm {
  border-color: rgba(229, 72, 77, 0.75);
}

.example-card--maintenance {
  border-color: rgba(216, 169, 33, 0.7);
}

.example-card__head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 4px;
}

.example-card__title {
  font-weight: 600;
}

.example-card__badge {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(112, 200, 120, 0.22);
  color: #7fd48a;
  font-size: 10px;
}

.example-card--alarm .example-card__badge {
  background: rgba(229, 72, 77, 0.24);
  color: #ff8a8e;
}

.example-card--maintenance .example-card__badge {
  background: rgba(216, 169, 33, 0.22);
  color: #e8c04a;
}

.example-card__row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  line-height: 1.7;
}

.example-card__key {
  color: rgba(255, 255, 255, 0.55);
  font-size: 11px;
}

.example-card__val {
  font-variant-numeric: tabular-nums;
}
</style>
