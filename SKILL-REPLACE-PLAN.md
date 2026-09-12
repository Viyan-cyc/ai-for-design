# generate-ux-prototype 替换方案 · 决策记录

> 本文档持久化 2026-09-12 关于「用 gts-autin-coder 源码交付方案替换 generate-ux-prototype」的完整讨论与结论。
> **用途**：防止上下文压缩丢失记忆；后续讨论请先读本文件。
> **维护规则**：§9 决策日志 append-only，新决策追加不覆写；方案定稿变化时同步更新 §4-§8 正文并在 §9 记一行。
> **⚠️ 给所有执行本仓库任务的 AI 会话（小伙伴的 AI 必读）**：
> 1. 开工前按顺序读完三样：本文件全文 → 你领到的 `tasks/W*.md` 任务卡 → 该卡标注的必读章节。
> 2. **回写义务**：执行中每发现验证结论、方案缺陷、或与文档不符的现状，必须当场追加到任务卡末尾「结论回写区」（格式：`- [日期] (姓名/卡号) 一句话结论`，细节缩进展开），并 commit 到本任务分支。这不是可选项——你的结论是其他工作流（尤其 W4 文档）的前置输入。
> 3. **打勾义务**：任务完成 → 把 SKILL-REPLACE-PLAN.md §13 对应项 `[ ]` 改 `[x]` 并追加 `(姓名/日期)` → 随 PR 一起提交。
> 4. **决策纪律**：发现需要改方案/契约时，不要自行改 SKILL-REPLACE-PLAN.md 的正文与决策日志——写回写区并标注「需拍板」，由用户在 Claude Code 会话说「检查回写」后统一裁决。任务卡内的执行细节你可以自主决定。
> 5. **禁止越界**：只改你工作流所有权内的文件（§13 并行协同机制第 2 条）。`SKILL-REPLACE-PLAN.md` 除 §13 打勾外全员只读。

---

## 1. 背景与目标

- **本工程**（ai-for-design）：AI for G Design V1.5，四个 Skill 共享一个企业设计资产库（`assets/g-design-enterprise-v1.5.0/`，下称"资产库"）。四个 Skill：extract-structured-requirements（需求提取）、derive-experience-insights（体验分析）、**generate-ux-prototype（本次替换目标）**、manage-design-assets（资产维护）。
- **gts-autin-coder**（`D:\cyc\project\octo\test2\gts-autin-coder`）：用户自写的页面生成 Skill，交付真实 Vue 3 + Element Plus 源码（.vue SFC），带零构建离线预览。
- **动机**：现 generate-ux-prototype 是"配置驱动 + 来源锁"模式（AI 只改业务配置 JSON，页面结构被锁定），设计师出品。用户是前端工程师，要换成"AI 写真实源码"模式。
- **关键交付要求**：生成的代码要给**他人二次开发**、对接数据、上线。所以代码必须是标准、可读、无 AI 特殊机制的普通 Vue 工程。

## 2. 用户需求清单

### 第一轮（原始 8 条）

1. AI 写 Element Plus 代码；后续要支持 SweetUI（用户自己的组件库，类似 Element UI，后续提供 UMD）——**留口子，本次不接入**。
2. gts-autin-coder 里的规范/token 都是示例，**废弃**；只用资产包里的 token 和规范，但保留换肤能力。只保留 G Design token 体系。
3. gts-autin-coder 约定了 AI 写组件的规范（mock、i18n、组件拆分、目录）。复用 G 组件时需要改造库代码约定吗？
4. G 组件复用落位：**不设强制 shared/ 目录**，按 gts-autin-coder 约定（views/ 或 components/），AI 按业务自判；复用组件要和 AI 手写 EP 代码完全同构。
5. 询问 6 套页面模板的定位。
6. **Python 脚本全删**（设计师生成，不懂代码），工具链统一按 gts-autin-coder 的 Node 来。
7. **不保留任何 gts 相关字样**。
8. 毛玻璃是 assets 里的，**必须支持**。设计师会持续更新规范/token/组件，**要能快速升级迭代**。

### 第二轮（补充 5 条）

1. 二次开发友好性是硬要求；用户**可以让设计师按要求格式改造组件库**，后续新组件都按规定格式写，目标是方便二次开发、不增加开发成本。
2. 6 套页面模板保留与否要明确方案。
3. 毛玻璃本质上不就是 token + 规范的一种吗？
4. 「skill 目录外的连带改动」需要解释清楚。
5. 本讨论全程持久化到本工程（即本文件）。

### 已确认的硬性参数

- Element Plus 版本钉死 **2.13.5**。
- Skill 名保留 **generate-ux-prototype** 不变。

## 3. 现状调研结论（已核实源码）

