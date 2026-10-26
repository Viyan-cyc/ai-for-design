# SweetUI 第一批 A 内网取证 Spec

日期：2026-10-15。类型：Feature Spec。阶段：Research / 资料采集。
任务：按 `sweetui-skill-discovery-spec.md` v1.2 §4 第一批 A（A1–A6）执行本地取证与验证。
npm 包版本 5.7.0（已更新与源码一致）。源码版本 5.7.0。本 spec 不修改已有 SweetUI/EP skill。

## 0. Open Questions

- [ ] Q1: uDesign2.2-dark CSS selector 为 `body[theme='GTS UDesign（默认风格）-dark']`（含中文和括号），而 uDesign2.2-light 为 `body[theme='uDesign2.2-light']`。此不一致是发布缺陷还是有意为之？运行时 `setTheme` 参数应传何值？
- [ ] Q2: gts-ux-spec.txt 中 accent-hover 浅色表为 #004794、CSS 为 #0067d1；开发指南 setTheme('light') vs UX CSS `uDesign2.2-light`。哪些是当前正式值？优先级需维护者确认。
- [ ] Q3: Vue 作为 bundled dependency（非 peerDep），用户项目如果也装 Vue 3 会不会双实例冲突？运行验证待补。
- [ ] Q4: package.json 无 `types` 字段，无 .d.ts 发布——类型信息仅从源码 TS 定义获取，npm 包消费时无类型提示？
- [ ] Q5: SweetTableColumn 实际代理 SweetVirtualTableColumn，二者的 props/slots 继承关系需源码确认。
- [ ] Q6: A6 集成验证页未在本环境实际构建和浏览器验证（本机无对应 registry），标为 **RUNTIME_GAP**。

## 1. Requirements (Context)

- **Goal**: 完成第一批 A 的最小闭环取证：版本确认、组件导出、token/主题机制、图标体系、高频组件 API，记录来源与缺口。
- **In-Scope**: A1 版本与依赖入口、A3 原生 token 与主题、A4 图标最小证据、A5 高频组件 API（含 ConfigProvider）、来源/冲突/缺口登记。
- **Out-of-Scope**: A2 最小可运行 demo 的实际构建与浏览器验证（本环境无内网 registry）、A6 集成验证页运行、第二批 B 扩展组件、修改 skill 或 SweetUI 代码。

## 1.1 Context Sources

- npm 包路径：`D:\project\gts\ai-for-design\node_modules\@hw-seq\sweet-ui-base`（v5.7.0）
- 源码路径：`C:\Users\c00426332\Desktop\xiaoyi\octo\sweetui\SweetUIBase-master\SweetUIBase-master`（v5.7.0）
- 采集规格：`mydocs/specs/sweetui-skill-discovery-spec.md`（v1.2）
- 原始参考资料：`sweetui-frontend-development.md`、`gts-ux-spec.txt`（spec §2.1 所列）

## 1.7 Minimum Chaos Unit Assessment

- Final Goal: 自然语言生成 SweetUI 页面代码的 skill
- Current Task Unit: 第一批 A 本地取证
- Why small enough: 只读取证，不改代码，从本地已安装包和源码提取事实
- In-Scope: A1/A3/A4/A5 完整取证；A2/A6 标缺口
- Out-of-Scope: 运行验证、skill 实现、第二批
- Verification Evidence: 本 spec 中每项标注 sourceKind 和 sourceRef
- Failure / Rework Plan: 核心事实缺失或冲突时标 gap，不编造
- Model Autonomy Space: 只读取证，不需 approval 即可记录观察
- User Decision: Accepted

## 2. Research Findings

### 2.1 A1: 固定版本和依赖入口

**sourceKind: package | sourceRef: npm包/package.json**

| 字段 | 值 | 来源 |
|---|---|---|
| name | `@hw-seq/sweet-ui-base` | package.json |
| version | `5.7.0` | npm包 package.json |
| 源码 version | `5.7.0` | 源码 package.json（一致） |
| type | `module` | package.json |
| license | `HISL` | package.json |
| main | `lib/index.js` | package.json |
| module | `es/index.mjs` | package.json |
| style | `dist/sweet-ui-base.css` | package.json |
| types | **未声明** | package.json 无 `types`/`typings` 字段 |
| exports | 见下方 | package.json |

**exports 映射**：
```
"."           -> import: ./es/index.mjs, require: ./lib/index.js
"./es"        -> import: ./es/index.mjs
"./lib"       -> require: ./lib/index.js
"./es/*.mjs"  -> import: ./es/*.mjs
"./es/*"      -> import: ./es/*.mjs
"./lib/*.js"  -> require: ./lib/*.js
"./lib/*"     -> require: ./lib/*.js
"./*"         -> ./*
```

