<template><header class="g-page-header"><div><el-breadcrumb v-if="breadcrumbs?.length"><el-breadcrumb-item v-for="item in breadcrumbs" :key="item">{{item}}</el-breadcrumb-item></el-breadcrumb><h1>{{title}}</h1><p v-if="subtitle">{{subtitle}}</p></div><div class="actions"><slot name="actions"/></div></header></template><script setup>
defineProps({title:{type:String,required:true},subtitle:{type:String},breadcrumbs:{type:Array}});
</script><style lang="less" scoped>
.g-page-header{display:flex;justify-content:space-between;align-items:flex-start;padding:0 0 var(--space-16);border-bottom:var(--border-width-normal) solid var(--g-border)}h1{margin:var(--space-8) 0 0;font-size:var(--font-size-large)}p{margin:var(--space-6) 0 0;color:var(--g-text-secondary)}.actions{display:flex;gap:var(--space-8)}
</style>
