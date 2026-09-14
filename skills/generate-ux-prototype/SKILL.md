---
name: generate-ux-prototype
description: Generate or edit a G Design page as real Vue 3 + Element Plus 2.13.5 source code (.vue workspace with api adapter, mock, i18n) plus a zero-build offline preview; tokens and reusable components are fetched live from the local asset library. Accepts text requirements, module descriptions, screenshots or raw HTML. Triggers on "页面生成", "原型", "Vue 页面", "Element Plus", "列表页", "看板", "截图转码".
---

# 生成 G Design 原型（Vue 3 源码交付）

交付**真实 Vue 3 源码工作区**:一组 `.vue` SFC(`<script setup>` 纯 JS)+ Less + 标准 ESM import,写在 `{slug}/src/` 下——代码本身就是交付件,可直接拷入任何 Vue 3 + Element Plus + Vite 工程二次开发;同时附带零构建离线预览 `{slug}/index.html`(浏览器直接打开)。对话以单个 `<artifact>` 链接结束。

skill 目录不存放设计数据副本:token、组件、模板、规则全部在生成时通过资产库定位协议现取。设计师发新版资产库,下一次生成自动生效。

## 技术栈

- **框架**: Vue 3(`<script setup>` Composition API,纯 JS,无 TS)
- **UI 库**: Element Plus **2.13.5**(当前唯一 runtime)
- **路由**: Vue Router 4.x
- **样式语言**: Less(全链路钉死,无开关;工作区禁止 scss)
- **单位**: px(与资产 token 一致;不做 rem 换算)
- **运行时依赖白名单(裸 import 仅此五项)**: `vue` / `vue-router` / `element-plus` / `@element-plus/icons-vue` / `dayjs`(+ element-plus 子路径;`less` 仅构建期依赖)

## 资产库定位协议

先定位资产库(下称 LIBRARY,内含 `asset-manifest.json`),再按需读取,不全量扫描:

1. **用户给定的 `ASSETS_ROOT` 优先**——可指向包根、包内 `assets/` 或 LIBRARY 本身。
2. 未指定时读 skill 的 `agents/package-location.json`(安装模式保存的包绝对路径),核对包根 `skill-catalog.json` 的 packageId/packageVersion。
3. 整包模式可直接用包根;包根 `asset-catalog.json` → `libraries['g-design-enterprise'].root` 定位库目录。
4. 路径失效先在用户已知位置查找;仍缺失才询问。

定位后读 LIBRARY 的 `asset-manifest.json` 与 `asset-library.contract.json`;规范入口 `design/rules.md`,颜色场景按需读 `design/color-rules.md` 与 `design/color-tokens.md`。

## Output Contract

`init.mjs` 初始化出的工作区结构详见 [references/code-conventions.md §8](references/code-conventions.md) 的目录树与相对路径计算表。**Editable vs FIXED:**

- **You edit ONLY:** `views/**`、`components/**`、`api/**`、`locales/**`、`router/index.js`(仅路由表条目)、`mock/**`、`assets/uploads/`、`assets/images/`、`assets/themes/`(皮肤文件)。
- **FIXED:** `main.js`、`App.vue`、`assets/tokens/`、`assets/style/base.less`、`assets/fonts/`、`public/`、`index.html`、`preview-data.js`、`router/index.js` 的文件路径与 history 模式。

