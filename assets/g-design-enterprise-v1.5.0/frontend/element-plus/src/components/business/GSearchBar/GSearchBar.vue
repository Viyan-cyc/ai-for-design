<template><div class="g-search"><el-input :model-value="modelValue" clearable :placeholder="placeholder" @update:model-value="$emit('update:modelValue',$event)" @keyup.enter="$emit('search',modelValue)"/><el-button type="primary" @click="$emit('search',modelValue)">查询</el-button><el-button @click="$emit('reset')">重置</el-button></div></template>
<script setup>
defineProps({modelValue:{type:String,required:true},placeholder:{type:String,default:'请输入关键词'}});defineEmits(["update:modelValue","search","reset"]);
</script>
<style lang="less" scoped>.g-search{display:flex;gap:var(--space-8)}.g-search .el-input{max-width:var(--spec-gsearch-bar-max-width)}</style>
