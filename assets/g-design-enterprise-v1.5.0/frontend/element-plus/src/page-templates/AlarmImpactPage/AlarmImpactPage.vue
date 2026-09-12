<script setup lang="ts">
import { PageStateShell } from '../../page-states'
import type { PageState } from '../../page-states'
import { config } from '../../page-config'
withDefaults(defineProps<{state?:PageState}>(),{state:'ready'})
defineEmits<{(e:'retry'):void}>()
import { ref } from 'vue'
import { GAlarmTopology } from '../../components/complex/GAlarmTopology'
import { GButton } from '../../components/basic/GButton'
const selected=ref(''),step=ref(0)
function advance(){step.value=step.value>=config.steps.length?0:step.value+1}
</script>
<template><PageStateShell :state="state" @retry="$emit('retry')"><main class="page"><h1 class="page-heading">{{ config.title }}</h1><GAlarmTopology :nodes="config.nodes" :edges="config.edges" @select="selected=$event"/><el-alert v-if="selected" :title="`影响节点：${selected}`" type="info"/><aside><h2>处置建议</h2><el-steps direction="vertical" :active="step"><el-step v-for="s in config.steps" :key="s" :title="s"/></el-steps><GButton @click="advance">{{ step>=config.steps.length?'重新开始':'完成当前步骤' }}</GButton></aside></main></PageStateShell></template>
