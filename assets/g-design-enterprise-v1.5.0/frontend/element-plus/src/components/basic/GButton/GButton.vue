<template><el-button v-bind="$attrs" :type="type"><slot /></el-button></template>
<script setup>
/** type: 'primary | success | warning | danger | info | default' */
defineProps({type:{type:String,default:'default'}});
</script>
<style lang="less" scoped>
:deep(.el-button){font-family:var(--g-font-family);border-radius:var(--g-control-radius)}
</style>
