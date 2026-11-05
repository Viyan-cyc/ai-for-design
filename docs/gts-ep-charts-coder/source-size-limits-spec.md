# Feature Spec：生成业务源码的 100 / 500 行约束

## 0. Checkpoint

- 日期：2026-11-04
- 层级：Feature Spec；本次功能的唯一真相源。
- Phase：Review；Status：实现与自验完成，待独立评审；Approval：用户回复“plan approved”，明确批准本计划。
- 最终目标：图表 skill 生成的业务代码便于开发接手，单函数最多 100 行、单文件最多 500 行。
- 当前任务单元：已完成实现和自验，交给独立 reviewer 核对。
- 下一步：独立 review_execute，核对 Plan、实现与 Validation。
- 风险：SFC 源码行号映射、脚手架排除范围、机械拆分和压缩排版。

## 1. Requirements / Done Contract

用户已提出 100/500 上限，并以“plan approved”批准本计划的硬门禁、计数口径和适用范围。

In Scope：仅 skills/gts-ep-charts-coder 的生成约束、业务源文件规模检查、build 接入、维护测试和来源基线。
Out of Scope：修改 gts-ep-coder 或 ict-coder；修改设计包原文；自动重构用户已有工程；限制 skill 自身脚本或第三方运行库；新增格式化器或浏览器验收要求。

完成契约：正常格式的生成业务源文件不超过 500 行，函数不超过 100 行；边界值通过、超出失败；诊断包含源文件、起始行、实测值和上限；build 失败时不刷新 preview-data.js；合法工程与已有门禁继续工作。

## 2. Research / Context Index

仓库根：D:/cyc/project/octo/gts/test/ep-coder。以下路径相对仓库根。

- skills/gts-ep-coder/references/code-rules.md §5.6：按职责预先拆分；800 行是审视阈值，允许合理例外，明确禁止压缩换行规避。
- skills/gts-ep-coder/SKILL.md：编码前读规则、交付前自查；这些要求不新增机器门禁。
- 用户给出的 ict-coder 本地包：未发现 100/500 或明确行数门禁。此结论限于已检查版本。
- skills/gts-ep-charts-coder/scripts/build.mjs：遍历 src，已有 SFC、Babel AST 和 CSS/Less 检查，统一汇总 ERROR，通过后 refresh。
- scripts/source-tools.mjs（同 skill）：compilerRequire、visitAST 等已有工具；复用现有 compiler，不新增依赖。
- skills/gts-ep-charts-coder/SKILL.md、references/chart-host.md：生成入口及工程约束落点。
- tests/gts-ep-charts-coder/integration.mjs：现有集成检查。
- tools/gts-ep-charts-coder/check-package.mjs、check-upstream.mjs：维护检查；docs/gts-ep-charts-coder/upstream-sources.json 为基线。

使用快速流；代码范围已熟悉，上述索引替代另建 codemap/context bundle。Innovate 跳过：复用现有 AST 和 build 错误通道即可，无需引入另一套 lint 框架。

最小单元：业务源码规模门禁及配套生成规则，可通过合成边界用例独立验证。若解析或范围设计不成立，回 Plan 修订，不通过跳过问题文件解决。

## 3. 行为契约

### 3.1 适用范围

检查 src/ 下 .vue、.js、.mjs、.css、.less、.json；包括 App.vue、页面、子组件、hooks、工具模块、API/mock、i18n 和图表配置。Vue 文件总行数包含 script/template/style 和块外注释。

预览 HTML、preview-data.js、public/library、图片字体、文档不在范围。既定工具生成的 src/assets/icons/ 排除；该目录保留给取图工具，不承载业务代码。固定主题文件 src/assets/themes/{base,bridge,default,dark}.less 仅在内容与随包模板一致时豁免，比较时只规范化 BOM 与换行；其他或已修改的主题文件照常检查。不整体豁免 assets/、api/mock/ 或任意 vendor 目录，不接受业务代码自行声明跳过。

扫描全工程适用文件：已有工程修改时，也可能暴露此前未被检查的超长文件。报告并在授权范围内按职责修复；不能静默忽略存量问题或擅自大范围重写。

### 3.2 物理行数

空文件计 0；统一 CRLF、CR 为 LF，忽略文件开头 BOM；末尾的一个换行符不额外产生空白行，其余空行和注释都计数。文件 <=500 通过，501 失败。

