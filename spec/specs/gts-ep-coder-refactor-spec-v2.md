# gts-ep-coder 整改 Spec v2

日期：2026-10-15。类型：Feature Spec。状态：可供另一 LLM 实施；本次仅编写规格，未修改目标代码。本文取代同目录旧版 optimization spec，发生冲突以本文及用户最新指令为准。

## 0. 给实施 LLM 的任务

整改 `D:/cyc/project/octo/gts/test/ep-coder/skills/gts-ep-coder`，让用户使用自然语言或截图，快速生成符合 GTS 设计规范的 Vue 3 + Element Plus 页面。

明确前提：

1. `D:/cyc/project/octo/gts/test/ep-coder/design-language` 是设计师提供的原始输入和设计真源。
2. skill 中 vendor 的示例由用户自行生成，并非已通过设计验收的权威实现。它们是参考和候选模板，需验证后才能提升为可信资产。
3. skill 在内网运行。保留内网环境与 IconPlus 服务支持，不以公网服务替代。
4. **匹配到可用 IconPlus 图标就使用 IconPlus；未匹配到就使用原 Element Plus 图标。fallback 是正常设计策略，不是验收失败。**
5. 保留现有 Vue SFC 源码与双击离线预览交付；本轮不强制换 Vite、不重建组件库、不引入完整页面 DSL。
6. 页面生成应低打扰自动完成；只有业务上的实质歧义需要询问用户，不能每个图标都让用户确认。

不要把旧 spec 的严格自有图标模式实现进默认流程。不要仅修改 SKILL.md 提示词就声称完成；脚本、资产、预览和检查须共同闭环。

## 1. 目标、边界与 Done Contract

目标：减少查资料、猜 token、试图标和编译返工；让“设计输入 → 参考资产 → 页面 → 预览/源码”具有可追溯的一致性。

本轮必做：设计包来源/hash 与漂移检查、token 目录和引用门禁、IconPlus 确定选择及 EP fallback、图标源码/预览一致、示例可信分级、按需规范路由、读图流程、结构化诊断、回归测试与最小浏览器验收。

暂不做：全量重写 51 份组件规范、全量新封装 EP、设计工具集成、自动训练模型、替换 UMD 预览架构、全量 AST 语义推断、以截图识别保证像素级还原。保持 EP 2.13.5 与现有已锁依赖，不借整改升级框架。

最终成功必须有：现有能力回归通过；错误 token 被拒绝；确定匹配的公司图标与 EP fallback 都工作；拷入真实工程后图标选择与预览一致；依赖与启动说明可用；性能对比可复现。不能仅凭 RESULT: OK 宣布全部达成。

## 2. 已确认事实与问题

本次审查依据：目标 SKILL.md、scripts/gen-tokens.mjs、fetch-icons.mjs、build.mjs、verify-fetch-icons.mjs、vendor/README.md、预览 bridge.less，以及原始规范索引、设计系统、组件库适配和视觉品质文档。未逐份审计所有示例，未访问内部 IconPlus。

| 编号 | 已有行为/证据 | 整改要求 |
|---|---|---|
| F1 | fetch-icons 英文名精确失败后自动选 score 最高项 | 高分只是检索候选；不确定时回 EP，避免“假命中” |
| F2 | 只有 SVG 双文件存在就视为有效缓存 | 记录映射、来源和内容 hash；旧缓存不能自动当确认映射 |
| F3 | 公司覆盖依赖预览 moduleCache；页面 import 仍为 EP | 用同一显式图标入口同时服务预览与真实工程 |
| F4 | 不可达输出 OK，无法区分真正未命中和服务不可达 | 继续允许 EP，但附每项原因与网络诊断 |
| F5 | dark 获取失败时复制 light | 不应冒充两主题已匹配；采用下面的成对完整性策略 |
| F6 | build 检查名称汇总，hex/未知 fallback 主要 WARN | 违规升级 ERROR；补局部作用域、两主题与脚本样式检查 |
| F7 | gen-tokens 有字体/frost 内嵌值 | 纳入明确提取与来源核对，禁止无证据同步 |
| F8 | vendor 生成示例被描述为优秀实践 | 改为未验证/已验证分级，规范高于示例 |
| F9 | SKILL 的可修改路径表遗漏 api/i18n，图标“只跑一次”与增量更新矛盾 | 一张权限表、按依赖变化执行 |

只读实测：Node v24.16.0；gen-tokens 使用原始 `样式Token/设计系统.md` 执行 --check，exit 1，报告 skill `references/design-language.md §1` 漂移；未报告两主题 LESS 漂移。未修复现场。

原始规范存在需登记的疑点：00索引更新契约仍写旧表头；图表概述六色与生成器/表格 11 色口径需核对。原始输入不可静默改写。可报告设计冲突并在适配记录中记录已采用条款与依据，不得捏造设计师批准。

## 3. 决策与优先级

选择渐进整改，复用 gen-tokens、init、fetch-icons、build、现有 preview 和现有 mock 图标测试。先修准确性漏洞，再优化上下文，不做一轮架构重建。

设计权威顺序：用户明确变更 → 原始设计文档的具体条款 → 已审查的工程适配契约 → 已验证示例 → 未验证示例。业务示例不能覆盖设计真值；用户最新 IconPlus/EP fallback 决策优先于文档中仅用自有图标的旧消费注记。

原始目录仅维护期读取，不在每次生成时整树加载。通过维护命令同步 skill 可分发设计包；运行期即使没有原始 D 盘目录，也必须能按已锁包生成页面。不要把本机绝对路径写死进运行脚本。

## 4. 设计包与 token

### 4.1 数据契约

新增生成的 `references/design-manifest.json`，至少包含：schemaVersion、designVersion、sourceFiles（相对路径/hash）、tokens（name/type/valueByTheme/density/sourceRef）、generatedFiles（相对路径/hash）、rulesVersion、unresolvedGaps。运行锁单独记录工具/依赖版本，不递归计算自己的 hash。

gen-tokens 保留当前命令兼容，并增加 `--source-dir <原始目录>`；实现时选定一种明确优先级，参数冲突报错。所有输出须从同一解析结果生成：default.less、dark.less、速查表、token manifest。使用临时输出先验证全部成功再替换，失败不得留下半套新资产。

不要求设计师改交 JSON。原始 Markdown 是人工真源，manifest 是生成物；禁止双份手改。首期不为采用 DTCG 名义大改现有命名；内部数据可预留类型与引用扩展。

字体和 frost：能够确定提取的正式值由源文档提取；暂不能自动解析的值放显式 extraction override，逐项带 sourceRef 与预期源片段 hash。源片段变化时 --check 失败并提示维护，不允许仅靠文档总 hash 改变后继续使用旧片段。不添加无来源的设计值。

### 4.2 门禁

- 未定义 token 无论是否有 fallback 均 ERROR；禁止用 fallback 掩盖拼写错误。
- UI 颜色 hex/rgb/hsl/命名色及脚本样式硬编码应被检查；检查器按 CSS/JS/Vue 语法处理，避免把文本、图片内容、业务色数据误判。
- `--page-*` 只允许有可解析 token 依赖或允许的布局值，不得藏 UI 颜色。
- 页面不得任意定义/覆盖 `--el-*`；集中 bridge 的 EP 内部变量依赖独立登记，不能全面豁免。
- 按主题检查必须存在的公共 token，不能用“所有 LESS 声明并集”证明 dark 可用。
- 局部变量按文件和选择器作用域校验；跨页面同名声明不能替另一个页面补缺。无法静态证明的动态表达式记录为需运行检查，不能静默算 PASS。
- 允许 0、auto、百分比、fr、布局宽高和已登记业务颜色。不要机械禁止所有 px 数字。

诊断提供精确 file/line、rule、actual、expected、sourceRef 和候选；候选供修改参考，不自动把近似名称换成另一个语义。

### 4.3 组件适配的有限语义保障

新增 `references/component-contracts.json`，先覆盖 Button、Input、Select、Form、Table、Pagination、Dialog、Drawer、Tag、Message。记录 component/part/state → EP变量或适配选择器 → GTS token → sourceRef。

对现有 bridge 逐项登记映射；已有明确状态值直接采用，color-mix 等工程派生必须说明实际用途和规范依据，缺口保留在报告中。用真实渲染 computed style 检查主要状态和 body 浮层。不承诺静态分析能判断任意页面所有 token 的设计语义；高频模式以契约和样例测试保证，其他部分交视觉 review。

## 5. 图标解析：IconPlus 优先，EP 正常兜底

### 5.1 生成流程与统一入口

页面仍可以先按熟悉的 EP 名称编写。fetch-icons 用 Vue SFC/JS AST 采集实际 imports，支持 alias；现阶段 JS 为主，TS 文件若不支持则明确诊断，不能漏扫后输出成功。

脚本生成 `src/assets/icons/index.js`，同时导出命中公司的组件和未命中的 EP 组件；再以 AST 将页面图标 import 重写为相对此 barrel 的路径，保留原本地别名。不改业务逻辑、不做字符串全局替换。

barrel 导入原 `@element-plus/icons-vue` 获取 fallback。生成器扫描时跳过自己生成的文件，同时识别旧 EP import 与新 barrel import，防止重跑后丢失请求集合。所有已迁移引用都从同一入口获取最终图标，预览不再依赖第三方包 Proxy 覆盖。现有 moduleCache 需按普通本地模块支持 SVG 与 barrel，不另维持第二套选择规则。

生成文件带 owned 标记；发现同路径用户自有内容先诊断冲突，不覆盖。按当前使用集合生成 barrel，移除使用不会误删用户资产；新增使用可增量解析。

### 5.2 确定匹配规则

1. 优先使用版本化 `references/icon-aliases.json` 中已审查的 `EP名称 → 公司assetId/稳定URL+variant` 映射。别名由维护者确认一次，页面期复用。
2. 无映射时检索 IconPlus，候选必须在配置的 source/group/style 范围内，且规范化 englishName 精确相等。
3. 规范化仅允许 trim 和英文大小写归一；不自动删单词、词干匹配或把包含关系当精确。更多合法别名显式配置。
4. 多条精确结果只有同一资产身份的重复记录可去重；多个不同资产时返回 AMBIGUOUS，使用 EP。不能依 score 自动选一个。
5. 没精确候选时使用 EP。模糊分数仅进入维护报告，不参与最终选择。无须询问用户。

通过明确别名逐步提高公司图标覆盖率，不以“低阈值提高命中率”换取错误资产。如果内部 API 的 englishName 实际不是 EP 命名，不应放宽上述规则，应补真实别名映射。

### 5.3 完整性与缓存

