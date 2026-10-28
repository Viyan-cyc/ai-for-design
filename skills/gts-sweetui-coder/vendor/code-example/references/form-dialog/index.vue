<script setup>
import { ref, onMounted } from 'vue'
import { SweetButton, SweetTable, SweetTableColumn, SweetAlert } from '@hw-seq/sweet-ui-base'
import EditorDialog from './components/EditorDialog.vue'
import { getRecords } from '../../api/records.js'
const rows = ref([])
const selected = ref(null)
const visible = ref(false)
const error = ref('')
async function load() {
  error.value = ''
  try { rows.value = await getRecords() } catch (e) { error.value = e.message || '加载失败' }
}
function edit(row) { selected.value = { ...row }; visible.value = true }
onMounted(load)
</script>
<template>
  <main class="page">
    <h1>设备维护</h1>
    <SweetAlert v-if="error" :title="error" type="error" />
    <SweetButton v-if="error" @click="load">重试</SweetButton>
    <SweetTable :data="rows">
      <SweetTableColumn prop="name" label="名称" />
      <SweetTableColumn label="操作"><template #default="{ row }"><SweetButton text @click="edit(row)">编辑</SweetButton></template></SweetTableColumn>
    </SweetTable>
    <EditorDialog v-model="visible" :record="selected" @saved="load" />
  </main>
</template>
<style scoped>
.page { padding: var(--swt-space-size-24); }
</style>
