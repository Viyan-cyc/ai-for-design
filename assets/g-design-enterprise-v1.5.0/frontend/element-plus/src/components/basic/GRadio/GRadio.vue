<template><ElRadio v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElRadio></template>
<script setup lang="ts">import{ElRadio}from'element-plus';</script>
<style scoped src="./style.scss"></style>
