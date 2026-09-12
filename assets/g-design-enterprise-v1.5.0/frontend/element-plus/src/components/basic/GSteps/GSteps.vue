<template><ElSteps v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElSteps></template>
<script setup lang="ts">import{ElSteps}from'element-plus';</script>
<style scoped src="./style.scss"></style>
