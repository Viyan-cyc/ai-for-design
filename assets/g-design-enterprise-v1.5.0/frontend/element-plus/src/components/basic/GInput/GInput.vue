<template><el-input v-bind="$attrs" :model-value="modelValue" @update:model-value="$emit('update:modelValue',$event)"><template v-if="$slots.prefix" #prefix><slot name="prefix"/></template></el-input></template>
<script setup>
defineProps({modelValue:String});defineEmits(['update:modelValue']);
</script>
<style lang="less" scoped>
:deep(.el-input__wrapper){border-radius:var(--g-control-radius)}
</style>
