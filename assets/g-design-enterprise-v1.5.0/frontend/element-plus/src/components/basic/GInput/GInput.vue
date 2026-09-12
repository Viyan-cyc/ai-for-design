<template><el-input v-bind="$attrs" :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)"><template v-if="$slots.prefix" #prefix><slot name="prefix"/></template></el-input></template>
<script setup lang="ts">defineProps({modelValue:String});defineEmits(['update:modelValue']);</script>
<style scoped src="./style.scss"></style>
