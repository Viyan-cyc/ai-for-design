# 任务卡 W1 · 主链路（用户自领）

> 把本文件全文喂给你的 AI 会话，让它按步骤执行。完成后回到 SKILL-REPLACE-PLAN.md §13 打勾。

## 你的角色

你负责 ai-for-design 工程改造的 W1 主链路。背景与全部决策见 `SKILL-REPLACE-PLAN.md`（必读：§4 架构、§5.3 组件规范、§9 决策日志 D1-D20、§12 风险）。本文只列你的步骤与验收标准。

## 前置（30 分钟）

1. **T0 基线提交**（若无人做过）：在仓库根 `git add -A && git commit`（排除 node_modules，先写 .gitignore：node_modules/、dist/、preview-dist/、.DS_Store）。推远端、设 main 保护、约定每任务一分支 `w1/xxx`。
2. 通读 `D:\cyc\project\octo\test2\gts-autin-coder\` 全部源码（SKILL.md + scripts/）。

## 步骤

### T1 P0 技术验证（半天，阶段门）
1. 按 tasks/W2 卡片的 M0 规范手工迁移 GButton 一个组件（可让 AI 做，你人工过目）。
2. 用 gts-autin-coder 的 init.mjs 起一个测试工作区，把迁移后的 GButton.vue 拷进 src/components/basic/GButton/，写一个引用它的 stub 页面。
3. build.mjs 编译 + 浏览器打开 index.gts.html 确认渲染。
4. **产出验证结论**回填本文件末尾「结论区」：sfc-loader 对内联 less/纯 JS SFC 的兼容性；资产库 element-plus.css 桥接与 EP 2.13.5 的变量 diff 结果。这决定 W4 文档写法——结论未出，W4 的 D1/D2 不要开工。
5. commit + push 分支。

### T2 工具链合入 + 去 gts 化（半天）
- 复制 gts-autin-coder 的 `scripts/{init,build,build-data,serve}.mjs`、`scripts/preview/`、`scripts/verify/` 到 `skills/generate-ux-prototype/scripts/`。
- 全量改名：`index.gts.html` → `index.html`；`data-gts-theme` → `data-theme`；删除 gts-bridge.css / gts-default.css / dark.less / gts 字体；代码与输出文案中 gts 字样清零（`grep -ri gts` 验证为 0 命中）。
- 目录重组：`preview/public/library/element-plus/`（UMD 归位）；`verify/whitelists/element-plus/`。

### T3 EP 2.13.5（1 小时）
- 从官方 dist（npm 包 element-plus@2.13.5 的 dist/index.full.min.js + dist/index.css + icons + zh-cn locale，或 CDN）替换 preview UMD 四件套。
- 按 2.13.5 重新导出三份白名单（components/icons/exports）。
- 决策点 C 已定：官方 dist；用户后续提供专属构建则替换。

### T4 init.mjs 改造（半天）
- 新增参数 `--assets-root <path>`（走 SKILL-REPLACE-PLAN.md §4.1 定位协议：包根 → asset-catalog.json → 库目录）。
- token 现取：`{assets}/frontend/element-plus/tokens/*.css`（含 components/ 子目录）glob 复制到工作区 `src/assets/tokens/`；生成 manifest 记录来源与版本。
- 生成 `src/api/{slug}.js` 适配层（内容：re-export mock，D16）。
- locales 改为 `src/locales/` 全局 common.json（跨页词条，初始为空对象）+ 页面 locales.js 由 AI 生成时自建（D15，init 不建页面级文件）。
- 输出保持 `RESULT: OK` + HTML_PATH + SRC_DIR + PAGE 协议。

### T5 build.mjs 改造（半天）
- token 存在性校验：启动时解析工作区 `src/assets/tokens/**/*.css` 提取全部 `--*` 定义名作为白名单（不再有内置速查表）。
- 删除 rem 换算提示与 px WARN（D14，px 合法）。
- 新增校验：`src/views/**` 与 `src/components/**` 禁止出现 `mock/modules` 的 import（D16，只能 import src/api/）。
- 白名单路径适配 `verify/whitelists/element-plus/`。

### T6 collect_component.mjs（2 小时）
- 用法：`node collect_component.mjs <assets-root> <component-id> <workspace-src> <target-dir>`。
- 逻辑：读 spec `components/specs/{id}.json` 定位 `GName.vue` → 正则解析相对 import（`from './x'`、`from '../GIcon/GIcon.vue'`）→ 递归闭包 → 按库内相对路径镜像复制到 target-dir → 每文件头插 `<!-- 源: g-design {version} {id} -->`。
- 只拷 `GName.vue`（index.ts/examples.vue 不拷，D20）。缺文件即报错列出缺失清单，不静默。

### T7 端到端验收（半天，需 W2 M2 + W3 N5 完成）
1. hybrid 模式生成一页（含 ≥2 个复用 G 组件）；free 模式生成一页。
2. 明暗主题切换（data-theme）、毛玻璃风格页、自定义皮肤插槽各验一次。
3. 二开演练：把 api/{slug}.js 从 re-export mock 改写为假 axios 实现，确认页面零改动可跑。
4. 全部通过 → 在 §13 打勾 T7 → 通知合并。

## 验收标准（W1 整体）
- `grep -ri gts skills/generate-ux-prototype/` 零命中
- T7 四项实测全过
- 所有 commit 走分支 + PR


---

## 结论回写区（执行中随时追加，每条带姓名+日期）

<!-- 格式：- [日期] (姓名/卡号) 结论或问题一句话；细节缩进展开。写完 commit 到本任务分支 -->

- [2026-09-12] (cyc/W1-T1) **T1 P0 技术验证通过**，两项结论如下：
  - **结论 1 — sfc-loader 兼容性 ✅**：按 component-format v1 迁移的 GButton（纯 JS `defineProps` 对象语法 + 内联 `<style lang="less" scoped>` + `:deep()`）在工作区中 init → build（`OK 1 page, 2 components`）→ 由 vue3-sfc-loader 正常识别为自定义组件并编译。P0 验证页 `tasks/p0-workspace/p0-verify/index.gts.html` 可直接打开确认渲染（含 G 组件与原生 EP 按钮对照、点击计数）。
  - **结论 2 — token 桥接与 EP 2.13.5 兼容性 ✅（附一个小修正项）**：资产库 `tokens/element-plus.css` 定义 97 个 `--el-*` 桥接变量，与官方 element-plus@2.13.5 dist/index.css（562 个变量）对比，仅 `--el-alert-title-color` / `--el-alert-description-color` 两个变量在 2.13.5 中不存在（2.10.4 中同样不存在——资产库定义的是自设语义变量，非 EP 官方变量；alert 组件在 2.x 中实际读取 `--el-alert-title-font-size` 等结构变量，文字颜色走通用文本变量）。**处理**：这两行对 EP 行为无影响（属无效但无害的赋值），迁移 107 组件时无需处理；W3 做 build_tokens 时保留原样即可，设计师下次更新 tokens.json 可顺手删。另：preview UMD 当前是 EP 2.10.4，T3 换 2.13.5 时按官方 dist 四件套替换，白名单需同步重导。
  - **W4 可开工**：D1/D2 文档所依赖的两个前置结论均已落定。
