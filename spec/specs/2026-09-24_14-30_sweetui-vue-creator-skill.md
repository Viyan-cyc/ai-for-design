# SDD Spec: sweetui-vue-creator Skill（SweetUI 页面生成 Skill，EP generate-ux-prototype 对等复刻）

## 0. Open Questions
- [x] 交付范围？→ 用户定：**完整 harness 骨架**
- [x] Skill 命名与落位？→ 用户定：**`ep-coder/skills/sweetui-vue-creator`**，frontmatter name = `sweetui-vue-creator`
- [x] 图标机制？→ 用户定（2026-09-24 探针后）：**与 EP 同构的混合模式**——模板写 `<icon-plus name="X" />`（公司图标语义包装组件），内部命中本地公司 SVG（fetch-icons 从 icon+ 下载）则渲染公司图标，未命中回落 `<sweet-icon iconClass="sweetui-icon-{X}-l" />`（SW 自带字体图标）
- [x] 图标库命名澄清：公司图标库 = **icon+ / IconPlus**（EP fetch-icons 同源 `https://octo.hdesign.huawei.com`）；SweetUI 自带字体图标集 720 个（`sweetui-icon-*`）；`sweet-icon` **无 `name` prop**，只有 `iconClass`/`size`/`color`，icon+ 不能直接塞
- [x] 探针已定：CSS 变量 = **双体系** `--el-*`（359，EP 继承，受 namespace 影响）+ `--swt-*`（667，纯 CSS 写死，不受 namespace）；bridge 需映射两套
- [x] 探针已定：缺失回退清单 = `sweet-textarea`→`sweet-input type="textarea"`；`sweet-check-tag`→`sweet-tag`+click；`sweet-avatar-group`→自封装；`sweet-image-viewer`→`sweet-image` 内嵌
- [x] 探针已定：UMD = `sweet-ui-base.umd.cjs`（CJS 可 require），浏览器全局 `window["sweet-ui-base"]`，需预置 `window.Vue`/`window.xss`/`window._$1`(lodash)/`window.echarts`
- [x] 探针已定：i18n = SweetUI 原生 `i18n(localeTag, app)` + `sweet-config-provider :locale`，locale 文件 `es/locale/lang/zh_CN.mjs` 等 11 种
- [x] 探针已定：命名空间默认 **"el"**（材料里 `namespace="sweet"` 不采用——CSS 是 `.el-*`/`--el-*` 体系，改 namespace 会变类名前缀且无对应 `.sweet-*` CSS 兜底）
- [ ] 内网实跑待确认（不阻塞骨架，HANDOFF 收录）：UMD `app.use(SweetUI)` vs 逐组件注册（sfc-loader 下）；defineExpose/focus-trap 失效程度；`--swt-*` 完整 667 与 `--el-*` 完整 359 清单提取（bridge 用）

## 1. Requirements (Context)

### 1.1 Goal
产出一套与 `ep-coder/skills/generate-ux-prototype` **功能对等**的 SweetUI 页面生成 Skill：目录 `ep-coder/skills/sweetui-vue-creator`，name=`sweetui-vue-creator`。产物 = **完整 harness 骨架 + HANDOFF 内网交接清单**。本地（无 SweetUI 源码/UMD）可交付；内网 LLM 拿到包后，基于骨架补齐 SweetUI 专属细节并闭环验证。最终效果：内网用户给自然语言需求 → skill 产出 Vue3 + SweetUI 的 `.vue` 页面 + 离线双击可开的预览 HTML + 可拷入真实工程的 `src/`。

### 1.2 In-Scope（本会话交付）
- 骨架目录 + 全套脚本的 SweetUI 化版本：`SKILL.md`、`references/`、`scripts/`、`vendor/`、`README.md`
- 主题四件套：`base.less`/`default.less`/`dark.less` 复用同一 design-language 体系（与 EP 同源）；`bridge.less` 换成「design-language → SweetUI 槽位」模板（槽位名标内网核验）
- 组件索引 `components_index.md` + 5 套模板：基于 `sweetui-frontend-development.md` 重编为 SweetUI 口径
- `HANDOFF.md`：内网 LLM 的交接清单（UMD、白名单、bridge 槽位、图标全集、i18n、图表、组件核验、vendor 重写）
- token 口径：**统一 design-language**（`--color-*`/`--space-size-*` 等），材料里的 `--swt-*` token 作废替换
- 图标：`<icon-plus name="X" />` wrapper（命中本地公司 SVG 渲染，未命中回落 SW 字体图标）+ fetch-icons 端口回归（探针后用户拍板，与 EP 同构）
- 验证设施：骨架文件结构完整性 + 门禁脚本自检 + gen-tokens 可跑通（复用同一设计语言源）

### 1.3 Out-of-Scope（本会话不做，交内网）
- SweetUI 真实 UMD / theme-chalk 源码的获取、打包、落库（内网）
- `sweetui-icons.json` 真实内容（内网从 theme-chalk `.sweetui-icon-*` 字体类名提取 720 个）；components/exports 本地按探针 1.1 全表填
- `bridge.less` 真实槽位映射值（内网读 SweetUI theme-chalk 核验）
- 公司图标库 name 全集（内网）
- SweetUI i18n 真实 locale 资产与接线（内网）
- `vendor/vue-skill/components/` 高频组件示例 SFC 与 `vendor/code-example/` 整页示例的 SweetUI 化重写（内网，依赖真实 API 核验）
- 内网端到端验证（build 门禁 + 预览冒烟 + 深浅主题）

## 1.4 Context Sources
- Requirement Source:
  - `C:\Users\Tony\Documents\xwechat_files\...\2026-09\sweetui-frontend-development.md`（SweetUI 组件指南：150+ 组件、5 模板、`@hw-seq/sweet-ui-base`、`sweet-*` 前缀、`sweet-config-provider namespace`、`sweetUIBase.i18n/setTheme`、`SweetMessageBox/$sweetNotify`、`sweet-icon name=`）
  - `C:\Users\Tony\Documents\xwechat_files\...\2026-09\gts-ux-spec.txt`（GTS UX 规范：`--swt-*` 全表 + `body[theme='uDesign2.2-{light,dark}']` 双主题 CSS 块）——token 值**作废替换**，仅作 SweetUI 槽位命名的参考线索
