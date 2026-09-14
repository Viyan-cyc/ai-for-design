---
name: generate-ux-prototype
description: Generate or edit a G Design page as real Vue 3 + Element Plus 2.13.5 source code (.vue workspace with api adapter, mock, i18n) plus a zero-build offline preview; tokens and reusable components are fetched live from the local asset library. Accepts text requirements, module descriptions, screenshots or raw HTML. Triggers on "页面生成", "原型", "Vue 页面", "Element Plus", "列表页", "看板", "截图转码".
---

# 生成 G Design 原型（Vue 3 源码交付）

交付 Vue 3 `.vue` SFC(`<script setup>` 纯 JS)+ Less + ESM import,写在 `{slug}/src/`;附带零构建离线预览 `{slug}/index.html`。token/组件/模板/规则全部生成时从资产库现取,skill 目录不存副本。

## 技术栈

Vue 3 `<script setup>` 纯 JS / Element Plus **2.13.5** / Vue Router 4.x / Less / px。裸 import 白名单:`vue` `vue-router` `element-plus` `@element-plus/icons-vue` `dayjs`。

## 资产库定位

先定位 LIBRARY(内含 `asset-manifest.json`):① 用户给定 `ASSETS_ROOT` 优先;② 未指定读 `agents/package-location.json`→核对包根 `skill-catalog.json`;③ 整包模式 `asset-catalog.json`→`libraries['g-design-enterprise'].root`;④ 路径失效先在已知位置找,仍缺才问。定位后读 `asset-manifest.json`+`asset-library.contract.json`;规范入口 `design/rules.md`,颜色按需读 `design/color-rules.md`+`design/color-tokens.md`。

## 上下文预算守卫（64k 模型强制）

**绝对禁止读取（单个文件即爆上下文）:**
- 资产库 `design/tokens.json`(~47k tok)、`design/tokens.md`(~20k tok)、`design/color-tokens.md`(~14k tok)、`design/index.json`(~7k tok)——token 数值用 `query_assets.mjs tokens <group>` 查,不直接读文件
- 工作区根 `SKILL-REPLACE-PLAN.md`(~10k tok)、`validation-results.json`——历史决策记录,与生成无关

**禁止读取(除非用户明确要求):**
- `scripts/` 下 `.mjs` 源码——命令格式见 usage.md
- `docs/` 下所有文件
- `scripts/preview/` `scripts/verify/` 下所有文件
- 工作区根 `README.md` `UPGRADE-LOG.md` `workflow.md` `skill-catalog.json`

**每轮只读当前步骤必需的文件**,不预读后续步骤。已写入的文件不回读(build 报错时只读报错文件)。资产库只读:`asset-manifest.json`+`asset-library.contract.json`+`design/rules.md`(共~1.8k tok);颜色规则按需读 `design/color-rules.md`(~2.7k tok);token 数值一律走 `query_assets.mjs`。

## Output Contract

结构详见 code-conventions.md §8。**Edit ONLY:** `views/**` `components/**` `api/**` `locales/**` `router/index.js`(仅路由条目) `mock/**` `assets/uploads|images|themes/`。**FIXED:** 其余文件。router/index.js 白页防线:不得挪动/改名/内联;history 必须 `createWebHashHistory` 或 `createMemoryHistory`;只准往 `routes` 加条目。

## 组件模式开关

| 模式 | 行为 |
|---|---|
| `reuse` | 命中库组件必须复用;未命中记 gap 告知 |
| `hybrid`(默认) | 按 spec useWhen 匹配;命中→拷贝复用,未命中→手写 |
| `free` | 跳过匹配,全部手写 |

写入 `views/{slug}/js/constants.js` 的 `COMPONENT_MODE`。

## 生成流程

### Step 1 — 输入解析

**意图先行**:用户发设计稿/截图要「还原/重新生成」时直接全新生成(新 slug 新目录),不读旧页面;只有明确说「修改」才走 Modification Workflow。

