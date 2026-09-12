<template><ElEmpty v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElEmpty></template>
<script setup>
import{ElEmpty}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-state){font-family:var(--g-font-family)}
</style>
