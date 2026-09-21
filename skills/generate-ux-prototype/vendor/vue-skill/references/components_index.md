# GTS 组件 → Element Plus 映射索引

- GTS 规范决定"该长什么样"（视觉参数、状态、规则、"不要"清单）；Element Plus API 决定"怎么写代码"（属性、事件、插槽、方法）。
- 规范路径相对 `design-language/` 源树根（如 `组件规范/通用类/按钮.md`）；EP 文档为官方组件页。
- 复合组件同时遵循内部按钮、输入框等子组件规则。
- 组件文档明确指定的部位、状态和尺寸用于该组件，其余参数遵循 Design System；每份规范文档末尾的"不要"用于检查错误用法。
- **禁止臆测组件属性**：使用任何属性前，先查规范和 EP 官方文档确认。
- ★ = 高频组件（`vue-skill/components/` 下有可直接抄的示例 SFC）。

## 组件选择

| 需求 | GTS 组件 | Element Plus 组件 |
| --- | --- | --- |
| 收纳操作命令 | 下拉菜单 Dropdown | ElDropdown |
| 选择父子层级数据 | 级联选择器 | ElCascader |
| 简短文字解释 | 文字提示 Tooltip | ElTooltip ★ |
| 说明中包含标题、按钮或结构化内容 | 气泡 Popover | ElPopover |
| 用户操作结果的即时反馈 | 消息 Message | ElMessage ★ |
| 系统级提醒或较完整的结果通知 | 通知 Notification | ElNotification ★ |
| 页面内持续的重要提示 | 警告 Alert | ElAlert |
| 要求确认或处理独立任务 | 对话框 Dialog | ElDialog ★ |

## 通用类（4）

| GTS 组件 | GTS 规范路径 | Element Plus 组件 | EP 文档 |
| --- | --- | --- | --- |
| ★ 按钮 Button | 组件规范/通用类/按钮.md | ElButton | https://element-plus.org/en/component/button.html |
| 文字链接 Link | 组件规范/通用类/文字链接.md | ElLink | https://element-plus.org/en/component/link.html |
| 分割线 Divider | 组件规范/通用类/分割线.md | ElDivider | https://element-plus.org/en/component/divider.html |
| 滚动条 Scrollbar | 组件规范/通用类/滚动条.md | ElScrollbar | https://element-plus.org/en/component/scrollbar.html |

## 录入类（17）

| GTS 组件 | GTS 规范路径 | Element Plus 组件 | EP 文档 |
| --- | --- | --- | --- |
| ★ 输入框 Input | 组件规范/录入类/输入框.md | ElInput | https://element-plus.org/en/component/input.html |
| 搜索框 Search | 组件规范/录入类/搜索框.md | ElInput（suffix 图标 + onkeyup 检索） | https://element-plus.org/en/component/input.html |
| 数字输入框 InputNumber | 组件规范/录入类/数字输入框.md | ElInputNumber | https://element-plus.org/en/component/input-number.html |
| ★ 单选框 Radio | 组件规范/录入类/单选框.md | ElRadio / ElRadioGroup | https://element-plus.org/en/component/radio.html |
| ★ 多选框 Checkbox | 组件规范/录入类/多选框.md | ElCheckbox / ElCheckboxGroup | https://element-plus.org/en/component/checkbox.html |
| ★ 开关 Switch | 组件规范/录入类/开关.md | ElSwitch | https://element-plus.org/en/component/switch.html |
| ★ 选择器 Select | 组件规范/录入类/选择器.md | ElSelect / ElOption | https://element-plus.org/en/component/select.html |
| 级联选择器 | 组件规范/录入类/级联选择器.md | ElCascader | https://element-plus.org/en/component/cascader.html |
| 日期时间选择器 DateTimePicker | 组件规范/录入类/日期时间选择器.md | ElDatePicker(type="datetime") | https://element-plus.org/en/component/date-picker.html |
| ★ 日期选择器 DatePicker | 组件规范/录入类/日期选择器.md | ElDatePicker | https://element-plus.org/en/component/date-picker.html |
| 滑块 Slider | 组件规范/录入类/滑块.md | ElSlider | https://element-plus.org/en/component/slider.html |
| 评分 Rate | 组件规范/录入类/评分.md | ElRate | https://element-plus.org/en/component/rate.html |
| 穿梭框 Transfer | 组件规范/录入类/穿梭框.md | ElTransfer | https://element-plus.org/en/component/transfer.html |
| 上传 Upload | 组件规范/录入类/上传.md | ElUpload | https://element-plus.org/en/component/upload.html |
| 颜色选择器 ColorPicker | 组件规范/录入类/颜色选择器.md | ElColorPicker | https://element-plus.org/en/component/color-picker.html |
| 下拉菜单 Dropdown | 组件规范/录入类/下拉菜单.md | ElDropdown | https://element-plus.org/en/component/dropdown.html |
| ★ 表单 Form | 组件规范/录入类/表单.md | ElForm / ElFormItem | https://element-plus.org/en/component/form.html |

