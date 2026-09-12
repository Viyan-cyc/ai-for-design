<template><el-button v-bind="$attrs" :type="type"><slot /></el-button></template>
<script setup lang="ts">import type{GButtonType}from'./types';withDefaults(defineProps<{type?:GButtonType}>(),{type:'default'});</script>
<style scoped src="./style.scss"></style>
