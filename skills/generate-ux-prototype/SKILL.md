---
name: generate-ux-prototype
description: Generate or edit a G Design page as real Vue 3 + Element Plus 2.13.5 source code (.vue workspace with api adapter, mock, i18n) plus a zero-build offline preview; tokens and reusable components are fetched live from the local asset library. Accepts text requirements, module descriptions, screenshots or raw HTML. Triggers on "页面生成", "原型", "Vue 页面", "Element Plus", "列表页", "看板", "截图转码".
---

# 生成 G Design 原型（Vue 3 源码交付）

你的产品是**真实 Vue 3 源码工作区**：一组 `.vue` SFC（`<script setup>` 纯 JS）+ Less + 标准 ESM import，写在 `{slug}/src/` 下——代码本身就是交付件，可直接拷入任何 Vue 3 + Element Plus + Vite 工程做二次开发；同时附带零构建离线预览 `{slug}/index.html`（浏览器直接打开）。对话以单个 `<artifact>` 链接结束。

skill 目录不存放任何设计数据副本：token、组件、模板、毛玻璃规则全部在生成时通过资产库定位协议现取（见下文「资产库定位协议」）。设计师发新版资产库，下一次生成自动生效。

## 技术栈

- **框架**: Vue 3（`<script setup>` Composition API，纯 JS，无 TS）
- **UI 库**: Element Plus **2.13.5**（当前唯一 runtime）
- **路由**: Vue Router 4.x
- **样式语言**: Less（全链路钉死，无开关；工作区禁止出现任何 scss）
- **单位**: px（与资产 token 一致；不做 rem 换算）
- **运行时依赖白名单（裸 import 仅此五项）**: `vue` / `vue-router` / `element-plus` / `@element-plus/icons-vue` / `dayjs`（+ element-plus 子路径；`less` 仅为构建期依赖，非运行时依赖）

## Session Context Caching

1. **NEVER re-read** 本会话已读过的文件。
2. **Design system:** token 不再有速查表——全集见工作区 `src/assets/tokens/*.css`（init 现取），build 实时校验兜底。需要了解 token 语义/规则时读资产库 `design/rules.md`、`design/color-rules.md`。
3. **Code patterns:** 信任 [references/code-conventions.md](references/code-conventions.md) 的约定与速查，无需外部参考。
4. **Element Plus API:** 信任你的知识，标准 EP 2.13.5 API。

## Output Contract（READ FIRST）

`init.mjs` 初始化出的工作区结构（**init 只创建必要文件，其余按需创建**）：

```
{slug}/
├── index.html                       # 离线预览加载器（FIXED）
├── preview-data.js                  # 源码映射（build 自动生成，FIXED）
├── mock/modules/{slug}.js           # Mock API（init 必建，与 src 同级）
├── public/library/element-plus/     # EP 2.13.5 预览运行时 UMD（FIXED）
└── src/                             # ★ 交付件
    ├── main.js                      # 工程入口（FIXED）
    ├── App.vue                      # 应用壳：路由出口（init 生成）
    ├── api/{slug}.js                # ★ 接口适配层（init 必建；二开唯一必改文件）
    ├── assets/tokens/               # ★ 资产库 token 全套（init 现取复制，勿手改）
    ├── assets/style/base.less       # Less 基础样式（FIXED）
    ├── assets/themes/               # 皮肤插槽（base.css + README 协议；自定义皮肤放这里）
    ├── assets/fonts/                # 字体（FIXED）
    ├── assets/images/ uploads/      # 按需创建素材
    ├── locales/                     # 全部语言资源（init 必建：lang/{zh-CN,en-US}/common.json + pages/{slug}.js + index.js）
    ├── router/index.js              # 路由（init 必建 — 内联，无 guards/modules）
    ├── views/{slug}/                # ★ 页面主目录（init 必建）
    │   ├── index.vue                # 页面主组件（starter，替换它）
    │   └── js/constants.js          # 页面常量（含 COMPONENT_MODE）
    └── components/                  # 复用 G 组件 / 跨页组件（按需创建）
```

**Editable vs FIXED:**
- **You edit ONLY:** `views/**`、`components/**`、`api/**`、`locales/**`、`router/**`、`mock/**`、`assets/uploads/`、`assets/images/`、`assets/themes/`（皮肤文件）。
- **FIXED:** `main.js`、`App.vue`、`assets/tokens/`、`assets/style/base.less`、`assets/fonts/`、`public/`、`index.html`、`preview-data.js`。