## 展示类（13）

| GTS 组件 | GTS 规范路径 | Element Plus 组件 | EP 文档 |
| --- | --- | --- | --- |
| ★ 表格 Table | 组件规范/展示类/表格.md | ElTable / ElTableColumn | https://element-plus.org/en/component/table.html |
| 列表 List | 组件规范/展示类/列表.md | （需自行封装：ElScrollbar + v-for） | — |
| ★ 卡片 Card | 组件规范/展示类/卡片.md | ElCard | https://element-plus.org/en/component/card.html |
| 头像 Avatar | 组件规范/展示类/头像.md | ElAvatar | https://element-plus.org/en/component/avatar.html |
| 徽标 Badge | 组件规范/展示类/徽标.md | ElBadge | https://element-plus.org/en/component/badge.html |
| ★ 标签 Tags | 组件规范/展示类/标签.md | ElTag | https://element-plus.org/en/component/tag.html |
| 折叠面板 Collapse | 组件规范/展示类/折叠面板.md | ElCollapse / ElCollapseItem | https://element-plus.org/en/component/collapse.html |
| ★ 抽屉 Drawer | 组件规范/展示类/抽屉.md | ElDrawer | https://element-plus.org/en/component/drawer.html |
| 日历 Calendar | 组件规范/展示类/日历.md | ElCalendar | https://element-plus.org/en/component/calendar.html |
| 时间轴 Timeline | 组件规范/展示类/时间轴.md | ElTimeline / ElTimelineItem | https://element-plus.org/en/component/timeline.html |
| 树形 Tree | 组件规范/展示类/树形.md | ElTree | https://element-plus.org/en/component/tree.html |
| 气泡 Popover | 组件规范/展示类/气泡.md | ElPopover | https://element-plus.org/en/component/popover.html |
| 轮播 Carousel | 组件规范/展示类/轮播.md | ElCarousel / ElCarouselItem | https://element-plus.org/en/component/carousel.html |

## 导航类（8）

| GTS 组件 | GTS 规范路径 | Element Plus 组件 | EP 文档 |
| --- | --- | --- | --- |
| 顶部导航 | 组件规范/导航类/顶部导航.md | （需自行封装：ElMenu mode="horizontal"） | https://element-plus.org/en/component/menu.html |
| 侧边栏导航 | 组件规范/导航类/侧边栏导航.md | ElMenu / ElSubMenu / ElMenuItem | https://element-plus.org/en/component/menu.html |
| 面包屑 Breadcrumbs | 组件规范/导航类/面包屑.md | ElBreadcrumb / ElBreadcrumbItem | https://element-plus.org/en/component/breadcrumb.html |
| ★ 分页 Pagination | 组件规范/导航类/分页.md | ElPagination | https://element-plus.org/en/component/pagination.html |
| 页签 Tabs | 组件规范/导航类/页签.md | ElTabs / ElTabPane | https://element-plus.org/en/component/tabs.html |
| 步骤条 Steps | 组件规范/导航类/步骤条.md | ElSteps / ElStep | https://element-plus.org/en/component/steps.html |
| 锚点导航 Anchor | 组件规范/导航类/锚点导航.md | （需自行封装） | — |
| 回到顶部 BackTop | 组件规范/导航类/回到顶部.md | ElBacktop | https://element-plus.org/en/component/backtop.html |

## 反馈类（10）

