<template>
  <svg class="g-icon" xmlns="http://www.w3.org/2000/svg" :width="size" :height="size" viewBox="0 0 24 24" fill="none" :stroke="color" :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round" :aria-hidden="label?undefined:true" :aria-label="label" role="img">
    <component :is="node[0]" v-for="(node,index) in iconNodes" :key="index" v-bind="node[1]"/>
  </svg>
</template>
<script setup lang="ts">
import{computed}from'vue';import nodes from'../../../icons/icon-nodes.json';import aliases from'../../../icons/icon-aliases.json'
type IconNode=[string,Record<string,string|number>]
const p=withDefaults(defineProps<{name:string;size?:number|string;strokeWidth?:number;color?:string;label?:string}>(),{size:20,strokeWidth:2,color:'currentColor'})
const resolved=computed(()=>((aliases as Record<string,string>)[p.name]||p.name).toLowerCase().replace(/_/g,'-'))
const registry=nodes as unknown as Record<string,IconNode[]>
const iconNodes=computed(()=>registry[resolved.value]||registry['circle-question-mark'])
</script>
<style scoped src="./style.scss"></style>
