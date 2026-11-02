<script setup lang="ts">
defineProps<{ visible: boolean }>();
</script>
<template>
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round">
    <path :d="visible ? 'M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4S1.5 8 1.5 8z' : 'M3 3l10 10M6.6 6.8A3 3 0 0 0 8 11c1.2 0 2.3-.6 3-1.5M2 8s2.4-4 6.5-4c1 0 1.9.3 2.7.7M13.6 6.3C14.1 7 14.5 8 14.5 8s-2.4 4-6.5 4c-.5 0-1-.1-1.4-.2'" />
    <circle v-if="visible" cx="8" cy="8" r="1.8" />
  </svg>
</template>
