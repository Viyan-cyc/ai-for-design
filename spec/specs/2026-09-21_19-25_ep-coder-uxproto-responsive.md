# Spec: generate-ux-prototype 页面自适应能力（全链路落地）

## 0. 元信息

- **日期**: 2026-09-21（Plan 于 2026-09-22 补齐；Execute + Review 于 2026-09-22 完成）
- **层级**: Feature Spec
- **状态**: DONE（Execute C1–C13 全部完成，Review 三轴通过；待用户人眼验收最终确认）
- **Phase**: REVIEW（完成）
- **Approval Status**: Plan Approved（2026-09-22 用户字面批准）

## 0.1 前置事项（2026-09-22）

- **工作区暂存**：ep-coder 仓库 19 项未提交改动（深色 WIP：dark.css 草稿、dark-theme-intake、
  gen-tokens 深色支持、SKILL.md/build.mjs/init.mjs/design-language.md 部分改动）已
  `git stash push -u` 为 `stash@{0}`（消息含 "before responsive task 2026-09-22"）。
  深色任务等设计师补表后恢复（`git stash pop`）。
- **冲突预警**：stash 内容与本任务将改同 4 文件（SKILL.md / references/design-language.md /
  scripts/build.mjs / scripts/init.mjs）。pop 时如冲突，以 stash 恢复深色改动后
  手工合并本任务新增段（本任务改动在 Spec 有完整记录，可重建）。
- 本任务改动基于 stash 后的干净工作区（main @ 0112568）。

## 1. 最终目标

让 `ep-coder/skills/generate-ux-prototype` 生成的页面具备良好的自适应能力：
桌面区间弹性（约 1024–1920+，重点检查值 1280/1680/1920，1024 窄桌面），策略为**布局折叠式**
（内容重排、不缩放），落地范围为**全链路**（消费视图规范 → 编码规则 → vendor 示例 →
SKILL.md → build 门禁）。

**用户决策记录**（2026-09-21 AskUserQuestion）：
1. 适配区间 = **桌面区间弹性**（1280–1920 流式伸缩；1024 窄桌面为真值源声明过的检查值）
2. 适配策略 = **布局折叠式**（非等比缩放）
3. 落地范围 = 全链路；**用户质询**："design-language 目录并没有放在 skill 包里"——
   已查明结构关系，见 §2.1，结论：全链路落地点全部在 skill 包内，真值源零改动。

## 2. Research Findings

### 2.1 skill 与 design-language 的结构关系（回答用户质询）

- skill 内 `references/design-language.md` 头部自声明：**真值源是 skill 外的
  `design-language/样式Token/设计系统.md`（token 表）与 `design-language/设计规范/组件库适配.md`**；
  skill 内这份是"面向生成 agent 的消费视图"。分工是设计使然，不是缺失。
- **响应式真相在外部真值源已存在**，此前未被 skill 消费：
  - `design-language/设计规范/响应式与无障碍.md`：
    - 断点口径：1280/1680/1920 重点检查值；1024 窄桌面；缩放按 CSS 视口；
    - 页面适配规则：窄屏保留标题/核心数据/主操作/筛选入口；表格保关键列或横向滚动；
      图表可纵向排列；多列表单空间不足改单列；侧栏可折叠；工具栏收纳低频操作；
    - 密度不随视口缩放；**禁止 viewport width 缩放字体**；
    - 320 CSS px 重排检查（1280 窗口 400% 缩放）不等于承诺移动端体验。
  - `design-language/设计规范/页面布局.md`：
    - 窗口适配五档表（<1024 / 1024–1279 / 1280–1679 / 1680–1920 / >1920）；
    - 24 列流式栅格公式（A = W − S − 2×Offset；Column = (A − 23×Gutter)/24）；
    - Portal 12 列固定栅格 1280 上限，不足时收缩重排；
    - 侧栏：1024–1920 建议保持所选宽度（240 展开/48 收起）；
    - "不要把1440参考画布当作浏览器最小宽度"；"密度是显式配置，断点不自动切换字号或密度"。
- **结论**：skill 侧消费层从真值源浓缩响应式规范即可（与 token 速查同模式），
  真值源文件零改动。两份 design-language（`design-language/` 与 `design-language-new/`）
  有分叉（新版多深色章节），本任务按 skill 现行对齐的 `design-language/` 为真值源；
  两份的响应式/布局章节内容一致，不影响落地。

