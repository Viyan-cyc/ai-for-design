# vendor —— 生成参考资产

生成页面时的知识库：组件索引、代码规则、错误清单、页面模板、组件示例、整页示例。
本目录**只读**：不要往 vendor 写任何东西。

## 目录职责

| 目录 | 内容 | 什么时候读 |
| --- | --- | --- |
| `vue-skill/` | 组件映射索引、编码规则、错误清单、页面模板、高频组件示例 | 写代码前；用到某个组件时 |
| `code-example/` | 整页结构参考（搜索表格页、混合图表页） | 页面结构与目标相似时，选起点参考 |

## 按需读取

1. 典型页面先从 `code-example/references/README.md` 或 `vue-skill/templates/README.md` 选一个最接近的起点，不要求两类都读。
2. 组件用法不确定时，查 `vue-skill/references/components_index.md` 定位，只读对应的 `components/*.vue`。
3. 样式值查 `../references/design-language.md` 的常用用途速查；其他规则按 `code-rules.md` 的相关章节查询。
4. 生成后只核对 `error-checklist.md` 中与本页面有关的项目，再交 build。

只读当前需要的文件，不设固定文件数上限，不全量加载。示例提供结构和已知用法，演示数据和接口占位需要按需求接入，不代表全部业务状态都已验证。

## 样式与 Token

- 所有颜色/间距/圆角/字号/投影一律走 Token：`var(--color-brand)`、`var(--space-size-16)`。
- Token 先查 `../references/design-language.md` 的常用用途速查；不足时按用途搜索 `../references/token-catalog.md`，只读命中行及必要上下文，名称和值够用即停止，不全读目录或设计源。
- 组件主题已由桥接层映射（bridge.less），页面不写 `--el-*`、不写 `:root`、不深度覆盖 EP 样式。

## 升级路径

vendor 覆盖高频组件与常见页面形态。遇到以下情况回到 `../../../../design-language/` 源树（ep-coder 包根下）：

- 需要用到 components_index 未收录的低频组件 → 查 `组件规范/` 对应分类文档；
- 示例/模板与需求形态对不上 → 查组件规范确定该组件的"该长什么样"；
- 需要键盘语义、空态、内容状态等横切规范 → 查 `设计规范/`。

## 源与版本

- Element Plus 2.13.5（白名单见 `../scripts/verify/whitelists/`）；
- 图表：ECharts 6 + vue-echarts 8（`import VChart from 'vue-echarts'`）；
- 示例代码统一 JavaScript（`<script setup>`），源草稿为 TypeScript，已全部转写；
- 样式统一 `<style scoped lang="less">`，禁止静态内联 style。预览运行时已内置 less 引擎；
  真实工程接入需自备 `npm i -D less`（详见交付件 `src/README.md` 接入步骤）。
