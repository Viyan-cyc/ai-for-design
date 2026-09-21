<script setup>
import { ref } from 'vue'
import { ElDrawer, ElButton, ElDescriptions, ElDescriptionsItem } from 'element-plus'

defineOptions({ name: 'DrawerDemo' })

const visible = ref(false)
</script>

<template>
  <div class="demo-block">
    <ElButton type="primary" @click="visible = true">打开抽屉</ElButton>

    <ElDrawer v-model="visible" title="详情" size="480px">
      <ElDescriptions :column="1" border>
        <ElDescriptionsItem label="名称">设备 A</ElDescriptionsItem>
        <ElDescriptionsItem label="状态">运行中</ElDescriptionsItem>
        <ElDescriptionsItem label="位置">华东机房</ElDescriptionsItem>
      </ElDescriptions>
    </ElDrawer>
  </div>
</template>

<style scoped lang="less">
.demo-block {
  display: flex;
}
</style>
