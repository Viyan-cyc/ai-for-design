<template><ElResult v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElResult></template>
<script setup>
import{ElResult}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-state){font-family:var(--g-font-family)}
</style>