### 3.1 generate-ux-prototype 现状

- 位置 `skills/generate-ux-prototype/`：SKILL.md + references/（plan schema、handoff schema、usage.md）+ scripts/（5 个 Python，357 行）。
- 核心流程：AI 产出 component-plan.json → `resolve_source_assets.py` 从资产库**复制锁定文件副本** → AI 只能改一个业务配置 JSON → `validate_source_draft.py` 做 SHA256 来源锁校验 → npm build。
- AI **不写组件代码**，这是要被替换的根本。

### 3.2 gts-autin-coder 现状

- SKILL.md（核心约定）+ scripts/（init.mjs / build.mjs / build-data.mjs / serve.mjs / preview/ / verify/）。
- 交付：`{slug}/src/` 工作区（views/、components/、mock/、locales/、router/ 等），零构建预览 `index.gts.html`（vue3-sfc-loader + UMD）。
- 校验：build.mjs 用 @vue/compiler-sfc 编译 + el-* 白名单(121) + 图标白名单(293) + 导出白名单 + 裸依赖白名单(5 项) + token 存在性 + 样式卫生 + px 检查。
- 代码约定：`<script setup>` 纯 JS、`<style lang="less" scoped>`、rem（根字体 10px，px/10=rem）、mock 层、i18n、组件颗粒度小、index.vue 只做组合层。

### 3.3 资产库关键发现（决定方案简化度）

- **token 是 4 层完整体系**（`frontend/element-plus/tokens/`）：
  1. `primitive.css` — 基础色板（--red-50 等）
  2. `semantic-light.css` / `semantic-dark.css` — `--color-*` 语义层，换肤协议为 **`data-theme="light|dark"`** 属性
  3. `component.css` — `--g-*` 组件兼容层（--g-bg-surface、--g-text-primary 等）
  4. `element-plus.css` / `element-plus.scss` — **EP 变量桥接已由设计师做好**（--el-color-primary 等映射）
  - 另有 glass.css、frosted.css、frost-decoration.css、charts.css、code.css、components/ 分组。
  - **结论：gts-autin-coder 的 `--gts-*` 体系 + gts-bridge.css 三层全部可删，直接用资产库体系。**
- **G 组件现状格式**（107 个 .vue，basic/business/complex 三类）：每组件一目录 `GName/{GName.vue, types.ts, style.scss, index.ts, examples.vue}`；`<script setup lang="ts">` + 外链 `<style scoped src="./style.scss">` + TS 类型文件。部分组件文案硬编码中文（如 GFilterBar 的"重置/查询"）。样式用 token 变量（--g-*、--space-*、--color-*），无 hex 硬编码。
- **6 套页面模板**：`components/templates/*.json`（standard-list-page、device-management-page、edit-form-page、object-detail-page、topology-monitoring-page、alarm-impact-page）+ `src/page-templates/` 源码。配置驱动整页（PageStateShell 六种页面态 + patterns/ListContent 等），JSON 里声明 criticalInteractions（搜索/分页/批量等）、pageStates、visualStyles。
- **毛玻璃**：token 文件（glass/frosted/frost-decoration）+ 规范文档 `design/frosted-glass.md`（含"色块装饰"使用规则、frost-decoration 分组）。**没有特殊机制，就是 token + 规范文档**。

## 4. 最终架构方案（定稿）

### 4.1 核心原则

**skill 目录不存放任何设计数据副本**。SKILL.md 只写流程和约定；token、组件规范、模板源码、毛玻璃规则全部在生成时通过资产库定位协议（`ASSETS_ROOT` → `asset-catalog.json` → manifest/contract，协议沿用原 skill）现取。
→ 设计师发新版资产库，下一次生成自动生效，skill 零改动（满足需求 8 快速迭代）。

### 4.2 目标目录结构

