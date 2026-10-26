<script setup>
import { ref } from 'vue'
import { SweetSwitch } from '@hw-seq/sweet-ui-base'
const enabled=ref(true)
</script>
<template><SweetSwitch v-model="enabled" /><span>{{ enabled?'启用':'停用' }}</span></template>