函数行数从 AST 函数节点起始行至结束行，首尾均计，包含函数签名、函数体中的空行和注释；函数前独立文档注释不属于函数节点，但计入文件总行数。函数 <=100 通过，101 失败。跨行表达式箭头函数同样计算。

覆盖 FunctionDeclaration、FunctionExpression、ArrowFunctionExpression、ObjectMethod、ClassMethod、ClassPrivateMethod，包括 async、generator、getter/setter 和回调。嵌套函数分别检查，其源码也计入外层函数范围。

SFC 的普通 script 与 script setup 分别解析原始块内容，再按块在原文件的偏移映射行号；不对编译后生成的 setup 包装函数计数。script setup 顶层不是函数。模板中的事件表达式不计为 JS 函数门禁；复杂模板逻辑应提取为脚本函数，模板仍计文件行数。语法或不支持语言错误继续由现有 build 报告，不能吞掉后当通过。

### 3.3 生成与修复

写前按职责安排页面、图表生命周期、option 构造、数据转换及服务接口。需要时拆分，不规定每个任务都生成固定数量的文件。函数聚焦单一职责，入口负责装配协调。

保持正常换行和可读排版，不用压缩语句、删除必要注释或仅搬到嵌套函数规避。超长 option 可按坐标轴、系列、Tooltip 等有意义的职责拆解；数据按语义模块组织。行数检查不证明职责合理，独立 review 继续检查机械拆分与压缩排版。

### 3.4 build 诊断

规模错误进入现有 errors 集合，退出码 1，不增加用户需要运行的检查命令。格式：

- ERROR: /src/pages/Example/index.vue:1: FILE_LINES 501 exceeds 500
- ERROR: /src/api/example.js:12: FUNCTION_LINES 101 exceeds 100 (函数名或 anonymous)

同一批汇总多个问题；其他可继续检查的文件照常检查。规模不合格不能输出成功或刷新 preview-data.js。预览加载器现有同步行为不属于本次变更。

## 4. Plan Contract

### File Changes

| 路径 | 变更 |
| --- | --- |
| skills/gts-ep-charts-coder/references/chart-host.md | 集中定义 100/500、拆分及排版规则 |
| skills/gts-ep-charts-coder/SKILL.md | 必要时仅引用宿主规则，不重复大段约束 |
| skills/gts-ep-charts-coder/scripts/source-size.mjs | 新增纯计数与 AST 检查模块 |
| skills/gts-ep-charts-coder/scripts/build.mjs | 接入范围判定及错误收集 |
| skills/gts-ep-charts-coder/scripts/init.mjs | 将现有压缩的示例输出排版为可读源码，保持行为 |
| tests/gts-ep-charts-coder/source-size.mjs | 新增计数、范围与 build 负用例 |
| tests/gts-ep-charts-coder/integration.mjs | 按需要接入新增检查，保持原有用例 |
| docs/gts-ep-charts-coder/upstream-sources.json | 验证后更新工程内嵌快照，不变更设计快照 |
| docs/gts-ep-charts-coder/source-size-limits-spec.md | 本 spec，回写实际结果和偏差 |

### Proposed Signatures（JS，类型用于契约说明）

- countPhysicalLines(source: string): number
- checkFileLength(source: string, file: string): Diagnostic[]
- checkFunctionLengths(ast: object, file: string, lineOffset: number = 0): Diagnostic[]
- shouldCheckSourceSize(relativePath: string, source: string, scaffoldSource: string | null): boolean
- Diagnostic = { code: 'FILE_LINES' | 'FUNCTION_LINES', file: string, line: number, actual: number, limit: number, name?: string }

函数上限 100、文件上限 500 使用模块常量，首版不提供 CLI 调低检查或跳过规则。SFC 原始块解析与偏移由 build 适配，纯模块不自行读取磁盘或安装依赖。

### Atomic Checklist

- [x] 明确范围与计数测试，先验证 CRLF、尾换行和 SFC 偏移预期。
- [x] 实现纯检查模块及范围判定。
- [x] 接入 build，在 refresh 前汇总错误。
- [x] 加入集中生成规则，修正初始化样例排版。
- [x] 执行正负用例和既有工程回归；修复失败后重跑受影响项。
- [x] 更新工程来源快照，运行双来源和全包检查。
- [ ] 独立 review，回写 Review Matrix、偏差与证据。

