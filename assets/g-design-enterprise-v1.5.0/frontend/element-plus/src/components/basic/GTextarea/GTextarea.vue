<template><ElInput v-bind="$attrs" :type="'textarea'"><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElInput></template>
<script setup>
import{ElInput}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-input){font-family:var(--g-font-family)}
</style>
