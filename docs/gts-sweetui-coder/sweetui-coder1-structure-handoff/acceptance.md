# gts-sweetui-coder1 交付验收单

> 生成时间: 2026-11-02
> 技能名称: gts-sweetui-coder (目录 gts-sweetui-coder1)
> 目标: SweetUI 原生组件/tokens 重构 EP Workbench + Conversation-Composer + Search-Detail 模式

---

## 一、变更概要

本交付仅包含工作区未暂存(unstaged)的修改和未跟踪(untracked)的新文件。
已暂存(git add)的结构重组(重命名/迁移)不在本包中，由 patch 或仓库提交覆盖。

| 维度 | 数量 |
|------|------|
| 未暂存修改 | 9 |
| 未跟踪新增 | 9 |
| 工作区删除 | 0 |

### 变更清单

**未暂存修改(9)**:
- `components/conversation-composer.vue` — 重写为 SweetDropdown 模型选择器
- `patterns/README.md` — 更新模式索引
- `patterns/search-detail/components/DetailDrawer.vue` — SweetDescriptions 重写
- `patterns/search-detail/components/SearchPanel.vue` — SweetForm 内联重写
- `patterns/search-detail/index.vue` — 完整查询-列表-分页页重写
- `patterns/workbench/README.md` — 工程目录布局 + 装配步骤
- `patterns/workbench/index.vue` — 全 workbench 入口重写(含 .find TypeError 修复)
- `patterns/workbench/workbench-shell.vue` — Shell 外框重写
- `references/components_index.md` — 新增 SweetDropdown 条目

**未跟踪新增(9)**:
- `components/SweetDropdown.md` — 组件参考文档
- `patterns/search-detail/api/tasks.js` — API 抽象层
- `patterns/search-detail/api/mock/tasks-data.js` — Mock 数据(35 条记录)
- `patterns/search-detail/components/DataTable.vue` — SweetTable + SweetTag + SweetPagination
- `patterns/workbench/api/workbench.js` — API 抽象层
- `patterns/workbench/api/mock/workbench-data.js` — Mock 数据(24 资源 + 3 会话 + 3 证据 + 报告)
- `patterns/workbench/components/ai-workspace.vue` — AI 工作区
- `patterns/workbench/components/resource-workspace.vue` — 资源工作区
- `patterns/workbench/components/session-panel.vue` — 会话面板

### 运行时修复

| 文件 | 问题 | 修复 |
|------|------|------|
| `patterns/workbench/index.vue` L22-23 | `computed` 返回 ref 对象而非 `.value`，`currentTabs.value.find` 报 TypeError | `tabs` → `tabs.value`，`resourceTabs` → `resourceTabs.value`，`activeTab` → `activeTab.value`，`activeResource` → `activeResource.value` |

---

## 二、构建验证

验证工程均由 `init.mjs` 全流程创建 → 手动装配模式文件 → `copy-components.mjs` 安装输入器 → `build.mjs` 编译。

| 项目 | 装配模式 | PAGE 名 | 状态 | 预览文件 |
|------|----------|---------|------|----------|
| sweetui-coder1-foundation-check | workbench | SweetuiCoder1FoundationCheck | ✅ BUILD OK | `output/sweetui-coder1-foundation-check/index.gts.html` |
| sweetui-coder1-search-detail-check | search-detail | SweetuiCoder1SearchDetailCheck | ✅ BUILD OK | `output/sweetui-coder1-search-detail-check/index.gts.html` |

构建环境: Node v24.18.0, SweetUI Compiler 3.5.29

### 工程装配布局

**Workbench** (`src/pages/SweetuiCoder1FoundationCheck/`):
```
index.vue                               ← 页面入口
workbench-shell.vue                     ← Shell 外框(与 index.vue 同级)
components/
  ai-workspace.vue                      ← AI 工作区
  resource-workspace.vue                ← 资源工作区
  session-panel.vue                     ← 会话面板
  foundation/
    conversation-composer.vue           ← 输入器(由 copy-components.mjs 安装)
api/
  workbench.js
  mock/workbench-data.js
```

**Search-Detail** (`src/pages/SweetuiCoder1SearchDetailCheck/`):
```
index.vue                               ← 页面入口
components/
  DataTable.vue
  DetailDrawer.vue
  SearchPanel.vue
api/
  tasks.js
  mock/tasks-data.js
```

### 构建警告(非阻塞)

- `workbench-shell.vue`: 动态图标绑定 — 运行时解析正确
- `ai-workspace.vue`: 同上
- `conversation-composer.vue`: 未 Scoped style — 刻意, 因 SweetDropdown popper 挂载在 body

---

## 三、交付物清单

| 文件 | 说明 | 大小 |
|------|------|------|
| `changes.patch` | git diff(工作区 vs 暂存区)，仅未暂存修改 | ~116 KB |
| `changed-files.zip` | 18 个文件(9 修改 + 9 新增)，保留技能内相对路径 | ~30 KB |
| `deleted-files.txt` | 工作区删除文件(无) | — |
| `acceptance.md` | 本文件 | — |
| `screenshots/` | 截图目录(空, 待浏览器验证后补充) | — |

---

## 四、约束合规

| 约束 | 状态 |
|------|------|
| 仅使用 SweetUI 原生组件/tokens/icons | ✅ 无 Element Plus / 第三方 UI |
| 无 Less,仅 Vue SFC `<style>` | ✅ |
| 不引入新运行时库 | ✅ |
| 保留 UMD/theme/i18n 接线 | ✅ |
| 模型选择器用 SweetDropdown 工具栏 | ✅ |
| Workbench AI+资源共享 shell | ✅ |
| 不模拟模型回复,仅 send/stop/busy | ✅ |
| Search-Detail pageSize=10, 35 记录 | ✅ |
| DetailDrawer 用 SweetDescriptions | ✅ |
| SearchPanel 用 SweetForm 内联 | ✅ |

---

## 五、待验证项(未验证)

| # | 验证项 | 预期 |
|---|--------|------|
| 1 | Workbench 外观保真度 | 接近 EP 原型视觉层级 |
| 2 | AI 模式 ↔ 资源模式切换 | 无闪烁,面板正确渲染 |
| 3 | 主题切换(明/暗) | SweetUI theme token 生效 |
| 4 | 会话面板展开/折叠 | 动画流畅 |
| 5 | Conversation-Composer SweetDropdown | 模型选择下拉正常,选中打勾,附件芯片可删 |
| 6 | Search-Detail 分页 | pageSize=10,4 页,切页/跳转/每页条数切换正常 |
| 7 | DetailDrawer SweetDescriptions | 字段对齐,标签-值排列 |
| 8 | 斑马纹/悬停行区分 | SweetTable stripe + hover 可视化区别 |
| 9 | i18n 切换 | 中英文切换正常(如有配置) |
| 10 | 全屏模式 | Workbench 全屏按钮生效 |

**结论**: 构建通过,约束合规,可视化验收待人工浏览器执行。

---

## 六、应用指南

1. 将 `changed-files.zip` 解压到 `skills/gts-sweetui-coder1/` (覆盖同名文件)
2. 或使用 `git apply changes.patch` (在仓库根目录执行)
3. 浏览器打开两个 index.gts.html 执行可视化验收
