<script setup>
import { ref } from 'vue'
import { ElInput } from 'element-plus'

defineOptions({ name: 'InputDemo' })

const keyword = ref('')
const remark = ref('')
</script>

<template>
  <div class="demo-block">
    <ElInput v-model="keyword" placeholder="请输入关键词" clearable class="demo-input" />

    <ElInput
      v-model="remark"
      type="textarea"
      :rows="2"
      maxlength="100"
      show-word-limit
      placeholder="请输入备注"
    />

    <ElInput v-model="keyword" disabled placeholder="禁用状态" />
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}

.demo-input {
  width: 320px;
}
</style>
