# 页面布局模板

最常用的页面布局骨架，快速复制使用。模板是**骨架**：slot 留好了内容位，复制后在 slot
处填充实际业务内容。

| 模板名称 | 模板路径 | 适用场景 |
| --- | --- | --- |
| LeftInfoWithRightCard | LeftInfoWithRightCard.vue | 左侧放可折叠辅助信息，右侧展示多数据卡片；卡片行数、数量及比例可通过 flex 调整。 |
| SearchInfoWithRightCard | SearchInfoWithRightCard.vue | 顶部搜索筛选栏 + 下方左侧辅助信息与右侧多数据卡片；卡片行数、数量及比例可通过 flex 调整。 |
| DashboardCards | DashboardCards.vue | 仪表盘看板，顶部指标卡片 + 下方图表区域。 |
| FormDialog | FormDialog.vue | 表单弹窗，用于新增/编辑数据。 |

## 使用说明

1. 根据页面需求从上表选取最匹配的模板。
2. 读取对应 .vue 文件获取骨架代码。
3. 在 slot 处填充实际业务内容。
4. 所有模板默认使用 GTS Token（CSS 变量），无需额外配置即可对接设计规范。
5. 栅格使用 Element Plus 的 ElRow/ElCol，默认 24 列流式栅格。
6. 模板样式为 `<style scoped lang="less">`；复制后保持 less，不写静态内联 style。
