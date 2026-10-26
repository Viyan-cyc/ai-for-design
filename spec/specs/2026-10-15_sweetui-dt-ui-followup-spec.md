# SweetUI + dt-ui：首批审查与补充取证 Spec

日期：2026-10-15。版本：v1.0。类型：Feature Spec。阶段：Research，允许资料采集和隔离运行验证，不进入 skill 实现。

## 1. 当前任务与决策

最终目标：自然语言生成真实 Vue3 + SweetUI 页面，使用 SweetUI 原生 token/icon；图表按实际支持的 dt-ui/SweetUI 图表入口实现。当前最小任务：补齐首批关键证据，确认 dt-ui 身份及消费契约，形成下一份可实施方案。不修改组件库、现有 skill 或正式项目。

输入：项目内 `spec/specs/2026-10-15_sweetui-batch-A-intake.md`；本地采集规格 `sweetui-skill-discovery-spec.md` v1.2；用户补充“SweetUI 图表使用 dt-ui”。后者是供应方信息线索，包名、版本、架构尚未取证，不能直接当 npm 名称安装或猜 import。

本次判定：首批资料对静态研究有价值，但不是完整 A 验收。A2/A6 未运行、Table 核心 API 未提取、token/icon 仅摘要没有完整数据；可以决定整体方向，尚不足直接实施最终生成 skill。无需重采已确认的全部内容，只补下列项目。

固定边界：用户只能带回 Markdown/spec、JSON、文字；源码、工程、私有包、截图及构建产物留内网。内网采集者本地读取并运行，返回获准且脱敏的事实与验证记录。没有运行通道就写 GAP，不以静态推断冒充运行成功。

## 2. 首批审查：需要纠正的表述

1. **dependencies 不等于 bundled。** package.json 将 Vue 列为 dependency，只能证明依赖声明；是否 bundledDependencies、是否把 Vue runtime 内联进 ESM/UMD、是否解析出多实例要分别验证。不能据 dependencies 推断双实例已经发生，也不能直接设置 alias/dedupe 当通用修复。
2. **包含 ECharts 不等于页面应直接调用 ECharts。** 同样不能据供应方“dt-ui”口头名称认定它是独立 Vue 图表包。需要下面的依赖与公开入口链。
3. **按需 import 路径需实际解析。** 首批 exports 通配符 `./es/* → ./es/*.mjs` 与示例 `/es/components/button` 是否真的指向有效文件尚未证明；检查 `/index.mjs`、根导出等真实解析结果。不让另一 LLM照抄猜测路径。
4. **标签注册与 CSS namespace 分开。** useNamespace 得到 CSS class，不能单凭它证明组件的注册标签；查 installer、component.name 和运行。ConfigProvider 默认 el 对内部类名、变量和浮层的影响仍开放。
5. **无 types 不阻塞 JavaScript 首版。** 不把生成整套 .d.ts 作为首期任务，更不能自动向私有包补类型。提取带版本的机器可读 API 契约即可。
6. “10 组件全量取证”与 Table/Select/slot 的明确缺口不一致。将每个字段标为 source-confirmed、documented、inferred 或 runtime-verified；“源码推断(EP模式)”不能作为 SweetUI 插槽契约。
7. CSS token 计数不能直接相加为可用总量；需按 common+目标主题层叠解析及去重。不同主题族不同时装成一套“混合真值”。中文 selector 先当实际选择器记录，不直接判发布 bug。

## 3. A 批最小补充（必须）

### A7. 返回可机器消费的 token/icon/组件事实

