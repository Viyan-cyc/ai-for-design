<template><ElMenu v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElMenu></template>
<script setup lang="ts">import{ElMenu}from'element-plus';</script>
<style scoped src="./style.scss"></style>
