<script setup>
import { ElCollapse, ElCollapseItem, ElCard, ElRow, ElCol } from 'element-plus'

defineOptions({ name: 'LeftInfoWithRightCard' })
</script>

<template>
  <div class="left-info-right-card-container">
    <ElRow :gutter="16" class="h-full">
      <ElCol :span="6">
        <ElCollapse class="sidebar-collapse">
          <ElCollapseItem title="辅助信息" name="info">
            <slot name="sidebar" />
          </ElCollapseItem>
        </ElCollapse>
      </ElCol>

      <ElCol :span="18">
        <div class="right-card-area">
          <div class="top-cards">
            <ElCard shadow="hover" class="item-card">
              <slot name="card-top-1" />
            </ElCard>
            <ElCard shadow="hover" class="item-card">
              <slot name="card-top-2" />
            </ElCard>
          </div>

          <div class="bottom-cards">
            <ElCard shadow="hover" class="item-card card-wide">
              <slot name="card-bottom-1" />
            </ElCard>
            <ElCard shadow="hover" class="item-card">
              <slot name="card-bottom-2" />
            </ElCard>
          </div>
        </div>
      </ElCol>
    </ElRow>
  </div>
</template>

<style scoped lang="less">
.left-info-right-card-container {
  height: 100%;
  padding: var(--space-size-20);
  background: var(--color-bg-1);
}

.h-full {
  height: 100%;
}

.sidebar-collapse {
  border-radius: var(--radius-size-medium);
  border: 1px solid var(--color-border-separator);
  background: var(--color-bg-5);
}

.right-card-area {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: var(--space-size-16);
}

.top-cards,
.bottom-cards {
  display: flex;
  gap: var(--space-size-16);
  flex: 1;
  min-height: 0;
}

.item-card {
  border-radius: var(--radius-size-medium);
  border: 1px solid var(--color-border-separator);
  background: var(--color-bg-5);
  min-width: 0;
  flex: 1;

  &.card-wide {
    flex: 1.5;
  }
}
</style>