- `tokens.json`：至少覆盖拟采用的一个主题族 light/dark（若 dark 无法确认可先只标验证过的 light）；逐项原生名称、原始值/别名、主题作用域、来源文件/定位、包版本、文件 hash。公共 token 单列，保留层叠顺序和同名覆盖，不返回只有数量的摘要。
- `icons.json`：完整获准类名目录（可单独文件，不必放主报告），图标机制、字体/CSS 入口及资源相对引用；常用 semanticKey→精确 class+variant 映射。原生 seting 拼写不修正。部分 filled 硬编码颜色列差异，不自行改包；默认线框与颜色策略待运行/规范证据决定。
- `components.json`：补首版确实使用的核心字段：Table/Column 的数据、选择、排序、loading、slot scope、事件；Select 的 model/options/清除/多选/事件；Form 校验公开方法及返回；Dialog model/slot/挂载；Message 真实入口；ConfigProvider namespace/locale。每个拟用字段附直接证据，未知字段不填 EP 同名值。
- `environment.json`：SweetUI 精确 5.7.0、源码 commit/包 hash（有条件）、项目 lock 的解析版本、Vue 的依赖声明与实际路径关系、构建工具版本、CSS/import 解析结果。

这一步是整理事实 JSON，不写生成器代码，不伪造官方 JSON 格式。无法获得完整目录就标明覆盖范围和截断，不能把部分列表标 full。

### A8. 最小本地运行验证

有已安装包就先检查已有项目/源码 examples 的工具链与 lock 能否离线运行；**缺 registry 访问不必然等于无法构建**。不直接运行 npm create vite@latest、不自动升级；优先固定既有 Node/Vue/构建版本。在隔离目录验证，不改正式工程或 node_modules。缺依赖且离线缓存无包时记录具体缺包、失败命令和错误。

集成页仍为搜索表格+分页+表单弹窗+Message+原生图标，使用合成数据。验证真实 build、浏览器、主题/字体/浮层、关键交互。只带回 validation.md：环境、步骤、预期、实际、exit code、console/network 错误、对应本地证据位置。

主题首批先对实际 light/dark 验证；uDesign2.2 的配对名称与 C1/C2 正式优先级另行核实。若正式产品要求 uDesign，则把该主题作为目标，不用“token 最多”选主题。未确认前可 provisional native-light 用于技术跑通，但不声称最终设计验收。

## 4. dt-ui 必采契约（D 批）

### D1. 库身份与真实关系

沿 SweetUI 图表相关源码 import、package metadata、examples 和已安装 node_modules/lock 追踪：

- dt-ui 的正式产品名、精确 npm name（含 scope）、版本、源码/文档入口、是否独立包/源码子模块/业务封装/外部 UMD。
- SweetUI 5.7.0 是否真的依赖/导出/封装 dt-ui，还是推荐业务单独引入；实际图表渲染引擎及版本（ECharts 可能存在，但不得预定）。
- 关系链：页面 → 官方支持入口 → SweetUI/dt-ui wrapper → engine；每条边附 import/exports/lock/源码证据。
- dependencies、peerDependencies、bundledDependencies、运行时内联分别记录。确认 Vue、engine 是否共享，不能只列包名。

若多个同名 dt-ui，不搜到名字就认定同库；以 SweetUI 开发者实际引用/包关系为准。不需要公网搜索。

### D2. 页面应该怎样消费

查官方支持的最小入口、注册方式、组件名/导出、CSS、主题/语言配置、额外资源和初始化依赖。明确：

- 页面只调用 SweetUI 图表 wrapper 是否足够？如足够，先把 wrapper 作为首版契约，不暴露底层 dt-ui 全 API。
- 若直接调用 dt-ui 才是受支持路径，给真实入口及与 SweetUI 共存配置。
- 实际可用组件集与图表类型；不要使用先前文档 sweet-line-chart 等示例名替代证据。
- 是否依赖全局 window、动态 import、worker、WASM、字体、地图文件或联网接口；哪些运行资产可在内网本地提供。

### D3. 高频图表 API 与数据契约

先覆盖折线、柱状、环形/饼图三种；没有某类型时如实标不支持，不造 wrapper。每类型记录：

1. 真实 component/export 和 props 类型/默认、数据维度/系列/单位/空值契约；若用 option schema，则标明谁的 schema、支持哪部分，不把原生 ECharts option 自动算 dt-ui 支持。
2. 更新方式（响应式 prop/方法）、深浅更新、数据替换、销毁；组件 ref 的公开方法。
3. 点击事件 payload、legend/tooltip/缩放等实际支持能力；哪些被 wrapper 改写。
4. 容器高度/宽度与 resize API；隐藏 tab/dialog 再显示如何重算；监听如何清理。
5. loading/empty/error、legend、轴、tooltip、label、grid、series 色的配置边界；无内置状态时明确需要业务容器而非伪称库已支持。
6. 官方类型、源码定义或版本对应文档 sourceRefs，区分推断和验证。

