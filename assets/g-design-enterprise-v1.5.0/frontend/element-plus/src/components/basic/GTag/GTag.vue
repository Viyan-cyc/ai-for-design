<template><ElTag v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElTag></template>
<script setup>
import{ElTag}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-feedback){font-family:var(--g-font-family)}
</style>