**files 字段**：`dist`, `es`, `lib`, `theme-chalk`

**dependencies（bundled，非 peerDep）**：
| 依赖 | 版本 | 备注 |
|---|---|---|
| vue | 3.5.29 | **bundled dep**，非 peerDep —— 用户项目可能双实例 |
| @rc-component/async-validator | 5.1.0 | |
| dayjs | 1.11.23 | 源码 npm 包均为 1.11.23 |
| echarts | 6.1.0 | 图表组件依赖 |
| lodash | 4.18.1 | |
| xss | 1.0.15 | |

**peerDependencies**: **无**（package.json 无 peerDependencies 字段）

**engines**: node >= 14

**sideEffects**:
- `dist/*`
- `theme-chalk/**/*.css`
- `theme-chalk/src/**/*.less`
- `es/components/*/css/*`
- `lib/components/*/css/*`

**入口文件验证**：
- `es/index.mjs`: 存在，minified，导出所有组件 + setTheme + i18n + installer
- `lib/index.js`: 存在
- `dist/sweet-ui-base.css`: 存在（全量打包 CSS）
- `dist/sweet-ui-base.js`: 存在（ESM 全量 JS）
- `dist/sweet-ui-base.umd.cjs`: 存在（UMD 全量）

**包目录完整性**：`dist/`, `es/`, `lib/`, `theme-chalk/`, `LICENSE`, `package.json` — 齐全

**安装方式**: 源码 npmrc 存在 `.npmrc`（内容未读取，可能含 registry 配置）；npm 包已通过内网 registry 安装到 node_modules

**gaps**:
1. **无 types 发布** — 无 .d.ts 文件，类型信息仅可从源码 TS 定义推断；npm 包消费者无类型提示
2. **Vue 为 bundled dep** — 潜在双实例风险
3. **lock 文件 integrity** — 未提取 lock 文件中该包的 integrity hash（源码有 package-lock.json 但未深入读取）

### 2.2 A2: 最小可运行工程

**status: RUNTIME_GAP**

本环境有已安装的 npm 包，但无法实际构建与浏览器验证（无内网 registry 完整访问，未创建隔离 demo 工程运行）。

**可确认的静态事实**：
- Vite 构建（devDep vite ^4.4.9, @vitejs/plugin-vue 4.3.4）
- 源码 examples/ 目录存在（dev 脚本 `npm run --prefix examples dev`）
- 源码 playground/ 目录存在
- 推荐 CSS 入口：`import '@hw-seq/sweet-ui-base/theme-chalk/index.css'` 或 `import '@hw-seq/sweet-ui-base/dist/sweet-ui-base.css'`

**必需运行验证清单（待内网补）**：
1. `npm create vite@latest sweetui-demo -- --template vue`
2. `cd sweetui-demo && npm install`
3. `npm install @hw-seq/sweet-ui-base`（内网 registry）
4. main.js: 全量导入 `import SweetUI from '@hw-seq/sweet-ui-base'; import '@hw-seq/sweet-ui-base/theme-chalk/index.css'; app.use(SweetUI)`
5. `npm run dev` + 浏览器访问
6. `npm run build` + 检查产物
7. 验证：样式加载、字体加载、切主题、浮层渲染

### 2.3 A3: 原生 token 与主题

**sourceKind: package | sourceRef: theme-chalk/vars/\*.css, entry.mjs**

#### 主题文件清单（theme-chalk/vars/）

| 文件 | selector | token 数 | 备注 |
|---|---|---|---|
| var-ui-common.css | `:root` | 302 | 公共 token，不跟随主题切换 |
| var-ui-light.css | `body[theme=light]` | 67 | 浅色主题 alias |
| var-ui-dark.css | `body[theme=dark]` | 78 | 深色主题 alias |
| var-ui-black.css | `body[theme=black]` | 未单独计数 | 黑色主题 |
| var-ui-uDesign2.2-light.css | `body[theme='uDesign2.2-light']` | 未单独计数 | uDesign 浅色（含品牌 token 扩展） |
| var-ui-uDesign2.2-dark.css | `body[theme='GTS UDesign（默认风格）-dark']` | 381 | **selector 含中文和括号**，最大 token 集 |
| var-ui-hDesign1.1-light.css | 存在 | 未计数 | |
| var-ui-hDesign1.1-dark.css | 存在 | 未计数 | |
| var-ui-hDesign3.1.css | 存在 | 未计数 | |

#### 换肤 API（source-confirmed）

