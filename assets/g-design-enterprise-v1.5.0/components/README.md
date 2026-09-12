# 组件与模板规范

`specs/<component-id>.json` 是组件规范的编辑入口：用途、状态、API、源码位置。`templates/<template-id>.json` 是页面规范入口：适用场景、数据配置 Schema、关键交互和源码位置。

`index.json` 与 `templates.json` 自动生成，包含实际依赖、源码包和 Token 引用；不要手工修改。`interactions.json` 维护可观察的操作结果。组件代码在 `../frontend/element-plus/src/`。

查询某个资产使用 `node ../scripts/query_assets.mjs components g-button`。只有选中后才读取对应详细规范、类型和实现。新增或修改源码依赖后运行 `build_indexes.mjs`，再执行验证与来源锁更新。
