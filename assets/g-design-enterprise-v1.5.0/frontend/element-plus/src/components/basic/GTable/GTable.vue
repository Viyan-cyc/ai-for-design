<template><el-table v-bind="$attrs" :data="data" stripe><slot/></el-table></template>
<script setup lang="ts">defineProps({data:{type:Array,default:()=>[]}});</script>
<style scoped src="./style.scss"></style>
