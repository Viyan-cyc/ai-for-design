<template><ElForm v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElForm></template>
<script setup>
import{ElForm}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-form){font-family:var(--g-font-family)}
</style>
