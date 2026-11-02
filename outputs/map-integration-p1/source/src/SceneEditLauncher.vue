<script setup lang="ts">
import { ref } from 'vue';
defineProps<{ dirty?: boolean; href?: string }>();
const emit = defineEmits<{ edit: [] }>();
const expanded = ref(false);
</script>

<template>
  <nav class="scene-edit-launcher" aria-label="场景编辑入口" @keydown.esc="expanded = false">
    <template v-if="expanded">
      <a v-if="href" :href="href" class="launcher-action">编辑场景</a>
      <button v-else class="launcher-action" @click="emit('edit')">编辑场景<span v-if="dirty" class="launcher-dot" title="有未保存修改" /></button>
    </template>
    <button class="launcher-toggle" :aria-expanded="expanded" :aria-label="expanded ? '收起编辑入口' : '展开编辑入口'" :title="expanded ? '收起' : '编辑场景'" @click="expanded = !expanded">
      <svg v-if="!expanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  </nav>
</template>

<style scoped>
.scene-edit-launcher { position: fixed; right: 16px; bottom: 16px; z-index: 10; display: flex; align-items: center; gap: 2px; padding: 3px; border: 1px solid rgba(100,116,139,.12); border-radius: 12px; background: rgba(255,255,255,.8); box-shadow: 0 2px 10px rgba(30,41,59,.04); pointer-events: auto; font: 12px/1.4 system-ui,sans-serif; }
.launcher-toggle, .launcher-action { display: flex; align-items: center; justify-content: center; gap: 6px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: #64748b; cursor: pointer; font: inherit; text-decoration: none; }
.launcher-toggle { width: 30px; padding: 0; }
.launcher-action { padding: 0 10px; }
.launcher-toggle:hover, .launcher-action:hover { background: #edf3ff; color: #3d7eff; }
.launcher-toggle:focus-visible, .launcher-action:focus-visible { outline: 2px solid #3d7eff; outline-offset: 2px; }
.launcher-dot { width: 5px; height: 5px; border-radius: 50%; background: #d99525; }
</style>
