# GTS 组件 → SweetUI 映射索引

- GTS 规范决定"该长什么样"（视觉参数、状态、规则、"不要"清单）；SweetUI API 决定"怎么写代码"
  （属性、事件、插槽、方法）。
- 规范路径相对 `design-language/` 源树根（如 `组件规范/通用类/按钮.md`）；SweetUI 组件细节
  以内网官方文档与包内 `es/components/*/src/props.mjs` 为准。
- **禁止臆测组件属性**：使用任何属性前，先查规范和官方文档确认；不从示例推断未列出的属性。
- 命名机械对应：模板标签 kebab-case `sweet-big-table` ↔ import 名 PascalCase `SweetBigTable`；
  子组件（`sweet-table-column`/`sweet-form-item`/`sweet-option` 等）随宿主组件一起 import。
- ★ = 高频组件（`vue-skill/components/` 下有可直接抄的示例 SFC）。
- 组件全集 137 个（白名单 `scripts/verify/whitelists/sweetui-components.json`，build 校验）。

## 组件选择

| 需求 | GTS 组件 | SweetUI 组件 |
| --- | --- | --- |
| 收纳操作命令 | 下拉菜单 Dropdown | sweet-dropdown |
| 选择父子层级数据 | 级联选择器 | sweet-cascader |
| 树形数据选择 | 树形选择 | sweet-select-tree（独立组件，见下节） |
| 简短文字解释 | 文字提示 Tooltip | sweet-tooltip ★ |
| 说明中包含标题、按钮或结构化内容 | 气泡 Popover | sweet-popover |
| 用户操作结果的即时反馈 | 消息 Message | sweet-message ★ |
| 系统级提醒或较完整的结果通知 | 通知 Notification | $sweetNotify ★（命令式） |
| 页面内持续的重要提示 | 警告 Alert | sweet-alert |
| 要求确认或处理独立任务 | 对话框 Dialog | sweet-dialog ★ |

## 缺失回退清单（EP 有、SweetUI 5.6.5 没有）

| 缺失组件 | 回退写法 |
| --- | --- |
| textarea（独立多行输入） | `<sweet-input type="textarea" />`（sweet-text 是文本**展示**组件，不是输入） |
| check-tag | `<sweet-tag>` + 点击切换选中态（自管 checked 样式） |
| avatar-group | 页面自封装：sweet-avatar 叠放（负 margin）+ 计数徽标 |
| image-viewer | `<sweet-image>`（自带预览能力，`preview-src-list` 开启点击放大） |

## SweetSelectTree（树形选择，独立组件）

EP 的 `el-tree-select` 在 SweetUI 里是**独立组件** `sweet-select-tree`（非组合封装），
props 合并自 Select + Tree + VirtualTree，关键内建项：

- `node-key`（默认 `"value"`）、`default-props`（默认 `{ children: "children", label: "text" }`
  ——**label 字段默认是 `text`**，与常见 `label` 命名不同）；
- `collapse-tags` 默认 `true`；`leaf-only` 默认 `true`（只选叶子）；
- 扩展：`search`（搜索）、`show-check-all`、`popover-width`/`popover-height`、`width`（默认 200）。

```vue
<sweet-select-tree v-model="orgId" :data="orgTree"
  node-key="id" :default-props="{ children: 'children', label: 'name' }" />
```

## 通用类（4）

| GTS 组件 | GTS 规范路径 | SweetUI 组件 | 备注 |
| --- | --- | --- | --- |
| ★ 按钮 Button | 组件规范/通用类/按钮.md | sweet-button / sweet-button-group | — |
| 文字链接 Link | 组件规范/通用类/文字链接.md | sweet-link | — |
| 分割线 Divider | 组件规范/通用类/分割线.md | sweet-divider | — |
| 滚动条 Scrollbar | 组件规范/通用类/滚动条.md | sweet-scrollbar | — |

## 录入类（17）

