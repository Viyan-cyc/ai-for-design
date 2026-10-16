# 页面与组件索引

先按页面选一个起点，再只查缺少的组件/API或token。路径相对skill根目录。

| 页面/需求 | 起点 | 常用组件 |
|---|---|---|
| 搜索列表、设备管理、分页 | `vendor/patterns/search-table/index.vue`；复制接线见 `vendor/patterns/README.md` | ElInput / ElButton / ElTable / ElPagination / ElTag |
| 新建、编辑、表单弹窗 | `vendor/patterns/form-dialog/index.vue`；复制接线同上 | ElDialog / ElForm / ElFormItem / ElInput / ElSelect |
| 详情、左右信息布局 | `vendor/vue-skill/templates/LeftInfoWithRightCard.vue`（结构参考，unverified） | ElDescriptions / ElCard / ElTabs |
| 指标卡片、看板 | `vendor/vue-skill/templates/DashboardCards.vue`（结构参考，unverified） | ElRow / ElCol / ElCard |
| 表格与抽屉详情 | `vendor/code-example/references/table-search-drawer/`（结构参考，unverified） | ElTable / ElDrawer |
| 图表看板 | `vendor/code-example/references/mixed-chart/`（结构参考，unverified） | VChart / ElCard |

## 常用 token

以下键来自随包设计目录，页面期直接使用。更多名称定向搜索 `references/design-language.md`，数值/主题差异查 `references/design-manifest.json`，不要每次读完整JSON。

| 用途 | token |
|---|---|
| 品牌动作 | `--color-brand` |
| 主文字 / 次文字 | `--color-text-primary` / `--color-text-secondary` |
| 页面背景 / 卡片背景 | `--color-bg-1` / `--color-bg-2` |
| 边框 | `--color-border` |
| 成功 / 错误 | `--color-success` / `--color-error` |
| 常用间距 | `--space-size-8` / `--space-size-12` / `--space-size-16` / `--space-size-24` |
| 正文 / 小标题 | `--font-size-normal` / `--font-size-normal1` |
| 常规圆角 / 投影 | `--radius-size-normal` / `--shadow-1` |

## 组件与图标

- 不确定组件：先在 `vendor/vue-skill/references/components_index.md` 搜组件名称，再读 `vendor/vue-skill/components/` 中对应示例；不要顺序加载整个vendor。
- 图标先用EP真实导出，例如Search、Plus、Edit、Delete；`scripts/fetch-icons.mjs`按原检索评分流程选择公司图标，无候选时EP兜底。导出名不确定时查 `scripts/verify/whitelists/element-plus-icons.json`，公司别名见 `references/icon-aliases.json`，不猜公司ID。
- ECharts使用已有vue-echarts接线；只在需求含图表时读对应示例。截图不能替代组件API或确定token目录。
- 主题/国际化：`references/optional-features.md`；环境安装：`references/environment.md`。

## 读取和验证原则

先起点模板与本索引；遇缺口再读相关资料。没有固定文件数上限，也不全量阅读原始设计文档、编码规则和所有错误清单。模板状态查 `vendor/asset-manifest.json`；未验证资产不能作为设计真值。构建、打开页面、一条主要操作通过后立即反馈用户。
