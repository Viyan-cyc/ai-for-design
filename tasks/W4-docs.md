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
2. **技术栈**：Vue 3 `<script setup>` 纯 JS / EP 2.13.5 / Less / px 单位（D14，无 rem）/ Vue Router / 依赖白名单五项。
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