| GTS 组件 | GTS 规范路径 | SweetUI 组件 | 备注 |
| --- | --- | --- | --- |
| ★ 输入框 Input | 组件规范/录入类/输入框.md | sweet-input | 多行 `type="textarea"`；另有 sweet-autocomplete（联想输入） |
| 搜索框 Search | 组件规范/录入类/搜索框.md | sweet-input（suffix icon-plus + 检索回调） | — |
| 数字输入框 InputNumber | 组件规范/录入类/数字输入框.md | sweet-input-number | — |
| ★ 单选框 Radio | 组件规范/录入类/单选框.md | sweet-radio / sweet-radio-group | 另有 sweet-radio-button |
| ★ 多选框 Checkbox | 组件规范/录入类/多选框.md | sweet-checkbox / sweet-checkbox-group | 另有 sweet-checkbox-button |
| ★ 开关 Switch | 组件规范/录入类/开关.md | sweet-switch | — |
| ★ 选择器 Select | 组件规范/录入类/选择器.md | sweet-select / sweet-option | 大数据用 sweet-select-v2；多标签 sweet-multi-select |
| 树形选择 | （SweetUI 扩展形态） | sweet-select-tree | 独立组件，见上节 |
| 级联选择器 | 组件规范/录入类/级联选择器.md | sweet-cascader / sweet-cascader-panel | — |
| 日期时间选择器 DateTimePicker | 组件规范/录入类/日期时间选择器.md | sweet-date-picker（type="datetime"） | — |
| ★ 日期选择器 DatePicker | 组件规范/录入类/日期选择器.md | sweet-date-picker | 时间用 sweet-time-picker / sweet-time-range / sweet-time-select |
| 滑块 Slider | 组件规范/录入类/滑块.md | sweet-slider | — |
| 评分 Rate | 组件规范/录入类/评分.md | sweet-rate | — |
| 穿梭框 Transfer | 组件规范/录入类/穿梭框.md | sweet-transfer | 另有 sweet-list-transfer / sweet-tree-transfer |
| 上传 Upload | 组件规范/录入类/上传.md | sweet-upload | — |
| 颜色选择器 ColorPicker | 组件规范/录入类/颜色选择器.md | sweet-color-picker | 另有 sweet-color-picker-custom |
| 下拉菜单 Dropdown | 组件规范/录入类/下拉菜单.md | sweet-dropdown / sweet-dropdown-menu / sweet-dropdown-item | — |
| ★ 表单 Form | 组件规范/录入类/表单.md | sweet-form / sweet-form-item | 校验规则结构与 EP 相同；预览下 ref validate 失效（error-checklist 坑 1） |

## 展示类（13）

| GTS 组件 | GTS 规范路径 | SweetUI 组件 | 备注 |
| --- | --- | --- | --- |
| ★ 表格 Table | 组件规范/展示类/表格.md | sweet-table / sweet-table-column | 大数据用 sweet-big-table / sweet-virtual-table（见扩展节） |
| 列表 List | 组件规范/展示类/列表.md | （需自行封装：sweet-scrollbar + v-for） | — |
| ★ 卡片 Card | 组件规范/展示类/卡片.md | sweet-card | 另有 sweet-panel |
| 头像 Avatar | 组件规范/展示类/头像.md | sweet-avatar | Group 缺失 → 自封装（见回退清单） |
| 徽标 Badge | 组件规范/展示类/徽标.md | sweet-badge | — |
| ★ 标签 Tags | 组件规范/展示类/标签.md | sweet-tag | check-tag 缺失 → tag + click 回退 |
| 折叠面板 Collapse | 组件规范/展示类/折叠面板.md | sweet-collapse / sweet-collapse-item | — |
| ★ 抽屉 Drawer | 组件规范/展示类/抽屉.md | sweet-drawer | 侧滑面板另有 sweet-side-panel |
| 日历 Calendar | 组件规范/展示类/日历.md | sweet-calendar | — |
| 时间轴 Timeline | 组件规范/展示类/时间轴.md | sweet-timeline / sweet-timeline-item | — |
| 树形 Tree | 组件规范/展示类/树形.md | sweet-tree | 大数据用 sweet-tree-v2 / sweet-virtual-tree |
| 气泡 Popover | 组件规范/展示类/气泡.md | sweet-popover | 确认气泡用 sweet-popconfirm |
| 轮播 Carousel | 组件规范/展示类/轮播.md | sweet-carousel / sweet-carousel-item | — |

## 导航类（8）

