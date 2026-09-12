<template>
  <section class="state-shell" :aria-busy="state==='loading'">
    <el-alert v-if="state==='partial'" title="部分数据加载失败，当前展示可用内容" type="warning" show-icon :closable="false"/>
    <el-skeleton v-if="state==='loading'" :rows="8" animated/>
    <el-empty v-else-if="state==='empty'" description="暂无数据"><el-button type="primary" @click="$emit('retry')">刷新</el-button></el-empty>
    <el-result v-else-if="state==='error'" icon="error" title="请求失败" sub-title="请检查网络后重试"><template #extra><el-button type="primary" @click="$emit('retry')">重新加载</el-button></template></el-result>
    <GPermissionState v-else-if="state==='forbidden'" @request="$emit('retry')"/>
    <slot v-else/>
  </section>
</template>
<script setup lang="ts">
import{GPermissionState}from'../components/business/GPermissionState';import type{PageState}from'./types'
withDefaults(defineProps<{state?:PageState}>(),{state:'ready'});defineEmits<{(e:'retry'):void}>();
</script>
<style scoped>.state-shell{display:grid;gap:var(--space-12);min-height:var(--spec-page-states-min-height)}</style>