### 2.2 skill 链路响应式现状（全空白）

| 层 | 文件 | 现状 |
|---|---|---|
| 消费视图 | `references/design-language.md` | §3.3 仅 2 行：1440 画布 + 24 列栅格 + "断点不自动切密度"；无断点表、无适配规则 |
| 编码规则 | `vendor/vue-skill/references/code-rules.md` | 398 行，零响应式规则（无 @media、无 ElRow/ElCol、无断点、无宽度纪律） |
| 参考资产 | `vendor/code-example/references/` 3 个整页示例 | 零 `@media`；search-form 写死 200/160/260px |
| 参考资产 | `vendor/vue-skill/templates/` 5 个模板 | SearchInfoWithRightCard 写死 300px；无响应式写法示范 |
| 主控 | `SKILL.md` | 无自适应要求；硬约束 3 无宽度纪律 |
| 门禁 | `scripts/build.mjs` | 只有 hex WARN 检查（L353），无自适应相关检查 |
| starter | `scripts/init.mjs` 内嵌 starter 页 | search-input 写死 240px（flex 布局本身可接受，但无窄屏处理示范） |

### 2.3 EP 2.13.5 能力核查（已验证）

- **EP CSS 内置断点**（element-plus.index.css 实测 @media）：
  `<768 / ≥768 / ≥992 / ≥1200 / ≥1920`，对应 ElRow/ElCol 响应式 props `xs/sm/md/lg/xl`
  （JS bundle 中确认 xs/sm/md/lg/xl 处理逻辑存在）。
- 白名单已含布局组件：`el-row` / `el-col` / `el-container` / `el-header` / `el-aside`（全部可用）。
- EP 断点（768/992/1200/1920）与真值源检查值（1024/1280/1680/1920）**不同源**：
  EP 断点是组件折叠用，真值源检查值是验收检查用，两者需在规范中明确分工，不能混写。

### 2.4 约束与既有惯例（防冲突）

- build 门禁 import 扫描器连注释一起扫 → 新增示例代码注释里不能出现 import 语法形态文本（既有知识 D-30）。
- UMD 已知坑清单在 SKILL.md 硬约束 3；响应式规则若用 watch/matchMedia 需过一遍 UMD 兼容性。
- 产出卫生规则（memory: skill-output-style）：删干净作废方案；注释不写文档指引。
- code-rules.md 文档优先级声明：GTS 组件规范 > components_index.md > code-rules.md > error-checklist.md。
- 真值源已声明"项目记录实际折叠点"——即断点/折叠点允许页面按内容定，规范给默认值与判据，不搞一刀切。
- 密度不随视口变化是真值源红线（`data-density` 是显式配置）。

### 2.5 方案骨架（供 Plan 细化）

真值源已有"WHAT"（五档表、适配规则），skill 侧缺"HOW"（生成 agent 拿到手该怎么写代码）。
方案 = 在 skill 消费层补四层 HOW，一层门禁：

1. `references/design-language.md` §3.3 扩为"布局与自适应"：断点分工表
   （EP 断点用于折叠 / 真值源检查值用于验收）、五档窗口适配摘要、适配规则清单（表格/表单/图表/侧栏/工具栏）。
2. `vendor/vue-skill/references/code-rules.md` 新增响应式规则节（编号续现有规则体系）：
   - 页面容器流式（width:100% / max-width 口径）；
   - 卡片/统计区用 ElRow+ElCol 响应式 props（:xs/:sm/:md/:lg/:xl）或 flex-wrap+min-width；
   - @media 允许用于页面局部折叠（作用域遵守 scoped）；
   - 宽度纪律：内容宽度尽量流式；写死 px 仅限控件固有尺寸（输入框、按钮、图标等），并给 min-width 底线；
   - 表格列：关键列 min-width，次要列可 hidden/详情化；横向滚动用 ElTable 自带能力，禁止整页横向滚动；
   - 禁止 viewport 缩放字体、禁止 JS matchMedia 反推布局（优先 CSS）。
3. vendor 整页示例补响应式写法（选 1–2 个：table-search-drawer 的 search-form 去 200/160/260 写死、
   glow-cards 或 mixed-chart 的卡片栅格化），templates 同步。
