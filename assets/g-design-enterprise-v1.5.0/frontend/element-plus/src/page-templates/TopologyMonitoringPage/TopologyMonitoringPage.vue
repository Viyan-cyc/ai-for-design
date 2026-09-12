<script setup lang="ts">
import { PageStateShell } from '../../page-states'
import type { PageState } from '../../page-states'
import { config } from '../../page-config'
withDefaults(defineProps<{state?:PageState}>(),{state:'ready'})
defineEmits<{(e:'retry'):void}>()
import { ref } from 'vue'
import { GTopology } from '../../components/complex/GTopology'
const selected=ref('')
</script>
<template><PageStateShell :state="state" @retry="$emit('retry')"><main class="page"><h1 class="page-heading">{{ config.title }}</h1><GTopology :nodes="config.nodes" :edges="config.edges" @select="selected=$event"/><el-alert v-if="selected" :title="`已选择：${selected}`" type="info" show-icon/></main></PageStateShell></template>