| GTS 组件 | GTS 规范路径 | SweetUI 组件 | 备注 |
| --- | --- | --- | --- |
| 顶部导航 | 组件规范/导航类/顶部导航.md | （需自行封装：sweet-menu mode="horizontal"） | — |
| 侧边栏导航 | 组件规范/导航类/侧边栏导航.md | sweet-menu / sweet-submenu / sweet-menu-item | — |
| 面包屑 Breadcrumbs | 组件规范/导航类/面包屑.md | sweet-breadcrumb / sweet-breadcrumb-item | — |
| ★ 分页 Pagination | 组件规范/导航类/分页.md | sweet-pagination | **UMD 坑 2**：current-page 必须 v-model 绑 ref；迷你分页 sweet-min-pagination |
| 页签 Tabs | 组件规范/导航类/页签.md | sweet-tabs / sweet-tab-pane | — |
| 步骤条 Steps | 组件规范/导航类/步骤条.md | sweet-steps / sweet-step | — |
| 锚点导航 Anchor | 组件规范/导航类/锚点导航.md | sweet-anchor / sweet-anchor-link | SweetUI 原生支持，无需自封装 |
| 回到顶部 BackTop | 组件规范/导航类/回到顶部.md | sweet-backtop | — |

## 反馈类（10）

| GTS 组件 | GTS 规范路径 | SweetUI 组件 | 备注 |
| --- | --- | --- | --- |
| ★ 对话框 Dialog | 组件规范/反馈类/对话框.md | sweet-dialog | 默认 `draggable` `:close-on-click-modal="false"`（code-rules 2.3） |
| ★ 消息 Message | 组件规范/反馈类/消息.md | sweet-message（命令式 API，非模板标签） | — |
| ★ 通知 Notification | 组件规范/反馈类/通知.md | $sweetNotify（命令式 API，非模板标签） | `$sweetNotify.success(...)` 等 4 种快捷方法 |
| 警告 Alert | 组件规范/反馈类/警告.md | sweet-alert | — |
| ★ 文字提示 Tooltip | 组件规范/反馈类/文字提示.md | sweet-tooltip | — |
| ★ 加载 Loading | 组件规范/反馈类/加载.md | sweet-loading（v-loading 指令 + $loading 服务） | 指令随全量安装自动注册，**禁止显式 import 指令实体**（error-checklist 错误 3.2） |
| 进度条 Progress | 组件规范/反馈类/进度条.md | sweet-progress | 另有 sweet-custom-loading |
| 右键快捷菜单 | 组件规范/反馈类/右键快捷菜单.md | sweet-popup-menu | SweetUI 原生支持，无需自封装 |
| 记分卡 ScoreCard | 组件规范/反馈类/记分卡.md | sweet-score-card / sweet-score-card-group | SweetUI 原生支持 |
| 结果页 Result | 组件规范/反馈类/结果页.md | sweet-result | — |

## 布局容器（高频，配合栅格）

| 用途 | SweetUI 组件 | 备注 |
| --- | --- | --- |
| ★ 栅格 / 弹性布局 | sweet-row / sweet-col | 24 栅格，响应式 props `:xs :sm :md :lg :xl`（code-rules 第十二节） |
| 整页骨架（header/aside/main） | sweet-container / sweet-header / sweet-aside / sweet-main / sweet-footer | — |
| ★ 空状态 | sweet-empty | — |
| 间距 | sweet-space | — |
| 吸顶/吸附 | sweet-affix | — |
| 自适应容器 | sweet-auto-resizer | — |
| 拖拽栅格 | sweet-grid-layout / sweet-grid-item | — |
| 底部面板 | sweet-bottom-panel | — |

## SweetUI 扩展组件（GTS 未列规范、EP 没有）

按需取用；属性以内网文档为准。

