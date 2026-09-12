<template><ElDrawer v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElDrawer></template>
<script setup>
import{ElDrawer}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-overlay){font-family:var(--g-font-family)}
</style>
