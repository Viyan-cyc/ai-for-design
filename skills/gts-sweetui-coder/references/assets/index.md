# 可选复合资产

工作台需要顶部导航、收展侧栏和工作区导航时选 workbench-shell；复合对话输入选 conversation-composer。可单独使用，不把所有页面套进工作台。
先读对应接口：[工作台](workbench-shell.md)、[输入器](conversation-composer.md)，再执行：

~~~sh
node scripts/copy-foundation.mjs --dir "<工程绝对路径>" --page "<PAGE>" --assets workbench-shell,conversation-composer --check
node scripts/copy-foundation.mjs --dir "<工程绝对路径>" --page "<PAGE>" --assets workbench-shell,conversation-composer
~~~

只传所需 ID。组件复制到 src/pages/<PAGE>/components/foundation/，不自动装配 App 或业务。已修改的目标文件不覆盖；出现冲突先读差异，不删除后强行复制。工程根 .gts-assets.json 是复制记录，不是每页新增的验收流程。
复合导航按钮和输入器 textarea/file input 保留语义化 HTML；普通按钮、搜索输入、模型选择使用 SweetUI。这是复合结构需要，不是业务页面放弃 SweetUI 的理由。
本地检查覆盖编译、名称及复制边界，真实 SweetUI 行为见 [内网交接](../foundation-handoff.md)。装配不明确时只读 assets/examples/workbench-conversation/index.vue 的相关部分。
