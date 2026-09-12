<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { GSearchBar } from '../components/business/GSearchBar'
import { GDataTablePro } from '../components/business/GDataTablePro'
import { GButton } from '../components/basic/GButton'
import { config } from '../page-config'
const query=ref(''), applied=ref(''), rows=ref(structuredClone(config.rows)), dialog=ref(false), name=ref('')
const filtered=computed(()=>rows.value.filter(row=>Object.values(row).some(v=>String(v).toLowerCase().includes(applied.value.toLowerCase()))))
function create(){if(!name.value.trim()){ElMessage.warning('请填写名称');return}rows.value.push({id:String(Date.now()),name:name.value.trim(),type:'设备',status:'正常'});dialog.value=false;name.value='';query.value='';applied.value='';ElMessage.success('已创建示例记录')}
async function batch(selected:Record<string,unknown>[]){try{await ElMessageBox.confirm(`确认处理 ${selected.length} 条记录？`,'批量处理');for(const row of selected)row.status='已处理';ElMessage.success(`已处理 ${selected.length} 条记录`)}catch{/* 用户取消 */}}
</script>
<template><GSearchBar v-model="query" @search="applied=query" @reset="query='';applied=''"/><GDataTablePro :data="filtered" :columns="config.columns" :total="filtered.length" @batch="batch"><template #toolbar><GButton type="primary" @click="dialog=true">新建</GButton></template></GDataTablePro><el-dialog v-model="dialog" title="新建记录"><el-input v-model="name" aria-label="名称" placeholder="请输入名称"/><template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" @click="create">创建</el-button></template></el-dialog></template>
