# H Design 颜色使用规范

由 H Design《色彩》中的正文、UI 配色图、图表规则和代码语义表提炼。使用本文件即可理解规范，无需读取原始文档或图片。当前变量、引用关系、浅深色值和用途见 [颜色 Token 表](color-tokens.md)；唯一数值源为 [tokens.json](tokens.json)。本文件维护选色方法与约束，数值表由脚本生成。

## 快速选择

| 任务 | 读取分组 | 使用方式 |
| --- | --- | --- |
| 软件按钮、链接、选中或焦点 | semantic-light / semantic-dark | 引用 `--color-brand*` 对应状态 |
| 文本、图标、边框、背景与填充 | semantic-light / semantic-dark | 按信息层级选择 `--color-text-*`、`--color-icon-*` 等 |
| 错误、告警、提醒、成功、信息、失效 | semantic-light / semantic-dark | 选择功能色；弱提示背景使用同语义 `-subtle` |
| 门户官网高亮 | semantic-light / semantic-dark | 引用 `--color-portal-highlight` |
| 多分类图表 | charts-default / charts-accessible / charts-extension-* | 固定序号，保持同一类别跨图一致 |
| 代码语法高亮 | code-light / code-dark | 按语义大类、平台项、明暗主题选色 |
| 品牌辅助表达或新语义映射 | foundation | 使用基础色阶或独立 `--color-corporate-*` |

在库目录执行 `node scripts/query_assets.mjs tokens semantic-light` 或 `node scripts/query_assets.mjs tokens --color-brand` 可只读取所需内容。

## 品牌高亮、基础色板与公司辅助色

软件产品默认高亮使用蓝色 `--color-brand`，用于重要操作、按钮、链接及交互反馈；门户官网使用深灰 `--color-portal-highlight`，适应大量图像和信息内容。公司识别红可引用 `--red-60`，不能把软件产品的蓝色高亮统一替换成识别红。

公司数字色板包含 132 个条目：12 个彩色色相各 10 级，加灰阶 12 项。级别为 05、10、20…90，05 最浅、90 最深；灰阶另外包含白与黑端点。保留原名 `--gray-0White`、`--gray-100Black`，兼容别名为 `--gray-0`、`--gray-100`。基础色板身份不随主题切换，主题变化应发生在语义映射层。

公司辅助色源于公司视觉识别色在数字场景下的适配，分为灰色系和彩色系。灰色系包含黑、深灰、灰、浅灰、白；彩色系包含 rose、orange、yellow、green、cyan；pink、purple、indigo、blue、mint 是色相延展，限制在第三优先级使用。辅助色与数字色板的同名色阶不完全相等，使用独立 `--color-corporate-*`，不要以数字色板近似值覆盖。

## UI 色彩应用

Color Token 按用途命名。业务界面优先引用有语义的 `--color-*`，基础色阶用于建立映射或按图表规则取色。

- **高亮状态**：默认 `--color-brand`，悬浮 `--color-brand-hover`，选中/焦点 `--color-brand-focus`，按下 `--color-brand-active`，禁用 `--color-brand-disabled`。五种状态分别引用，不用一个色值代替全部状态。
- **文本层级**：primary 用于主要文本，secondary 用于次要文本，placeholder 用于占位，disabled 用于禁用，inverse 用于反白。颜色层级补充字号与字重，不能仅通过缩小文字表达次要性。
- **图标层级**：操作图标整体层级与旁边文本一致；tertiary 提供三级图标色。悬浮、选中、按下使用图标的 hover/focus/active 变量。
- **边框与分割线**：默认边框组织控件边界，hover/focus/disabled 表达交互状态；separator 与 separator-subtle 划分不同强度的信息区域。
- **背景层级**：bg-1 用于页面；bg-2 用于侧边导航或侧滑面板；bg-3 用于侧滑面板；bg-4 用于下拉与弹窗；bg-5 用于白色卡片；bg-6 用于带底色卡片；bg-mask 用于遮罩。浅色下多个层级可同为白色，但保留独立语义，便于主题迭代。
- **填充状态**：hover 为通用悬浮，table-header 为表头，table-zebra 为斑马纹，select 为选中；fill 用于步骤条未开始、单选块未选、图片与文件上传默认填充。fill-disabled-subtle 用于含描边按钮、输入框、搜索框与选择器的禁用填充；fill-disabled 用于不含描边的单选块、页签、滚动条和默认标签禁用填充。fill-subtle 用于浅色模式有背景、深色兼容模式无背景的控件。
- **透明度**：百分比是色彩定义的一部分，必须保留 RGBA；不要把透明叠加色直接替换成白色。最终外观取决于下层背景。

## 功能色与关注级别

| 关注度 | 语义 | Token | 规则 |
| --- | --- | --- | --- |
| 高 | 错误 / 告警 / 提醒 | `--color-error` / `--color-alert` / `--color-warning` | 分别对应红、橙、黄；告警与提醒搭配文字说明 |
| 中 | 成功 / 信息 / 失效 | `--color-success` / `--color-info` / `--color-none` | 用于通知、进度和状态反馈 |
| 低 | 上述语义的弱背景 | 对应 `-subtle` 变量 | 用于提示条、标签等底色，文字和图标仍需清楚表达含义 |

功能色同时反映信息紧迫性和关注级别。信息弱背景使用 brand-05，保留它与信息主色 blue-50 的区别。颜色不应成为识别状态或图表类别的唯一线索，应配合文字、图例或形状。

## 图表取色

默认方案优先使用 `--color-chart-1` 至 `--color-chart-6`，按序取色。默认顺序为 blue-50、green-50、indigo-50、cyan-50、orange-40、brand-30。环形图或堆叠柱状图超过六类时，可根据业务用尾部色 `--color-chart-tail` 替换最后一色；不要自动把不同业务类别合并为同一含义。

