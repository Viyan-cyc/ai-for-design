# vendor —— 生成参考资产

生成页面时的知识库：组件索引、代码规则、错误清单、页面模板。
本目录**只读**：不要往 vendor 写任何东西。

## 目录职责

| 目录 | 内容 | 什么时候读 |
| --- | --- | --- |
| `vue-skill/` | 组件索引（140 组件 + 缺失回退）、编码规则、错误清单、页面模板（5 份） | 写代码前；用到某个组件时 |

## 直线路径（生成页面的标准读法）

1. `vue-skill/references/components_index.md`：确认用哪些组件、import 写法、缺失回退；
2. `vue-skill/references/code-rules.md`：编码规则（样式、Token、通信、性能）；
3. `vue-skill/templates/`：整页骨架直接抄（布局模板见其 README 选型表）；
4. 生成后按 `vue-skill/references/error-checklist.md` 自检。

按需读取，禁止一次读全；每次最多读 2 个文件（索引文件除外）。

## 样式与 Token

- 所有颜色/间距/圆角/字号/投影一律走 Token：`var(--color-brand)`、`var(--space-size-16)`。
- token 词汇速查在 `../references/design-language.md`（生成表，勿改）；数值真值在设计源文档。
- 组件主题已由桥接层映射（bridge.less，双体系 `--el-*`+`--swt-*`），页面不写 `--el-*`/`--swt-*`、
  不写 `:root`、不深度覆盖 SweetUI 样式。

## 升级路径

vendor 覆盖高频组件与常见页面形态。遇到以下情况回到 `../../../../design-language/` 源树（ep-coder 包根下）：

- 需要用到 components_index 未收录的低频组件 → 查 `组件规范/` 对应分类文档；
- 示例/模板与需求形态对不上 → 查组件规范确定该组件的"该长什么样"；
- 需要键盘语义、空态、内容状态等横切规范 → 查 `设计规范/`。

## 源与版本

- SweetUI 5.6.5（`@hw-seq/sweet-ui-base`，内网 registry；白名单见 `../scripts/verify/whitelists/`）；
- 图表：SweetUI 原生 13 个图表组件（ECharts 6.1 封装，`sweet-line-chart` 等），配色不随 CSS
  变量——跟随主题需 readToken 注入 `--color-chart-*`（模式见 components_index 图表节）；
- 示例代码统一 JavaScript（`<script setup>`）；样式统一 `<style scoped lang="less">`，
  禁止静态内联 style。预览运行时已内置 less 引擎（sfc-loader 的 less 非内置，由
  library/less.min.js + moduleCache 提供）；真实工程接入需自备 `npm i -D less`。
