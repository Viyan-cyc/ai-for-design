<template><ElLink v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElLink></template>
<script setup>
import{ElLink}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-link){font-family:var(--g-font-family)}
</style>
