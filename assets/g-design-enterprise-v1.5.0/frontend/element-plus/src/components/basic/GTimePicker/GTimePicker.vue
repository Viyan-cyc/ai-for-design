<template><ElTimePicker v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElTimePicker></template>
<script setup lang="ts">import{ElTimePicker}from'element-plus';</script>
<style scoped src="./style.scss"></style>
