<script setup>
defineProps({ groups: { type: Array, default: () => [] } })
</script>
<template>
  <nav class="groups" aria-label="服务导航">
    <section v-for="group in groups" :key="group.id">
      <h2>{{ group.title }}</h2>
      <a v-for="link in group.links" :key="link.id" :href="link.href">{{ link.label }}</a>
    </section>
  </nav>
</template>
<style scoped>
.groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--swt-space-size-24); }
.groups h2 { font-size: var(--swt-font-size-medium); }
.groups a { display: block; margin-bottom: var(--swt-space-size-8); color: var(--swt-color-accent-text-normal); }
</style>