每类型给一份获准的最小 JSON 输入数据和实际配置 JSON（仅限真实支持格式）。若配置必须有 formatter 等函数，提供签名/触发规则和文字说明，不能把字符串伪装成可执行函数。禁止要求外传组件实现或工程。

### D4. 图表与 SweetUI token/主题

确认 dt-ui 是否原生读取 --swt token；若采用独立主题，记录它的正式变量与 palette，是否已有官方适配。提取至少 series、axis/text/grid、legend、tooltip 背景/边框/文本、空态颜色等已知映射；无证据标 gap。

Canvas 图表若接收 CSS var 字符串，必须实际验证渲染引擎能否解析；否则需宿主 computed style 转实际颜色。这是待验证能力，不在本轮擅自实现。换主题是否自动重绘、需要 setOption/重建/官方 setTheme，按实际运行记录。浅深 palette 顺序与类别跨更新颜色稳定性一并核对。

不能把 --swt-color-chart-A* 在某主题文件存在等同 dt-ui 已使用；不能仅对画布外容器换背景就声称图表换肤完成。原生 dt-ui toolbar 图标如与 SweetUI 不同，说明来源和主题能力。

### D5. 内网验证最小图表闭环

在 A8 隔离页或其追加页验证三种已支持图表，合成固定数据即可：

| 场景 | 必须记录 |
|---|---|
| 初次渲染 | 图形、字体、legend/tooltip 正常，无必需资源失败 |
| 数据更新 | 筛选/替换数据后刷新，无重复实例/错误累计 |
| 容器 resize | 改视口或父容器宽度后正确布局 |
| 隐藏再显示 | tab/dialog 显示后无零尺寸或裁切 |
| 换主题 | series/文字/轴/tooltip 随目标主题正确变化 |
| 空数据/失败 | 可理解的状态与恢复，不静默空画布 |
| 卸载/重挂 | 监听/实例正确释放，无重复回调或残留实例 |
| 生产构建 | 固定依赖 build 成功，打开产物仍运行 |

首批不做大数据压力测试、地图、3D 或全量图表。离线/file:// 只记录可行性，先不承诺双击预览；标准工程验证通过后再选预览方案。原生不支持的业务状态在报告标记最小补充范围。

## 5. 返回文件与证据规则

建议返回：

```text
sweetui-followup.md          # 总结、版本、A补充/D完成度、阻塞
environment.json
tokens.json
icons.json
components.json
charts.json                 # dt-ui身份、消费入口、类型/API、数据契约
chart-theme-bindings.json   # 有证据的图表主题映射及缺口
validation.md
conflicts.md
```

允许一份 spec 内按上述区块组织，但完整目录较大时用独立 JSON；不能只报“已取证/约多少项”。保留 sourceRef、版本、hash、sourceKind、验证状态。API 事实要足够让未见源码的人正确调用，不需要外传整个实现。

仅本地源码和包能证实的标 source-confirmed/package-observed；实际运行的才 runtime-verified。两个版本号相同不等于构建内容相同，无 hash 时诚实注明。获准脱敏后由用户自行带回，不自动发送/上传。

## 6. 初步方案与决策门禁

目前建议：独立 SweetUI 原生消费包，按需组件契约+token/icon 目录+可信模式；图表为同一 skill 的可选能力模块，由实际 wrapper 或 dt-ui 公共入口适配，不另造一套颜色规范。

gts-ep-coder 复用工程组织、服务层、来源/hash、诊断和门禁经验；不复制它的 EP 组件规则、IconPlus fallback、GTS 无前缀 token 桥接。现有 sweetui-vue-creator 先作为候选骨架，正式代码实施前核对其接线版本与原生目标，不能因为已有就直接沿用。

