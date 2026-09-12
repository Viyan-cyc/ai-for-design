<template><ElTabs v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElTabs></template>
<script setup>
import{ElTabs}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-navigation){font-family:var(--g-font-family)}
</style>
