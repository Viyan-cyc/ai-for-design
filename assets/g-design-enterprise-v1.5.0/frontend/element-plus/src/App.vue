<script setup lang="ts">
import { ref } from 'vue'
import Page from './selected-template'
import { config } from './page-config'
const state=ref(config.state)
</script>
<template><div :data-theme="config.theme" :data-visual-style="config.visualStyle"><Page :state="state" @retry="state='ready'"/></div></template>
