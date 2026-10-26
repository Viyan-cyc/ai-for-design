<script setup>
import { SweetButton,SweetMessage } from '@hw-seq/sweet-ui-base'
function notify(){SweetMessage.success('操作成功')}
</script>
<template><SweetButton @click="notify">显示消息</SweetButton></template>
