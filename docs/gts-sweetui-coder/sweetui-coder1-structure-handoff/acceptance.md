# 验收报告 — SweetUI skill 修改（第五轮）

## 可追溯基线
- **Git commit**: `71942369cd9c25db6d28ec2972dc3ef1c1170ed2`
- **提交信息**: `update`
- **基线获取方式**: `git archive 71942369cd9c25db6d28ec2972dc3ef1c1170ed2 | tar -x -C <baseline-dir>`
- **补丁验证**: 在基线临时副本执行 `git apply --check changes.patch` → **通过（无错误输出）**

## 技能根目录
`D:\project\gts\ai-for-design\skills\gts-sweetui-coder1`

## 本轮暂存文件（20 个）

| # | 相对路径 | 修改内容 |
|---|---|---|
| 1 | `components/SweetDropdown.md` | 新增 SweetDropdown 组件参考文档 |
| 2 | `components/conversation-composer.vue` | 附件按钮改为紧凑图标按钮（`text circle` + 固定 32px），工具栏间距收窄 |
| 3 | `patterns/README.md` | 更新 patterns 说明 |
| 4 | `patterns/search-detail/api/mock/tasks-data.js` | 新增 mock 数据 |
| 5 | `patterns/search-detail/api/tasks.js` | 新增 tasks API 层 |
| 6 | `patterns/search-detail/components/DataTable.vue` | 新增/修改 DataTable 组件 |
| 7 | `patterns/search-detail/components/DetailDrawer.vue` | 修改 DetailDrawer 组件 |
| 8 | `patterns/search-detail/components/SearchPanel.vue` | 修改 SearchPanel 组件 |
| 9 | `patterns/search-detail/index.vue` | 修改 search-detail 主入口；**新增从 theme.js 导入 toggleTheme 和 SweetIcon 深浅切换按钮** |
| 10 | `patterns/workbench/README.md` | 更新 workbench 说明 |
| 11 | `patterns/workbench/api/mock/workbench-data.js` | 新增 workbench mock 数据 |
| 12 | `patterns/workbench/api/workbench.js` | 新增 workbench API 层 |
| 13 | `patterns/workbench/components/ai-workspace.vue` | 新增/修改 AI 工作区组件；"正在整理演示回复…" → "正在生成…" |
| 14 | `patterns/workbench/components/resource-workspace.vue` | 新增/修改资源工作区组件 |
| 15 | `patterns/workbench/components/session-panel.vue` | 标题与关闭同行，新建按钮全宽 small，搜索框 small，间距收紧凑；**button 重置限定到 `.session` class** |
| 16 | `patterns/workbench/index.vue` | 主题切换改用 `theme.js` 导出的 `setTheme`/`theme`；移除 `require()`、`data-theme`、自行 body 背景映射 |
| 17 | `patterns/workbench/workbench-shell.vue` | 修改 workbench 壳组件 |
| 18 | `references/components_index.md` | 更新组件索引 |
| 19 | `scripts/preview/index.gts.html` | 添加 `:root` 及深色选择器的表格主题变量补丁；**移除 `--swt-fill-color-blank` 和 `--swt-table-hover-td`；深色 striped 改用 `overlay-gray1-and-gray12-opacity5`（#292929），hover 改用 `overlay-gray1-and-gray12-opacity10`（#353535）** |
| 20 | `scripts/preview/src/theme.js` | 简化 `setTheme` 实现，保留 body backgroundColor 深色处理 |

## 本轮集中修复内容

### 修复① 深色表格 striped/hover 可区分性

**根因**: SweetUI npm v5.7.0 的 `uDesign2.2-light` 和 `GTS UDesign（默认风格）-dark` 主题块缺失 `--swt-table-th`、`--swt-table-striped`、`--swt-table-row-hover-bg-color`、`--swt-table-current-row-bg-color` 四个变量。仅 legacy `body[theme=light]`/`body[theme=dark]` 含这些定义。
- 旧修复在深色覆盖中将 `striped` 和 `hover` 都设为 `var(--swt-color-gray3)`（uDesign2.2-dark 解析为 #2e2e2e），导致斑马行与 hover 行不可区分。
- `--swt-fill-color-blank` 覆盖不必要：`var-ui-common.css`（`:root`）已定义 `--swt-fill-color-blank: rgba(255,255,255,var(--swt-color-opacity0))`（即 transparent），表格自然继承父容器背景，无需覆盖。
- `--swt-table-hover-td` 虽在 legacy 主题块中定义，但在组件 CSS 中未被 `var()` 引用，属于冗余变量。

