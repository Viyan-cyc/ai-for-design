<script setup>
import { SweetButton } from '@hw-seq/sweet-ui-base'
const emit=defineEmits(['search'])
</script>
<template><SweetButton type="primary" @click="emit('search')"><i class="sweetui-icon-search-l" aria-hidden="true"></i>查询</SweetButton></template>