无障碍方案顺序为 blue-60、green-60、indigo-60、cyan-60、orange-60、brand-40。使用 `data-chart-palette="accessible"` 切换同名序列，或用显式别名 `--color-chart-accessible-1` 至 `--color-chart-accessible-6`。这是图表方案，不是深色主题。

原材料的无障碍说明列出“小于 24px 的文本与图形按 4.5:1、大于 24px 按 3:1”的目标，并分别引用 WCAG 1.4.3 / 1.4.11。该段将不同对象的判断条件合并表述，不能直接作为所有组合的合规结论。实际页面需要根据文本、图形和背景分别核对适用要求；选中此色板不等于已完成对比度验收。

### 延展方案

按 50→40→50→40 交替取色，可依据业务替换色相。现有三套四色方案通过 `data-chart-palette="extension-1"`、`extension-2`、`extension-3` 调用：

1. mint-50 → indigo-40 → cyan-50 → purple-40。
2. indigo-50 → yellow-40 → blue-50 → green-40。
3. purple-50 → green-40 → cyan-50 → orange-40。

每套只定义四类，5/6 号停用，避免混入另一套方案。所有方案的实际值从 Token 表读取。

### 同类色与渐变

同类色在同一色相的 10 至 70 级内选取；下表是类别/图例的使用顺序，不是按数字升序重排。

| 分类数量 | 色阶顺序 |
| --- | --- |
| 1 | 40 |
| 2 | 40 → 20 |
| 3 | 60 → 40 → 20 |
| 4 | 60 → 50 → 40 → 20 |
| 5 | 60 → 50 → 40 → 30 → 20 |
| 6 | 60 → 50 → 40 → 30 → 20 → 10 |
| 7 | 70 → 60 → 50 → 40 → 30 → 20 → 10 |

单色渐变选同色相 30 与 50 级；双色渐变选邻近色的 50 级，示例关系为 blue→purple、purple→red，相邻色在色相环上间隔不超过约 60°。ToB 图表以精确读数为核心，不建议渐变；ToC 可按业务语义表现走势或告警区间趋近，不仅为装饰而使用。

## StarCode 代码颜色

先确定功能大类与子类，再按 Web 的 Highlight.js 类名或 IDE 的设置项定位，最后选择浅色/深色值，并核对用途与选色理由。IDE 名称依据 DevEco 示例，其他产品可能不同。具体 37 项映射与用途示例已整理进 Token 元数据及颜色 Token 表，包含基础容器与默认文本、注释、程序结构、修饰器、类型、函数、属性变量、数据字面量、标签与其他项。

减少不必要的色相。注释采用低强调灰色；高频数据、标点、操作符和普通变量以默认文本色保持连续阅读；需要表达结构或逻辑的关键字、类型、调用、属性、布尔值再做高亮。被高亮的语法类型比例不建议超过 80%，色相数量不建议超过 10 种。

`--color-code-*` 是实现接口名称；代码专用 HEX 独立保存，不强行替换为公司基础色板的近似刻度。例如关键字包含 import，其明暗值均在 code-light / code-dark 对应项中。用 `.h-design-code` 包裹代码区，前端 `tokens/code.css` 将 `.hljs-*` 绑定到变量；此 CSS 仅提供颜色，不自动安装或执行高亮器。

## 主题、组件适配与歧义采用

| 项目 | 采用规则 |
| --- | --- |
| bg-6 的背景标注冲突 | 材料同时出现 gray-20 20% 和白色 HEX；采用完整的色阶加透明度表达，执行值为 RGBA |
| 代码示意配色与语义明细不一致 | 以用于设计开发协作的语义明细表为依据。示意配色曾将默认灰标为 #D1D1D1，浅色函数/类/属性用 #2E86DE，布尔值用薄荷绿；明细采用默认灰 #DFDFDF、相应浅色蓝 #0067D1、布尔值与关键字同色。保留区别说明，不把不同方案混用 |
| 代码专用色与同名色阶不一致 | 保留独立代码色，例如关键字的黄与代码属性值的粉色，避免覆盖基础色板 |
| 公司辅助色与数字色板不同 | 分别维护 `--color-corporate-*` 与基础色阶 |
| 深色 UI | 材料没有完整深色 UI 语义表，semantic-dark 是项目兼容映射；代码语法则有来源明确的明暗对照 |
| 图表无障碍方案同名变量 | 在图表作用域切换同名序列，固定引用需求使用 accessible 别名 |
| 灰阶端点名称不同 | 保留原名，并提供 gray-0 / gray-100 兼容别名 |

通过 `[data-theme="light"]` / `[data-theme="dark"]` 切换语义映射，基础色板身份保持稳定。现有组件用 `--g-*` 转接 `--color-*`；Element Plus 的 primary/success/warning/danger/error/info 对应高亮/成功/提醒/错误/错误/信息。橙色告警单独使用 `--color-alert` 或 `--g-feedback-alert`。主按钮按五种状态使用对应语义，衍生组件状态属于实现适配。

Element Plus 基础样式先加载，再加载生成的 `tokens/index.css`（D23 起 token 层为纯 CSS，无 Sass）。毛玻璃是独立材质，按需读取 [frosted-glass.md](frosted-glass.md)，使用 frost-* 参数；不改变业务功能色。

## 维护

改色值、变量引用、用途或代码映射：编辑 tokens.json。改选色方法与约束：编辑本文件。执行 `node scripts/build_tokens.mjs` 更新颜色表、全部 Token 表与 CSS/SCSS；发布前按包 README 更新来源锁并校验。原始附件不参与调用、构建或验证，不需要重新加入包中。
