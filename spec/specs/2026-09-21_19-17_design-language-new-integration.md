# SDD Spec: design-language-new 集成裁决（设计师新规范收编）

> Phase: DONE（Execute 完成，Done Contract 5/5 通过）| Status: [LOCKED]
> 说明：本任务首轮对比分析在协议外执行（用户质询"你刚刚没有用sdd-riper-one技能吗"后加载协议）；本 Spec 补建并回填研究结论，偏差记录于 §7。

## 0. Open Questions（已裁决 2026-09-21）
- [x] Q1 集成策略 → **A 选择性集成**（§1.2D + 组件规则深色条并入老版；命名倒退/frost 清空/契约删除/拼写退化不收）
- [x] Q2 接线范围 → **立即接线**（gen-tokens 扩展解析 §1.2D → 生成 dark 皮肤 → build+冒烟验收，即 intake §C-2~4）
- [x] Q3 设计侧回执 → **更新 dark-theme-intake.md**（§B 勾掉已补组 + 剩余缺口 + 倒退项与拼写说明，保持单一交付物）

## 1. Requirements (Context)
- **Goal**: 设计师交付新版规范 `design-language-new`（63 文件）。裁决哪些内容可集成进现行真值源 `design-language`，哪些是倒退/错误不应集成；裁决后执行集成并给出设计侧回执。
- **In-Scope**: 两版逐文件对比结论；对工程消费契约（gen-tokens.mjs / bridge.css / default.css / references）的影响评估；按 Q1 裁决执行集成；给设计师的缺口回执。
- **Out-of-Scope**: `vendor/`（硬约束 4）；skill 其余资产改动；gen-tokens.mjs 生成器逻辑重写（为解析 §1.2D 做扩展属于本任务，重写不是）。

## 1.1 Context Sources
- 新版：`design-language-new/`（63 文件；较老版新增 `设计规范/AI生成规则.md`、`设计规范/兼容与迁移.md`）
- 老版（现行真值源）：`design-language/`
- 工程消费契约：`scripts/gen-tokens.mjs`（解析锚点 + `radius-size-full` 硬校验）、`scripts/preview/src/assets/themes/bridge.css`（消费 `--shadow-1/3/6`、`--radius-size-full`）、`default.css`（生成产物）、`references/dark-theme-intake.md`（深色缺口清单）、`references/design-language.md`（§1 速查表 GEN 标记）
- 前序 Spec：`spec/specs/2026-09-20_16-09_ep-coder-uxproto-dev-friendly.md`（intake 交付与深色等表背景）

## 1.5 Codemap Used
- Mode: `feature`（inline）。地形已由逐文件 diff 覆盖（63 文件两两比对 + 差异量统计 + 消费契约 grep），重复建图无增益。

## 2. Research Findings

### 结构性事实
- **F1** 两版 63 文件同名同目录；新版仅新增 2 个设计规范文件（AI生成规则.md 50 行、兼容与迁移.md 42 行）。差异集中在 `设计系统.md`（816→1054 行）与 `00索引.md`；组件规范仅零星差异（按钮/表格零差异，卡片/侧边栏/对话框仅跟随 shadow 改名，组件规则.md 新增一条深色消费规则）。
- **F2 核心增量 = §1.2D 深色参数全表**（约 +280 行）：按 13 张参数图 95 行逐行复核；Light 保留现行浅色值（新图 Light 列仅参考不启用）、Dark 为新增真值。对照 intake §B：第 1 组品牌 5 态、第 2 组文本（5 级 + link 6 项 + on + inverse-disabled）、第 3 组图标 9 项、第 4 组边框 7 项、第 5 组背景 7 项（含 bg-6 Dark=`#F3F3F3/10%`）、第 7 组功能色全交互态（含 subtle/subtler 分级）、**图表深色 11 色序列**、**业务告警状态色 6 项**——全部齐备，派生态显式给值，带来源/异常记录（"重版提醒色"命名待确认单列）/未覆盖声明。质量符合真值源纪律；`#RRGGBB / N%` alpha 格式 gen-tokens 已支持。
- **F9 §1.2D 自声明缺口**（集成后仍缺，构成设计侧回执）：填充色 8 项（hover/select/fill*）、表格色 3 项、阴影深色、frost 深色材质参数、`--ux-mix-base` 深色表面色、基础色板深色变体裁决（第 10 组）、深色 accessible；`color-bg-6` 浅色仍待确认（新版 Light 给出参考 `#C9C9C9/20%`）。

