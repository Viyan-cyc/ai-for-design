<template><ElPagination v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElPagination></template>
<script setup>
import{ElPagination}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-data){font-family:var(--g-font-family)}
</style>
