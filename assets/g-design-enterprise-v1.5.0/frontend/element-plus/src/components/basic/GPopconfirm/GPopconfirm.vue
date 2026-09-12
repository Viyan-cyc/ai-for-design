<template><ElPopconfirm v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElPopconfirm></template>
<script setup lang="ts">import{ElPopconfirm}from'element-plus';</script>
<style scoped src="./style.scss"></style>
