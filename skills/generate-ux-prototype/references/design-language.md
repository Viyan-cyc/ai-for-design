# design-language 消费指南（skill 内参考）

> 真值源是 `design-language/样式Token/设计系统.md`（token 表）与 `design-language/设计规范/组件库适配.md`（接入规则）。
> 本文件是面向生成 agent 的**消费视图**：浓缩 token 速查、EP 桥接映射和页面协议；数值以真值源为准，冲突时真值源胜出。

## 1. token 体系总览

<!-- GEN:TOKEN-TABLE START (由 scripts/gen-tokens.mjs 生成，勿手改) -->

token 全量定义在皮肤文件 `src/assets/themes/default.css`（324 个自定义属性，由 `scripts/gen-tokens.mjs` 从设计文档生成），命名即 design-language 规范名，无前缀：

| 类别 | token 形态 | 示例 |
| --- | --- | --- |
| 品牌色 | `--color-brand(-hover/-active/...)` | `--color-brand: #0067d1` |
| 文本色 | `--color-text-*` | `--color-text-primary: #191919` |
| 图标色 | `--color-icon-*` | `--color-icon-secondary: #777777` |
| 边框色 | `--color-border(-hover/-focus/...)` | `--color-border: #c9c9c9`（gray-20） |
| 背景色 | `--color-bg-1..5`、`--color-bg-mask` | `--color-bg-1: #f3f3f3`（页面背景） |
| 填充色 | `--color-hover/-select/-fill*` | `--color-select: #e6f2fd`（brand-05） |
| 功能色 | `--color-error/-alert/-warning/-success/-info/-none(+*-subtle)` | `--color-success: #09aa71` |
| 基础色板 | `--{rose|red|orange|yellow|green|mint|cyan|blue|indigo|purple|pink|brand|gray}-{05..90}` | `--brand-50` |
| 图表色 | `--color-chart-1..6(+accessible)` | `--color-chart-1: #2070f3` |
| 间距 | `--space-size-4..80`（紧凑档 `data-density="compact"` 覆盖） | `--space-size-16: 16px` |
| 圆角 | `--radius-size-{small|normal|medium|big|big1|big2|full}` | `--radius-size-normal: 4px` |
| 边框宽/线型 | `--border-width-{none|normal|medium|independent}`、`--border-style-*` | `--border-width-medium: 2px` |
| 字体 | `--font-family(-zh/-en/-numeric)` | 'HarmonyOS Sans', 'Microsoft YaHei', 'PingFang SC', Arial, sans-serif |
| 字号/行高 | `--font-size-*` + `--font-line-height-*` 成对 | `--font-size-normal: 14px` + `22px` |
| 字重 | `--font-weight-{light|normal|bold}` = 300/400/600 | 标题 600 |
| 投影 | `--shadow-1..6`（含方向变体） | `--shadow-1: 0 1px 3px 0 rgba(0, 0, 0, 0.1)` |
| 毛玻璃 | `--frost-*` | 材质扩展场景成套取用 |

<!-- GEN:TOKEN-TABLE END -->

关键守则（真值源 §0）：

1. 先确定部位、用途与状态，再取 token；填充/文字/图标/边框分别选色，不近似互换。
2. 未定义或待确认的值**不可使用**（如 `color-bg-6` 未定义，引用即构建失败）。
3. 状态不可推导：不自行推算缺失的交互态色值。
4. 默认浅色界面；无完整深色 UI 表，不做整页深色。

## 2. Element Plus 桥接（bridge.css，FIXED 不改）

皮肤 token 经 `bridge.css` 映射到 `--el-*`，组件自动跟随皮肤。关键对位（生成页面时不用写任何 `--el-*`）：

| EP 变量组 | 皮肤 token | 说明 |
| --- | --- | --- |
| `--el-color-primary(+light/dark-N)` | `--color-brand*` | light-N 由 color-mix 对 `--ux-mix-base` 派生 |
| `--el-color-success/warning/danger/error/info(+N)` | `--color-success/warning/error/info(+*-subtle)` | danger ← `color-error`（red-50） |
| `--el-text-color-*` | `--color-text-*` | 五级文本直接对位 |
| `--el-bg-color(-page/-overlay)` | `--color-bg-4/1` | 弹层用 `color-bg-4` |
| `--el-border-color-*` | `--color-border*` | focus → `color-border-focus` |
| `--el-fill-color-*` | `--color-hover/-fill*` | 禁用不做透明化 |
| `--el-mask-color` | `--color-bg-mask` | gray-90/30% |
| `--el-box-shadow*` | `--shadow-6/3/1` | 浮层 L2→shadow-3、对话框 L3→shadow-6 |
| `--el-border-radius-*` | `--radius-size-*` | base=4px, round=999px |
| `--el-font-family` | `--font-family` | |

