<template><div class="grid" :style="{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`}"><slot/></div></template>
<script setup>
defineProps({columns:{type:Number,default:4}});
</script>
<style lang="less" scoped>.grid{display:grid;gap:var(--g-panel-gap);align-items:stretch}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:560px){.grid{grid-template-columns:1fr!important}}</style>
