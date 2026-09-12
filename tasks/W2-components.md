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
2. **SFC 自包含**：template + `<script setup>` + `<style lang="less" scoped>` 全内联；禁止 `src="./style.scss"` 外链；禁止 @import 外部样式。
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
- 转换：内联 style.scss 到 `<style lang="less" scoped>`（scss 内容是扁平 CSS 单行规则，直接贴入即可，无需 sass 编译——若遇到真正的 scss 语法如嵌套/变量，**逐个人工处理**并记录）；去 TS；props/emits 改对象语法；删除 types.ts/style.scss；补/保留 index.ts。
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