| GTS 组件 | GTS 规范路径 | Element Plus 组件 | EP 文档 |
| --- | --- | --- | --- |
| ★ 对话框 Dialog | 组件规范/反馈类/对话框.md | ElDialog | https://element-plus.org/en/component/dialog.html |
| ★ 消息 Message | 组件规范/反馈类/消息.md | ElMessage（命令式 API，非模板标签） | https://element-plus.org/en/component/message.html |
| ★ 通知 Notification | 组件规范/反馈类/通知.md | ElNotification（命令式 API，非模板标签） | https://element-plus.org/en/component/notification.html |
| 警告 Alert | 组件规范/反馈类/警告.md | ElAlert | https://element-plus.org/en/component/alert.html |
| ★ 文字提示 Tooltip | 组件规范/反馈类/文字提示.md | ElTooltip | https://element-plus.org/en/component/tooltip.html |
| ★ 加载 Loading | 组件规范/反馈类/加载.md | ElLoading / vLoading 指令 | https://element-plus.org/en/component/loading.html |
| 进度条 Progress | 组件规范/反馈类/进度条.md | ElProgress | https://element-plus.org/en/component/progress.html |
| 右键快捷菜单 | 组件规范/反馈类/右键快捷菜单.md | （需自行封装：ElDropdown + contextmenu） | — |
| 记分卡 ScoreCard | 组件规范/反馈类/记分卡.md | （需自行封装：ElCard + 指标） | — |

## 布局容器（高频，配合栅格）

| 用途 | Element Plus 组件 | EP 文档 |
| --- | --- | --- |
| ★ 栅格 / 弹性布局 | ElRow / ElCol | https://element-plus.org/en/component/layout.html |
| 整页骨架（header/aside/main） | ElContainer / ElHeader / ElAside / ElMain | https://element-plus.org/en/component/container.html |
| ★ 空状态 | ElEmpty | https://element-plus.org/en/component/empty.html |

## 高频 20 组件示例对照

| 组件 | 示例文件 | 组件 | 示例文件 |
| --- | --- | --- | --- |
| ElButton | components/ElButton.vue | ElTag | components/ElTag.vue |
| ElInput | components/ElInput.vue | ElCard | components/ElCard.vue |
| ElSelect | components/ElSelect.vue（含 ElOption） | ElRow/ElCol | components/ElLayout.vue（含 ElContainer 系） |
| ElForm | components/ElForm.vue（含 ElFormItem） | ElLoading | components/ElLoading.vue（vLoading 指令） |
| ElTable | components/ElTable.vue（含 ElTableColumn） | ElEmpty | components/ElEmpty.vue |
| ElPagination | components/ElPagination.vue | ElMessage | components/ElMessage.vue（命令式） |
| ElDialog | components/ElDialog.vue | ElNotification | components/ElNotification.vue（命令式） |
| ElDrawer | components/ElDrawer.vue | ElTooltip | components/ElTooltip.vue |
| ElDatePicker | components/ElDatePicker.vue | ElRadio | components/ElRadio.vue（含 ElRadioGroup） |
| ElSwitch | components/ElSwitch.vue | ElCheckbox | components/ElCheckbox.vue（含 ElCheckboxGroup） |
| 图表 | components/VChart.vue | | |

## 需自行封装的组件

GTS 有规范但 EP 无原生对应，需在项目中封装公共组件：

| GTS 组件 | 封装思路 | 参考规范 |
| --- | --- | --- |
| 顶部导航 | ElMenu(mode="horizontal") + logo 插槽 + 用户头像区域 | 组件规范/导航类/顶部导航.md |
| 侧边栏导航 | ElMenu(collapse) + 折叠按钮，展开 240px / 收起 48px | 组件规范/导航类/侧边栏导航.md |
| 锚点导航 | 基于 IntersectionObserver 封装 | 组件规范/导航类/锚点导航.md |
| 列表 | ElScrollbar + v-for + 统一布局样式 | 组件规范/展示类/列表.md |
| 右键快捷菜单 | 基于 ElDropdown 的 contextmenu 触发封装 | 组件规范/反馈类/右键快捷菜单.md |
| 记分卡 ScoreCard | ElCard + 数值展示 + 趋势图标 | 组件规范/反馈类/记分卡.md |

## 图表

Element Plus 无内置图表，使用 ECharts + vue-echarts + GTS 图表配色 Token：

- 组件引入：`import VChart from 'vue-echarts'`，模板用 `<VChart :option="..." autoresize />`。
- 配色**运行时读取 Token**（不写 hex，换肤自动跟随）：

```js
const readToken = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const chartColors = ['--color-chart-1','--color-chart-2','--color-chart-3',
  '--color-chart-4','--color-chart-5','--color-chart-6'].map(readToken).filter(Boolean)
```

- 默认六色序列 `color-chart-1..6` 顺序使用；无障碍场景用 `-accessible` 变体，不逐色拼接两组。
- 示例：`components/VChart.vue`、`code-example/references/mixed-chart/`。