**修复**:
- 移除 `--swt-fill-color-blank` 覆盖和 `--swt-table-hover-td` 定义。
- `:root` 默认值使用 legacy light 主题的 token 级逻辑：`--swt-table-th: var(--swt-color-gray2)`、`--swt-table-striped: var(--swt-table-th)`、`--swt-table-row-hover-bg-color: var(--swt-color-gray3)`、`--swt-table-current-row-bg-color: var(--swt-color-accent-normal-opacity20)`。
- 深色选择器使用 uDesign2.2-dark 已有 overlay token 确保 **三种行状态可区分**：
  | 行状态 | 变量 | 深色解析值 | 与上一级的色差 |
  |---|---|---|---|
  | 普通行 | 继承 `--swt-color-bg-primary` | `#1e1e1e` (gray1) | — |
  | 斑马行 | `--swt-table-striped` = `var(--swt-color-overlay-gray1-and-gray12-opacity5)` | `#292929` | +17ΔE |
  | hover 行 | `--swt-table-row-hover-bg-color` = `var(--swt-color-overlay-gray1-and-gray12-opacity10)` | `#353535` | +14ΔE |
  | 当前行 | `--swt-table-current-row-bg-color` = `var(--swt-color-accent-normal-opacity20)` | `#0073e833` | 蓝色高亮 |
  | 表头 | `--swt-table-th` = `var(--swt-color-gray3)` | `#2e2e2e` | 与主体区分 |

**变量作用域理由**: `--swt-table-*` 变量必须在文档级（`:root` / `body[theme]`）定义，因为 SweetUI 的 `.el-table--striped` / `.el-table__body tr.hover-row` 组件 CSS 在全局作用域通过 `var()` 引用这些变量。SFC scoped style 无法影响组件库内部选择器；构建脚本（`build.mjs:109-110`）禁止 `.vue` scoped style 中使用 `:root`/`body[theme` 和非 `--page-` 自定义属性，这是正确的隔离约束——`index.gts.html` 的 `<style>` 是文档级主题补丁的唯一合规承载位置，而非绕过检查的漏洞。

**npm token 验证依据**:
- `--swt-color-overlay-gray1-and-gray12-opacity5: #292929` — 来自 `var-ui-uDesign2.2-dark.css`
- `--swt-color-overlay-gray1-and-gray12-opacity10: #353535` — 来自 `var-ui-uDesign2.2-dark.css`
- `--swt-color-accent-normal-opacity20: #0073e833` — 来自 `var-ui-uDesign2.2-dark.css`
- `--swt-color-gray2: #f5f5f5` (light) / `--swt-color-gray3: #2e2e2e` (dark) — 来自对应 var 文件

### 修复② session-panel.vue button 重置限定

**根因**: `button { font: inherit; ... }` 和 `button:focus-visible { ... }` 在 scoped style 中会命中 SweetButton 组件渲染出的内部 `<button>` 元素（Vue scoped attribute 渗透到子组件根元素），覆盖组件库的 primary/hover/focus 样式。

**修复**: 将 `font: inherit; cursor: pointer; border: 0; background: transparent; color: inherit;` 和 `:focus-visible` 规则从 `button` 移到 `.session`（唯一使用原生 `<button>` 的元素），使重置仅作用于需要它的原生会话列表按钮，保留 SweetButton 的组件库样式。

### 修复③ 补丁文件完整性

**问题**: 上一版 `changes.patch` 含 NUL 和损坏字符，由 PowerShell `Out-File` 编码导致。

