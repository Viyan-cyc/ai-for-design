# SweetUI 原生设计消费指南

只使用uDesign2.2-light/dark及当前包真实的 `--swt-*`。组件状态由原生样式承担，不从EP迁移色值或token名。

## 常用用途速查

| 用途 | 准确名称 |
| --- | --- |
| 页面背景 / 容器 | `--swt-color-bg-secondary` / `--swt-color-bg-primary` |
| 主文字 / 次文字 / 辅助 | `--swt-color-text-primary` / `--swt-color-text-secondary` / `--swt-color-text-extra` |
| 品牌 / 强调 | `--swt-color-brand-normal` / `--swt-color-accent-normal` |
| 边框 / 分割线 | `--swt-color-border` / `--swt-color-dividing-line-primary` |
| 成功 / 错误 / 提醒 | `--swt-color-function-success-normal` / `--swt-color-function-urgent-normal` / `--swt-color-function-warning-normal` |
| 常用间距 | `--swt-space-size-8` / `--swt-space-size-16` / `--swt-space-size-24` |
| 正文 / 小标题 | `--swt-font-size-normal` / `--swt-font-size-normal1` |
| 常规圆角 / 投影 | `--swt-radius-size-normal` / `--swt-shadow1` |

已知名称直接使用；缺项执行 `node scripts/query-tokens.mjs "次文字" "图表" "--swt-color-chart-A1" --limit 5`。只取真实候选，未命中不造名；值保留原生表达式，不能把别名值var(...)当最终Canvas颜色。完整目录仅作定向参考。 多个参数分别查询，同一参数内空格表示同时满足；常用词仅扩展候选检索，未命中给分类提示，不自动纠正准确名称。

## 主题与组件

品牌红 `--swt-color-brand-normal`，强调蓝 `--swt-color-accent-normal`；具体浅深值查目录，不把所有primary按钮手动改成品牌红或强调蓝。原生组件按自己的主题呈现。

`prepare-runtime`从实际目标包CSS刷新名称、目录值和必要的中文dark selector短名兼容。不复制JSON重建皮肤；主题切换调用native-adapter，不由页面修改CSS selector。原生CSS优先于采集快照；升级包后重新准备。

## 图表和布局

页面样式用scoped CSS、流式布局，局部变量--page-*；组件内部状态不重绘。Canvas/Three需要具体颜色，使用chart-tokens.js从当前主题读取，不能把CSS var字符串直接传给引擎。DtChart原生命名chart theme没有uDesign2.2时不冒用hDesign；使用显式原生颜色option并在主题变化后重算。真实首绘及切换在内网维护验收中验证，不能仅凭编译宣布视觉正确。
