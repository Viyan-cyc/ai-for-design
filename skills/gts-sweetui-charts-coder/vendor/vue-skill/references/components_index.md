# SweetUI 5.7.0 组件索引

先按名称选组件；只读当前所需的契约。完整名称以 scripts/verify/whitelists/sweetui-exports.json 为准。命令式 API（SweetMessage 等）不是模板组件。未覆盖 API 定向查已安装包，不从 Element Plus 推导。

|需求|参考|
|---|---|
|2.1 按钮 SweetButton|[用法](../components/SweetButton.md)|
|2.2 输入 SweetInput|[用法](../components/SweetInput.md)|
|2.3 选择 SweetSelect / SweetOption|[用法](../components/SweetSelect.md)|
|2.4 表单 SweetForm / SweetFormItem|[用法](../components/SweetForm.md)|
|2.5 表格 SweetTable / SweetTableColumn|[用法](../components/SweetTable.md)|
|2.6 分页 SweetPagination|[用法](../components/SweetPagination.md)|
|2.7 弹窗 SweetDialog|[用法](../components/SweetDialog.md)|
|2.8 抽屉 SweetDrawer|[用法](../components/SweetDrawer.md)|

|图标|[用法](../components/SweetIcon.md)|
|消息、确认与通知|[用法](../components/SweetFeedback.md)|

更多组件名称定向搜索 scripts/verify/whitelists/sweetui-exports.json。名称存在只代表可导入，不代表任意 API 用法都已验证；高级组件在实际需求出现时查安装包对应文档。

## 组合使用要点
项目使用建议，API 以组件契约为准。
- Button：一个操作组明确一个主动作；纯图标动作提供可访问名称，提交防重复。
- Input / Select：保留字段标签，placeholder 不代替标签；选项和命令分开。
- Form：标签对齐，字段按业务分组，错误就近呈现；长标签或窄区域考虑上下布局。
- Table：全局、批量、行操作分开，筛选状态可见；分页紧邻结果。
- Dialog / Drawer：短任务用弹窗，关联详情按需求用抽屉；取消保留原数据，保存成功再刷新。
- 反馈：短暂操作结果用 Message，持续区域问题用 Alert，独立通知用 Notification；不一律弹成功消息。
