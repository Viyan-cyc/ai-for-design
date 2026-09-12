<template><ElTreeV2 v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElTreeV2></template>
<script setup>
import{ElTreeV2}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-data){font-family:var(--g-font-family)}
</style>
