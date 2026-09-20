# el-dialog 弹窗（docs/el-dialog）

> GTS: 对话框（组件规范/反馈类/对话框.md） | EP 2.13.5 | 白名单: ✅

写弹窗容器（新建/编辑表单、详情预览、确认对话框）前读本篇。二次确认不自己搭弹窗，直接用 `ElMessageBox.confirm`。只覆盖方言约束，全部属性以 Element Plus 2.13.5 官方文档为准。

## 标准形（承载 el-form 的新建/编辑弹窗）

```html
<el-dialog v-model="dialogVisible" :title="form.id ? '编辑XX' : '新增XX'"
           width="min(520px, 92%)" :close-on-click-modal="false">
  <!-- el-form 标准形见 docs/el-form.md -->
  <template #footer>
    <el-button @click="dialogVisible = false">取消</el-button>
    <el-button type="primary" @click="submit">保存</el-button>
  </template>
</el-dialog>
```

```js
const dialogVisible = ref(false)
const form = reactive({ id: '', name: '', status: '' })

function openCreate() {
  Object.assign(form, { id: '', name: '', status: '' })  // 打开时重置，不依赖 destroy-on-close
  dialogVisible.value = true
}
// submit 保存成功后再 dialogVisible.value = false，见 docs/el-form.md 提交标准形
```

## 约束（方言坑 + G 增量）

- 可见性**只用 `v-model`**，不要写 `:visible`（那是 Vue2 ElementUI 的写法，EP 下静默失效）。
- 宽度写 `min(px, %)`（如 `min(520px, 92%)`），不用固定 px——窄屏溢出。
- 表单弹窗必加 `:close-on-click-modal="false"`：误触遮罩不该丢掉已填内容；ESC 关闭保留默认。
- EP 关闭后弹窗 DOM 仍保留在页面（只是隐藏），所以**打开时重置表单**（`Object.assign` 回初始值），不要指望 `destroy-on-close`。
- footer 用 `#footer` 插槽：取消按钮不传 type，确认按钮 `type="primary"`；保存成功后才关弹窗。
- 不嵌套 el-dialog；弹窗内再确认用 `ElMessageBox.confirm`（自带层级，无需处理 z-index）。
