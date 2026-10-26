<script setup>
import { ref } from 'vue'
import { SweetPagination } from '@hw-seq/sweet-ui-base'
const page=ref(1),size=ref(10)
defineProps({total:{type:Number,default:0}})
const emit=defineEmits(['change'])
</script>
<template><SweetPagination v-model:current-page="page" v-model:page-size="size" :total="total" layout="total, prev, pager, next" @current-change="emit('change',page)" /></template>
