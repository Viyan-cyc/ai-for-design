<script setup>
import ContactList from './components/ContactList.vue'
import LinkGroups from './components/LinkGroups.vue'
const contacts = [
  { id: 'search', icon: 'sweetui-icon-search-l', label: '服务查询', value: '按业务名称查询' },
  { id: 'close', icon: 'sweetui-icon-close', label: '关闭服务', value: '确认后关闭当前会话' }
]
const groups = [
  { id: 'services', title: '服务入口', links: [{ id: 'overview', label: '服务概览', href: '#overview' }] },
  { id: 'contact', title: '联系渠道', links: [{ id: 'support', label: '服务支持', href: '#support' }] }
]
</script>
<template>
  <main class="page">
    <section id="overview"><h1>服务中心</h1><ContactList :items="contacts" /></section>
    <footer id="support"><LinkGroups :groups="groups" /></footer>
  </main>
</template>
<style scoped>
.page { padding: var(--swt-space-size-24); display: grid; gap: var(--swt-space-size-24); }
</style>
