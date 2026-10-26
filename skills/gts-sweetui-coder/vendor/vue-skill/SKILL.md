# vue-skill —— SweetUI组件用法与页面规则

已知用法直接写；有具体疑问才查本块。资料路径相对当前目录。

| 文件 | 何时读取 |
| --- | --- |
| references/components_index.md | 组件选型或导入不确定时搜索定位 |
| components/{组件}.vue | 核对当前属性、事件或插槽写法 |
| components/{组件}.md | 示例没有回答具体API问题时 |
| templates/README.md | 需要布局参考时选一个，不全读模板 |
| references/code-rules.md | 只查询当前规则章节 |
| references/error-checklist.md | 只核对涉及的错误类型 |

每文件显式import，PascalCase组件，原生swt token和common字体图标。当前上下文已有的内容不重复读；模板只提供布局，接口和业务数据按需求补全。构建通过不等于私有UMD已运行验证。