```
skills/generate-ux-prototype/          # 名字不变
├── SKILL.md                           # 重写：生成流程主干 + 组件模式开关
│                                      #   + 资产库定位协议 + UI Runtime 扩展点
├── agents/openai.yaml                 # 保留
├── references/
│   ├── code-conventions.md            # 原 gts-autin-coder 代码规范/mock/i18n/目录约定（去 gts 化改写）
│   ├── component-format.md            # 《组件库改造规范》（给设计师，见 §5）
│   └── ui-runtime.md                  # EP / SweetUI 接入说明（预留口子）
└── scripts/
    ├── init.mjs                       # 改造：+ASSETS_ROOT 参数；token 从资产库现取复制
    ├── build.mjs                      # 改造：token 校验来源改为工作区 token CSS 实时提取
    ├── build-data.mjs / serve.mjs     # 保留微调
    ├── collect_component.mjs          # 新增：G 组件闭包复制（读相对 import 递归拷贝 .vue）
    ├── preview/                       # 运行时（loader、router、UMD 按 element-plus/ 子目录组织）
    └── verify/whitelists/element-plus/…

# 生成出的工作区（交付件，二次开发者拿到的就是它）
{slug}/
├── index.html                         # 原 index.gts.html，去 gts 化
├── mock/modules/{slug}.js
├── public/library/element-plus/…      # EP 2.13.5 UMD
└── src/
    ├── assets/tokens/                 # ★ init 时从 ASSETS_ROOT 现取（4 层 token 全套，glob 复制）
    ├── assets/{fonts,style,uploads,images}/
    ├── locales/  router/  main.js  App.vue
    ├── api/{slug}.js                   # 接口适配层（D16）：原型态 re-export mock；二开时替换为真实请求，页面零改动
    ├── components/                    # 复用 G 组件按约定落位（AI 按业务自判）
    └── views/{slug}/…
```

### 4.3 组件模式三档开关（核心新需求）

生成开始时确认，记录在工作区常量（如 `views/{slug}/js/constants.js` 的 `COMPONENT_MODE`）：

| 模式 | 行为 |
|---|---|
| `reuse` | 命中库组件**必须**复用；未命中记 gap 并告知用户 |
| `hybrid`（默认） | 先按 specs/g-*.json 的 useWhen 语义匹配；命中→复制复用，未命中→AI 手写 |
| `free` | 跳过匹配，全部 AI 手写（只守 token + 代码规范约束） |

### 4.4 UI Runtime 扩展点（SweetUI 预留，需求 1）

按"UI 库"为单位组织三样东西，接入 SweetUI = 补三样，架构不动：

- `scripts/preview/public/library/element-plus/…`（UMD）→ 将来加 `sweet-ui/…`
- `scripts/verify/whitelists/element-plus/*.json` → 将来加 `sweet-ui/*.json`
- token 桥接：资产库已有 EP 桥接；SweetUI 接入时写一份 SweetUI 变量桥接 CSS

SKILL.md 增加"UI Runtime 选择"步骤（默认 element-plus，用户可指定）。

### 4.5 去 gts 化改名清单（需求 7）

| 原名 | 改为 |
|---|---|
| `index.gts.html` | `index.html` |
| `data-gts-theme` | `data-theme`（与资产库协议一致） |
| `--gts-*` token | 资产库 `--g-*` / `--color-*` 体系 |
| `gts-bridge.css` / `gts-default.css` / `gts-{name}.css` | 删除 / 资产库 token CSS 取代 / `theme-{name}.css`（自定义皮肤插槽保留） |
| SKILL.md、build/verify 输出文案中的 gts 字样 | 全部清除 |

### 4.6 换肤能力（需求 2）

- 工作区加载资产库 token CSS（4 层全套），换肤协议 = 资产库自己的 `data-theme="light|dark"`。
- 运行时切换：`document.documentElement.setAttribute('data-theme', …)`。
- 自定义皮肤插槽保留（`theme-{name}.css`）。
- **token 速查表不再内嵌进 SKILL.md**（会随设计师更新腐烂）；build 的 token 存在性校验从工作区已复制的 token CSS 实时提取定义。

## 5. 组件复用方案（第三轮定稿：库端改造）

### 5.1 「闭包」是什么（问题澄清）

闭包 = 复用一个组件时实际需要的**全部文件集合**（含传递依赖）。
例：现在拷 `GButton/GButton.vue` 单文件会报错，因为它还引用同目录 `types.ts` 和 `style.scss`；复杂组件（如 GDataTablePro）还 import 其他 G 组件，缺一层就崩。
- 旧方案（消费时适配）：AI 拷贝时顺路改写引用/内联样式 —— 对二次开发者不可见、质量不可控。
- 新方案（库端改造，本轮定稿）：设计师把库改造成单文件自包含格式后，闭包退化为"拷 N 个 .vue"，N 由相对 import 递归数出；AI 只做拷贝 + 加来源注释，**零改写**。

### 5.2 结论

**改造资产库，而不是让 AI 消费时适配。** 理由：
- 二次开发者拿到的组件与 AI 手写的完全同构、无 AI 痕迹（满足需求 4 与"方便二次开发"）。
- 库源只有一种格式，无双轨维护；设计师新组件按规范直接写。
- AI 适配质量波动风险归零。

### 5.3 《组件库改造规范 v1》（给设计师的要求）

