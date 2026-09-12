<template><ElCollapse v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElCollapse></template>
<script setup>
import{ElCollapse}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-data){font-family:var(--g-font-family)}
</style>
