<script setup>
import { ref, reactive } from 'vue'
import { ElButton, ElDialog, ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElTable, ElTableColumn, ElMessage } from 'element-plus'
import { createRecord } from '../../api/records.js'

const visible = ref(false)
const saving = ref(false)
const formRef = ref()
const records = ref([])
const form = reactive({ name: '', category: 'service' })
const rules = { name: [{ required: true, message: '请输入名称', trigger: 'blur' }] }
function openCreate() {
  Object.assign(form, { name: '', category: 'service' })
  visible.value = true
}
async function submit() {
  if (saving.value) return
  let valid = false
  try { valid = await formRef.value.validate() } catch { return }
  if (!valid) return
  saving.value = true
  try {
    const record = await createRecord({ ...form })
    records.value = [...records.value, record]
    visible.value = false
    ElMessage.success('创建成功')
  } catch {
    ElMessage.error('创建失败，请重试')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="page-root">
    <header class="page-header">
      <h1 class="page-title">资源管理</h1>
      <ElButton type="primary" @click="openCreate">新建资源</ElButton>
    </header>
    <ElTable :data="records" empty-text="暂无资源，请新建">
      <ElTableColumn prop="name" label="名称" min-width="180" />
      <ElTableColumn label="分类" min-width="120">
        <template #default="{ row }">{{ row.category === 'service' ? '服务' : '设备' }}</template>
      </ElTableColumn>
    </ElTable>
    <ElDialog v-model="visible" title="新建资源" width="min(520px, 92vw)" :close-on-click-modal="false" destroy-on-close>
      <ElForm ref="formRef" :model="form" :rules="rules" label-position="top">
        <ElFormItem label="名称" prop="name">
          <ElInput v-model="form.name" placeholder="请输入资源名称" maxlength="64" />
        </ElFormItem>
        <ElFormItem label="分类" prop="category">
          <ElSelect v-model="form.category" class="field">
            <ElOption label="服务" value="service" />
            <ElOption label="设备" value="device" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="saving" @click="visible = false">取消</ElButton>
        <ElButton type="primary" :loading="saving" @click="submit">创建</ElButton>
      </template>
    </ElDialog>
  </main>
</template>

<style scoped lang="less">
.page-root { min-height: 100%; padding: var(--space-size-24); }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-size-16); margin-bottom: var(--space-size-24); }
.page-title { margin: 0; font-size: var(--font-size-normal1); font-weight: var(--font-weight-bold); color: var(--color-text-primary); }
.field { width: 100%; }
</style>
