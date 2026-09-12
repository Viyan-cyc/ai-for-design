<template><ElTimePicker v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElTimePicker></template>
<script setup>
import{ElTimePicker}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-date-time){font-family:var(--g-font-family)}
</style>
