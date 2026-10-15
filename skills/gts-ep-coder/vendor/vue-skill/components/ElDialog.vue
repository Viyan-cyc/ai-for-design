<script setup>
import { ref } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput, ElButton } from 'element-plus'

defineOptions({ name: 'DialogDemo' })

const visible = ref(false)
const name = ref('')
</script>

<template>
  <div class="demo-block">
    <ElButton type="primary" @click="visible = true">打开对话框</ElButton>

    <ElDialog v-model="visible" title="编辑" draggable :close-on-click-modal="false">
      <ElForm label-width="80px">
        <ElFormItem label="名称">
          <ElInput v-model="name" placeholder="请输入名称" />
        </ElFormItem>
      </ElForm>

      <template #footer>
        <div class="dialog-footer">
          <ElButton @click="visible = false">取消</ElButton>
          <ElButton type="primary" @click="visible = false">确定</ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped lang="less">
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-size-8);
}
</style>
