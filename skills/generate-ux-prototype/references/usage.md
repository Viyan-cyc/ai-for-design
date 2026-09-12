# V1.5 调用示例

`ASSETS_ROOT` 可以指向 V1.5 包根目录、包内 assets 或 g-design-enterprise-v1.5.0。

先读取库内 `components/templates.json` 的摘要，或执行：

```sh
python3 LIBRARY/scripts/query_assets.py templates --search 列表
python3 LIBRARY/scripts/query_assets.py components g-button
python3 LIBRARY/scripts/query_assets.py tokens typography
```

使用包内 `examples/standard-list-plan.json` 为起点，保留精确版本并按实际选择填写 directionId、模板和交互。

```sh
python3 -B SKILL/scripts/resolve_source_assets.py PLAN PACKAGE OUTPUT
python3 -B SKILL/scripts/validate_source_draft.py OUTPUT PACKAGE
```

运行目录不是 OUTPUT 本身，而是 `asset-selection.json` 中的 `projectRoot`：当前为 `OUTPUT/frontend/element-plus`。在该目录运行 `npm ci`、`npm run build`、`npm run dev`。

生成后唯一业务编辑入口为配置 JSON。视觉风格、主题和页面状态也是配置字段。索引、Token 源和历史文档不需要全部复制进模型上下文。

毛玻璃概览示例：包根 examples/frosted-device-plan.json。使用 visualStyle=frosted-glass；只选局部材质，具体约束见库内 design/frosted-glass.md。

## 按改动范围验证

首次生成、交付或资产维护使用完整验证（默认）。仅修改已有原型的业务配置时可运行 validate_source_draft.py OUTPUT PACKAGE --scope selected，检查当前模板、组件、Token、配置和交接引用；它不证明整个库完整。选择范围验证允许其他未用资产修订导致的 release 哈希变化，最终交付仍运行完整检查。

跨阶段计划可加 handoff.path（相对 PLAN）和 handoff.sha256；输入更改、项目或方向不匹配会在写出原型前被拒绝。交接快照不改变上游确认状态。

## 模板扩展

当六套模板不适合参考结构时，将资产库复制到当前项目的 project-assets/，排除 node_modules、dist 和 preview-dist。在副本中改模板或新增 src/page-templates/NAME，并注册 components/templates/ID.json、configs 和 schemas，沿用公开组件及关键状态；依赖由 build_indexes.py 计算。

按副本 README 生成、验证、更新来源锁，计划 ASSETS_ROOT 指向该副本；用 component-plan.json 显式选择扩展 ID 并重新生成。交付注明基于原始版本的项目扩展与差异；需公共复用时再按 manage-design-assets 提案同步。

工程交接使用 freeze_design_handoff.py OUTPUT PACKAGE --direction-id ID --browser-report REPORT --confirmation-reference REF。REPORT 为 JSON，至少含 status=passed、prototypeRoot=OUTPUT绝对路径、configSha256=当前配置哈希、criticalInteractions=已验证交互 ID 数组。REF 引用用户已确认本次 UI 的会话消息或记录；脚本只记录证据，不能代替人的确认。