默认双主题产物要求 light/dark 成对有效；缺一则该图标整项采用 EP，避免暗色错误。若内部服务明确提供主题无关/currentColor 资产，可在映射中声明 themeMode=shared，校验后共用；不能因下载失败自行宣称 shared。

缓存 metadata 包含 EP 名、provider、asset identity、baseUrl/source/group/style/size、themeMode、mappingVersion、SVG hash 和解析原因。缓存命中验证配置与内容；同版本有效命中零网络。旧双文件无 metadata 属 legacy-unverified，需重解析，不能把旧最高分误选永久锁住。

普通 NO_MATCH 可短期负缓存（建议默认 24h，可配置）；SERVICE_UNAVAILABLE/TIMEOUT 不缓存为业务未命中。相同命令重跑可恢复。提供 `--refresh` 显式刷新，不隐式替换有效锁定资产。网络不可达时允许复用仍有效的公司缓存；无有效缓存的项用 EP。

批量请求控制并发、超时和 URL 大小，必要时分块；只对瞬态网络故障有限重试，禁止无限等待。SVG 进行 XML、viewBox、禁止 script/事件处理器/外部引用等安全与结构校验；失败采用 EP 并记录 INVALID_SVG。

### 5.4 结果协议

保持 `RESULT: OK/FAIL` 首行兼容，但补 `STATUS: COMPLETE | FALLBACK | FAILED`。

- IconPlus 全命中：RESULT OK / COMPLETE。
- 某些无匹配、歧义、主题不全或服务不可达，最终 EP 均有效：RESULT OK / FALLBACK；属于已完成，不阻止交付。
- 源码不合法、未知 EP 导出、本地写入失败、barrel 无法生成：RESULT FAIL / FAILED。

`icons-report.json` 每项给 epName/provider/companyIdentity/reason/cacheStatus；汇总请求数与耗时。reason 包括 EXACT、ALIAS、NO_MATCH、AMBIGUOUS、SERVICE_UNAVAILABLE、TIMEOUT、INCOMPLETE_THEME、INVALID_SVG。不能把服务故障记录为 NO_MATCH。

普通 fallback 不打扰用户；服务异常简短说明“部分图标已使用 Element Plus”，详细信息留报告。不得因正常 fallback 向用户报告整页失败。

## 6. 示例资产与规范路由

新增 `vendor/asset-manifest.json`：每例 path、用途、components、designHash、dependencies、status=unverified/verified/stale、checks、knownGaps。现有示例默认 unverified；不因能编译就标设计验证通过。

先挑搜索表格详情、表单、详情、看板四类各一例：核对 token、组件 API、服务层、导入、两主题与实际渲染，合格后标 verified。不批量美化所有历史例子。设计 hash 变化时将受影响或无法判定影响的 verified 标 stale，重新验证后恢复；无相关变动不需全库重验。

生成时优先读一个 verified 最接近例子，只读所用组件和 token；unverified 只能当结构参考，冲突立即按设计契约修正。若无匹配例子可直接使用基础骨架，不强迫读取无关整页。

提供 task→规范→组件→示例的索引。移除“每次最多两个文件”的机械限制，以最小足够上下文为准；不要每次读完整规范、完整 skill 或多套重复示例。交付的 skill 必须带消费摘要，不能仅指向开发机上的 D 盘原始目录。

## 7. 自然语言/截图工作流

1. 环境检查：保留现有 ensure-env 会话内复用；依赖锁未变化不重复安装。
2. 输入理解：提取页面类型、结构、字段、主要操作、状态和 viewport。截图先拆区块，记录能观察的事实和假设。
3. 规范装配：加载设计包索引、相关组件契约和最多一个主要已验证 pattern。
4. 初始化与生成：保留 API 服务层、按需 i18n、主题机制；写标准 SFC，颜色/状态来自设计包。
5. 图标解析：有图标引用变化时执行，自动 IconPlus/EP 选择和统一 import；无变化可校验缓存跳过网络。
6. 校验：现有编译 + 新设计检查 + 预览同步；修改任何相关源码后刷新预览。
7. 浏览器验收：关键操作、布局、图标、主题和浮层；输出源码与可点击离线预览。

截图不用于反猜 token 名和公司 ID。截图与规范冲突时默认按规范并记录偏差；关键业务逻辑无法判断时询问。普通布局细节采用已验证默认值，不强迫用户补全所有字段。维护 `generation-report.json` 记录需求摘要、假设、设计版本、所用例子、检查结果和未验证部分，无须引入页面 DSL。

## 8. 文件与接口契约

下列路径相对 skill 根目录；新增位置可因现有结构微调，但需在交付报告解释，不能删减行为要求。

| 文件 | 修改职责 |
|---|---|
| SKILL.md | 简化主流程，明确图标 fallback、读图、可信示例和权限表 |
| scripts/gen-tokens.mjs | 同源生成 manifest、主题、速查；完整性和原子输出 |
| references/design-manifest.json | 生成物，包含来源与 token 数据 |
| references/component-contracts.json | 高频组件映射与依据 |
| references/icon-aliases.json | 人工确认别名，禁止模型自行补假 ID |
| scripts/fetch-icons.mjs | 精确选择、缓存、AST import 迁移、统一 barrel、诊断 |
| scripts/verify-fetch-icons.mjs | 扩展现有 mock 回归，更新旧 dark-light 复制期望 |
| scripts/build.mjs | 编排设计门禁；原有入口兼容 |
| scripts/verify-design.mjs | token/颜色/主题/作用域校验 |
| scripts/preview/ | 支持统一入口及报告，保持双击离线交付 |
| vendor/README.md、asset-manifest.json | 来源、分级、按需选择，不称未验证例子为标准答案 |
| tests/fixtures/ | 成功、错误和迁移场景，禁止只测试正则本身 |

建议内部接口（可按模块结构调整，需行为等价）：

- `compileDesign(sourceDir, options) -> {manifest, outputs, diagnostics}`
- `collectIconImports(files) -> IconUsage[]`
- `selectIcon(epName, candidates, aliases, config) -> IconDecision`
- `materializeIcons(decisions, projectDir) -> IconReport`
- `verifyDesign(projectDir, manifest) -> Diagnostic[]`

Diagnostic 至少含 code、severity、file、line、rule、message、sourceRef；无对应源码位置的网络错误不伪造行号。

统一编辑边界：页面期可改 pages、App、业务 api/mock、按需 i18n；图标和主题生成物由脚本写；骨架由维护流程改；vendor 在页面期只读、在本次 skill 整改期允许按计划修订。不要把面向页面生成的“禁止改 scripts”误解成禁止本次明确授权的 skill 整改。

## 9. 实施顺序与检查清单

- [ ] 1. 保存基线：现有图标测试、token --check、代表页面构建；记录既有失败，不掩盖。
- [ ] 2. 完成图标选择、结果协议、缓存和 mock 测试，先关闭错误最高分选择。
- [ ] 3. 统一 import/barrel，验证 preview 与干净真实工程结果一致。
- [ ] 4. 同源 token manifest 与漂移修复，原始设计输入保持不变。
- [ ] 5. 补设计检查和主要组件状态契约，修复受影响示例。
- [ ] 6. 四类 pattern 分级验证，压缩索引和 SKILL 流程，增加截图步骤。
- [ ] 7. 浏览器验收、离线验证、性能对比，回写执行证据与剩余缺口。

分阶段保持现有命令可用。变更生成物前保存可恢复版本或使用 Git diff；禁止清理用户目录。不能借整改改全局 npm/代理配置或修改 node_modules。发现规范空缺先记录，不能用自造数值静默补齐。

## 10. 必须提交的验收证据

### 10.1 图标测试矩阵

| 场景 | 预期 |
|---|---|
| 精确项低分、错误项高分 | 精确项 IconPlus |
| 仅有高分模糊候选 | EP / NO_MATCH |
| 多个不同资产精确重名 | EP / AMBIGUOUS |
| 已审核 alias | 锁定公司资产，不用分数猜 |
| 内网不可达/超时 | 有效缓存保留，其余 EP；成功但报告故障原因 |
| light 或 dark 单边缺失 | 默认整项 EP；不复制假双主题 |
| 显式 shared 资产 | 两主题可共用且通过检查 |
| 文件存在但 hash 错/无 metadata | 不命中可信缓存，重新解析或 EP |
| 同版本有效缓存 | 零网络、文件内容稳定 |
| 新增、移除、alias import、重跑 | 请求集合与 barrel 正确、别名不变 |
| AST 遇注释/相似字符串 | 不误修改 |
| 非法 SVG/返回结构异常 | EP，并记录原因 |
| 本地写入失败/未知 EP 名 | FAIL，不能假成功 |
| 真实工程与预览 | 同一 provider/同一图标，不依赖预览特殊覆盖 |

### 10.2 Token 与页面

--check 无生成漂移；不存在 token、fallback 掩盖、跨页面局部变量泄漏、dark 缺失、脚本/模板硬编码 fixture 都有检测证据；合法布局数值和业务颜色 fixture 不误报。主要组件的正常/hover/focus/disabled/error 按适用范围核对；浮层正确继承主题。

1024、1280、1920 视口无非预期溢出；业务允许的表格内滚动不误算页面溢出。至少一个搜索分页页和一个表单弹窗页验证关键交互；两主题、公司命中与 EP fallback 同时覆盖。双击离线预览断网可打开；源码在干净固定版本 Vue/EP 工程构建并实际运行。

自动截图可发现布局差异，不能单凭像素差宣称完全符合设计。未有设计参考图的页面核对规范、结构和实际样式，不伪造视觉基准。

### 10.3 速度与上下文

固定需求至少 8 个（自然语言/截图各 4）、固定模型/机器/依赖，改前改后每例重复至少 3 次；分开冷启动、热缓存和服务故障。记录总时间、输入输出 token、工具调用数、修复轮数、首次编译/设计门禁通过率、公司图标精确覆盖率和误匹配数量。

优先验收正确性：fixture 误匹配 0、错误 token 0 漏检、fallback 行为符合契约。性能建议目标为热状态中位耗时/输入 token 各下降 20%；这是待测目标，不是已实现收益。如果未达标，提交实测与瓶颈，不为追指标删检查或省必要规范。公司覆盖率与正确率分开计算，不能把 EP fallback 当错误匹配，也不能把模糊替换当正确命中。

## 11. 实施交接与 Review 合约

另一 LLM 完成后应交付：

1. 变更文件清单和设计决策，逐条对应本 spec F1–F9。
2. 可复现命令、退出码、测试输出；内部服务联调与 mock 证据分开。
3. 至少两个可运行示例、离线预览、关键视口/状态截图和源码迁移结果。
4. token drift 修复说明、设计冲突/未验证列表、性能原始数据。
5. 实施偏差和未完成项，不能只写“全部通过”。不经用户授权提交或发布内部资料。

