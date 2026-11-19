# 四个地图组件的交付与同步

本页说明这次地图组件套件的操作路径。通用 Three 组件继续使用 [通用流程](workflow-guide.md)，不要将本套件交给只支持原生 Three 无资源组件的接纳命令。

|阶段|产物与责任|入口|
|---|---|---|
|创作与调参|LLM 实现；设计师确认地图、散点、栅格及染色效果|create-3d-component，四组件的演示页面|
|整理源码|组件代码与演示地图、面板分开；热力两组件共享 HeatField|map-suite.mjs prepare|
|导出/解包|开发拿到可检查的源码 ZIP|map-suite.mjs export / unpack|
|工程验证|在真实组件库副本检查类型、构建与实际行为|map-suite.mjs plan / verify，再执行套件运行检查|
|正式入库及文档|四组件源码、公开导出、可调 Demo、API 说明进入组件库|map-suite-library.mjs stage；浏览器技术检查；apply|
|同步生成器|把当前库构建成包，同步目录及使用页|generate-3d-scene/scripts/sync-components.mjs|
|场景接入|启用扩展、选择地图宿主、配置业务数据并构建|init.mjs → enable-map.mjs → build-offline.mjs；技术验证与包同步分开|

入库与同步各有独立的审核位置。一条命令可以串联一个阶段的机械工作，但不会替代设计确认或开发审查。此套件尚未接入通用 workflow.mjs 的 prepare-intake，不要将两种回执混用。

## 开发如何同步

以下命令在 PowerShell 执行。每次准备使用一个不存在的新目录。prepare 在真实副本中构建，不修改源库；成功后先查看输出 changes.md 和 proposed，再 apply。

```powershell
$repo = 'D:\cyc\project\octo\skills\test\ai-for-design'
$library = 'D:\cyc\project\octo\test\3d-components'
$generator = "$repo\skills\generate-3d-scene"
$work = 'D:\your-work\map-sync-01'
node "$generator\scripts\sync-components.mjs" --src $library --target $generator --work $work
# 审阅本次 changes.md 与 proposed，确认后：
node "$generator\scripts\sync-components.mjs" --apply "$work\sync-plan.json" --confirmed
```

已有同步归属清单时不加 --adopt-generated。源库或目标变化会让旧计划失效，应重新准备；不要强行覆盖。这里没有发布、提交或推送命令。

## 哪些自动更新，哪些需要开发处理

- 自动：组件依赖包、组件目录、各组件 API 使用页。参数来自当前库文档/源码，不手工编辑包内文件。
- 人工审阅：组件选用、数据坐标含义、宿主与渲染适配、编辑保存接点、领域设计指南。
- 既有工程：不会自动升级。保留已有源码，在副本中迁移及验证后再决定是否更新。
- 地图染色：新模板的构建辅助自动加载包内 Node 适配器，严格匹配 MapLibre 5.24.0。旧工程需要合入该构建辅助，不能只替换依赖包。

## 新生成工程

```powershell
node "$generator\scripts\init.mjs" 'D:\your-work' --name map-scene --profile empty --assets referenced --deps external --with-components
node "$generator\scripts\enable-map.mjs" 'D:\your-work\map-scene'
# 编辑 source/public/scene3d/scene-data.json 的 map 字段；完整示例见生成器 references/restored-map-components.md。
node "$generator\scripts\build-offline.mjs" 'D:\your-work\map-scene'
```

直接打开命令返回的 index.3d.html。进入编辑模式后，右侧地图组件面板可调参；离线保存会复制变更，交回 LLM 核对 before 并写回源 JSON，再运行统一构建。开发服务的 SaveService 才直接写入工程源 JSON。两种保存方式不能混为一谈。

## 当前阶段

R6 与 R7 已通过独立技术审查。R8 包同步、宿主与编辑保存实现及执行方自验已完成，等待合并独立验收。旧 MapScene 工程入口保留。具体证据见Spec第83节。

最终整体结论以 map-components-restoration-spec.md 的最新审查节为准。接口导出、包同步、实际场景运行、保存恢复、用户视觉确认和正式发布分别记录。
