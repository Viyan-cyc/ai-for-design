<script setup>
import { SweetButton,SweetNotification } from '@hw-seq/sweet-ui-base'
function notify(){SweetNotification.success({title:'完成',message:'任务已完成'})}
</script>
<template><SweetButton @click="notify">显示通知</SweetButton></template>
