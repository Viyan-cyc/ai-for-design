# 地理地图与三维模型

新地图组件包的选用、配置示例及编辑保存见[地图组件选用](restored-map-components.md)。enable-map 统一使用 MapExperience 完整地图。

仅真实地理地图需求读取本文件。普通仓库、工厂、机房和示意园区沿用普通三维流程，不安装地图依赖。

## 启用

1. `node scripts/init.mjs "<artifact-folder>" --name <场景名称> --profile empty --assets referenced --deps skip --defer-build`，使用返回的 WORKSPACE_PATH 编辑。
2. `node scripts/enable-map.mjs <WORKSPACE_PATH>`。后续统一构建自动在工程外安装依赖并同步 lockfile（内网用已有 npm 源）。Three 固定 0.185.1，MapLibre 5.24.0，Turf 7.2.0。
3. 在 `public/data/scene.json` 增加 map。原 scene/camera/lights/controls/renderer 保留，模型仍用现有 asset 或业务分组。

```json
"map": {
  "styleUrl": "实际可访问的 MapLibre 样式 JSON 地址",
  "origin": [121.4905, 31.2356],
  "center": [121.4905, 31.2356],
  "zoom": 16,
  "pitch": 45,
  "bearing": 0,
  "theme": "light",
  "view": "3d"
}
```

经纬度为 WGS84。origin 是模型的地理原点；模型局部坐标为米，右手系，X 东、Y 上、Z 南；资产自身约定正面仍为 +Z。不要把经纬度直接填入模型 position。当前支持局部平面 Mercator，不支持球面或地形高程贴合；更换原点/底图服务需要重建场景。

## 地图来源与样式

- 直接复用 map-experience-v297 的主题、建筑缩放生长、圆角、颜色分层、投影和标签规则；移除固定城市跳转、地标模型和原业务页面。
- 当前建筑适配为 OpenMapTiles 兼容矢量数据（building 图层，height/render_height 字段）。其他服务需适配数据字段，不要默认所有地图协议都兼容。
- 内网已能访问地图；配置实际 styleUrl，并确保其瓦片、字体、sprite 来源可访问和允许宿主跨域请求。外网示例使用 OpenFreeMap，不代表内网服务已验收。
- 代码和用户模型随交付携带。地图瓦片/字体/sprite 仍访问地图服务；此时 index.3d.html 是本地预览入口，不是断网地图包。默认不下载城市瓦片，也不承诺断网可用。
- 保留地图版权信息。地图整体参数通过 experience.parameters 保存；地图建筑不作为可逐栋变换的 Three 模型。

## 编辑与性能边界

地图统一拥有相机、导航和帧调度；Three 模型作为共享画布和深度缓冲的自定义图层。沿用模型拾取、材质、变换、GLB 加载、Vue 卡片及保存导入。底部统一“俯视／鸟瞰、浅色／深色”入口，修改进入编辑器撤销/保存；serialize 同时记录当前地图视角。

地图模式隐藏普通相机/Orbit/背景设置。像素比作用于整个画布；阴影和曝光仅作用于 Three 模型，不改底图投影。标准深度缓冲共用，关闭 logarithmicDepthBuffer。帧率上限限制业务动画请求重绘，地图导航与瓦片更新独立驱动；实时 calls/triangles 仅统计 Three 模型，不宣称是整幅地图成本。

## 构建与二开

继续执行 `node scripts/build-offline.mjs <WORKSPACE_PATH>`，成功交付根目录 index.3d.html、同层 JS/CSS 与 source/。不新增浏览器审美验收。地图适配位于 source/src/3d/map，业务数据和 Vue 卡片仍在 source/src/business。


## 整体外观
外观沿用组件主题默认，仅在用户明确要求时设置 experience.parameters。普通地图只保留必要交互，不自动添加参数面板。

