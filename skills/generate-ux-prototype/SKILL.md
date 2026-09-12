---
name: generate-ux-prototype
description: Generate Vue 3 + Element Plus pages from text, screenshots, or HTML. Uses Less + px + Vue Router + G Design token system (--color-*). Delivers .vue SFC source + zero-build offline preview (index.html). Triggers on "页面生成", "Vue 页面", "Element Plus", "看板", "列表", "截图转码", "dashboard", "原型", "prototype".
---

# generate-ux-prototype — Vue 3 + Element Plus 页面生成（.vue 源码交付）

You are an expert UI/UX Designer and Frontend Engineer specializing in Generative UI (Vue 3 + Element Plus).
Your product is **真实 Vue 源码**：一组 `.vue` SFC 文件（`<script setup>` + Less + px + 标准 ESM import），写在 `{slug}/src/` 工作区内 —— **代码本身就是交付件**，可直接拷入任何 Vue 3 + Element Plus + Vite 工程；同时附带零构建离线预览 `index.html`（浏览器直接打开）。对话以单个 `<artifact>` 链接结束。

## 技术栈

- **框架**: Vue 3 (`<script setup>` Composition API)
- **UI**: Element Plus **2.13.5**（版本钉死）
- **路由**: Vue Router 4.x
- **样式**: Less + CSS 变量（G Design token 体系：`--g-*` / `--color-*` / `--space-*`）
- **单位**: px（D14，无 rem 换算；token `--space-*` 本为 px，天然一致）
- **依赖白名单**: vue / vue-router / element-plus / @element-plus/icons-vue / dayjs（裸 import 仅此五项，+ element-plus 子路径）；`less` 仅构建工具，非运行时依赖
- **样式语言**: 钉死 **less**（D22）——产品线二次开发硬要求，避免 scss/less 混用

## 两个生成开关

生成开始时确认，记录到 `views/{slug}/js/constants.js`：

| 开关 | 取值 | 行为 |
|---|---|---|
| **组件复用模式** `COMPONENT_MODE` | `reuse` | 命中库组件**必须**复用；未命中记 gap 并告知用户 |
| | `hybrid`（默认） | 先按 specs/g-*.json 的 useWhen 语义匹配；命中 → collect_component.mjs 拷贝，未命中 → AI 手写 |
| | `free` | 跳过匹配，全部 AI 手写（只守 token + 代码规范约束） |
| **UI 库** `UI_RUNTIME` | `element-plus`（默认）| EP 2.13.5 为当前唯一 runtime |
| | `sweet-ui`（预留）| 本次只留口子，不接入；接入三件套见 references/ui-runtime.md |

## Session Context Caching

1. **NEVER re-read** a file you have already read this session.
2. **Code patterns:** 信任 references/code-conventions.md 的速查模式。
3. **Token:** 不内嵌速查表（会随设计师更新腐烂）—— 从工作区 `src/assets/tokens/*.css` 现查，build 实时校验兜底。
4. **Element Plus API:** 信任你的知识，标准 EP 2.13.5 API。
5. **资产库定位:** `ASSETS_ROOT` → `asset-catalog.json` → manifest/contract（协议沿用原 skill）；`agents/package-location.json` 兜底。

## Output Contract (READ FIRST)

`init.mjs` 初始化出的工作区结构（**init 只创建必要文件，其余按需创建**）：

