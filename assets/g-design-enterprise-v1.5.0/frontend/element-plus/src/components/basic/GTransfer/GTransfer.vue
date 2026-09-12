<template><ElTransfer v-bind="$attrs" ><template v-for="(_,slot) in $slots" #[slot]="scope"><slot :name="slot" v-bind="scope||{}"/></template></ElTransfer></template>
<script setup lang="ts">import{ElTransfer}from'element-plus';</script>
<style scoped src="./style.scss"></style>
