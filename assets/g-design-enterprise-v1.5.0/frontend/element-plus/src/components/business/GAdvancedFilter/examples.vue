<template><GAdvancedFilter v-model="conditions" :fields="fields"/></template><script setup>
import{ref}from'vue';import GAdvancedFilter from './GAdvancedFilter.vue';const conditions=ref([]);const fields=[{label:'名称',value:'name'}];
</script>
