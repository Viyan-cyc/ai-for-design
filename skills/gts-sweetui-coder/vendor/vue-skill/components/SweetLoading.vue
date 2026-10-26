<script setup>
import { ref } from 'vue'
import { SweetButton } from '@hw-seq/sweet-ui-base'
const busy=ref(false)
async function submit(){busy.value=true;try{await Promise.resolve()}finally{busy.value=false}}
</script>
<template><SweetButton :loading="busy" @click="submit">提交</SweetButton></template>