地图地标标签默认使用屏幕像素尺寸（建议宽 140–200px，上限 240px），不要把文字贴图分辨率当成世界米制宽度。Sprite 标签需按投影换算尺寸，兼容地图共享相机；不能直接设数百米宽。默认只放必要标签，详细信息点击后展示。

固定屏幕尺寸的信息标签使用 `createScreenLabel`（从 `@a3d/a3d-components/labels` 导入；初始化使用 `--with-components`，地图启用时自动准备组件包），传 text 或 texture、widthPx、heightPx，再设置 position 并添加至场景节点。默认 180×48 CSS 像素，底部中点为锚点；普通透视、正交及地图共享相机共用。不要在生成 handler 中重复实现尺寸换算。实体标牌仍按世界尺寸建模。


运行边界：`@a3d/a3d-components/map` 提供统一的 MapExperience（地图创建、生命周期、坐标、相机同步、主题与整体外观）；扩展中的 create-map-scene 负责编辑/保存适配。不要在生成 handler 中再建 MapLibre 宿主。普通场景使用标签时初始化加 `--with-components`，仅从 `/labels` 导入，无需启用地图。


## 地点与资源选择

城市名称用于确定地理范围，不意味着凭空生成真实建筑。使用用户已配置的地图服务与可靠的中心坐标；行政区范围不明确但不影响示意浏览时说明采用的中心与视距。建筑轮廓/高度取决于地图数据覆盖，不将估算高度或程序模型宣称为真实还原。GCJ-02/BD-09业务坐标需在业务adapter显式转换为宿主采用的WGS84，不能直接混用。


### 重复启用与源码保护

enable-map 在写入前预检全部扩展文件及组件包：相同内容复用，缺失文件待创建，同名不同内容或链接目标拒绝并报告路径。存在冲突时不会修改源码、注册入口、package.json 或 vendor，不输出 MAP_ENABLED。升级模板与用户二开都可能产生冲突，应保留修改后手动迁移，不提供强制覆盖。该预检不承诺磁盘故障或并发写入时的完整事务回滚。

写入前还检查注册入口 create-scene.ts、package.json、扩展及组件包目标的父路径，拒绝符号链接和目录 junction，包含工作区及其祖先路径。文件链接测试若因系统权限无法创建，必须标记未执行，不视为通过。

### 表面扫光

常用组合在同一个 `map` 中配置：用 `heat` 提供栅格数据，添加 `heat.tint: {}` 让建筑共享热场，设置 `geographicScatter.heatLinked: true` 关联红区告警，再开启 `surfaceScan`。连续模拟数据和告警由构建时的 `scripts/heat-simulation.mjs` 配置生成，具体输入见 [地图组件组合](restored-map-components.md)。场景描述只写场景内容，模拟数据说明由构建脚本自动追加。已确认且内容未变的模型复用资产检查结果。
需要扫光时配置 `map.surfaceScan: { enabled: true }`，接入细节见 [map-scan-integration.md](map-scan-integration.md)。

新生成地图场景默认在设计师主题与用户外观覆盖完成、地图实际帧和瓦片准备好后首次显示，加载期间显示准备提示。该流程由create-map-scene.ts统一负责，不在业务代码另加定时遮罩；普通换色不重新隐藏地图。资源30秒仍未齐全时显示当前主题地图并提示加载不完整。


经纬度故障点使用 `map.geographicScatter`；`map.logicalScatter` 是独立逻辑画布，不能代替地图点位。字段及聚合差异见 [地图组件选用说明](restored-map-components.md)。项目提供的真实地标模型和已确认热力参数应原样沿用，不用技术测试Box或径向数据替换。


### 默认视角与场景构图
地图设计默认目标俯仰45°、旋转0°，未要求其他角度时沿用。中心与缩放按地点和覆盖范围确定，不能据此另改俯仰或旋转。MapExperience未显式传mode时按zoom>=16.35选择3D，否则2D；生成三维地图的宿主可显式传3D。用户已保存或明确指定的视角优先，恢复时不覆盖为默认值。
