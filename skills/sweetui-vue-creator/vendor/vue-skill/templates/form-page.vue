<script setup>
import { reactive, ref } from 'vue'
import {
  SweetCard,
  SweetForm,
  SweetFormItem,
  SweetInput,
  SweetSelect,
  SweetOption,
  SweetDatePicker,
  SweetSwitch,
  SweetCheckboxGroup,
  SweetCheckbox,
  SweetButton,
} from '@hw-seq/sweet-ui-base'

defineOptions({ name: 'FormPage' })

const formRef = ref()
const submitting = ref(false)

const formData = reactive({
  username: '',
  password: '',
  role: '',
  createTime: '',
  enabled: true,
  permissions: [],
  remark: '',
})

const formRules = reactive({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少 6 位', trigger: 'blur' },
  ],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
})

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (!valid) return
  submitting.value = true
  setTimeout(() => {
    submitting.value = false
  }, 500)
}

const handleReset = () => {
  formRef.value?.resetFields()
}
</script>

<template>
  <div class="form-page">
    <sweet-card class="form-card">
      <sweet-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
      >
        <sweet-form-item label="用户名" prop="username">
          <sweet-input v-model="formData.username" placeholder="请输入用户名" />
        </sweet-form-item>
        <sweet-form-item label="密码" prop="password">
          <sweet-input
            v-model="formData.password"
            type="password"
            show-password
            placeholder="请输入密码"
          />
        </sweet-form-item>
        <sweet-form-item label="角色" prop="role">
          <sweet-select v-model="formData.role" placeholder="请选择角色">
            <sweet-option label="管理员" value="admin" />
            <sweet-option label="普通用户" value="user" />
          </sweet-select>
        </sweet-form-item>
        <sweet-form-item label="创建时间" prop="createTime">
          <sweet-date-picker
            v-model="formData.createTime"
            type="datetime"
            placeholder="选择日期时间"
          />
        </sweet-form-item>
        <sweet-form-item label="启用状态" prop="enabled">
          <sweet-switch v-model="formData.enabled" />
        </sweet-form-item>
        <sweet-form-item label="权限" prop="permissions">
          <sweet-checkbox-group v-model="formData.permissions">
            <sweet-checkbox label="read">读取</sweet-checkbox>
            <sweet-checkbox label="write">写入</sweet-checkbox>
            <sweet-checkbox label="delete">删除</sweet-checkbox>
          </sweet-checkbox-group>
        </sweet-form-item>
        <sweet-form-item label="备注" prop="remark">
          <sweet-input
            v-model="formData.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入备注"
          />
        </sweet-form-item>
        <sweet-form-item>
          <sweet-button @click="handleReset">重置</sweet-button>
          <sweet-button type="primary" :loading="submitting" @click="handleSubmit">
            提交
          </sweet-button>
        </sweet-form-item>
      </sweet-form>
    </sweet-card>
  </div>
</template>

<style scoped lang="less">
.form-page {
  padding: var(--space-size-20);
  background: var(--color-bg-1);
  min-height: 100%;
}

.form-card {
  max-width: 720px;
}
</style>
