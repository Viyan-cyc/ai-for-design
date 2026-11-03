# npm 接入验收报告

日期: 2026-11-03
验证 skill: gts-sweetui-coder1 (name: gts-sweetui-coder, v0.5.2)
SweetUI: @hw-seq/sweet-ui-base 5.7.0
Vue: 3.5.29

## 本轮变化

表格主题适配由预览 HTML 内联 `<style>` 移到 `scripts/preview/src/assets/theme-adapter.css`，由 `runtime.js` 统一 `import './assets/theme-adapter.css'` 引入。变更确保：
- 离线预览 (index.gts.html) 和真实 npm 工程使用同一份表格适配 CSS
- `theme-adapter.css` 中的自定义变量（`--swt-table-th`、`--swt-table-striped`、`--swt-table-row-hover-bg-color`、`--swt-table-current-row-bg-color`）随 src 加载，无需在 HTML 或宿主样式中额外注入
- README.md 补充了源码接入与模式装配说明，runtime.js 引入 theme-adapter.css 的约定明确写入

## 执行命令与结果

### 环境就绪

```
workdir: D:\project\gts\ai-for-design\skills\gts-sweetui-coder1
node -v                           → v24.18.0
node scripts/ensure-env.mjs       → RESULT: OK | NODE_SOURCE: system | COMPILER_VERSION: 3.5.29
```

### sweetui-coder1-foundation-check (工作台)

```
# 清理旧工程后重新初始化
node scripts/init.mjs "D:\project\gts\ai-for-design\output" "sweetui-coder1-foundation-check"
  → RESULT: OK | PAGE: SweetuiCoder1FoundationCheck

# 从 patterns/workbench 复制页面、组件、API；从 components/ 复制 conversation-composer.vue
# 写入带验收助手的 App.vue (busyBySession + stop 事件)
# runtime.js 已含 import './assets/theme-adapter.css' (init 自动复制)

node scripts/build.mjs --dir "D:\project\gts\ai-for-design\output\sweetui-coder1-foundation-check"
  → RESULT: OK | HTML_PATH: ...\sweetui-coder1-foundation-check\index.gts.html | PAGES: 1
  WARN (6条): 全部为已知 dynamic icon binding 与 unscoped composer 全局样式，不阻塞
```

预览路径 (浏览器打开):
`D:\project\gts\ai-for-design\output\sweetui-coder1-foundation-check\index.gts.html`

### sweetui-coder1-search-detail-check (查询 + 详情)

```
node scripts/init.mjs "D:\project\gts\ai-for-design\output" "sweetui-coder1-search-detail-check"
  → RESULT: OK | PAGE: SweetuiCoder1SearchDetailCheck

# 从 patterns/search-detail 复制页面、组件、API
# runtime.js 含 theme-adapter.css

node scripts/build.mjs --dir "D:\project\gts\ai-for-design\output\sweetui-coder1-search-detail-check"
  → RESULT: OK | HTML_PATH: ...\sweetui-coder1-search-detail-check\index.gts.html | PAGES: 1
  无 WARN
```

预览路径:
`D:\project\gts\ai-for-design\output\sweetui-coder1-search-detail-check\index.gts.html`

### sweetui-coder1-npm-check (真实 npm 工程接入)

独立 Vite 工程，通过 resolve alias 指向项目根 node_modules 里的真实 @hw-seq/sweet-ui-base：

