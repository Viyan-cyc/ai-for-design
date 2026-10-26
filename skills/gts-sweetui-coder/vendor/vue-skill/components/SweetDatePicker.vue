<script setup>
import { ref } from 'vue'
import { SweetDatePicker } from '@hw-seq/sweet-ui-base'
const date=ref(null)
</script>
<template><SweetDatePicker v-model="date" type="datetime" placeholder="选择日期时间" /></template>
