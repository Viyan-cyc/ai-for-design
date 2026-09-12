<template><GTable :data="rows"><el-table-column prop="name" label="名称"/></GTable></template><script setup>
import GTable from './GTable.vue';const rows=[{name:'示例'}];
</script>
