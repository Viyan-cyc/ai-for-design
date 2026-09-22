# SDD Spec: 设计系统双主题正式化集成（设计系统-统一规范.md）

> Phase: EXECUTE→REVIEW（已收口）| Status: [DONE 2026-09-22]
> 层级：Feature Spec。前置：`spec/specs/2026-09-21_19-17_design-language-new-integration.md`（§1.2D 集成 + dark.css 接线 + intake 回执）。
> 新版文件流转记录：任务下达时位于 `ep-coder/设计系统.md`，研究中被用户移动至 `D:/cyc/project/octo/gts/设计系统-统一规范.md`（814 行，内容同一份，以新路径为准）。

## 0. Open Questions（已裁决 2026-09-22）
- [x] Q1 集成策略 → **A 选择性集成进老版骨架**（真值全收编；老版契约段/边界/不要段/组件应用保留）
- [x] Q2 浅色变更 → **收**（subtle 5 键 + code 12 键 + 图表浅色变更全部采纳，接受页面观感变化）
- [x] Q3 集成形态 → **双表并统一表**（§1.2 与 §1.2D 合并为统一 `Token｜用途｜Light｜Dark` 表）

### 研究修正（裁决后复核）
- **F15 图表浅色并非全同（修正 F2 初判）**：初比对脚本把 accessible 表同名键覆盖 default 表产生假"全同"。精确比对（文件移位后重跑）：新版把 §1.2D 标"原图参考，不启用"的 Light 序列**正式启用**——`color-chart-2` Light #62B42E→#87C859、chart-4 #2CB8C9→#F69E39、chart-5 #F69E39→#2CB8C9、chart-6 #5CA2E9→#E049CE（= 老版 1.2D 的"原图参考"列）；新增 chart-7..11 浅色；accessible 浅色 chart-4/5/6 变更（#1C94A4→#C76207 等，即老版 1.5 无障碍值也按新图校准）。属 Q2"浅色变更收"范围。
- **F16 stash 恢复**：本任务开始时深色接线（gen-tokens dark 段 + dark.css + intake/llm-prompt/on-demand-toggle，19 文件）在 ep-coder git stash@{0}；用户已 pop 恢复，pop 后生成器 --check 有漂移，已重生成并通过（TOKENS: 337）。本任务在此基础上继续，基线=深色接线完成态。

## 1. Requirements (Context)
- **Goal**: 设计师在 `ep-coder/设计系统.md`（814 行）交付了统一双主题规范——即对 `dark-theme-intake.md` 回执的正式响应。裁决哪些集成进现行真值源 `design-language/样式Token/设计系统.md`（1050 行），并让 gen-tokens / default.css / dark.css 全链路跟上。
- **In-Scope**: 两版逐值对比结论；对 gen-tokens.mjs 解析与 DARK_BACKFILL 的影响；按裁决执行集成；生成 + 试点验证；intake 回执更新。
- **Out-of-Scope**: vendor/；组件规范文档（本次设计交付未涉及）；换肤体系结构（base/bridge 协议不动）。

## 1.1 Context Sources
- 新版：`ep-coder/设计系统.md`（814 行，统一四列 Token｜用途｜Light｜Dark）
- 现行真值源：`design-language/样式Token/设计系统.md`（1050 行，1.2 浅色四列 + 1.2D 深色五列双表）
- 消费契约：`gen-tokens.mjs`（解析锚点 1.2/1.2D/1.3/1.4/1.5/1.6/2.2/3.1 + DARK_BACKFILL 10 项 + frost/阴影/字体栈内嵌模板）、`dark-theme-intake.md`（回执）、`references/design-language.md`（速查 GEN 段）

## 2. Research Findings

### 性质判定
- **F1 新版 = intake 回执的正式响应**：统一 `Token｜用途｜Light｜Dark` 四列；上轮回执的全部缺口已补齐；零 typo（erroe/seconday 均无）；命名零倒退（shadow1/radius-size-infinite/gray-0White/font-family-other 均为 0 处，`shadow-2-left`/`font-family-numeric`/`gray-0` 等 DTCG 名全部正确）；无待确认标注。

