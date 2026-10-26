# GTS 组件 → Element Plus 映射索引

- GTS 规范决定"该长什么样"（视觉参数、状态、规则、"不要"清单）；Element Plus API 决定"怎么写代码"（属性、事件、插槽、方法）。
- 规范路径相对 `design-language/` 源树根（如 `组件规范/通用类/按钮.md`）。
- 复合组件同时遵循内部按钮、输入框等子组件规则。
- 组件文档明确指定的部位、状态和尺寸用于该组件，其余参数遵循 Design System；每份规范文档末尾的"不要"用于检查错误用法。
- ★ = 高频组件（`vue-skill/components/` 下有可直接抄的示例 SFC）。

本索引按GTS规范组织，不是Element Plus全部组件清单；未收录不代表不支持。名称先查 `scripts/verify/whitelists/element-plus-exports.json`（相对skill根）；白名单仅证明导出存在，属性/事件/插槽仍需核对实际版本资料。

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

## 高频组件使用要点

只读取本页使用的条目；熟悉EP API不能代替GTS使用约定。以下摘自对应GTS组件规范（源路径见后文映射表），未覆盖的细节按需查原条款。样式状态由组件和桥接层提供，不据此手写组件皮肤；示例仅在API或结构不确定时读取。

| 组件 | GTS使用要点 | 按需示例 |
| --- | --- | --- |
| ElButton | 每组最多一个主要按钮，主要操作通常在右侧。单列表单底部操作左对齐；弹窗、抽屉、多列表单底部操作右对齐。图标按钮允许使用，并提供可访问名称及说明；提交中阻止重复触发。 | [ElButton.vue](../components/ElButton.vue) |
| ElLink | 用于真实跳转；独立链接默认无下划线、悬停出现，段落内链接默认带下划线，字号随上下文。没有目的地时不以 `href="#"` 冒充已实现导航。 | 无独立示例；属性按实际版本核对 |
| ElInput / ElSelect | 输入项保留标签，placeholder说明输入要求；错误说明原因和修正方法。选择器不混入命令操作、不把分组标题做成可选项；需用户明确同意时不预选。 | [ElInput.vue](../components/ElInput.vue)、[ElSelect.vue](../components/ElSelect.vue) |
| ElForm / ElFormItem | 标签较长、多语言或宽度不足时优先上下布局；同层标签对齐一致，字段错误就近展示，placeholder不代替标签。校验与提交按代码规则实现，保持只读与禁用语义。 | [ElForm.vue](../components/ElForm.vue) |
| ElTable / ElTableColumn | 全局操作、批量操作、行操作分别明确归属；批量操作显示已选范围，筛选和排序状态保持可见。操作区、表格和分页之间用 `--space-size-16`；列内内容排列一致，不汇总不同计量单位的数据。 | [ElTable.vue](../components/ElTable.vue) |
| ElPagination | 与所控数据区域相邻；每页通常10条，单页可隐藏，窄区域按需使用简化分页；无效翻页禁用。数据查询、重置及切页大小时的页码同步按代码规则处理。 | [ElPagination.vue](../components/ElPagination.vue) |
| ElDialog | 确认、短表单或简单流程用对话框；高危确认默认不勾选，确认前禁用执行，默认焦点在取消。关闭与取消等效，重要风险说明不藏进滚动区；一列窄弹窗不挤多列表单。 | [ElDialog.vue](../components/ElDialog.vue) |
| ElDrawer | 需要同时操作原页面时使用非模态；独立任务可用模态，遮罩下页面不可操作。多层钻取关闭后保留上一级状态，同类任务关闭方式一致。 | [ElDrawer.vue](../components/ElDrawer.vue) |

## 通用类（4）

| GTS 组件 | GTS 规范路径 | Element Plus 组件 |
| --- | --- | --- |
| ★ 按钮 Button | 组件规范/通用类/按钮.md | ElButton |
| 文字链接 Link | 组件规范/通用类/文字链接.md | ElLink |
| 分割线 Divider | 组件规范/通用类/分割线.md | ElDivider |
| 滚动条 Scrollbar | 组件规范/通用类/滚动条.md | ElScrollbar |

## 录入类（17）