1. **目录**：`components/{basic|business|complex}/GName/` 下仅 `GName.vue` + 可选 `examples.vue`（典型用法示例，供 AI 学习匹配，不随拷贝交付）。禁止 types.ts / style.scss / index.ts。
2. **SFC 自包含**：template + `<script setup>` + `<style lang="less" scoped>` 全部内联；禁止外部样式文件、禁止 @import。
3. **Script 纯 JS**：无 TS 标注；props 用 JS 对象语法 `defineProps({ type: { type: String, default: 'default' } })`；emits 用 `defineEmits(['search','reset'])`。
4. **文案**：组件内可见文案走 props/slot 默认值（中文默认、页面可覆盖）；组件内部**不引入 i18n 机制**（保持零依赖）；页面级文案仍走工作区 i18n 约定。
5. **依赖白名单**：仅 vue / element-plus / @element-plus/icons-vue / dayjs + 相对路径的其他 G 组件。
6. **样式**：颜色/圆角/间距一律库 token 变量（--g-*、--color-*、--space-*）；禁 hex、禁内联 style；尺寸单位直接用 px（D14，与页面单位策略一致）。
7. **数据**：纯受控组件 + 事件，不拉数据、不引 mock。
8. **复用拷贝时**：AI 在文件头加一行来源注释（如 `<!-- 源: g-design v1.5.0 g-button -->`），便于二次开发者识别与后续升级 diff。

### 5.4 存量迁移

107 个存量组件一次性迁移：可写 codemod 脚本批量转换（去 TS、内联单行 scss、props 改对象语法）+ 人工抽查；之后新组件按规范直接写。（实施阶段可由 AI 生成迁移脚本。）

### 5.5 对二次开发者的友好性（本轮核心关切）

最终交付物 = 一个标准 Vue 3 + Element Plus 工程：所有组件（复用/手写）风格统一、相对路径 import、无 TS/外部样式/barrel、无锁、无特殊机制；对接数据 = 把 mock 层换成 api 层调用（工作区已预留 api/ 目录约定）。

## 6. 页面模板方案：保留，角色改为「结构参考 + 完备性清单」

**保留在资产库，不改造、不参与生成流程的锁定/复制。**

- AI 生成页面前：选最接近的模板 → 读其 .vue 源码 + JSON → 提取布局骨架、criticalInteractions 交互清单、pageStates 状态清单 → 作为**结构与完备性对照清单**，然后按工作区代码规范自由写码。
- 理由：模板沉淀了交互完备性与页面态处理（loading/empty/error/forbidden/partial/ready），是生成"可上线级"页面的宝贵清单；改造成可运行成本高且与代码约定冲突；只读参考零维护成本。
- 口子：未来设计师若想让模板直接出码，再升级为"模板也按组件规范改造"（见 §10 决策点 D）。

## 7. 毛玻璃方案：无需特殊机制

用户判断正确——**它就是 token + 规范的一种**：

- token 文件（glass.css / frosted.css / frost-decoration.css）随 §4.2 的 token glob 复制自动进工作区，设计师新增/更新自动跟随。
- 使用规范文档 `design/frosted-glass.md`（何时用/不用、frost-decoration 分组、主次与内容密度规则）由 SKILL.md 写明"视觉风格涉及毛玻璃时按需读取"。
- 方案里不建任何毛玻璃专属代码路径。上一轮表述使其显得特殊，作废。

## 8. skill 目录外的连带改动（实施时必须一起改）

这些文件不在 skill 内，但引用了将被删除/变更的东西，不改就会坏：

1. **`tests/validate_package.py`（第 8-10 行）**：直接 import 将被删除的 Python 脚本 `resolve_source_assets` / `validate_source_draft`。→ 重写该测试：改为校验新 skill 结构（文件存在性、SKILL.md 约定）+ 跑一次 `node build.mjs` 冒烟。
2. **`skill-catalog.json`**：generate-ux-prototype 条目的 outputs 描述是旧模式（"可运行原型、配置、来源及验证记录"）。→ 改为"Vue 源码 + 离线预览"等新描述；id/entry 不动。
3. **`workflow.md`**：跨阶段交接流程引用 freeze_design_handoff.py 和来源锁概念。→ 重写原型阶段的交接描述。
4. **`AI-ENTRY.md`**：任务路由表格中对 generate-ux-prototype 的描述微调。

## 9. 决策日志（append-only）

