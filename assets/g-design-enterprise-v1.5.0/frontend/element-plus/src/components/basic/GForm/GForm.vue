<template><ElForm v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElForm></template>
<script setup lang="ts">import{ElForm}from'element-plus';</script>
<style scoped src="./style.scss"></style>