### 全同部分（零风险）
- **F2 基础层完全一致**：色板 132 项全同；radius 7 项、border-width 4 项、font-size 11 项、spacing 13 项全同；图表 default 浅色现行值全同；`--ux-mix-base`（Light #FFFFFF / Dark #191919）与工程现状一致；§1.2D 已上线的 89 个 Dark 键中 83 个值全同。

### 新增真值（上次回执要求的缺口，全部补上）
- **F3 新增浅色键 46 个**：link 族 6（老版 1.2D 标"浅色不启用"，新版正式启用）、text-on/text-inverse-disabled、border-active、全功能色 hover/active/disabled/subtler 三态扩展、info-primary/secondary 双轨体系 12 键、none 交互三态、业务告警状态色 6 项浅色。
- **F4 回填退役素材齐备**：填充色 8 项、表格色 2 项、info 2 项的 Dark 值均与工程回填**值级一致**（hover rgba(255,255,255,6%)≡回填、fill-subtle #2A2A2A=bg-3 dark、fill-disabled #393939=bg-4 dark、info #2070F3 双主题同值、info-subtle #1F55B5=blue-60）——DARK_BACKFILL 10 项可全部退役。
- **F5 阴影深色列给出**：几何与老版 6.2 全同（含 shadow-2-left/right、shadow-4 四方向），Dark alpha 显式（0.24/0.32/0.4/0.48），浅色值不变。上次缺口"阴影深色"解决。
- **F6 图表深色 accessible 6 色**（#668CF7/#87C859/#8E81F4/#F69E39/#55CCD9/#EB74DF）：上次"深色 accessible 沿用浅色过渡"缺口解决。（注：初比对显示 chart-1..6 Dark"差异"系脚本把 accessible 表同名键覆盖 default 表所致，实为新增非变更。）
- **F7 两个历史待确认项正式裁决**：`color-bg-6` Light=#C9C9C9/20%、Dark=#F3F3F3/10%（老版"待确认"解除）；"重版提醒色"正名 `color-warning-strong`（#D19F00 双主题，老版 1.2D 命名异常段可归档）。
- **F8 info-seconday → secondary 迁移**：老版 1.2D 保留原图拼写的 5 键（color-info-seconday*），新版统一为 secondary——正是上轮回执建议的迁移动作，设计师已执行。

### 浅色值变更（实质观感变更，需裁决）
- **F9 functional subtle 5 键浅色变更**：`color-error-subtle` #FEE7E8(red-05)→#F59297(red-20)、`color-alert-subtle` #FEF5E8→#FCCE92、`color-warning-subtle` #FEFCE0→#FEF08A、`color-success-subtle` #E7FBF2→#8FE5C2、`color-info-subtle` #E6F2FD→#8CA3FA。语义从"极浅弱背景（05 档）"改为"中等色面（20/30 档）"，新版 §使用规则 5 明确"subtle/subtler 是同主题色面强弱"。EP bridge 消费 `--color-*-subtle`，现有页面浅色观感会变。
- **F10 code 色全套 12 键 Light+Dark 全部变更**：background #FAFAFA→#F3F3F3、comment #939393→#595959、keyword #C98208→#954304、link #2E86DE→#0067D1 等。StarCode 代码区配色整体校准到色板端点。
- **F11 frost 正式化（色相校准）**：blur/alpha/几何结构与老版回填基线一致，但色相从工程回填的偏蓝灰校准为纯中性/色板端点——dark surface rgba(24,28,36,α)→#191919/α、shadow 色 rgba(35,48,72,α)→rgba(0,0,0,α)、backdrop base #F4F6FA/#171C25→#F3F3F3/#191919、tint→#5CA2E9 等色板端点、surface-solid #F7F9FC/#202631→#FFFFFF/#2A2A2A。老版注记明言该基线"待设计师复核后转为正式标准"——本次即该复核动作。另新增 §7.4 Hover/Active alpha 序列表与 `--frost-backdrop-gradient` 显式变量。

