<template><ElSwitch v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElSwitch></template>
<script setup lang="ts">import{ElSwitch}from'element-plus';</script>
<style scoped src="./style.scss"></style>
