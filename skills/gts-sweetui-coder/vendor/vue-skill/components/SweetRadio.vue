<script setup>
import { ref } from 'vue'
import { SweetRadio,SweetRadioGroup } from '@hw-seq/sweet-ui-base'
const selected=ref('daily')
</script>
<template><SweetRadioGroup v-model="selected"><SweetRadio label="daily">每日</SweetRadio><SweetRadio label="weekly">每周</SweetRadio></SweetRadioGroup></template>