4. SKILL.md：工作流 ③ 补一句自适应要求 + 硬约束 3 补宽度/断点纪律（保持简短，细则指向 code-rules）。
5. build.mjs（待 Plan 定夺）：可选 WARN 级检查——`<style>` 中出现 `zoom`/`vw` 字体缩放/`html` 级选择器已有；
   是否加"固定宽度无 min-width 兜底"等静态检查需权衡误报，Plan 阶段定。

## 3. Open Questions

- Q1（Plan 定）：build.mjs 是否加响应式静态检查（WARN 级），还是纯规范约束？倾向：加最少量（zoom/字体 vw 缩放 WARN）。
- Q2（Plan 定）：vendor 示例改造选哪几个文件（建议 table-search-drawer 全套 + glow-cards 栅格化）。
- Q3（Plan 定）：starter 页是否顺手示范响应式写法（search-input 240px 保留但加 flex-wrap）。

## 4. Context Sources

- `design-language/设计规范/响应式与无障碍.md`（真值源：断点、适配规则、缩放红线）
- `design-language/设计规范/页面布局.md`（真值源：五档表、栅格公式、侧栏）
- `ep-coder/skills/generate-ux-prototype/references/design-language.md`（消费视图）
- `ep-coder/skills/generate-ux-prototype/vendor/vue-skill/references/code-rules.md`
- `ep-coder/skills/generate-ux-prototype/vendor/code-example/references/*`（3 整页示例）
- `ep-coder/skills/generate-ux-prototype/vendor/vue-skill/templates/*`（5 模板）
- `ep-coder/skills/generate-ux-prototype/SKILL.md`
- `ep-coder/skills/generate-ux-prototype/scripts/build.mjs`（L340–370 样式检查段）
- `ep-coder/skills/generate-ux-prototype/scripts/init.mjs`（starter 内嵌模板）
- EP 2.13.5 UMD 实测断点（element-plus.index.css @media）
- memory: [[ep-coder-generate-ux-prototype]]（D-1~D-30 决策链）、[[skill-output-style]]

## 5. In Scope / Out of Scope

**In Scope**:
- skill 内 4 个文档层文件（references/design-language.md、code-rules.md、vendor 示例/templates、SKILL.md）
- build.mjs WARN 级检查（如 Q1 决定加）
- starter 页响应式示范（如 Q3 决定加）

**Out of Scope**:
- design-language 真值源包（design-language/ 与 design-language-new/）零改动
- 移动端（<768）完整适配；平板专项适配
- 深色主题（已有独立 intake 流程）
- EP 断点值修改或自定义断点体系
- gen-tokens.mjs（无新 token 引入）

## 6. Validation（Done Contract）

1. 改造后新建 pilot 工程跑 ensure-env + init + build 全绿；
2. pilot 页面在浏览器 1280/1440/1920 视口下无横向滚动条、无内容裁切（截图或 CDP 冒烟）；
3. 1024 视口下核心内容可用（表格可横向滚动、布局不散架）；
4. vendor 改造示例与 starter 零 build 告警新增；
5. 用户人眼验收（还原循环协议：build/smoke 只证结构）。

## 7. Plan（The Contract）

### 7.0 决策（Q1–Q3 收口）

- **Q1 build 门禁**：加 **WARN 级最小集**（不 FAIL）：
  - `<style>` 中出现 `zoom:` 或 `font-size` 使用 `vw` 单位 → WARN（真值源红线"不用视口缩放字体"）；
  - 不做"固定宽度必须 min-width 兜底"类检查——静态判断误报率高，交给规范约束。
- **Q2 vendor 改造范围**：
  - `table-search-drawer` 全套（index.vue + search-form.vue + data-table.vue）——表格+搜索典型页，去写死宽度示范流式；
  - `glow-cards/index.vue` ——`repeat(2, 1fr)` 改 `repeat(auto-fit, minmax(...))` 示范卡片流式（光效配方不动，只动栅格行）；
  - `mixed-chart` 不动（单卡居中布局天然自适应，改造无教学价值）；
  - `templates/SearchInfoWithRightCard.vue` 的 300px 写死同步治理；其余 4 个模板无写死宽度，不动。
- **Q3 starter 页**：改。search-bar 加 `flex-wrap: wrap`；search-input 240px 保留（控件固有尺寸，合规）
  但示范 `max-width: 100%` 兜底；页脚补一行响应式注释（不写文档指引，只写行为约束）。

