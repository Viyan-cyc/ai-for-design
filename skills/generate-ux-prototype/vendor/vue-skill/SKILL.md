# vue-skill —— 组件用法与代码规范

写页面前按需读取本块资料。本块是"怎么写代码"的唯一出处：组件映射、编码规则、错误清单、
页面模板、高频组件示例。

## 资料

| 文件 | 内容 | 什么时候读 |
| --- | --- | --- |
| `references/components_index.md` | GTS 组件 ↔ Element Plus 映射、import 写法、需自行封装清单 | 确定用哪些组件时 |
| `references/code-rules.md` | 编码规则：Token、样式、组件使用、通信、性能、内存 | 写代码前通读一遍 |
| `references/error-checklist.md` | 常见错误 ❌/✅ 对照 | 生成后自检 |
| `templates/README.md` → 具体模板 | 整页布局骨架（4 份） | 页面结构与模板相近时直接抄 |
| `components/*.vue` | 高频 20 组件 + 图表的标准用法 | 用到某组件不确定写法时 |

## 纪律

- 按需读取：先查索引定位，再读具体文件；禁止一次读全。
- 组件属性不臆测：以 components_index 与 EP 官方文档为准，不从示例推断未列出的属性。
- Token 是唯一样式取值：所有颜色/间距/圆角/字号/投影走 `var(--token)`，
  不用 EP 默认主题色，不写 hex。
- 示例是代码不是文档：`components/` 与 `templates/` 下的 .vue 保持干净可运行，
  不在其中写规范引用或设计说明。