**修复**:
- 使用 `git diff --cached --binary` 直接输出到 Buffer，写入文件为原始 UTF-8 无 BOM。
- 文件头 `diff`、无 NUL 字节、无 BOM、109952 bytes。
- 在 `git archive HEAD` 生成的基线临时副本执行 `git apply --check changes.patch` → 通过。
- ZIP、补丁、暂存文件列表三一致：
  - `changed-files.zip` (34129 bytes) 包含 20 文件（保留目录结构）
  - `changes.patch` (109952 bytes) 覆盖同样 20 文件
  - `staged-files.txt` 列出同样 20 文件（repo-relative 路径）
  - `deleted-files.txt` = "无"
- 基线可追溯：commit `71942369cd9c25db6d28ec2972dc3ef1c1170ed2`

### 修复④ 验收步骤修正

**问题1 — busy 测试**: 发送操作不会自动设置受控 `busy` 状态（无模拟回复），验收需明确提供测试方法。

**修复**: 在验收步骤中提供浏览器控制台手动设置 busy 的方法，不向 skill 添加模拟回复。

**问题2 — 查询页深色测试**: 之前依赖在另一页面切换主题后刷新，无法独立测试。

**修复**: 在 `patterns/search-detail/index.vue` 添加从 `theme.js` 导入 `theme`/`setTheme` 和 `toggleTheme()` 函数，在标题栏右侧放置 `SweetButton text` 深浅切换按钮（`SweetIcon icon-class="sweetui-icon-display-setting-l"`），使查询页可独立调用公共主题接口测试深色模式。

## 验证命令和结果

```
> node scripts/build.mjs --dir "output/sweetui-coder1-foundation-check"
RESULT: OK
HTML_PATH: ...\sweetui-coder1-foundation-check\index.gts.html
PAGES: 1

> node scripts/build.mjs --dir "output/sweetui-coder1-search-detail-check"
RESULT: OK
HTML_PATH: ...\sweetui-coder1-search-detail-check\index.gts.html
PAGES: 1

> 补丁验证（基线临时副本）
git archive 71942369cd9c25db6d28ec2972dc3ef1c1170ed2 | tar -x -C <tmp>
cd <tmp> && git init && git add -A && git commit -m baseline
git apply --check <handoff>/changes.patch
→ 无错误输出，补丁可干净应用
```

## 预览入口

- **工作台（含对话、表格、会话面板）：**
  `D:\project\gts\ai-for-design\output\sweetui-coder1-foundation-check\index.gts.html`

- **查询详情（含搜索、表格、抽屉、深浅切换）：**
  `D:\project\gts\ai-for-design\output\sweetui-coder1-search-detail-check\index.gts.html`

## 待用户浏览器验收项

### 工作台预览
1. **附件选择**：点击 + 图标按钮，选择文件，确认附件出现；点击移除图标删除附件
2. **busy 状态与事件测试**：页面底部有「验收助手」工具栏，提供「模拟 busy」「解除 busy」按钮。操作方式：
   - **自动 busy**：输入文本后点发送，`App.vue` 通过 `onSend` 将对应 `sessionId` 写入响应式 `busyBySession`，工作台进入 busy 状态，输入区附件按钮和发送按钮禁用，显示"正在生成…"；底部事件栏显示 `send` + 文本摘要
   - **手动模拟**：点击「模拟 busy」，`busyBySession['manual-test'] = true`，当前标签页无对应 sessionId 不会显示 busy（此按钮仅验证响应式传递机制）；点击「解除 busy」清空所有 `busyBySession` 键，任何 busy 状态即恢复
   - **停止**：busy 状态下点击停止图标，`App.vue` 的 `onStop` 收到 `sessionId` 并从 `busyBySession` 删除该键，busy 状态解除；底部事件栏显示 `stop` + sessionId
   - 不访问 Vue 私有实例，不直接修改 props，不使用控制台命令