### 7.1 File Changes（8 个文件 + 1 个新建脚本副本）

| # | 文件 | 动作 |
|---|---|---|
| F1 | `references/design-language.md` | §3.3 扩写为"布局与自适应"小节 |
| F2 | `vendor/vue-skill/references/code-rules.md` | 新增"十二、响应式布局规范"（规则 12.1–12.6） |
| F3 | `vendor/code-example/references/table-search-drawer/components/search-form.vue` | 去写死宽度，改流式示范 |
| F4 | `vendor/code-example/references/table-search-drawer/components/data-table.vue` | 核查列宽定义，示范 min-width + 次要列处理 |
| F5 | `vendor/code-example/references/table-search-drawer/index.vue` | 页面容器核查（预期已是流式，改动可能为 0，以实际核查为准） |
| F6 | `vendor/code-example/references/glow-cards/index.vue` | demo-grid 改 auto-fit 流式 |
| F7 | `vendor/vue-skill/templates/SearchInfoWithRightCard.vue` | 300px 写死治理 |
| F8 | `SKILL.md` | 工作流 ③ 补自适应要求句 + 硬约束 3 补宽度/断点纪律 |
| F9 | `scripts/build.mjs` | WARN 级检查：zoom / font-size vw |
| F10 | `scripts/init.mjs` | starter 页 search-bar flex-wrap + search-input max-width 兜底 |
| F11 | `.uxproto-pilot/cdp-responsive.mjs`（新建） | 多视口冒烟脚本（基于 cdp-shot.mjs 结构 + Emulation.setDeviceMetricsOverride） |

### 7.2 Signatures（内容级签名）

**F1 `references/design-language.md` §3.3** —— 替换现有 3 行为：

- 保留：1440 参考画布、4px 单位、24 列流式栅格（gutter/offset token 值）、侧栏宽度、Portal 1280 上限；
- 新增「断点分工」：EP 组件断点（xs<768 / sm≥768 / md≥992 / lg≥1200 / xl≥1920，用于 ElRow/ElCol
  响应式 props 与 @media 折叠）× 真值源检查值（1024/1280/1680/1920，用于人工验收检查）——两套数值
  服务不同目的，页面代码只用 EP 断点；
- 新增「窗口适配五档」摘要表（<1024 核心任务可用/1024–1279 侧栏与工具栏检查/1280–1679 参考布局/
  1680–1920 列跨度与阅读距离/>1920 流式增长不放大字号）；
- 新增「适配红线」：密度不随视口切换；禁止 viewport 单位缩放字体；禁止整页横向滚动（表格局部滚动除外）；
  窄屏保留标题/核心数据/主操作/筛选入口；
- 注明出处：真值源 `设计规范/响应式与无障碍.md` + `页面布局.md`（skill 消费视图惯例：数值冲突以真值源为准）。

**F2 `code-rules.md` 新增第十二节**（编号续接规则 11.x；每条带 ✅/❌ 代码示例，风格对齐现有规则）：

- 规则 12.1 **页面容器流式**：`.page-root` 宽度跟随容器（不设固定 min-width，除非真值源红线场景）；
  Portal 类内容 `max-width` 上限 + 居中。
- 规则 12.2 **卡片/统计区栅格化**：多卡片优先 `ElRow`+`ElCol` 响应式 props
  （`:xs/:sm/:md/:lg/:xl`，注意 EP 断点与设计检查值分工）；等宽卡片流可用 CSS grid
  `repeat(auto-fit, minmax(minpx, 1fr))`；gutter 用 `space-size-16`。
- 规则 12.3 **宽度纪律**：内容区域宽度流式（`width: 100%` / `flex: 1` + `min-width: 0`）；
  写死 px 仅限控件固有尺寸（输入框、下拉、日期选择器等），必须配 `max-width: 100%` 防溢出；
  禁止对布局容器写死总宽。
- 规则 12.4 **@media 使用**：允许页面局部折叠（断点用 EP 口径 768/992/1200/1920）；
  `<style scoped>` 内使用；只做显示/布局切换，不改字体缩放与密度。