| 组件 | 用途 |
| --- | --- |
| sweet-big-table / sweet-big-table-column | 大数据表格 |
| sweet-virtual-table / sweet-virtual-table-column | 虚拟滚动表格 |
| sweet-tree-table | 树形表格 |
| sweet-cmp-table / sweet-genex-table | 对比表 / 扩展表格 |
| sweet-text | 文本展示（省略/换行控制；**不是输入组件**） |
| sweet-clamp | 多行截断 |
| sweet-select-v2 / sweet-multi-select / sweet-custom-select | 选择器变体 |
| sweet-time-range / sweet-time-select | 时间范围 / 时间点选择 |
| sweet-list-transfer / sweet-tree-transfer | 穿梭框变体 |
| sweet-card-pagination / sweet-min-pagination | 卡片分页 / 迷你分页 |
| sweet-side-panel / sweet-bottom-panel / sweet-panel | 侧滑 / 底部 / 面板容器 |
| sweet-validate | 校验 |
| sweet-icon | 字体图标（仅 iconClass/size/color，页面不直接用——统一 icon-plus，code-rules 2.5.1） |
| sweet-config-provider | 全局配置（:locale；**不设 namespace**，SKILL 硬约束 3） |

## 高频组件示例对照

> 示例 SFC 待内网按本表生成到 `vue-skill/components/`（见其 README）；生成前此表仅作清单。

| 组件 | 示例文件 | 组件 | 示例文件 |
| --- | --- | --- | --- |
| sweet-button | components/SweetButton.vue | sweet-tag | components/SweetTag.vue |
| sweet-input | components/SweetInput.vue（含 textarea） | sweet-card | components/SweetCard.vue |
| sweet-select | components/SweetSelect.vue（含 sweet-option） | sweet-row/sweet-col | components/SweetLayout.vue（含 container 系） |
| sweet-form | components/SweetForm.vue（含 sweet-form-item） | sweet-loading | components/SweetLoading.vue（v-loading + $loading） |
| sweet-table | components/SweetTable.vue（含 sweet-table-column） | sweet-empty | components/SweetEmpty.vue |
| sweet-pagination | components/SweetPagination.vue（ref 绑定口径） | sweet-message | components/SweetMessage.vue（命令式） |
| sweet-dialog | components/SweetDialog.vue | $sweetNotify | components/SweetNotification.vue（命令式） |
| sweet-drawer | components/SweetDrawer.vue | sweet-tooltip | components/SweetTooltip.vue |
| sweet-date-picker | components/SweetDatePicker.vue | sweet-radio | components/SweetRadio.vue（含 group） |
| sweet-switch | components/SweetSwitch.vue | sweet-checkbox | components/SweetCheckbox.vue（含 group） |
| icon-plus | components/IconPlus.vue（包装组件，骨架自带） | 图表 | components/SweetChart.vue |

## 图表

SweetUI 内置 13 个图表组件（ECharts 6.1 封装）+ sweet-echarts 通用基底，
**无需 vue-echarts**：

`sweet-line-chart`（折线）/ `sweet-area-chart`（面积）/ `sweet-bar-chart`（柱状）/
`sweet-barline-chart`（柱线混合）/ `sweet-hor-bar-chart`（水平柱状）/ `sweet-pie-chart`（饼图）/
`sweet-radar-chart`（雷达）/ `sweet-gauge-chart`（仪表盘）/ `sweet-map-chart`（地图）/
`sweet-boxplot-chart`（箱线）/ `sweet-bubble-chart`（气泡）/ `sweet-liquidfill-chart`（水球）/
`sweet-radial-bar-chart`（径向柱图）。

- 基本用法（`:autoresize` 跟随容器尺寸）：

```vue
<sweet-line-chart :data="chartData" :autoresize="true" :height="300" />
```

```js
const chartData = ref({
  xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  yAxis: { type: 'value' },
  series: [{ data: [150, 230, 224, 218, 135], type: 'line' }],
})
```

- **chartTheme 是 JS 静态对象，不读 CSS 变量**——换肤后图表配色不变。跟随 GTS Token 需运行时
  读取注入（变量挂在 `body[theme]` 作用域上，**从 `document.body` 读**）：

```js
const readToken = (name) =>
  getComputedStyle(document.body).getPropertyValue(name).trim()
const chartColors = ['--color-chart-1', '--color-chart-2', '--color-chart-3',
  '--color-chart-4', '--color-chart-5', '--color-chart-6'].map(readToken).filter(Boolean)
```

- 默认六色序列 `color-chart-1..6` 顺序使用；无障碍场景用 `-accessible` 变体，不逐色拼接两组。
- 换肤后图表不自动重绘：`MutationObserver` 监听 `body[theme]` 属性变化 → 重读 token →
  重建配色（模式见 code-rules 规则 11.2）。