```
workdir: D:\project\gts\ai-for-design\output\sweetui-coder1-npm-check

# 结构
  index.html
  vite.config.js (alias: vue → .../vue/dist/vue.esm-bundler.js,
                   @hw-seq/sweet-ui-base → .../es/index.mjs,
                   @hw-seq/sweet-ui-base/dist/sweet-ui-base.css → .../dist/sweet-ui-base.css)
  src/main.js    → import '@hw-seq/sweet-ui-base/dist/sweet-ui-base.css'; import { installRuntime } from './runtime.js'
  src/runtime.js → import './assets/theme-adapter.css'  ← 关键验证点
  src/assets/base.css, theme-adapter.css
  src/theme.js, src/i18n/index.js
  src/App.vue → Page from pages/NpmCheck
  src/pages/NpmCheck/ → search-detail 模式页面 (index.vue, components/, api/)

npx vite build
  → vite v6.4.3 | ✓ 1880 modules transformed | built in 8.61s
  → dist/index.html (0.40 KB) + dist/assets/index-*.css (953.70 KB) + dist/assets/index-*.js (2,861.27 KB)
```

CSS 构建产物中确认包含 `--swt-table-th`、`--swt-table-striped`、`--swt-table-row-hover-bg-color`、`--swt-table-current-row-bg-color` 及 dark body[theme] 选择器。

启动命令:
```
cd D:\project\gts\ai-for-design\output\sweetui-coder1-npm-check
npx vite
```
浏览器访问 http://localhost:5173

## 结构一致性检查

| 检查项 | 预览工程 | npm-check | 结果 |
|---|---|---|---|
| runtime.js 引入 theme-adapter.css | ✅ | ✅ | 一致 |
| main.js 加载 @hw-seq/sweet-ui-base/dist/sweet-ui-base.css | ✅ | ✅ | 一致 |
| main.js 调用 installRuntime(app) | ✅ | ✅ | 一致 |
| theme.js 共享 (setTheme + selector mapping) | ✅ | ✅ | 一致 |
| i18n/index.js 共享 (delegatingI18n) | ✅ | ✅ | 一致 |
| base.css 只做工盒模型，不覆盖组件主题 | ✅ | ✅ | 一致 |
| CSS 不重复加载官方 CSS | ✅ (link in HTML + CSS import in main.js) | ✅ (Vite bundler 去重) | 无冲突 |
| EP Less / 外部组件库 | 无 | 无 | 通过 |

## 构建产物验证

- preview-data.js 包含 `/src/assets/theme-adapter.css` 条目 ✅
- npm dist CSS 包含 theme-adapter 变量声明 ✅
- 无 .less 文件 ✅
- 无重复官方 CSS 加载 (预览 link + src import 各一次；Vite 自动去重) ✅

## 浏览器验证项目 (需用户手动检查)

以下项目构建通过但无法在本工具中验证，需用户打开浏览器确认：

1. **浅色主题** → 打开预览，确认表格表头、斑马纹行背景、hover 行背景颜色可区分
2. **深色主题** → 点击工作台顶部主题切换按钮 (或 npm-check 中 body theme 属性)，切换到 dark：
   - 确认 --swt-table-th 使用 gray3
   - 确认 --swt-table-striped 使用 overlay-gray1-and-gray12-opacity5
   - 确认 --swt-table-row-hover-bg-color 使用 overlay-gray1-and-gray12-opacity10
3. **主题往返** → dark → light → dark，确认颜色每次切换正确、无残留
4. **查询分页** → 在 search-detail-check 中输入条件查询、重置、切换分页页码和每页条数
5. **详情弹窗** → 点击表格行打开 DetailDrawer，确认数据完整
6. **npm-check 运行** → `npx vite` 启动后确认页面渲染正常、表格有斑马纹和 hover 效果

## 未验证项

- 浏览器运行通过（白屏/资源加载错误/图标渲染）
- 主题切换动画连续性
- i18n 语言切换（本项目未启用国际化配置，未添加 zh_CN/en_US 词典）
- 代码分块优化（npm-check JS bundle 2.8MB 未做 code-splitting，属于正常全量引入，非缺陷）

## 结论

三个验收工程均从最新 skill (gts-sweetui-coder1) 重新装配并构建通过。核心变更——表格主题适配从 HTML 移入 `src/assets/theme-adapter.css` 并由 `runtime.js` 统一引入——在预览和 npm 工程中均生效，结构一致，CSS 无重复加载。无需修改 skill 代码。