| GTS 组件 | GTS 规范路径 | Element Plus 组件 |
| --- | --- | --- |
| ★ 输入框 Input | 组件规范/录入类/输入框.md | ElInput |
| 搜索框 Search | 组件规范/录入类/搜索框.md | ElInput（suffix 图标 + onkeyup 检索） |
| 数字输入框 InputNumber | 组件规范/录入类/数字输入框.md | ElInputNumber |
| ★ 单选框 Radio | 组件规范/录入类/单选框.md | ElRadio / ElRadioGroup |
| ★ 多选框 Checkbox | 组件规范/录入类/多选框.md | ElCheckbox / ElCheckboxGroup |
| ★ 开关 Switch | 组件规范/录入类/开关.md | ElSwitch |
| ★ 选择器 Select | 组件规范/录入类/选择器.md | ElSelect / ElOption |
| 级联选择器 | 组件规范/录入类/级联选择器.md | ElCascader |
| 日期时间选择器 DateTimePicker | 组件规范/录入类/日期时间选择器.md | ElDatePicker(type="datetime") |
| ★ 日期选择器 DatePicker | 组件规范/录入类/日期选择器.md | ElDatePicker |
| 滑块 Slider | 组件规范/录入类/滑块.md | ElSlider |
| 评分 Rate | 组件规范/录入类/评分.md | ElRate |
| 穿梭框 Transfer | 组件规范/录入类/穿梭框.md | ElTransfer |
| 上传 Upload | 组件规范/录入类/上传.md | ElUpload |
| 颜色选择器 ColorPicker | 组件规范/录入类/颜色选择器.md | ElColorPicker |
| 下拉菜单 Dropdown | 组件规范/录入类/下拉菜单.md | ElDropdown |
| ★ 表单 Form | 组件规范/录入类/表单.md | ElForm / ElFormItem |

## 展示类（13）

| GTS 组件 | GTS 规范路径 | Element Plus 组件 |
| --- | --- | --- |
| ★ 表格 Table | 组件规范/展示类/表格.md | ElTable / ElTableColumn |
| 列表 List | 组件规范/展示类/列表.md | （需自行封装：ElScrollbar + v-for） |
| ★ 卡片 Card | 组件规范/展示类/卡片.md | ElCard |
| 头像 Avatar | 组件规范/展示类/头像.md | ElAvatar |
| 徽标 Badge | 组件规范/展示类/徽标.md | ElBadge |
| ★ 标签 Tags | 组件规范/展示类/标签.md | ElTag |
| 折叠面板 Collapse | 组件规范/展示类/折叠面板.md | ElCollapse / ElCollapseItem |
| ★ 抽屉 Drawer | 组件规范/展示类/抽屉.md | ElDrawer |
| 日历 Calendar | 组件规范/展示类/日历.md | ElCalendar |
| 时间轴 Timeline | 组件规范/展示类/时间轴.md | ElTimeline / ElTimelineItem |
| 树形 Tree | 组件规范/展示类/树形.md | ElTree |
| 气泡 Popover | 组件规范/展示类/气泡.md | ElPopover |
| 轮播 Carousel | 组件规范/展示类/轮播.md | ElCarousel / ElCarouselItem |

## 导航类（8）

| GTS 组件 | GTS 规范路径 | Element Plus 组件 |
| --- | --- | --- |
| 顶部导航 | 组件规范/导航类/顶部导航.md | （需自行封装：ElMenu mode="horizontal"） |
| 侧边栏导航 | 组件规范/导航类/侧边栏导航.md | ElMenu / ElSubMenu / ElMenuItem |
| 面包屑 Breadcrumbs | 组件规范/导航类/面包屑.md | ElBreadcrumb / ElBreadcrumbItem |
| ★ 分页 Pagination | 组件规范/导航类/分页.md | ElPagination |
| 页签 Tabs | 组件规范/导航类/页签.md | ElTabs / ElTabPane |
| 步骤条 Steps | 组件规范/导航类/步骤条.md | ElSteps / ElStep |
| 锚点导航 Anchor | 组件规范/导航类/锚点导航.md | （需自行封装） |
| 回到顶部 BackTop | 组件规范/导航类/回到顶部.md | ElBacktop |

## 反馈类（9）

| GTS 组件 | GTS 规范路径 | Element Plus 组件 |
| --- | --- | --- |
| ★ 对话框 Dialog | 组件规范/反馈类/对话框.md | ElDialog |
| ★ 消息 Message | 组件规范/反馈类/消息.md | ElMessage（命令式 API，非模板标签） |
| ★ 通知 Notification | 组件规范/反馈类/通知.md | ElNotification（命令式 API，非模板标签） |
| 警告 Alert | 组件规范/反馈类/警告.md | ElAlert |
| ★ 文字提示 Tooltip | 组件规范/反馈类/文字提示.md | ElTooltip |
| ★ 加载 Loading | 组件规范/反馈类/加载.md | ElLoading / vLoading 指令 |
| 进度条 Progress | 组件规范/反馈类/进度条.md | ElProgress |
| 右键快捷菜单 | 组件规范/反馈类/右键快捷菜单.md | （需自行封装：ElDropdown + contextmenu） |
| 记分卡 ScoreCard | 组件规范/反馈类/记分卡.md | （需自行封装：ElCard + 指标） |

## 布局容器（高频，配合栅格）

| 用途 | Element Plus 组件 |
| --- | --- |
| ★ 栅格 / 弹性布局 | ElRow / ElCol |
| 整页骨架（header/aside/main） | ElContainer / ElHeader / ElAside / ElMain |
| ★ 空状态 | ElEmpty |

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
