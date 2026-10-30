<script setup>
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import Page from './pages/WorkbenchFoundation/index.vue'
</script>
<template><ElConfigProvider :locale="zhCn"><Page /></ElConfigProvider></template>