- 复用蓝本（功能对等的 EP skill，结构照抄、EP 专属部分换 SweetUI）:
  - `ep-coder/skills/generate-ux-prototype/SKILL.md`（工作流 ⓪–⑤、硬约束、交付口径）
  - `ep-coder/skills/generate-ux-prototype/references/design-language.md`（同一 token 消费视图）
  - `ep-coder/skills/generate-ux-prototype/scripts/*`（ensure-env/init/build/build-data/gen-tokens/gen-whitelists/preview/install）
  - `ep-coder/skills/generate-ux-prototype/vendor/vue-skill/*`（SKILL/code-rules/components_index/error-checklist/模板/示例）
  - `ep-coder/design-language/`（真值源：`样式Token/设计系统.md` 统一双主题表、`组件规范/`、`设计规范/`）
- Chat/Business Refs: 本会话用户三决策（§0）

## 1.5 Codemap Used
- Codemap Mode: `feature`（本次是对单个既有 skill 做结构复刻，非全库探索）
- Codemap File: 未单独生成（蓝本结构已直接读取，见 Context Sources）
- Key Index（EP skill 结构 = SweetUI skill 的镜像骨架）:
  - 工作流：`ensure-env → init → 写页面 → fetch-icons → build 门禁 → 交付`（fetch-icons 端口回归，扫 `<icon-plus name>`）
  - 脚本职责：ensure-env/setup-env（环境）、init（建工程骨架）、build+build-data（编译门禁+数据装配）、gen-tokens（token 生成）、gen-whitelists（白名单）、preview（UMD+sfc-loader 离线预览）、install（node 安装）
  - 主题四件套：base/default/dark/bridge（`.less`），default/dark 由 gen-tokens 从 design-language 生成
  - 验证设施：`scripts/verify/compiler`（真实 @vue/compiler-sfc）+ `verify/whitelists/*.json`

## 1.6 Context Bundle Snapshot（Standard）
- 关键事实（SweetUI 材料）：
  - 组件命名：`sweet-*` 前缀（`sweet-button`/`sweet-input`/`sweet-form`/`sweet-table`…），150+ 组件
  - 分类：表单 17 / 布局 6 / 展示 16 / 导航 5 / 反馈 10 / 图表 7
  - 包：`@hw-seq/sweet-ui-base`；全量 `import sweetUIBase … ; app.use(sweetUIBase)`；按需 `import { SweetButton, SweetInput }`
  - 样式：`@hw-seq/sweet-ui-base/theme-chalk/index.css`
  - 国际化/主题：`sweetUIBase.i18n(language, app)`、`sweetUIBase.setTheme('light', app)`
  - 命名空间：根组件 `<sweet-config-provider namespace="sweet">`（支持 el/sweet 两种）
  - 命令式 API：`SweetMessageBox`（success/error/warning/info/confirm）、`$sweetNotify`（`getCurrentInstance().proxy`）
  - 图标：`<sweet-icon name="home" />`（公司图标库）
  - 表单：`sweet-form` `:model` `:rules` + `formRef.validate()/resetFields()`；`sweet-form-item` label/prop
  - 表格：`sweet-table` `v-model:selection` `:data` `:loading` stripe border + `sweet-table-column` + `sweet-pagination` `v-model:current-page` `v-model:page-size`
  - 布局：`sweet-container`/`sweet-header`/`sweet-aside`/`sweet-main`/`sweet-footer` + `sweet-row`/`sweet-col`（24 栅格）
  - 图表：`sweet-line-chart`/`sweet-bar-chart`/`sweet-pie-chart`/`sweet-area-chart`/`sweet-radar-chart`/`sweet-gauge-chart`/`sweet-liquidfill-chart`
- 关键事实（当前 token 体系 = design-language，与 EP 同一套）：
  - token 无前缀：`--color-brand(-hover/-active)`、`--color-text-*`、`--color-bg-1..6`、`--color-error/-success/...`、`--{brand|gray}-{05..90}` 色板、`--color-chart-1..11`、`--space-size-4..80`、`--radius-size-*`、`--shadow-1..6`、`--frost-*`、`--ux-mix-base`
  - 皮肤机制：一皮肤一 `.less`，`html[data-theme="{name}"]`，bridge 把 token 映射到组件库内部槽位（EP 是 `--el-*`，SweetUI 待定）
  - 换肤机制常驻、切换 UI 按需；默认 `default` + `dark` 两套，均由 gen-tokens 从 design-language 统一双主题表生成
- Open Questions: 见 §0（内网待确认 4 项）

## 1.7 Minimum Chaos Unit Assessment
- Final Goal: SweetUI 页面生成 skill 在内网可用（与 EP 对等功能）
- Current Task Unit: 产出「sweetui-vue-creator 骨架包 + HANDOFF」，不含任何 SweetUI 真实依赖
- Why this unit is small enough: 全部内容可离线构造（复用 EP 蓝本 + SweetUI 材料），无外部依赖；真实 SweetUI 细节已明确切割给内网，边界清晰
- In-Scope Boundary: `ep-coder/skills/sweetui-vue-creator/` 目录内全部骨架文件
- Out-of-Scope Boundary: 内网 4 项待确认 + vendor 重写 + 端到端验证
- Verification Evidence: ① 骨架文件结构完整（与 EP 对拍）；② gen-tokens 对同一设计语言源跑通产出 default/dark；③ build 门禁脚本对骨架自检不崩；④ 用户过目
- Failure / Rework Plan: 骨架某文件与 EP 结构对拍缺漏 → 按 EP 蓝本补齐重验
- Model Autonomy Space: 全自动产出骨架；内网项只写进 HANDOFF，不猜测、不伪造
- User Decision: Accepted（本会话目标 = 骨架 + HANDOFF）

## 2. Research Findings
- **EP skill 架构事实**：工作流 ⓪node→①ensure-env→②init→③写页→③.5fetch-icons(EP独有)→④build→⑤交付；硬约束=不删用户磁盘/不绕脚本/装环境是 agent 活/build 不 PASS 不算完/只碰 src 与 App.vue/token 纪律；主题四件套 = base(default/dark 由 gen-tokens 生成)+bridge(映射 `--el-*`)+dark；预览 = index.gts.html + public/library UMD + vue3-sfc-loader；i18n = vue-i18n UMD + EP locale，按需启用；api 服务层 + mock；vendor = vue-skill(组件示例+code-rules+error-checklist+模板) + code-example(整页示例)。
- **SweetUI 差异点**（EP→SweetUI 映射）：
  - 组件前缀：`El*` → `sweet-*`（模板标签全部小写连字符）
  - 包：`element-plus` → `@hw-seq/sweet-ui-base`；UMD：`element-plus.full.min.js` → SweetUI UMD（内网产）
  - 图标：`<icon-plus name="X" />` wrapper（公司 icon+ 语义名；命中本地 SVG 渲染，未命中回落 `<sweet-icon iconClass="sweetui-icon-{X}-l">`）。SweetUI 自带字体图标 720 个（`sweetui-icon-*`），公司口径优先 icon+
  - 桥接：bridge.less 目标从 `--el-*` → SweetUI 真实槽位（内网核验；gts-ux-spec 的 `--swt-*` 是线索但未必是真实槽位）
  - i18n/主题：`ElConfigProvider` locale + vue-i18n → `sweetUIBase.i18n(lang, app)` + `sweet-config-provider namespace`
  - 命令式 API：`ElMessage/ElNotification/ElMessageBox` → `SweetMessageBox`/`$sweetNotify`
  - 图表：vue-echarts → SweetUI 原生 chart 组件（`sweet-line-chart` 等，需内网核验其 option 接口与是否跟随 token）
  - 组件索引：EP 白名单 118 组件 → SweetUI 137 组件（探针 1.1 全表，白名单本地直接填）