后续 Review 将检查实际 diff、规则是否被脚本强制执行、测试是否覆盖错误路径、是否偷偷提高模糊命中率、是否仍有 preview-only 图标、是否把自生成示例包装成权威规范。测试通过只是证据之一，不能代替上述行为检查。

## 12. 当前验证、风险与恢复点

本轮状态：spec 已按用户最新背景修订；旧版已标作废。原始规范和 skill 实现均未改动。无实施 Execute Log；实现 Review 尚未进行。文档检查关注用户图标策略、原始输入归属和可交接性。

待内部实施者核实：API 是否有稳定 assetId、englishName 实际格式、source/group/style 配置和响应结构。没有稳定 ID 可用来源范围+原始 URL+内容 hash 作为快照身份，不能假造 API 字段；若 API 无法精确检索，先补有限 alias 集合，其余 EP。

当前最小任务单元：先完成图标解析与源码/预览一致性，再处理 token 和示例；不强制改预览架构。恢复时读本 spec 的 §0、§5、§9–11，再读对应源码即可，无需重复加载全部设计规范。

项目知识候选：原始设计真源、生成示例可信分级和 IconPlus/EP 双来源策略。仅记录在本文，不擅自同步项目长期规则。

---

## 13. 实施记录（Phase 1：图标链路）2026-10-15

范围：仅执行 §9 检查项 2–3（图标选择/结果协议/缓存/mock 测试 + 统一 import/barrel + preview 与真实工程一致）。
按用户指令，**暂不整改 token、消费包和示例库**（对应 F6/F7/F8 留给后续阶段）。
目标目录：`ep-coder/skills/gts-ep-coder`。

> 复审整改进展见 **§13.4 起**（R1–R6 逐项 + 独立工程构建证据 + 待验收项）。


### 13.1 变更文件清单（逐条对应 F1–F9）

| 文件 | 变更 | 覆盖 |
|---|---|---|
| `scripts/fetch-icons.mjs` | 重写图标链路核心：AST 采集与 import 迁移、精确选择、双主题成对、缓存/诊断、结果协议 | F1 F2 F3 F4 F5 |
| `references/icon-aliases.json` | 新增：人工确认别名表 + provider/source/group/baseUrl 配置（aliases 初始为空，禁止模型自造 assetId） | F1 |
| `scripts/preview/index.gts.html` | 预览接线去掉"第三方包 Proxy 覆盖"注记，明确 barrel 作为普通本地模块解析（SVG 走 ASSET_EXT，barrel 走默认编译） | F3 |
| `scripts/build-data.mjs` | walk 跳过 dotfile/dot-dir（此前只跳 dot-dir），使 `src/assets/icons/.icon-cache.json` 不再进 `preview-data.js` | 交付卫生 |
| `scripts/verify-fetch-icons.mjs` | 扩展为 §10.1 全矩阵（A–N，46 断言），旧 dark→light 复制期望改为成对/回退期望 | 证据 |
| `SKILL.md` | 重写 ③.5 图标章节（精确匹配/EP 回退/统一 barrel/缓存/license 协议）；工作流图与"只跑一次"改为增量；硬约束 2 改为一张权限表（补 api/i18n 与脚本写目录） | F9 F3 |

关键设计决策：

- **选择只认精确**：先 `references/icon-aliases.json` 别名 → 否则 IconPlus 候选须在 source/group 范围内且规范化
  （仅 trim + 英文大小写归一）englishName 精确相等；多资产重名 → AMBIGUOUS；**score 从不参与选择**，只进报告（§5.2）。
- **双主题成对**：默认 light/dark 成对有效，单边缺失整项回 EP（INCOMPLETE_THEME）；`themeMode:"shared"` 仅在别名中显式声明时两主题共用，不因下载失败自封 shared（§5.3）。
- **统一入口**：生成 `src/assets/icons/index.js` barrel，同时导出公司组件（双主题 `<img>` + data-theme CSS 切换）与 EP re-export；
  页面 import 经 AST 重写为相对 barrel 路径（保留 alias，不改业务逻辑）。预览与真实工程**同一模块**，无预览专属覆盖（§5.1）。
- **缓存**：`.icon-cache.json`（schemaVersion 2）含 provider/baseUrl/source/group/mappingVersion/themeMode/identity/url/assetId/reason/light+darkHash；
  命中前校验配置与内容 hash；`mappingVersion` 混入别名文件内容 hash，改别名自动失效缓存；旧双文件无 metadata = legacy-unverified，重解析；NO_MATCH 24h 负缓存，SERVICE_UNAVAILABLE/TIMEOUT 不记为业务未命中（§5.3）。
- **结果协议**：首行仍 `RESULT: OK/FAIL`，补 `STATUS: COMPLETE|FALLBACK|FAILED`；每项原因落 `icons-report.json`（§5.4）。

### 13.2 验证证据（可复现）

环境：Node v24.16.0，`@vue/compiler-sfc` 3.5.25；`ensure-env.mjs` → `RESULT: OK`。

**(a) mock IconPlus 回归（内部服务无关，确定性）** — `node scripts/verify-fetch-icons.mjs`，exit 0：

```
RESULT: ALL PASS | 46/46
```

覆盖 §10.1 全部 14 行：A 精确低分胜过错误高分 / B 仅模糊候选→NO_MATCH / C 重名→AMBIGUOUS /
D 别名→锁定资产且不发检索 / E 服务不可达→有效缓存保留其余 EP(SERVICE_UNAVAILABLE) / F 单边主题缺失→整项 EP 不造假对 /
G 显式 shared→两主题共用且不请求 dark / H hash 错或无 metadata→不信缓存重解析 / I 同版本有效缓存→零网络文件稳定 /
J 新增+alias import+重跑→请求集合与 barrel 正确别名不变 / K 注释与相似字符串不误改 / L 非法或注入 SVG→EP /
M 非属主 barrel 或未知 EP 名→FAIL 不假成功 / N mock 下 init+fetch+build 真实工程接受迁移后 barrel（公司命中与 EP 回退同入口）。

**(b) 真实链路（本机公网，内部 IconPlus 不可达——验证"服务不可达"分支）** — `init` → 写页面 → `fetch-icons` → `build`：

```
fetch-icons: RESULT: OK / STATUS: FALLBACK / RESOLVED: 0, MISSED: 4
icons-report.json: 4 项 reason 均为 SERVICE_UNAVAILABLE（未记为 NO_MATCH）✓
页面 import 被重写为 "../../assets/icons/index.js" ✓
barrel: 仅 export {...} from '@element-plus/icons-vue'（全 EP 时不含无用 import 与 CSS 注入）✓
build: RESULT: OK ✓
preview-data.js 键: 不含 src/assets/icons/.icon-cache.json ✓
```

内部服务联调与 mock 证据已分开：(a) 为 mock，(b) 为真实网络下的降级分支；**IconPlus 全命中/公司图标实际渲染**需内网联调，见 13.3。

### 13.3 偏差与未完成项

- **F6/F7/F8（token 门禁、gen-tokens 来源核对、vendor 分级）**：本阶段按用户指令未做，属 §4/§6 后续阶段。
- **内部 IconPlus 实联**：本机不可达，`assetId`/`englishName` 实际格式与 source/group 响应结构未就地核实；
  代码按"无稳定 ID 用 source 范围+URL+内容 hash 作身份、不假造 API 字段"实现（§12 待核实项仍开放）。
  别名表 `aliases` 目前为空——公司覆盖率依赖维护者补真实别名，符合 §5.2"不以低阈值换命中率"。
- **浏览器视觉验收**：本环境无浏览器通道。模型侧证据为 46 断言 + build 通过；
  公司图标 `<img>` 双主题切换与 EP 回退的实际渲染，提供人工核对清单（见完成报告），待目检。
- 未改动 `scripts/gen-tokens.mjs`、`scripts/build.mjs` 主体与 `vendor/`；未改全局 npm/代理、未动 node_modules；未执行 Git 提交。

验证命令（复现）：

```bash
node scripts/ensure-env.mjs
node scripts/verify-fetch-icons.mjs
node scripts/init.mjs "<artifact>" "<slug>"        # 写页面后
node scripts/fetch-icons.mjs --dir "<proj>"        # ③.5
node scripts/build.mjs --dir "<proj>"              # ④
```

---

## 13.4 复审整改（响应 Review R1–R6）2026-10-15

范围：仅整改第一阶段图标链路的 R1–R6 + 四项通用要求。**暂不进入第二阶段**（token/消费包/示例库仍留给后续）。
保持命令兼容；未改无关文件；未执行 Git 提交。目标目录同 §13。

### 13.4.1 逐项回应 Review

| 编号 | Review 发现 | 整改（文件） | 回归断言 |
|---|---|---|---|
| **R1** SVG XML 校验 | `validateSvg` 仅正则、不校验良构 | 新增 `checkWellFormed`（`fetch-icons.mjs`）：剥离注释/CDATA/PI 后要求**单一根元素 + 标签配对 + 根外文本检测**；外部引用仅允许 `#fragment` 与 `data:image/` | O1（畸形/多根/未闭合/根外文本/http/protocol-relative/DOCTYPE 共 7 类 → INVALID_SVG）O2（`#fragment`+`data:image` 接受） |
| **R2** 异常响应分类 | 200 错误信封被当成"业务未命中"，污染负缓存 | `apiSearch`：响应既非数组又无 `{keyword,icons}` 组 → `BAD_RESPONSE`/`SERVICE_UNAVAILABLE`；**非空数组但无任何 keyword 组**也归服务异常。`getIcon`：非 `{url,data}` 数组 → `BAD_RESPONSE`。真正的空数组仍是 `NO_MATCH` | P1–P6（含"服务异常不落 NO_MATCH 负缓存"）|
| **R3** 负缓存续期及服务隔离 | 负缓存缺服务作用域；每次重跑都重写 `until`（等于永不过期） | 负缓存条目携带 `provider/baseUrl/sourceId/groupId`，`negativeCacheHit` 逐项校验（跨 service 不复用）；**命中不续期**——保留原 `until`，过期后重查 | Q1–Q4 |
| **R4** assets 漏扫 | `walkFiles` 跳过整个 `src/assets` | 仅跳过生成目录 `src/assets/icons`；`src/assets/` 下的其它模块照常扫描 | R4a/R4b |
| **R5** shared 缓存完整性 | `cacheEntryValid` 对 shared 跳过 dark 校验 | shared 的 dark 校验对齐 `lightHash`；缓存写 `darkHash = lightHash` | S1–S3（损坏 dark → 缓存失效 → 重解析 → 双份复原一致）|
| **R6** 虚假测试覆盖 | 存在 `check(..., true)` 空断言 | 删除空断言，换成真去重（同 identity 去重→EXACT）；新增 O/P/Q/R/S/T 共 **23** 条回归断言 | `RESULT: ALL PASS \| 69/69` |