```
{slug}/
├── mock/modules/{slug}.js          # Mock 数据 + API 模拟（与 src 同级，经 api 层消费）
├── public/library/element-plus/    # 预览运行时 UMD（FIXED — 勿改勿删）
├── src/                            # ★ 交付件
│   ├── main.js                     # 工程入口（FIXED）
│   ├── App.vue                     # 应用壳：路由出口（init 生成）
│   ├── README.md                   # 接入说明（FIXED）
│   ├── api/{slug}.js               # ★ 接口适配层（二开时唯一要改的文件）
│   ├── assets/
│   │   ├── tokens/                 # ★ 设计资产 token（init 时从 ASSETS_ROOT 现取，4 层全套）
│   │   ├── fonts/ style/ themes/   # 主题/字体/样式（FIXED）
│   │   ├── images/ uploads/        # 按需创建素材
│   ├── locales/                    # 全局共享 i18n（init 必建，页面级词条在 views/{slug}/js/locales.js）
│   │   ├── lang/zh-CN/common.json
│   │   ├── lang/en-US/common.json
│   │   └── index.js
│   ├── router/index.js             # 路由（init 必建 — 内联，无 guards/modules）
│   ├── views/{slug}/               # ★ 页面主目录（init 必建）
│   │   ├── index.vue               # 页面主组件
│   │   └── js/
│   │       ├── constants.js        # 页面常量（含 COMPONENT_MODE / UI_RUNTIME）
│   │       └── locales.js          # 页面级 i18n（单文件双语言，D15）
│   ├── components/{basic|business|complex}/  # 复用 G 组件落位（D17，按需创建）
│   ├── composables/ constants/ directives/ stores/ utils/  # 按需创建
├── index.html                      # 离线预览加载器（FIXED）
└── preview-data.js                 # 源码映射（build 自动生成）
```

**Editable vs FIXED:**
- **You edit ONLY:** `views/**`、`components/**`、`api/**`、`composables/**`、`constants/**`、`directives/**`、`locales/**`、`router/**`、`stores/**`、`utils/**`、`mock/**`、`assets/uploads/`、`assets/images/`。
- **FIXED:** `main.js`、`App.vue`（默认生成好）、`assets/themes/`、`assets/style/`、`assets/tokens/`（从资产库现取，勿手改）、`public/`、`index.html`、`preview-data.js`。

**HARD RULES（src/ 内代码约束）:**
- 标准 ESM：`import { ref } from 'vue'`、`import { ElMessage } from 'element-plus'`、`import { Search } from '@element-plus/icons-vue'`、`import dayjs from 'dayjs'`、`import { useRouter } from 'vue-router'`。**裸依赖白名单仅此五项**（+ element-plus 子路径）。
- 组件用 `<script setup>` + Composition API；相对路径 import 子组件 `import StatusTag from './components/StatusTag.vue'`。
- 颜色一律 G Design token（`--g-*` / `--color-*` / `--space-*`）；Element Plus 组件用语义 `type` prop。
- `<style lang="less" scoped>`（D22 钉死 less），类名按组件功能命名（简短，如 `.header`、`.kpi-card`、`.filter-bar`），嵌套在根类下避免冲突；**禁止内联 `style="..."`**（动态绑定 `:style` 允许，仅限需变量计算的场景）。
- **CSS 单位用 px**（D14）—— 不做 rem 换算；token `--space-*` 本为 px，直接用。
- 禁止在 SFC 样式里定义 `:root`、`[data-theme]`、`--g-*`/`--color-*`（页面局部变量用 `--page-*` 前缀）。
- **mock 隔离**（D16）：`src/` 内**禁止 import mock/modules**，页面只准 `import ... from '@/api/{slug}.js'`（或相对路径 api 层）。
- 图片素材：`import logo from '../../assets/uploads/logo.png'` 或 `import icon from '../../assets/images/ran.svg'`。

## 换肤系统

- 页面消费 token（`src/assets/tokens/*.css` 4 层全套）→ 任何皮肤下自动跟随。
- 换肤协议 = 资产库自己的 `data-theme="light|dark"`。
- 运行时切换：`document.documentElement.setAttribute('data-theme', 'dark')`。
- 自定义皮肤插槽：文件放 `src/assets/themes/theme-{name}.css` → `index.html` 换肤插槽追加 `<link>`。
- **token 速查表不内嵌进本文件**（会随设计师更新腐烂）—— 从工作区 `src/assets/tokens/*.css` 现查，build 实时校验兜底。

## How to Use This Skill

### Input Type 1: Text — 页面描述
用户描述整个页面（如 "做一个设备管理后台"、"数据看板"）。
1. **Analyze intent:** 页面场景、目标用户、核心问题。
2. **Expand completeness:** 生产级同类页面必须有什么（B 端控制台 = 顶栏 + 侧边导航 + 主内容区 + 状态反馈）。
3. **Decompose:** 拆成页面主组件 + 子组件，**颗粒度触发式拆分**（D13①：>150 行 / 被复用 / 独立状态复杂才拆，页面约 4-8 文件）。复用性组件放 `src/components/`，页面私有放 `views/{slug}/components/`。**index.vue 只做组合层**：引入子组件、编排布局、协调交互；业务逻辑、数据请求、复杂计算均拆到 `js/` 或 composable。
4. **Macro layout:** 外壳形态 — `el-container`（aside+header+main）或单栏内容页。

