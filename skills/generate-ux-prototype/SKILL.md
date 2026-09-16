---
name: generate-ux-prototype
description: Generate or edit a G Design page as real Vue 3 + Element Plus 2.13.5 source code (.vue workspace with api adapter, mock, i18n) plus a zero-build offline preview; design tokens are fetched live from the local asset library. Accepts text requirements, module descriptions, screenshots or raw HTML. Triggers on "页面生成", "原型", "Vue 页面", "Element Plus", "列表页", "看板", "截图转码".
version: 1.0.0
---

# 生成 G Design 原型（Vue 3 源码交付）

你的产品是**真实 Vue 3 源码工作区**：一组 `.vue` SFC（`<script setup>` 纯 JS）+ Less + 标准 ESM import，写在 `{slug}/src/` 下——代码本身就是交付件，可直接拷入任何 Vue 3 + Element Plus + Vite 工程做二次开发；同时附带零构建离线预览 `{slug}/index.html`（浏览器直接打开）。对话以单个 `<artifact>` 链接结束。

skill 本体内嵌资产库（`library/`）：token、毛玻璃规则全部在生成时现取（见下文「资产库」）。设计师发新版资产库（整体替换 `library/design/` 与 `library/frontend/element-plus/tokens/`），下一次生成自动生效。

## 技术栈（钉死，无开关）

- Vue 3（`<script setup>` 纯 JS 无 TS）+ Element Plus **2.13.5**（唯一 runtime）+ Vue Router 4 + Less + px
- 图标来源:IconPlus API（生成时 `fetch_icons.mjs` 获取，存为 `src/assets/icons/*.vue`）
- 裸 import 白名单仅五项：`vue` / `vue-router` / `element-plus` / `@element-plus/icons-vue` / `dayjs`（+ element-plus 子路径；`less` 仅为构建期依赖）

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
    ├── assets/icons/                # ★ IconPlus 图标（fetch_icons.mjs 写入 .vue SFC）
    ├── assets/style/base.less       # Less 基础样式（FIXED）
    ├── assets/themes/               # 皮肤插槽（base.css + README 协议；自定义皮肤放这里）
    ├── assets/images/ uploads/      # 按需创建素材
    ├── locales/                     # 全部语言资源（init 必建：lang/{zh-CN,en-US}/common.json + pages/{slug}.js + index.js）
    ├── router/index.js              # 路由（init 必建 — 路径与 history 模式 FIXED，仅 routes 条目可编辑；见下文白页防线）
    ├── views/{slug}/                # ★ 页面主目录（init 必建）
    │   ├── index.vue                # 页面主组件（starter，替换它）
    │   └── js/constants.js          # 页面常量
    └── components/                  # 跨页复用组件（按需创建）