- **2026-09-12 D1**：确定替换方向——以 gts-autin-coder 运行时为主干，资产库降级为"运行时现取的资源"，废弃配置驱动 + 来源锁模式。
- **2026-09-12 D2**：废弃 `--gts-*` token/桥接/皮肤三层，直接采用资产库 4 层 token 体系（`data-theme` 换肤协议）。skill 不内嵌 token 速查表，build 时从工作区 token CSS 实时提取校验。
- **2026-09-12 D3**：组件模式三档开关 reuse / hybrid（默认）/ free，SKILL.md 协议层实现，状态记录进工作区常量。
- **2026-09-12 D4**：UI Runtime 扩展点设计（UMD 目录 / 白名单 / 桥接 CSS 三件套按 UI 库组织），SweetUI 本次只留口子。
- **2026-09-12 D5**：Element Plus 钉死 2.13.5（UMD 文件替换 + 三份白名单刷新）。
- **2026-09-12 D6**：Python 脚本（resolve/validate/freeze/handoff/locator）全删，工具链统一 Node；资产库内部脚本（query_assets.py 等）保留不动（设计师维护用）。→ **后被 D18 扩大为全工程 Node 化**（含资产库脚本、安装器、测试），D6 此条仅存档。
- **2026-09-12 D7**：~~消费时适配~~ → **库端改造**（第二轮推翻第一轮）：设计师按《组件库改造规范 v1》改造组件库，复用 = 纯拷贝 + 来源注释，零改写。存量 107 组件一次性 codemod 迁移。
- **2026-09-12 D8**：6 套页面模板保留为"结构参考 + 交互完备性清单"，不改造不运行。
- **2026-09-12 D9**：毛玻璃无特殊机制 = token 自动跟随 + 规范文档按需读。
- **2026-09-12 D10**：全量去 gts 化（文件名/属性名/token 前缀/文案）。
- **2026-09-12 D11**：复用组件落位不设 shared/，按工作区约定由 AI 按业务自判（views/{slug}/components/ 或 src/components/）。
- **2026-09-12 D12**：collect_component.mjs 定位明确——单文件库格式下做"解析相对 import → 递归闭包 → 按库内相对路径镜像复制到 AI 指定目标根 + 文件头来源注释"，替代 AI 手工多轮读写（省 token 与往返）。
- **2026-09-12 D13**：生成速度优化四项——①拆分规则由"一个 UI 区块一个文件"改为触发式（>150 行 / 被复用 / 独立状态复杂才拆，页面约 4-8 文件）；②SKILL.md 明确无依赖文件并行写；③i18n 降级按需（默认页面内 t 对象，locales/ 全局文件仅用户要求时生成）；④mock 数据混合策略（前 8-10 条手写保多样性，其余 spread/生成器扩展；截图输入保真规则不变）。build/verify/init 本身毫秒级，不优化。
- **2026-09-12 D14**：单位策略定为"全 px 先行"——页面与 G 组件 token（--space-* 本为 px）天然一致，设计师 token 零改动；删除 rem 换算与 px WARN 检查；rem 留作二次开发工程 postcss-pxtorem 升级路径。决策点 A 关闭，风险 4 解除。
- **2026-09-12 D15**：i18n 保留（推翻 D13③ 的"按需降级"）。init 仍建 locales/ 全局结构；页面文本收敛为每页一个 `views/{slug}/js/locales.js` 单文件双语言对象（zh-CN + en-US 一次工具调用写完，en 由 AI 机械翻译顺带产出），模板经 `t.xxx` 引用；全局 common.json 仅存跨页共享词条（按需追加）；将来需 vue-i18n 时把两个对象拆进 JSON 即可，页面模板零改动。
- **2026-09-12 D16**：mock→接口交换协议（gts-autin-coder 约定变更：原为页面直接 import mock）：页面一律从 `src/api/{slug}.js` 适配层 import；原型态该文件仅一行 re-export mock/modules/{slug}；mock 函数按 REST 语义设计签名（如 fetchList({keyword,page,pageSize}) → Promise.resolve({list,total})，页面消费形状，含 delay 模拟网络）；二次开发 = 只改 api 文件内容（导出名/参数/返回形状不变），页面零改动。D13④ 混合策略含义澄清：仅是 mock 数据编写技巧（手写前 8-10 条保状态多样性 + 程序化扩展数量省输出），与交换机制无关，继续执行。
- **2026-09-12 D17**：决策点 B 定稿方案一——复用 G 组件落位 `src/components/{basic|business|complex}/`，与资产库分类名一致，溯源与升级 diff 友好。B 关闭。剩余待决策：C（EP 2.13.5 UMD 来源，实施时定）、D（模板未来是否升级出码，不急）。
- **2026-09-12 D18**：**全工程 Node 化**（用户确认设计师配合，推翻"不重写设计师生态"的保守边界）。范围：资产库 8 个脚本（query/build_tokens/build_indexes/validate_library/refresh_release/asset_graph/schema_tools/export_icons → .mjs）、顶层 build_release.mjs、installer/install_skills.mjs、测试 validate_package/validate_coordination → .mjs、全部文档 python3 命令改 node。依据：全工程 Python 仅 ~410 行且纯标准库，1:1 机械移植；设计师本就依赖 Node（组件库 npm 构建），单运行时对所有人是减法。实施约束：①迁移期双实现并存，同一资产库跑旧/新 diff 产出逐字节一致后才删 .py（build_tokens 模板绑定与 validate_library 锁校验为重点对照）；②token CSS 生成头注释变化 → protectedFiles 哈希变化 → 走一次 build_release --version 1.5.1 重新锁哈希；③主链路 query_assets.mjs 优先落地。
- **2026-09-12 D19**：3-4 人并行协同改造，按四条工作流分工（W1 主链路 / W2 组件库 / W3 Node 化 / W4 文档收尾），接口契约先冻结（组件格式规范 + skill 脚本 CLI 约定）后并行；todolist 与打勾状态维护在本文件 §13。协同前置：仓库当前零提交，必须先建基线提交。
- **2026-09-12 D20**：协同执行方式 = 四张自包含任务卡（tasks/W1-W4）由各成员直接喂给自己的 AI 会话执行，用户自领 W1；§5.3 第 1 条修正——types.ts / style.scss 必须消除，但 per-component index.ts 与 barrel index.ts **保留**（兼容 npm run build:library），复用拷贝只取 GName.vue。同日决策点 C 定稿：EP 2.13.5 取官方 dist（npm/CDN），用户后续可提供则优先。
- **2026-09-12 D21**：新增原型选项「样式语言 STYLE_LANG」（用户提出）。原型工作区统一一种语言，不混用；取值 `scss`（默认）| `less`，由 init `--style-lang` 参数指定，记录在 views/{slug}/js/constants.js。默认 scss 的理由：源 G 组件样式本就是 style.scss（D7 钉死 less 是跟随 gts 约定，现回归资产库生态），W2 codemod 迁移近零转换；token 层不受影响（预览走平铺 index.css，与预处理器解耦）。实施归 W1 新增 T8（sass UMD 编译器 + init 参数 + 模板/规范双版本 + build 校验 lang 与 STYLE_LANG 一致），须在 W2-M1 codemod 开工前完成；W2 M0 规范第 2 条改为「跟随 STYLE_LANG」，W4 D1 SKILL.md 增「原型生成选项」节（组件模式/UI 库/样式语言三开关统一呈现）、D2 写二开依赖差异（scss→npm i -D sass，less→npm i -D less，Vite 零配置）。

