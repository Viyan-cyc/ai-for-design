<template><ElAutocomplete v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElAutocomplete></template>
<script setup lang="ts">import{ElAutocomplete}from'element-plus';</script>
<style scoped src="./style.scss"></style>