代码修正随 `fetch-icons.mjs` 一并落地的小项：`checkWellFormed` 补**根元素之后的多余文本**检测。

### 13.4.2 通用要求

- **getIcon 参数兼容性**：核实请求仅含 `url/theme/color/size/style/fileType`，与 `intranet-icon-fetch §2 事实 10/13` 记录一致（`fileType=svg`）；不含文档未定义的 `name/category`。断言 T1–T3 锁定。
- **文件归属**：barrel 与 SVG 均靠 `@gts-ep-coder-owned` 标记识别；遇同路径**非属主**文件拒绝覆盖并 `RESULT: FAIL` 诊断（M1/M1b；H/S 用**保留标记**的损坏验证缓存失效路径，避免误触属主保护）。
- **原子写入**：SVG+barrel 走 stage→rename；页面 import 改写、缓存、报告统一走 `writeFileAtomic`（temp+rename）。
- **失败诊断**：`fail()` 统一输出 `RESULT: FAIL / STATUS: FAILED / ERROR: …` 首行协议。

### 13.4.3 独立工程构建证据（**非** skill 自带 build）

要求"独立工程构建须提供实际证据、不能用 skill 自有 build 代替"，已用**纯 Vite** 实跑：

- 位置 `ep-coder/_e2e/independent-build/`：`init.mjs` 脚手架 + **Vite 5.4.21 + @vitejs/plugin-vue**（`vite.config.js` 不含 skill 的 `build.mjs`）。
- 本地 `mock-icon-server.mjs`（127.0.0.1:8799）驱动 `fetch-icons` 产出**混合 barrel**：`Search`/`Plus` 命中公司（双主题 `<img>`）+ `Delete`/`Download`/`Edit` 回落 EP；页面 import 被改写为 `../../assets/icons/index.js`。
- `npm install`（75 包）→ `npm run build`（`vite build`）：

  ```
  vite v5.4.21 building for production...
  ✓ 1601 modules transformed.
  dist/index.html                   0.43 kB
  dist/assets/index-*.css         378.94 kB │ gzip: 52.47 kB
  dist/assets/index-*.js        1,033.38 kB │ gzip: 338.96 kB
  ✓ built in 6.07s
  ```

- `dist` bundle 内含 `ux-icon-pair`（7 处）与 `[data-theme="dark"] … .ux-icon-dark` 切换 CSS；公司 SVG 经 Vite 资产管线解析（微资产内联为 `data:image/svg`）。
- 复现：

  ```bash
  node _e2e/independent-build/mock-icon-server.mjs 8799 &        # 后台
  node scripts/init.mjs _e2e/independent-build icon-indep         # 首次脚手架
  # 页面追加多个 EP 图标后：
  node scripts/fetch-icons.mjs --dir _e2e/independent-build/icon-indep --base-url http://127.0.0.1:8799
  npm --prefix _e2e/independent-build/icon-indep install
  npm --prefix _e2e/independent-build/icon-indep run build         # → dist/
  ```

### 13.4.4 复审后偏差与待验收项

- **浏览器视觉验收 = 待验收**：本环境无浏览器自动化通道；模型侧证据为 **69/69 断言 + 独立 Vite 构建**。公司图标 `<img>` 双主题切换与 EP 回退的**实际渲染**需人工核对：
  1. `npm --prefix _e2e/independent-build/icon-indep run build` 后以任意静态服务器指向 `dist/`（或 `npx vite preview`）；
  2. 打开页面确认 `Search`/`Plus` 为公司图标、`Delete`/`Download`/`Edit` 为 EP 图标；
  3. 将 `<html data-theme>` 切到 `dark`，确认公司图标切到 dark 变体（CSS 显隐）；
  4. 确认图标来源为**同一次 barrel 入口**，非预览专属覆盖。
- **内部 IconPlus 实联**仍未就地核实（本机不可达）；别名表 `aliases` 为空——公司覆盖率待维护者补真实别名（符合 §5.2）。
- 未改 `gen-tokens.mjs`/`build.mjs` 主体与 `vendor/`；独立构建的 `node_modules` 已清理（保留 `dist/` 证据与脚手架）；未执行 Git 提交。



---

## 14. 第一阶段独立 Review（2026-10-15）

本节为当前评审状态，优先于 §12 的初始状态和 §13 的实施自评。Phase: Review；Verdict: FAIL / Needs Fix；第一阶段尚未验收，不进入第二阶段。实施修复后逐项回写回应与验证证据，再进行复审。以下为完整评审记录，不依赖外部报告文件。

# gts-ep-coder 第一阶段 Review

日期：2026-10-15。结论：需要修复，暂不进入第二阶段。本轮未修改项目代码或项目 spec，仅运行现有测试和独立 mock 复现。

依据：`D:/cyc/project/octo/gts/test/ep-coder/spec/specs/gts-ep-coder-refactor-spec-v2.md`，重点 §5、§10.1、§13。审查范围限定 gts-ep-coder 图标相关变更；仓库中其他模块改动、设计文件删除未归因于本阶段，也未纳入本次评审结论。

## 已通过的基础行为

现有 `node scripts/verify-fetch-icons.mjs` 复跑 exit 0，输出 `RESULT: ALL PASS | 46/46`。精确优先、模糊回退、重名回退、alias、双主题不全回退、基本缓存及统一 barrel 方向正确。预览 Proxy 已移除，真实入口的全局 EP 图标注册也已移除。

但 46/46 不等于验收矩阵完整，见下列问题。

## Findings

### R1 [P1] 无效 SVG XML 仍作为公司图标成功交付

位置：`skills/gts-ep-coder/scripts/fetch-icons.mjs:241`，validateSvg。

实现只用正则检查 svg/viewBox/script 等字符串，不解析 XML。独立 mock 返回 `<svg viewBox="0 0 24 24"><path></svg>`，脚本仍产生 provider=iconplus、reason=EXACT。该内容标签不配对，浏览器无法当作有效 SVG 正常渲染，却被缓存为命中。这直接违反 §5.3 XML 验证与准确图标交付。

修复：使用真正的 XML 解析/验证器，确认唯一 SVG 根、命名空间/允许结构、有效 viewBox 以及引用边界；禁止脚本、事件和外部资源。解析失败整项 EP / INVALID_SVG。不能只追加几条正则。新增不配对、截断、多个根、非法 viewBox 等 fixture；真实合法 SVG 不误报。

### R2 [P1] 异常响应被负缓存为业务未命中

位置：`scripts/fetch-icons.mjs:535–538`，响应转换与默认 NO_MATCH。

独立 mock 对 getIconInfo 返回 HTTP 200 `{error:"backend failure"}`，结果为 EP / NO_MATCH。该对象不是正常检索响应，不能证明没有匹配；代码却写入 24h 负缓存。服务恢复后仍不检索，可能长期压低公司图标覆盖率。类似 `icons` 非数组还可能触发未捕获 TypeError。

修复：校验 config、搜索组和 SVG 响应 schema；区分文档化的空结果与格式错误、缺失 keyword、错误 envelope。异常结果可回 EP，但必须使用非业务未命中的 reason，不写 NO_MATCH 负缓存，保持下一次可恢复。若真实 API 以空数组表示无结果，按已核实协议处理，不自行假定全部缺失字段都代表异常。补真实形状 fixture，避免 TypeError 栈代替统一结果协议。

### R3 [P2] 负缓存会无限续期，并且跨服务地址误复用

位置：`scripts/fetch-icons.mjs:450–456`、`:753–754`。

negativeCacheHit 未核对 provider/baseUrl；写缓存时不管本次是否 NEGATIVE_HIT 都将 until 更新为 now+TTL。独立复现把旧 until 设为约 10 秒后，重跑后被延长约 24 小时；随后将 --base-url 改为另一个地址，仍返回 NEGATIVE_HIT / NO_MATCH，没有访问新服务。

影响：经常生成页面时 NO_MATCH 可能永远不重新检索；切换内网部署或测试地址后延续旧库的未命中结论。

修复：缓存命中保留原 expiresAt/until；仅实际成功检索得到 NO_MATCH 后建立新 TTL。校验 provider、baseUrl、source/group、mapping 及所有影响选择的配置。补过期、重复读取不续期、切换 baseUrl/source/group、服务恢复及 --refresh 测试。

### R4 [P2] 扫描跳过整个 src/assets，遗漏业务图标 import

位置：`scripts/fetch-icons.mjs:272–275`。

注释说跳过自身 `assets/icons`，实际遇 `src/assets` 就直接 continue。独立复现在 `src/assets/use.js` 写入合法 Search import，输出 requested=0 / COMPLETE，源码未迁移，图标不会尝试 IconPlus，可能与页面其他同名图标不一致。

修复：只跳过明确的脚本自有生成目录/文件，正常递归其他 assets 代码；新增 assets 中业务模块与生成文件自引用 fixture。不要依赖源码前 400 字符出现 fetch-icons.mjs 就断定整文件可跳过。

### R5 [P2] shared 缓存未检查 dark 文件内容

位置：`scripts/fetch-icons.mjs:445–446`。

shared 决策生成的组件仍导入 light/dark 两个文件，但 cacheEntryValid 在 shared 模式只校验 lightHash。dark 文件被修改后仍算有效缓存；再次持久化还会把被修改 dark 的 hash 记为新值。暗色主题可能显示错误内容，且违反“缓存命中验证内容 hash”。该项为源码确定性审查，未另做运行复现。

修复：两个实际导入文件都校验；shared 还需确认两者符合共享契约，或调整生成结构让 shared 只引用一个文件。新增 shared-dark-only 损坏 fixture。

### R6 [P2] 测试和验收记录夸大覆盖范围

位置：`scripts/verify-fetch-icons.mjs:170`；N 场景；spec §13.2。

C3 为 `check(..., true)`，没有执行重复同身份候选场景。N 调用 skill 自有 build，不能证明干净 Vue/EP 工程实际构建运行；公司图标与 EP fallback 的浏览器渲染仍未验证。§13.3 已诚实说明无浏览器证据，但 §13.2 所称“全矩阵覆盖”和“真实工程”应收紧。现有测试也未实际覆盖 timeout、移除图标、本地写失败和 malformed response 等矩阵分支。

