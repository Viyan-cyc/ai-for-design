# 来源与同步（仅维护时读取）

2026-10-29 首次组装，skill 版本 0.1.0。

| 来源 | 版本 | 调研/组装 HEAD |
|---|---|---|
| chart-design-expert | CHANGELOG 0.6.15 | d7942608e80ab93f5e56dcf8b5a2142d55ad6aab |
| gts-ep-coder | metadata.version 0.3.0-rc.1 | 013a91cef59f320d82f02ccb4f52b0913bc456da |

实际取自当时工作区，而非仅从 commit 导出。EP 存在未提交修改，来源状态及逐文件 SHA-256 见 [集成清单](integration-manifest.json)，该清单用于核实快照，不是正常生成的前置读取。

## 有意差异

- scripts/、assets/ 和原有 references/ 复用基座，不修改构建与预览协议；保留 index.gts-ep.html 和兼容环境池名称。
- 新入口只服务 EP 图表；原基座流程移到 ep-workflow.md 并修正相对链接，通用设计场景路由换成图表路由。
- vendor 两个嵌套 SKILL.md 改名 reference-entry.md 并更新 vendor 文档引用，防止宿主递归注册额外 skill。资料内容不作为新的独立入口。
- vendor 代码规则 11.2、视觉优先级和错误清单 21 做图表范围适配，避免原“只用 GTS 图表色、禁止 option hex、必须 vue-echarts”与设计规范冲突；其他 API 和编码要求保留。
- 新增 chart-integration.md、来源说明及摘要清单。不要把这些文件覆盖进上游。
- design/ 原样保留 01-router、02-methods、03-references、04-assets、CHANGELOG.md。排除仓库治理文件与本机依赖/缓存。保留子目录 README、案例 package/lock/source，它们是参考资产，不执行其安装脚本。

## 更新设计资料

1. 核对新版 CHANGELOG、提交及实际工作区状态；记录版本和 commit，未提交快照同时更新摘要。
2. 对比 design/ 与旧清单。若有本地改动先保存并迁出适配，不无提示覆盖；只更新受管理范围，移除上游已删除项前确认目标仍在包内。
3. 同步 design/ 并核对字节一致性、内部相对链接、排除内容引用和嵌套注册。不要排除子目录 README。
4. 比对 design-entry.md，将设计规则、按需路由、改名路径同步到本 SKILL.md；继续排除独立 Vite/TypeScript 工程流程。
5. 检查图表规范与本地工程边界的变化，执行受影响案例，更新本说明、清单与 skill 版本。

## 更新 EP 基座

独立比较 scripts、assets、references、vendor 与来源摘要，保留这里列出的有意差异；不要把普通页面场景重新设为图表入口必读项。通用问题先在基座修复再同步；图表专属规则只留在本包。

维护时运行适用的 verify-build.mjs、verify-theme.mjs、verify-fetch-icons.mjs、verify-foundation.mjs，检查完整分发包在其他目录能 ensure/init/build。图表场景还须实际浏览器检查；这些脚本不是每次生成页面的必跑项目。

快速同步依赖于 design/ 不作本地修补；不等于自动更新、免适配或免验证。SweetUI 另立后续规格，不在本包加入分支。

## 0.1.1 初始化状态修正

补充首次 setOption 前、clear 后及 dispose 后读取 getOption/dataZoom 的防护。真实 ECharts 浏览器回归覆盖这些状态，工程脚本未改动。该修订改善后续生成指引，不会自动修复已有生成页面。

## 0.1.2 缩放状态与证据范围

依据用户提供的页面修复记录，替换 0.1.1 的单项 currentRange 示例，避免诱导每次构建 option 都反读实例，或固定取首个 dataZoom。补充按需统一缩放状态、单项/batch 事件匹配、百分比/值域转换边界、恢复与联动循环处理。保留首次 setOption/clear/dispose 的空值保护契约。

新增验证表述边界：程序设置与真实输入分开、canvas 挂载与数据绘制分开、Tooltip 触发与视觉定位分开。Step 1–400、具体画布尺寸和滑杆步长不进入通用要求。

本次只修改说明与版本，无运行脚本变更；保留已有浏览器回归。不声称已独立复验用户页面或其 batch/真实拖拽行为。后续具体页面按其需求验证。
