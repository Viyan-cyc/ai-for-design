# UI Runtime 扩展点（EP / SweetUI 接入说明）

> 当前唯一 runtime：**Element Plus 2.13.5**（官方 npm dist，决策点 C）。本文是预留口子的接入说明：接入新 UI 库 = 补齐「三件套」，架构不动，SKILL.md 生成流程不变。

## 三件套构成

UI 库在预览运行时与 build 校验中的全部痕迹收敛为三样东西，按「UI 库」为单位组织：

| # | 件 | 当前 element-plus 位置 | 内容 |
|---|---|---|---|
| 1 | **UMD 运行时目录** | `scripts/preview/public/library/element-plus/` | 浏览器端直接加载的全局构建产物，init 时整目录复制进工作区 `public/library/element-plus/` |
| 2 | **校验白名单** | `scripts/verify/whitelists/element-plus/*.json` | 三份 JSON：`components.json`(116) / `exports.json`(130) / `icons.json`(295)，build.mjs 逐标签/导出/图标名核对 |
| 3 | **token 桥接 CSS** | 资产库 `frontend/element-plus/tokens/element-plus.css` | 把资产库语义 token 映射到该 UI 库的 CSS 变量，随 token 全套进工作区 |

## 1. UMD 目录规范

`scripts/preview/public/library/{runtime}/` 下放置该 UI 库的浏览器全局构建（UMD/IIFE），`{runtime}` 为库目录名（如 `element-plus`、将来 `sweet-ui`）：

- 必须包含：库主 JS（如 `element-plus.full.min.js`）、样式（`element-plus.index.css`）、以及其依赖的全局构建（如 `vue.global.prod.js`、`vue-router.global.prod.js`、`dayjs.min.js`、图标包、locale 包、`less.min.js`、`vue3-sfc-loader.js`）。
- `scripts/preview/index.html` 引用上述文件的方式是**写死的 script/link 标签**（loader 完整性由 build.mjs 校验），接入新 runtime 需同步改写 `preview/index.html` 的第 1 节与本节表中的注册点（moduleCache 的库对象、locale 映射等）。
- init.mjs 按目录整体复制，新增 runtime 无需改 init。

## 2. 白名单格式

`scripts/verify/whitelists/{runtime}/` 下三份 JSON，schema 直接参照现有 element-plus 文件（均为字符串数组）：

- `components.json` — 模板中允许出现的 `<el-*>` 标签全集（116 个；来源 = 官方 dist 中有独立 theme-chalk css 的组件 + 5 个无独立 css 的组件）。
- `exports.json` — 允许 `import { … } from '{ui-lib}'` 的导出名全集（130 个）。
- `icons.json` — 图标包允许的导出名全集（295 个）。

build.mjs 从 `--dir` 工作区反查 `scripts/verify/whitelists/` 下的当前 runtime 目录（当前写死 `element-plus`）。接入 SweetUI 时：新增 `whitelists/sweet-ui/{components,exports,icons}.json`，并把 build.mjs 的白名单目录与 preview 的 script 标签一并切换；生成流程与 SKILL.md 不变。

## 3. token 桥接 CSS 要求

桥接文件把资产库语义 token 映射到目标 UI 库的组件变量，使 EP 组件（或目标库组件）自动跟随 `data-theme` 换肤。参照资产库 `element-plus.css` 的做法：`--el-color-primary` 等 97 个 `--el-*` 桥接变量映射自 `--g-*` / `--color-*` 语义层。

接入 SweetUI 时写一份 `sweet-ui.css` 桥接：

1. 放资产库 `frontend/element-plus/tokens/`（或将来独立 `tokens/sweet-ui.css`），init 的 token glob 会自动复制进工作区 `src/assets/tokens/`。
2. 变量名以目标库官方变量为准（如 `--el-color-primary` ↔ SweetUI 对应变量），值为资产库语义 token `var(--g-…)` / `var(--color-…)`，禁止 hex 直填。
3. 桥接层只做映射、不新增语义；新语义 token 走资产库 token 体系（design/tokens.json → build_tokens）。

## SweetUI 接入清单（实施时照此办理）

1. 取得 SweetUI UMD 构建与样式 → 放 `scripts/preview/public/library/sweet-ui/`（含依赖的全局构建）。
2. 从其官方产物导出三份白名单 → `scripts/verify/whitelists/sweet-ui/`。
3. 写 token 桥接 CSS（语义 token → SweetUI 变量），纳入资产库 token 层。
4. preview/index.html 第 1 节 script/link 与 moduleCache 注册切换到 sweet-ui；build.mjs 白名单目录切换。
5. init.mjs 复制逻辑核对（当前整目录复制 `element-plus/`，无硬编码文件清单，预期能直接复用）。

> 设计原则：接入是「补三样 + 切两处引用」，生成流程、工作区结构、代码规范、二次开发方式全部不变。