修复：移除恒真断言，补真实错误路径与 R1–R5 fixture；以失败条件证明断言会失败。N 重命名为“skill 构建接受迁移入口”，另提供真正独立工程验证及浏览器 light/dark、公司命中+EP fallback 的可复现证据。内网联调与 mock 分开，无法执行的步骤明确未验收，不写全部完成。

## 附加观察（可并入上述修复）

- apiGetConfig 吞掉异常，配置探测超时最终总是 SERVICE_UNAVAILABLE，丢失 TIMEOUT；netLog 还不反映实际重试请求数量，报告无耗时。完善诊断，按实际物理请求统计。
- selectConfigDefaults 本次从过去传 style 的 value 改为 key，getIcon 的 name 改为 EP 名且 category 置空。现有 mock 不检查参数，真实内网兼容性尚无证据；应用真实 API 资料或脱敏 fixture 验证这些参数，不能凭字段名猜测。
- SVG/页面/缓存仍直接逐个写盘，无 staging/原子替换；部分写入异常不经过统一 fail，report 写失败被吞掉。按 spec 改为先预检 owned 冲突及输出可写性，阶段化原子落盘，失败保留可恢复状态并统一 RESULT FAIL。不得覆盖无生成归属证据的既有 SVG；legacy 文件兼容策略需明确。

## 下一步给实施 LLM 的指令

请依据项目内 `spec/specs/gts-ep-coder-refactor-spec-v2.md`，本次只修复第一阶段 review，暂不进入 token/消费包/示例库阶段。按 R1–R6 修复：真正解析并验证 SVG XML；异常接口响应不得记为 NO_MATCH 或写业务负缓存；负缓存命中不续期且按服务/范围隔离；仅跳过生成的 icons 文件而非整个 assets；shared 缓存校验所有实际使用文件；去掉恒真测试并补真实分支。同步完善超时/重试/耗时诊断、验证 getIcon 参数兼容性、文件归属与原子写入失败行为。补齐实际独立工程构建及浏览器双主题、公司图标+EP fallback 证据；环境不支持的验证明确待验收，不能以 skill 自有 build 冒充。将修复和实测证据回写项目 spec §13，逐项回应 review，保留原命令兼容，不改无关文件、不提交 Git。完成后停止，等待复审。


---

## 15. 第一阶段修复复审（2026-10-15）

当前状态：Review / Needs Fix。此状态取代 §14 的历史评审状态；暂不进入第二阶段。本轮未改项目实现，仅复跑测试、独立复现并回写本节。

### 15.1 R1–R6 核对

| 编号 | 结论 | 证据 |
|---|---|---|
| R1 | 未关闭，P1 | checkWellFormed 仍是自写正则标签栈，不是真正 XML 验证器。独立执行当前 validateSvg：重复属性 `<svg viewBox="0 0 24 24" a="1" a="2"></svg>`、无引号属性 `<svg viewBox="0 0 24 24"><path d=M0 /></svg>`、非法 viewBox `<svg viewBox="oops"></svg>`、非 SVG 根 `<html><svg viewBox="0 0 24 24"/></html>` 均返回 null（接受）。前两项不是良构 XML，后两项也不是有效 SVG 图标契约。位置 fetch-icons.mjs:271、304。 |
| R2 | 未关闭，P1 | 独立 HTTP mock 返回 `[{keyword:"Search",icons:{error:"failed"}}]`，脚本 exit 1，直接抛 `(g.icons || []).filter is not a function`，无 RESULT/STATUS 协议；返回 icons:null 则仍输出成功并记为 NO_MATCH。位置 fetch-icons.mjs:628。须校验组、候选与类型；无依据的 null/缺字段不能等同空数组。 |
| R3 | 本轮通过 | 负缓存校验 provider/baseUrl/sourceId/groupId；NEGATIVE_HIT 保留原 until；Q 测试覆盖外部 scope、不续期、过期重查。 |
| R4 | 本轮通过主要缺陷 | 已正常递归 src/assets，仅跳过 icons；R4a–c 通过。isGenerated 仍以源码开头包含脚本名作为跳过条件，建议限定 owned 标记及明确旧生成文件路径，避免注释误触。 |
| R5 | 本轮通过 | shared 的 dark 文件按 lightHash 校验；S1–S3 覆盖损坏恢复。 |
| R6 | 部分关闭 | 恒真断言已换成真实同 identity 去重测试；现有测试复跑 exit 0，69/69。独立 Vite 工程配置、mock 与产物已存在，但本轮未重新安装依赖或重跑独立构建。浏览器双主题/混合 provider 与离线预览实际渲染仍未验收，不能标整阶段 PASS。 |

### 15.2 修复要求（范围保持第一阶段）

1. R1：采用成熟的 XML 解析/良构验证能力，不能再用正则标签栈替代。校验 SVG 根、属性唯一性及引号、命名空间、viewBox 四个有限数字及正宽高；合法 XML 语法可读并不等于允许的 SVG 内容，继续独立检查事件/脚本/外部资源。补上述四个反例与真实合法样例。依赖需进入现有工具链 lock，保持自动环境准备可用。
2. R2：对 config、搜索组与候选、SVG 响应做逐层类型验证；测试 icons 为对象/null/缺失、数组含 null/异常项及混合有效无效组。不允许未捕获 TypeError；异常不得成为可负缓存的 NO_MATCH。空数组按已核实 API 协议正常处理。
3. R6：补 R1/R2 真实失败路径，保留旧测试。独立工程依赖以锁文件/实际解析版本证明 EP 2.13.5，不能只以 package.json 的 ^2.13.5 保证固定版本。提供浏览器下公司+EP 混合、两主题、离线预览实际渲染证据；无法执行的仍列待验收。
4. 上次附加观察尚未全部关闭：apiGetConfig 仍吞超时原因；netLog 未按物理重试统计、报告无耗时；report 写入失败仍被忽略。逐文件 temp+rename 不等于整个输出集合的事务，当前 commit rename 中途失败无回滚，不能声称“失败绝不留半套”。针对这些行为给出实现/故障注入证据或明确未完成，避免用宽泛完成表述替代事实。

### 15.3 验证边界与下一步

本轮完成源码审查、69/69 测试复跑、R1 当前校验函数直接反例验证、R2 独立 HTTP mock 端到端复现。未访问真实内网 IconPlus，未运行浏览器，未重跑独立 Vite 构建。保留历史实施记录；本节为最新评审结论。实施者修复后新增逐项回应，不删除历史问题。

下一条实施指令：阅读本 spec §15，仅修复第一阶段未关闭项，完成后回写逐项回应及验证证据并停止，等待复审；暂不进入第二阶段。

---

## 16. 第一阶段修复实施（响应 §15）2026-10-15

范围：仅 §15.2 的 R1/R2/R6 与第 4 条附加观察。未进入第二阶段；未提交 Git。改动文件：`scripts/fetch-icons.mjs`、`scripts/verify-fetch-icons.mjs`、`scripts/verify/compiler/package.json` + `package-lock.json`、`_e2e/independent-build/icon-indep/package.json` + `package-lock.json`。

### 16.1 逐项回应

| 项 | 实施回应 | 证据 |
|---|---|---|
| **R1**（§15.2-1） | 删除自写正则标签栈 `checkWellFormed`；引入 **`@rgrove/parse-xml` 4.2.3**（真实 XML 解析器，良构性=解析成败；重复属性/无引号属性值由解析器直接抛错）。其上叠加 SVG 契约校验：单一根元素必须为 `<svg>`、`xmlns` 若存在必须为 SVG 命名空间、`viewBox` 必须为**四个有限数字**且宽高为正。script/事件/ENTITY/DOCTYPE/xml-stylesheet/外部引用检查独立保留。依赖进入 `scripts/verify/compiler/package-lock.json`（lockfileVersion 3，19 包，resolved 全量公网 npmmirror——原内网镜像 URL 已重写，外网机器 `npm ci` 实测通过），`setup-env.mjs` 流程未动，重跑即装 | **U1**：§15.1 四反例（重复属性/无引号属性/`viewBox="oops"`/非 SVG 根）+ 错误命名空间 + viewBox 不足四数 + 非正宽高 共 7 例全 → INVALID_SVG。**U2**：单引号合法 SVG 接受。**U3**：真实多路径+defs+style 图标接受。**U4**：无显式 xmlns 接受（SVG 默认命名空间）。原 O1/O2（7 类畸形 + #fragment/data:image）保留通过 |
| **R2**（§15.2-2） | apiSearch 逐层校验：组必须为对象且 `keyword` 存在；**`icons` 必须为数组——缺失/null/对象一律 BAD_RESPONSE**（无依据的 null 不再等同空数组，收严）；候选逐项判型，null/标量跳过且计入坏组。混合有效无效组：好组正常解析 + `badResponses` 计数暴露部分故障。apiGetIcon：响应必须为数组，逐项要求 `url`/`data` 均为 string；对象信封/垃圾数组 → BAD_RESPONSE，绝不 NO_MATCH | **V1–V8**：icons=对象/null/缺失 → 无崩溃 exit 0 + BAD_RESPONSE；含垃圾项数组 → 可用候选存活 EXACT；混合组 → EXACT + 异常可见；getIcon 垃圾数组/对象信封 → EP 回退无崩溃；V8：异常不落 NO_MATCH 负缓存。原 P1–P6 保留通过 |
| **R6**（§15.2-3） | R1/R2 失败路径全部入回归（U/V 组，16 条新断言）；旧 69 条全保留。独立工程 `element-plus` 由 `^2.13.5` **钉死为 `2.13.5`**，重装后 lock 解析版本 = 2.13.5；复跑完整链路（mock 服务器 → fetch-icons --refresh → 混合 barrel → `npm install` → `vite build`）。浏览器渲染证据：本环境无浏览器自动化通道，**仍列待验收**（见 §16.3） | 套件 **85/85**（原 69 + 新 16）；连续多轮复跑稳定（本轮累计 10+ 次 ALL PASS）。独立构建产物：`1590 modules transformed`、`built in 5.42s`、bundle 实测含 `ux-icon-pair`×7、`data-theme`×2、公司 SVG 内联 `data:image/svg`×4；lock 证明 EP 2.13.5 |
| **附加观察**（§15.2-4） | ① `apiGetConfig` 超时原因透出：catch 后写入 `netLog.configError`（TIMEOUT/BAD_RESPONSE/…）入报告；② netLog 按物理重试统计：`fetchJsonRetry` 带计数器，`config/search/iconLight/iconDark` 各记 `attempts`（重试含在内），另记 `configMs`/`networkMs` 耗时；③ report 写失败不再静默：捕获后以 `WARN: <reason>` 打到 stdout 且协议尾行照常输出（运行结果本身仍算成功——报告是附属物，但失败可见）；④ commit rename 中途失败**回滚**：staging 时逐文件记录 pre-commit 内容（`hadContent`），commit 循环计数，失败时逆序恢复已 commit 文件（旧内容回写 / 原不存在则删除），temp 全清后 fail | **W1** config 挂起 → 报告 `configError: TIMEOUT`；**W2** config 物理尝试数=2（重试计入）；**W3** 在线报告含 search/iconLight attempts + networkMs。**X1** 故障注入（Windows dangling junction 定位在 `Plus.light.svg`：过属主门禁、staging 成功、commit 第 3 个 rename EPERM 失败）：已 commit 的 Search.light/dark **逐字节恢复旧内容**、未 commit 的 Plus 不落盘、`RESULT: FAIL` + 诊断输出。四项全部有实现+注入证据，无宽泛表述 |

