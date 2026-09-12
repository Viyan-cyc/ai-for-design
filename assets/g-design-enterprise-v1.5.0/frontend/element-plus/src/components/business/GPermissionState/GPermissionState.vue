<template><section class="g-permission"><el-result icon="warning" :title="title" :sub-title="description"><template #extra><slot><el-button type="primary" @click="$emit('request')">申请权限</el-button></slot></template></el-result></section></template><script setup>
defineProps({title:{type:String,default:'暂无访问权限'},description:{type:String,default:'请联系管理员或提交权限申请'}});defineEmits(["request"]);
</script><style lang="less" scoped>
.g-permission{display:grid;min-height:var(--spec-gpermission-state-min-height);place-items:center;background:var(--g-bg-surface)}
</style>
