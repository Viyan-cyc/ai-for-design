# 离线图标

统一使用 GIcon，名称查询 icons；业务优先稳定英文名，可使用既有中文别名。有独立含义时提供 label，装饰图标隐藏于辅助技术；不以图标或颜色单独承载状态。

默认 20px，常用 16/20/24/32px，线宽默认 2；颜色用 currentColor 或语义 Token。品牌 Logo 独立维护。

节点唯一源为 frontend/element-plus/src/icons/icon-nodes.json，别名为 icon-aliases.json。原始名称与别名均可查询；英文关键词在 assets/icons/lucide/tags.json；运行时不请求外网。SVG 按需用 scripts/export_icons.mjs NAME OUTPUT.svg 导出；--all OUTPUT_DIR 导出全部英文名。保留上游版本和 ISC 许可。