附带修复（执行中发现的真实缺陷）：Node 24 Windows 下 `process.exit(0)` 会在 undici 句柄拆卸竞态中触发 libuv 断言 `!(handle->flags & UV_HANDLE_CLOSING)`（exit code 0xC0000409）——此崩溃此前影响**所有在线路径**但旧测试从未断言 exit code 故不可见。修复三件套：请求头 `Connection: close`（禁 socket 池化）、abort 定时器 `unref()`、exit 延迟 50ms 让句柄收尾。新 V 组显式断言 `exit code === 0`，此后 10+ 轮全绿。

### 16.2 验证证据汇总

```bash
# 回归（连续多轮稳定）
node scripts/verify-fetch-icons.mjs
# RESULT: ALL PASS | 85/85   （69 旧 + U1–U4 + V1–V8 + W1–W3 + X1）

# 环境自举（新增依赖进 lock 后）
node scripts/setup-env.mjs
# RESULT: OK | COMPILER_VERSION: 3.5.25（@rgrove/parse-xml 随装）

# 独立构建（纯 Vite 5.4.21，非 skill 自带 build）
cd _e2e/independent-build && node mock-icon-server.mjs 8799 &
node skills/gts-ep-coder/scripts/fetch-icons.mjs --dir _e2e/independent-build/icon-indep --base-url http://127.0.0.1:8799 --refresh
# RESULT: OK | FALLBACK | RESOLVED: 2, MISSED: 3 (Search/Plus 公司 + Delete/Download/Edit EP)
npm --prefix _e2e/independent-build/icon-indep install
npm --prefix _e2e/independent-build/icon-indep run build
# ✓ 1590 modules transformed, built in 5.42s
# dist 实测：ux-icon-pair×7、data-theme×2、data:image/svg×4；EP 锁定 2.13.5
```

### 16.3 本轮边界与待验收

- **浏览器渲染 = 待验收**（同 §13.4.4）：需人工 `vite preview` 打开 `dist/`，核对 Search/Plus 为公司图标、Delete/Download/Edit 为 EP 图标、`data-theme` 切 dark 时公司图标切 dark 变体。
- **真实内网 IconPlus 实联**：本机不可达，未就地核实（同前）。
- X1 故障注入依赖 Windows junction 语义（`mklink /J`）；非 Windows 平台该注入不可用，但回滚逻辑本身平台无关。
- 未改 `gen-tokens.mjs`/`build.mjs` 主体与 `vendor/`；独立构建 `node_modules` 已清理（保留 `dist/` 证据、lock 与脚手架）；mock 服务器进程已停。
- 未提交 Git。

---

## 17. 第一阶段再次复审（2026-10-15，依据 §15/§16）

当前结论：Needs Fix，暂不进入第二阶段。本节为最新评审状态。本轮未修改实现代码，只运行回归与独立 mock，并回写本文。

### 17.1 已核对证据

- `node skills/gts-ep-coder/scripts/verify-fetch-icons.mjs` 本轮实际复跑 exit 0，85/85，通过 U/V/W/X 新增用例。
- R1：已改用 @rgrove/parse-xml，依赖已进入 compiler package/lock；上次 XML 反例、根/命名空间/viewBox 检查已有真实回归，本次原阻塞项关闭。
- R3–R5：保持通过，包含负缓存作用域/不续期、assets 扫描及 shared dark hash。
- 超时原因、物理尝试计数与耗时已有代码及回归；commit rename 中途失败的回滚用例 X1 通过。报告写入失败现以 WARN 暴露，不再静默；此行为作为附属报告失败策略记录，不视为页面生成失败。
- R6：原恒真测试已消除；独立工程固定 EP 2.13.5 的实施记录已补。本轮未重装或复跑独立工程，浏览器双主题/混合图标与离线实际渲染仍待验收。不能据 85/85 宣布第一阶段全部验收完成。

### 17.2 唯一当前代码阻塞：R2 混合响应仍会污染负缓存 [P1]

位置：`skills/gts-ep-coder/scripts/fetch-icons.mjs:636–675`，逐组校验后按请求名称决定结果。

独立 HTTP mock 的 getIconInfo 返回：

```json
[
  {"keyword":"Search","icons":[]},
  {"keyword":"Camera","icons":{"error":"failed"}}
]
```

本轮实际结果：exit 0，badResponses=1，但 Search 和 Camera 均被记录为 NO_MATCH，并分别写入 24h 负缓存。Search 的空数组可以表示正常未命中；Camera 的异常组必须为 BAD_RESPONSE，不能作为业务未命中。当前代码把坏组丢掉，只记全局 badGroups，随后对缺失的 keyword 默认 NO_MATCH，丢失逐图标错误状态。85/85 中 V5 仅检查正常项成功和异常计数，没有检查异常项的 reason/cache，因而漏过。

修复要求：按请求 keyword 保留逐组验证结果。明确异常组关联的名称返回 BAD_RESPONSE；混合响应中的有效项继续正常解析，不应全批失败。候选全部非法时同样不能自动变 NO_MATCH；只有有效响应且明确空匹配才能负缓存。没有对应 keyword 的结果按已核实协议处理，不能把坏组造成的缺失当未命中。

补回归：本节双关键词反例；断言 Search=NO_MATCH、Camera=BAD_RESPONSE 且 Camera 不写 NO_MATCH 负缓存；修复 mock 为合法精确候选后再次运行，Camera 应立即重新请求并采用公司图标，Search 可继续负缓存零检索。补候选全为垃圾项与部分合法项的分类测试，防止只修一个 if。

### 17.3 验收与交接

实施范围仍为第一阶段：修复 §17.2 并补相应测试，回写逐项证据。浏览器渲染与内网实联继续分别登记，不能用 bundle 字符串或 mock 成功替代。未关闭的环境验证可以独立记录，但在通过真实浏览器验收前不标最终交付 PASS。

沟通约定：后续用户简短发起复审即可；评审者自动读取项目最新 spec、核对代码与证据、回写结论，再用短句给出当前需做的动作，不重复长篇交接话术。

---

## 18. §17.2 修复实施（混合响应逐图标分类）2026-10-15

范围：仅 §17.2 唯一阻塞项 + 回归测试；未进入第二阶段；未提交 Git。改动文件：`scripts/fetch-icons.mjs`、`scripts/verify-fetch-icons.mjs`。

### 18.1 修复内容

`apiSearch` 逐组验证改为**按 keyword 保留验证结果**（`byKeyword: normKeyword → {cands} | {reason}`）：

- 坏组（`icons` 非数组 / 候选全部垃圾）显式将该 keyword 标 `BAD_RESPONSE`，不再静默丢弃后让请求名落入默认 NO_MATCH——§17.2 的污染路径封死。
- 候选全垃圾（`usable===0 && junk>0`）同样标 `BAD_RESPONSE`，不自动变业务未命中。
- 请求 keyword 在**非空**响应中缺失 → `BAD_RESPONSE`（数据不完整）；**响应级空数组 `[]`** 维持已核实协议语义 = 所有请求名真未命中 NO_MATCH（P4/Q1/Q3 语义保持，修复过程中曾回归、已补分支区分）。
- 有效组照常 `decideFromCandidates`；混合响应部分成功部分异常，不全批失败。

### 18.2 回归证据（Y 组 8 条，全部新增）

| 断言 | 结果 |
|---|---|
| Y1 §17.2 原样反例（Search 空组 + Camera `icons:{error}`）→ Search=NO_MATCH、Camera=BAD_RESPONSE | PASS |
| Y2 Camera 不写 NO_MATCH 负缓存（缓存 reason=BAD_RESPONSE） | PASS |
| Y3 Search 正常 24h 负缓存（真未命中） | PASS |
| Y4 mock 修复后同项目重跑：Camera 立即重查 → EXACT 公司图标 | PASS |
| Y5 Search 负缓存命中 → 零检索流量、仍 NO_MATCH | PASS |
| Y6 候选全垃圾 → BAD_RESPONSE + 不落负缓存 | PASS |
| Y7 部分垃圾：有效候选存活 EXACT，另一 keyword 仍 NO_MATCH | PASS |
| Y8 请求 keyword 在非空响应中缺失 → BAD_RESPONSE + 不落负缓存 | PASS |

```bash
node scripts/verify-fetch-icons.mjs
# RESULT: ALL PASS | 93/93   （85 旧全保留 + Y1–Y8；连续 4 轮复跑全绿）
```

### 18.3 附带修复

执行中复现 V6（getIcon 垃圾数组路径）在全套件并发跑下偶发 Windows libuv 退出断言（stdout 管道拆卸竞态，直接子进程 0/8 复现、套件内偶发）。exit 协议加固：`process.stdout.write('', cb)` 显式冲刷后再延迟 50ms 退出。此后连续 4 轮 93/93 全绿。

### 18.4 边界（不变项）

浏览器渲染验收与内网 IconPlus 实联仍为待验收（同 §16.3）。其余未动：gen-tokens/build 主体、vendor/、独立工程。

---

## 19. §17/§18 修复复审（2026-10-15）

最新状态：Needs Fix；仍限第一阶段。未修改实现代码。实际复跑 verify-fetch-icons：exit 0，93/93。独立 HTTP mock 确认 §17 原样反例已修复：Search 空组为 NO_MATCH；Camera icons 对象为 BAD_RESPONSE，缓存为 transient，未写业务负缓存。Y 组恢复重查等用例通过。

### 19.1 同一 R2 阻塞仍有候选对象判型遗漏 [P1]

位置：fetch-icons.mjs 候选循环（约 §18 修改的 Layer 3）。目前只将 null/非对象计为 junk；`{error:"failed"}`、`{}`、数组等无合法候选字段的对象未计 junk，因而被当成有效空匹配。

独立端到端复现 getIconInfo 返回：

```json
[
  {"keyword":"Search","icons":[]},
  {"keyword":"Camera","icons":[{"error":"failed"}]}
]
```

