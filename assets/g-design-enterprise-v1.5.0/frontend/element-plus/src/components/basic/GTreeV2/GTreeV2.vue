<template><ElTreeV2 v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElTreeV2></template>
<script setup lang="ts">import{ElTreeV2}from'element-plus';</script>
<style scoped src="./style.scss"></style>
