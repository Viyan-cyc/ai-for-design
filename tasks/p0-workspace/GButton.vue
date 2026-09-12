<!-- 源: g-design 1.5.0 g-button（按 component-format v1 迁移，types.ts/style.scss 已内联/消除） -->
<template><el-button v-bind="$attrs" :type="type"><slot /></el-button></template>
<script setup>defineProps({ type: { type: String, default: 'default' } });</script>
<style lang="less" scoped>:deep(.el-button){font-family:var(--g-font-family);border-radius:var(--g-control-radius)}</style>