```

**Editable vs FIXED:**
- **You edit ONLY:** `views/**`、`components/**`、`api/**`、`locales/**`、`router/index.js`（仅路由表条目）、`mock/**`、`assets/uploads/`、`assets/images/`、`assets/icons/`（IconPlus 图标）、`assets/themes/`（皮肤文件）。
- **FIXED:** `main.js`、`App.vue`、`assets/tokens/`、`assets/style/base.less`、`public/`、`index.html`、`preview-data.js`、`router/index.js` 的文件路径与 history 模式。

**router/index.js 硬约束（白页防线）：** `index.html` 预览加载器按固定路径 `/src/router/index.js` 加载路由模块。不得挪动、改名、内联到 main.js，不得把 `createWebHashHistory` 换成 `createWebHistory`（file:// 下路由匹配失败 → 白页）。只准往 `routes` 数组里加条目。build.mjs 强制校验三项：文件存在、调用 `createRouter`、history 必须是 `createWebHashHistory` 或 `createMemoryHistory`。

**HARD RULES（src/ 内代码约束，细则见 [references/code-conventions.md](references/code-conventions.md)）:**
- 标准 ESM：`import { ref } from 'vue'`、`import { ElMessage } from 'element-plus'`；相对路径 import 子组件。
- 颜色一律资产库 token 变量 `var(--g-*)` / `var(--color-*)`；Element Plus 组件用语义 `type` prop。
- `<style lang="less" scoped>`；**禁止静态内联 `style="..."`**（`:style` 动态绑定允许）；SFC 样式内禁止定义 `:root`、`[data-theme]`、资产 token（页面局部变量用 `--page-*` 前缀）。
- 单位一律 px；全工作区禁止 scss / `lang="scss"`。
- 页面流式自适应（L1+L2 默认：容器不写死宽度 + 栅格断点；细则见 code-conventions「自适应规范」）。
- 页面与组件**只准从 `src/api/{slug}.js` 取数**，禁止 import `mock/modules`（build 强制校验）。

## 资产库（内嵌，零配置）

资产库内嵌于本 skill 的 `library/` 目录（含 `asset-manifest.json`），skill 装到哪资产就在哪——**所有脚本自动使用内嵌库，无需指定任何路径**。

不要整读 `asset-manifest.json`（机器文件）；token 查询一律走库内脚本：

```sh
node LIBRARY/scripts/query_assets.mjs tokens frost-common            # token 分组（含 frost-*）
node LIBRARY/scripts/query_assets.mjs tokens --search brand          # token 值搜索
```

规范入口：`design/rules.md`。**design/ 文档按需触发，默认一律不读**（SKILL.md 的 HARD RULES 已覆盖日常写码约束）：仅当页面明确涉及对应场景才读对应的那一份——颜色场景读 `design/color-rules.md`、毛玻璃读 `design/frosted-glass.md`（触发条件见「毛玻璃与视觉风格」）；禁止为"了解设计体系"而通读。

## 上下文预算（读取纪律，生成全程执行）

单页生成的目标预算：**定位+init ≤5k / 写码输出 ~30k / 验证 ≤5k，全程 ≤60-80k**——200k 窗口下留一半余量。执行规则：

1. **禁读清单**（读了也不用于生成，纯浪费）：skill 目录外的任何仓库/项目文档；资产库的 `asset-manifest.json`（机器文件，见上）。
2. **token 确认只走 preflight.mjs**（与 build 同源），禁止 grep `src/assets/tokens/` 现场查；token 语义疑问也先 preflight，仍解决不了才读对应 design/ 文档的那一节。
3. **验证只认脚本输出**：build/smoke 的 `RESULT` 行即终态；FAIL 按行修复重跑，禁止现场手写调试脚本/puppeteer 脚本展开分析——那是把验证变成新的上下文黑洞。
4. **截图输入节制**：一次一张、必要时裁剪；追问/修改轮次不重发已分析过的图。
5. **接近预算上限时**：先压缩会话上下文（安全点：init 完成开写之前），压缩后凭 SKILL.md + 工作区文件继续，无需重读资产库。

## 环境纪律（node 归因 + 降级禁令）

**交付契约不可降级：任何环境下都禁止「node 不可用所以改为纯 HTML/静态页」的替代交付**——那不是本 Skill 的产物，等于交付失败。环境故障时的唯一正确动作：按下面诊断 → 把结果原样报告用户 → 等待修复；不许自行更换交付形态、不许静默降级。

**`RESULT: FAIL` = 脚本已正常运行后的业务校验失败，与 node 安装无关**（脚本能输出 FAIL 恰恰证明 node 可用）。高频原因与修复：

| FAIL 信息 | 原因 | 修复 |
|---|---|---|
| `asset library not found` / `embedded asset library broken` | skill 内嵌 `library/` 目录缺失或损坏（拷贝安装不完整） | 重装 skill |
| `Artifact folder does not exist` | 输出目录未建 | 先创建目录再跑 |
| `target already exists` | 同名工作区已存在 | 走文末 Modification Workflow |
| `puppeteer-core not found`（smoke） | 冒烟前置未装 | `npm i -g puppeteer-core` |

连续 FAIL 3 次仍未修复 → 停下把输出原样报告用户，禁止换交付形态。

**skill 自带文件不是可修改对象**：禁止修改、调试、patch 本 skill 的 `scripts/` 与 `library/` 下任何文件——那是 skill 本体，不是本次任务的产物；疑似脚本缺陷时原样报告用户等待修复，不许就地改或绕过脚本自跑替代验证。

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

### Step 2 — Init Workspace（MANDATORY）

1. **Confirm {artifact-folder}**：运行时上下文提供的绝对路径；缺失则回退当前工作目录。
2. **Derive {slug}**：kebab-case ASCII，2–6 段语义英文（"设备管理" → `device-management`）。
3. **Init**：
   ```sh
   node scripts/init.mjs "{artifact-folder}" "{slug}"
   ```
   内嵌资产库自动使用，零配置。成功输出 `RESULT: OK` + `HTML_PATH` + `SRC_DIR` + `PAGE` + `ASSETS_VERSION`。token 全套随即复制到 `src/assets/tokens/`（含毛玻璃 token），并生成 api 适配层、mock 模块、全局词条、路由与 starter 页面。

### Step 2.5 — 图标获取（IconPlus，页面需要图标时）

列出页面需要的全部图标关键词（逗号分隔），调用 `fetch_icons.mjs` 批量获取：

```sh
node scripts/fetch_icons.mjs --dir "{artifact-folder}/{slug}" \
  --keywords "下载,文件,搜索" \
  [--base-url "<IconPlus API 地址>"] \
  [--size 24] [--style "线性"] [--color "GTS_线性_Gray-10"] [--topK 1] [--source-id 6] [--category "basic"] [--group-id "132,333"]
```

默认 base-url=`https://octo.hdesign.huawei.com`（无需传参）。图标存为 `src/assets/icons/*.svg`，导入 `import downloadIcon from '../../assets/icons/download.svg'`，用法 `<img :src="downloadIcon" :width="20" :height="20" />`。默认 size=24 / style=线性 / color=GTS_线性_Gray-10。获取后图标文件名写入 preflight `--imports` 校验路径存在性。API 文档详见 [references/icon-api.md](references/icon-api.md)。

**连通性降级**：`fetch_icons.mjs` 先检测 API 是否可达（3s 超时）。不可达时自动降级为本地 Lucide 图标（370 个常用 B 端图标，含中文关键词映射），生成相同 `.svg` 格式。输出 `RESULT: FALLBACK | IconPlus API unreachable, using Lucide icons` + `ICONS: ...`——AI 按正常 ICONS 列表 import 即可，用法无差异。

### Step 3 — 写码

在 `SRC_DIR` 下按 [references/code-conventions.md](references/code-conventions.md) 编写页面（组件拆分、常量/i18n/Mock 细则以该文为唯一来源）：

- `views/{slug}/index.vue` 为页面主组件（替换 starter），以组合编排为主。
- **无依赖的文件并行写**：constants.js、locales.js、mock 数据、互不依赖的子组件可在同一轮并行创建。
- **写码前先规划后落笔（preflight 强制）**：
  1. 先列出每个待写文件的 imports——**按目录显式算好相对路径前缀**（`views/{slug}/` 出发上两级 `../../`，`views/{slug}/components/` 出发上三级 `../../../`；components/ 下少写一级是历史最高频 build FAIL 项）。
  2. 汇总本轮要用的全部 token 变量名、图标名、element-plus 导出名、词条 key，**一次提交 preflight 一条命令校验**（不通过按提示修正清单再跑；禁止写码中途反复 grep/node 查询）：
     ```sh
     node scripts/preflight.mjs --dir "{artifact-folder}/{slug}" --icons "..." --tokens "..." --exports "..." --imports "views/{slug}/components/X.vue=../../../locales/pages/{slug}.js|../js/constants.js,..."
     ```
  3. `RESULT: OK` 后以清单为准落笔——写码过程中 token/词条/路径以清单为准，不再现场发明。
- **分批 build 早暴露**：build 毫秒级，不要等全部文件写完才跑——首个子组件 + constants/locales 写完即跑一轮（token 拼写/白名单类错误在第一个组件就暴露），全部写完再跑最终轮。

### Step 4 — 生成前自检（MANDATORY，build 前必做）

preflight + HARD RULES + 白名单已机械覆盖语法/命名/样式类错误；人工只核对 build **不覆盖**的运行时项（细则见 [references/code-conventions.md](references/code-conventions.md) §9）：

1. `el-select` 初始值在 options 内、`el-table` 的 `prop` 与数据 key 匹配
2. template 引用的变量在 `<script setup>` 中已声明；`v-for` 有 `:key`

### Step 5 — Build & Verify（MANDATORY，自动刷新预览）

```sh
node scripts/build.mjs --dir "{artifact-folder}/{slug}"
```

- **Success:** `RESULT: OK` + `OK index.html verified (N pages, M components, K el-tag uses)`
- **Failure:** `RESULT: FAIL | <文件>: <原因>` → 修复 → 重跑（最多 3 次）
- **WARN:** hex 颜色、静态内联样式——非阻断，但应修正
- 校验覆盖：@vue/compiler-sfc 真编译 + `el-*` 白名单(116) + 图标白名单(295) + 导出白名单(130) + 相对 import 解析 + 裸依赖白名单 + ESM 语法 + **token 存在性（从工作区 `src/assets/tokens/` 实时提取）** + 样式卫生 + mock 隔离 + scss 禁用 + **router 完整性（文件存在 + createRouter + history 必须 file:// 兼容 + export default）**。

通过后跑无头冒烟收口：

```sh
node scripts/smoke.mjs --dir "{artifact-folder}/{slug}"
# RESULT: OK | render=1 token=#0067D1 themeSwitch=ok errors=0 missing404=0
```

**build + smoke 一轮跑完 = 生成流程结束。** 不再起 serve / curl 探活 / 查杀进程 / 重复验证——smoke 自带渲染、token 品牌色、明暗切换、404 检查并自查进程清理；`serve.mjs` 只在用户明确要求本机预览地址时才启动。

### Step 6 — Output

```
<artifact type="text/link">{HTML_PATH value}</artifact>
```

直接在浏览器打开 `index.html` 即可预览（file:// 可直接加载）；用户需要本机预览地址时才启动：

```sh
node scripts/serve.mjs --dir "{artifact-folder}/{slug}" --port 8765
```

冒烟前置（每机器一次）：`npm i -g puppeteer-core`；自动探测系统 Chrome/Edge，不下载浏览器。检查项：页面无报错渲染、`--el-color-primary` 解析为资产品牌色、`setTheme('dark')` 明暗切换生效、非 favicon 资源 404 为空。`--selector` 可指定页面特征选择器（默认 `.event-card, .page-root, main, #app .el-button`）。

交付说明需注明：演示假设与未验证项、以及二次开发入口（改 `src/api/{slug}.js` 对接真实接口，页面零改动）。

**沟通节奏**：写码/修 FAIL 过程不逐轮汇报，收口时一起说；脚本要装前置或耗时几分钟时先告知用户正在做什么。脚本报错分两类：环境类失败（装不上、node 缺失）原样转述给用户；自己代码的 FAIL 直接修复重跑，不用转述。

## Modification Workflow（修改已生成页面）

用户要求修改已生成页面时，**不要重新生成**：

1. **Locate:** `{artifact-folder}/{slug}/src/views/{slug}/...`
2. **Edit:** 只做请求的改动——未提及内容保持不变。
3. **Re-verify:** 重跑 `build.mjs` → 输出同一 `<artifact>` link。

## 换肤系统

明暗协议 `data-theme="light|dark"`（运行时 `document.documentElement.setAttribute`）；自定义皮肤 `theme-{name}.css` 放 `src/assets/themes/` 按该目录 README 注册。页面消费 token 全套，任何皮肤下自动跟随。

## 毛玻璃与视觉风格

毛玻璃就是 token + 规范：token 随 `src/assets/tokens/` 自动就位；需求涉及时**按需读** `design/frosted-glass.md`，数值走 `query_assets.mjs tokens frost-common`。视觉判断：大面积品牌色重点卡片且边角留白时按 frosted-glass.md「色块装饰」选弱装饰；普通大卡片不因尺寸自动装饰，密集数据与告警色排除。用户参考图和风格优先；无明确需求时用企业实色主题。

## UI Runtime 扩展点

默认 runtime 为 **element-plus 2.13.5**。接入其他 UI 库（如 SweetUI）= 按「UMD 目录 / 白名单 / token 桥接 CSS」三件套接入，架构不动；接入说明与清单见 [references/ui-runtime.md](references/ui-runtime.md)。生成流程本身不因 runtime 改变。

## i18n

页面词条每页一个 `src/locales/pages/{slug}.js`（单文件双语言，zh+en 一次写完；写法见 code-conventions「i18n 模式」）；`lang/{zh-CN,en-US}/common.json` 仅存**跨页共享**词条。将来接 vue-i18n 把两个语言对象拆进 JSON，页面模板零改动。

## Mock 与 API 适配层

页面**只准** `import { fetchList } from '../../api/{slug}.js'`；**禁止 import `mock/modules`**（build 强制 FAIL）。mock 按 REST 语义设计签名、二开只改 api 文件——细则与二开写法见 code-conventions「API 适配层约定」。

## Token 速查

不内嵌速查表（避免随设计师更新腐烂）。**token 确认只走 preflight.mjs**（与 build 同源实时校验）；token 分组数值用 `query_assets.mjs tokens <group>` 查询（单组，不逐组翻）。图标名 / `el-*` 组件名写错时 preflight 会给相近项提示，按提示修正清单重跑即可。

## References

- **[references/code-conventions.md](references/code-conventions.md)** — 页面代码规范 / 自适应规范 / API 适配层 / i18n / 相对路径计算表 / 高频错误预防 / 二开依赖差异
- **[references/ui-runtime.md](references/ui-runtime.md)** — UI Runtime 三件套接入说明（SweetUI 预留）
- **[references/usage.md](references/usage.md)** — 调用示例（脚本 CLI 速览：query_assets / init / fetch_icons / preflight / build / serve / smoke）
- **[references/icon-api.md](references/icon-api.md)** — IconPlus 图标 API 文档（getConfig / getIconInfo / getIcon）
