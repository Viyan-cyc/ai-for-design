<script setup>
import { reactive, ref } from 'vue'
import {
  SweetDialog,
  SweetDrawer,
  SweetDescriptions,
  SweetDescriptionsItem,
  SweetForm,
  SweetFormItem,
  SweetInput,
  SweetButton,
} from '@hw-seq/sweet-ui-base'

defineOptions({ name: 'DialogDrawer' })

// 对话框（编辑场景）
const dialogVisible = ref(false)
const formData = reactive({ username: '', email: '' })

// 抽屉（详情场景）
const drawerVisible = ref(false)
const detailData = reactive({ username: '', email: '' })

const openDialog = () => {
  dialogVisible.value = true
}

const openDrawer = () => {
  drawerVisible.value = true
}

const handleConfirm = () => {
  dialogVisible.value = false
}
</script>

<template>
  <div class="dialog-drawer-demo">
    <div class="trigger-row">
      <sweet-button type="primary" @click="openDialog">打开编辑弹窗</sweet-button>
      <sweet-button @click="openDrawer">打开详情抽屉</sweet-button>
    </div>

    <sweet-dialog
      v-model="dialogVisible"
      title="编辑用户"
      width="500px"
      draggable
      :close-on-click-modal="false"
    >
      <sweet-form :model="formData" label-width="80px">
        <sweet-form-item label="用户名">
          <sweet-input v-model="formData.username" />
        </sweet-form-item>
        <sweet-form-item label="邮箱">
          <sweet-input v-model="formData.email" />
        </sweet-form-item>
      </sweet-form>
      <template #footer>
        <sweet-button @click="dialogVisible = false">取消</sweet-button>
        <sweet-button type="primary" @click="handleConfirm">确定</sweet-button>
      </template>
    </sweet-dialog>

    <sweet-drawer v-model="drawerVisible" title="详情" direction="rtl" size="50%">
      <sweet-descriptions :column="1" border>
        <sweet-descriptions-item label="用户名">
          {{ detailData.username }}
        </sweet-descriptions-item>
        <sweet-descriptions-item label="邮箱">
          {{ detailData.email }}
        </sweet-descriptions-item>
      </sweet-descriptions>
    </sweet-drawer>
  </div>
</template>

<style scoped lang="less">
.trigger-row {
  display: flex;
  gap: var(--space-size-8);
  padding: var(--space-size-20);
}
</style>