**router/index.js 硬约束(白页防线):** `index.html` 预览加载器按固定路径 `/src/router/index.js` 加载路由模块。不得挪动、改名、内联到 main.js,不得把 `createWebHashHistory` 换成 `createWebHistory`(file:// 下路由匹配失败 → 白页)。只准往 `routes` 数组里加条目。build.mjs 强制校验三项:文件存在、调用 `createRouter`、history 必须是 `createWebHashHistory` 或 `createMemoryHistory`。

## 组件模式开关(生成开始时确认)

生成开始时与用户确认**组件复用模式**(UI 库固定 element-plus;样式语言固定 less,均无开关),记录到 `views/{slug}/js/constants.js` 的 `COMPONENT_MODE`:

| 模式 | 行为 |
|---|---|
| `reuse` | 命中库组件**必须**复用;未命中记 gap 并告知用户 |
| `hybrid`(默认) | 先按组件 spec 的 useWhen 语义匹配;命中→复制复用,未命中→AI 手写 |
| `free` | 跳过匹配,全部 AI 手写(只守 token + 代码规范约束) |

init 生成的 starter 中 `COMPONENT_MODE` 默认为 `'hybrid'`,确认结果不同时改写该常量。

## 生成流程(All Input Types)

### Step 1 — 输入解析

**意图先行判定**:用户发设计稿/截图并要求「还原 / 重新生成」时,**直接全新生成**(派生新 slug 建新目录),不读取、不比对已生成的旧页面——只有用户明确说「修改 / 对齐已有页面」才走文末 Modification Workflow。误判成修改流程会浪费大量轮次通读旧代码且全部作废。

| 输入类型 | 关键规则 |
|---|---|
| Type 1 页面描述 | 分析场景/目标用户/核心问题;扩展完备性(B 端控制台 = 顶栏+侧边导航+主内容区+状态反馈) |
| Type 2 模块描述 | 单个 UI 块 → 独立组件 + 页面以展示形态包裹 |
| Type 3 截图 | 分析布局/组件/层级/视觉分区,映射到 EP + 资产 token;**数据保真转录而非发明**——行数列数与图完全一致,逐格独立读取,严禁行间复制 |
| Type 4 Raw HTML | 解析 DOM/CSS → 原生控件映射 EP 组件,颜色映射最近似 token,重复内容提为数据 |

### Step 2 — 模板参考(结构参考 + 完备性清单,只读)

1. 用 `query_assets.mjs templates` 摘要选**最接近**的模板(六套:standard-list / device-management / edit-form / object-detail / topology-monitoring / alarm-impact)。
2. 读该模板 JSON 的 `criticalInteractions`(搜索/分页/批量等)与 `pageStates`(loading/empty/error/forbidden/partial/ready),再读其 `source` 指向的 `.vue` 源码提取布局骨架。
3. 以此作为**结构与交互完备性对照清单**,然后按工作区代码规范自由写码——**配置驱动机制已废弃**,不生成、不引用任何模板配置 JSON;模板源码只读不拷贝。

### Step 3 — Init Workspace(MANDATORY)

1. **Confirm {artifact-folder}**:运行时上下文提供的绝对路径;缺失则回退当前工作目录。
2. **Derive {slug}**:kebab-case ASCII,2–6 段语义英文("设备管理" → `device-management`)。
3. **Init**:`node SKILL/scripts/init.mjs "{artifact-folder}" "{slug}" --assets-root <ASSETS_ROOT>`(命令细节与 RESULT 输出见 [references/usage.md](references/usage.md))。

### Step 4 — 组件匹配与复用(hybrid / reuse)

1. 对页面需要的每个能力,用 `query_assets.mjs components --search <关键词>` 圈候选,读 spec 的 `useWhen`/`states` 确认语义匹配。
2. **命中** → 用 `collect_component.mjs` 一次性拷贝依赖闭包(命令细节见 [references/usage.md](references/usage.md))。拷入的文件**禁止改写**(含来源注释),页面以标准 import 消费。
3. **未命中** → AI 手写(遵循 [references/code-conventions.md](references/code-conventions.md)),组件头注释注明手写原因;`reuse` 模式必须把 gap 汇总告知用户。

### Step 5 — 写码

在 `SRC_DIR` 下按 [references/code-conventions.md](references/code-conventions.md) 编写页面。核心纪律:

- `views/{slug}/index.vue` 为页面主组件(替换 starter),以组合编排为主。
- **拆分触发式**:子组件仅在 **>150 行 / 被复用 / 状态复杂** 时才拆出独立文件(常规页面约 4-8 个文件);页面私有放 `views/{slug}/components/`,跨页复用放 `src/components/`(复用的 G 组件由 collect 平铺落位到 `src/components/GName/`)。
- **无依赖的文件并行写**:constants.js、locales.js、mock 数据、互不依赖的子组件可在同一轮并行创建。
- **常量放 `views/{slug}/js/constants.js`**(全大写+下划线);页面词条放 `src/locales/pages/{slug}.js`(单文件双语言)。
- **写码前先规划后落笔(preflight 强制)**:先列出每个待写文件的 imports——按目录显式算好相对路径前缀(`views/{slug}/` 出发上两级 `../../`,`views/{slug}/components/` 出发上三级 `../../../`;components/ 下少写一级是历史最高频 build FAIL 项)。汇总本轮要用的全部 token 变量名、图标名、element-plus 导出名、词条 key,一次提交 preflight 一条命令校验(命令细节见 [references/usage.md](references/usage.md))。`RESULT: OK` 后以清单为准落笔——写码过程中 token/词条/路径以清单为准,不再现场发明。
- **分批 build 早暴露**:build 毫秒级,不要等全部文件写完才跑——首个子组件 + constants/locales 写完即跑一轮(token 拼写/白名单类错误在第一个组件就暴露),全部写完再跑最终轮。

### Step 6 — Build & Smoke(MANDATORY,自动刷新预览)

build 与 smoke 命令见 [references/usage.md](references/usage.md)。**build + smoke 一轮跑完 = 生成流程结束。** 不再起 serve / curl 探活 / 查杀进程 / 重复验证——smoke 自带渲染、token 品牌色、明暗切换、404 检查并自查进程清理。失败修复后重跑(最多 3 次)。

### Step 7 — Output

```
<artifact type="text/link">{HTML_PATH value}</artifact>
```

直接在浏览器打开 `index.html` 即可预览(file:// 可直接加载);用户需要本机预览地址时才启动 `serve.mjs`(见 usage.md)。

交付说明需注明:演示假设与未验证项、组件复用 gap(reuse 模式必述)、以及二次开发入口(改 `src/api/{slug}.js` 对接真实接口,页面零改动)。

## Modification Workflow(修改已生成页面)

用户要求修改已生成页面时,**不要重新生成**:

1. **Locate:** `{artifact-folder}/{slug}/src/views/{slug}/...`
2. **Edit:** 只做请求的改动——未提及内容保持不变。
3. **Re-verify:** 重跑 `build.mjs` → 输出同一 `<artifact>` link。

## 换肤系统

页面消费 token(`src/assets/tokens/` 全套,init 现取)→ 任何皮肤下自动跟随。明暗协议:`data-theme="light|dark"`,运行时切换 `document.documentElement.setAttribute('data-theme', …)`。自定义皮肤:`theme-{name}.css` 放 `src/assets/themes/`,按该目录 README 协议注册。

## 毛玻璃

毛玻璃无特殊机制——它就是 token + 规范文档。需求涉及毛玻璃时**按需读**资产库 `design/frosted-glass.md`(何时用/不用、control/card/overlay 预设、应用预算),用 `query_assets.mjs tokens frost-common` 查数值。

## 触发式引用表

| 场景 | 读哪个 |
|---|---|
| 写 API/mock/i18n/样式/路径/二开差异 | [references/code-conventions.md](references/code-conventions.md) |
| 六脚本 CLI 速览(init/collect/preflight/build/serve/smoke) | [references/usage.md](references/usage.md) |
| 拷入 G 组件的格式契约(给设计师) | [docs/for-designers/component-format.md](docs/for-designers/component-format.md) |
| 设计师问怎么提新组件 | [docs/for-designers/designer-component-guide.md](docs/for-designers/designer-component-guide.md) |
| 接新 UI 库(SweetUI 等) | [docs/extensions/ui-runtime.md](docs/extensions/ui-runtime.md) |
| 跨阶段交接产物 schema | [docs/handoff/task-handoff.schema.json](docs/handoff/task-handoff.schema.json) |
