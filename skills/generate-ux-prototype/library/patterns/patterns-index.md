# 页面模式速查表（patterns-index）

写页面前先扫本表：场景命中哪篇，就先读哪篇；都不命中则跳过模式文档直接写。表下附 V1.5 设计语言认定的六类 B 端页面，供判断页面类型时参考。

| 你要写的页面/环节 | 先读 | 说明 |
|---|---|---|
| 列表页（筛选 + 表格 + 分页，设备/工单/任务/用户等一切查询场景） | [pattern-list-page.md](pattern-list-page.md) | 五段骨架 + 数据编排 + 状态映射 |
| 页面取数 / 保存 / 删除 / 批量等写操作 | [pattern-states-feedback.md](pattern-states-feedback.md) | 六态壳 + 反馈闭环，涉及异步取数或写操作**必读** |
| 弹窗表单（新增/编辑） | pattern-states-feedback.md（反馈细则节） | 校验/保存/关闭行为；弹窗容器见组件文档 el-form / el-dialog |
| 状态列打标签（运行中/异常/停用…） | pattern-list-page.md（STATUS_MAP 节） | 业务状态 → el-tag type 映射表，未知兜底 info |
| 纯静态展示页（无取数、无写操作） | 不读 pattern | 遵守 code-conventions 即可 |

## 六类 B 端页面（G 设计语言 V1.5 页面类型）

查询列表 / 设备管理 / 新建编辑 / 详情查看 / 报警分析 / 拓扑监控。其中前三类由上表两篇 pattern 覆盖；详情/报警/拓扑类页面生成时仍读 pattern-states-feedback.md（六态与反馈对所有页面类型生效）。
