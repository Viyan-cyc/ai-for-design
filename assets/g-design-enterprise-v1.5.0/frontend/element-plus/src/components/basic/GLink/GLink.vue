<template><ElLink v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElLink></template>
<script setup lang="ts">import{ElLink}from'element-plus';</script>
<style scoped src="./style.scss"></style>
