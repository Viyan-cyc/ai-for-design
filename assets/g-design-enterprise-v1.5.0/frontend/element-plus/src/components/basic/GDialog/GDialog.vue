<template><ElDialog v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElDialog></template>
<script setup>
import{ElDialog}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-overlay){font-family:var(--g-font-family)}
</style>