- 规则 12.5 **表格自适应**：关键列给 `min-width` 保可读；次要列窄屏可隐藏或走详情；
  表格横向滚动用 ElTable 自带能力（外层不额外加 overflow），禁止整页横向滚动。
- 规则 12.6 **禁止 JS 反推布局**：优先 CSS（栅格/media）；确需 JS（如 ECharts resize）用
  组件自身能力或 `ResizeObserver`，不用 `window.innerWidth` 分支重建布局。

**F3 search-form.vue**：`.input-keyword/.input-type/.input-date` 200/160/260px 保留（控件固有尺寸）
+ 各加 `max-width: 100%`；`.search-form` 已有 flex-wrap，补一条窄屏换行注释示范（不写文档指引）。
实际改动 ≈3 行。

**F4 data-table.vue**：核查列定义——次要列加 `min-width`（替代部分固定 `width`）或保持 `width`
+ 表格容器核查；以"关键列 min-width、表格不溢出"为准绳，具体列级改动执行时按实际内容定。

**F6 glow-cards/index.vue**：`grid-template-columns: repeat(2, 1fr)` →
`repeat(auto-fit, minmax(320px, 1fr))`（minmax 值执行时按卡片实际最小可读宽定）。

**F7 SearchInfoWithRightCard.vue**：300px 侧卡改 `width: 300px; flex-shrink: 0` + 窄屏收纳示范
（或 `max-width: 100%`，执行时按模板结构定，原则：不破模板教学主线）。

**F8 SKILL.md**：
- 工作流 ③ 补一小节「页面自适应」（3–4 行）：所有页面按桌面区间弹性交付（1024–1920+）；
  规则见 code-rules 第十二节，断点/适配口径见 references/design-language.md §3.3；
  提交前用窄视口（1280 与 1024）自查无溢出。
- 硬约束 3 末尾补一条：布局容器禁写死总宽；字体禁用 vw/vh/viewport 缩放（build 会 WARN）。

**F9 build.mjs**：在现有 hex WARN 段旁追加两个 WARN（同一循环内，正则检查 block.content）：
- `/\bzoom\s*:/` → `zoom layout detected: use flex/grid reflow instead (no scaling)`
- `/font-size\s*:[^;]*\b\d+(\.\d+)?vw\b/` → `font-size with vw: do not scale fonts by viewport (design-language red line)`

**F10 init.mjs starter**：`.search-bar` 加 `flex-wrap: wrap;`；`.search-input` 加 `max-width: 100%;`。
同步 preview/src/README.md 若其中描述 starter 布局（执行时核查，无则不动）。

**F11 cdp-responsive.mjs**（新建，验证设施，不属于 skill 交付物）：
- 复用 cdp-shot.mjs 的 Chrome 启动 + CDP 会话骨架；
- 对给定 index.gts.html 依次用 `Emulation.setDeviceMetricsOverride` 设 1920×1080 / 1440×900 /
  1280×800 / 1024×768 四视口，每档断言：
  - `document.documentElement.scrollWidth <= window.innerWidth`（无横向溢出）；
  - `.page-root` 存在且 `getBoundingClientRect().width > 0`；
  - 截图存档（供人眼复核）；
- 输出固定格式 `RESULT: OK/FAIL | <n> viewport failed` + 逐档 `PASS/FAIL viewport=WxH overflow=...`。

### 7.3 原子 Checklist

- [x] C1: F2 code-rules.md 第十二节（规则 12.1–12.6，含 ✅/❌ 示例）
- [x] C2: F1 design-language.md §3.3 扩写
- [x] C3: F3+F5 table-search-drawer 流式改造
- [x] C4: F4 data-table.vue 列宽核查改造
- [x] C5: F6 glow-cards auto-fit
- [x] C6: F7 SearchInfoWithRightCard 300px 治理
- [x] C7: F9 build.mjs WARN 检查 + 本地验证（构造违规样例确认 WARN 触发、合规样例不误报）
- [x] C8: F10 init.mjs starter 自适应（+ README 核查）→ **零改动核查**（见 §10 Diff D1）
- [x] C9: F8 SKILL.md 两处补写
- [x] C10: 验证轮 1：e1-batch 式 vendor 全量 build 回归（.smoke-vendor 复跑设施）——26/26 PASS，
  glow-cards / mixed-chart（e1-batch 不覆盖）单独补验 2/2 PASS，零新增告警