### 倒退/错误事实（不应集成的部分）
- **F3 token 命名倒退 5 组**：`shadow-1..6`→`shadow1..6`、`shadow-2-left`→`shadow2-l`（方向单字母缩写）、`radius-size-full`→`radius-size-infinite`、`gray-0/gray-100`→`gray-0White/gray-100Black`、`font-family-numeric`→`font-family-other`。老版 00索引 头部记录 **2026-09-16 已按 W3C DTCG 规范完成这批对齐**——新版方向相反。破坏面核实：bridge.css 消费 `--shadow-1/3/6`、`--radius-size-full`；gen-tokens.mjs 硬编码校验 `radius-size-full`；default.css、20 份组件文档、references 速查表全部 kebab 名。
- **F4 frost §7 数值清空**：blur/surface/shadow/backdrop/tint/surface-solid 全部改为"具体数值待补齐"，磨砂装饰参数（渐变/几何/描边宽度）同样清空。设计师 2026-09-16 已答复"frost 用旧版值"，老版 G 1.5.1 已验证回填基线被新版丢弃。
- **F5 00索引 契约段删除**：设计师更新契约（四列格式/锚点冻结/DTCG 命名规则）+ 已知待确认项（口头答复记录 + 工程回填状态跟踪）整段消失。
- **F6 工程侧注记删除**：键盘与焦点.md 的 EP 2.13.5 消费注记（"EP 内建行为优先，禁叠加冗余 ARIA"）、视觉品质.md 的图标资产注记（图标一律取自工程图标库）。
- **F7 拼写退化**：1.2 浅色表 `color-error-subtle`→`color-erroe-subtle`（typo，下游正文跟随错误；新版 §1.2D 用的是正确拼写）。`color-info-seconday` 保留原图拼写（新版有意识保留并标注，集成时带注释）。
- **F8 两个新增文件是原 Skill 包使用说明**：`AI生成规则.md`/`兼容与迁移.md` 引用本摘录不存在的资产（`scripts/check_color_bindings.py`、`examples/i18n/`、`.gts/color-bindings.json`、`schema_version: 2`），且"radius 统一 infinite"与老版 DTCG 对齐方向相反；本工程已有 SKILL.md 消费纪律，引入即双头规则。

### 正向零散增量
- **F10** 组件规则.md 新增深色消费规则："深色先查第 1.2D 节，同名键取 Dark 值，未覆盖参数不得以浅色值兜底"；页面布局.md 旧 1920 基准改指向兼容文档（指向对象在新增文件内，若不集成该文件则此改动悬空）。

## 3. Innovate (Options & Decision)
| 方案 | 内容 | 利 | 弊 |
|---|---|---|---|
| **A 选择性集成（推荐）** | §1.2D 全节（含字段定义/异常记录/未覆盖声明，锚点 `#dark-colors`）+ 组件规则深色条并入老版；其余全部保持老版 | 拿到深色真值启动 dark 皮肤；保护已验证 frost 基线、DTCG 命名、工程契约与注记 | 需向设计师说明倒退项不被采纳及原因 |
| B 整目录替换 | 直接采纳新版为真值源 | 与设计师交付物字面一致 | 破坏 bridge.css/gen-tokens/default.css/20 份组件文档；丢 frost 基线与契约段；typo 入真值源 |
| C 暂不集成 | 先回设计师澄清倒退项与缺口 | 零风险 | 深色集成整体推迟，工程侧继续等表 |

- **Decision**: 待用户裁决（Q1）。

