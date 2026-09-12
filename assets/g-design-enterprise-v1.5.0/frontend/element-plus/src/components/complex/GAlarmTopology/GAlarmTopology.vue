<template><div><el-alert v-if="criticalCount" :title="`${criticalCount} 个严重节点正在影响业务`" type="error" show-icon :closable="false"/><GTopology :nodes="nodes" :edges="edges" title="告警影响拓扑" @select="$emit('select',$event)"/></div></template>
<script setup>
import{computed}from'vue';import GTopology from'../GTopology/GTopology.vue';const p=defineProps({nodes:{type:Array,required:true},edges:{type:Array,required:true}});defineEmits(["select"]);const criticalCount=computed(()=>p.nodes.filter(n=>n.status==='danger').length);
</script>