- [x] C11: F11 cdp-responsive.mjs 编写
- [x] C12: 验证轮 2：init 新建 pilot 工程（含改造后 starter）→ build OK → cdp-responsive 四视口冒烟
  → 截图交用户人眼判定（还原循环协议）。双工程（responsive-pilot starter + glow-resp）
  各 4 视口全 PASS（overflowPx=0、mounted=true、无 unhandledrejection）
- [x] C13: Review 三轴 + Reverse Sync + 更新 memory（见 §10）

执行顺序：C1→C2→C3~C6→C7→C8→C9→C10→C11→C12→C13（文档先于代码，验证设施后置）。

### 7.4 风险与回滚

- R1: e1-batch 全量 build 回归依赖 .smoke-vendor 设施（上次用于 vendor 转录任务），脚本硬编码路径
  可能需微调——只动临时设施副本，不动 skill/scripts。
- R2: vendor 改造可能引入新 build 告警（如 auto-fit 的 minmax 值触发 token 检查）——C10 专门兜，
  有告警就地修。
- R3: stash pop 冲突（见 §0.1）——恢复时按 Spec 重建本任务改动。
- 回滚：git 工作区改动，`git checkout -- <file>` 可整体回退；无破坏性操作。

## 8. Open Questions（已在 Plan 收口）

- ~~Q1~~ → 已决策：build 加 WARN 最小集（zoom / font-size vw），见 §7.0
- ~~Q2~~ → 已决策：table-search-drawer 全套 + glow-cards + SearchInfoWithRightCard，见 §7.0
- ~~Q3~~ → 已决策：starter 改（flex-wrap + max-width 兜底），见 §7.0

## 9. Change Log

- 2026-09-21: 初版 Research 完成，Spec 落盘。含用户三决策与 design-language 位置质询的查证结论。
- 2026-09-22: 用户指令"先 stash 未提交代码（深色 WIP），先做自适应"。已执行 `git stash push -u`
  （stash@{0}，19 项，含 dark.css 草稿），记录冲突预警（§0.1）。Plan 落盘（§7），
  Q1–Q3 收口为决策。状态 RESEARCH → PLAN，等待 `Plan Approved`。
- 2026-09-22: 用户字面批准 Plan，Execute 启动。C1–C12 完成（详见 §10 Review），C13 Review 收尾。
  状态 PLAN → EXECUTE → REVIEW（完成）。

## 10. Review（2026-09-22，MODE 5 三轴）

### 10.1 Done Contract 验证证据核对（Axis-1 需求完成度）

| §6 条目 | 证据 | 判定 |
|---|---|---|
| 1. pilot 工程全绿 | responsive-pilot（init 生成 + App.vue/main.js/assets 装配）build `RESULT: OK`；glow-resp 同样 OK | ✅ |
| 2. 1280/1440/1920 无横向滚动 | cdp-responsive 双工程 8/8 viewport `overflowPx=0`，`mounted=true`，无 REJECTS；`RESULT: OK` | ✅ |
| 3. 1024 核心内容可用 | 1024×768 档全 PASS；截图人工复核 starter 与 glow-cards 单列/自动换行折叠正常 | ✅ |
| 4. vendor 改造零新增告警 | e1-batch 26/26 PASS + glow-cards/mixed-chart 补验 2/2 PASS，无新增 WARN | ✅ |
| 5. 用户人眼验收 | 四视口截图已产出（`.uxproto-pilot/responsive-shots/` 与 `responsive-shots-glow/`），待用户判定 | ⏳（协议性挂起项，非缺陷） |

### 10.2 Spec-Code 保真（Axis-2，F1–F11 对照实际改动）

