# 整页参考

选一个起点复制到src/pages/{PAGE}/index.vue。App挂载保持原目录名。

| 需求 | 代码 | 服务 |
|---|---|---|
| 简单查询、表格、分页 | search-table/index.vue | init已有api/demo.js与api/mock/demo-data.js |
| 表单弹窗 | form-dialog/index.vue | feedback-flow/records.js→api/records.js |
| 简单图表看板 | chart-dashboard/index.vue | mixed-chart/metrics.js→api/metrics.js；mixed-chart/metrics-data.js→api/mock/metrics-data.js |
| 查询、表格、分页、抽屉详情 | table-search-drawer/index.vue | init已有api/demo.js与api/mock/demo-data.js |
| 原生token图表 | mixed-chart/index.vue | mixed-chart/metrics.js→api/metrics.js；metrics-data.js→api/mock/metrics-data.js |
| 加载、空、错误、正常内容状态 | content-states/index.vue | 按业务替换状态与服务 |
| 表单弹窗、创建反馈 | feedback-flow/index.vue | records.js→api/records.js |

图表示例使用随src交付的chart-tokens.js。build自动为实际引用生成dt-ui安装/样式入口；不要自行拼UMD全局名或替换原始依赖。构建通过立即交付；真实私有运行在内网维护验收阶段确认。