### 结构差异（决定集成形态）
- **F12 新版删减的工程契约内容**（老版独有，需保留）：§0 契约段（0.2 命名与用途、0.3 项目接入与颜色核验）、§1.1 使用边界、§1.7 不要、§6.3 阴影组件应用、§6.4 80% 配置注记、§7.7 aurora-glass 迁移与 visualStyle 约定、§7.8 不要、快速索引表。新版新增对等内容（§8 状态对位与对比度核验、§9 选色规则）质量高，可吸收。
- **F13 新版删减 company-* 辅助色 15 项**：工程消费面仅 default.css 生成段（grep 无其他引用，bridge 不消费），删除影响极低。
- **F14 gen-tokens 解析影响**：现行 default.css 浅色从 §1.2 表（第 4 列）取值、dark 从 §1.2D（第 5 列）取值。若采用统一四列表，解析改为同表取 Light/Dark 两列（结构更简单）；若保持双表，§1.2 需扩 46 行浅色、§1.2D 需同步对应行。frost/阴影为内嵌模板段（文档升级后按流程更新模板或改解析）；1.5 图表/1.6 code 有解析段，改文档表即自动跟上。

## 3. Innovate (Options & Decision)
| 方案 | 内容 | 利 | 弊 |
|---|---|---|---|
| **A 选择性集成进老版骨架（推荐）** | 颜色/阴影/frost/code 真值全部收编（F3-F8、F9/F10 视 Q2、F11），老版契约/边界/不要段保留，新版 §8/§9 新规则吸收 | 双主题全量正式化 + 回填全退役 + 契约资产不丢 | 文档与生成器改动量中上 |
| B 新版全文替换 | `ep-coder/设计系统.md` 直接成为真值源 | 与设计师交付字面一致 | 丢契约段/不要段/组件应用/aurora 迁移（F12）；锚点全变，gen-tokens 大改；00索引 锚点冻结契约作废 |
| C 只收缺口 | 仅补填充/表格/阴影深色/accessible 等缺口键，其余不动 | 改动最小 | 放弃 subtle/code/frost 正式化与 46 键浅色启用，下一轮还得再做 |

- **Decision**: Q1=A、Q2=收、Q3=统一表（2026-09-22 用户裁决）。

## 4. Plan (Contract)

### 4.0 目标形态（统一表后的真值源结构）

`design-language/样式Token/设计系统.md` 变为：
- **§1.2 UI 语义色（统一双主题表）**：`Token｜用途｜Light｜Dark` 四列，一张表含全部语义键（老 1.2 的 51 键 + 老 1.2D 的深色键 + 新版新增 46 浅色键），分组小节保持（高亮/文本/图标/边框/背景/填充与表格/功能色组/告警状态色）。派生态全显式。老 1.2D 的五列/来源/异常记录段整体退役（内容已并入正式表或归档进回执）。
- **§1.5 图表配色**：default 11 色（Light 启用新序列）+ accessible 6 色，均带 Light/Dark 两列 → 解析适配。
- **§1.6 代码配色**：12 键新值（Light/Dark 全套校准）。
- **§7 毛玻璃**：数值按新版校准（中性色 + 色板端点），章节骨架/契约段（7.7/7.8/面积预算/实现约定）保留。
- **§6 阴影**：6.2 参数表加 Dark alpha 列（几何不变）；6.3/6.4 保留。
- 其余（§0 契约、§1.1 边界、§1.7 不要、§2-§5、快速索引）保留老版内容；吸收新版 §8 状态对位/对比度核验为 §8（追加，编号顺延不冲突——老版无 §8）。
- `color-info-seconday*` 5 键从老 1.2D 删除（新版统一 secondary，DARK_BACKFILL 的 info 双键随退役消失）。
- `color-bg-6` 待确认解除（Light=#C9C9C9/20%、Dark=#F3F3F3/10%）；`color-warning-strong` 转正。

