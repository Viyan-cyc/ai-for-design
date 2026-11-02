<script setup>
import { ref } from 'vue'
import { ElSwitch } from 'element-plus'

defineOptions({ name: 'SwitchDemo' })

const enabled = ref(true)
</script>

<template>
  <div class="demo-block">
    <ElSwitch v-model="enabled" />
    <ElSwitch v-model="enabled" disabled />
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
  align-items: center;
  gap: var(--space-size-16);
}
</style>