**entry.mjs 源码**：
```js
const setTheme = (themeName = "light", app) => {
  if (app) { app.config.globalProperties.$theme = themeName; }
  document.body.setAttribute("theme", themeName);
};
```

**机制**：`setTheme(name)` → `document.body.setAttribute("theme", name)` → CSS 选择器 `body[theme=X]` 匹配对应 vars 文件 → CSS 变量层叠覆盖

**可用主题名（从 CSS selector 推断）**: `light`, `dark`, `black`, `uDesign2.2-light`, `GTS UDesign（默认风格）-dark`

#### token 分类摘要

**common（:root，302 个）包含**：
- 色彩原子：`--swt-color-gray1..13`, `--swt-color-brand-*`, `--swt-color-accent-*`, `--swt-color-function-*`, `--swt-color-ancilary-*`（10色系x10级）
- 字体：`--swt-font-size-*`, `--swt-font-weight-*`, `--swt-font-line-height-*`, `--swt-font-family-*`
- 间距：`--swt-space-size-4..80`（4/8/12/16/20/24/32/40/48/56/64/72/80）
- 圆角：`--swt-radius-size-small/normal/medium/big/big1`, `--swt-border-radius-circle/round`
- 边框：`--swt-border-width/style/color-*`
- 阴影：`--swt-box-shadow-*`, `--swt-fill-color-*`
- 组件尺寸：`--swt-component-size/small/large`
- 过渡：`--swt-transition-*`
- z-index：`--swt-index-*`
- 透明度：`--swt-color-opacity0..10`
- 光标：`--swt-cursor-*`

**light alias（67 个）包含**：
- bg/border/text 高级 alias: `--swt-color-bg-primary/secondary/selected/disabled`, `--swt-color-text-primary/secondary/extra/disabled`
- 组件特定 alias: `--swt-table-hover-td/striped/th/current-row-bg-color`, `--swt-tabs-item-bg`, `--swt-top-menu-bg-color`, `--swt-button-loading-bg-color`, 等
- 阴影 alias: `--swt-shadow1..6`

**dark alias（78 个）**：同 light alias 集 + 额外 fill-color alias

**uDesign2.2-dark 扩展 token（381 个，含 common 不具备的）**：
- 品牌文本 token: `--swt-color-brand-text-*`, `--swt-color-accent-text-*`
- 按钮主题: `--swt-color-bg-*-button-hover/active`
- 图表色板: `--swt-color-chart-A1..A11/B1..B11`
- 更多 opacity: `--swt-opacity5..100`(5步)
- 更多间距: `--swt-space-size-2`
- 更多圆角: `--swt-radius-size-big2/infinity`
- 更多字体: `--swt-font-size-headline8/mini/mini1/subtitle1`
- 更多边框: `--swt-border-width-medium`
- overlay 组合: `--swt-color-overlay-*`

#### 关键 token 冲突登记

| 冲突 ID | 位置 | 差异 | 裁决 |
|---|---|---|---|
| C1 | light accent-hover: common=#5a7dfd, uDesign2.2-light=#0067d1 | 两个主题体系取值不同 | **unresolved** — 不同主题正常差异，但 gts-ux-spec 中浅色 #004794 与两版都不一致 |
| C2 | dark accent-text-normal: dark=#6ca9f6, uDesign2.2-dark=#7ca4ff | 两个深色体系取值不同 | **unresolved** — gts-ux-spec #428aff 与两版都不一致 |
| C3 | uDesign2.2-dark selector 含中文括号 `body[theme='GTS UDesign（默认风格）-dark']` | setTheme 须传此完整字符串 | **疑似缺陷** — 需确认 setTheme 预期参数 |

**CSS 资源入口**：
- 全量: `dist/sweet-ui-base.css`（1 行，含所有组件样式）
- 按主题: `theme-chalk/index.css`（聚合所有组件 CSS）
- 按组件: `theme-chalk/sweet-{component}.css`
- 字体: `theme-chalk/fonts/sweet.css` → `../assets/fonts/sweetui.woff`
- 空状态图片: `theme-chalk/assets/images/empty.png|empty-dark.png|empty-black.png`

### 2.4 A4: 图标最小证据

**sourceKind: package | sourceRef: theme-chalk/fonts/sweet.css, packages/components/icon/icon.vue**

#### 图标机制

