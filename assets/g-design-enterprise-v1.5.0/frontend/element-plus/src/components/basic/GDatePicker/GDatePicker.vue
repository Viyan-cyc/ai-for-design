<template><ElDatePicker v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElDatePicker></template>
<script setup lang="ts">import{ElDatePicker}from'element-plus';</script>
<style scoped src="./style.scss"></style>
