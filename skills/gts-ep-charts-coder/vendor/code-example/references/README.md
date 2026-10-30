# Element Plus + GTS 代码示例索引

仅在需要整页参考时搜索当前需求对应条目；已有准确示例路径时不重复读索引。

---

## 示例总览

| 编号 | 示例名称 | 用途描述 | 核心组件 | 目录路径 |
| --- | --- | --- | --- | --- |
| 001 | table-search-drawer | 搜索表单+数据表格+详情抽屉组合页面 | ElForm, ElInput, ElSelect, ElDatePicker, ElTable, ElTableColumn, ElPagination, ElDrawer, ElTag, ElButton | `references/table-search-drawer/` |
| 002 | mixed-chart | 折线+柱状混合图表页，图表色走 Token | VChart (vue-echarts), ElCard | `references/mixed-chart/` |
| 006 | content-states | 内容状态九态整页对照：首次使用/加载/有数据/空结果/筛选无结果/无权限/加载失败/已删除/部分模块失败 | ElSegmented, ElResult, ElSkeleton, ElTable, ElEmpty | `references/content-states/` |
| 007 | feedback-flow | 操作反馈流四区对照：全局消息/嵌入式消息（6 组语义全对照）/系统通知/确认与高危确认 | ElMessage, ElNotification, ElDialog, ElCheckbox, ElButton | `references/feedback-flow/` |

---

## 示例详情

### 001 - table-search-drawer（搜索表单+表格+抽屉）

**用途**：通用的数据检索页面，包含顶部搜索表单、中部数据表格、右侧详情抽屉。

**核心功能**：
- 搜索表单：支持多字段筛选（输入框、下拉选择、日期范围）
- 数据表格：支持排序、分页、斑马纹
- 详情抽屉：点击表格行展开详情面板

**文件结构**：
```
references/table-search-drawer/
├── index.vue                    # 主页面入口
└── components/
    ├── search-form.vue          # 顶部搜索表单
    ├── data-table.vue           # 数据表格
    └── detail-drawer.vue        # 详情抽屉
```

**适用场景**：后台管理数据列表页、检索筛选类页面、包含表单和表格的复合页面。

### 002 - mixed-chart（混合图表页）

**用途**：单卡片混合图表页，展示折线+柱状组合的基础写法。

**核心功能**：
- 图表配色运行时读取 `--color-chart-*` Token（不写 hex，换肤自动跟随）
- 图表容器高度走 less 类 + `autoresize`

**文件结构**：
```
references/mixed-chart/
└── index.vue
```

**适用场景**：数据分析页、仪表盘中的单个图表卡片、图表用法速查。

### 006 - content-states（内容状态九态）

**用途**：列表页空/加载/错误状态的整页示范，对应设计规范《内容状态》。状态判定：初始 → 加载 → 有数据 / 空结果 / 失败；重试回到加载。

**九态对照**（ElSegmented 切换）：
- **首次使用**：中性说明 + 新建入口（有创建权限时才提供）。
- **加载中**：表格区域骨架屏。
- **有数据**：正常表格。
- **空结果**（成功请求返回零条）：中性文字"暂无数据"，不用错误图标，不凭空提供新建入口。
- **筛选无结果**：保留已输入条件 + "清除筛选"；不清空整页导航与筛选区。
- **无权限**：info 图标"暂无查看权限"，不泄露受限数据（行数为 0）；仅真实流程存在时提供申请入口。
- **加载失败**：error 图标"加载失败，请重试" + 可执行重试（回加载态）；不是中性空态。
- **已删除**：warning"内容不存在或已移除" + 返回列表；不显示可编辑的虚假空表单。
- **部分模块失败**：成功区域照常展示 + 失败区域内重试 + 更新时间标注；不用全页空态遮盖有效数据。

**通用规则**（示例注释同步）：
- 空态放在所属内容区域，普通表格空态保留表头及工具栏；背景继承容器，不新增空态专属底色。
- 中性说明 `--color-text-secondary`、主文字 `--color-text-primary`、错误说明 `--color-error`；间距 `--space-size-8/16`。
- 旧请求晚到不覆盖新结果（示例用请求序号 guard 演示）；异步无结果用 aria-live 低打扰播报。
- 不要将无权限、失败、无结果统一显示为"暂无数据"；不要提供无法执行的重试或申请入口。

**文件结构**：
```
references/content-states/
└── index.vue
```

**适用场景**：所有带列表/表格的页面；设计稿或需求提到空态、加载态、错误态、无权限态时以此为准抄写法。

### 007 - feedback-flow（操作反馈流）

**用途**：用户操作触发的三层反馈（即时消息、系统通知、确认/高危确认对话框）整页示范，对应组件规范《反馈类》消息/通知/对话框三篇。

