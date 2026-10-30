---
name: gts-ep-charts-coder
description: 在 Vue 3 + Element Plus 环境中按图表设计规范生成、修改图表及数据分析页面，交付标准源码与离线预览。用于 EP 图表选型、图表实现、数据或交互修改；普通无图表页面不使用此入口。
metadata:
  version: 0.1.2
---

# GTS EP 图表生成

将分析目标转成图表方案，并用本包 EP 工程管道实现。交付 src/、index.gts-ep.html 和页面 HANDOFF.md。只使用本入口，不调用其他 coder skill。

## 设计与工程的职责

- 图表方法、数据语义、轴/图例/Tooltip/系列色等遵从 design/ 中本次选中的规范。
- EP 控件 API、页面样式、主题机制、目录、依赖、构建与预览遵从本包工程约定。图表绘制参数与页面 CSS 的边界见 [图表适配](references/chart-integration.md)。不要用“工程优先”覆盖全部图表视觉规则。
- 尊重用户技术栈和修改范围。本包提供 EP 承载环境，不另建 Vite 工程，不照搬 TypeScript 或 echarts/core 示例。明确要求其他技术栈时说明此入口的范围，不擅自替换用户选择。
- 保留原值、单位、时间、对象身份和缺失语义；不自行建立业务评分、权重、阈值或已确认根因。案例参数只在来源场景适用。领域不明用明确标注的中性示例数据。

## 图表设计

1. 确定要判断什么、对象/指标、数据与目标尺寸；只有关键业务信息缺失才澄清。明确图表请求和局部修改直接处理，不强制完整方法路由。
2. 需要匹配分析方法时读 [路由表](design/01-router/route-map.md) 和 [方法索引](design/02-methods/index.md)，选一个主方法，必要时最多两个辅助方法；只读选中的短卡及相关引用。相邻任务难区分再读 [路由详解](design/01-router/method-router.md)，旧编号读 [编号迁移](design/01-router/id-migration.md)。Method 05 适配时首选平行坐标，用户指定或任务不适配时调整。
3. 生成或修改图表先通过 [规范索引](design/03-references/chart-spec/index.md) 选规范：用户指定优先，明确半导体项目用半导体，其余默认 HD。未定义项作为本次建议，不因缺口停止或擅自换图；真实冲突说明取舍。
4. 简述“要判断什么 → 推荐方案 → 关键交互”，然后实现。路由、规范清单不默认放进产品界面；不额外添加导航、统计卡或工作台骨架。

| 需要解决的问题 | 资料 |
|---|---|
| 生成、修改或验收原型 | [生成与验收](design/03-references/prototype/generation-review.md)，局部修改只检查受影响行为 |
| 实现图表 | [ECharts 能力边界](design/03-references/prototype/echarts-capabilities.md) 与 [EP 图表适配](references/chart-integration.md) |
| Hover 提示 | [Tooltip](design/03-references/chart-spec/common/tooltip.md) |
| 聚合、采样、归一化、拟合、平滑、排名或评分 | [数据语义](design/03-references/data-semantics.md) 的对应部分 |
| 工程与验证边界 | [承载工程](design/03-references/prototype/hosted-project.md)、[产物门槛](design/03-references/prototype/delivery-gates.md) 中既有工程、目标尺寸及结果部分；跳过独立 Vite 工程要求 |
| 工程交接 | [Handoff](design/03-references/prototype/handoff.md)，落在 src/pages/{Page}/HANDOFF.md |
| 规范咨询 | 规范索引与相关专项；只咨询不启动工程管道 |

design/ 只作为资料和案例来源，不执行其中示例的安装/构建命令，不整体复制案例配置。design-entry.md 保留为维护比对基线，运行时不重复读取；本入口已适配其设计路由。

## 工程流程

首次编码完整读取 [EP 工程流程](references/ep-workflow.md)、[代码规则](vendor/vue-skill/references/code-rules.md) 和 [图表适配](references/chart-integration.md)，同一上下文已读版本可复用。代码规则的通用视觉优先级只管 EP 控件和页面 CSS，图表 option 以选中的图表规范为准。

所有命令从本 SKILL.md 所在目录执行，项目路径使用绝对路径，输出位置遵从宿主要求。

```text
node -v → node scripts/ensure-env.mjs
→ 新建时 node scripts/init.mjs "<输出父目录>" "<page-slug>"
→ 写 src/ → 图标引用新增或变化时 fetch-icons
→ 源码自查 → cleanup-starter → build → 交付
```

- Node 缺失或环境失败按 EP 工程流程中的安装入口与 HINT 处理，不用另起服务器替代管道。
- init 返回 HTML_PATH、SRC_DIR、PAGE。已有工程跳过 init，只改相关源码，不直接修改生成 HTML。
- 页面组件放 src/pages/{Page}/；业务数据经 src/api/ 的 Promise 服务获取，mock 在 src/api/mock/，页面不直接引用 mock。
- 图标变化时执行 `node scripts/fetch-icons.mjs --dir "<工程目录>"`；无图标或引用未变不重复请求。
- 最终源码自查后执行 `node scripts/cleanup-starter.mjs --dir "<工程目录>"`，然后 `node scripts/build.mjs --dir "<工程目录>"`。源码改动后重新 build。
- build 的 WARN 要处理，OK 才可称构建通过。首次验证加最多两轮集中修复重跑，同一错误没有新依据时提前停止；不切换检查重置额度。环境失败按 HINT 处理，不反复执行同一失败操作。
- 页面控件用显式导入的 PascalCase EP 组件；样式 scoped Less，颜色、间距等用 GTS token；不修改固定主题文件，不重绘 EP 内部状态。图表 option 的规范颜色见适配说明。

## 交付与证据

交付可点击的 HTML_PATH、源码位置，以及页面 HANDOFF.md。离线 HTML 和标准源码共用同一图表实现；不是只有静态截图的交付。

构建、目标尺寸、承诺交互、图片导出、代码包导出和业务接入分别记录实际结果。涉及缩放联动时按图表适配维护统一状态并处理批量事件；程序设置范围通过，不等于真实拖拽/滚轮输入通过。build 输出 RUNTIME: not-run，不能据此声称浏览器运行通过；未运行时写“构建通过，浏览器运行未验证”。已观察到的失败如实记录，不改成未验证。适用尺寸和交互实际通过后才称原型已验证。

不默认增加全量截图或多视口流程。按需求与适用规范检查受影响尺寸、交互；浏览器不可用时仍可交付并列出未验证项。未提供内部组件/真实后端时明确待接入。不承诺 yarn serve、生产构建、独立类型检查或可独立安装的应用包。

## 维护

仅维护或升级本 skill 时读取 [来源与同步](references/integration-sources.md)。普通页面不运行维护回归。设计资料只在上游修改；适配写在 references/，保证 design/ 可整体同步。
