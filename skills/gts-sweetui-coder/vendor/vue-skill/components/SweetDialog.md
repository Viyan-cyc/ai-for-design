# 弹窗 SweetDialog

```vue
<SweetDialog v-model="visible" title="编辑" draggable :close-on-click-modal="false">
  <!-- 内容 -->
  <template #footer>
    <SweetButton @click="visible = false">取消</SweetButton>
    <SweetButton type="primary" @click="handleConfirm">确认</SweetButton>
  </template>
</SweetDialog>
```

关键 props：`v-model`、`title`、`draggable`、`close-on-click-modal`、`width`、`before-close`、`destroy-on-close`。
