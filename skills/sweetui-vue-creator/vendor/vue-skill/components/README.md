# components —— 高频组件示例 SFC（占位）

本目录规划放置 21 个高频组件示例（清单见 `../references/components_index.md`
「高频组件示例对照」表），**示例文件尚未生成**——组件 props/事件/插槽细节需在内网
对照官方文档核实后编写，禁止离线臆测属性。

## 内网补全流程（HANDOFF 驱动）

1. 对照内网 SweetUI 官方文档 + 包内 `es/components/*/src/props.mjs`，按对照表逐个编写
   `Sweet{Component}.vue`（文件名 PascalCase，如 `SweetButton.vue`）；
2. 示例形态对拍 EP 版（`generate-ux-prototype/vendor/vue-skill/components/El*.vue`）：
   同样是「一文件一组件、多状态并列展示、可独立运行」的 demo 块；
3. 写法纪律：按需 import、kebab 模板标签、icon-plus 图标、Token 样式、less scoped、
   无静态内联 style、无规范引用注释；
4. 组件 API 特殊口径在示例中体现：
   - SweetPagination：current-page 用 v-model 绑 ref；
   - SweetForm：校验演示用 rules 即时校验（不依赖 ref validate）；
   - 图表示例：readToken 从 `document.body` 读 `--color-chart-*` 注入配色；
   - SweetLoading：v-loading 指令 + $loading 服务两种形态。

## 完成判定

- 对照表 21 项全部有对应 .vue 文件；
- 每个文件无 `sweet-icon` 直写、无 hex、无 `--el-*`/`--swt-*` 引用；
- 删除本占位 README 的「占位」字样，改为示例清单说明。
