<script setup>
import { ref } from 'vue'
import { SweetButton,SweetEmpty } from '@hw-seq/sweet-ui-base'
const state=ref('ready')
</script>
<template><main class="page"><nav><SweetButton v-for="value in ['ready','loading','empty','error']" :key="value" @click="state=value">{{ value }}</SweetButton></nav><p v-if="state==='loading'" role="status">正在加载…</p><SweetEmpty v-else-if="state==='empty'" /><section v-else-if="state==='error'" role="alert">加载失败<SweetButton @click="state='ready'">重试</SweetButton></section><section v-else><h1>资源列表</h1><p>当前内容已就绪。</p></section></main></template>
<style scoped>.page{padding:var(--swt-space-size-24)}nav{display:flex;flex-wrap:wrap;gap:var(--swt-space-size-8);margin-bottom:var(--swt-space-size-24)}</style>
