<template><transition name="bar"><section v-if="selectedCount>0" class="g-batch-bar"><span>已选择 <strong>{{selectedCount}}</strong> 项</span><div><slot/><el-button link @click="$emit('clear')">取消选择</el-button></div></section></transition></template><script setup>
defineProps({selectedCount:{type:Number,required:true}});defineEmits(["clear"]);
</script><style lang="less" scoped>
.g-batch-bar{display:flex;justify-content:space-between;align-items:center;padding:var(--space-10) var(--space-16);color:var(--g-text-primary);background:var(--spec-gbatch-action-bar-background);border:var(--border-width-normal) solid var(--g-focus);border-radius:var(--g-radius-md)}
</style>
