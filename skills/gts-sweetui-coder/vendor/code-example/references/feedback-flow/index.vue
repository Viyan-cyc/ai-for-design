<script setup>
import { reactive,ref } from 'vue'
import { SweetButton,SweetDialog,SweetForm,SweetFormItem,SweetInput,SweetTable,SweetTableColumn } from '@hw-seq/sweet-ui-base'
import { createRecord,deleteRecord } from '../../api/records.js'
const visible=ref(false),saving=ref(false),formRef=ref(),records=ref([]),feedback=ref('')
const form=reactive({name:''}),rules={name:[{required:true,message:'请输入资源名称',trigger:'blur'}]}
const deleting=ref(null),confirmation=ref(''),removing=ref(false)
function confirmDelete(row){deleting.value=row;confirmation.value=''}
async function remove(){
  if(!deleting.value||confirmation.value!==deleting.value.name||removing.value)return
  removing.value=true
  try{const id=deleting.value.id;await deleteRecord(id);records.value=records.value.filter(row=>row.id!==id);deleting.value=null;feedback.value='删除成功'}
  catch(e){feedback.value='删除失败：'+e.message}
  finally{removing.value=false}
}
function openCreate(){form.name='';feedback.value='';visible.value=true}
async function submit(){
  if(saving.value||!formRef.value)return
  try{await formRef.value.validate()}catch{return}
  saving.value=true
  try{records.value=[...records.value,await createRecord({...form})];visible.value=false;feedback.value='创建成功'}
  catch(e){feedback.value='创建失败：'+e.message}
  finally{saving.value=false}
}
</script>
<template>
  <main class="page-root">
    <header><h1>资源管理</h1><SweetButton type="primary" @click="openCreate"><i class="sweetui-icon-add-l" aria-hidden="true"></i>新建资源</SweetButton></header>
    <p role="status">{{ feedback }}</p>
    <SweetTable :data="records" empty-text="暂无资源，请新建"><SweetTableColumn prop="name" label="名称" min-width="180" /><SweetTableColumn label="操作" width="120"><template #default="{row}"><SweetButton type="danger" text @click="confirmDelete(row)">删除</SweetButton></template></SweetTableColumn></SweetTable>
    <SweetDialog v-model="visible" title="新建资源" width="min(520px, 92vw)" :close-on-click-modal="false">
      <SweetForm ref="formRef" :model="form" :rules="rules" label-position="top"><SweetFormItem label="资源名称" prop="name"><SweetInput v-model="form.name" placeholder="请输入资源名称" /></SweetFormItem></SweetForm>
      <template #footer><SweetButton :disabled="saving" @click="visible=false">取消</SweetButton><SweetButton type="primary" :loading="saving" @click="submit">创建</SweetButton></template>
    </SweetDialog>
    <SweetDialog :model-value="!!deleting" title="确认删除" width="min(520px, 92vw)" :close-on-click-modal="false" @update:model-value="value=>{if(!value&&!removing)deleting=null}">
      <template v-if="deleting"><p>删除后无法恢复。请输入资源名称确认：{{ deleting.name }}</p><SweetInput v-model="confirmation" placeholder="输入完整资源名称" /></template>
      <template #footer><SweetButton :disabled="removing" @click="deleting=null">取消</SweetButton><SweetButton type="danger" :loading="removing" :disabled="!deleting||confirmation!==deleting.name" @click="remove">确认删除</SweetButton></template>
    </SweetDialog>
  </main>
</template>
<style scoped>
.page-root{padding:var(--swt-space-size-24)}
header{display:flex;flex-wrap:wrap;gap:var(--swt-space-size-16);align-items:center;justify-content:space-between}
h1{margin:0;font-size:var(--swt-font-size-medium);color:var(--swt-color-text-primary)}
</style>