## 5. Validation Plan

1. 文件 500/501 行；LF/CRLF/CR、BOM、空文件、有无尾换行、连续尾空行结果一致且符合契约。
2. 普通、箭头、匿名回调、对象/类/私有方法、async/generator/getter/setter 的 100/101 行边界；嵌套函数同时检查。
3. SFC 两类 script、两块共存、template/style 合计超过 500；函数诊断指向 .vue 原始行；超过 100 行的 setup 顶层且无长函数不被误判。
4. 字符串或注释内的 function 文本不被误判；非法语法继续失败。
5. 固定主题原样可豁免，修改后适用；业务 CSS/JSON/mock 仍检查；生成图标和预览运行文件排除。
6. build 集成：超限退出 1、包含预期诊断；修改前已有 preview-data.js 的字节保持不变；拆分后退出 0。
7. 多文件错误一次汇总；合法初始化图表正常构建，生成源码保持可读排版。
8. 既有 verify-build.mjs、图表 integration.mjs、check-package 与两种 check-upstream 检查通过；实际数量和日志执行后记录，不沿用历史数字作本轮证据。

不新增浏览器检查：本功能改变静态门禁，不能借本轮宣布原有视觉验收已完成。

## 6. Review / Validation Status

实际验证（2026-11-04）：

- node tests/gts-ep-charts-coder/source-size.mjs：20 组通过；包括函数类型与边界、换行口径、SFC 原始行号、setup 顶层、范围、错误汇总和失败预览保护。
- node skills/gts-ep-charts-coder/scripts/verify-build.mjs：41 项通过。
- node tests/gts-ep-charts-coder/integration.mjs：15 项通过。
- 内嵌工程快照、设计快照、全包 79 份 Markdown 检查与 skill 格式校验通过。
- 源 gts-ep-coder 与旧来源基线存在变化：SKILL、code-rules、build、verify-build 等；这是外部来源漂移，未同步，本轮保留差异提示。

| 评审轴 | 状态 | 证据 |
| --- | --- | --- |
| Spec Quality & Requirement Completion | 自验通过，待独立评审 | 已批准的计数、范围与拆分契约 |
| Spec-Code Fidelity | 自验通过 | source-size.mjs 签名、build 原始 AST 接入、宿主规则和初始化排版 |
| Code Intrinsic Quality | 自动验证通过，待独立评审 | 20 + 41 + 15 项检查 |

Overall Verdict：实现与自验通过；独立 review 未执行，不能声称外部评审通过。
Plan-Execution Diff：未改 integration 入口，新增规模测试独立运行，现有 15 项原样保留；源工程已变化，因此未用 --record 接受当前源包，只更新内嵌快照和相对旧源基线的分类。未自动合入其他上游更新。

## 7. Risks / Open Questions

- 硬门禁、计数细节和存量全量扫描已获本轮计划批准。
- 行数并不等于复杂度；本次不引入圈复杂度或自动格式化门禁。
- 若实现发现现有模板/文件范围与契约冲突，先回写 spec 再调整计划；不扩大目录豁免规避。
- 回退方式：撤回本功能的门禁接入与规则变更，保留原有编译能力；仅回退本次改动，不影响用户工作。

## 8. Change Log / Reverse Sync

2026-11-04：依用户请求使用 sdd-riper-one 写 Feature Spec；记录 Research、Plan 和审批状态。代码、环境和来源基线未修改，未暂存或提交。

Project Sync Candidate：暂无需写入项目级默认提示的知识；100/500 仅属于此 feature，实施后落到宿主规则。原集成 spec 继续承担集成背景，不作为本次行数规则的第二份真相源。

## 9. Resume / Handoff

恢复时读取本文第 0、3、4、5、6 节。当前 Review，用户已批准并完成实现；下一步由另一 LLM 独立评审本功能 diff 与测试。先核对源码范围、原始 AST 位置、生成目录豁免和反规避规则，再报告可复现问题。原工程来源有未同步漂移，保持独立，不将其误判为本轮已合入。

2026-11-04 Reverse Sync：落地源码规模门禁和可读初始化示例；所有上述自动检查通过，未进行浏览器验收，未暂存或提交。

执行记录：首次源码规模测试的第二 script 块诊断预期误写为 108，按实际源文件逐行核对为 107；修正测试预期，行号契约与实现不变。
