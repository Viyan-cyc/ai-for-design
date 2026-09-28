# public/library — 预览运行时（内网待填）

本目录当前**为空壳**（README 之外无文件）。以下 7 个文件由内网从 SweetUI 包与公共 CDN 产物落库后放进本目录，文件名必须与下方完全一致（`index.gts.html` 按名加载）：

| 文件 | 来源 | 说明 |
|---|---|---|
| `vue.global.prod.js` | Vue 3.5 官方 dist | 预置 `window.Vue` |
| `xss.js` | js-xss dist | 预置 `window.xss`（SweetUI 依赖） |
| `lodash.min.js` | lodash 4 dist | 预置 `window._`；**index.gts.html 随后执行 `window._$1 = window._`**（SweetUI UMD 查 `_$1`） |
| `echarts.min.js` | ECharts 6.1 dist | 预置 `window.echarts` |
| `sweet-ui-base.umd.cjs` | `@hw-seq/sweet-ui-base` 解包 `dist/` | SweetUI 全量构建，全局名 `window["sweet-ui-base"]`（非标准，注意） |
| `sweet-ui-base.css` | 同包 `dist/` | 全量样式（含 `:root` 的 `--swt-*` 默认值）。**只放这一个 CSS** |
| `less.min.js` | less@4.4 browser UMD | 主题 .less 编译（sfc-loader 的 less 非内置） |
| `vue3-sfc-loader.js` | vue3-sfc-loader 0.9.5 dist | 浏览器内 SFC 编译 |

**禁止放入**：SweetUI 包 `theme-chalk/vars/var-ui-*.css`（light/dark/black/uDesign2.2-*/hDesign* 全部主题文件）——它们与 `src/assets/themes/bridge.less` 同在 `body[theme=…]` 作用域定义 `--el-*`/`--swt-*`，会抢级联。变量默认值已由 `sweet-ui-base.css` 的 `:root` 块提供，bridge 写 `body[theme=…]` 特异性更高，天然获胜。

dayjs 无需全局（SweetUI 内部消费），不需要单独落库。

落库后验证：双击打开任一 `init.mjs` 产物 `index.gts.html`，控制台无 404、页面出 starter 表格。
