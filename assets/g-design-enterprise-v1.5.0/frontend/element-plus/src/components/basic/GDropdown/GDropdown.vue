<template><ElDropdown v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElDropdown></template>
<script setup lang="ts">import{ElDropdown}from'element-plus';</script>
<style scoped src="./style.scss"></style>