**HARD RULES（src/ 内代码约束，细则见 [references/code-conventions.md](references/code-conventions.md)）:**
- 标准 ESM：`import { ref } from 'vue'`、`import { ElMessage } from 'element-plus'`；相对路径 import 子组件。
- 颜色一律资产库 token 变量 `var(--g-*)` / `var(--color-*)`；Element Plus 组件用语义 `type` prop。
- `<style lang="less" scoped>`；**禁止静态内联 `style="..."`**（`:style` 动态绑定允许）；SFC 样式内禁止定义 `:root`、`[data-theme]`、资产 token（页面局部变量用 `--page-*` 前缀）。
- 单位一律 px；全工作区禁止 scss / `lang="scss"`。
- 页面与组件**只准从 `src/api/{slug}.js` 取数**，禁止 import `mock/modules`（build 强制校验）。

## 资产库定位协议

先定位资产库（下称 LIBRARY，内含 `asset-manifest.json`），再按需读取，不全量扫描：

1. **用户给定的 `ASSETS_ROOT` 优先**——可指向包根目录、包内 `assets/` 或 LIBRARY 本身。
2. 未指定时读本 Skill 的 `agents/package-location.json`（安装模式保存的包绝对路径），核对包根 `skill-catalog.json` 的 packageId/packageVersion。
3. 整包模式可直接使用包根；包根 `asset-catalog.json` → `libraries['g-design-enterprise'].root` 定位库目录。
4. 路径失效时先在用户已知位置查找；仍缺失才询问。

定位后**不要整读** `asset-manifest.json` / `asset-library.contract.json` / `release/source-lock.json`——它们是机器文件（数千行哈希与锁清单，整读一次可吃掉大量上下文），定位正确性由脚本保证。查询资产一律走库内脚本（**全量清单必带 `--brief`**——单行一条 id/name/useWhen，输出量约为完整 JSON 的 1/5；选中后再读单条 spec）：

```sh
node LIBRARY/scripts/query_assets.mjs templates --brief              # 页面模板清单（单行摘要）
node LIBRARY/scripts/query_assets.mjs components --brief             # 组件清单（单行摘要）
node LIBRARY/scripts/query_assets.mjs components --search 状态 --brief  # 搜索 + 单行摘要
node LIBRARY/scripts/query_assets.mjs components g-status-tag        # 单个组件 spec（useWhen/level/source）
node LIBRARY/scripts/query_assets.mjs tokens frost-common            # token 分组（含 frost-*）
```

规范入口：`design/rules.md`。**design/ 文档按需触发，默认一律不读**（SKILL.md 的 HARD RULES 已覆盖日常写码约束）：仅当页面明确涉及对应场景才读对应的那一份——颜色场景读 `design/color-rules.md`、token 数值细读 `design/color-tokens.md`、毛玻璃读 `design/frosted-glass.md`（触发条件见「毛玻璃与视觉风格」）；禁止为"了解设计体系"而通读。

## 上下文预算（读取纪律，生成全程执行）

单页生成的目标预算：**定位+init ≤5k / 模板与组件参考 ≤8k / 写码输出 ~30k / 验证 ≤5k，全程 ≤60-80k**——200k 窗口下留一半余量。执行规则：

1. **禁读清单**（读了也不用于生成，纯浪费）：仓库级 `SKILL-REPLACE-PLAN.md`、`tasks/`、`README.md`、`workflow.md`、`tests/`；资产库的 manifest/contract/source-lock（见上）；模板 config 预设里的数据段（rows/nodes/edges——只读 spec JSON 的 `criticalInteractions` 与 `pageStates`）。
2. **token 确认只走 preflight.mjs**（与 build 同源），禁止 grep `src/assets/tokens/` 现场查；token 语义疑问也先 preflight，仍解决不了才读对应 design/ 文档的那一节。
3. **组件 spec 只读命中项**：`--brief` 圈候选 → 只读最终命中的 1-3 条 spec，不逐个通读。
4. **验证只认脚本输出**：build/smoke 的 `RESULT` 行即终态；FAIL 按行修复重跑，禁止现场手写调试脚本/puppeteer 脚本展开分析——那是把验证变成新的上下文黑洞。
5. **截图输入节制**：一次一张、必要时裁剪；追问/修改轮次不重发已分析过的图。
6. **接近预算上限时**：先 `/compact`（安全点：init + collect 完成、开写之前），压缩后凭 SKILL.md + 工作区文件继续，无需重读资产库。

