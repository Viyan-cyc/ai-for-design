<script setup>
import { reactive,ref } from 'vue'
import { SweetForm,SweetFormItem,SweetInput,SweetButton } from '@hw-seq/sweet-ui-base'
const form=reactive({name:''}),formRef=ref(),feedback=ref('')
const rules={name:[{required:true,message:'请输入名称',trigger:'blur'}]}
async function submit(){try{await formRef.value.validate();feedback.value='校验通过'}catch{feedback.value='请检查表单'}}
</script>
<template><SweetForm ref="formRef" :model="form" :rules="rules"><SweetFormItem label="名称" prop="name"><SweetInput v-model="form.name" /></SweetFormItem><SweetButton type="primary" @click="submit">提交</SweetButton></SweetForm><p role="status">{{ feedback }}</p></template>
