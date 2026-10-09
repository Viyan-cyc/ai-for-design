<script setup lang="ts">

/**
 * ExampleCard.vue — 示例 2D 卡片（纯样式 + props，二开者参照写自己的卡片）
 *
 * 卡片组件约定：props 由 scene-data.json 的 cards[].props 传入，只管展示，不管定位。
 * 定位/显隐由 cards/registry（CSS2D 锚点系统）负责。
 */
defineProps<{
  title: string
  value?: string
  status?: 'ok' | 'warn' | 'error'
}>();
</script>

<template>
  <div
    class="example-card"
    :class="`example-card--${status ?? 'ok'}`"
  >
    <div class="example-card__title">
      {{ title }}
    </div>
    <div
      v-if="value"
      class="example-card__value"
    >
      {{ value }}
    </div>
  </div>
</template>

<style scoped>
.example-card {
  min-width: 120px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(20, 30, 40, 0.85);
  color: #fff;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.example-card--warn {
  border-color: rgba(255, 176, 32, 0.6);
}

.example-card--error {
  border-color: rgba(255, 77, 79, 0.7);
}

.example-card__title {
  font-weight: 600;
  margin-bottom: 2px;
}

.example-card__value {
  opacity: 0.85;
}
</style>
