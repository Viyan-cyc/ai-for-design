<template><ElInput v-bind="$attrs" :type="'textarea'"><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElInput></template>
<script setup lang="ts">import{ElInput}from'element-plus';</script>
<style scoped src="./style.scss"></style>
