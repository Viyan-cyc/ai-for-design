<template><ElCascader v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElCascader></template>
<script setup>
import{ElCascader}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-selection){font-family:var(--g-font-family)}
</style>