## 3. 页面协议（生成 .vue 时遵守）

### 3.1 结构与作用域

- 页面主组件 = `src/pages/{Page}/{Page}.vue` 或 `index.vue`，根类名 `page-root`。
- 样式一律 `<style scoped>`；不得出现 `:root`、`html`、`body`、`[data-theme]` 选择器。
- 自定义属性定义必须 `--page-*` 前缀（页面局部派生值）；引用皮肤/EP token 不受限。
- **禁止写死色值**：所有颜色经 `var(--token)` 引用（EP 组件自身的 `--el-*` 引用亦合法）。
- `var(--x)` 无 fallback 引用必须已定义；带 fallback 引用未定义 token 仅 WARN（`--el-*`/`--ux-mix-base` 免检）。
- 页面内 hex 只允许出现在 `--page-*` 定义中（WARN 级）；正常应完全无 hex。

### 3.2 组件使用

- 只用真实 Element Plus 组件（118 个，白名单校验）；不要用外观近似的原生元素替代组件。
- 2.13.5 实际导出的组件/属性/图标见 `scripts/verify/whitelists/*.json`（组件 118 / 导出 534 / 图标 293）。
- 组件状态（默认/悬停/按下/聚焦/禁用/加载）由 EP 类名 + 桥接 token 自动获得，页面不重绘状态色。
- 图标从 `@element-plus/icons-vue` 按需导入。

### 3.3 布局与自适应

- 参考画布 1440px，基础单位 4px；Console 类页面 24 列流式栅格（Gutter `space-size-16`、Offset `space-size-20`）。
- 展开侧栏 240px（200–320）、收起 48px（48–64）；Portal 内容 1280px 上限。
- 密度是显式配置：常规/紧凑通过 `data-density="compact"` 切换，断点不自动切密度。
- **断点分工**（两套数值服务不同目的，不混用）：
  - **EP 组件断点**（页面代码用）：`xs <768 / sm ≥768 / md ≥992 / lg ≥1200 / xl ≥1920`，
    用于 `ElRow`/`ElCol` 响应式 props 与 `@media` 折叠；
  - **验收检查值**（人工验收用，页面代码不出现）：1024（窄桌面）/ 1280 / 1680 / 1920。
- **窗口适配五档**（验收口径）：

  | 视口 | 重点 |
  |---|---|
  | <1024 | 核心任务可用；折叠导航、单列表单、表格局部横向滚动 |
  | 1024–1279 | 侧栏与宽工具栏检查；空间不足收侧栏、收纳低频操作 |
  | 1280–1679 | 1440 参考布局与长文案检查 |
  | 1680–1920 | 宽屏列跨度、侧栏稳定、阅读距离 |
  | >1920 | 数据页面流式增长；Portal 保持 1280 上限；不放大字号图标 |

- **适配红线**：密度不随视口切换；禁止视口单位（vw 等）缩放字体；禁止整页横向滚动
  （表格局部滚动除外）；窄屏优先保留标题、核心数据、主操作、筛选入口。
- 1440 参考画布不是浏览器最小宽度，不要以固定最小宽度导致整页被裁切。
- 编码细则见 `vendor/vue-skill/references/code-rules.md` 第十二节。
- 出处：真值源 `design-language/设计规范/响应式与无障碍.md`、`页面布局.md`；数值冲突以真值源为准。

### 3.4 状态与语义

- 重要含义同时用文字或图标表达，不只靠颜色。
- 禁用状态由 token 控制（文本 gray-20、填充 gray-10 或 gray-90/5%），不做整体透明化。
- 获焦边框 2px（`--border-width-medium`）+ `--color-border-focus`。
- 键盘可达；选中与聚焦是不同行为，不混用。

## 4. 换肤协议（皮肤作者视图）

- 一皮肤一文件 `src/assets/themes/{name}.css`；作用域 `html[data-theme="{name}"]`（非 `:root`）。
- 在 `index.gts.html` 换肤插槽追加 `<link>`；运行时切换：`document.documentElement.setAttribute("data-theme", name)`。
- token 真值 = design-language；皮肤必须完整提供页面与桥接层消费的全部 token。
- 深色皮肤必须覆盖 `--ux-mix-base` 为深色表面色（否则 light-N 色阶发白）。

## 5. 图表与代码区

- 图表默认 `--color-chart-1..6` 顺序使用；无障碍场景换用 `-accessible` 变体；不逐色拼接两组。
- 代码高亮按 `--code-*`（浅色为主）；深色代码区变体 `--code-*-dark` 只影响代码容器，不是整页深色。
