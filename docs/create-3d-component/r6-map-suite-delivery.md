# R6 四组件源码交付

本批交付四个组件：地图整体 MapExperience、逻辑散点 LogicalScatter、栅格热力 GridHeat、建筑染色 BuildingTint。为了共享同一份 HeatField 和渲染适配，放在一个源码套件中；不是只做了两个组件。

当前源码包：`native-work/r6-map-suite-final.zip`。
可阅读源码：`native-work/r6-map-suite-unpacked-final/`。
验证结果：`native-work/r6-map-suite-verify-final/acceptance.json`。
实际使用副本组件库构建产物的演示：`native-work/r6-map-suite-verify-final/runtime/index.3d.html`，打开后需联网加载底图。

```text
src/
  map-experience/      地图整体
  logical-scatter/     逻辑坐标散点
  grid-heat/           经纬度栅格
  building-tint/       建筑表面染色
  heat-field/          共享数据、分档、颜色与空间映射
  index.ts            统一公开入口
components/           四个组件各自的设计、接口及参数说明
adapters/             MapLibre构建适配
```

源码包不带地图Demo、地标资产、调参面板、node_modules或缓存。地图组件接收外部地标资产；资产许可未确认，因此不随组件分发。LogicalScatter使用0–1逻辑坐标，不能当经纬度图层使用。

建筑染色除源码外，还需要MapLibre构建适配。套件README说明了处理方式；普通未适配MapLibre会被明确拒绝。把BuildingTint单个文件复制进去并不够。

## 本批工具怎么用

在仓库根目录运行下面的入口。所有输出路径必须是新路径；不会覆盖已有产物。该profile专用于本次地图重建套件，不改变原native Three入库契约。

```powershell
$cli = 'tools/3d-component-studio/intake/map-suite.mjs'
node $cli prepare <本次原型资料根目录> <新候选目录>
node $cli export <候选目录> <新ZIP路径>
node $cli unpack <ZIP路径> <新解包目录>
node $cli plan <解包目录> <当前3d-components目录> <新计划JSON>
node $cli verify <计划JSON> <新验证目录>
```

verify会复制组件库及依赖到真实独立目录，在副本登记源码、进行类型检查和构建；不写回共享组件库。运行验收使用tests/create-3d-component/map-suite-runtime.mjs、map-suite-scatter.mjs，归档核对使用map-suite-contract.mjs和map-suite-audit.mjs。具体本次命令和状态见Spec第75节。

当前已通过执行方自检，等待独立review。R7才处理正式组件库接纳和交互文档，R8才处理generate-3d-scene同步；没有发布、提交或推送。