## 生成选项：组件模式开关（生成开始时确认）

生成开始时与用户确认**组件复用模式**（UI 库当前固定 element-plus；样式语言固定 less，均无开关），并记录到 `views/{slug}/js/constants.js` 的 `COMPONENT_MODE`：

| 模式 | 行为 |
|---|---|
| `reuse` | 命中库组件**必须**复用；未命中记 gap 并告知用户 |
| `hybrid`（默认） | 先按组件 spec 的 useWhen 语义匹配；命中→复制复用，未命中→AI 手写 |
| `free` | 跳过匹配，全部 AI 手写（只守 token + 代码规范约束） |

init 生成的 starter 中 `COMPONENT_MODE` 默认为 `'hybrid'`，确认结果不同时改写该常量。

## 环境纪律（node 归因 + 降级禁令）

**交付契约不可降级：任何环境下都禁止「node 不可用所以改为纯 HTML/静态页」的替代交付**——那不是本 Skill 的产物，等于交付失败。环境故障时的唯一正确动作：按下面诊断 → 把结果原样报告用户 → 等待修复；不许自行更换交付形态、不许静默降级。

**`RESULT: FAIL` = 脚本已正常运行后的业务校验失败，与 node 安装无关**（脚本能输出 FAIL 恰恰证明 node 可用）。高频原因与修复：

| FAIL 信息 | 原因 | 修复 |
|---|---|---|
| `asset library not found` | 资产库路径/绑定问题：包移动过绑定失效、未传 `--assets-root`、cwd 不对 | 重跑 `node installer/setup.mjs` 重绑定，或显式传 `--assets-root` |
| `Artifact folder does not exist` | 输出目录未建 | 先创建目录再跑 |
| `target already exists` | 同名工作区已存在 | 走文末 Modification Workflow |
| `puppeteer-core not found`（smoke） | 冒烟前置未装 | `npm i -g puppeteer-core` |

连续 FAIL 3 次仍未修复 → 停下把输出原样报告用户，禁止换交付形态。

**node 真缺失时的排查顺序**（仅当 `node --version` 报 command not found 才进入）：

1. 用户确认已安装 → 最可能是 **agent 宿主进程 PATH 未刷新**（Windows 装完 node 后，已启动的 agent/终端拿不到新 PATH；用户自己开新终端 `node --version` 正常，两边都没错）→ 请用户**重启 agent/终端**再试；
2. 询问安装方式：nvm/fnm 管理时需在当前 shell 先 `nvm use <version>`；
3. 仍不行才建议安装：`winget install OpenJS.NodeJS.LTS`（要求 ≥18）。

## 生成流程（All Input Types）

### Step 0 — 环境预检（一行命令）

```sh
node --version
```

- 输出 `v` 数字（≥18）→ node 可用；**此后本次会话内任何脚本 FAIL 都不得归因于 node 安装**，按「环境纪律」表内原因排查。
- `command not found` / 报错 → 进入「环境纪律」的排查顺序，结果报告用户；**全程禁止降级为纯 HTML 交付**。

### Step 1 — 输入解析

- **意图先行判定**：用户发设计稿/截图并要求「还原 / 重新生成」时，**直接全新生成**（派生新 slug 建新目录），不读取、不比对已生成的旧页面——只有用户明确说「修改 / 对齐已有页面」才走文末 Modification Workflow。误判成修改流程会浪费大量轮次通读旧代码且全部作废。
- **Type 1 页面描述**：分析场景、目标用户、核心问题；扩展完备性（B 端控制台 = 顶栏 + 侧边导航 + 主内容区 + 状态反馈）。
- **Type 2 模块描述**：单个 UI 块 → 作为独立组件生成 + 页面以展示形态包裹。
- **Type 3 截图**：分析布局/组件/层级/视觉分区，映射到 Element Plus + 资产 token；**数据保真转录而非发明**——行数列数与图完全一致，逐格独立读取，严禁行间复制。
- **Type 4 Raw HTML**：解析 DOM/CSS → 原生控件映射 EP 组件，颜色映射最近似 token，重复内容提为数据。

### Step 2 — 模板参考（结构参考 + 完备性清单，只读）

