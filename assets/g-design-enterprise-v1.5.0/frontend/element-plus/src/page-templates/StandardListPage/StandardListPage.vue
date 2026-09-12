<script setup lang="ts">
import { PageStateShell } from '../../page-states'
import type { PageState } from '../../page-states'
import { config } from '../../page-config'
withDefaults(defineProps<{state?:PageState}>(),{state:'ready'})
defineEmits<{(e:'retry'):void}>()
import ListContent from '../../patterns/ListContent.vue'
</script>
<template><PageStateShell :state="state" @retry="$emit('retry')"><main class="page"><h1 class="page-heading">{{ config.title }}</h1><ListContent/></main></PageStateShell></template>