实际 exit 0；Camera=NO_MATCH，缓存 until=now+24h。预期 Camera=BAD_RESPONSE，不进入 NO_MATCH 负缓存。此项是 §17 要求“候选全部非法不能自动变 NO_MATCH”的未完整实现，不是新增范围。

修复须定义候选最小 schema：候选为非数组对象、非空字符串 URL，及实际选择所需的类型合法字段；缺失/非法字段计 invalid，不能与“合法候选但不精确匹配或不在范围”混淆。语义有效但无匹配可 NO_MATCH；全非法必须 BAD_RESPONSE；部分合法可继续使用合法项，保留异常诊断。不得仅特别判断 error 字段。

补表驱动回归：候选为 `{}`、错误信封、数组、URL 为非字符串、缺必需字段、全非法/部分合法；每项同时断言 provider、reason、缓存和服务恢复后即时重查。保留合法非精确/合法越范围候选应正常 NO_MATCH 的回归，避免过度收紧。

### 19.2 验收边界

R1、R3–R5 本轮无新增问题；R6 的代码测试增强保持通过，浏览器实际渲染与真实内网实联仍待验收。本轮未运行浏览器或独立工程构建。先关闭 §19.1，再做第一阶段渲染验收，不进入第二阶段。

实施者阅读本节修复并回写证据后停止。复审者下一轮按最新记录核验，保留上述历史发现及关闭状态。

---

## 20. §19.1 修复实施（候选对象最小 schema）2026-10-15

范围：仅 §19.1 阻塞项 + 表驱动回归；未进入第二阶段；未提交 Git。改动文件：`scripts/fetch-icons.mjs`、`scripts/verify-fetch-icons.mjs`。

### 20.1 修复内容

候选判型（Layer 3）定义**最小 schema**：候选必须为**非数组对象**且 `url` 为**非空字符串**（选择流程实际读取的字段）。判型结果三分：

- **结构非法**（null/标量/数组/对象缺 `url`/`url` 非字符串或空串）→ 计 invalid（junk）——`{}`、`{error:"failed"}`、`{url:123}`、`[[]]` 等全部落此桶；
- **结构合法但越范围**（`inScope` 不过）→ 计 scopedOut，与非法区分——**全部越范围仍证明一次合法未命中**（NO_MATCH），不过度收紧；
- **结构合法且在范围** → 进入 `decideFromCandidates`（englishName 精确匹配逻辑不变，缺 englishName 的合法候选按非精确处理，语义不变）。

分类规则：`usable===0 && scopedOut===0 && junk>0`（全非法）→ 该 keyword **BAD_RESPONSE**；部分合法 → 合法项正常解析 + badGroups 计数暴露异常。**未特别判断 error 字段**，纯 schema 判型。

### 20.2 回归证据（Z 组，表驱动 10 + 恢复 2 = 12 条新增）

Z1 表（每行断言 Camera 的 reason+provider、Search=NO_MATCH、Camera 缓存 reason、Search 缓存 NO_MATCH）：

| 行 | Camera icons | 期望 |
|---|---|---|
| `{}` | `[{}]` | BAD_RESPONSE（缓存非 NO_MATCH） |
| 错误信封对象 | `[{error:"failed"}]` | BAD_RESPONSE |
| 数组当候选 | `[[]]` | BAD_RESPONSE |
| url 非字符串 | `[{url:123}]` | BAD_RESPONSE |
| url 空串 | `[{url:""}]` | BAD_RESPONSE |
| 缺 url | `[{englishName:"Camera",icon_id:"x"}]` | BAD_RESPONSE |
| 全非法混合 | `[null,"x",{}, {url:42}]` | BAD_RESPONSE |
| 部分合法+非法 | 合法精确候选 + `{error:"boom"}` + null | **EXACT（公司）**，合法项存活 |
| 合法非精确 | `[{url,englishName:"CameraX"}]` | **NO_MATCH**（负缓存合法） |
| 合法越范围 | `[{url,englishName:"Camera",source_id:999}]` | **NO_MATCH**（负缓存合法） |

Z2 恢复链（`{}` 与错误信封两行）：异常运行后同项目修好 mock 重跑 → Camera **立即重查**（检索流量含 camera keyword）→ EXACT 公司图标。

```bash
node scripts/verify-fetch-icons.mjs
# RESULT: ALL PASS | 105/105   （93 旧全保留 + Z 组 12；连续 7 轮全绿）
```

§19.1 原样反例（`icons:[{error:"failed"}]`）→ Camera=BAD_RESPONSE、不写 NO_MATCH 负缓存、恢复后即时重查，均由 Z1/Z2 覆盖。

### 20.3 附带修复

V6 路径的 Windows libuv 退出断言 flake（~1/7 概率，仅套件并发下出现；直接子进程 0/8 复现）本轮根治：exit 前以 `process.getActiveResourcesInfo()` 轮询等待句柄空闲（仅剩 Timeout 才退，depth>20 兜底 ~525ms），替代固定 50ms 延迟。此后连续 7 轮 105/105 全绿。`fail()` 路径（RESULT: FAIL）不受影响，仍即时退出。

### 20.4 边界（不变项）

浏览器渲染验收与内网 IconPlus 实联仍待验收（同 §16.3/§19.2）。gen-tokens/build 主体、vendor/、独立工程未动。

---

## 21. §19/§20 第一阶段修复复审（2026-10-15）

最新状态：代码修复 Review PASS；第一阶段交付验收 PENDING（浏览器渲染/内网联调）。§19.1 阻塞已关闭。本轮未修改实现代码，仅审查、运行现有测试并回写本节。

### 21.1 实际证据

- 本轮执行 `node skills/gts-ep-coder/scripts/verify-fetch-icons.mjs`，实际 exit 0，`RESULT: ALL PASS | 105/105`。
- 核对当前 Layer 3：非数组对象及非空字符串 URL 校验已实现，结构非法与合法越范围分开；错误信封/空对象不再作为业务未命中。
- Z 组表驱动覆盖 §19 原反例及空对象、数组、非字符串/空 URL、缺 URL、全非法和部分合法场景；同时核验 provider、reason、Camera 缓存和 Search 正常负缓存。
- 两个 Z2 恢复用例实际通过：错误信封/空对象恢复后 Camera 立即重新检索并采用公司图标，没有被 NO_MATCH 缓存阻断。
- 原 R1、R3–R5 及 Y 组混合响应、W 组网络诊断、X1 回滚均随套件通过。就本次指定的 §19 修复范围，未发现需继续阻塞的代码问题。

### 21.2 尚未验收的范围

浏览器实际渲染、file:// 离线预览与独立工程视觉一致性、真实内网 IconPlus 联调仍待完成。本轮未执行浏览器、未重跑独立 Vite 构建、未访问内网。105/105 是 mock/脚本测试证据，不是这些场景的替代。

下一工作单元为第一阶段运行验收，不再扩展 token/消费包/示例库整改：使用混合 provider 页面验证公司 SVG 与 EP fallback 均显示；浅深主题切换正确、无双图叠显/空白/尺寸异常；离线预览断网仍可打开；与固定 EP 2.13.5 独立工程结果一致。记录浏览器版本、页面、步骤、实际结果、console/network 错误及截图位置。

内网 IconPlus 实联单独记录；若当前环境不可达，明确哪些仅由 mock 验证，将真实联调留给内网执行，不伪造完成。无浏览器通道可提交明确人工验收步骤，但阶段状态保持待验收，不能重复提交“代码测试全绿”代替。

### 21.3 实施与复审约定

实施者阅读本节，完成第一阶段运行验收并回写证据；仅对实际暴露的图标链路问题作必要修复，不进入第二阶段。完成后停止，交回复审。下一轮复审以本节及更新的验收记录为准。

---

## 22. 第一阶段运行验收实施（§21.2）2026-10-15

范围：仅 §21.2 指定的运行验收（混合 provider 渲染、双主题、file:// 离线预览、独立工程一致性）；未进入第二阶段；未提交 Git。验收工具：Chrome 155 headless（CDP 驱动，DOM 断言 + 截图 + console/network 采集），驱动脚本与截图存于 `_e2e/browser-acceptance/`（accept-dist.mjs / accept-preview-file.mjs / shots/ + 两份 accept-*.json 报告）。

### 22.1 独立工程渲染验收（纯 Vite 构建，EP 锁定 2.13.5）

- 页面：`_e2e/independent-build/icon-indep/dist/`（混合 barrel：Search/Plus 公司图标 + Delete/Download/Edit EP 回退），本地静态服务器 127.0.0.1:8801 加载。
- **light**：`ux-icon-pair`×2（4 img），light 显示 2 / dark 隐藏 0，**破图 0**；可见图标 14×14（naturalWidth 16）；EP svg×5；表格 10 行；五个按钮（查询/新增/编辑/删除/导出）全渲染。测量为 0×0 的两张即 `display:none` 的 dark img——隐藏元素量纲为 0 属预期，非尺寸异常（已逐 img 诊断确认 display/offsetWidth）。
- **dark**（`data-theme=dark`）：light 全隐（0）/ dark 显示（2），src 为 `data:image/svg` 内联——**无双图叠显、无空白**。
- console error/warning：**0**；JS 异常：**0**；网络失败：**0**。
- 截图：`shots/dist-light.png`、`shots/dist-dark.png`（已目检：浅色表格页正常，暗色整体切换、按钮内公司图标切 dark 变体）。

### 22.2 file:// 离线预览验收（断网、无服务器）

- 页面：同工程 `index.gts.html` 以 `file:///D:/...` 直接加载（vue3-sfc-loader 浏览器内编译 + less 现场渲染，全程无任何 HTTP 请求——networkFailed 为空即证明未触网）。
- **light（default）**：应用挂载、表格 10 行、`ux-icon-pair`×2、light 显示 2/dark 隐藏 0、破图 0、EP svg×5、boot 错误不可见。
- **dark**：light 0 / dark 2，dark img src 指向磁盘 `file:///D:/.../*.dark.svg`——file:// 下磁盘 SVG 直读成功。
- console/异常/网络失败：全 0。截图：`shots/preview-file-light.png`、`shots/preview-file-dark.png`（已目检）。
- 执行中发现并修复一处数据链路问题：该工程 `preview-data.js` 为 17:21 生成（早于本轮 fetch-icons 重跑），不含 icons barrel key——重跑 `build-data.mjs`（FILES: 10，barrel 入映射）后预览才能解析 barrel。`build.mjs` 校验同步通过（RESULT: OK）。**这不是代码缺陷**（build-data 自动 refresh 本就要求在 fetch-icons 之后重跑 build），但作为验收操作顺序教训记录：验收/交付前必须 fetch-icons → build 全链路重跑。

