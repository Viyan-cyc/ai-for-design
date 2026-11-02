<script setup>
import { reactive, ref } from 'vue'
import { ElForm, ElFormItem, ElInput, ElSelect, ElOption, ElDatePicker, ElButton } from 'element-plus'

defineOptions({ name: 'FormDemo' })

const formRef = ref()

const formData = reactive({
  name: '',
  region: '',
  date: ''
})

const rules = reactive({
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  region: [{ required: true, message: '请选择区域', trigger: 'change' }]
})

const regionOptions = [
  { value: 'east', label: '华东' },
  { value: 'north', label: '华北' },
  { value: 'south', label: '华南' }
]

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (valid) {
    // 提交逻辑
  }
}
</script>

<template>
  <ElForm
    ref="formRef"
    :model="formData"
    :rules="rules"
    label-width="80px"
    class="demo-form"
  >
    <ElFormItem label="名称" prop="name">
      <ElInput v-model="formData.name" placeholder="请输入名称" />
    </ElFormItem>

    <ElFormItem label="区域" prop="region">
      <ElSelect v-model="formData.region" placeholder="请选择" class="demo-select">
        <ElOption
          v-for="item in regionOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </ElSelect>
    </ElFormItem>

    <ElFormItem label="日期">
      <ElDatePicker v-model="formData.date" type="date" placeholder="选择日期" />
    </ElFormItem>

    <ElFormItem>
      <ElButton type="primary" @click="handleSubmit">提交</ElButton>
    </ElFormItem>
  </ElForm>
</template>

<style scoped lang="less">
.demo-form {
  width: 400px;
}

.demo-select {
  width: 100%;
}
</style>
