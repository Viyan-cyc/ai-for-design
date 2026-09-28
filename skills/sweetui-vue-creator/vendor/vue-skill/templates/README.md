# 页面布局模板

最常用的页面布局骨架，快速复制使用。模板是**骨架**：slot 留好了内容位，复制后在 slot
处填充实际业务内容。

| 模板名称 | 模板路径 | 适用场景 |
| --- | --- | --- |
| FormPage | form-page.vue | 表单页：整页表单录入（输入/选择/日期/开关/多选/多行文本），带校验与提交 |
| TablePage | table-page.vue | 表格页：搜索卡片 + 工具栏 + 数据表格（多选/状态标签/操作列/空态）+ 分页 + 编辑弹窗 |
| AppLayout | app-layout.vue | 整页骨架：顶栏横向菜单 + 侧边折叠菜单 + 面包屑 + 内容区 |
| DialogDrawer | dialog-drawer.vue | 弹窗与抽屉：编辑表单弹窗（draggable）+ 详情抽屉（descriptions） |
| MessageFeedback | message-feedback.vue | 消息反馈：$message / $sweetNotify / $confirm / $alert 命令式提示 |

## 使用说明

1. 根据页面需求从上表选取最匹配的模板。
2. 读取对应 .vue 文件获取骨架代码。
3. 在 slot 处填充实际业务内容。
4. 所有模板默认使用 GTS Token（CSS 变量），无需额外配置即可对接设计规范。
5. 栅格使用 SweetUI 的 sweet-row/sweet-col，默认 24 列流式栅格。
6. 模板样式为 `<style scoped lang="less">`；复制后保持 less，不写静态内联 style。

## 模板内已固化的写法纪律

- 组件按需 import（真实工程口径）；预览运行时已全量注册，模板标签直接可用。
- 图标统一 `<icon-plus name="X" />` 包装组件（`src/components/icon-plus.vue` 随骨架就位），
  不写 `<sweet-icon>`。
- 多行文本用 `<sweet-input type="textarea">`（无独立 textarea 组件）。
- 分页 `current-page`/`page-size` 一律 v-model 绑 ref（UMD 坑 2）。
- 弹窗默认 `draggable` `:close-on-click-modal="false"`（code-rules 规则 2.3）。
- 表格空态：`#empty` 插槽 + less 类。
- 确认框走 `$confirm`（Promise）；`SweetMessageBox` 是模板标签组件（sweet-message-box），
  命令式确认不用它。
