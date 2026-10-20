# vendor —— 生成参考资产

生成页面时的知识库：组件索引、代码规则、错误清单、页面模板、组件示例、整页示例。
本目录**只读**：不要往 vendor 写任何东西。

## 目录职责

| 目录 | 内容 | 什么时候读 |
| --- | --- | --- |
| `vue-skill/` | 组件映射索引、编码规则、错误清单、页面模板、高频组件示例 | 代码规则必读；组件资料按需 |
| `code-example/` | 整页结构参考（搜索表格页、混合图表页） | 页面结构与目标相似时，选起点参考 |

## 查询条件与停止点

编码前完整读取vue-skill/references/code-rules.md；同版本已完整读入当前有效上下文时复用。交付前做一次规范自查，不新增门禁或报告。以下查询停止点只约束API/示例/token查阅，不免除代码规则。

- 需要布局参考才查整页示例或布局索引，选择一个起点；没有匹配项就直接编写，不遍历其余示例。
- 组件用法不确定才搜索 `vue-skill/references/components_index.md`，定位并读取对应示例的相关部分；已知写法不重复查。
- Token名称/值不足时按下方路由查；规则按上述必读约定执行；error-checklist用于需要时的错误示例解释。
- 找到答案即停；只有查询结果仍不足时才扩大到相关分类或原始条款，不重复加载已有上下文。

示例提供结构和已知用法，演示数据及接口占位按需求补全；不代表全部业务状态都已验证。

## 样式与 Token

- 所有颜色/间距/圆角/字号/投影一律走 Token：`var(--color-brand)`、`var(--space-size-16)`。
- 已核实的Token直接复用；常用速查不足时，从skill根执行 `node scripts/query-tokens.mjs "次要文本" "边框"` 批量取真实候选。目录只作长尾定向查阅，不全读；不要求安装额外搜索工具。
- 组件主题已由桥接层映射（bridge.less），页面不写 `--el-*`、不写 `:root`、不深度覆盖 EP 样式。

## 升级路径

vendor 覆盖高频组件与常见页面形态。遇到以下情况回到 `../../../../design-language/` 源树（ep-coder 包根下）：

- 需要用到 components_index 未收录的低频组件 → 查 `组件规范/` 对应分类文档；
- 有明确的组件视觉/状态问题且现有资料未回答 → 只查对应组件条款；模板不匹配本身不触发读取设计源；
- 需要键盘语义、空态、内容状态等横切规范 → 查 `设计规范/`。

## 源与版本

- Element Plus 2.13.5（白名单见 `../scripts/verify/whitelists/`）；
- 图表：ECharts 6 + vue-echarts 8（`import VChart from 'vue-echarts'`）；
- 示例代码统一 JavaScript（`<script setup>`），源草稿为 TypeScript，已全部转写；
- 样式统一 `<style scoped lang="less">`，禁止静态内联 style。预览运行时已内置 less 引擎；
  真实工程接入需自备 `npm i -D less`（详见交付件 `src/README.md` 接入步骤）。