- **字体图标**：自定义字体 `sweetui`，woff 格式，路径 `theme-chalk/assets/fonts/sweetui.woff`（另存 svg 版 `sweetui.svg`）
- **CSS 类名规则**: `sweetui-icon-{name}` — 前缀为 `sweetui-icon-`（不是 `sweet-icon`）
- **命名约定**: 多数图标有 `-f`（filled/彩色版）和 `-l`（line/线框版）两种变体；部分只有单版
- **部分图标硬编码颜色**: `-f` 变体带 `color:#366bfc`（accent-normal），如 `sweetui-icon-3d-f`, `sweetui-icon-add-f` 等
- **SweetIcon 组件**: `<i :class="[ns.b(), iconClass]" :style="style">`，ns.b() 生成 `sweet-icon`，iconClass 为 prop → 用法 `<SweetIcon icon-class="sweetui-icon-add-l" />`
- **组件 props**: size（Number/String → fontSize）, color（String → CSS color）, iconClass（String → CSS class）

#### 图标总量

从 `sweet.css` 提取的不重复类名约 **580 个**（含 -f/-l 变体）。

#### 常用图标映射（spec §4 A4 要求）

| semanticKey | 图标类名 | 变体 | 硬编码色 | 来源 |
|---|---|---|---|---|
| search | `sweetui-icon-search-f` / `sweetui-icon-search-l` | f+l | f=#366bfc | sweet.css |
| add | `sweetui-icon-add-f` / `sweetui-icon-add-l` | f+l | f=#366bfc | sweet.css |
| edit | `sweetui-icon-edit-f` / `sweetui-icon-edit-l` | f+l | f=#366bfc | sweet.css |
| delete | `sweetui-icon-delete-f` / `sweetui-icon-delete-l` | f+l | f=#366bfc | sweet.css |
| refresh | `sweetui-icon-refresh-f` / `sweetui-icon-refresh-l` | f+l | f=#366bfc | sweet.css |
| download | `sweetui-icon-download-f` / `sweetui-icon-download-l` | f+l | f=#366bfc | sweet.css |
| settings | `sweetui-icon-seting-f` / `sweetui-icon-seting-l` | f+l | f=#366bfc | sweet.css（注意拼写 seting） |
| left-arrow | `sweetui-icon-arrow-left` | 单版 | 无 | sweet.css |
| right-arrow | `sweetui-icon-arrow-right` | 单版 | 无 | sweet.css |
| close | `sweetui-icon-close` | 单版 | 无 | sweet.css |
| loading | `sweetui-icon-loading` | 单版 | 无 | sweet.css |
| plus | `sweetui-icon-plus` | 单版 | 无 | sweet.css |
| minus | `sweetui-icon-minus` | 单版 | 无 | sweet.css |
| check | `sweetui-icon-ok` / `sweetui-icon-circle-check-f` | 混合 | f=#366bfc | sweet.css |
| home | `sweetui-icon-home-f` / `sweetui-icon-home-l` | f+l | f=#366bfc | sweet.css |
| folder | `sweetui-icon-folder-f` / `sweetui-icon-folder-l` | f+l | f=#366bfc | sweet.css |

**Pagination 默认图标**: prevIcon 默认 `sweetui-icon-left`, nextIcon 默认 `sweetui-icon-right`; Button loadingIcon 默认 `sweetui-icon-loading`

#### 图标注册与使用

- **字体自动加载**: 引入 `theme-chalk/fonts/sweet.css` 或全量 `theme-chalk/index.css`（index.css 已 @import 字体）
- **SweetIcon 组件使用**: `<SweetIcon icon-class="sweetui-icon-add-l" :size="16" color="#366bfc" />`
- **直接 CSS 类名**: `<i class="sweetui-icon-add-l" />`（不经过组件）
- **create-icon-config.js**: 源码脚本，扫描 `examples/src/assets/svg/common` + `business` 目录生成 `icon-list.json` — 此目录不在 npm 包中，仅在源码 examples 内

