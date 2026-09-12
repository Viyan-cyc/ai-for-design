# 任务卡 W2 · 组件库改造（对接设计师）

> 把本文件全文喂给你的 AI 会话，让它按步骤执行。完成后回到 SKILL-REPLACE-PLAN.md §13 打勾。

## 你的角色

你负责把资产库 107 个 G 组件迁移为「单文件自包含」格式。规范与决策见 `SKILL-REPLACE-PLAN.md`（必读 §3.3 组件现状、§5 组件复用方案、D7/D20）。这个工作流要和设计师沟通，迁移脚本可以让 AI 写，但抽查必须人工。

## 前置

- T0 基线提交完成后开工（分支 `w2/xxx`）。
- 先读 5 个代表性组件源码理解现状：`assets/g-design-enterprise-v1.5.0/frontend/element-plus/src/components/basic/GButton/`（目录结构：GButton.vue + types.ts + style.scss + index.ts + examples.vue）、business/GFilterBar/、complex/ 下任选一个。

## 步骤

### M0 《组件库改造规范 v1》正式稿（上午，半天，**契约冻结点**）
以 SKILL-REPLACE-PLAN.md §5.3 七条为骨架，扩写为 `skills/generate-ux-prototype/references/component-format.md`，必须包含：

1. **目录**：`components/{basic|business|complex}/GName/` 下仅 `GName.vue`（必须）+ `examples.vue`（可选，供 AI 学习匹配，不随复用拷贝）+ `index.ts`（必须保留——兼容 npm run build:library，D20 修正：不删任何 index.ts）。**types.ts、style.scss、其他外部文件一律消除**。
2. **SFC 自包含**：template + `<script setup>` + `<style lang="less" scoped>` 全内联；禁止 `src="./style.scss"` 外链；禁止 @import 外部样式。（D22 修订：样式语言钉死 **less**——产品线二次开发硬要求，D21 的 scss 方案作废；组件库与原型工作区统一只剩 less，避免二开拷贝时 scss/less 并行）
3. **纯 JS**：无 TS 标注（`defineProps<{...}>()` → `defineProps({ type: { type: String, default: 'default' } })`；`defineEmits<{...}>()` → `defineEmits(['search','reset'])`；类型 import 删除）。
4. **文案**：组件内可见文案走 props 默认值或 slot 兜底（中文）；组件内部不引入 i18n。
5. **依赖**：仅 vue / element-plus / @element-plus/icons-vue / dayjs + 相对路径其他 G 组件。
6. **样式**：颜色/圆角/间距/阴影一律 token 变量（--g-*、--color-*、--space-*）；禁 hex 字面量；禁内联 style；尺寸 px。
7. **数据**：纯受控 + 事件，不拉数据不含 mock。
8. 迁移前后组件的 props/emits/slots 对外 API **完全不变**（这是硬验收）。

写完 → 发给设计师评审签字 → 定稿后本条打勾。**M0 未定稿，M1 不开工。**

### M1 codemod 脚本（半天）
写 `assets/g-design-enterprise-v1.5.0/scripts/migrate_components.mjs`（Node，D18 全工程 Node 化）：
- 输入：组件目录；输出：原地迁移（先 git 提交迁移前状态以便回滚 diff）。
- 转换：内联 style.scss 到 `<style lang="less" scoped>`（scss 内容是扁平 CSS 单行规则，直接贴入即可，无需编译——若遇到真正的 scss 语法如嵌套/变量，**逐个人工处理**并记录，less 语法基本兼容）；去 TS；props/emits 改对象语法；删除 types.ts/style.scss；补/保留 index.ts。（D22：目标 lang 为 less，源文件本就是 .scss 内容——扁平规则直接贴入，与最早方案一致）
- 产出 `migration-report.json`：每组件的转换项、人工处理项、API 对比（迁移前后 defineProps/defineEmits 签名 diff，必须为空 diff）。

### M2 执行迁移 + 抽查（半天到一天，**最长关键路径，M1 完立即跑**）
- 全量跑 codemod → `npm run build:library`（在 frontend/element-plus 下）必须通过。
- 人工抽查 ≥20 个：business/complex 全部过目（14+5 个），basic 抽 5 个；重点看复杂组件（GDataTablePro、GAlarmTopology、GTopology）。
- 迁移产物 commit（一个大 PR，附 migration-report.json）。

### M3 设计师新组件流程（1 小时）
- 交付给设计师：component-format.md + 「新组件提交 checklist」（按规范写 → 跑 migrate_components.mjs 验证零变更 → build:library 过）。
- 与设计师确认后续新组件按此格式。

## 验收标准
- `find assets -name "types.ts" -o -name "style.scss"` 在 components/ 下零命中（index.ts 保留）
- `grep -r "lang=\"ts\"" assets/.../components/` 零命中
- npm run build:library 通过
- migration-report.json 中 API diff 全部为空
- 抽查记录（谁、看了哪些、结论）附在 PR 描述


