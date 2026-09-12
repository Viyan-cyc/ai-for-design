<template><section class="g-resource-tree"><el-input v-model="keyword" clearable placeholder="搜索资源" @input="tree?.filter(keyword)"/><el-tree ref="tree" :data="data" :props="props" node-key="id" highlight-current :filter-node-method="filterNode" @node-click="$emit('select',$event)"/></section></template><script setup>
import{ref}from'vue';defineProps({data:{type:Array,required:true},props:{type:Object,default:()=>({label:'label',children:'children'})}});defineEmits(["select"]);const keyword=ref('');const tree=ref();const filterNode=(value,data)=>!value||String(data.label||'').toLowerCase().includes(value.toLowerCase());
</script><style lang="less" scoped>
.g-resource-tree{display:grid;gap:var(--space-12);padding:var(--space-12);border:var(--border-width-normal) solid var(--g-border);border-radius:var(--g-radius-md);background:var(--g-bg-surface)}
</style>
