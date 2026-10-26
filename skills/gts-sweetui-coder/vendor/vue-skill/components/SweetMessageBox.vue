<script setup>
import { ref } from 'vue'
import { SweetButton,SweetMessageBox } from '@hw-seq/sweet-ui-base'
const feedback=ref('')
async function confirm(){try{await SweetMessageBox.confirm('确定执行此操作吗？','确认');feedback.value='已确认'}catch{feedback.value='已取消'}}
</script>
<template><SweetButton @click="confirm">确认操作</SweetButton><p role="status">{{ feedback }}</p></template>