---

## 结论回写区（执行中随时追加，每条带姓名+日期）

<!-- 格式：- [日期] (姓名/卡号) 结论或问题一句话；细节缩进展开。写完 commit 到本任务分支 -->

- [2026-09-12] (moyuntian/W2-M0) M0 正式稿 `skills/generate-ux-prototype/references/component-format.md` 已产出，13 节，待设计师评审签字。现状盘点关键结论：
  - 组件目录共 61 个（basic 44 / business 13 / complex 5）；主 .vue 58 个（GLoading/GMessage/GNotification 为 service 组件无 .vue）+ examples.vue 49 + style.scss 49 + types.ts 53 + index.ts 63（含 barrel 2）。
  - style.scss 全部为扁平 CSS（零嵌套、零 `$` 变量、零 `@import`、零 `#{}`），39/49 用 `:deep()`（Vue scoped 语法，非 sass），内联到 less scoped 合法，可直接贴入。
  - 全库零 hex 字面量；静态内联 `style=` 仅 GDashboardGrid / GMonitorPanel 两处 `:style` 动态绑定（保留）。
  - TS 语法面很小：无 enum / defineModel / defineExpose；仅 withDefaults（13 处）、类型 import（GButton/GTopology 从 ./types，GAlarmTopology 从 ../GTopology/types）、script 内 `export interface`（4 处：GAdvancedFilter/GDataTablePro/GDescriptionPanel/GTimelinePro，均无外部消费方）、3 处泛型 + 2 处 `as` 断言（均在 GIcon）。
  - 跨组件相对引用仅 2 处走 barrel（GAlarmTopology→../GTopology、GMonitorPanel→../../business/GStatusTag），GIcon 引 ../../../icons/*.json（约 420KB，不内联）。
- [2026-09-12] (moyuntian/W2-M0) 【需拍板】发现 3 处 components/ 之外的连带耦合，已登记规范 §9，但属跨 W 所有权（assets/ 下非 components/），M0 仅登记不越界编辑：
  1. `src/index.ts:10` `export*from'./components/complex/GTopology/types'` —— 删 GTopology/types.ts 会断库构建，须删该行（盘点：TopologyNode/TopologyEdge 仅 page-types.ts 内部使用，无库包外消费方）。
  2. `src/page-types.ts:1` import 上述两个 interface —— 须把定义并入 page-types.ts 本体。
  3. `package.json` devDependencies 无 `less` —— 改 `<style lang="less">` 后 vite 编译必需加依赖（备选：纯 `<style scoped>` 免加依赖，但与工作区 less 约定不一致，复用拷贝需改写，不推荐）。
  → 建议 M1 codemod 一并处理 #1/#2，#3 由用户拍板归属（W2 代改 / W4 / W3）。规范主选 less 方案。
- [2026-09-12] (moyuntian/W2-M0) 【需拍板】复用闭包契约给 W1/T6：拷 GIcon 时须连带拷 `src/icons/icon-nodes.json` + `icon-aliases.json` 并保持 `../../../icons/` 相对路径（GIcon 跨目录数据依赖，非 .vue）。collect_component.mjs 的递归闭包须覆盖非 .vue 相对 import。规范 §5/§10 已登记。
- [2026-09-12] (moyuntian/W2-M0) D22 决策（用户拍板）：撤回 D21 的 scss 默认，样式语言钉死 **less**。用户理由：产品线二次开发硬要求 less，避免迁移完的组件被二开拷走时 scss/less 混用。技术补充：less 有官方 `less.browser.js` 浏览器编译器；sass 的 `sass.browser.js` 是 W1-T8 组装的（规避 `renderSync` 仅 Node 限制），链路更脆弱。源 style.scss 经盘点全为扁平 CSS，贴进 less scoped 合法，迁移近零转换。任务卡 §2 与 M1 备注已改 less（引用 D22），component-format.md 已是 less，M0 正式稿内容不用动。**跨 W 待办（按决策纪律第 4 条不自改 SKILL-REPLACE-PLAN.md，需用户在 CC 会话「检查回写」时统一裁决）**：
  1. §9 追加 D22 决策记录（撤回 D21 scss 默认 + STYLE_LANG 默认改 less）——任务卡 §2/M1 备注已引用 D22，§9 未登记是缺口。
  2. §13 W1-T8 已打勾 ✓(cyc/2026-09-12)，描述含「sass UMD 编译器入 preview」——建议保留 sass 编译器（STYLE_LANG=scss 取值仍可用），仅默认值从 scss 改 less；或去掉 scss 支持只留 less。由 W1 裁决。
  3. §13 W2-M0 描述「以 §5.3 七条为骨架」——§5.3 第 2 条原文是 less（未被 D21 改动），与最终方向一致，不用动。
  4. component-format.md 文档头「依据」已补 D22 引用（本任务所有权文件，M0 执行细节自主改）；待 D22 入 §9 后可与 §9 记录交叉印证。
- [2026-09-12] (moyuntian/W2-M1) M1 codemod 脚本完成：`assets/g-design-enterprise-v1.5.0/scripts/migrate_components.mjs`（945 行）。关键实现：
  - 深度配对解析 `defineProps<{...}>`/`defineEmits<{...}>`/`withDefaults(...)`（支持 `Record<string,unknown>` 等嵌套 `<>`，纯正则不够用，手写 `extractAngleBody` + 括号配对）。
  - TS→JS 转换覆盖全语法面：withDefaults→defineProps 对象语法、defineEmits→数组语法、删 `import type`/局部 `type` 别名/script 内 `export interface`/`as` 断言（深度配对删 `as unknown as Record<...>` 等）/Vue API 泛型 `ref<T>()`→`ref()`/箭头函数参数类型 `(id:string)`→`(id)`。
  - 内联 style.scss→`<style lang="less" scoped>`、删 types.ts/style.scss、保留 index.ts（D20）、删 index.ts 内 `export type*from'./types'`（GTopology 专用）。
  - 跨组件 barrel 改默认导入：`import{GTopology}from'../GTopology'`→`import GTopology from'../GTopology/GTopology.vue'`（SFC `<script setup>` 无具名导出，必须默认导入——这是 codemod 第一版踩的坑，纯正则改 `from` 部分保留具名 `{GTopology}` 会导致 vite build 报 "not exported by"）。
  - 类型别名表 `buildTypeAliasMap`：扫 types.ts + .vue 内局部 `type X='a'|'b'`（GStatusTag 的 `Status`），mapType 查表生成 JSDoc 可选值注释。
  - 连带耦合（components/ 之外）：src/index.ts 删 `export*from'./components/complex/GTopology/types'`；src/page-types.ts 并入 TopologyStatus/Node/Edge 定义（执行顺序：migrateCoupledFiles 必须在 migrateComponent 之前跑，否则 GTopology/types.ts 已删读不到定义）。
  - `--check` 校验模式（零变更=合规，给设计师 M3 用）+ 默认迁移模式；产出 migration-report.json（每组件转换项、API 前后签名 diff 必须为空）。
  - 踩坑记录：① `#` 注释在 .mjs 非法（ESM）→改 `//`；② `[^;]+` 跨行误删后续代码（`type IconNode=...\nconst p=withDefaults(...)` 被当一条删）→改 `[^;\n]+`；③ `defineProps<{}>` 正则 `[^>]*?` 在 `Record<string,unknown>` 的 `>` 误停→深度配对；④ `parseEmitNames` 未去外层 `{}`→`defineEmits<{...}>` 的 emits 提取为空→加去 `{}`；⑤ `statusMatch` 正则 `[^;]+` 跨行→改 `[^;\r\n]+`。
- [2026-09-12] (moyuntian/W2-M2) M2 全量迁移 + build:library 验证通过：
  - 全量迁移 61 个组件目录，合规 61/61，API diff 0。
  - `npm run build:library`（vue-tsc --noEmit && vite build）通过：vue-tsc 类型检查 0 错，vite build 211 模块转换成功，产出 dist/ 3 文件（g-design-enterprise.js 510KB + .umd.cjs 444KB + .css 46KB）。
  - 验收标准全过：`find components/ -name types.ts -o -name style.scss` 零命中；`grep 'lang="ts"'` 零命中；index.ts 保留 63 个（61 组件级 + 2 barrel）。
  - 人工抽查 20 个组件（business 13 全查 + complex 5 全查 + basic 2）：GButton/GIcon/GResourceTree/GDataTablePro/GTopology/GAlarmTopology/GFilterBar/GStatusTag/GAdvancedFilter/GBatchActionBar/GDescriptionPanel/GFormSection/GMetricCard/GPageHeader/GPermissionState/GSearchBar/GTableToolbar/GDashboardGrid/GMonitorPanel/GTimelinePro——全部合规，零 TS 残留，样式内联 less scoped，跨组件 import 直指 .vue，存量中文文案完整保留。
  - 连带耦合处理：src/index.ts 删 GTopology/types 重导出行 ✓；src/page-types.ts 并入 TopologyStatus/Node/Edge 定义 ✓。
  - 【需拍板】package.json 加 `less` devDependency（回写区 #3 登记）：D22 钉死 less，vite build `lang="less"` 必需 less 预处理器，已 `npm install -D less` 临时装入 node_modules，但 package.json 的 devDependencies 需补登记 `less`（属 assets/ 下非 components/，按决策纪律标「需拍板」）。当前 package.json 已被 npm install -D less 写入，可保留。
- [2026-09-12] (moyuntian/W2-M2) codemod 脚本支持 `--check` 校验模式（零变更=合规），可直接用于 M3 设计师新组件提交 checklist（component-format.md §12 第 2 条已写明用法）。
