# SweetUI + GTS 代码示例索引（占位）

本文档是代码示例库的索引目录，**每次使用时首先读取此文件**。

> **占位状态**：示例文件尚未生成（须内网实跑重写，流程见上级 `../SKILL.md`）。
> 重写完成后下表填入实际编号 001–007，本提示删除。

## 示例总览（目标形态，与 EP 版 001–007 一一对应）

| 编号 | 示例名称 | 用途描述 | 核心组件 | 目录路径 |
| --- | --- | --- | --- | --- |
| 001 | table-search-drawer | 搜索表单+数据表格+详情抽屉组合页面 | sweet-form, sweet-input, sweet-select, sweet-date-picker, sweet-table, sweet-pagination, sweet-drawer, sweet-tag, sweet-button | `references/table-search-drawer/` |
| 002 | mixed-chart | 折线+柱状混合图表页，图表色走 Token | sweet-barline-chart, sweet-card | `references/mixed-chart/` |
| 003 | glow-cards | 卡片氛围光两种形态（角部高光/中心辐射），色相跟语义走 | radial-gradient, color-mix (CSS) | `references/glow-cards/` |
| 004 | frost-decor-card | 品牌色块磨砂装饰：品牌色渐变底+边角磨砂圆形/圆角块，card/panel 双档 | pseudo-element, backdrop-filter (CSS) | `references/frost-decor-card/` |
| 005 | frost-material | 整块毛玻璃材质三档对照：control/card/overlay、薄染色、hover/active 增量、实色回退 | data-material 属性选择器, backdrop-filter (CSS) | `references/frost-material/` |
| 006 | content-states | 内容状态九态整页对照：首次使用/加载/有数据/空结果/筛选无结果/无权限/加载失败/已删除/部分模块失败 | sweet-radio-group, sweet-result, sweet-skeleton, sweet-table, sweet-empty | `references/content-states/` |
| 007 | feedback-flow | 操作反馈流四区对照：全局消息/嵌入式消息（6 组语义全对照）/系统通知/确认与高危确认 | sweet-message, $sweetNotify, sweet-dialog, sweet-checkbox, sweet-button | `references/feedback-flow/` |

## 使用限制

- **禁止**一次性读取所有示例文件
- **禁止**使用通配符批量加载 `references/` 下的文件
- 每次仅加载当前任务相关的 1-2 个示例文件