### 4.1 File Changes
- **改** `design-language/样式Token/设计系统.md`：按 §4.0 重构（统一表 + 各节校准）。保留行：§0 全部、锚点 id 全部（`#ui-colors`/`#palette`/`#charts` 等冻结锚点不动，`#dark-colors` 锚点保留但重定义到统一表说明或保留空节指引）。
- **改** `ep-coder/skills/generate-ux-prototype/scripts/gen-tokens.mjs`：
  1. §1.2 解析改统一四列表（同表取 Light/Dark 两列），输出 default.css 用 Light 列、dark.css 用 Dark 列；废弃 parseDarkSection 的五列逻辑与 DARK_SECTION_ANCHOR；
  2. DARK_BACKFILL 10 项全删（真值已全覆盖）；DARK_REQUIRED 检查保留（现在校验统一表 Dark 列完整性）；
  3. chart 解析适配新版（default 11 色 + accessible 6 色，Light/Dark 双列；default.css 出 Light 全 11 色 + accessible Light，dark.css 出 Dark 全 11 色 + accessible Dark）；
  4. code 色沿用现有解析（表值变即产物变）；
  5. FROST 内嵌模板按新版校准值重写（含 dark surface 参数——模板现有"dark α 注释"改为真实 dark 产出：dark.css 的 frost 段不再复制浅色而是输出深色材质）；
  6. 阴影解析加 Dark alpha（浅色不变，dark.css 输出深色 alpha 阴影）；
  7. `--ux-mix-base` 已有逻辑不变。
- **生成** default.css / dark.css / references/design-language.md GEN 段（gen-tokens 产出）。
- **改** `references/dark-theme-intake.md`：状态更新——缺口全清（阴影深色/填充/表格/accessible 已正式化）、回填 10 项退役、倒退说明段保留但标注"新版已修正"。§C 验收记录追加。
- **改** `design-language/00索引.md`：深色条目更新为"全量正式化完成"；version 记录追加本次变更说明。
- **改** `ep-coder/skills/generate-ux-prototype/SKILL.md`：dark 相关表述更新（缺口清零）。
- **验证试点**：`.uxproto-pilot/pilot-dual/` init → build → CDP 冒烟（浅色 subtle 新值断言 + dark 全链路断言沿用 cdp-full.mjs 的 dark 段 + 图表 token 抽样）。

### 4.2 Signatures
- gen-tokens 统一表解析（伪码）：`parseUnifiedSemantic(doc)` — 锚点 `### 1.2` 到 `### 1.3`；每行四列 `[token, use, light, dark]`；`#RRGGBB / N%` 复用 colorValue；Dark 缺值行仅当 bridge 无消费时允许（现应无此情况）；输出 `{name, use, light, dark}`。
- dark.css 结构：语义色（Dark 列）+ 图表 Dark（default 11 + accessible 6）+ 阴影 Dark alpha + frost Dark 材质 + 非颜色组复制 + compact 覆盖（同现状）。
- default.css 结构：语义色（Light 列，含 46 新键）+ chart Light 11 色 + accessible Light（新值）+ code（新值 + -dark 变体按新 Dark 列）+ 其余组同现状。

### 4.3 Implementation Checklist
- [x] 1. 真值源重构：设计系统.md 统一表改造（§1.2 合并 + §1.5/1.6/6.2/7 更新 + §8 吸收 + 00索引/SKILL.md）。
- [x] 2. gen-tokens.mjs 改造：统一表解析 + DARK_BACKFILL 退役 + chart/code/阴影/frost 适配。
- [x] 3. 生成三产物并核对：--check 通过；抽样比对（subtle 新值、chart-2 Light #87C859、shadow dark alpha、frost dark surface、info-secondary 无 seconday 残留）。
- [x] 4. 试点验证：pilot-dual build OK + CDP 冒烟全 PASS（浅色新值 + dark 全链路）。
- [x] 5. 回执收口：dark-theme-intake.md 缺口清零 + 回填退役记录。
- [x] 6. Spec 回写 Execute Log + 偏差。