### 补充研究（Plan 前）
- **F11 无旧深色回填需退役**：老版 00索引 声称"54 个语义 token 深色值已工程回填"，但全项目检索无任何落点（无 dark.css、无 semantic-dark 块；default.css 仅 `--code-*-dark` 代码区变体）。该记录为计划性描述，实际未落地。§1.2D 将是第一个真实深色值源；00索引 只需更新状态文字，无需删除旧值。
- **F12 dark.css 必须全量定义**：`data-theme="dark"` 时 default.css 的 `html[data-theme="default"]` 块整体失效，dark.css 须提供 default.css 的**全部** token（颜色组换深色值 + 间距/圆角/边框宽/字体/字号字重原样保留），否则全页面 token 失效。
- **F13 bridge.css 无 fallback 消费点（深色必须给齐）**：`--color-hover`/`--color-fill`/`--color-fill-subtle`/`--color-fill-disabled`/`--color-info`/`--color-info-subtle`/`--color-warning-subtle`/`--color-success-subtle`/`--color-error-subtle`/`--color-table-*`（如存在）等在 bridge.css 以 `var(--x)` 无兜底消费。§1.2D 未覆盖的这些键在 dark.css 中以**工程回填**补齐（走 00索引 既有先例：显式标注 + 进设计师回执清单 + 设计师正式修订后退场），而非放任失效。
- **F14 `--ux-mix-base` 深色值**：取 §1.2D `color-bg-2` dark `#191919`（容器/卡片表面色）——bridge.css 注释指定"深色表面色"即此语义，有出处。
- **F15 gen-tokens 解析契约**：§1.2D 表格为五列（设计参数/描述/Light 现行/Light 参考/Dark 现行），现有解析器不识别；需新增 §1.2D 专用解析段输出 dark 皮肤。`#RRGGBB / N%` 格式现有 `colorValue()` 已支持。default.css 生成逻辑不动（浅色仍从 §1.2 取值）。

## 4. Plan (Contract)
### 4.1 File Changes
- **修改** `design-language/样式Token/设计系统.md`：从新版整段抽入 §1.2D（锚点 `<a id="dark-colors"></a>`，含字段定义、12 个分组表、重版提醒色异常记录、标注差异与未覆盖声明）。老版 §1.2 等其余内容**一字不动**（不加"浅色原版"后缀——那是新版配套改动）。
- **修改** `design-language/组件规范/组件规则.md`：并入新版新增的深色消费规则条目（"深色先查第 1.2D 节，同名键取 Dark 值，未覆盖参数不得以浅色值兜底"）。
- **修改** `design-language/00索引.md`：待确认项区"深色模式语义值缺失"条目更新为"设计师已正式补表（§1.2D，2026-09-21 集成），工程侧按表生成 dark 皮肤"。
- **生成** `ep-coder/skills/generate-ux-prototype/scripts/preview/src/assets/themes/dark.css`：由扩展后的 gen-tokens 生成（不手写）。作用域 `html[data-theme="dark"]`；§1.2D Dark 列真值 + F13 工程回填缺口（文件头注释标注回填项清单）+ F12 非颜色组原样复制 + `--ux-mix-base: #191919`。
- **修改** `ep-coder/skills/generate-ux-prototype/scripts/gen-tokens.mjs`：新增 §1.2D 解析段（识别五列表、取 Dark 列、透传 alpha 格式），组装输出 dark.css；**不动** default.css 生成逻辑；解析失败即停原则保持。
- **修改** `ep-coder/skills/generate-ux-prototype/scripts/preview/index.gts.html`：换肤插槽追加 `<link rel="stylesheet" href="./src/assets/themes/dark.css">`。
- **修改** `ep-coder/skills/generate-ux-prototype/references/dark-theme-intake.md`：§B 状态更新（第 1-5/7 组 + 图表/告警状态色已补齐；剩余缺口=填充色 8 项/表格色 3 项/阴影深色/frost 深色材质/ux-mix-base 裁决记录/色板深色变体裁决/深色 accessible）+ 新增"新版规范倒退项说明"段（命名 5 组/frost 清空/拼写 typo 不采纳及原因）+ 拼写修正建议（`color-erroe-subtle`→error、`color-info-seconday`→secondary）。
- **修改** `ep-coder/skills/generate-ux-prototype/SKILL.md` 与 `references/design-language.md`：主题相关段落从"深色等设计补表"更新为"dark 皮肤已内置（§1.2D 真值 + 工程回填缺口标注）"。
- **验证试点**：`.uxproto-pilot/pilot-dark/`（init 生成 → build → CDP 冒烟）。