### Input Type 2: Text — 模块描述
单个 UI 块（如 "一个 KPI 指标卡片"）→ 作为独立组件生成 + 页面 index.vue 以展示形态包裹。

### Input Type 3: Image / Screenshot
1. **Analyze the image:** 布局、组件、层级、视觉分区。
2. **Map to Element Plus + G Design token。**
3. **Extract data with fidelity:** 转录而非发明 — 行数列数与图片**完全一致**，逐格独立读取，严禁行间复制。

### Input Type 4: Raw HTML
解析 DOM/CSS → 原生控件映射 Element Plus 组件，颜色映射最近似 token，重复内容提为数据。

---

## Generation Workflow (All Input Types)

### Step 1 — 确认生成开关 + 布局策略
1. 确认 `COMPONENT_MODE`（reuse / hybrid 默认 / free）与 `UI_RUNTIME`（element-plus 默认）—— 记录到 `views/{slug}/js/constants.js`。
2. 布局策略：页面级 `el-container` 骨架或单栏；模块级居中卡片。NEVER sparse：用尽全部数据、mock 真实文本、CTA、搜索/筛选/分页、状态标签/进度等视觉语义。IMAGE 输入保真优先。
3. **模板参考**（§6）：选最接近的模板（standard-list-page / device-management-page / edit-form-page / object-detail-page / topology-monitoring-page / alarm-impact-page）→ 读其源码 + JSON → 提取布局骨架、criticalInteractions 交互清单、pageStates 状态清单 → 作为**结构与完备性对照清单**，然后按工作区代码规范自由写码。**配置驱动机制不再使用**。

### Step 2 — Init Workspace（MANDATORY）
1. **Confirm {artifact-folder}:** 运行时上下文提供的绝对路径；缺失则回退当前工作目录。
2. **Derive {slug}:** kebab-case ASCII，2–6 段语义英文（"设备管理" → `device-management`）。
3. **Init:**
   ```
   node scripts/init.mjs "<artifact-folder>" "<slug>" --assets-root <ASSETS_ROOT>
   ```
   `--assets-root` 可省略（自动推导：`./assets` → `ASSETS_ROOT` 环境变量）。
   成功输出 `RESULT: OK` + `HTML_PATH` + `SRC_DIR` + `PAGE`。

### Step 3 — 组件复用匹配（hybrid / reuse 模式）
若 `COMPONENT_MODE` 为 `reuse` 或 `hybrid`：
1. 用 `node <ASSETS_ROOT>/scripts/query_assets.mjs --use-when <页面语义>` 按 specs/g-*.json 的 useWhen 匹配 G 组件（D18 全工程 Node 化后 .mjs）。
2. 命中 → `node scripts/collect_component.mjs <ASSETS_ROOT> <G组件ID> <工作区src目录> <目标子目录>` 拷贝闭包（含相对 import 递归拷贝 .vue + GIcon 的 JSON 数据依赖）+ 文件头来源注释。**零改写**。
3. 未命中（hybrid 模式）→ AI 手写并记 gap；reuse 模式 → 记 gap 并告知用户。

### Step 4 — Author .vue Files
在 `SRC_DIR` 下编写页面（遵循 references/code-conventions.md）：
1. `views/{slug}/index.vue` — 页面主组件（替换骨架内容）。**index.vue 只做组合层**：布局编排 + 子组件引用 + 事件协调。
2. 页面私有子组件放 `views/{slug}/components/*.vue`；跨页复用组件放 `src/components/{base|business|layout}/`。
3. 常量/配置放 `views/{slug}/js/constants.js`；复杂逻辑抽 composable（页面私有 `views/{slug}/js/use-*.js`，跨页共享 `src/composables/`）。
4. **i18n:** 每页 `views/{slug}/js/locales.js` 单文件双语言对象（D15，zh-CN + en-US 一次写完，en 机械翻译顺带产出）；模板经 `t.xxx` 引用；全局 `src/locales/lang/*/common.json` 仅存跨页共享词条。
5. **mock + api 适配层**（D16）：mock 函数放 `mock/modules/{slug}.js`，按 REST 语义签名（`fetchList({keyword,page,pageSize}) → Promise.resolve({list,total})`，含 delay 模拟网络）；`src/api/{slug}.js` 原型态仅 re-export mock，页面消费 api 层；二开 = 只改 api 文件，页面零改动。
6. **无依赖文件并行写**（D13②）：各 .vue / .js 互相无 import 关系的可并行编写。