### 验收标准（Done Contract）
1. gen-tokens --check 通过；dark.css 无回填段（DARK_BACKFILL 全退役）；default.css/dark.css 无 seconday 键。
2. pilot-dual build RESULT: OK；CDP 冒烟全 PASS：浅色 error-subtle=#F59297 等新值生效、dark bg-1=#000000/EP 跟随/无白残留回归不破。
3. 图表：default.css 含 chart-1..11 Light 新序列；dark.css 含 Dark 序列 + accessible Dark 6 色。
4. 真值源零丢内容：§0 契约/§1.1/§1.7/§7.7/7.8 段 grep 在位；`color-bg-6`/`color-warning-strong` 正式值在表。
5. 回执文档状态与实际一致（缺口清零、回填退役）。

## 5. Execute Log（2026-09-22）

### 5.1 执行摘要
六步全部完成。真值源统一表改造 → gen-tokens 全面改造 → 三产物生成 → pilot-dual 试点验证 → intake/llm-prompt 回执收口 → 本回写。

### 5.2 验证证据（Done Contract 逐条）
1. **--check 通过；dark.css 无回填段；无 seconday 键** ✅ —— `gen-tokens.mjs --check` OK；DARK_BACKFILL 10 项代码删除，dark.css 无回填注释段；产物 grep `seconday` 0 处；TOKENS 337→388（semantic 97×2 + chart 17×2 + shadow 6×2 + frost 23×2 + 其余组）。
2. **pilot-dual build OK + CDP 冒烟全 PASS** ✅ —— ensure-env/init/build RESULT: OK；新建 `.uxproto-pilot/cdp-dual.mjs` 52 断言全 PASS（浅色 21：subtle 5 键新值/warning-strong/bg-6/link/chart 新序列/code/frost 校准/shadow 浅色不变；dark 31：bg/text/brand-disabled/回填正式值×4/mask/separator/error-subtle/info-secondary/chart Dark+accessible Dark/shadow alpha×3/frost 深色×4/mix-base/EP table 跟随/白残留/往返恢复×2）。
3. **图表 Light 11 色 + Dark 序列 + accessible Dark 6 色** ✅ —— default.css chart-1..11（新序列生效，chart-2 #87c859）+ accessible 6；dark.css chart-1..11 Dark + accessible Dark 6 色（#668cf7..#eb74df）。
4. **真值源零丢内容** ✅ —— 53 项验证全 PASS：契约段（§0/§1.1/§1.7/§7.7/7.8）grep 在位；锚点契约保持（`#ui-colors`/`#palette`/`#charts`/`#code-colors` 不动，`#dark-colors` 重定义）；bg-6/warning-strong 正式值在表；§1.2 语义键行数=97，键名与新版统一规范逐字一致（onlyOld=[] onlyNew=[]）。
5. **回执文档状态与实际一致** ✅ —— dark-theme-intake.md：头部存档声明、§B 12 组+附 2 项全 ✅ 终态、回填 10 项退役对照表（回填值≡设计师正式值）、§C 2026-09-22 终态验收记录；dark-theme-llm-prompt.md 头部存档声明（后续流程改走统一表成对维护）。