- **2026-09-12 D22**：样式语言钉死 **less**，D21 作废（T8 交付即废弃）。原因：产品线二次开发硬要求必须是 less；若组件库/模板走 scss，二开拷贝组件时会出现 scss 与 less 并行。全链路（组件库资产 M0 规范、原型模板、预览编译、build 校验）只剩 less 一种语言。影响面：① W2 M0 第 2 条 / M1 转换条款改回 less（源 .scss 内容为扁平规则直接贴入）；② W4 D1 三开关改两开关（组件复用、UI 库），D2 二开依赖固定 npm i -D less；③ W1 T8 已交付的 init --style-lang 参数、sass.browser.js/immutable.js、base.scss、build 1b 双语言校验需回退为 less 单语言形态（无需再支持 scss）；④ T6 collect_component 不受影响（只搬 .vue 不碰样式语言）。

## 10. 待决策点

| # | 问题 | 选项与推荐 |
|---|---|---|
| A | ~~尺寸单位~~ **已决（D14）：全 px 先行**。G 组件 token 本为 px，页面统一 px，单位天然一致；rem 留作二次开发工程 postcss-pxtorem 升级路径。 | 已关闭。 |
| B | ~~复用 G 组件落位子目录~~ **已决（D17）：方案一** `src/components/{basic|business|complex}/`，与资产库分类名一致。 | 已关闭。 |
| C | ~~EP 2.13.5 UMD 来源~~ **已决（T3，commit 1a5f66c）：官方 npm dist**（dist 五件套 + icons 2.3.2 + dayjs 1.11.19）。 | 已关闭。 |
| D | 模板是否未来升级为"可直接出码" | 本次只读参考；未来按组件规范改造模板后可升级。暂不决策。 |

## 11. 实施清单与顺序