- **gts-ux-spec.txt 的价值**：token 值作废，但结构揭示 SweetUI 主题层的变量组织（语义命名、别名层、双主题 `body[theme=…]`）——内网读真实 theme-chalk 时用于对照槽位名形态
- **白名单生成机制事实**（EP `gen-whitelists.mjs`）：一次性脚本，`createRequire` 解包包的 `dist/index.full.js`，遍历导出表——`exports` = 全部 key；`components` = 值对象且名以 `El[A-Z]` 开头 → kebab。`icons` 单独从 `../icons-pkg/dist/index.iife.js`（图标包 IIFE）正则抽名。三份被 build.mjs 消费：components→模板标签、exports→import 名、icons→图标名。**SweetUI 差异**：components/exports 来源 = SweetUI 包全量构建（识别规则 `El`→`Sweet`，kebab 即 `sweet-*`）；**icons 来源 ≠ SweetUI 包，而是公司图标库 name 全集**（`<sweet-icon name="…">` 运行时按公司图标库解析），需 gen-whitelists 增加 icons 来源参数（公司图标库 manifest / sweet-icon 组件 name 映射 / 图标元数据择一），且 build 门禁图标检查形态从「标签必须 import」改为「`sweet-icon` 的 name 须命中图标库清单」。
- **风险项处置（探针后）**：原 6 项中 5 项已闭环——CSS 变量双体系已证实（仅 11 处硬编码，bridge 可接管）；UMD CJS-require 兼容已证实（gen-whitelists 输入 = `sweet-ui-base.umd.cjs`）；图标机制已定（icon-plus wrapper + SW 回落）；config-provider locale/主题联动已证实；图表不读 CSS 变量已证实（readToken 注入方案定）。唯一保留：SweetUI UMD 在 vue3-sfc-loader 下的实跑（注册方式 app.use vs 逐组件）——HANDOFF 首个验证项。