### 5.3 执行偏差（Plan 之外的实际动作）
- **`#dark-colors` 锚点**：Plan 预案"保留空节指引"，实际采用与 `#ui-colors` **同点双锚**（统一表头部两个 `<a>` 并列）——外部引用 `#dark-colors` 直接落到统一表，无死锚。
- **§1.2 功能色分组**：统一表内功能色拆为 ##### 六子组（错误/告警/提醒/成功/信息/失效），信息组承载 info-primary/secondary 双轨 12 键——Plan 只写了分组小节保持，分组粒度实现时定。
- **新增 cdp-dual.mjs**：Plan 只提"沿用 cdp-full.mjs 的 dark 段"，实际因浅色断言量大（subtle 5 键+chart 新序列+frost 校准）新建本任务专用脚本（结构复用 cdp-full.mjs）。
- **llm-prompt 存档化**：Plan 未列 dark-theme-llm-prompt.md；执行中随 intake 收口一并加存档声明（深色补齐流程闭环，后续改值走统一表+重跑生成器），符合"回执文档状态与实际一致"契约。
- **§1.2D 异常记录段**：随整段删除退役（含字段定义段），异常项均已解决（warning-strong 转正、bg-6 正式化、seconday 迁移）。
- **阴影产出格式**：`0 1px 3px 0 rgba(...)`——pxLen 对 "0" 不加 px 后缀，与既有浅色行为一致（断言初版多写 px 导致 2 FAIL，修正断言后 PASS；产物本就正确）。

### 5.4 剩余风险与悬置项
- **浅色观感变更**：subtle 5 键（05 档→20/30 档）、code 12 键、图表浅色序列已生效，属用户裁决 Q2 范围内；建议设计侧知悉已上线。
- **试点目录去留**（前序任务遗留，待用户裁决）：`.uxproto-pilot/` 下 pilot-dark 与 5 个旧试点目录（各 ~5M）。
- **frost 状态增量参数**（新版 §7.4 Hover/Active alpha 序列）：00索引 待办已登记关闭项，未做工程产出（现无消费方）。
- **图表选型规范**：00索引 既有待办保留（新版 §1.2 无图表选型规则交付）。

### 5.5 用户实测缺陷修复（DONE 后追加，2026-09-22）
- **缺陷**：用户切深色后报告表格状态列 ElTag 字色与背景融合不可读（"已停用" info tag）。
- **根因**：bridge.css 把 EP `light-9`/`light-3` 色阶槽位接到 `var(--color-*-subtle)`——subtle 旧语义是"极浅 05 档"时碰巧成立；本次统一表将 subtle 改为"中等色面 20/30 档"后失效：dark 下 success tag 背景=文字=#058358（完全隐形）、info tag #1f55b5≈#2070f3。此为 F9 subtle 语义变更的连锁影响，研究期未识别（bridge 映射层不在对比清单内）。
- **修复**：bridge.css 功能色 light-N 槽位全部回归 color-mix 对 `--ux-mix-base` 派生（文件头既定契约，EP 官方深色主题同款做法）；success/warning/danger/error/info 共 5 处 light-9 + 2 处 light-3。改 skill 母版 + pilot-dual 副本，重 build OK。
- **回归保障**：cdp-dual.mjs 新增 4 条断言——浅/深色全量 tag 字底亮度差 >0.2、dark tag 背景≠文字色；重跑 57/57 PASS。
- **教训**：token 语义变更的影响面必须查到**消费侧映射层**（bridge.css 的 EP 槽位接线），不能只看 token 表本身。

## 7. Change Log
- 2026-09-22：立项。Restate → 逐节研读新版全文 + 节点级数值比对（色板/radius/border/font/spacing/chart/code/subtle/Dark 89 键/待确认项/命名倒退 grep）→ 本 Spec。
- 2026-09-22：三裁决收到（A / 浅色变更收 / 双表并统一表）；F15 修正图表"假全同"（浅色序列正式启用是真变更）；F16 记录 stash pop 恢复与基线重建；Plan §4 细化完成。新版文件在研究中被移至 `D:/cyc/project/octo/gts/设计系统-统一规范.md`。
- 2026-09-22：Plan Approved → EXECUTE，六步全部完成（见 §5 Execute Log），Done Contract 5 条全过，REVIEW 收口，Status: DONE。
