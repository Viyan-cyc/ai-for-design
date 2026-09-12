<template><ElDatePicker v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElDatePicker></template>
<script setup>
import{ElDatePicker}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-date-time){font-family:var(--g-font-family)}
</style>