### 4.2 Signatures
- gen-tokens.mjs 新增解析段（伪码约定）：
  - `parseDarkSection(doc) -> Array<{name, use, dark}>`：锚点 `<a id="dark-colors">` 后逐 `#### 分组` 表解析；列序 [设计参数, 描述, Light现行, Light参考, Dark现行]；Dark 列 `#RRGGBB` 或 `#RRGGBB / N%`（复用 colorValue 逻辑）；行 Dark 列为"未定义/不启用"字样时跳过并记录 skipped 清单。
  - DARK_BACKFILL：脚本内嵌回填表（键=token 名，值=工程回填值，来源注释），覆盖 bridge.css 无兜底消费点中 §1.2D 未提供的键。
  - 输出：`html[data-theme="dark"] { ... }`，文件头含"生成产物 + 回填项标注"双声明。
- dark.css 必须含（消费侧断言）：§1.2D 全部 Dark 值 token、`--ux-mix-base`、default.css 的全部非颜色 token（间距/圆角/边框宽/线型/字体/字号行高/字重）、frost 段（沿用 default 数值，注释标注"深色材质待设计师补齐"）。

### 4.3 Implementation Checklist
- [ ] 1. 集成设计文档：§1.2D 并入老版设计系统.md；组件规则.md 深色条；00索引 状态更新。
- [ ] 2. gen-tokens.mjs 扩展：§1.2D 解析 + DARK_BACKFILL + dark.css 组装输出。
- [ ] 3. 生成 dark.css 并核对：无 parse error；回填项在文件头列全；抽样比对 §1.2D Dark 值（brand/bg-2/bg-mask/border-separator alpha）。
- [ ] 4. index.gts.html 换肤插槽注册 dark.css。
- [ ] 5. 试点验证：`pilot-dark` 全新 init → build.mjs RESULT: OK → CDP 冒烟（切 dark 后：html data-theme=dark、页面背景=#000000、正文文字色=#FFFFFF、EP 组件无白底残留、无未定义 token 报错、localStorage 主题持久化、切回 default 无残留）。
- [ ] 6. 文档收口：dark-theme-intake.md（勾组+缺口+倒退说明+拼写建议）、SKILL.md、references/design-language.md。
- [ ] 7. Spec 回写 Execute Log + 偏差；pilot-dark 去留请示用户。

## 5. Execute Log（2026-09-21 完成）
- [x] 1. 集成设计文档：§1.2D（233 行）插入老版设计系统.md（锚点 `#dark-colors`，位于 §1.2 表格之后 §1.3 之前）；组件规则.md 深色消费规则条目并入；00索引 "深色模式语义值缺失"条目更新为已交付状态。diff 验证：与新版剩余差异全部为预判中的倒退项，老版其余内容零漂移。
- [x] 2. gen-tokens.mjs 扩展：`DARK_SECTION_ANCHOR` + `parseDarkSection()`（五列表 Dark 列提取）+ `DARK_BACKFILL`（10 项）+ dark.css 组装输出 + `DARK_REQUIRED` fail-fast + `--check` 含 dark.css 比对。default.css 生成逻辑未动。
- [x] 3. dark.css 生成并核对：94 个 §1.2D 真值 + 10 工程回填 = 104 dark token（全文件 210 token 含非颜色组）；抽样比对 brand=#0067D1、bg-2=#191919、bg-mask=rgba(0,0,0,0.7)、border-separator=rgba(243,243,243,0.15) 全一致；`--check` 双模式通过（TOKENS: 337，default.css 零漂移）；终局复跑 RESULT: OK。
- [x] 4. index.gts.html 换肤插槽注册 `<link ... dark.css>`（base/bridge/default 之后，插槽注释对内）。
- [x] 5. 试点验证 `.uxproto-pilot/pilot-dark/`：init OK → build RESULT: OK → CDP 冒烟 **20/20 PASS**（11 条 dark 全链路断言：switch applies、bg-1=#000000、text-primary=#ffffff、bg-mask、border-separator alpha、mix-base=#191919、EP table --el-bg-color=#393939 跟随、EP table bg 无白残留、fill-subtle=#2a2a2a 回填、brand-hover=#2e86de、往返 default 恢复）。
- [x] 6. 文档收口：dark-theme-intake.md §B 重写（逐组状态表 + 回填 10 项表 + 倒退 4 条不采纳说明 + §C-2/3/4 验收记录）；SKILL.md L139/L277；references/design-language.md L39。grep 验证三处均已生效。
- [x] 7. 本回写；pilot-dark 去留已列入收口汇报请示用户（硬约束 0 未擅动）。

