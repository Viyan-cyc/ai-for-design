# 任务卡 W4 · 文档与协议

> 把本文件全文喂给你的 AI 会话，让它按步骤执行。完成后回到 SKILL-REPLACE-PLAN.md §13 打勾。

## 你的角色

你负责全部文档重写。事实源是 `SKILL-REPLACE-PLAN.md`（必读 §4 架构、§5.3、§6 模板定位、§7 毛玻璃、§9 全部决策、§13 分工）。你的产出会被 W1 的端到端验收引用，**开工前置：等 W1 的 T1 P0 验证结论**（写在 tasks/W1-mainline.md 末尾结论区）。

## 前置

- T0 基线提交后建分支 `w4/xxx`。
- 读 `D:\cyc\project\octo\test2\gts-autin-coder\SKILL.md`——W1 会把它改造合入，你是文档侧的对照源。

## 步骤

### D1 重写 `skills/generate-ux-prototype/SKILL.md`（半天，最重）
以 gts-autin-coder SKILL.md 的生成流程为骨架，重写为 generate-ux-prototype。结构大纲：

1. **frontmatter**：name 固定 `generate-ux-prototype`；description 更新（Vue 3 + Element Plus 2.13.5 源码交付 + 离线预览 + 资产库 token/组件复用）。
2. **技术栈**：Vue 3 `<script setup>` 纯 JS / EP 2.13.5 / Less / px 单位（D14，无 rem）/ Vue Router / 依赖白名单五项。（D22 修订：样式语言钉死 less，无开关；D21 的三开关方案改为两开关——组件复用 reuse/hybrid/free、UI 库 element-plus/SweetUI）
3. **资产库定位协议**（沿用原 skill：ASSETS_ROOT → asset-catalog.json → manifest/contract；agents/package-location.json 兜底）——skill 不存设计数据副本，运行时现取（§4.1）。
4. **生成流程**：需求/截图/HTML 四类输入解析 → 确认组件模式三档开关（§4.3：reuse 必须复用/hybrid 默认/free 全手写；记录到 views/{slug}/js/constants.js 的 COMPONENT_MODE）→ 模板参考（§6：选最近模板读源码提取布局骨架 + criticalInteractions + pageStates 作完备性清单，**配置驱动机制不再使用**）→ `node scripts/init.mjs` → hybrid/reuse 先用 query_assets.mjs 按 specs useWhen 匹配组件（命中 → collect_component.mjs 拷贝，未命中 → 手写并记 gap）→ 写码 → 自检清单 → build → 输出 artifact 链接。修改已生成页面走 Modification 流程不重新生成。
5. **代码规范引用**：细则全放 references/code-conventions.md（D2），SKILL.md 只留速查与硬规则索引。token 速查表**不内嵌**（D2 决策：从工作区 src/assets/tokens/ 现查，build 实时校验）。
6. **毛玻璃**（§7）：无特殊机制——需求涉及毛玻璃时按需读资产库 design/frosted-glass.md；token 随 assets/tokens/ 自动就位；视觉风格选择沿用原 skill 的主次/内容密度判断规则。
7. **UI Runtime 扩展点**：默认 element-plus；SweetUI 接入三件套（UMD 目录/白名单/桥接 CSS）预留，详见 references/ui-runtime.md。
8. **i18n**：每页 `views/{slug}/js/locales.js` 单文件双语言对象（D15），全局 common.json 仅跨页词条。
9. **mock 与 api 适配层**（D16）：页面只准 import `src/api/{slug}.js`，禁止 import mock/modules；mock 函数 REST 语义签名 + delay。
10. **速度条款**（D13①②④，i18n 项已被 D15 取代）：拆分触发式（>150 行/被复用/状态复杂才拆，页面 4-8 文件）；无依赖文件并行写；mock 混合策略（手写前 8-10 条 + 程序化扩展；截图输入保真转录不变）。