图表代码路径按证据选：

- SweetUI 有维护中的公开 wrapper 且覆盖需求：页面使用 wrapper，底层 dt-ui 不暴露为模型接口。
- 只有直接 dt-ui 是官方支持方式：采用直接入口和薄主题/数据适配，保留库能力。
- 尚不能确定：首版基础页面可继续设计，但图表能力状态为未就绪，不让模型生成假 API。

不需要等收齐 148 组件才设计首版；需要的最低门禁是核心页面 API、原生主题/图标数据和可复现基础运行。图表要求至少身份/入口/一个真实图表运行闭环，再扩到三类。尚有 gaps 可以形成分阶段实施 spec，但未证实接口不能进入可承诺能力列表。

## 7. 验证、回写和恢复

本轮审查基于带回的首批文字 spec，没有原始内网包/源码，无法独立验证其值和 API。未改任何 skill；仅形成补充规格与首批审查记录。本文不是批准覆盖 SweetUI 或正式工程的指令。

维护者确认设计冲突不作为全量采集的前置等待：可以先完成静态事实和技术验证，把正式视觉基线决策单列。禁止默认将所有主题中数值较全的一套认定为正式规范。

下一轮：用户带回补充文字/JSON → 本对话审查证据 → 输出 SweetUI+图表的实施 spec 与阶段一任务。恢复时读本文件 §1、§3–5、补充报告 README，无需重新加载全部原始设计长文。

## 8. 交接短句

给内网 LLM：请阅读本 spec，只补首批关键缺口和 dt-ui 图表取证，在内网验证后返回文字/JSON。不要改 skill，无法验证的明确标 GAP，完成后停止。

带回后给本对话：SweetUI/dt-ui 补充资料在〔路径〕。请按补充 spec 审核证据，输出方案与分阶段实施 spec，先不改代码。

### 用户补充：dt-ui 本地取证来源

内网也具备 dt-ui 源码与 npm install 后 node_modules 中的已安装包。用户在采集指令提供两处实际路径；采集者从 package.json、项目 lock、实际 exports/类型、源码文档与 SweetUI 引用链直接取证，无需先找网站或重新下载。核对 dt-ui 源码 commit/版本与已安装包精确版本，不因同名目录推断它就是目标库，也不将源码未发布能力混入 npm 包契约。工程和源码留在内网，仅返回获准的文字/JSON 和内网验证结果。本补充适用于 D1–D5。

## 9. 最新范围决策：首版暂不包含图表（2026-10-15）

用户决定 dt-ui 是否采用尚不确定，首版暂不处理图表，后续可独立补充。本节优先于本文前面的图表采集要求与交接短句。

- 当前仅完成 §3 的 A7/A8：SweetUI 基础组件 API、原生 token/icon、主题/namespace、依赖入口与基础页面运行证据。
- §4 的 dt-ui D1–D5 全部 Deferred，不是本轮待办或进入方案/实施的门禁；不再要求其源码、npm 包、配置或运行报告。
- 首版生成能力覆盖搜索表格、表单弹窗、分页、基础详情与必要反馈；不承诺任何图表 API。遇图表需求须说明首版暂未支持，不能私自选 dt-ui/ECharts 或用静态形状冒充可运行图表。
- 后续确认图表库后，以独立消费契约和适配模块扩展即可；当前只保持基础结构可扩展，不实现空接口或提前引入图表依赖。SweetUI 自身已有间接依赖保留，不为“暂不含图表”擅自删改私有包。
- 补充资料回来后，输出 SweetUI 基础页面的方案与分阶段实施 spec，无需等待 dt-ui。

给内网 LLM：请按本 spec §9 的最新范围，只补 §3 A7/A8 的 SweetUI 基础页面资料与运行证据，暂不调查 dt-ui 或图表。不改 skill，只返回文字/JSON，缺口明确记录，完成后停止。

带回后给本对话：SweetUI 基础页面补充资料在〔路径〕。请按最新范围审核，输出方案和分阶段实施 spec，暂不含图表，不改代码。