| 输入 | 关键规则 |
|---|---|
| 页面描述 | 扩展完备性(B 端=顶栏+侧导航+主内容+状态反馈) |
| 模块描述 | 单 UI 块→独立组件+页面展示包裹 |
| 截图 | 映射 EP+token;**数据保真转录**:行数列数与图一致,逐格读取,严禁行间复制 |
| Raw HTML | DOM/CSS→EP 组件映射,颜色→最近 token,重复内容提数据 |

### Step 2 — 模板参考(只读)

`query_assets.mjs templates` 摘要选最接近模板(六套:standard-list/device-management/edit-form/object-detail/topology-monitoring/alarm-impact)。读其 `criticalInteractions`+`pageStates`,再读 `source` 指向的 `.vue` 提取骨架。作为结构完备性对照清单,按 code-conventions 自由写码。模板源码只读不拷贝。

### Step 3 — Init(MANDATORY)

Confirm `{artifact-folder}`(运行时绝对路径,缺失回退当前目录)→ Derive `{slug}`(kebab-case,2–6 段)→ `node SKILL/scripts/init.mjs "{artifact-folder}" "{slug}" --assets-root <ASSETS_ROOT>`(命令细节见 usage.md)。

### Step 4 — 组件匹配(hybrid/reuse)

`query_assets.mjs components --search <关键词>` 圈候选,读 spec `useWhen`/`states` 确认。命中→`collect_component.mjs` 拷贝闭包(命令见 usage.md),拷入文件禁止改写。未命中→手写(遵循 code-conventions.md),注明原因;reuse 模式汇总 gap 告知。

### Step 5 — 写码

按 code-conventions.md 编写。核心纪律:
- `views/{slug}/index.vue` 为页面主组件,组合编排为主。
- 子组件仅在 >150 行/被复用/状态复杂时拆出(常规 4-8 文件);私有放 `views/{slug}/components/`,跨页复用放 `src/components/`。
- 无依赖文件并行写:constants.js、locales.js、mock、子组件同一轮。
- 常量→`views/{slug}/js/constants.js`;词条→`src/locales/pages/{slug}.js`。
- **preflight 强制**:写码前列出每个文件 imports(按目录算路径:`views/{slug}/`→`../../`,`views/{slug}/components/`→`../../../`),汇总全部 token/图标/EP 导出/词条 key,一条命令校验(命令见 usage.md)。`RESULT: OK` 后落笔。
- **分批 build**:首个子组件+constants/locales 写完即跑一轮;全部写完跑最终轮。

### Step 6 — Build & Smoke(MANDATORY)

命令见 usage.md。**build+smoke 一轮=流程结束。** 不起 serve/curl/查杀进程/重复验证。失败修复后重跑(最多 3 次)。

### Step 7 — Output

```
<artifact type="text/link">{HTML_PATH value}</artifact>
```

浏览器直接打开 `index.html`(file:// 可加载);用户要本机地址才启动 serve.mjs。交付说明注明:演示假设/未验证项/复用 gap(reuse 必述)/二开入口(改 `src/api/{slug}.js`,页面零改动)。

## Modification Workflow

不重新生成:① 定位 `{artifact-folder}/{slug}/src/views/{slug}/...` ② 只做请求的改动 ③ 重跑 build→输出同一 artifact link。

## 触发式引用表

| 场景 | 读 |
|---|---|
| API/mock/i18n/样式/路径 | code-conventions.md |
| 六脚本 CLI | usage.md |
| 毛玻璃 | LIBRARY `design/frosted-glass.md`+`query_assets.mjs tokens frost-common` |
| 换肤 | `data-theme="light|dark"`;自定义皮肤 `src/assets/themes/theme-{name}.css` |
| 设计师问组件格式/提新组件 | docs/for-designers/ |
| 接新 UI 库 | docs/extensions/ui-runtime.md |
| 跨阶段交接 | docs/handoff/task-handoff.schema.json |
