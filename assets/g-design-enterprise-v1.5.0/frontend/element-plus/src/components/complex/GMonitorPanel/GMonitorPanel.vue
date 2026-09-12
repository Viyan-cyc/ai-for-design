<template><section class="monitor"><header><strong>{{title}}</strong><GStatusTag :status="status"/></header><div class="value">{{value}}<small>{{unit}}</small></div><div class="bars"><i v-for="n in 20" :key="n" :style="{height:(20+((n*17)%60))+'%'}"/></div></section></template>
<script setup>
import GStatusTag from'../../business/GStatusTag/GStatusTag.vue';/** status: 'normal | success | warning | danger | offline' */
defineProps({title:{type:String,required:true},value:{type:[String, Number],required:true},unit:{type:String},status:{type:String,default:'normal'}});
</script>
<style lang="less" scoped>.monitor{padding:var(--space-16);border:var(--border-width-normal) solid var(--g-border);border-radius:var(--radius-medium);background:var(--g-bg-surface)}header{display:flex;justify-content:space-between}.value{font-size:var(--font-size-x-large);margin:var(--space-16) 0}.value small{font-size:var(--font-size-small);margin-left:var(--space-4);color:var(--g-text-secondary)}.bars{height:var(--spec-gmonitor-panel-height);display:flex;align-items:end;gap:var(--space-4)}.bars i{flex:1;background:var(--g-accent);opacity:.65;border-radius:var(--radius-small)}</style>
