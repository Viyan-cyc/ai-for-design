<script setup>
import { ref } from 'vue'
import {
  ElForm, ElFormItem, ElInput, ElSelect, ElOption,
  ElButton, ElRow, ElCol, ElCard, ElCollapse, ElCollapseItem
} from 'element-plus'

defineOptions({ name: 'SearchInfoWithRightCard' })

const formValue = ref({
  requirement: '',
  type: ''
})

const typeOptions = [
  { value: 'bug', label: 'Bug' },
  { value: 'question', label: 'Question' },
  { value: 'enhancement', label: 'Enhancement' }
]

const handleSearch = () => {}
const handleReset = () => {}
</script>

<template>
  <div class="search-info-with-right-card">
    <div class="top-toolbar">
      <div class="top-left">
        <slot name="toolbar-left" />
      </div>

      <ElForm :model="formValue" inline class="search-form">
        <ElFormItem label="需求">
          <ElInput v-model="formValue.requirement" placeholder="请输入" clearable />
        </ElFormItem>
        <ElFormItem label="类型">
          <ElSelect v-model="formValue.type" placeholder="请选择" clearable>
            <ElOption
              v-for="item in typeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem>
          <ElButton type="primary" @click="handleSearch">搜索</ElButton>
          <ElButton @click="handleReset">重置</ElButton>
        </ElFormItem>
      </ElForm>

      <div class="top-right">
        <slot name="toolbar-right" />
      </div>
    </div>

    <div class="bottom-content">
      <div class="left-side">
        <slot name="sidebar" />
      </div>

      <div class="right-cards">
        <div class="card-row">
          <ElCard shadow="hover" class="item-card">
            <slot name="card-top-1" />
          </ElCard>
          <ElCard shadow="hover" class="item-card">
            <slot name="card-top-2" />
          </ElCard>
        </div>
        <div class="card-row">
          <ElCard shadow="hover" class="item-card card-wide">
            <slot name="card-bottom-1" />
          </ElCard>
          <ElCard shadow="hover" class="item-card">
            <slot name="card-bottom-2" />
          </ElCard>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.search-info-with-right-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-size-20);
  background: var(--color-bg-1);
}

.top-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-size-16);
  margin-bottom: var(--space-size-16);
}

.top-left,
.top-right {
  flex-shrink: 0;
}

.search-form {
  flex: 1;
  min-width: 0;
}

.bottom-content {
  display: flex;
  flex: 1;
  gap: var(--space-size-16);
  min-height: 0;
}

.left-side {
  width: 300px;
  max-width: 40%;
  flex-shrink: 0;
  border-radius: var(--radius-size-medium);
  border: 1px solid var(--color-border-separator);
  background: var(--color-bg-5);
  overflow: auto;
}

.right-cards {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-size-16);
  min-width: 0;
}

.card-row {
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
