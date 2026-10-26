<script setup>
import { SweetTable,SweetTableColumn } from '@hw-seq/sweet-ui-base'
defineProps({rows:{type:Array,default:()=>[]}})
</script>
<template><SweetTable :data="rows" :height="320" row-key="id"><SweetTableColumn prop="name" label="名称" min-width="180" /><SweetTableColumn label="状态" min-width="120"><template #default="{row}">{{ row.state }}</template></SweetTableColumn></SweetTable></template>