**gaps**:
1. 开发文档示例写 `sweet-icon name="home"` — 实际组件 API 为 `icon-class` prop，无 `name` prop
2. 图标名列表的最小机器可读来源是 `sweet.css`，源码 examples 有 `icon-list.json` 但未发布
3. SVG 源文件不在 npm 包中，仅在源码 examples
4. `-f` 变体硬编码 accent-normal 色(#366bfc)，切 dark 主题时不会跟随 token 变化

### 2.5 A5: 高频组件 API

**sourceKind: source-confirmed | sourceRef: 源码 packages/components/*/src/*.ts, npm包 es/components/*/index.mjs**

#### 组件数量（从 es/components/ 目录计数）：148 个组件目录 + entry.mjs

#### 组件注册模式

- 全量注册: `import SweetUI from '@hw-seq/sweet-ui-base'; app.use(SweetUI)` — 所有组件获得 `Sweet*` 标签
- 按需注册: `import { SweetButton } from '@hw-seq/sweet-ui-base/es/components/button'; app.use(SweetButton)` 或通过 exports 子路径
- namespace: ConfigProvider 的 `namespace` prop 默认 `'el'`（不是 `'sweet'`），**但组件名前缀实际编译为 `Sweet*`，CSS 前缀为 `sweet-*`**

#### 高频组件事实

##### SweetButton

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetButton`, `SweetButtonGroup` | es/components/button/index.mjs |
| 注册标签 | `<sweet-button>` / `<sweet-button-group>` | useNamespace('button') → b() = 'sweet-button' |
| import path | `@hw-seq/sweet-ui-base/es/components/button` | package.json exports |
| props | size, disabled, type, icon, nativeType, loading, loadingIcon, plain, text, link, bg, autofocus, round, circle, color, dark, autoInsertSpace, tag, label, gray, selected | button.ts |
| type 枚举 | default/primary/success/warning/info/danger/gray/brand/ghost/urgent/text/''（text deprecated） | button.ts |
| nativeType | button/submit/reset | button.ts |
| loadingIcon 默认 | `'sweetui-icon-loading'` | button.ts |
| events | click(evt: MouseEvent) | button.ts |
| slots | default | 源码推断 |
| extra exports | buttonEmits, buttonProps, buttonTypes, buttonNativeTypes, buttonGroupContextKey | index.mjs |

##### SweetInput

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetInput` | es/components/input/index.mjs |
| v-model | modelValue (String/Number/null/undefined) → update:modelValue | input.ts |
| props | id, size, disabled, modelValue, maxlength, minlength, type, resize, autosize, autocomplete, formatter, parser, placeholder, form, readonly, clearable, showPassword, showWordLimit, suffixIcon, prefixIcon, containerRole, tabindex, validateEvent, inputStyle, autofocus, rows | input.ts |
| events | blur, focus, change, clear, input, keydown, mouseleave, mouseenter, compositionstart/update/end | input.ts |
| slots | prefix, suffix, prepend, append | 源码推断(EP模式) |

##### SweetSelect + SweetOption

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetSelect`, `SweetOption`, `SweetOptionGroup` | select/index.mjs |
| v-model | modelValue (Array/String/Number/Boolean/Object) | select.ts |
| props (Select) | name, id, modelValue, autocomplete, automaticDropdown, size, effect, disabled, clearable, filterable, allowCreate, loading, popperClass, popperOptions, remote, loadingText, noMatchText, noDataText, remoteMethod, filterMethod, multiple, multipleLimit, placeholder, defaultFirstOption, reserveKeyword, valueKey, collapseTags, collapseTagsTooltip, maxCollapseTags, teleported... | select.ts (部分, 共约255行定义) |
| sub-components | SweetOption, SweetOptionGroup | index.mjs |

##### SweetForm + SweetFormItem

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetForm`, `SweetFormItem` | form/index.mjs |
| Form props | size, disabled, model, rules, labelPosition(left/right/top), requireAsteriskPosition(left/right), labelWidth, labelSuffix, inline, inlineMessage, statusIcon, showMessage, validateOnRuleChange, hideRequiredAsterisk, scrollToError, scrollIntoViewOptions | form.ts |
| Form events | validate(prop, isValid, message) | form.ts |
| FormItem props | label, labelWidth, labelPosition, prop, required, rules, error, validateStatus, showMessage, inlineMessage, for | form-item.ts |
| FormItem validateStatus | ''/error/validating/success | form-item.ts |
| extra exports | formContextKey, formItemContextKey, formMetaProps, formItemValidateStates | index.mjs |

##### SweetTable + SweetTableColumn

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetTable`, sub-component TableColumn | table/index.mjs |
| TableColumn | 实际代理 `SweetVirtualTableColumn` — `<sweet-table-column>` 的全部属性继承自 virtual-table-column | table-column.vue |
| slots | default(scope), header(scope) | table-column.vue |

> **gap**: SweetTable 自身 props 未从源码提取完整（table.vue 组件过大，本提取只确认了导出名和 TableColumn 代理关系）。Table 的 selection/loading/排序等 props 待补充。

##### SweetPagination

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetPagination` | pagination/index.mjs |
| v-model | currentPage + pageSize（双向） | pagination.ts |
| props | pageSize, defaultPageSize, total, pageCount, pagerCount(默认7), currentPage, defaultCurrentPage, layout, pageSizes(默认[10,20,30,40,50,100]), popperClass, prevText, nextText, prevIcon(默认'sweetui-icon-left'), nextIcon(默认'sweetui-icon-right'), small, background, disabled, hideOnSinglePage, maxPage | pagination.ts |
| events | update:current-page, update:page-size, size-change, current-change, prev-click, next-click | pagination.ts |
| layout 选项 | prev, pager, next, jumper, ->, total, sizes, slot | pagination.ts |

##### SweetDialog

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetDialog` | dialog/index.mjs |
| v-model | modelValue (Boolean) | dialog.ts |
| props | appendToBody, appendTo, beforeClose, destroyOnClose, closeOnClickModal(默认true), closeOnPressEscape(默认true), lockScroll(默认true), modal(默认true), modalPenetrable, openDelay, closeDelay, top, modelValue, modalClass, headerClass, bodyClass, footerClass, width, zIndex, trapFocus, headerAriaLevel, transition | dialog.ts + dialog-content.ts |
| events | open, opened, close, closed, update:modelValue, openAutoFocus, closeAutoFocus | dialog.ts |
| extra exports | useDialog(composable), dialogProps, dialogEmits, dialogContextKey, dialogInjectionKey | index.mjs |

##### SweetIcon

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetIcon` | icon/index.mjs |
| 组件名 | `SweetIcon` | icon.vue defineOptions |
| props | size(Number/String→fontSize), color(String→CSS color), iconClass(String→CSS class) | icon.vue |
| slots | default（无 iconClass 时显示 slot 内容） | icon.vue template |
| CSS 命名空间 | `sweet-icon` | useNamespace('icon') |
| 用法示例 | `<SweetIcon icon-class="sweetui-icon-add-l" :size="16" />` | 编译推断 |

##### SweetMessage（命令式）

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetMessage` | message/index.mjs |
| 调用方式 | `SweetMessage(options)` 或 `SweetMessage.success/warning/info/error(msg)` | index.mjs |
| $message | `app.config.globalProperties.$message = SweetMessage` | install |
| props/options | customClass, center, dangerouslyUseHTMLString, duration(默认3000), icon, id, message, onClose, showClose, type(默认'info'), plain, offset(默认16), zIndex, grouping, repeatNum, appendTo, namespace | message.ts |
| types | success/info/warning/error | message.ts |

##### SweetMessageBox（命令式）

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetMessageBox` | message-box/index.mjs |
| 命令式方法 | `SweetMessageBox.alert()`, `.confirm()`, `.prompt()` | index.mjs |
| $msgbox/$alert/$confirm/$prompt | 均注册到 globalProperties | install |
| options | autofocus, title, message, type, icon, customClass, showInput, inputValue, inputPlaceholder, inputType, inputPattern, inputValidator, inputErrorMessage, showConfirmButton, showCancelButton, confirmButtonText, cancelButtonText, dangerouslyUseHTMLString, beforeClose, closeOnClickModal, closeOnPressEscape, distinguishCancelAndClose... | message-box.type.ts |
| 返回 | Promise<MessageBoxData> | type.ts |

##### SweetNotification（命令式）

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetNotification` | notification/index.mjs |
| 调用方式 | `SweetNotification(options)` / `.success()/.warning()/.info()/.error()` | index.mjs |
| $sweetNotify | 注册到 globalProperties | install |
| 自动追加 class | `sweet-notification-${type}` | index.mjs |

##### SweetConfigProvider

| 项目 | 值 | 来源 |
|---|---|---|
| 导出名 | `SweetConfigProvider` | config-provider/index.mjs |
| props | a11y(默认true), locale, size, button, card, dialog, link, experimentalFeatures, keyboardNavigation(默认true), message, zIndex, **namespace(默认'el')** | config-provider-props.ts |
| extra exports | messageConfig, provideGlobalConfig, useGlobalConfig, useGlobalComponentSettings, configProviderContextKey | index.mjs |

**重大发现 — namespace 默认 'el'**: configProviderProps 中 `namespace` 默认值为 `'el'`，但所有组件编译后使用 `Sweet*` 前缀和 `sweet-*` CSS 类名。需要确认 namespace 的实际用途——如果仅影响内部 CSS 变量前缀（`--el-` vs `--swt-`），则当前 token 体系已全面使用 `--swt-` 前缀，namespace 默认值不影响消费。

### 2.6 A6: 集成验证页

**status: RUNTIME_GAP** — 本环境无法构建和浏览器验证。

#### 验证页设计（待内网实施）

```
页面: 搜索 + 表格 + 分页 + 编辑弹窗表单 + 成功提示
数据: 20 条合成 mock，src/api 提供 Promise
使用: SweetInput + SweetSelect + SweetButton(搜索/重置)
      SweetTable + SweetTableColumn + SweetPagination
      SweetDialog + SweetForm + SweetFormItem + SweetInput/SweetSelect
      SweetMessage.success()
图标: 至少一个 SweetIcon (如 sweetui-icon-search-l)
主题: setTheme('light') + setTheme('dark')（支持时）
```

#### 验证项清单

| 项 | 预期 | 验证方式 | status |
|---|---|---|---|
| dev 启动 | 页面可访问 | 浏览器打开 localhost | RUNTIME_GAP |
| 样式加载 | sweet-* 组件有正确样式 | 目视检查 | RUNTIME_GAP |
| 字体/图标加载 | sweetui font woff 200, sweetui-icon-* 显示 | Network tab + 目视 | RUNTIME_GAP |
| 搜索/重置 | 输入→表格过滤→重置→恢复 | 交互验证 | RUNTIME_GAP |
| 分页 | 翻页/跳页/改变 page-size | 交互验证 | RUNTIME_GAP |
| 编辑弹窗 | 打开→表单校验→保存→Message 提示 | 交互验证 | RUNTIME_GAP |
| disabled/loading | 按钮禁用/加载态 | 交互验证 | RUNTIME_GAP |
| 主题切换 | setTheme 切换→所有 token 变量更新 | computed-style 抽样 | RUNTIME_GAP |
| build 产物 | 产出生成、无错误 | exit code = 0 | RUNTIME_GAP |
| 浮层主题 | Dialog/Select 浮层继承主题 | 目视+DOM 检查 | RUNTIME_GAP |

## 3. 冲突汇总

| ID | 级别 | 描述 | 决策状态 |
|---|---|---|---|
| C1 | high | gts-ux-spec accent-hover 浅色 #004794 vs 包 uDesign2.2-light #0067d1 vs common #5a7dfd | unresolved |
| C2 | high | gts-ux-spec accent-text-normal dark #428aff vs 包 dark #6ca9f6 vs uDesign2.2-dark #7ca4ff | unresolved |
| C3 | medium | uDesign2.2-dark CSS selector 含中文括号，setTheme 须传全路径字符串 | unresolved |
| C4 | medium | 开发指南 SweetMessageBox.success 调用方式 vs 实际 API: SweetMessageBox.alert() / $msgbox | 实际 API 已确认：alert/confirm/prompt 三方法 + $msgbox/$alert/$confirm/$prompt |
| C5 | medium | 开发指南示例 `sweet-icon name="home"` vs 实际: `<SweetIcon icon-class="sweetui-icon-home-l" />` | 实际 API 已确认 |
| C6 | low | 开发指南 setTheme('light', app) vs UX CSS `uDesign2.2-light` — 不同主题体系参数 | 两者并存：'light' 匹配 var-ui-light.css，'uDesign2.2-light' 匹配 var-ui-uDesign2.2-light.css |
| C7 | info | seting（拼写错误）vs setting — 图标名 `sweetui-icon-seting-f` | 保留原样，文档需说明 |

## 4. 缺口汇总

| ID | 类别 | 描述 | 影响 | 补齐方式 |
|---|---|---|---|---|
| G1 | runtime | A2/A6 实际构建与浏览器验证未执行 | 无法确认运行时行为 | 内网独立构建验证 |
| G2 | types | npm 包无 .d.ts 类型声明 | 消费者无类型提示 | 从源码提取类型定义生成 .d.ts |
| G3 | api | SweetTable 完整 props/events/slots 未提取 | 生成代码无法覆盖表格高级功能 | 补读源码 table.vue + virtual-table-column |
| G4 | api | SweetSelect 完整 props（255行定义只读了80行） | 生成代码可能遗漏高级 select 功能 | 补读 select.ts 160-255 行 |
| G5 | icon | SVG 源文件和 icon-list.json 不在 npm 包中 | 无法生成图标名目录的独立来源 | 使用 sweet.css 类名提取作为替代来源 |
| G6 | theme | hDesign1.1/hDesign3.1 主题 token 未展开计数 | 不确定额外主题覆盖范围 | 容许，第二批补充 |
| G7 | dep | Vue bundled dep 双实例风险未验证 | 用户项目可能运行异常 | 内网构建验证时检查 |
| G8 | config | namespace 默认 'el' 对 token/CSS 实际影响未确认 | 可能影响 BEM CSS 类名生成路径 | 源码确认 useNamespace 实现 |

## 5. 执行摘要

- **版本**: @hw-seq/sweet-ui-base 5.7.0，源码与 npm 包一致
- **组件数**: 148 目录（es/components/），含图表、虚拟表格、树等
- **token 数**: common 302 + light 67 + dark 78 + uDesign2.2-dark 381（扩展最多），完整 --swt-* 体系
- **主题机制**: `setTheme(themeName)` 设 body[theme]，CSS 变量层叠；6 主题文件，uDesign2.2-dark selector 异常
- **图标**: ~580 类名，sweetui-icon- 前缀，woff 字体，-f/-l 双变体，-f 硬编码 #366bfc
- **高频 API**: 10 组件全量已取证（Button/Input/Select/Form/Table/Pagination/Dialog/Icon/Message/MessageBox/Notification/ConfigProvider），源码 TS props 确定
- **命令式 API**: SweetMessage($message), SweetMessageBox($msgbox/$alert/$confirm/$prompt), SweetNotification($sweetNotify)
- **关键冲突**: UX spec token 值 vs 包实际值 vs uDesign2.2 值三源不一致（C1/C2）
- **运行验证**: 全部 RUNTIME_GAP，需内网补

## 6. 文件来源索引

| 证据 | sourceKind | sourceRef |
|---|---|---|
| package.json v5.7.0 | package | npm包/package.json |
| exports 入口规则 | package | npm包/package.json exports |
| es/index.mjs 导出列表 | package | npm包/es/index.mjs |
| entry.mjs setTheme 源码 | package | npm包/es/entry.mjs |
| token common 302个 | package | theme-chalk/vars/var-ui-common.css |
| token light 67个 | package | theme-chalk/vars/var-ui-light.css |
| token dark 78个 | package | theme-chalk/vars/var-ui-dark.css |
| token uDesign2.2-dark 381个 | package | theme-chalk/vars/var-ui-uDesign2.2-dark.css |
| 图标 580 类名 | package | theme-chalk/fonts/sweet.css |
| 图标字体文件 | package | theme-chalk/assets/fonts/sweetui.woff |
| Button props/types/emits | source-confirmed | 源码 components/button/src/button.ts |
| Input props/emits | source-confirmed | 源码 components/input/src/input.ts |
| Select props(部分) | source-confirmed | 源码 components/select/src/select.ts |
| Form/FormItem props/emits | source-confirmed | 源码 components/form/form.ts, form-item.ts |
| Pagination props/emits | source-confirmed | 源码 components/pagination/src/pagination.ts |
| Dialog props/emits | source-confirmed | 源码 components/dialog/src/dialog.ts |
| Icon 组件实现 | source-confirmed | 源码 components/icon/icon.vue |
| Message props/defaults | source-confirmed | 源码 components/message/src/message.ts |
| MessageBox options/types | source-confirmed | 源码 components/message-box/src/message-box.type.ts |
| Notification install | package | es/components/notification/index.mjs |
| ConfigProvider props | source-confirmed | 源码 components/config-provider/config-provider-props.ts |
| TableColumn 代理关系 | source-confirmed | 源码 components/table-column/table-column.vue |
| create-icon-config.js | source-confirmed | 根目录 create-icon-config.js |
| 源码 index.ts installer | source-confirmed | 源码 packages/index.ts |

## 9. Project Sync Candidates

- SweetUI 组件名使用 `Sweet*` 前缀（非 `El*`），CSS 使用 `sweet-*` 前缀和 `--swt-*` 变量
- 图标类名前缀 `sweetui-icon-`（非 `sweet-icon-`）
- setTheme API: `setTheme(name, app?)` → `document.body.setAttribute("theme", name)`
- Vue 3 作为 bundled dependency 发布
- 无 TypeScript 类型声明发布

Sync decision: Not synced — 待后续验证后沉淀
---

## 10. 带回资料审查与 dt-ui 补充取证（2026-10-15）

结论：首批静态资料可用于架构研究，A2/A6 未运行、核心表格/namespace 契约和机器可读 token/icon 目录未齐，不判完整 A 通过。用户补充 SweetUI 图表使用 dt-ui；这是需核实正式包名、版本和公开消费入口的线索，不能由 ECharts 依赖或口头名称推断实现。

纠正：dependencies 声明不等于 bundled runtime，也不能据此断言双 Vue 实例；缺 .d.ts 不要求首期生成整套声明。按需 import 的 exports 路径必须实际解析，CSS namespace 不等于注册标签；不同主题 token 计数不直接相加。所谓高频 API 全量已取证应以各字段真实覆盖状态为准。

下一单元以同目录 `2026-10-15_sweetui-dt-ui-followup-spec.md` 为补充采集依据，合并核心缺口与图表 D1–D5，禁止改 skill。仅带回获准的文字/JSON，工程和源码留内网；验证未执行的继续明确 RUNTIME_GAP。已有原始取证记录保留，不将本审查当作原始值的独立核验。
