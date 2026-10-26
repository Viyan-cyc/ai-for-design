<script setup>
import { ref } from 'vue'
import { SweetSelect,SweetOption } from '@hw-seq/sweet-ui-base'
const value=ref('enabled')
</script>
<template><SweetSelect v-model="value" placeholder="请选择状态"><SweetOption label="启用" value="enabled" /><SweetOption label="停用" value="disabled" /></SweetSelect></template>
