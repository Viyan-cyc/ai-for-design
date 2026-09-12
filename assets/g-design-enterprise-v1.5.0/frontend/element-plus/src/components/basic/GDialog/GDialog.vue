<template><ElDialog v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElDialog></template>
<script setup lang="ts">import{ElDialog}from'element-plus';</script>
<style scoped src="./style.scss"></style>
