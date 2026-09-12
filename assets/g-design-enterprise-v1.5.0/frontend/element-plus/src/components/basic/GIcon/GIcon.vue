<template>
  <svg class="g-icon" xmlns="http://www.w3.org/2000/svg" :width="size" :height="size" viewBox="0 0 24 24" fill="none" :stroke="color" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round" :aria-hidden="label?undefined:true" :aria-label="label" role="img">
    <component :is="node[0]" v-for="(node,index) in iconNodes" :key="index" v-bind="node[1]"/>
  </svg>
</template>
<script setup>
import{computed}from'vue';import nodes from'../../../icons/icon-nodes.json';import aliases from'../../../icons/icon-aliases.json'

const p=defineProps({name:{type:String,required:true},size:{type:[String, Number],default:20},strokeWidth:{type:Number,default:2},color:{type:String,default:'currentColor'},label:{type:String}})
const resolved=computed(()=>((aliases)[p.name]||p.name).toLowerCase().replace(/_/g,'-'))
const registry=nodes
const iconNodes=computed(()=>registry[resolved.value]||registry['circle-question-mark'])
</script>
<style lang="less" scoped>
.g-icon{display:inline-block;flex:none;vertical-align:-0.125em;color:inherit}
</style>