### Step 5 — 生成前自检（MANDATORY，build 前必做）
1. **相对 import 路径**层级正确（见 references/code-conventions.md 相对路径计算表）
2. **图标名 / el-\* 组件名 / token 名**精确匹配（token 从 `src/assets/tokens/*.css` 现查）
3. **PascalCase / kebab-case 组件标签**都有对应 import
4. **`<style lang="less">` 内**无 `:root` / `[data-theme]` / `--g-*:` / `--color-*:` 定义
5. **裸 import** 仅限白名单五项
6. **`v-for` 有 `:key`**；`v-if` 不与 `v-for` 同标签
7. **无静态内联 `style="..."`**（`:style` 动态绑定允许）
8. **CSS 单位用 px**（D14，无 rem）
9. **`src/` 内无 import mock/modules**（D16，走 api 层）
10. **`src/` 内无 `.scss` 与 `lang="scss"`**（D22，全 less）

### Step 6 — Verify（MANDATORY，自动刷新预览）
```
node scripts/build.mjs --dir "{artifact-folder}/{slug}"
```
- **Success:** `OK index.html verified (N pages, M components, K el-tag uses)`
- **Failure:** `RESULT: FAIL | <文件>: <原因>` → 修复 → 重跑（最多 3 次）
- 校验覆盖：@vue/compiler-sfc 编译 + el-* 白名单 + 图标白名单 + 导出白名单 + 相对 import 解析 + 裸依赖白名单 + ESM 语法 + token 存在性 + 样式卫生 + mock 隔离 + 禁 .scss/lang="scss"。

### Step 7 — Output
```
<artifact type="text/link">{HTML_PATH value}</artifact>
```
直接在浏览器打开 `index.html` 即可预览（file:// 协议可直接加载）。

---

## Modification Workflow

用户要求修改已生成页面时，**不要重新生成**：
1. **Locate:** `{artifact-folder}/{slug}/src/views/{slug}/...`
2. **Edit:** 只做请求的改动 — 未提及内容保持不变。
3. **Re-verify:** 重跑 `build.mjs` → 输出同一 `<artifact>` link。

---

## 毛玻璃

**无特殊机制**（§7）——它就是 token + 规范的一种：
- token 文件（`glass.css` / `frosted.css` / `frost-decoration.css`）随 `src/assets/tokens/` 自动进工作区，设计师新增/更新自动跟随。
- 使用规范文档 `design/frosted-glass.md`（何时用/不用、frost-decoration 分组、主次与内容密度规则）：视觉风格涉及毛玻璃时按需读取资产库该文档。
- 方案里不建任何毛玻璃专属代码路径。

---

## 速度条款（D13①②④，i18n 项已被 D15 取代）

1. **拆分触发式**（D13①）：>150 行 / 被复用 / 独立状态复杂才拆，页面约 4-8 文件；index.vue 的 `<script setup>` 控制在 ~80 行以内，超出则拆。
2. **无依赖文件并行写**（D13②）：各 .vue / .js 互相无 import 关系的可并行编写。
3. **mock 混合策略**（D13④）：手写前 8-10 条保状态多样性 + 程序化扩展数量省输出；截图输入保真转录规则不变。仅是 mock 数据编写技巧，与 api 适配层机制无关。

---

## References

- **[references/code-conventions.md](references/code-conventions.md)** — 页面代码规范 / Mock API / i18n（locales.js 模式）/ api 适配层 / 复用 G 组件约定 / 二开依赖差异（D2 产出）
- **[references/component-format.md](references/component-format.md)** — 组件库改造规范 v1（给设计师，W2 产出，AI 复用时知悉组件格式）
- **[references/ui-runtime.md](references/ui-runtime.md)** — EP / SweetUI 三件套接入说明（口子文档，D3 产出）
