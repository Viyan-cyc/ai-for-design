# Element Plus + GTS 代码示例索引

本文档是代码示例库的索引目录，**每次使用时首先读取此文件**。

---

## 示例总览

| 编号 | 示例名称 | 用途描述 | 核心组件 | 目录路径 |
| --- | --- | --- | --- | --- |
| 001 | table-search-drawer | 搜索表单+数据表格+详情抽屉组合页面 | ElForm, ElInput, ElSelect, ElDatePicker, ElTable, ElTableColumn, ElPagination, ElDrawer, ElTag, ElButton | `references/table-search-drawer/` |
| 002 | mixed-chart | 折线+柱状混合图表页，图表色走 Token | VChart (vue-echarts), ElCard | `references/mixed-chart/` |
| 003 | glow-cards | 卡片氛围光两种形态（角部高光/中心辐射），色相跟语义走 | radial-gradient, color-mix (CSS) | `references/glow-cards/` |
| 004 | frost-decor-card | 品牌色块磨砂装饰（§7.6）：品牌蓝渐变底+边角磨砂圆形/圆角块，card/panel 双档 | pseudo-element, backdrop-filter (CSS) | `references/frost-decor-card/` |
| 005 | frost-material | 整块毛玻璃材质三档对照（§7.1–7.5+7.7）：control/card/overlay、薄染色、hover/active 增量、实色回退 | data-material 属性选择器, backdrop-filter (CSS) | `references/frost-material/` |
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

### 003 - glow-cards（卡片氛围光）

**用途**：单页并列展示卡片氛围光的两种标准形态，设计稿带"氛围光/光晕"时以此为准抄写法。

**两种形态**（同一页对照）：
- **角部高光**（corner-glow）：实底托色的信息卡——`radial-gradient(120% 150% at 0% 0%, 次浅档 0%, transparent 55%)` 压在最浅档实底上，全卡带色，可叠低透明白斜向 sheen。
- **中心辐射**（center-glow）：白底容器内的环境光——`radial-gradient(46% 48% at 50% 44%, 最浅档 0%, transparent 100%)` 叠在 `--color-bg-5` 上，光聚中部、四周留白。

**通用规则**（示例注释同步）：
- 色相跟语义走：品牌蓝 `--brand-*`、告警红 `--red-*`、告警橙 `--orange-*`，成对替换即可；峰值恒取该色系最浅档（次浅档仅限角部高光——下方有实底压色）。
- 中心辐射的 fade 必须拉满到渐变自身边界（`transparent 100%`），提前截断会出现可见边缘圈。
- 白底容器上不放渐变色标：光斑不铺满整卡，四角保持纯白。
- glow（点状发光阴影）与氛围光是两回事：语义节点的小面积 glow 可用，错误根因节点只用描边+常规投影。

**文件结构**：
```
references/glow-cards/
└── index.vue
```

**适用场景**：监控/运维/告警类页面卡片、需要还原设计稿氛围光的所有页面。

### 004 - frost-decor-card（品牌色块磨砂装饰）

**用途**：品牌重点卡（总览/主指标/品牌展示）的边角磨砂装饰，设计稿品牌蓝大卡带"圆形/圆角磨砂图形"时以此为准抄写法。对应设计系统 §7.6。

**两种档位**（同一页对照）：
- **card**（装饰几何 1:1）：圆形 d146px（top -88px/right 2px）+ 圆角块 86px（top 42px/right -52px，旋转 -24°）。
- **panel**（缩放 1.35）：仅宽幅概览卡使用，几何整体放大。

**通用规则**（示例注释同步）：
- 层次固定：同色相弱渐变底（`linear-gradient(115deg, brand-50 60%, brand-40)`）→ 边角磨砂图形（伪元素：白 gray-0 填充 10%→2.5%、描边白 13%、blur 取 `--frost-blur-control`）→ 清晰内容（z-index:1，白字 `--color-text-inverse`）。
- 额度：同组 1 张主卡，同屏 1 处、最多 2 处；普通卡片/导航/按钮/表格/表单/图表绘图区不用。
- 装饰不拦截点击、不进键盘焦点、无动画；不与整块毛玻璃（data-material）同用。

**文件结构**：
```
references/frost-decor-card/
└── index.vue
```

**适用场景**：仪表盘总览主卡、品牌展示卡、设计稿带磨砂圆形装饰的色底大卡。

### 005 - frost-material（整块毛玻璃材质）

**用途**：页面需要材质强调（标签、次级按钮、概览卡片、轻量浮层）时的整块毛玻璃写法，对应设计系统 §7.1–7.5 与 §7.7 调用约定。与 004 独立使用——004 是品牌色块上的磨砂装饰，本示例是中性磨砂材质本身，二者不同时启用。

**页面内容**（同一页对照）：
- **三档材质**：`data-material="frosted"` + `data-frost-level="control|card|overlay"`，各自 blur（12/20/28px）、表面填充、阴影成套取自 `--frost-*` token，不逐组件自由生成数值。
- **薄染色**：`data-frost-tint="blue|lavender|teal"` 叠加在 card 档上；一页优先一种染色，不表达功能状态。
- **交互状态**：hover/active 只调填充 alpha（`::after` 增量层引用 `--frost-hover-add`/`--frost-active-add`，不改模糊；active 阴影 none）；focus 加 2px `--color-border-focus` 外轮廓 offset 2px。
- **实色回退**：`data-transparency="reduced"` 作用域内（或组件 `solid` prop）切换 `--frost-surface-solid` 不透明表面并关闭模糊。

**通用规则**（示例注释同步）：
- 渐变背景放独立父级（frost-backdrop 类），毛玻璃元素垫其上；一个位置只保留一层背景模糊。
- 毛玻璃卡内的按钮和标签用实色，不再开启 backdrop-filter。
- 常驻毛玻璃总面积为主内容视口的 10%–20%（上限 25%）；淡彩不超过 8%；常驻侧栏、表格行、编辑表单用实色。

**文件结构**：
```
references/frost-material/
├── index.vue                    # 展台页：三档对照 + 染色对照 + 状态与回退
└── components/
    └── frost-surface.vue        # 毛玻璃卡组件：属性选择器实现集中于此
```

**适用场景**：AI 建议/智能摘要卡、概览指标卡、轻量浮层菜单；设计稿出现"磨砂/毛玻璃卡片"时以此为准抄写法。

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
| 卡片氛围光 | 003 | glow-cards |
| 品牌卡磨砂装饰 | 004 | frost-decor-card |
| 毛玻璃材质 | 005 | frost-material |
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
