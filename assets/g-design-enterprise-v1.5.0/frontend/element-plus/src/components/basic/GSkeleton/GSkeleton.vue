<template><ElSkeleton v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElSkeleton></template>
<script setup>
import{ElSkeleton}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-state){font-family:var(--g-font-family)}
</style>
