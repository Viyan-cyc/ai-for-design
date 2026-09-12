<template><el-tag :type="tagType" effect="light">{{ label || labels[status] }}</el-tag></template>
<script setup>
import{computed}from'vue';const p=/** status: 'normal | success | warning | danger | offline' */
defineProps({status:{type:String,default:'normal'},label:{type:String}});const labels={normal:'正常',success:'成功',warning:'警告',danger:'严重',offline:'离线'};const tagType=computed(()=>({normal:'primary',success:'success',warning:'warning',danger:'danger',offline:'info'}[p.status]));
</script>
