---
name: gts-sweetui-charts-coder
description: 在 SweetUI 环境中设计和实现图表及分析页面，使用已核实的 SweetUI/DTUI 图表接口并交付 Vue 源码和离线预览。用于图表生成与修改；普通页面不使用。当前为内网集成草案，图表运行接口尚待核实。
metadata:
  version: 0.1.0-draft
---

# SweetUI 图表生成（内网集成草案）

## 当前状态

本包已有设计资料和候选工程代码，但尚未核实私有 npm 包或运行图表。维护者先按 [内网接续](references/intranet-integration.md) 完成调查与接线，并填写 [图表接口契约](references/chart-runtime-contract.md)。契约未确认时可提供设计方案和已确定的代码，不编造 SweetEcharts/DTUI API，不把基础页面 build 通过当作图表已就绪。

只有契约标为已验证的入口可用于实现。不得猜测 DTUI 包名、导出、全局变量或事件；不擅自复制 EP 运行库替代私有图表库。

## 图表设计

确定分析目标、对象/指标、数据和目标尺寸；明确图型或局部修改可直接处理。关键业务信息缺失时才澄清。

需要方法匹配时读 [路由表](design/01-router/route-map.md)、[方法索引](design/02-methods/index.md)，选一个主方法，必要时最多两个辅助方法；只读相关短卡和引用。相邻方法难区分再读 [路由详解](design/01-router/method-router.md)。Method 05 适配时优先平行坐标，用户指定或任务不适配时调整。

生成/修改图表按 [规范索引](design/03-references/chart-spec/index.md) 选择规范：用户指定优先，明确半导体项目用半导体，其余默认 HD。局部修改只检查受影响内容。保留原值、单位、对象身份、时间和缺失语义，不虚构评分、阈值和根因。领域不明用明确标注的中性示例数据。

| 需要 | 读取 |
|---|---|
| 生成与验收 | [生成与验收](design/03-references/prototype/generation-review.md) |
| Tooltip | [Tooltip](design/03-references/chart-spec/common/tooltip.md) |
| 聚合、平滑、采样、归一化等 | [数据语义](design/03-references/data-semantics.md) 相关部分 |
| 实际采用 ECharts 时 | [能力边界](design/03-references/prototype/echarts-capabilities.md)；不能据此推定 DTUI 全量兼容 |
| 工程与交接 | [承载工程](design/03-references/prototype/hosted-project.md)、[产物门槛](design/03-references/prototype/delivery-gates.md)、[Handoff](design/03-references/prototype/handoff.md) |

先简述“判断目标 → 方案 → 关键交互”，再实现。不默认添加工作台、AI 输入框或无关统计卡。设计资料保持原样，案例只取适用逻辑，不执行其独立 Vite 安装命令。这里已有承载环境，不另建 Vite/TypeScript 工程。上游 design-entry.md 供维护比对，不重复加载其默认工程分支。

## 实现边界

图表视觉和数据语义遵从选中的 design 规范；SweetUI 外围控件、图标、token 和主题遵从经内网核实的实际库。普通 scoped CSS、JavaScript Vue SFC，不带入 EP、Less 或 EP 主题机制。图表内部参数若受封装限制，说明能力缺口，不静默改变设计目标。

接口资料确认后，按 [工程流程](references/workflow.md) 和本包 [代码规则](vendor/vue-skill/references/code-rules.md) 编码。已有 vendor、token 和主题参考是候选基座资料，必须在维护期与实际 npm 核对，不能用旧说明推翻实物。主题切换仅按需求提供，接口以契约为准。

缩放标签、恢复操作和多图联动有共同状态时建立一致状态来源，先初始化再构建图表。事件是否支持单项/batch 以真实图表库为准；ECharts 路径需防首次 setOption 前 getOption 为空。按实际轴域转换百分比，不硬编码 Step 1–400。保留身份色和用户选择，生命周期清理按真实接口实现。

## 交付

交付 src/、index.gts.html 和 src/pages/{Page}/HANDOFF.md。build、图形实际绘制、交互、主题、导出分别记录。canvas 存在不等于有数据图形；程序设置范围通过不等于拖拽/滚轮通过；Tooltip 触发不等于外观和定位通过。无法运行时标未验证，已知失败标失败，不宣称整体完成。

首次失败集中修复后最多两轮重跑，同一错误无新依据时停止；不通过切换步骤重置额度。维护调查不作为普通页面反复执行的前置步骤。
