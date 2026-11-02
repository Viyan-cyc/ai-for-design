<script setup>
import { SweetInput, SweetButton, SweetIcon } from '@hw-seq/sweet-ui-base'
defineProps({modelValue:String,loading:Boolean})
const emit=defineEmits(['update:modelValue','search','reset'])
</script>
<template><div class="toolbar"><SweetInput class="search" :model-value="modelValue" clearable aria-label="设备名称" placeholder="输入设备名称" @update:model-value="emit('update:modelValue',$event)" @keyup.enter="emit('search')" /><SweetButton type="primary" :loading="loading" @click="emit('search')"><SweetIcon icon-class="sweetui-icon-search-l" />查询</SweetButton><SweetButton :disabled="loading" @click="emit('reset')">重置</SweetButton></div></template>
<style scoped>.toolbar { display:flex; flex-wrap:wrap; gap:var(--swt-space-size-12); margin-bottom:var(--swt-space-size-16); }.search { width:280px; max-width:100%; }</style>
