<script setup>
import { ref, reactive, watch, nextTick } from 'vue'
import { SweetDialog, SweetForm, SweetFormItem, SweetInput, SweetButton, SweetMessage } from '@hw-seq/sweet-ui-base'
import { saveRecord } from '../../../api/records.js'
const props = defineProps({ modelValue: Boolean, record: Object })
const emit = defineEmits(['update:modelValue', 'saved'])
const form = reactive({ id: null, name: '', status: '' })
const formRef = ref()
const saving = ref(false)
const rules = { name: [{ required: true, whitespace: true, message: '请输入名称', trigger: 'blur' }] }
watch(() => props.modelValue, async open => {
  if (!open || !props.record) return
  Object.assign(form, props.record)
  await nextTick()
  formRef.value?.clearValidate()
})
function close() { if (!saving.value) emit('update:modelValue', false) }
async function submit() {
  if (saving.value || !formRef.value) return
  saving.value = true
  try {
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    await saveRecord({ ...form })
    SweetMessage.success('保存成功')
    emit('saved')
    emit('update:modelValue', false)
  } catch (e) { SweetMessage.error(e.message || '保存失败') }
  finally { saving.value = false }
}
</script>
<template>
  <SweetDialog :model-value="modelValue" title="编辑设备" draggable :close-on-click-modal="false" :before-close="done => { if (!saving) done() }" @update:model-value="close">
    <SweetForm ref="formRef" :model="form" :rules="rules" label-width="80px">
      <SweetFormItem label="名称" prop="name"><SweetInput v-model="form.name" :disabled="saving" /></SweetFormItem>
    </SweetForm>
    <template #footer>
      <SweetButton :disabled="saving" @click="close">取消</SweetButton>
      <SweetButton type="primary" :loading="saving" @click="submit">保存</SweetButton>
    </template>
  </SweetDialog>
</template>
