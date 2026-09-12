<template><header class="g-table-toolbar"><div><strong>{{title}}</strong><span v-if="count!==undefined">共 {{count}} 条</span></div><div class="actions"><slot name="left"/><slot name="actions"/><el-tooltip content="刷新"><el-button aria-label="刷新" @click="$emit('refresh')">↻</el-button></el-tooltip></div></header></template><script setup>
defineProps({title:{type:String,default:'数据列表'},count:{type:Number}});defineEmits(["refresh"]);
</script><style lang="less" scoped>
.g-table-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-12)}.g-table-toolbar>div{display:flex;align-items:center;gap:var(--space-12)}.g-table-toolbar span{font-size:var(--font-size-small);color:var(--g-text-secondary)}.actions{display:flex;gap:var(--space-8)}
</style>
