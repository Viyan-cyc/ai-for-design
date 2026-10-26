<script setup>
import { ref } from 'vue'
import { SweetCheckbox,SweetCheckboxGroup } from '@hw-seq/sweet-ui-base'
const selected=ref([])
</script>
<template><SweetCheckboxGroup v-model="selected"><SweetCheckbox label="read">读取</SweetCheckbox><SweetCheckbox label="write">写入</SweetCheckbox></SweetCheckboxGroup></template>
