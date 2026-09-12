# Vue / Element Plus 实现

设计数值来源是 `../../design/tokens.json`。`tokens/` 为生成产物；`bindings/` 保存 CSS/SCSS 选择器与变量绑定模板，不维护另一份数值。规范和索引在 `../../components/`。

```sh
npm ci
npm run build          # 构建单页预览，输出 preview-dist/
npm run dev            # 启动预览
npm run build:library  # 构建完整组件库，输出 dist/
```

先加载 Element Plus 基础样式，再加载 tokens/index.css 和 src/styles/base.css。库入口也导入生成 Token，避免仅更新源码而组件库 CSS 不生效。

`src/page-config.json` 保存标题、主题、风格、页面状态和演示数据；六套默认数据在 `configs/`，对应 Schema 在 `schemas/`。页面模板源码只读参考，直接按 SKILL.md Step 2 提取布局骨架。

函数式服务保持 Element Plus 调用形式。表格分页支持本地数据切片；当 total 大于传入记录数时由调用方监听 page-change 获取远端数据。

模板内的操作仅演示本地状态和反馈，不表示已经连接真实业务接口。图标保持离线，许可在 licenses/。

毛玻璃统一使用 data-material="frosted" 及 control/card/overlay 档位；规则见 [frosted-glass.md](../../design/frosted-glass.md)。旧 glass.css 与 aurora-glass 入口继续兼容。

交付包只含源码；dist/ 由 build:library 生成，preview-dist/ 由 build 生成。原始 SVG 改为节点数据和别名存储，按需执行 ../../scripts/export_icons.mjs；不再提供 ./icons/* 静态导出。原有中文名、英文名及 SVG 别名保留。图标规范见 ../../design/icon-rules.md。

品牌色重点卡片：添加 data-surface="brand" 和 data-decoration="frosted"，宽幅概览可用 data-decoration-size="panel"。GMetricCard 支持这些根属性；规则见 ../../design/frosted-glass.md。装饰 CSS 随既有 glass.css 导入，不给所有卡片默认启用。
