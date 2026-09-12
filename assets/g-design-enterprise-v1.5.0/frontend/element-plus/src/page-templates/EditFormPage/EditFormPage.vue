<script setup lang="ts">
import { PageStateShell } from '../../page-states'
import type { PageState } from '../../page-states'
import { config } from '../../page-config'
withDefaults(defineProps<{state?:PageState}>(),{state:'ready'})
defineEmits<{(e:'retry'):void}>()
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { GButton } from '../../components/basic/GButton'
import { usePageFeedback } from '../../page-states'
const form=reactive({...config.form}),feedback=usePageFeedback()
function save(){if(!form.name.trim()){feedback.saved(false);return}feedback.saved()}
</script>
<template><PageStateShell :state="state" @retry="$emit('retry')"><main class="page"><h1 class="page-heading">{{ config.title }}</h1><el-form label-width="auto"><el-form-item label="名称"><el-input v-model="form.name"/></el-form-item><el-form-item label="类型"><el-select v-model="form.type"><el-option label="设备" value="device"/><el-option label="服务" value="service"/></el-select></el-form-item><el-form-item label="启用"><el-switch v-model="form.enabled"/></el-form-item><el-form-item><GButton type="primary" @click="save">保存</GButton><GButton @click="Object.assign(form,config.form);ElMessage.info('已恢复初始内容')">取消</GButton></el-form-item></el-form></main></PageStateShell></template>
