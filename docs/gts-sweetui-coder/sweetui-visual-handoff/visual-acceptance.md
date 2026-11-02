# visual-acceptance — SweetUI EP→SweetUI 迁移验收

生成时间: 2026-11-02

---

## 1 交付范围

将两套 Element Plus 布局模式迁移为 SweetUI 组件实现，并直接修改 skill 源文件（非仅输出 demo）:

| 模式 | EP 参考 | SweetUI 输出 |
|------|---------|-------------|
| 工作台 + 对话输入 | `gts-ep-coder/.../workbench-foundation/` | `gts-sweetui-coder/assets/foundation/` + `assets/examples/workbench-conversation/` |
| 查询 + 详情 Drawer | `gts-ep-coder/.../table-search-drawer/` | `gts-sweetui-coder/vendor/code-example/references/table-search-drawer/` |

---

## 2 修改/新增文件清单 (skill 内)

### foundation 层 (2 文件)

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `assets/foundation/workbench-shell.vue` | 修改 | +收藏筛选 (favorite-f/l)、产品徽标 (dashboard-l)、全部应用/我的收藏切换、导航 SweetTooltip、状态圆点 (done/pending/idle)、折叠按钮 (arrow-left/right)、导航色调 (blue/green/purple)、tab 重构 |
| `assets/foundation/conversation-composer.vue` | 修改 | 移除 `max-width:720px; margin:0 auto` 收窄，作曲器现在撑满父容器宽度 |

### examples/workbench-conversation/ (7 文件，全部新增)

| 文件 | 说明 |
|------|------|
| `index.vue` | 编排页：AI/资源模式切换、主题监听 MutationObserver、会话面板、空状态、SweetDialog 通知 |
| `components/ai-workspace.vue` | 对话区 + 分析报告卡 + 证据表 (SweetTable/SweetPagination) + 依赖链 + 建议 |
| `components/session-panel.vue` | 会话列表：搜索、重试、新建会话 |
| `components/resource-workspace.vue` | 资源查询页：统计条带、SweetTable、SweetPagination、SweetDrawer 详情 |
| `components/foundation/workbench-shell.vue` | foundation 拷贝 (build 需要本地引用) |
| `components/foundation/conversation-composer.vue` | foundation 拷贝 |
| `api/foundation.js` | 服务层 (getResources, getSessions, getEvidence, getReport, getDemoReply) |
| `api/mock/foundation-data.js` | Mock 数据：24 资源、3 会话、3 证据、3 步报告 |

### references/table-search-drawer/ (5 文件)

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `index.vue` | 修改 | 移除未使用的 SweetRow/SweetCol import |
| `api/mock/tasks-data.js` | 新增 | 从 12→32 条 mock 任务 |
| `api/tasks.js` | 新增 | API 服务层 |
| `components/data-table.vue` | 修改 | 图标名修正 (sweetui-icon-*) |
| `components/detail-drawer.vue` | 修改 | 图标名修正 |
| `components/search-form.vue` | 修改 | 图标名修正 |

### 其他

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `vendor/code-example/references/README.md` | 修改 | +008 workbench-conversation 条目 |
| `scripts/preview/index.gts.html` | 修改 | 构建模板更新 |
| `scripts/copy-foundation.mjs` | 新增 | foundation 拷贝脚本 |
| `references/assets/conversation-composer.md` | 新增 | 组件说明文档 |
| `references/assets/index.md` | 新增 | 示例索引 |
| `references/assets/workbench-shell.md` | 新增 | 组件说明文档 |

---

## 3 构建验证

| 项目 | 路径 | 构建结果 | 页面数 | 组件数 |
|------|------|---------|--------|--------|
| workbench-foundation-check | `output/sweetui-foundation-visual-check/workbench-foundation-check/` | **OK** | 1 | 6 |
| search-detail-check | `output/sweetui-search-detail-visual-check/search-detail-check/` | **OK** | 1 | 4 |

### 构建警告 (可接受)

- `workbench-shell.vue`: `dynamic iconClass expression "item.icon"` — WARN 非 ERROR，由菜单图标动态绑定产生
- `resource-workspace.vue`: 同上

---

## 4 SweetUI vs EP 能力差异

| EP 原始 | SweetUI 替代 | 说明 |
|---------|-------------|------|
| `el-icon-star` | `sweetui-icon-favorite-f/l` | 实心/空心收藏心形 |
| `el-icon-chat-dot-round` | `sweetui-icon-message-l` | 消息/通知 |
| `el-icon-magic-stick` | `sweetui-icon-manage-tasks-l` | 智能功能入口 |
| `el-icon-bell` | `sweetui-icon-message-l` | 通知铃铛 → 消息 |
| `el-icon-full-screen` | `sweetui-icon-full-screen-l` | 全屏 |
| `el-icon-sunny / el-icon-moon` | `sweetui-icon-skin-peeler-l` | 主题切换 |
| `el-icon-data-analysis` | `sweetui-icon-issue-analysis-l` | 数据分析 |
| `el-icon-arrow-left / arrow-right` (l 后缀) | `sweetui-icon-arrow-left / arrow-right` (无 l 后缀) | 箭头图标无 `-l` |
| `el-icon-setting` | `sweetui-icon-seting-l` | SweetUI 拼写即 `seting` |
| `el-icon-document` | `sweetui-icon-folder-opened-l` | 文件图标 |
| `el-tooltip` | `SweetTooltip` | 仅在导航折叠时启用 (disabled=expanded) |
| Less 变量 `--ep-*` | CSS 变量 `--swt-*` | 全量替换 |

---

## 5 预览方式

```bash
# 工作台模式
# 浏览器直接打开:
output/sweetui-foundation-visual-check/workbench-foundation-check/index.gts.html

# 查询详情模式
# 浏览器直接打开:
output/sweetui-search-detail-visual-check/search-detail-check/index.gts.html

# 主题切换
# 在浏览器控制台执行:
window.setTheme('uDesign2.2-light')
window.setTheme('uDesign2.2-dark')
```

---

## 6 未验证项

- **无浏览器截图**: 当前环境无 GUI 浏览器，无法进行视觉级验证
- **依赖 UMD 挂载预览**: `index.gts.html` 需要 `sweetalert-dev.js` / `sweet-ui-base.umd.js` 等本地 UMD 文件存在
- **动态图标警告**: workbench-shell.vue 和 resource-workspace.vue 中 `item.icon` 动态绑定导致 WARN，不影响功能

---

## 7 交付文件

| 文件 | 大小 | 说明 |
|------|------|------|
| `sweetui-changed-files.zip` | ~50KB | 所有修改/新增 skill 源文件 |
| `visual-changes.patch` | ~120KB | 完整 git diff (含未跟踪文件新增部分) |
| `deleted-files.txt` | 内容: "无" | 无删除 |
| `visual-acceptance.md` | 本文件 | 验收文档 |

---

## 8 结论

- 两套布局 (工作台+对话、查询+详情) 已完成 SweetUI 迁移
- 所有文件使用 SweetUI 组件 (`@hw-seq/sweet-ui-base`)，无 Element Plus / IconPlus / Less / dt-ui 残留
- 图标名称全部符合 SweetUI 白名单
- 两个验证项目构建均通过 (RESULT: OK)
- **视觉验证**: 待人工浏览器打开 `index.gts.html` 确认