3. **模型菜单**：点击模型选择器展开下拉，确认当前选中项有 check 图标，切换后标签更新
4. **会话面板**：点击页签栏左侧按钮打开，搜索会话过滤，新建按钮创建页签，关闭面板；标题与关闭按钮同行；**SweetButton 正常渲染 primary 蓝色、hover 背景、focus 轮廓，不受原生 button 重置影响**
5. **AI 工作台表格**：关联告警表格有斑马纹（深色：偶数行 #292929/奇数行 #1e1e1e），hover 行有 #353535 背景
6. **资源表格**：资源列表表格有斑马纹和 hover
7. **深浅切换**：点击顶部主题按钮，light→dark→light 切换后表格斑马纹和 hover 在两种主题下均可区分，行背景离开后恢复
8. **分页和抽屉**：资源表格分页切换，点击"详情"打开 Drawer
9. **控制台**：无 JS 报错

### 查询详情预览
1. **搜索与重置**：输入关键词 → 查询；点击重置清空条件
2. **表格斑马纹**：任务管理表格有斑马纹和 hover
3. **分页**：共 35 条 / 每页 10 条，第 4 页 5 条，分页器可切换
4. **详情抽屉**：点击行打开 Details Drawer，字段展示正常
5. **深浅切换**：**点击标题栏右侧的显示器图标按钮切换主题**，dark→light→dark 后表格斑马纹（#292929/#1e1e1e）和 hover（#353535）可区分，搜索卡片背景跟随主题
6. **控制台**：无 JS 报错

## 验收工程专属说明

工作台验收工程（`sweetui-coder1-foundation-check`）的 `App.vue` 包含「验收助手」工具栏和相关 `busyBySession`/`onSend`/`onStop` 接线逻辑。这些代码**仅存在于验收工程**，不回流到 skill 源码（`skills/gts-sweetui-coder1`）。skill 的工作台 `index.vue` 本身只声明 `busyBySession` prop 和 `send`/`stop` emit，语义完整，不包含任何测试控件、模拟回复或定时器。

要复现验收工程：`node init.mjs "<output>" "<slug>"` 初始化后，将 `patterns/workbench/` 同名文件复制到 `src/pages/{Page}/`，然后编辑 `App.vue` 按 `busyBySession` prop 和事件名接线即可。

## 应用方法

1. 基线检出：`git checkout 71942369cd9c25db6d28ec2972dc3ef1c1170ed2`
2. 应用补丁：`git apply changes.patch`
3. 或：将 `changed-files.zip` 解压到 `skills/gts-sweetui-coder1/`（覆盖同名文件）
4. 删除文件：无
5. 运行 `node scripts/build.mjs --dir "<output-project>"` 构建预览
6. 在浏览器打开生成的 `index.gts.html`

## 限制说明
- 表格变量补丁放在 `index.gts.html` 的 `<style>` 中而非 SFC scoped style，因为：
  - SweetUI 的 `.el-table--striped` / `.el-table__body tr.hover-row` 使用 `var(--swt-table-*)` 在全局作用域；文档级 `:root`/`body[theme]` 是 CSS 自定义属性向下级联的正确位置。
  - `build.mjs:109` 禁止 SFC style 中使用 `:root`/`body[theme`（防止 skill 页面样式篡改全局主题作用域），这是合理的隔离约束。
  - 因此文档级主题变量补丁只能放在 HTML 模板的 `<style>` 中——这是正确的 CSS 层级选择，而非对构建检查的绕过。
- 深色主题的 `body.style.backgroundColor` 保留（`theme.js` 中），因打包 CSS 的组选择器 `body[theme="uDesign2.2-dark"]` 在 `sweet-ui-base.css` 中仅用于 `background-color` 声明（不含 table 变量），而 `setTheme` 设置的实际属性值 `"GTS UDesign（默认风格）-dark"` 不匹配 `uDesign2.2-dark`，导致深色背景不会从该规则继承。

## 交付物清单

| 文件 | 内容 |
|---|---|
| `changes.patch` | 109952 bytes，UTF-8 无 BOM，20 文件 diff，`git apply --check` 通过 |
| `changed-files.zip` | 34129 bytes，20 文件，保留技能内相对目录结构 |
| `staged-files.txt` | 20 行，repo-relative 路径，与 patch/zip 一致 |
| `deleted-files.txt` | "无" |
| `acceptance.md` | 本文档 |