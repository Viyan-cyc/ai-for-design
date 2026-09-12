<template><el-table v-bind="$attrs" :data="data" stripe><slot/></el-table></template>
<script setup>
defineProps({data:{type:Array,default:()=>[]}});
</script>
<style lang="less" scoped>
:deep(.el-table){--el-table-header-bg-color:var(--g-bg-hover);--el-table-border-color:var(--g-border)}
</style>
