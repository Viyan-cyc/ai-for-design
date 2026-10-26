# 页面布局模板

需要布局参考时才选一项，结构已明确就直接写，不通读。

| 模板 | 用途 | 数据与服务 |
| --- | --- | --- |
| DashboardCards.vue | 指标卡片布局 | 由调用方提供metrics |
| `vendor/code-example/references/form-dialog/index.vue` | 新建/编辑弹窗页（唯一示例） | `vendor/code-example/references/feedback-flow/records.js`复制到api/records.js |
| LeftInfoWithRightCard.vue | 左辅助区与右卡片区 | 具名slot由业务填充 |
| SearchInfoWithRightCard.vue | 顶部查询与左右内容区 | 具名slot由业务填充 |

单页模板复制到src/pages/{PAGE}/index.vue，布局组件放同页components/。保留原生token和公开API，演示数据按需求补全。构建通过不代表真实私有运行验收通过。