1. **P0 技术验证**：迁移 GButton 单组件 → init → 拷贝复用 → build → 预览跑通（验证 vue3-sfc-loader 兼容性与 token 桥接）。
2. 输出《组件库改造规范 v1》给设计师；存量 107 组件 codemod 迁移 + 人工抽查（可与后续步骤并行）。
3. 复制 gts-autin-coder 工具链进 skill，执行去 gts 化改名 + EP 2.13.5 UMD/白名单刷新，并落实速度优化四项（D13，i18n 项已被 D15 修正为单文件双语言）。
4. 改造 init.mjs（ASSETS_ROOT + token glob 现取 + api 适配层生成，D16）与 build.mjs（token 实时校验 + 删除 rem/px-WARN 规则，D14 + 页面禁 import mock 校验，D16）。
5. 新增 collect_component.mjs（相对 import 递归闭包复制，D12）。
6. 重写 SKILL.md + code-conventions.md + component-format.md + ui-runtime.md。
7. **全工程 Node 化（D18）**：资产库 8 脚本、build_release、installer、测试、文档命令——双实现 diff 对等后删 .py。
8. 处理 §8 四项外部耦合（validate_package 重写在第 7 步一并完成）。
9. 端到端验收：hybrid（含复用组件）与 free 各生成一页；明暗主题切换 + 毛玻璃风格 + 换肤实测；以"二次开发者视角"通读生成代码（api 层换接口演练）。

## 13. 协同分工 Todolist（D19）

> **打勾规则**：完成即把 `[ ]` 改 `[x]` 并在行尾追加 `(姓名/日期)`。每条任务 = 一个 PR，合入顺序见各 W 的依赖说明。
> **分支约定**：main 保护 + 每任务一分支 `w<编号>/<slug>`；本文件 §13 打勾由合入 PR 的人顺手更新，避免文档冲突。
> **关键串行点**：T0 基线提交 → 冻结契约（C1+C2）→ 各 W 并行 → W1 的 P1 验证（阶段门）→ 汇合 → T7 端到端。
> **回写规则（2026-09-12 补）**：执行中每发现方案问题/验证结论，AI 会话当场把结论写进任务卡末尾「结论回写区」，并 commit 到本任务分支。用户在 Claude Code 会话里说「检查回写」即触发汇总：Claude 读各卡结论区 → 更新本文件 §12 风险/§9 决策 → 回复待办。

### W1 主链路（1 人，最重，建议用户自领）

- [ ] T0 基线提交：全量文件首个 commit，建 main 保护、PR 流程约定 (前置：无任何依赖，立即做)
- [x] T1 P0 技术验证：迁移 GButton → init → 复用 → build → 预览跑通（产出：验证结论文档，回填风险 1/2 的结论）(cyc/2026-09-12，浏览器实测通过：GButton 事件计数正常)
- [x] T2 从 gts-autin-coder 复制工具链进 skill + 去 gts 化改名（index.gts.html→index.html、data-gts-theme→data-theme、输出文案清理）(cyc/2026-09-12，commit 3ef6db3：4 脚本重写+preview/verify 重组+5 个 .py 删除，grep -ri gts 零命中)
- [x] T3 EP 2.13.5 落地：preview UMD 替换 + verify/whitelists 三份白名单按 2.13.5 刷新（决策点 C：官方 npm dist。cyc/2026-09-12 commit 1a5f66c：官方 dist 五件套+白名单 116 组件/130 导出/295 图标；连带修复 3 个 preview 缺陷——token index.css 404、api 相对路径层级、sfc-loader 0.9.5 re-export 需预载 mock 模块。无头浏览器实测 token 主色 #0067D1 生效）
- [x] T4 init.mjs 改造：ASSETS_ROOT 参数 + token glob 现取复制 + api/{slug}.js 适配层生成（D16）+ locales.js 单文件模式（D15）(cyc/2026-09-12，随 T2 完成)
- [x] T5 build.mjs 改造：token 校验改为工作区 token CSS 实时提取 + 删 rem/px-WARN（D14）+ 页面禁 import mock 校验（D16）(cyc/2026-09-12，随 T2 完成，commit 3ef6db3)
- [ ] T6 collect_component.mjs：相对 import 递归闭包复制 + 来源注释（D12）
- [ ] T7 端到端验收：hybrid/free 各生成一页 + 明暗主题 + 毛玻璃 + 换肤 + 二开视角通读（依赖 W2 的 M2 迁移完成，是最终汇合点）
- [x] T8 STYLE_LANG 开关（D21）→ **已交付随即被 D22 作废**（cyc/2026-09-12：scss/less 双模曾全链路实测通过，见 W1 卡回写；当日产品线确定二开必须 less，D22 钉死单语言 less，T8 产物需回退）
- [ ] T9 D22 回退：init 删 --style-lang 参数与 base.scss、main.js 模板固定 import base.less、constants.js 删 STYLE_LANG、preview 删 sass.browser.js/immutable.js 与 scss/sass moduleCache 注册（保留 .scss handleModule 亦可删）、build 1b 改为「工作区禁止出现 .scss 与 lang="scss"」（D22：全链路只剩 less）

### W2 组件库改造（1 人，与设计师对接，建议第二人）