### 执行偏差（与 Plan §4 的差异）
1. **§1.2D 解析三轮修复**（Plan 只约定解析段，未预见表格形态细节）：
   - Dark 列非纯 HEX，形如 `#0067D1`（`brand-50`）带色阶标注 → 正则改为提取行首 `#HEX`（可带 `/ N%`）忽略标注（依据文档自身"以明确 HEX 与 alpha 为准"）；
   - 节边界：锚点在 `### 1.2D` 标题**之前**，从锚点找 `### ` 会立即命中自身标题 → 改为"锚点后首个 `### ` 为节起点，其后再下一个 `### ` 为节尾"；
   - `color-info`/`color-info-subtle` 无同名 Dark 行（§1.2D 改用 color-info-primary 命名，文档明确"不自动建立别名"）→ 加入 DARK_BACKFILL（双主题同值 #2070f3 / 取 blue-60 #1f55b5），按既有"工程回填"先例而非静默别名。
2. **DARK_BACKFILL 扩至 10 项**：Plan 预估仅覆盖 F13 列举键，实际补充 color-table-header/zebra、color-fill-disabled-subtle 等，全部在 intake 回执表中逐项列明取值理由。
3. **dark.css 组装三处修正**：chart-1..6 语义色段排除防重复定义；补非颜色组全量复制段（F12：色板/公司色/代码/间距/圆角/边框/字体/字号/字重/阴影/frost/紧凑档）；`--ux-mix-base: #191919`（F14）。
4. **回执文档表述微调**：intake §B 采用逐组状态表（含 ✅/❌/⏸ 三态）而非纯文字清单，便于设计师逐行核对。

### Done Contract 核对
1. ✅ gen-tokens `--check` 与产出双通过，解析报错为零（fail-fast 机制本身即验证）。
2. ✅ pilot-dark build RESULT: OK（0 ERROR）。
3. ✅ CDP 冒烟 20/20 PASS（含 Done Contract 3 所列全部断言）。
4. ✅ 回执四要素齐备：已补组清单（§B 状态表）、剩余缺口（6/8/9/10/12 组 + 回填 10 项表）、倒退项不采纳说明（4 条）、拼写修正建议（erroe→error、seconday→secondary）。
5. ✅ 老版零改动：diff 验证仅 §1.2D 追加 + 组件规则 1 条 + 00索引 状态行。

### 验收标准（Done Contract）
1. gen-tokens 对集成后文档 `--check` 与产出双通过；解析报错为零。
2. pilot-dark build RESULT: OK（0 ERROR）。
3. CDP 冒烟全 PASS：dark 切换生效、深色值正确（bg-1=#000000、text=#FFFFFF）、EP 组件跟随、无白底残留、无未定义 token。
4. 回执文档包含：已补组清单、剩余缺口清单、倒退项不采纳说明、拼写修正建议。
5. 老版设计文档其余部分零改动（diff 验证：仅 §1.2D 追加 + 组件规则 1 行 + 00索引 状态行）。

## 7. Change Log
- 2026-09-21：首轮对比分析在协议外执行并直接产出裁决报告（只读研究，未改文件）；用户质询后加载 SDD-RIPER-ONE，本 Spec 补建、研究结论回填、裁决选项落盘。**教训：对比/裁决类任务同样先落 Spec 再产出结论，协议外完成的研究必须回填。**
