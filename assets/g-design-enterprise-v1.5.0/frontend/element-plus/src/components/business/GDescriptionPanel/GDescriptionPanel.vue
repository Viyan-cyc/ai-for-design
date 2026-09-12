<template><section class="g-description"><header><h2>{{title}}</h2><slot name="actions"/></header><el-descriptions :column="columns" border><el-descriptions-item v-for="item in items" :key="item.label" :label="item.label"><slot :name="item.key||item.label" :item="item">{{item.value??'-'}}</slot></el-descriptions-item></el-descriptions></section></template><script setup>
defineProps({title:{type:String,default:'基本信息'},items:{type:Array,required:true},columns:{type:Number,default:2}});
</script><style lang="less" scoped>
.g-description{display:grid;gap:var(--space-12)}.g-description>header{display:flex;justify-content:space-between;align-items:center}.g-description h2{margin:0;font-size:var(--spec-gdescription-panel-font-size)}
</style>
