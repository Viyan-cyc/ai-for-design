<template><ElMenu v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElMenu></template>
<script setup>
import{ElMenu}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-navigation){font-family:var(--g-font-family)}
</style>
