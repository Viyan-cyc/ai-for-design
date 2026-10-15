<script setup>
defineProps({
  level: { type: String, default: 'card' },
  tint: { type: String, default: 'none' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  solid: { type: Boolean, default: false },
  tabindex: { type: [String, Number], default: undefined },
})
</script>

<template>
  <div
    class="frost-surface"
    data-material="frosted"
    :data-frost-level="level"
    :data-frost-tint="tint === 'none' ? undefined : tint"
    :data-frost-solid="solid ? 'true' : undefined"
    :tabindex="tabindex"
  >
    <div class="surface-content">
      <span class="surface-title">{{ title }}</span>
      <p class="surface-desc">{{ description }}</p>
      <slot></slot>
    </div>
  </div>
</template>

<style scoped lang="less">
.frost-surface {
  position: relative;
  border-radius: var(--radius-size-big);
  border: var(--border-width-normal) solid var(--frost-border-color);
  transition: box-shadow var(--frost-transition);

  // backdrop-filter 只模糊元素背后的内容；::after 属于子内容不参与模糊，
  // 作为同色相增量层实现 hover/active 的填充 alpha 提升（只调填充，不改模糊）。
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: var(--frost-surface-solid);
    opacity: 0;
    transition: opacity var(--frost-transition);
    z-index: 0;
  }

  &:hover::after {
    opacity: var(--frost-hover-add);
  }

  &:active {
    box-shadow: none;

    &::after {
      opacity: var(--frost-active-add);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--color-border-focus);
    outline-offset: 2px;
  }

  // 实色回退：组件显式声明或处于 data-transparency="reduced" 作用域。
  &[data-frost-solid='true'],
  [data-transparency='reduced'] & {
    backdrop-filter: none;
    background: var(--frost-surface-solid);
    box-shadow: none;

    &::after {
      display: none;
    }
  }
}

.surface-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-size-8);
  padding: var(--space-size-20);
}

.surface-title {
  font-size: var(--font-size-medium);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: var(--font-line-height-normal);
}

.surface-desc {
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  line-height: var(--font-line-height-normal);
}
</style>

<style lang="less">
// 材质档位与染色的属性选择器实现：页面只写 data-* 属性标记，参数集中在此，
// 全部引用主题 frost token。一个位置只保留一层背景模糊；卡内按钮/标签用实色。
[data-material='frosted'] {
  backdrop-filter: blur(var(--frost-blur-card)) saturate(var(--frost-saturate-neutral));
  background: var(--frost-surface-card);
  box-shadow: var(--frost-shadow-card);
}

[data-material='frosted'][data-frost-level='control'] {
  backdrop-filter: blur(var(--frost-blur-control)) saturate(var(--frost-saturate-neutral));
  background: var(--frost-surface-control);
  box-shadow: var(--frost-shadow-control);
}

[data-material='frosted'][data-frost-level='overlay'] {
  backdrop-filter: blur(var(--frost-blur-overlay)) saturate(var(--frost-saturate-neutral));
  background: var(--frost-surface-overlay);
  box-shadow: var(--frost-shadow-overlay);
}

// 薄染色：tint 作为 image 层叠在 surface 色上层（同色线性渐变模拟纯色图层，
// rgba 颜色值不能直接逗号分层）。
[data-material='frosted'][data-frost-tint='blue'] {
  background-color: var(--frost-surface-card);
  background-image: linear-gradient(var(--frost-tint-blue), var(--frost-tint-blue));
}

[data-material='frosted'][data-frost-tint='lavender'] {
  background-color: var(--frost-surface-card);
  background-image: linear-gradient(var(--frost-tint-lavender), var(--frost-tint-lavender));
}

[data-material='frosted'][data-frost-tint='teal'] {
  background-color: var(--frost-surface-card);
  background-image: linear-gradient(var(--frost-tint-teal), var(--frost-tint-teal));
}
</style>
