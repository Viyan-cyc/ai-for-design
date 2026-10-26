<script setup>
import { ref } from 'vue'
import { SweetButton,SweetDialog } from '@hw-seq/sweet-ui-base'
const visible=ref(false)
</script>
<template><SweetButton @click="visible=true">打开弹窗</SweetButton><SweetDialog v-model="visible" title="详情" width="min(520px, 92vw)"><p>详情内容</p><template #footer><SweetButton @click="visible=false">关闭</SweetButton></template></SweetDialog></template>
