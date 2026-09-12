<template><section class="g-metric"><span>{{title}}</span><strong>{{value}}</strong><small :class="trend==='down'?'down':'up'">{{delta}}</small></section></template>
<script setup>
/** trend: 'up | down' */
defineProps({title:{type:String,required:true},value:{type:[String, Number],required:true},delta:{type:String},trend:{type:String}});
</script>
<style lang="less" scoped>.g-metric:not([data-material="frosted"]):not([data-surface="brand"]){background:var(--g-bg-surface);border:var(--border-width-normal) solid var(--g-border)}.g-metric{border-radius:var(--radius-medium);padding:var(--space-16);display:grid;gap:var(--space-8)}.g-metric span{color:var(--g-text-secondary)}.g-metric[data-surface="brand"]:not([data-material="frosted"]) :is(span,small){color:inherit}.g-metric strong{font-size:var(--spec-gmetric-card-font-size)}.up{color:var(--g-success)}.down{color:var(--g-urgent)}</style>
