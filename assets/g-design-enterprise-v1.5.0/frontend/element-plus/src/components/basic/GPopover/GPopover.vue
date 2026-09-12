<template><ElPopover v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElPopover></template>
<script setup lang="ts">import{ElPopover}from'element-plus';</script>
<style scoped src="./style.scss"></style>