- [ ] M0 输出《组件库改造规范 v1》正式稿：以 §5.3 七条为基础扩写成独立文档 references/component-format.md，给设计师评审签字
- [ ] M1 codemod 迁移脚本：107 组件去 TS/内联 scss/props 对象语法，产出迁移报告（前后组件清单 diff）
- [ ] M2 存量迁移执行 + 人工抽查 ≥20 个复杂组件（business/complex 全查，basic 抽查）；**阻塞 W1 的 T7**，尽早启动
- [ ] M3 设计师新组件流程交付：给设计师的提交 checklist（按规范写 + 过 codemod 验证），确认后续新组件合规

### W3 Node 化（1 人，独立性强，可与 W1 并行）

- [ ] N1 迁移对照框架：跑旧 .py 与新 .mjs、diff 产出的脚本（D18 约束①的工具）
- [ ] N2 资产库 8 脚本移植（query_assets.mjs 优先 → build_tokens → build_indexes → 其余 5 个），逐个过 N1 对等验证
- [ ] N3 build_release.mjs + installer/install_skills.mjs（subprocess 调用链改 node）
- [ ] N4 测试移植：validate_package.py 重写（含 §8 耦合解除：不再 import 已删 Python）+ validate_coordination.py → .mjs
- [ ] N5 删除全部 .py：跑一次 `node scripts/build_release.mjs --version 1.5.1` 重锁哈希（D18 约束②）；**阻塞 T7 收尾**

### W4 文档与协议（第 3/4 人或 W2 兼任）

- [ ] D1 SKILL.md 重写：生成流程主干 + 组件模式三档开关 + 资产库定位协议 + UI Runtime 选择 + 模板参考清单用法 + 毛玻璃按需读 + 速度优化条款（D13①②④ + D15 + px 单位）
- [ ] D2 code-conventions.md：代码规范/mock/i18n（locales.js 模式）/api 适配层/目录约定，从 gts-autin-coder SKILL.md 去 gts 化改写
- [ ] D3 ui-runtime.md：EP/SweetUI 三件套接入说明（口子文档）
- [ ] D4 skill-catalog.json + AI-ENTRY.md + workflow.md 更新（§8 其余耦合，freeze/handoff 概念清除）
- [ ] D5 README 更新：安装命令 node 化、运行依赖声明（仅 Node）、EP 2.13.5

### 里程碑依赖图

```
T0 ──→ 冻结契约(M0 + W1 脚本 CLI 约定) ──→ W1(T1-T6) ──┐
                │                                      ├──→ T7 端到端 ──→ N5 删 .py ──→ 发布
                └──→ W2(M1→M2) ────────────────────────┤
                     W3(N1→N2→N3→N4)（全程并行）────────┤
                     W4(D1-D5)（D1/D2 依赖 T1 结论）────┘
```

### 并行协同机制（给协作小伙伴的规则）

1. **先冻结契约再动手**：M0（组件格式）与 W1 的脚本 CLI 参数约定是所有人的接口，T0 后 24h 内定稿，之后改契约要走 PR 评审。
2. **文件所有权**：W1 只动 `skills/generate-ux-prototype/scripts/`；W2 只动 `assets/.../frontend/element-plus/src/components/` 与迁移工具；W3 只动 `*.py → *.mjs` 与 installer/tests；W4 只动 SKILL.md/references/docs。跨区改动一律走 PR 并 @ 区主。
3. **本文件是唯一事实源**：进度看 §13 打勾，决策看 §9 日志；会前各自读一遍 §13。
4. **每日同步 15 分钟**：只讲三件事——昨天勾了哪条、今天动哪条、有没有卡在跨 W 依赖上。
5. **4 人各领一条 W；3 人时 W4 由 W2 或 W1 兼任（D1/D2 是重头，建议 W1 兼）。**

## 12. 风险清单

| # | 风险 | 对策 |
|---|---|---|
| 1 | 库端改造完成前，新旧格式组件并存，未迁移组件仍带 TS/外链样式 | 迁移（§11 步骤 2）先行或并行；P0 用已迁移组件验证 |
| 2 | 资产库 element-plus.css 桥接与 EP 2.13.5 变量名兼容性 | P0 diff 验证；EP 2.x 变量名稳定，预计无碍 |
| 3 | reuse 模式"必须复用"无法工具强校验 | AI 纪律约束 + build 校验 import/token 兜底；文档如实说明 |
| 4 | ~~px token 与 rem 体系不一致~~ 已解除（D14 全 px，单位天然一致） | — |
| 5 | 设计师持续更新资产，迁移后新增组件可能不合规 | 规范文档 + 迁移脚本可重复跑（幂等），升级时抽查 |
