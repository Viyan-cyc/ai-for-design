# 组合模式

- [工作台](workbench/README.md)：导航、页签、会话、对话、分析与关联证据。AI 工作台与资源查询共用同一骨架，通过 mode 切换。
- [查询详情](search-detail/)：条件筛选、分页与详情抽屉；将 index.vue、components/、api/ 一起复制到 src/pages/{PAGE}/，保持相对位置；公共 theme.js 等接线保留 init 生成的版本。
- [表单弹窗](form-dialog/)：表单弹窗。
- [内容网格](content-grid/)：内容网格。

按需选一个模式，初始化使用 scripts/preview/page.vue，不全量读取。

## 装配位置

index.vue 与 components/ 放到 src/pages/{PAGE}/。API 按下表放置，不修改原有相对导入：

|模式|api/ 目标|
|---|---|
|workbench、search-detail|src/pages/{PAGE}/api/|
|form-dialog|src/api/|
|content-grid|无服务依赖|

工作台输入器另按 workbench/README.md 安装；公共 runtime/theme/i18n 由 init 提供。
