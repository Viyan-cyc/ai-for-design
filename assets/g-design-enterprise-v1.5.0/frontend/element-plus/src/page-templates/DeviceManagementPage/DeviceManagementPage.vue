<script setup lang="ts">
import { PageStateShell } from '../../page-states'
import type { PageState } from '../../page-states'
import { config } from '../../page-config'
withDefaults(defineProps<{state?:PageState}>(),{state:'ready'})
defineEmits<{(e:'retry'):void}>()
import { GDashboardGrid } from '../../components/complex/GDashboardGrid'
import { GMetricCard } from '../../components/business/GMetricCard'
import ListContent from '../../patterns/ListContent.vue'
</script>
<template><PageStateShell :state="state" @retry="$emit('retry')"><main class="page"><h1 class="page-heading">{{ config.title }}</h1><GDashboardGrid :columns="3" :class="config.visualStyle!=='enterprise-light-dark' ? 'g-frost-backdrop g-frost-overview' : undefined"><GMetricCard v-for="(m, i) in config.metrics" :key="m.title" v-bind="m" :data-material="config.visualStyle!=='enterprise-light-dark' && i<3 ? 'frosted' : undefined" data-frost-level="card"/></GDashboardGrid><ListContent/></main></PageStateShell></template>
