<template><section class="g-filter-bar"><div class="filters"><slot/><slot v-if="expanded" name="advanced"/></div><div class="actions"><el-button v-if="$slots.advanced" link type="primary" @click="expanded=!expanded">{{expanded?'收起':'更多筛选'}}</el-button><el-button @click="$emit('reset')">重置</el-button><el-button type="primary" @click="$emit('search')">查询</el-button></div></section></template><script setup>
import{ref}from'vue';defineEmits(["search","reset"]);const expanded=ref(false);
</script><style lang="less" scoped>
.g-filter-bar{display:flex;justify-content:space-between;gap:var(--space-16);padding:var(--space-16);border:var(--border-width-normal) solid var(--g-border);border-radius:var(--g-radius-lg);background:var(--g-bg-surface)}.filters,.actions{display:flex;align-items:flex-start;flex-wrap:wrap;gap:var(--space-8)}
</style>
