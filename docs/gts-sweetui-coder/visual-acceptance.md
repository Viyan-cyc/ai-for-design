# SweetUI 视觉改善验收报告

## 根因分析

### 字体宋体/衬线感
- **根因**: `var-ui-common.css` 只定义了 `--swt-font-family-zh`/`--swt-font-family-en`/`--swt-font-family-other`，未定义 `--swt-font-family`。HTML body 引用 `var(--swt-font-family, Arial, ...)` 回退到 Arial，中文环境呈衬线外观。
- **修复**: 添加 `--swt-font-family:Roboto,SourceHanSansCN-Regular,Microsoft YaHei,sans-serif`；HTML fallback 改为 Roboto。

### 模型选择器只剩箭头
- **根因**: `SweetSelect` 无宽度约束，flex 布局压缩至最小宽度。
- **修复**: `min-width:100px; max-width:180px`，`size="small"`。

### 按钮比例不协调
- **根因**: 发送 32px 与工具按钮无约束混用。
- **修复**: 统一 28x28px。

### Search-Detail 布局平淡 / 组件尺寸不协调
- **根因**: 无页面包装、无背景层级、表格/抽屉尺寸未调。
- **修复**: 添加 page-header + card 包装；`size="small"` 表格/描述；抽屉 420px；列宽显式分配。

---

## 修改文件清单

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `scripts/preview/src/assets/themes/var-ui-common.css` | 修改 | 添加 --swt-font-family |
| 2 | `scripts/preview/index.gts.html` | 修改 | fallback 字体改 Roboto |
| 3 | `assets/foundation/workbench-shell.vue` | 新增 | 工作台 shell |
| 4 | `assets/foundation/conversation-composer.vue` | 新增 | 对话输入框 |
| 5 | `assets/examples/workbench-conversation/index.vue` | 新增 | 工作台+对话 demo |
| 6 | `scripts/copy-foundation.mjs` | 新增 | 基础组件部署脚本 |
| 7 | `references/assets/workbench-shell.md` | 新增 | 文档 |
| 8 | `references/assets/conversation-composer.md` | 新增 | 文档 |
| 9 | `references/assets/index.md` | 新增 | 文档 |
| 10 | `vendor/code-example/references/table-search-drawer/index.vue` | 修改 | 页面头+card+背景 |
| 11 | `vendor/code-example/references/table-search-drawer/components/search-form.vue` | 修改 | 字段宽度+选项 |
| 12 | `vendor/code-example/references/table-search-drawer/components/data-table.vue` | 修改 | size=small+图标 |
| 13 | `vendor/code-example/references/table-search-drawer/components/detail-drawer.vue` | 修改 | 尺寸+操作按钮 |

---

## 构建验收

### sweetui-foundation-visual-check
```
cd D:\project\gts\ai-for-design\skills\gts-sweetui-coder
node scripts\build.mjs --dir output\sweetui-foundation-visual-check --page WorkbenchConversation
```
- 结果: **构建成功**，1 page + 3 components
- 预览: `file:///D:/project/gts/ai-for-design/output/sweetui-foundation-visual-check/index.gts.html`

### sweetui-search-detail-visual-check
```
cd D:\project\gts\ai-for-design\skills\gts-sweetui-coder
node scripts\build.mjs --dir output\sweetui-search-detail-visual-check --page TableSearchDrawer
```
- 结果: **构建成功**，1 page + 4 components
- 预览: `file:///D:/project/gts/ai-for-design/output/sweetui-search-detail-visual-check/index.gts.html`

---

## 浏览器验证（需人工）

以下项目无浏览器环境，标记为 **未验证**，需人工打开预览 HTML 确认：

1. 字体渲染：中文是否显示 SourceHanSansCN / Microsoft YaHei 而非宋体
2. 工作台侧边栏折叠动画是否流畅（56px ↔ 216px）
3. 对话输入框聚焦时 border 高亮 + shadow 效果
4. 模型选择器展开后下拉列表宽度是否正常
5. 发送按钮 hover/active 状态与颜色
6. 搜索表单各字段实际渲染宽度比例
7. 数据表格 name 列前图标是否正确显示
8. 抽屉内描述列表 label/value 对齐
9. 抽屉内编辑/删除按钮 hover 状态
10. 整体页面背景层级感

---

## 限制与说明

- **无浏览器**: 所有视觉/交互项均标未验证，需人工在 Chrome 打开 HTML 确认
- **无截图**: `screenshots/` 目录已创建但为空
- **图标命名**: 确认使用 `sweetui-icon-edit-l`/`sweetui-icon-delete-l`（含 -l 后缀），与 npm 5.7.0 whitelist 一致