<script setup>
import { ref } from 'vue'
import { SweetInput } from '@hw-seq/sweet-ui-base'
const keyword=ref('')
</script>
<template><SweetInput v-model="keyword" placeholder="请输入名称" clearable /></template>
