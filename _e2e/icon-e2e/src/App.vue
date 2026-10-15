<script setup>
// 应用壳：只挂载目标页面（交付入口；真实工程中由路由/布局替换）
// 无内置切换 UI —— 国际化 / 主题切换均为按需能力，用户要求时在此接入，
// 装配与参考实现由生成方提供，UI 形态按用户描述决定。
import Page from './pages/IconE2e/index.vue'
</script>

<template>
  <Page />
</template>
