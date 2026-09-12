<template><ElResult v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElResult></template>
<script setup lang="ts">import{ElResult}from'element-plus';</script>
<style scoped src="./style.scss"></style>