### 探针取证结论（2026-09-24，证据全文见 `mydocs/specs/sweetui-intranet-probe-answer.md`）
- **包形态**：`@hw-seq/sweet-ui-base@5.6.5`；`dist/sweet-ui-base.umd.cjs`（UMD/CJS，等价 EP `index.full.js`）+ `sweet-ui-base.js`（ESM）+ `sweet-ui-base.css`（全量样式）。UMD 顶层 CJS wrapper，Node 可 require；浏览器全局 `window["sweet-ui-base"]`；需预置 `window.Vue`/`window.xss`/`window._$1`(lodash)/`window.echarts`。依赖打包为 dependencies（vue 3.5.29/dayjs 1.11.13/echarts 6.1.0/xss/lodash/async-validator），非 peer。
- **locale**：`es/locale/lang/` 11 种（`zh_CN.mjs`/`en_US.mjs`…），`i18n(localeTag="zh_CN", app)`。
- **组件清单**：137 个 `Sweet*` 导出（全表见探针 1.1，kebab 即 `sweet-*`）。材料声称 150+ 实为 137（含 4 服务型 + 图表基底 13，纯 UI ~120）。材料提到但**不存在**：`sweet-textarea`/`sweet-check-tag`/`sweet-avatar-group`/`sweet-image-viewer`。材料未提但存在：SweetAlert/SweetCmpTable/SweetCustomSelect/SweetGenexTable/SweetGridLayout/SweetListTransfer/SweetMinPagination/SweetPanel/SweetScoreCard/SweetSidePanel/SweetTreeTable/SweetTreeTransfer/SweetVirtualTable 等 ~30 个。
- **API 兼容**（与 EP 高度同构）：Form `:model/:rules` + `formRef.validate()/resetFields()/clearValidate()`；Table `:data/:loading/v-model:selection` + column 插槽 + Pagination `v-model:current-page`（jumper 中文）；Row/Col 24 栅格响应式 props；`$msgbox/$alert/$confirm/$prompt`（Promise）+ `$sweetNotify` + `vLoading`/`$loading`；Dialog `v-model/#footer/@opened`。**差异**：`sweet-select-tree` 独立组件（nodeKey/defaultProps 内建、collapseTags 默认 true、leafOnly 等扩展 prop）；`sweet-text` 是文本展示组件非输入（多行文本用 `sweet-input type="textarea"`）。
- **图标（关键更正）**：`sweet-icon` **无 `name` prop**，只有 `size`/`color`/`iconClass`；`iconClass` 指向自带字体图标类（`<i class="sweet-icon sweetui-icon-{X}-l/-f">`，720 个）。icon+ 不能直接塞；接入需封装 wrapper（探针附件三方案 B）。**用户决策**：与 EP 同构混合模式（见 §0）。
- **CSS 变量双体系**：`--el-*` 359（EP 继承，useNamespace 生成，受 namespace 影响）+ `--swt-*` 667（纯 CSS，`:root` 默认 + `body[theme=…]` 覆盖，不受 namespace）。主题文件 `theme-chalk/vars/var-ui-{common,light,dark,black,uDesign2.2-*,hDesign1.1-*,hDesign3.1}.css`。setTheme → `document.body.setAttribute('theme', name)`，整体替换。硬编码颜色仅 11 处（`.sweet-map/cmp/custom/side/genex-*`）。gts-ux-spec 的 `--swt-color-brand-normal` 类命名 ≠ 真实（真实为 `--swt-color-primary`/`--swt-bg-color` 等），**以真实 theme-chalk 为准**。
- **图表**：13 个组件（SweetEcharts 基底 + 12），ECharts 6.1 封装，`autoresize`/`height` prop，`chartTheme` JS 静态对象（5 主题，**不读 CSS 变量**，硬编码 hex）。需 skill 侧用 readToken 注入 `--color-chart-*` 才能跟随主题。
- **预览可行性**：UMD 可 `<script>` 全局加载，加载顺序 CSS→vue.global→xss→lodash(min, 需 `window._$1=_)`→echarts→sweet-ui-base.umd.cjs→vue3-sfc-loader；注册方式（app.use 整体 vs 逐组件）待实跑。dayjs 无需全局。
- **运行时坑**：继承 EP（defineExpose 失效/静态 current-page/focus-trap/通知无 max/table fixed 错位）；新增（UMD 全局名非标准 `window["sweet-ui-base"]`、lodash 别名 `_$1`、chartTheme 不随 CSS 主题、`--swt-*` 不受 namespace、无 textarea/CheckTag/AvatarGroup）。

## 2.1 Next Actions
- [x] 产出内网探针问卷 `mydocs/sweetui-intranet-probe-2026-09-24.md`（含开场指令 + 蓝本/材料清单）
- [x] 用户跑内网探针，答案落 `mydocs/specs/sweetui-intranet-probe-answer.md`（包 5.6.5，137 组件，双体系 CSS 变量，icon 无 name prop 等关键事实全部到位）
- [x] 按探针答案修订 Spec 与骨架口径（bridge 双体系、白名单来源、components_index 137+缺失回退、模板对拍附件二、图标 EP 同构混合、默认 el、i18n/图表走原生）
- [x] **用户批准 Plan** → 本会话产出 `ep-coder/skills/sweetui-vue-creator/` 完整骨架 + HANDOFF（清单 1–12，见 §5 Execute Log）
- [ ] 内网（HANDOFF 驱动）：UMD 打包落库 → 白名单/字体图标类名提取 → bridge 双体系槽位接线 → icon+ 接线 → vendor 重写 → 端到端验证

## 3. Innovate
- **Skipped: true**
- Reason: 架构路线已在用户三决策 + EP 蓝本上收敛（完整 harness 复刻、落位/命名已定、图标走 icon-plus 混合模式）；剩余唯一架构分叉（bridge 映射值）是被内网事实锁定的核验项，不是可选方案。

## 4. Plan (Contract)

### 4.1 设计要点（骨架的口径约定）
- **目录**：`ep-coder/skills/sweetui-vue-creator/`，镜像 EP 结构。
- **token**：页面代码统一 design-language（`--color-*` 等），不写 `--swt-*`/`--el-*`；`default.less`/`dark.less`/`base.less` 与 EP 同源（gen-tokens 从同一设计语言表生成）；**主题机制改走 SweetUI 原生 `body[theme]`**（`setTheme` → body attr → 级联），不用 EP 的 `html[data-theme]`。`bridge.less` 映射 design-language → **双体系**（`--el-*` + `--swt-*`），槽位清单 `TBD@intranet`（grep 真实 theme-chalk 提取 359+667）。
- **主题三规则**（`body[theme]` 落地必要推论，写入 sweetui-bridge.md + HANDOFF）：
  1. 皮肤名 = setTheme 参数 = `body[theme]` 值，三者统一：皮肤叫 `default`/`dark`，`setTheme('default')` → 命中我们 bridge 的 `body[theme=default]` 作用域；**不迎合** SweetUI 自带 `light`（其自带主题值 light/dark/black/uDesign2.2-*/hDesign* 无 `default`，setTheme 对任意值只是 setAttribute）
  2. **禁加载** SweetUI 自带 `theme-chalk/vars/var-ui-*.css`（同在 `body[theme=…]` 作用域定义 `--el-*`/`--swt-*`，与 bridge 抢级联、后加载者赢）；`:root` 默认值由 `sweet-ui-base.css` 提供（探针已证），bridge 写 `body[theme=xxx]` 特异性高于 `:root`，天然获胜
  3. 内网落库 `public/library/` 只放 `sweet-ui-base.css`，不放 `vars/` 主题文件（HANDOFF 验证步骤含「删 vars/ 引用后组件仍着色」）
- **组件/API 口径**：模板标签一律 `sweet-*` 小写连字符；**根组件 `sweet-config-provider` 不设 namespace（默认 "el"）**——CSS 是 `.el-*`/`--el-*` 体系，设 "sweet" 会改类名前缀且无 `.sweet-*` CSS 兜底；命令式走 `$msgbox/$alert/$confirm/$prompt` + `$sweetNotify` + `vLoading/$loading`；`sweet-select-tree` 独立组件（nodeKey/defaultProps/collapseTags 内建）；多行文本用 `sweet-input type="textarea"`。
- **图标（与 EP 同构混合）**：模板写 `<icon-plus name="X" />`（wrapper：命中本地公司 SVG → 渲染；未命中 → `<sweet-icon iconClass="sweetui-icon-{X}-l" />` 回落 SW 字体图标）；**fetch-icons.mjs 端口回归**——扫 `<icon-plus name=`，请求 icon+（`octo.hdesign.huawei.com`），下载 light/dark SVG 到 `src/assets/icons/`，增量缓存，未命中保留 SW 回落。iconClass 语义名 ↔ SW 类名用派生规则 + 少量例外映射表。
- **i18n**：按需启用，接 SweetUI 原生 `i18n(localeTag, app)` + `sweet-config-provider :locale`（locale 从 `es/locale/lang/zh_CN.mjs` 等引），**不引 vue-i18n**；词典边界沿用 EP 判定法（界面文案 + 枚举显示名进词典，记录内容不进）。
- **预览**：index.gts.html + `public/library/`（内网填：`sweet-ui-base.umd.cjs` + `sweet-ui-base.css` + `vue.global.prod.js` + `xss.js` + `lodash.min.js` + `echarts.min.js` + `less.min.js` + `vue3-sfc-loader`）+ moduleCache 映射；UMD 全局 `window["sweet-ui-base"]`，注册方式（app.use 整体 vs 逐组件）HANDOFF 标实跑。
- **白名单**：`verify/whitelists/sweetui-components.json`（137 `Sweet*` kebab，探针已给全表）+ `sweetui-exports.json`（UMD 导出）+ `sweetui-icons.json`（SW 字体图标类名 720 个，grep theme-chalk `.sweetui-icon-`；icon+ 命中语义另记）；`gen-whitelists.mjs` 输入从 `dist/index.full.js` 改为 `sweet-ui-base.umd.cjs`，icons 源加字体类名提取。**icons 检查口径**：`<icon-plus name="X">` 的 name 派生 SW 类（`sweetui-icon-{X}-l`）须命中 `sweetui-icons.json` **∪** fetch-icons 已落盘 `src/assets/icons/` SVG 名，双落空 → WARN（不 FAIL，页面可跑、图标空渲染回落）。
- **图表**：用 SweetUI 原生 `sweet-line-chart` 等（`:data` + `:autoresize` + `:height`），**配色不随 CSS** → skill 图表模板用 readToken 注入 `--color-chart-*` 跟随主题；chartTheme 可按皮肤联动。
- **缺失回退清单（探针已定）**：`sweet-textarea`→`sweet-input type="textarea"`；`sweet-check-tag`→`sweet-tag`+click 模拟；`sweet-avatar-group`→自封装；`sweet-image-viewer`→`sweet-image` 内嵌。写入 `components_index.md`「缺失回退」列，skill 不静默绕开、显式标注。
- **白名单来源修正**：components/exports 从 SweetUI 包（UMD/component.mjs）；**icons 与 EP 不同源**——EP 从图标包抽，SweetUI 从主题字体类名 + icon+ 命中语义抽。
- **探针门禁已解除**：探针答案（`mydocs/specs/sweetui-intranet-probe-answer.md`）已覆盖 bridge 槽位/图标/components_index/模板/i18n/图表/预览 UMD；剩余实跑项（注册方式/namespace 验证/defineExpose 程度/完整变量清单提取）不阻塞骨架，收 HANDOFF。
- **环境脚本**：ensure-env/setup-env/install 与 EP 复用（framework-agnostic），仅包名/内网源描述改。

### 4.2 File Changes
| 路径（相对 `ep-coder/skills/sweetui-vue-creator/`） | 变更说明 |
|---|---|
| `SKILL.md` | 镜像 EP SKILL.md：工作流、硬约束、交付口径 SweetUI 化（fetch-icons 保留为 icon-plus 检索替换、`<icon-plus name>` 图标纪律、config-provider 默认 el、UMD 坑改写 SweetUI 版） |
| `README.md` | 包说明 + 内网闭环指引 |
| `HANDOFF.md` | **内网交接清单**：UMD、白名单、bridge 槽位、图标全集、i18n、图表、组件核验、vendor 重写、端到端验证（含验证步骤） |
| `references/design-language.md` | 从 EP 拷贝（同一 token 消费视图，数值真值源指向同一 design-language 树） |
| `references/env-config.json` / `fallback-node-manifest.json` | 从 EP 拷贝（节点/内网源，framework-agnostic） |
| `references/on-demand-toggle.md` | SweetUI 化（`sweet-config-provider`/`sweetUIBase.setTheme` 切换 UI 参考实现） |
| `references/sweetui-bridge.md` | 新增：bridge 设计说明 + 内网槽位核验程序 |
| `scripts/ensure-env.mjs` / `setup-env.mjs` | 从 EP 拷贝（包名/描述改） |
| `scripts/install/install.ps1` / `install.sh` | 从 EP 拷贝 |
| `scripts/init.mjs` | SweetUI 化：产物骨架（starter 页/`<icon-plus>` wrapper 组件/库清单/moduleCache 模板）按 SweetUI 改；fetch-icons 步骤保留 |
| `scripts/fetch-icons.mjs` | **端口回归**（EP 原版改造）：扫 `src/` 下 `<icon-plus name="X">` 实际用法去重，请求 icon+（`octo.hdesign.huawei.com`），命中生成 light/dark 两套 SVG 到 `src/assets/icons/`，增量缓存（已落盘即跳过），未命中保留 SW 回落；`RESULT: OK + RESOLVED/MISSED/CACHED` |
| `scripts/build.mjs` / `build-data.mjs` | 从 EP 拷贝，白名单文件名改 `sweetui-*`、标签/图标检查口径按 `<sweet-*>` + `<icon-plus name>` + `sweet-icon iconClass` 改 |
| `scripts/gen-tokens.mjs` | 从 EP 拷贝（同一设计语言表 → default/dark）；**主题作用域改 `body[theme]`**；bridge 模板片段改双体系（`--el-*` + `--swt-*`）占位 |
| `scripts/gen-whitelists.mjs` | 端口 EP：components/exports 从 SweetUI UMD（`sweet-ui-base.umd.cjs`）/`es/component.mjs` 导出遍历（`Sweet[A-Z]` 识别）；**icons 从 theme-chalk 字体类名（`.sweetui-icon-*`）提取**，输出 `verify/whitelists/sweetui-*.json` |
| `scripts/verify/compiler/` | 从 EP 拷贝（真实编译器依赖） |
| `scripts/verify/whitelists/sweetui-components.json` / `sweetui-exports.json` / `sweetui-icons.json` | components/exports 占位（探针 1.1 已给 137 全表可直接填）；icons 占位 + README：内网从 theme-chalk `.sweetui-icon-*` 提取 720 个 |
| `scripts/preview/index.gts.html` / `src/main.js` | SweetUI 化：加载 SweetUI UMD（`window["sweet-ui-base"]`）+ 预置 globals（Vue/xss/lodash→`_$1`/echarts）、`app.use`（整体或逐组件）、moduleCache 映射 |
| `scripts/preview/public/library/README.md` | 内网待填清单（`sweet-ui-base.umd.cjs`/css + vue.global + xss + lodash + echarts + less + vue3-sfc-loader；dayjs 免） |
| `scripts/preview/src/components/icon-plus.vue` | 新增：公司图标 wrapper（`name`/`size`/`color` props；命中本地 SVG → SweetIcon slot 渲染；未命中 → `<sweet-icon iconClass="sweetui-icon-{name}-l">` 回落） |
| `scripts/preview/src/assets/themes/base.less` | 从 EP 拷贝 |
| `scripts/preview/src/assets/themes/bridge.less` | **双体系**槽位模板（design-language → `--el-*` + `--swt-*`；映射值 TBD@intranet，附核验指引） |
| `scripts/preview/src/assets/themes/default.less` / `dark.less` | 由 gen-tokens 从设计语言表生成（不手写） |
| `scripts/preview/src/assets/themes/README.md` | 从 EP 拷贝（皮肤协议同） |
| `vendor/README.md` | SweetUI 化路由说明 |
| `vendor/vue-skill/SKILL.md` | SweetUI 化 |
| `vendor/vue-skill/references/code-rules.md` | SweetUI 化：`sweet-*` 纪律、`<icon-plus name>` 图标纪律（SW 回落）、config-provider 默认 el、API 口径（基于探针证据；未覆盖处标内网核验） |
| `vendor/vue-skill/references/components_index.md` | 基于**探针 1.1 的 137 全表**重编：分类/用法/高频★ + **缺失回退列**（textarea→input type=textarea、check-tag→tag+click、avatar-group→自封装、image-viewer→image 内嵌）+ SweetSelectTree 独立组件说明 |
| `vendor/vue-skill/references/error-checklist.md` | SweetUI 化（含探针 5.2 运行时坑：UMD 全局名/lodash 别名/chartTheme 不随 CSS/`--swt-*` 不受 namespace） |
| `vendor/vue-skill/templates/`（FormPage/TablePage/Layout/DialogDrawer/Message）×5 | 从 `sweetui-frontend-development.md` 5 模板 + **探针附件二真实表格页**对拍重编（API 以探针证据为准） |
| `vendor/vue-skill/components/` | 占位 + README：内网基于真实 API 重写高频组件示例 SFC |
| `vendor/code-example/references/` | 占位 + README：内网把 EP 整页示例重写为 sweet-* |

### 4.3 Signatures（骨架内可离线确定的接口）
- `scripts/build.mjs --dir <dir>`: RESULT: OK | FAIL + ERROR 逐条 + WARN（同 EP 口径）
- `scripts/init.mjs "<artifact-dir>" "<slug>"`: 返回 HTML_PATH / SRC_DIR / PAGE
- `scripts/gen-tokens.mjs`: 从 `design-language/样式Token/设计系统.md` §1.2 生成 default/dark（同 EP）
- `scripts/gen-whitelists.mjs`: 端口 EP：components/exports 从 SweetUI UMD（`sweet-ui-base.umd.cjs`）导出遍历（`Sweet[A-Z]` 识别）；**icons 从 theme-chalk `.sweetui-icon-*` 字体类名提取**，输出 `verify/whitelists/sweetui-*.json`
- `scripts/fetch-icons.mjs --dir "<工程目录>" [--base-url <url>]`: 扫 `<icon-plus name>` 去重 → 请求 icon+ → 下载 light/dark SVG 到 `src/assets/icons/`，增量缓存；`RESULT: OK + RESOLVED/MISSED/CACHED`
- 页面模板标签：`sweet-*`；命令式：`$msgbox/$alert/$confirm/$prompt` + `$sweetNotify` + `vLoading/$loading`；图标：`<icon-plus name="…">`（未命中回落 `<sweet-icon iconClass="sweetui-icon-{name}-l">`）；多行文本 `sweet-input type="textarea"`
- 根组件：`<sweet-config-provider :locale="…">`（**默认 namespace "el"，不设 "sweet"**）

### 4.4 Implementation Checklist
- [x] 1. 建目录骨架 `ep-coder/skills/sweetui-vue-creator/`（references/scripts/vendor 结构）
- [x] 2. 拷贝并 SweetUI 化 `SKILL.md`（工作流/硬约束/交付；fetch-icons 保留为 icon-plus 检索替换；`<icon-plus name>` 图标纪律；UMD 坑改写）
- [x] 3. `references/`：design-language.md 拷贝、env-config/fallback manifest 拷贝、sweetui-bridge.md 新建（双体系说明 + 槽位核验程序）、on-demand-toggle.md 改写（`setTheme`/config-provider）
- [x] 4. `scripts/`：ensure-env/setup-env/install 拷贝；build/build-data/gen-tokens/gen-whitelists 拷贝 + SweetUI 化；**init.mjs 改写（starter + icon-plus wrapper + 库清单 + 保留 fetch-icons 步骤）**；**fetch-icons.mjs 端口回归**
- [x] 5. `scripts/preview/`：index.gts.html + main.js SweetUI 化（`window["sweet-ui-base"]` + globals）、icon-plus.vue 组件、library/README（内网待填）、themes/base 拷贝 + bridge 双体系模板 + default/dark 由 gen-tokens 生成（`body[theme]` 作用域）
- [x] 6. `verify/whitelists/`：components/exports 按探针 1.1 填 137 全表 + 占位；icons 占位 + 内网提取 README
- [x] 7. `vendor/vue-skill/`：SKILL/code-rules/error-checklist SweetUI 化、components_index 重编（137 + 缺失回退列）、templates ×5 重编（对拍附件二）、components/ 占位
- [x] 8. `vendor/code-example/`：占位 + 内网重写 README
- [x] 9. `HANDOFF.md`：完整内网交接清单（UMD 注册方式实跑/白名单/bridge 双体系槽位/icon+ 接线/缺失回退/vendor 重写/端到端验证）
- [x] 10. `README.md`：包说明
- [x] 11. 验证：骨架结构对拍 EP、gen-tokens 跑通产出 default/dark、build 门禁对 starter 模板自检、SKILL.md 关键口径 grep（icon-plus/body[theme]/默认 el）
- [x] 12. 交付：Spec 反向回写 + 用户过目

### 4.5 Route Alignment（Water Flow Check）
- Original assumption: 完全镜像 EP 结构，仅替换组件/图标/桥接/i18n 四维
- Current implementation route: 同上，加一层「内网待确认」显式切割（不伪造 SweetUI 事实）
- Why it fits: EP 蓝本已被验证可靠；SweetUI 材料证明组件 API 与 EP 高度同构；无法离线确认的细节全部收进 HANDOFF
- Scope impact: None（用户三决策已覆盖所有分叉）
- User Decision: Accepted

## 5. Execute Log

**2026-09-28 骨架交付完成**（清单 1–12 全过）：

1. **目录骨架 + SKILL.md**：`ep-coder/skills/sweetui-vue-creator/` 镜像 EP 结构；
   SKILL.md name=`sweetui-vue-creator`，工作流 ⓪–⑤、硬约束 0/0.1/0.2/1/2/3/4、
   UMD 坑 5 条、icon-plus 纪律、默认 namespace "el" 全部落位。
2. **references/**：design-language.md（gen-tokens 生成 + §2/§3/§4 SweetUI 口径）、
   sweetui-bridge.md（主题三规则 + 内网核验程序 §3.1–3.4）、on-demand-toggle.md
   （SweetConfigProvider :locale + sweetUIBase.i18n + window.setTheme，无 vue-i18n）、
   env-config.json / fallback-node-manifest.json（EP 拷贝）。
3. **scripts/**：build.mjs（SWT 白名单 + PKG_BASE + ALLOWED_BARE + icon 双落空 WARN +
   `body[theme` 样式拒绝 + token 豁免 `--swt-*`）、gen-whitelists.mjs（UMD require + 137 提取）、
   gen-tokens.mjs（body[theme] 作用域 ×5 + compact 覆盖块）、fetch-icons.mjs（icon-plus 扫描 +
   深浅双 SVG + barrel + 离线 OK 退出）、init.mjs（starter 含 icon-plus + sweet-input/button/
   table/tag/pagination）、ensure-env/setup-env/cleanup-starter/install/verify（EP 拷贝）。
4. **preview/**：index.gts.html（REQUIRED 加载链 + `<body theme="default">` + window.setTheme +
   moduleCache + icon-barrel 注入）、icon-plus.vue（barrel try/catch + 双 img 深浅切换 + SW 回落）、
   bridge.less（双体系骨架 + `--swt-*` 占位接线区）、base.less（THEME MISSING 改 body:not([theme])）、
   library/README.md（8 文件落库清单 + 禁放 vars/）。
5. **whitelists/**：components/exports 137 全表（探针 1.1）；icons 空占位 + README 内网提取指引。
6. **vendor/**：README.md（SweetUI 口径直线路径）；vue-skill/SKILL.md、code-rules.md
   （规则 2.5.1 icon-plus、2.5 预览 formRef 注、11.2 readToken(document.body)、十二节 sweet-row/col）、
   error-checklist.md（21 通用错误 + 坑 1–6 UMD/SweetUI 专项）、components_index.md
   （137 全表映射 + 缺失回退清单 + SweetSelectTree 专节 + 图表 13 组件 + 高频对照表）、
   templates/ ×5（form-page/table-page/app-layout/dialog-drawer/message-feedback，
   对拍材料 5 模板并修正其错误写法）+ README、components/ 占位 README（内网补全流程）；
   code-example/ SKILL.md + references/README.md 占位（001–007 重写流程）。
7. **HANDOFF.md**：9 节内网交接清单（落库 8 文件/UMD 实跑/白名单提取/bridge 接线四步验证/
   gen-tokens/icon+ 实装/属性核验与 vendor 补全/缺失回退回归/端到端 + i18n-scaffold 清理）。
8. **README.md**：包说明 + 与 EP 版七维差异 + 当前状态。
9. **验证记录**：
   - gen-tokens 跑通：`RESULT: OK`，388 token（semantic 97×2 / palette 132 / chart 17×2 / …），
     产出 default.less + dark.less + design-language.md；
   - 皮肤作用域终检：default/dark 全 `body[theme=...]`（含 compact 覆盖块），无 data-theme 残留；
   - ensure-env `RESULT: OK`（node v24.16.0 / compiler 3.5.25）；
   - init → build 对 starter 自检：`RESULT: OK`（1 page / 2 components），icon 双落空 WARN
     符合设计（icons 白名单空占位）；
   - fetch-icons 离线：`RESOLVED: 0, MISSED: 1` OK 退出（回落路径通）；
   - cleanup-starter：`CLEANED: 2`（demo.js + demo-data.js）；cleanup 后 build FAIL 为预期
     （starter api 被清、页面 import 断链——交付卫生设计行为），重建后 OK；
   - 残留终扫：全包无 element-plus / data-theme / vue-i18n 残留（vendor/code-example 的 El* 为
     重写流程对照说明，有意保留）。
10. **验证期发现并修复**：
    - design-language.md §2/§3/§4 为 EP 静态文本段（gen-tokens 只重写 §1）——改 SweetUI 口径
      （137 组件、icon-plus、body[theme] 换肤协议、双体系禁写、三规则引用）；
    - preview/src/README.md 漏 SweetUI 化——整文件重写（接入依赖、i18n 词典机制、
      setTheme 切换、icon-plus 目录）；
    - index.gts.html `window.setTheme` 内 `data-theme` 双写为死代码（base/bridge 均不消费）——
      删除；`<html data-theme="default">` 属性删除；
    - build.mjs L148 `<html data-theme` 完整性检查同步改 body theme 口径；
    - i18n-scaffold/（EP 拷贝、确认无引用）按产出卫生规则删除；
    - error-checklist 错误 3.2 口径修正：探针 2.4 证实 v-loading 指令随全量安装注册
      （`i.directive("loading", e)`），禁止的是显式 import 指令实体（白名单无导出），
      非禁用指令本身；
    - code-rules 规则十 / error-checklist 错误 9 的 vue-i18n 写法统一改为词典 + `t()` 查表。

## 5.1 内网验证轮回传报告核验（2026-09-28）

报告：`ep-coder/spec/specs/HANDOFF 回传报告 — sweetui-vue-creator Skill 外网验证轮.txt`
（内网 LLM 按 HANDOFF.md 执行后产出，6 节可复制 Markdown）。

**质询式验证结论——报告数字全部对账命中**（node 脚本机器核验）：
- sweetui-icons.json：404 条 = 307 l+f + 18 仅 l + 9 仅 f + 70 single，零死条目；
  CSS 类对账 307×2 + 4（close/full-screen/ok/search 三态）+ 18 + 9 + 70 = 715，与声明吻合。
- bridge.less 贴出全量：--el-* 活跃映射 183 行（与声明精确一致）、swt-default 391 行、
  无重复键、无死映射。
- 精修口径：--el-* 359→358、--swt-* 667→646（以实跑为准）；组件 137→140
  （gen-whitelists 补 SweetCollection/CollectionItem/Overlay）；图标 720→404 语义名
  （715 CSS 类）。
- 两处口径差判定为声明时点差，非错误：报告 §1 引 1048 行旧版（240 --swt-*→DL），
  §2/§3.3 为 1066 行重生成版（实测 262 处映射）；652 vs 646 unique swt 键为
  ancilary/ancillary 双存所致（报告坑 6 自己声明了这一点，自洽）。
- 内网清单状态：✅ 23 项 / ⏳ BLOCKED 10 项（B1–B3 UMD 浏览器项、B4 字体渲染、
  B5 bridge 四步验证、B6 setTheme、B7–B8 21 SFC 与 001–007 重写、B9-B10 收尾）。

**依据报告回填本地骨架**（外网侧能做的全部落地）：
- `scripts/verify/whitelists/sweetui-icons.json`：空占位 → 404 语义名全量（从报告提取落盘）；
- `scripts/verify/whitelists/sweetui-components.json`：137 → 140（补 3 组件）；
- `scripts/preview/src/assets/themes/bridge.less`：157 行占位骨架 → 1059 行全量接线
  （183 --el-* + 652 --swt-* + 391 swt-default + 状态对位修正段，从报告提取落盘）；
- build.mjs 三白名单加载加 `Array.isArray ? x : Object.keys(x)` 兼容
  （icons.json 现为 object 格式，`new Set(object)` 会失效——内网 L82-86 修复同步回填）；
- 数字修正 15 处（SKILL/README/vendor/design-language/bridge/HANDOFF/whitelists README）；
- error-checklist 补坑 7（11 处硬编码 hex 不可覆盖，常规路径不触发）、坑 8
  （ancilary/ancillary 拼写双存）；components_index 扩展组件表补 sweet-overlay 与
  sweet-collection(/item)；
- 复跑验证：init → build `RESULT: OK`（1 page / 2 components，无 icon WARN——404 名
  白名单生效）；fetch-icons 离线 `RESOLVED: 0, MISSED: 1` OK 退出；cleanup 后 FAIL 为
  交付卫生设计行为，与前轮一致。

**未回填项**（报告未贴出全量或属内网环境专属）：sweetui-exports.json 500 条全量
（报告仅声明数量，本地保持 137 导出表——build 只对显式 import 校验，新 3 组件
走 sweet-* 标签路径不受影响）；gen-whitelists.mjs 内网重写版（regex 扫描版，
本地 createRequire 版逻辑等价，保留）；21 高频 SFC 与 001–007 重写（B7/B8 待内网）。

## 5.2 Round 2 回传报告核验（2026-09-29）

报告：`ep-coder/spec/specs/# HANDOFF Round 2 回传报告 — sweetui-vue-creator Skill.txt`。

**清单状态**：Round 1 ✅23/⏳10 → Round 2 ✅31/⏳2。本轮内网完成：
- 22 个高频组件 SFC（21 Sweet* + 1 IconPlus）生成于 `vendor/vue-skill/components/`；
- code-example 001–007 重写完成（12 个 .vue，001/005/007 含子组件）；
- i18n-scaffold 确认零引用（本地骨架上轮已删，双清）；
- B1–B6 浏览器项产出**验证清单**（步骤+预期），但**尚未实跑**——报告自陈
  「✅ (验证清单口述)」，诚实标注，不算完成。

**质询发现与定性修正——本轮报告是纯台账，代码全文未贴，且传不出来**：
按 Round 1 指令要求「第 2、3 节不要省略（22 SFC 全文 + 001–007 产物全文）」，
但 Round 2 报告只有文件清单与行数统计，零代码贴出。用户确认**内网文件无法
传出到外网**（单向传输约束的完整含义：报告能复制进来，代码复制不出来）。
→ 定性：**内网副本即完成态载体**——skill 的部署目标本来就在内网，SweetUI
也只有内网能跑；本地骨架 components/ 与 code-example/ 保持索引型 README
是有意决策，非缺口。已把两个占位 README 改为完成态索引（内网已生成 +
门禁口径 + 写法纪律沉淀），并知照维护者文件在内网。

**§3 门禁声明的可信度评估**（代码不可得，仅作口径审查）：
- 「--el-*/--swt-* 零匹配」「无 sweet-icon name」「hex 仅 #default（Vue slot 语法）」
  ——与我方 build.mjs 门禁同构，声明格式合理；
- 「$sweetNotify 无 max → 队列守卫」「scoped 穿透 → customClass + 非 scoped 块」
  「Message DOM 类 .sweet-message__* 非统一前缀」——三条均为新知，已入
  error-checklist 坑 9/10/11（去重：报告 defineExpose 痛点与既有坑 1 重合，不另立）。

**Round 2 新知落地**：
- error-checklist 补坑 9（$sweetNotify 无 max，页面侧队列守卫）、坑 10
  （命令式浮层 scoped 不可达，customClass + 非 scoped 块）、坑 11
  （DOM 类名非统一 sweet- 前缀，DevTools 确认后再写选择器）；
  报告的 defineExpose 痛点与既有坑 1 重合，未重复收录；
- components/README.md 与 code-example/references/README.md 由占位态改完成态索引
  （内网副本为载体 + 门禁口径 + 写法纪律）。

**剩余工作**（内网侧）：B1–B6 浏览器实跑（清单已备，待人工执行）、
fetch-icons IconPlus API 实跑、Spec §2.1 Next Actions 打勾。

## 6. Review Verdict
（用户过目后填写）

## 7. Plan-Execution Diff
- 无结构性偏离。执行期新增/修正均在骨架口径内：error-checklist 坑 3.2 依探针 2.4 修正
  （计划文本未覆盖到该细节）；design-language.md 静态段与 preview/src/README.md 属计划
  「全部 SweetUI 化」的执行遗漏，验证期抓出修复；i18n-scaffold 删除是计划验证项 11 的
  预设决策分支（「清理或确认保留」→ 确认无引用后清理）。
- 内网验证轮：内网 LLM 对 gen-whitelists.mjs 的重写（createRequire → regex 扫描 UMD +
  theme-chalk）属 HANDOFF §2 预设授权路径，未构成偏离；其白名单加载兼容修复
  （build.mjs L82-86）已回填本地。骨架「探针口径 137/720/359/667」被内网实跑修正为
  140/404/358/646，属预期中的「以实跑为准」项，非偏离。

## 8. Archive Record
- 收口时按需归档：`mydocs/archive/YYYY-MM-DD_hh-mm_sweetui-vue-creator-skill_{human,llm}.md`

## 9. Project Sync Candidates
- Stable facts（跨任务复用价值高）：
  - 「sweetui-vue-creator」任务 = EP generate-ux-prototype 的 SweetUI 对等复刻，落位 `ep-coder/skills/sweetui-vue-creator`，用户三决策（完整 harness / 命名 / icon-plus 混合图标）
  - SweetUI 材料来源：WeChat 2026-09 两文件；SweetUI 在内网、本机不可达；组件 API 与 EP 高度同构
  - SweetUI 双体系变量**实跑口径（2026-09-28 内网轮）**：`--el-*` 358 槽位 + `--swt-*` 646 槽位（探针估 359/667 已修正）；组件 140（探针 137）；图标 715 CSS 类 = 404 语义名（探针估 720）；ancilary/ancillary 拼写双存；11 处硬编码 hex 不可外部覆盖
  - 内网单向传输：文件发不出来，回传 = 可复制 Markdown 报告（本轮已验证其数字全部对账命中）
- Suggested destination: 本项目 memory（[[ep-coder-generate-ux-prototype]] 关联条目追加）
- Sync decision: 待任务收口后由用户确认
