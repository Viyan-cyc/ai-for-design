<template><section class="g-form-section"><header @click="collapsible&&(open=!open)"><div><h2>{{title}}</h2><p v-if="description">{{description}}</p></div><el-button v-if="collapsible" link>{{open?'收起':'展开'}}</el-button></header><div v-show="open" class="content"><slot/></div></section></template><script setup>
import{ref}from'vue';const p=defineProps({title:{type:String,required:true},description:{type:String},collapsible:{type:Boolean,default:false},defaultOpen:{type:Boolean,default:true}});const open=ref(p.defaultOpen);
</script><style lang="less" scoped>
.g-form-section{border:var(--border-width-normal) solid var(--g-border);border-radius:var(--g-radius-lg);background:var(--g-bg-surface)}header{display:flex;justify-content:space-between;padding:var(--space-16);cursor:pointer}h2,p{margin:0}p{margin-top:var(--space-6);color:var(--g-text-secondary)}.content{padding:0 var(--space-16) var(--space-16)}
</style>
