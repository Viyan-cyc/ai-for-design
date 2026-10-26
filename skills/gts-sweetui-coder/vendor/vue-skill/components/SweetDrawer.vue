<script setup>
import { ref } from 'vue'
import { SweetButton,SweetDrawer } from '@hw-seq/sweet-ui-base'
const visible=ref(false)
</script>
<template><SweetButton @click="visible=true">查看详情</SweetButton><SweetDrawer v-model="visible" title="详情" direction="rtl" size="50%"><slot>详情内容</slot></SweetDrawer></template>