1. 用 `query_assets.mjs templates --brief` 摘要选**最接近**的模板（六套：standard-list / device-management / edit-form / object-detail / topology-monitoring / alarm-impact）。
2. **只读**该模板 JSON 的 `criticalInteractions`（搜索/分页/批量等）与 `pageStates`（loading/empty/error/forbidden/partial/ready）两字段，再读其 `source` 指向的 `.vue` 源码提取布局骨架——**config 预设（configs/*.json）的 rows/nodes/edges 等数据段禁读**（纯演示数据，单份即数 KB，对生成无用）。
3. 以此作为**结构与交互完备性对照清单**，然后按工作区代码规范自由写码——**配置驱动机制已废弃**，不生成、不引用任何模板配置 JSON；模板源码只读不拷贝。

### Step 3 — Init Workspace（MANDATORY）

1. **Confirm {artifact-folder}**：运行时上下文提供的绝对路径；缺失则回退当前工作目录。
2. **Derive {slug}**：kebab-case ASCII，2–6 段语义英文（"设备管理" → `device-management`）。
3. **Init**：
   ```sh
   node scripts/init.mjs "{artifact-folder}" "{slug}" --assets-root <ASSETS_ROOT>
   ```
   `--assets-root` 可省略（自动探测：本包所在仓库布局 → `ASSETS_ROOT` 环境变量 → 当前目录）。成功输出 `RESULT: OK` + `HTML_PATH` + `SRC_DIR` + `PAGE` + `ASSETS_VERSION`。token 全套随即复制到 `src/assets/tokens/`（含毛玻璃 token），并生成 api 适配层、mock 模块、全局词条、路由与 starter 页面。

### Step 4 — 组件匹配与复用（hybrid / reuse）

1. 对页面需要的每个能力，用 `query_assets.mjs components --search <关键词> --brief` 圈候选，**只读最终命中的 1-3 条 spec**（useWhen/states 字段确认语义匹配），不逐个通读。
2. **命中** → 用 collect 脚本一次性拷贝依赖闭包（自动递归相对 import、落位到 `src/components/GName/`、加来源注释）：
   ```sh
   node scripts/collect_component.mjs [LIBRARY] <component-id> "{slug}/src" "{slug}/src/components"  # LIBRARY 可省略（安装态自动读绑定）
   ```
   输出 `RESULT: OK` + `FILES`/`COPIED` 清单。拷入的文件**禁止改写**（含来源注释），页面以标准 import 消费。
3. **未命中** → AI 手写（遵循 code-conventions），组件头注释注明手写原因；`reuse` 模式必须把 gap 汇总告知用户。
4. 注意：collect 脚本对同一目标重复执行会 FAIL（防覆盖）；组件依赖 types.ts 等未迁移文件时会报缺失清单（资产库迁移 gap），如实上报，不要手工内联修复。

### Step 5 — 写码

在 `SRC_DIR` 下按 [references/code-conventions.md](references/code-conventions.md) 编写页面：

- `views/{slug}/index.vue` 为页面主组件（替换 starter），以组合编排为主。
- **拆分触发式**：子组件仅在 **>150 行 / 被复用 / 状态复杂** 时才拆出独立文件（常规页面约 4-8 个文件）；页面私有放 `views/{slug}/components/`，跨页复用放 `src/components/`（复用的 G 组件由 collect 平铺落位到 `src/components/GName/`）。
- **无依赖的文件并行写**：constants.js、locales.js、mock 数据、互不依赖的子组件可在同一轮并行创建。
- **常量放 `views/{slug}/js/constants.js`**（全大写+下划线命名）；页面词条放 `src/locales/pages/{slug}.js`（单文件双语言，见下文 i18n）。
- **写码前先规划后落笔（preflight 强制）**：
  1. 先列出每个待写文件的 imports——**按目录显式算好相对路径前缀**（`views/{slug}/` 出发上两级 `../../`，`views/{slug}/components/` 出发上三级 `../../../`；components/ 下少写一级是历史最高频 build FAIL 项）。
  2. 汇总本轮要用的全部 token 变量名、图标名、element-plus 导出名、词条 key，**一次提交 preflight 一条命令校验**（不通过按提示修正清单再跑；禁止写码中途反复 grep/node 查询）：
     ```sh
     node scripts/preflight.mjs --dir "{artifact-folder}/{slug}" --icons "..." --tokens "..." --exports "..." --imports "views/{slug}/components/X.vue=../../../locales/pages/{slug}.js|../js/constants.js,..."
     ```
  3. `RESULT: OK` 后以清单为准落笔——写码过程中 token/词条/路径以清单为准，不再现场发明。
- **分批 build 早暴露**：build 毫秒级，不要等全部文件写完才跑——首个子组件 + constants/locales 写完即跑一轮（token 拼写/白名单类错误在第一个组件就暴露），全部写完再跑最终轮。

### Step 6 — 生成前自检（MANDATORY，build 前必做）

1. 相对 import 层级正确（对照 code-conventions 的路径计算表）
2. 图标名 / `el-*` 组件名在白名单内（见下文速查）
3. PascalCase / kebab-case 组件标签都有对应 import
4. `<style lang="less">` 内无 `:root` / `[data-theme]` / 资产 token 定义；页面局部变量 `--page-*` 前缀
5. 裸 import 仅白名单五项
6. `v-for` 有 `:key`；`v-if` 不与 `v-for` 同标签
7. 无静态内联 `style="..."`（`:style` 动态绑定允许）
8. 单位 px（无 rem）；无任何 scss
9. 页面/组件无 `mock/modules` import（只经 `src/api/{slug}.js`）
10. 拷入的 G 组件文件未被改动（来源注释原样）

### Step 7 — Build & Verify（MANDATORY，自动刷新预览）

```sh
node scripts/build.mjs --dir "{artifact-folder}/{slug}"
```

- **Success:** `RESULT: OK` + `OK index.html verified (N pages, M components, K el-tag uses)`
- **Failure:** `RESULT: FAIL | <文件>: <原因>` → 修复 → 重跑（最多 3 次）
- **WARN:** hex 颜色、静态内联样式——非阻断，但应修正
- 校验覆盖：@vue/compiler-sfc 真编译 + `el-*` 白名单(116) + 图标白名单(295) + 导出白名单(130) + 相对 import 解析 + 裸依赖白名单 + ESM 语法 + **token 存在性（从工作区 `src/assets/tokens/` 实时提取）** + 样式卫生 + mock 隔离 + scss 禁用。

通过后跑无头冒烟收口：

```sh
node scripts/smoke.mjs --dir "{artifact-folder}/{slug}"
# RESULT: OK | render=1 token=#0067D1 themeSwitch=ok errors=0 missing404=0
```

**build + smoke 一轮跑完 = 生成流程结束。** 不再起 serve / curl 探活 / 查杀进程 / 重复验证——smoke 自带渲染、token 品牌色、明暗切换、404 检查并自查进程清理；`serve.mjs` 只在用户明确要求本机预览地址时才启动。

### Step 8 — Output

```
<artifact type="text/link">{HTML_PATH value}</artifact>
```

直接在浏览器打开 `index.html` 即可预览（file:// 可直接加载）；用户需要本机预览地址时才启动：

```sh
node scripts/serve.mjs --dir "{artifact-folder}/{slug}" --port 8765
```

冒烟前置（每机器一次）：`npm i -g puppeteer-core`；自动探测系统 Chrome/Edge，不下载浏览器。检查项：页面无报错渲染、`--el-color-primary` 解析为资产品牌色、`setTheme('dark')` 明暗切换生效、非 favicon 资源 404 为空。`--selector` 可指定页面特征选择器（默认 `.event-card, .page-root, main, #app .el-button`）。

交付说明需注明：演示假设与未验证项、组件复用 gap（reuse 模式必述）、以及二次开发入口（改 `src/api/{slug}.js` 对接真实接口，页面零改动）。

## Modification Workflow（修改已生成页面）

用户要求修改已生成页面时，**不要重新生成**：

1. **Locate:** `{artifact-folder}/{slug}/src/views/{slug}/...`
2. **Edit:** 只做请求的改动——未提及内容保持不变。
3. **Re-verify:** 重跑 `build.mjs` → 输出同一 `<artifact>` link。

## 换肤系统

- 页面消费 token（`src/assets/tokens/` 全套，init 现取）→ 任何皮肤下自动跟随。
- 明暗协议：`data-theme="light|dark"`；运行时切换 `document.documentElement.setAttribute('data-theme', …)`。
- 自定义皮肤：`theme-{name}.css` 放 `src/assets/themes/`，按该目录 README 协议注册（`index.html` 换肤插槽追加 `<link>`；真实工程在 `main.js` 皮肤插槽追加 import）。

## 毛玻璃与视觉风格

毛玻璃无特殊机制——它就是 token + 规范文档：

- token（glass / frosted / frost-decoration）随 `src/assets/tokens/` 自动就位，设计师更新自动跟随。
- 需求涉及毛玻璃时**按需读**资产库 `design/frosted-glass.md`（何时用/不用、control/card/overlay 预设、应用预算），用 `query_assets.mjs tokens frost-common` 查数值。
- 视觉风格判断沿用主次/内容密度规则：遇到大面积品牌色重点卡片/概览且边角有留白时，按 `design/frosted-glass.md` 的「色块装饰」及 `frost-decoration` 分组选择弱装饰；普通大卡片不因尺寸自动装饰，密集数据与功能告警色排除；选定后显式记录属性，保留主卡的蓝底白字。用户给定的参考图和风格优先；无明确装饰需求时使用企业实色主题。

## UI Runtime 扩展点

默认 runtime 为 **element-plus 2.13.5**。接入其他 UI 库（如 SweetUI）= 按「UMD 目录 / 白名单 / token 桥接 CSS」三件套接入，架构不动；接入说明与清单见 [references/ui-runtime.md](references/ui-runtime.md)。生成流程本身不因 runtime 改变。

## i18n

- **页面级**：每页一个 `src/locales/pages/{slug}.js`——单文件双语言对象（zh-CN + en-US 一次写完，en 由 AI 机械翻译顺带产出），模板经 `t.xxx` 引用；写法见 code-conventions「i18n 模式」。
- **全局**：`src/locales/lang/{zh-CN,en-US}/common.json` 仅存**跨页共享**词条（确认/取消/搜索等，按需追加）。
- 将来接 vue-i18n 时把两个语言对象拆进 JSON 即可，页面模板零改动。

## Mock 与 API 适配层（D16）

- 页面**只准** `import { fetchList } from '../../api/{slug}.js'`；**禁止 import `mock/modules`**（build 强制 FAIL）。
- `src/api/{slug}.js` 原型态为一行 re-export mock；mock 函数按 **REST 语义**设计签名（如 `fetchList({keyword,page,pageSize}) → Promise.resolve({list,total})`，返回页面消费的形状，`delay` 模拟网络）。
- 二次开发 = 只改 `src/api/{slug}.js`（导出名/参数/返回形状不变），页面零改动。细则与二开写法见 code-conventions「API 适配层约定」。

## 速度条款

1. **拆分触发式**：>150 行 / 被复用 / 独立状态复杂才拆文件，常规页面 4-8 个文件；不追求「一个 UI 区块一个文件」。
2. **并行写**：无依赖文件（constants / locales / mock / 独立子组件）并行创建。
3. **Mock 混合策略**：手写前 8-10 条保状态多样性，其余 spread / 生成器扩展数量；**截图输入保真转录规则不变**。

## 速查

### 常用图标（import from '@element-plus/icons-vue'，大小写敏感，build 校验 295 白名单）

```
Search  Plus  Edit  Delete  View  Refresh  Setting  User  Lock  Check
Close  Warning  InfoFilled  ArrowDown  ArrowUp  ArrowLeft  ArrowRight
Monitor  Filter  More  Calendar  Bell  Download  Upload
```

### 常用 el-\* 组件（build 校验 116 白名单，以下最高频）

```
el-button  el-input  el-select  el-option  el-table  el-table-column
el-pagination  el-form  el-form-item  el-dialog  el-drawer  el-tag
el-icon  el-menu  el-container  el-header  el-aside  el-main
el-row  el-col  el-card  el-tabs  el-tab-pane  el-tooltip  el-dropdown
```

### Token

不内嵌速查表（避免随设计师更新腐烂）。**token 确认只走 preflight.mjs**（与 build 同源实时校验）；token 分组数值用 `query_assets.mjs tokens <group>` 查询（单组，不逐组翻）。

## References

- **[references/code-conventions.md](references/code-conventions.md)** — 页面代码规范 / API 适配层 / i18n / G 组件复用 / 相对路径计算表 / 高频错误预防 / 二开依赖差异
- **[references/ui-runtime.md](references/ui-runtime.md)** — UI Runtime 三件套接入说明（SweetUI 预留）
- **[references/usage.md](references/usage.md)** — 调用示例（六脚本 CLI 速览：query_assets / init / collect / preflight / build / serve / smoke）
- **[references/component-format.md](references/component-format.md)** — 组件库改造规范 v1（给设计师的格式契约，W2 产出；AI 复用拷贝时知悉组件格式）
- **[references/designer-component-guide.md](references/designer-component-guide.md)** — 设计师新组件操作指南（与 component-format.md 配套，含提交前自检 10 条）
