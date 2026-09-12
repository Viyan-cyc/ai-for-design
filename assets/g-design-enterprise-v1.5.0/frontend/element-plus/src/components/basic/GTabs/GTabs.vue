<template><ElTabs v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElTabs></template>
<script setup lang="ts">import{ElTabs}from'element-plus';</script>
<style scoped src="./style.scss"></style>