| # | Plan 内容 | 实际执行 | 保真 |
|---|---|---|---|
| F1 | §3.3 扩写"布局与自适应" | 断点分工/五档表/红线/出处全部落地（references/design-language.md L76–99） | ✅ |
| F2 | code-rules 第十二节 12.1–12.6 | 六规则 + ✅/❌ 示例落地（L402–540）；Review 时修正 12.6 示例（见 D3） | ✅（含修正） |
| F3 | search-form 三输入框 max-width 兜底 | `.input-keyword/.input-type/.input-date` 各加 `max-width: 100%`，控件固有宽保留 | ✅ |
| F4 | data-table 列宽 min-width 示范 | type `120→min-width 100`、date `140→min-width 120`；其余列按"关键列保读、次要列收窄"核过 | ✅ |
| F5 | index.vue 容器核查（预期改动 0） | 核查确认 `.page-root` 天然流式（padding + min-height），零改动，与 Plan 预期一致 | ✅ |
| F6 | glow-cards demo-grid auto-fit | `repeat(2, 1fr)` → `repeat(auto-fit, minmax(360px, 1fr))`（Plan 写 320，执行按卡片实际可读宽定 360，Plan 已预留该裁量） | ✅ |
| F7 | SearchInfoWithRightCard 300px 治理 | `max-width: 40%` 兜底（Plan 预留"按模板结构定"） | ✅ |
| F8 | SKILL.md 工作流 ③ + 硬约束 3 | 新增「页面自适应（桌面区间弹性）」小节 + 「自适应纪律」bullet，指向两处规范 | ✅ |
| F9 | build.mjs zoom/字体 vw WARN | 两行 WARN 追加于 hex WARN 后；正则经违规 3/3 触发、合规 3/3 不误报单测（含 `width:100vw`、`cursor:zoom-in`、@media 字号像素等边界） | ✅ |
| F10 | init.mjs starter 改造 | **零改动**：stash 后 HEAD starter 为 el-empty 占位页（`.page-root{min-height:100%;padding:24px}` 已流式），Plan 假设的 search-bar starter 在被 stash 的深色 WIP 里。按实际执行，见 D1 | ⚠️→✅（偏差合理） |
| F11 | cdp-responsive.mjs | 四视口（1920/1440/1280/1024）+ mounted + overflowPx + REJECTS 断言 + 截图，固定格式输出 | ✅ |

### 10.3 Axis-3 代码内在质量

- build.mjs 新增正则 `\d(vw|vh)\b` 边界正确（不误伤 `100vw` 宽度、`zoom-in` cursor）；WARN 不阻塞门禁，与"规范约束为主、静态检查为辅"的 Q1 决策一致。
- code-rules 12.6 ✅ 示例 Review 中发现引用 `@vueuse/core`（不在 build ALLOWED_BARE 白名单，agent 照抄会 FAIL），已改为原生 ResizeObserver（Reverse Sync 记 D3）。
- cdp-responsive.mjs 沿用 cdp-shot 骨架，headless profile 隔离、finally 兜底 kill，无资源泄漏。
- glow-cards `.metric-row` 保留 `repeat(3, 1fr)` 判定合规：3 个等分迷你指标在流式卡片内、1fr 轨道可收缩，1024 冒烟 overflowPx=0 佐证。

### 10.4 Plan-Execution Diff（Reverse Sync 回写）

- **D1（F10 偏差）**：init.mjs starter 零改动。原因：Plan 基于深色 WIP 中的 search-bar starter，
  stash 后 HEAD starter 是 el-empty 占位页（天然流式，无写死宽度）。C8 改为核查性零改动，
  记录于此。深色任务恢复（stash pop）后若 search-bar starter 回归，其 240px 输入框需按
  规则 12.3 补 `max-width: 100%`（已具备规范依据）。
- **D2（验证设施）**：glow-resp 冒烟工程非 Plan 预置项，为 C12 验证 glow-cards auto-fit
  实际效果而装配（从 responsive-pilot 复制 App.vue/main.js/assets + 拷入改造后 glow-cards），
  过程中修复缺 App.vue 与缺 `src/assets/themes/base.css` 两处后 build OK。
- **D3（Review 修正）**：code-rules 12.6 ✅ 示例 `@vueuse/core` → 原生 `ResizeObserver`
  （白名单越界，见 §10.3）。修正后无需重跑 e1-batch（vendor 文档层不参与编译门禁）。

### 10.5 Review Matrix

| 轴 | 结论 |
|---|---|
| Axis-1 需求完成度 | PASS——Done Contract 1–4 全部有证据；5 为协议性用户验收挂起 |
| Axis-2 Spec-Code 保真 | PASS——11 项 F 全落地，1 项合理偏差（D1）已回写 |
| Axis-3 代码内在质量 | PASS——1 处示例缺陷当场修正（D3），无遗留 |

**Overall Verdict: PASS**（残余项：用户人眼验收；stash pop 深色任务恢复时的 4 文件冲突合并）。
