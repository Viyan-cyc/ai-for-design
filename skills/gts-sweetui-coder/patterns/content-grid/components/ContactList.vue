<script setup>
import { SweetIcon } from '@hw-seq/sweet-ui-base'
defineProps({ items: { type: Array, default: () => [] } })
</script>
<template>
  <ul class="contacts">
    <li v-for="item in items" :key="item.id">
      <SweetIcon :icon-class="item.icon" aria-hidden="true" />
      <strong>{{ item.label }}</strong><span>{{ item.value }}</span>
    </li>
  </ul>
</template>
<style scoped>
.contacts { padding: 0; list-style: none; }
.contacts li { display: flex; flex-wrap: wrap; gap: var(--swt-space-size-8); margin-bottom: var(--swt-space-size-16); }
</style>
