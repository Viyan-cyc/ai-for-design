<template><ElUpload v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElUpload></template>
<script setup lang="ts">import{ElUpload}from'element-plus';</script>
<style scoped src="./style.scss"></style>
