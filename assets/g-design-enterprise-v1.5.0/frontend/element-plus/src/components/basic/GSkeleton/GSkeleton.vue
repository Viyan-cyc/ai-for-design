<template><ElSkeleton v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElSkeleton></template>
<script setup lang="ts">import{ElSkeleton}from'element-plus';</script>
<style scoped src="./style.scss"></style>
