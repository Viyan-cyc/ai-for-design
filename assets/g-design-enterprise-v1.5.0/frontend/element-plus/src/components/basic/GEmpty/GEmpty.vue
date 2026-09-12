<template><ElEmpty v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElEmpty></template>
<script setup lang="ts">import{ElEmpty}from'element-plus';</script>
<style scoped src="./style.scss"></style>