### D2 `references/code-conventions.md`（半天）
从 gts-autin-coder SKILL.md 的「页面代码规范 / Mock API 模式 / i18n 模式 / 运行时错误预防 / 附录 A」改写：
- 去 gts 化：token 速查表整节删除，改为「token 全集见工作区 src/assets/tokens/*.css，build 校验兜底」；data-gts-theme → data-theme。
- rem 换算表删除，单位 px（D14）。
- i18n 节改写为 locales.js 单文件模式（D15）。
- 新增「api 适配层约定」节（D16，含正确/错误 import 对照示例）。
- 新增「复用 G 组件约定」节：collect_component.mjs 用法、落位 `src/components/{basic|business|complex}/`（D17）、来源注释、禁止改写拷入的组件文件。
- 相对路径计算表按新目录结构（含 api/、tokens/）重算。
- 高频错误预防表：删 token 名错的 gts 示例与 rem 条目，加「import mock 违规」「直接改拷入的 G 组件」两条。
- 新增「二开依赖差异」节（D22）：真实工程 devDependency 固定为 `npm i -D less`（Vite 零配置，main.js import base.less）；src/api/{slug}.js 二开态用 `import ... from + export { }` 两段式而非 re-export 简写（sfc-loader 0.9.5 re-export 缺陷经验，见 W1-T3 回写）。

### D3 `references/ui-runtime.md`（1 小时）
三件套接入说明：`preview/public/library/{runtime}/` UMD 目录规范、`verify/whitelists/{runtime}/` 白名单格式（三份 JSON 的 schema 直接引用现有 element-plus 文件为例）、token 桥接 CSS 要求（语义 token → 该 UI 库变量，参照资产库 element-plus.css 的做法）。SweetUI 接入时照此办理。明确 EP 2.13.5 为当前唯一 runtime。

### D4 周边四文件（2 小时）
- `skill-catalog.json`：generate-ux-prototype 的 outputs 改为「Vue 3 源码工作区（views/components/api/mock/locales）+ 零构建离线预览 + 验证记录」；description 同步。
- `AI-ENTRY.md`：第 9 行任务路由描述改为源码交付表述。
- `workflow.md`：原型阶段交接重写——删除 freeze_design_handoff/来源锁概念，改为「工作区交付 + api 适配层 + 二开说明」；跨阶段产物（requirements.json/insights.json）引用不变。
- `README.md`：安装/使用命令 node 化（与 W3 N3/N5 协调，N5 删 .py 前可先写 node 形式并注明过渡）；技术栈声明 EP 2.13.5 + 仅依赖 Node。

### D5 一致性自检（1 小时）
- `grep -ri gts *.md skills/*/SKILL.md skills/*/references/` 零命中（SKILL-REPLACE-PLAN.md 历史记录除外）。
- SKILL.md 中提到的每个脚本/文件名实际存在（W1 产出 init.mjs/build.mjs/collect_component.mjs/query_assets.mjs 路径逐一核对）。
- skill-catalog.json 的 entry/outputs 与实际文件对得上。
- 交叉审：把 D1/D2 给 W1 的人读一遍，流程描述与脚本实际行为一致才打勾。

## 验收标准
- D5 自检三条全过
- SKILL.md 十节齐全且与 §9 决策零冲突
- 所有文档 EP 版本号统一 2.13.5、单位口径统一 px


---

## 结论回写区（执行中随时追加，每条带姓名+日期）

<!-- 格式：- [日期] (姓名/卡号) 结论或问题一句话；细节缩进展开。写完 commit 到本任务分支 -->

- [2026-09-12] (cyc/W4-D1~D5) **D1-D5 全部完成**（分支 w4/d1-d5-docs）：
  - **D1 SKILL.md 重写**：十节齐全（frontmatter/技术栈/定位协议/生成选项/生成流程 8 步/修改流程/换肤/毛玻璃/UI Runtime/i18n/mock-api/速度条款/速查）。与 §9 决策逐条对照：D12 三开关中两开关落地（组件复用 reuse/hybrid/free + UI 库固定 element-plus；D22 样式语言固定 less 无开关）、D13①②④、D14 px、D15 locales.js、D16 api 适配层、D2/D4/D6/D8/D9/D17/D20/D22 全部体现；token 速查表不内嵌（D2 决策）。白名单数字按实测写 116/130/295（原卡草稿的 121/293 是 gts-autin-coder 旧值）。
  - **D2 code-conventions.md**：11 节；api 两段式二开写法（W1-T3 结论）、G 组件复用约定（collect 用法/落位/垫片说明/禁止改写）、路径计算表按新结构（api/、tokens/、组件分类落位）重算、高频错误表含「import mock 违规」「直接改拷入 G 组件」「scss」三条新增、二开依赖差异节（npm i -D less + 两段式 + 垫片可删）。
  - **D3 ui-runtime.md**：三件套表（UMD 目录/白名单格式/桥接 CSS 要求）+ SweetUI 五步接入清单；白名单 schema 以现有 element-plus 三份 JSON 为例。
  - **D4 周边文件**：skill-catalog.json（generate-ux-prototype description/outputs 改源码交付表述）、AI-ENTRY.md（第 9 行源码交付表述 + query_assets.py→.mjs）、workflow.md（原型阶段交接重写：工作区交付 + api 适配层边界 + 二开说明；freeze/来源锁/handoff 脚本概念清除，跨阶段 requirements/insights 引用不变）、README.md（安装/验证/发布命令全 node 化 + 「仅 Node ≥18」依赖声明 + EP 2.13.5 + N5 过渡说明）。
  - **D5 自检四条全过**：① grep -ri gts（*.md + skills 全部 SKILL.md/references，除方案文档）零命中；② SKILL.md 提到的脚本/文件逐一存在（package-location.json 为安装时生成物，包内本就不存在，已如实写明）；③ skill-catalog entry/outputs 核对；④ 全部文档 EP 版本号统一 2.13.5、单位口径统一 px。`node tests/validate_package.mjs` 10/10 PASS（含 init/build 冒烟）。
  - **交叉审代做说明**：D1/D2 的流程描述逐条对照脚本源码（init/build/collect/serve 全部实测：CLI 参数、输出协议行、白名单数、来源注释格式、垫片行为）+ validate_package 冒烟；**请 W1（cyc）在 PR 评审时终审**。
- [2026-09-12] (cyc/W4) **三个发现（均不阻塞本卡，归属 W1/W3 裁量）**：
  1. **init.mjs 头注释与实际不符（W1）**：init.mjs 第 25 行注释声称生成 `src/README.md`（接入说明），但 preview 模板中无此文件、init 也不写它（实测 init 产物 src/ 下无 README）。文档侧已规避——workflow.md 二开说明改为引用 `src/api/{slug}.js` 文件头 + code-conventions「二开依赖差异」。建议 W1 二选一：补一个真模板 src/README.md（对二开者更友好），或删掉该行注释。
  2. **init starter 双语言对象直接插值（W1，轻微）**：starter index.vue 用 `{{ t.title }}`，而 locales.js 的 t.title 是 `{zh,en}` 对象，单独打开 starter 预览会显示 `{"zh":"…","en":"…"}`。AI 生成时会整体替换 starter、不影响交付，但 starter 自身展示异常。建议改 `{{ t.title.zh }}`（code-conventions i18n 节已按 `.zh` 写法示范）。
  3. **component-plan.schema.json 成为孤儿（W3）**：validate_package.mjs 的 required 清单仍要求 `references/component-plan.schema.json`（旧配置驱动模式的 schema，新流程已废弃）。本次保留该文件未删以满足校验；usage.md/SKILL.md 已不再引用它（task-handoff.schema.json 仍被 workflow.md 交接流程引用，保留）。建议 W3 N5 时从 required 清单移除并删除该文件。
