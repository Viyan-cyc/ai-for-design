# T7 端到端验收演示页（generate-ux-prototype 交付标准示例）

由 `generate-ux-prototype` skill 于 2026-09-12 生成并完成 T7 端到端验收（见 `tasks/W1-mainline.md` W1-T7 回写）。两页均为真实 Vue 3 + Element Plus 2.13.5 源码工作区，`index.html` 浏览器直接打开即可预览（file:// 可加载；受限时用 `node skills/generate-ux-prototype/scripts/serve.mjs --dir <目录> --port 8765`）。

## t7-device-monitor — hybrid 模式（组件复用 + 手写混用）

- `COMPONENT_MODE: 'hybrid'`：复用资产库 GMetricCard / GStatusTag（平铺落位 `src/components/GName/`，来源注释保留库内分类），其余手写
- 覆盖：48 条 mock 列表（20 行表格 + 分页）、4 张 KPI 卡、`data-surface="brand"` 主卡（资产 token #0067D1）、毛玻璃层（frost-backdrop + `data-material="frosted"`）、筛选/搜索、状态标签色系
- 明暗切换：浏览器控制台 `setTheme('dark')`；自定义皮肤 `src/assets/themes/theme-deep-blue.css` 已按插槽协议注册

## t7-alarm-insight — free 模式（全手写）

- `COMPONENT_MODE: 'free'`：跳过组件匹配，全部 AI 手写（只守 token + 代码规范约束）
- 覆盖：7 根趋势柱 + 6 条告警的看板页

## 二次开发入口

只改 `src/api/{slug}.js`（当前是原型态 re-export mock；t7-device-monitor 内附「假 axios」二开示例 `src/api/request.js`），导出名/参数/返回形状保持不变，页面零改动。

注意：预览运行时（sfc-loader 0.9.5）下 `el-pagination` 必须用 `v-model:current-page` / `v-model:page-size`，单向 prop 会静默不渲染（真实 Vite 工程无此限制，见 code-conventions §11）。