**四区对照**（同一页）：
- **全局消息**：ElMessage 4 类型（info/success/warning/error），顶部居中距顶 20px；时长分档提示/成功 5s、警告/错误 10s（duration props）；错误消息含原因与后续动作。
- **嵌入式消息**：自绘 6 组语义全对照（error/alert/warning/success/info/none）——告警与失效两组 EP 浮层不提供，按规范在此补全；无阴影、1px `color-brand` 边框、不自动消失可手动关闭，出现时挤开内容。
- **系统通知**：ElNotification 右上角距边 20px（offset props）；EP 无 max 参数（2.13.5 核验），"最多同时 3 条"以队列守卫实现（超出先关最早一条）；标题+说明结构。
- **确认与高危确认**：L1 对话框（458px 垂直居中）；高危三原则硬实现——复选框默认不勾选、未确认禁用执行按钮、打开时焦点置于取消按钮（@opened 后聚焦，避开 focus-trap）；执行中按钮 loading 防重复触发；点遮罩不放行关闭。

**通用规则**（示例注释同步）：
- 浮层（挂 body）组件的语义配色经 customClass + 非 scoped 全局样式实现（页面 scoped 不可达 body）；值全部引用 `--color-*-subtle`/`--color-*` 成对 token，双主题自动跟随。主题槽位接线进 bridge 是独立任务。
- 短暂消息不承载必须持续查阅的关键信息；不自动消失的通知必须保留关闭入口；不要把通知放在内容中间遮挡当前任务。
- 对话框按内容量选 L1–L5（458/616/932/1248px/全屏）；高危说明不藏在滚动区域；右上角关闭与取消等效。

**文件结构**：
```
references/feedback-flow/
├── index.vue                    # 展台页：全局消息 + 嵌入式 6 语义 + 通知 + 确认入口
└── components/
    └── danger-dialog.vue        # 高危确认 L1 对话框（三原则硬实现）
```

**适用场景**：所有需要操作结果反馈的页面；设计稿出现消息提示、通知、确认弹窗时以此为准抄写法。

---

## 示例分类索引

### 按功能类型

| 分类 | 示例编号 | 示例名称 |
| --- | --- | --- |
| 表格+表单 | 001 | table-search-drawer |
| 图表 | 002 | mixed-chart |
| 内容状态 | 006 | content-states |
| 操作反馈流 | 007 | feedback-flow |

### 按使用的核心组件

| 组件 | 示例编号 | 示例名称 |
| --- | --- | --- |
| ElForm | 001 | table-search-drawer |
| ElTable | 001, 006 | table-search-drawer, content-states |
| ElDrawer | 001 | table-search-drawer |
| ElPagination | 001 | table-search-drawer |
| VChart | 002 | mixed-chart |
| ElResult | 006 | content-states |
| ElSkeleton | 006 | content-states |
| ElSegmented | 006 | content-states |
| ElMessage | 007 | feedback-flow |
| ElNotification | 007 | feedback-flow |
| ElDialog | 007 | feedback-flow |
| ElCheckbox | 007 | feedback-flow |

---

## 添加新示例

当有新的优秀代码示例要添加时：

1. 在 `references/` 下创建新的示例目录
2. 在目录中包含必要的代码文件（主文件+组件文件）
3. 更新本文档的索引表格，添加新示例信息

**命名规范**：
- 示例目录：小写中划线命名（如 `mixed-chart`）
- 主文件：`index.vue`
- 组件目录：`components/`
- 组件文件：`kebab-case` 命名（如 `search-form.vue`）

**代码规范**：
- 所有样式使用 GTS Token（CSS 变量），`<style scoped lang="less">`
- 组件按需导入，模板标签 PascalCase
- 不写静态内联 style

---

## 使用限制

- **禁止**一次性读取所有示例文件
- **禁止**使用通配符批量加载 `references/` 下的文件
- 每次仅加载当前任务相关的 1-2 个示例文件


## 复制整页与服务

先遵守code-rules；示例不是规则的例外。index.vue复制到src/pages/{PAGE}/index.vue（PAGE取init输出），同页components一起复制。所选示例的api/内容合入src/api/（含mock子目录），不放在页面内：

| 示例 | 服务 | mock |
|---|---|---|
| table-search-drawer | api/tasks.js | api/mock/tasks-data.js |
| mixed-chart | api/metrics.js | api/mock/metrics-data.js |
| content-states | api/events.js | api/mock/events-data.js |
| feedback-flow | api/operations.js | api/mock/operation-result.js |

只复制当前使用的示例及依赖，不遍历全库。组件用法片段中的ElTable/VChart通过props接收业务数据，整页服务负责提供；图表主题变化后重算option并清理Observer。UI配置可在组件，业务记录不内嵌。模拟操作明确标为演示，未接入动作不冒充成功。
