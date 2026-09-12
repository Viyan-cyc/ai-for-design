<template><ElInputNumber v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElInputNumber></template>
<script setup>
import{ElInputNumber}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-input){font-family:var(--g-font-family)}
</style>
