<template><ElSelect v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElSelect></template>
<script setup>
import{ElSelect}from'element-plus';
</script>
<style lang="less" scoped>
:deep(.el-selection){font-family:var(--g-font-family)}
</style>
