<script setup>
import { ref } from 'vue'
import { ElSwitch, ElTable, ElTableColumn } from 'element-plus'
import { ElLoadingDirective } from 'element-plus'

defineOptions({ name: 'LoadingDemo', directives: { loading: ElLoadingDirective } })

const loading = ref(false)
</script>

<template>
  <div class="demo-block">
    <ElSwitch v-model="loading" active-text="加载中" />

    <ElTable v-loading="loading" :data="[]" class="demo-table">
      <ElTableColumn prop="name" label="名称" />
      <ElTableColumn prop="value" label="数值" />
    </ElTable>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}

.demo-table {
  width: 400px;
  min-height: 160px;
}
</style>