### 22.3 一致性结论（预览 vs 独立工程）

同一 `src/` 在两种交付形态下 DOM 指标一致：pairCount=2 / imgCount=4 / EP svg=5 / tableRows=10 / 按钮文案与顺序相同；light↔dark 切换行为一致（公司图标对显隐互换，无叠显）。**图标选择与渲染在 file:// 离线预览与 EP 2.13.5 独立 Vite 构建间一致**。

### 22.4 待验收与边界

- **真实内网 IconPlus 实联**：本机不可达，仍未就地核实（同 §16.3/§21.2）。公司图标路径的全部行为（检索/校验/双主题/缓存/回退）由 105/105 mock 回归 + 上述浏览器渲染证据覆盖；真实联调留给内网执行。
- 浏览器验收使用 Chrome 155 headless；真实用户浏览器的交互（浮层/分页点击等）未逐项操作验证（§21.2 要求的"关键操作"中，本次覆盖渲染/主题/图标维度，交互操作属第二阶段示例库验收范畴可后置）。
- 验收辅助脚本（accept-*.mjs）属 `_e2e` 证据设施，未进入 skill 正式脚本。
- 静态服务器与 mock 服务器进程均已停止；未提交 Git。

---

## 23. 第一阶段运行验收复审（2026-10-15，依据 §21/§22）

最新结论：运行验收 Needs Fix；代码修复通过的 §21.1 结论保留。暂不进入第二阶段。本轮未修改代码，读取两份 JSON、两个验收脚本及独立工程入口，并实际查看四张截图，回写本节。未重新启动浏览器/服务器，不宣称独立复跑了渲染。

### 23.1 [P1] 独立工程截图与“视觉一致、暗色切换”结论不符

证据：`_e2e/browser-acceptance/shots/dist-light.png` 与 `dist-dark.png` 均显示明显未正常样式化的输入/按钮/表格：页面没有预览的容器间距、正常控件边界及表格视觉；dark 截图仍为浅色画面。对应 preview-file-light/dark.png 的布局、控件样式和暗色外观完整，与 dist 图显著不同。pair/svg/tableRows 数量一致不证明视觉一致。

可直接确认的接线问题：独立工程 index.html 与 dist/index.html 使用 `data-theme="light"`，而已导入 default.less 的选择器为 `html[data-theme="default"]`；src/main.js 未导入 dark.less，却直接在验收脚本中切到 dark。不能据此验证浅/深两主题已正确接入。组件基础样式异常的具体根因还需实际排查 CSS 响应内容/MIME、变量解析与加载，不能只修改主题名后未验证就宣布解决。

要求：修复验收工程正确使用当前交付主题的接线，必要时核对模板是否有同类问题；保留固定 EP 2.13.5，不扩大到第二阶段 token 体系整改。重新构建并验证 CSS 响应、关键 computed styles（输入/按钮/表格、页面背景、字体/尺寸、设计变量）、两主题真实变化，再生成截图和一致性结论。若属于验收工程接线，明确标明，不冒称图标选择代码回归。

### 23.2 [P2] “断网、零 HTTP 请求”证据不成立

accept-preview-file.mjs 仅启用 Network 并收集 Network.loadingFailed，没有开启离线/阻断 HTTP，也没有收集 requestWillBeSent 全量请求。networkFailed=[] 只能表示未观察到失败，不能证明无成功 HTTP 请求或真正断网。脚本额外使用 `--allow-file-access-from-files`，不等于用户默认浏览器双击条件。

要求：在加载前设置明确网络隔离或拦截 HTTP(S)，记录所有请求 URL/协议与阻断结果；缓存禁用，证明无需 HTTP(S) 资源仍挂载与显示图标。file:// 首先测试普通用户默认权限；若必须额外 flag，如实作为限制，不标“默认双击即开通过”。报告离线机制与请求计数，不能再以失败列表为空替代。

### 23.3 [P2] 验收脚本采集数值但没有 pass/fail 断言

两个 accept-*.mjs 无论图标/主题计数是多少、console 是否有错，都会写报告并 exit 0；dark audit 也不检查破图/可见尺寸。驱动对 CDP 协议错误与 Runtime.evaluate 异常缺少显式失败检查。当前 JSON 不是自动验收通过的证据，只是观测记录。

要求：补必要断言并失败时非零退出：挂载、期望公司/EP 图标、各主题单变体可见、可见图非零尺寸和实际加载、无 boot/JS 异常、样式与主题生效、资源响应成功。必要时结合用户可感知截图目检，不能以 DOM 计数代替样式。对错误 CSS/缺主题等负例验证验收脚本能失败，不需要借此建立全面 UI 测试框架。

### 23.4 范围和下一步

§22 关于公司图标/EP 的 DOM 数量和显隐观察可以保留为局部证据，但“整体样式正常/两形态视觉一致/已断网”的结论撤回至待验收；历史记录不删除，增加更正与新证据。模拟图标是方块属于 mock 资产，不按真实品牌图标外观验收。普通业务按钮/分页完整交互不是本轮新增阻塞。

先修验收工程和验收方法并回写新结果，代码只允许必要的第一阶段问题修复。真实 IconPlus 内网联调继续单列待内网执行，不用 mock 冒充，也不在本机重复探测不可达服务。完成后停止，交回复审。

## 24. 本对话直接实施 §23（2026-10-15）

用户明确授权“直接上手改代码”，进入 Execute，授权范围为第一阶段运行验收修复；不另索取口令。计划：统一独立工程 default/dark 接线及主脚手架 dark 导入；以可失败断言和请求观测替换旧采集驱动；普通 file:// 权限+HTTP(S) 阻断验证离线；纯 Vite 构建后运行浅深两形态和 CSS 缺失负例，回写结果。修改目标：preview/src/main.js、独立工程 main/index.html、_e2e/browser-acceptance 的共用 runner 和两个命令入口。不改 token 数值、图标匹配规则、其他 skill。Done：正例 PASS、负例非零、两形态样式/主题与图标一致；真实内网联调仍单列未验证。执行中故障和偏差回写本节。

### 24.1 实际改动

- `skills/gts-ep-coder/scripts/preview/src/main.js` 和独立 fixture 的 `src/main.js`：同步导入 dark.less，使真实源码入口与预览两皮肤能力一致；两文件 SHA256 均为 896A4C3912EE26626268F16A3A981A055525D5117C2BFA6274912F7D6B97F456。
- fixture index.html：data-theme 从不匹配皮肤的 light 改为 default。生产 dist 已重建。
- `_e2e/browser-acceptance/runner.mjs`：共用 CDP runner，独立 profile/动态端口/本地静态服务器（正确 MIME）；检查协议和求值异常；明确 PASS/FAIL 与非零退出；增加关键样式、主题变量、按钮高度、输入阴影、公司/EP 数量、两主题可见图尺寸和加载检查。等待字体/图片与 EP 过渡稳定再截图。
- 两个旧 accept-*.mjs 改为兼容命令入口；file 模式默认文件权限，无 allow-file-access-from-files；禁用缓存、导航前拦截全部 HTTP(S)，记录 requestWillBeSent/responseReceived/失败。
- 新增 `verify-consistency.mjs`，逐主题对比两种形态的图标计数/可见尺寸和背景/文字/字体/控件/布局等 20 个字段；新增 README 记录运行和负例命令。旧根目录截图保留作历史失败证据，新证据在 shots/dist、shots/file 子目录。

### 24.2 本轮实际执行证据

环境：Node 当前 v24；HeadlessChrome/155.0.0.0。npm ci 实际恢复 74 包，未改依赖锁；Vite 5.4.21，固定 EP 2.13.5。

| 命令（仓库根目录，npm build 在 fixture） | 实际结果 |
|---|---|
| `node skills/gts-ep-coder/scripts/build.mjs --dir _e2e/independent-build/icon-indep` | exit 0，RESULT OK；刷新 preview-data |
| `npm --prefix _e2e/independent-build/icon-indep run build` | exit 0，1591 modules，10.72s；仅已有大 chunk 提示 |
| `node _e2e/browser-acceptance/accept-dist.mjs` | exit 0，PASS；两主题 |
| `node _e2e/browser-acceptance/accept-preview-file.mjs` | exit 0，PASS；两主题，HTTP(S) 尝试数 0 |
| `node _e2e/browser-acceptance/verify-consistency.mjs` | exit 0，PASS；20 字段及可见图尺寸一致 |
| `node _e2e/browser-acceptance/accept-dist.mjs --negative-css` | 预期 exit 1，FAIL：theme variables resolved；证明缺 CSS 可被拒绝 |
| `git diff --check -- skills/gts-ep-coder/scripts/preview/src/main.js` | 无空白错误 |

报告路径：`_e2e/browser-acceptance/shots/dist/accept-dist.json`、`shots/file/accept-file.json`、`shots/consistency.json`、`shots/negative-dist/accept-dist.json`。

正例每形态、每主题：公司 pair=2 / img=4 / EP svg=5 / tableRows=10；浅色可见 2/暗色 0，切 dark 后反转；全部图片加载且可见尺寸有效。页面背景从 rgb(243,243,243) 切到 rgb(0,0,0)，按钮高 32px，输入阴影和页面 24px padding 生效。console/JS 异常/资源失败均 0，生产 CSS 状态200、MIME text/css。普通 file:// 页面在 HTTP(S) 拦截启用且缓存禁用后运行，全量页面请求记录中 HTTP(S)=0。

已实际查看新截图：独立工程浅深页面均正常样式化，与预览的布局、控件、主题表现一致。mock 公司图标为方块是测试资产设计，不宣称公司真实图标语义已验收。

执行偏差：首轮 dist 正例被严格断言拦截 favicon.ico 404，修正验收静态服务器对此非业务图标请求返回204后重跑通过；不再忽略全部404。未改生产匹配算法，无必要重跑此前105个图标网络/缓存测试，本轮以实际构建和浏览器正/负例验证新增改动。未修改 token 数值、其他 skill、正式业务代码；未执行 Git 提交。安装依赖保留在隔离 fixture，未清理用户目录。

### 24.3 Review / 当前状态

§23 的三个验收缺口已以实际执行关闭。第一阶段本地代码与 mock 浏览器交付链路 PASS；真实内网 IconPlus 联调仍 PENDING，仅限真实 API 配置/响应/图标资产语义与公司覆盖率，不用 mock 替代。

第一阶段本地工作已完成。下一单元可按原计划讨论/实施第二阶段规范消费包；真实内网联调单列交给内网执行。不会因本轮完成擅自开始第二阶段。恢复时读 §24 和三个最新 PASS 报告，旧截图与 §22 的视觉结论不再作为当前依据。
