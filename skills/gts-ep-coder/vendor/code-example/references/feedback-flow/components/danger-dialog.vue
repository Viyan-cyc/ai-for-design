<script setup>
// danger-dialog — 高危确认对话框（L1，458px，垂直居中）
// 三原则硬实现：复选框默认不勾选；未确认禁用执行按钮；打开时默认焦点置于取消按钮。
// 右上角关闭与取消等效（close-on-click-modal=false：高危不放行点遮罩关闭）；
// 执行中按钮 loading，防重复触发。
import { ref, watch, nextTick } from 'vue'
import { ElDialog, ElCheckbox, ElButton } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import { ElIcon } from 'element-plus'

defineOptions({ name: 'DangerDialog' })

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'executed'])

const confirmed = ref(false)
const executing = ref(false)
const cancelBtnRef = ref(null)

const visible = ref(props.modelValue)

watch(
  () => props.modelValue,
  (v) => {
    visible.value = v
  }
)

watch(visible, (v) => {
  emit('update:modelValue', v)
  if (v) {
    confirmed.value = false
    executing.value = false
  }
})

// @opened：入场动画与 focus-trap 初始化完成后触发，此时聚焦取消才不被抢回
const onOpened = async () => {
  await nextTick()
  cancelBtnRef.value && cancelBtnRef.value.$el && cancelBtnRef.value.$el.focus()
}

const doExecute = async () => {
  executing.value = true
  await new Promise((r) => setTimeout(r, 600))
  executing.value = false
  emit('executed')
}
</script>

<template>
  <ElDialog
    v-model="visible"
    title="删除生产数据库实例"
    width="458px"
    align-center
    :close-on-click-modal="false"
    custom-class="gts-dialog"
    @opened="onOpened"
  >
    <div class="danger-body">
      <div class="danger-icon">
        <ElIcon :size="24"><WarningFilled /></ElIcon>
      </div>
      <div class="danger-text">
        <p class="danger-product">GTS 运维平台 · 高危操作</p>
        <p class="danger-desc">
          即将删除生产库实例 PROD-DB-07 及其全部数据，操作不可恢复。
          影响范围：依赖该实例的 3 个业务系统将中断服务。
        </p>
      </div>
    </div>
    <ElCheckbox v-model="confirmed" class="danger-confirm">
      我已确认本次操作的风险与影响范围
    </ElCheckbox>
    <template #footer>
      <div class="danger-footer">
        <ElButton ref="cancelBtnRef" size="small" @click="visible = false">取消</ElButton>
        <ElButton
          size="small"
          type="danger"
          :disabled="!confirmed"
          :loading="executing"
          @click="doExecute"
        >
          确认删除
        </ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<style scoped lang="less">
.danger-body {
  display: flex;
  gap: var(--space-size-12);
}

.danger-icon {
  display: flex;
  align-items: flex-start;
  color: var(--color-error);
}

.danger-text {
  flex: 1;
  min-width: 0;
}

.danger-product {
  margin: 0 0 var(--space-size-4);
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
}

.danger-desc {
  margin: 0;
  font-size: var(--font-size-normal);
  color: var(--color-text-primary);
  line-height: var(--font-line-height-normal);
}

.danger-confirm {
  margin-top: var(--space-size-20);
}

.danger-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-size-16);
}
</style>
