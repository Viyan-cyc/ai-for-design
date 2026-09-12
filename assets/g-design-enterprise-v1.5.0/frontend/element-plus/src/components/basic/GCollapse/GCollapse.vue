<template><ElCollapse v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElCollapse></template>
<script setup lang="ts">import{ElCollapse}from'element-plus';</script>
<style scoped src="./style.scss"></style>
