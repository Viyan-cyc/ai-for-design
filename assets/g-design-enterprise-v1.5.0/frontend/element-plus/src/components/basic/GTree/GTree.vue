<template><ElTree v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElTree></template>
<script setup lang="ts">import{ElTree}from'element-plus';</script>
<style scoped src="./style.scss"></style>
