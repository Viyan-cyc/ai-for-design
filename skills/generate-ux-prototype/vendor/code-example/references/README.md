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

---

## 示例分类索引

### 按功能类型

| 分类 | 示例编号 | 示例名称 |
| --- | --- | --- |
| 表格+表单 | 001 | table-search-drawer |
| 图表 | 002 | mixed-chart |
| 卡片氛围光 | 003 | glow-cards |
| 品牌卡磨砂装饰 | 004 | frost-decor-card |

### 按使用的核心组件

| 组件 | 示例编号 | 示例名称 |
| --- | --- | --- |
| ElForm | 001 | table-search-drawer |
| ElTable | 001 | table-search-drawer |
| ElDrawer | 001 | table-search-drawer |
| ElPagination | 001 | table-search-drawer |
| VChart | 002 | mixed-chart |

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
