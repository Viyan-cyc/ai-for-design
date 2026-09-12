<script setup lang="ts">
import { PageStateShell } from '../../page-states'
import type { PageState } from '../../page-states'
import { config } from '../../page-config'
withDefaults(defineProps<{state?:PageState}>(),{state:'ready'})
defineEmits<{(e:'retry'):void}>()
import { GMonitorPanel } from '../../components/complex/GMonitorPanel'
import { GTimelinePro } from '../../components/complex/GTimelinePro'
</script>
<template><PageStateShell :state="state" @retry="$emit('retry')"><main class="page"><h1 class="page-heading">{{ config.title }}</h1><el-descriptions :column="2" border><el-descriptions-item v-for="d in config.details" :key="d.label" :label="d.label">{{ d.value }}</el-descriptions-item></el-descriptions><el-tabs><el-tab-pane label="运行指标"><GMonitorPanel v-for="m in config.metrics" :key="m.title" :title="m.title" :value="m.value"/></el-tab-pane><el-tab-pane label="变更记录"><GTimelinePro :items="config.events"/></el-tab-pane></el-tabs></main></PageStateShell></template>
