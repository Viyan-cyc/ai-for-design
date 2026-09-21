<script setup>
import { ref, reactive } from 'vue'
import { ElDialog, ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElButton } from 'element-plus'

defineOptions({ name: 'FormDialog' })

defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    default: '编辑'
  },
  width: {
    type: String,
    default: '600px'
  }
})

const emit = defineEmits(['update:visible', 'submit', 'cancel'])

const formRef = ref()
const formData = reactive({})
const formRules = reactive({})

const handleClose = () => {
  emit('update:visible', false)
  emit('cancel')
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (valid) {
    emit('submit', { ...formData })
  }
}

const handleReset = () => {
  formRef.value?.resetFields()
}
</script>

<template>
  <ElDialog
    :model-value="visible"
    :title="title"
    :width="width"
    draggable
    :close-on-click-modal="false"
    @update:model-value="(val) => emit('update:visible', val)"
  >
    <ElForm
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-position="top"
      class="dialog-form"
    >
      <slot :form-data="formData" :form-rules="formRules" />
    </ElForm>

    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="handleReset">重置</ElButton>
        <ElButton @click="handleClose">取消</ElButton>
        <ElButton type="primary" @click="handleSubmit">确定</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped lang="less">
.dialog-form {
  padding: var(--space-size-4) 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-size-8);
}
</style>
