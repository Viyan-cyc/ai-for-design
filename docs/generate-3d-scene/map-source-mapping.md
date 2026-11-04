# 地图实现来源映射

源：D:\cyc\project\octo\gts\map\map-experience-v297\assets\上海地图-v2.97-基线-v2.1\上海地图-v2.97-参数锁定-v2.1.dc.html

SHA256：b7058768ae9dcac008b942059caf885a23657c759a1f93181777f8e0e3a050b7

P0：撤除旧明亮沙盘预设/建筑 handler/样例源码；保留已有用户产物、目录整理与其他功能。

P1：map-experience.js 直接提取以下原方法，保留主题色、缩放、生长、圆角缓冲与阴影算法：

targetPitch, adjust, mix, vecSource, materialBuildingColor, buildingDepthPalette, buildingDepthColorExpression, rawBuildingDepthColorExpression, buildingTurnShadowColor, applySky, buildingGrowthExpression, ordinaryBuildingGrowthScale, roadTransitionColor, baseMapLabelAnchor, enforce3DLayerOrder, addBuildings, refreshRoundedBuildings, isWorldGroundTextureLayer, limitWorldGroundTexture, rememberBaseFillPaint, restoreBaseFillPaint, rememberBaseLineColor, setSemanticFill, applyColors, applyBuildingMaterial, applyLight, scheduleBuildingShadows, scheduleTransitionShadows, shadowSourceBuildings, refreshBuildingShadows, scheduleShadowRaster, shadowRasterOpacity, renderShadowRaster, applyShadow, applyDistricts, applyLabelColors, scaleSize, applyLabelSize, applyRoadLabelDensity, themeValues, applyThemeMode, applyChinese, limitWorldLabelsAtZ4, tuneLabels, hideRoadArrows, soft, applyViewModeStyles, switchViewMode

适配：移除 React/DCLogic、localStorage、固定城市导航与地标模型；关闭特定地标排除条件，阴影 canvas ID 改为实例唯一；生命周期归宿主管理。Three 自定义图层桥接另行实现，固定版本 0.185.1。散点和热力未在 P1 实施。

固定地标专用 growth/pearl 参数和 Halic 补充建筑层已撤除；原主题的通用参数保持不变。MapLibre 专用实现放可选扩展，不放普通 Three 组件入口。

## P2 来源（2026-10-31）

- 散点：map-scatter 的 SKILL.md/references/implementation.md 是设计与行为规范，没有完整可提取运行组件。MapScatterLayer 是依照规范新实现；直接复用 assets/cluster-pin.svg 的精确路径与24:29比例、语义色及默认尺寸/文字参数。SVG SHA256：4e5fc3a92b74707f81c47b8b91814132813bf0d1400bc22c91836b03b45d7846。
- 热力：map-traffic-heatmap-v1.26.0/assets/maplibre-strong-halo-profile.js，SHA256：1ecd62955d196bd35288f0783899468df158e5480018fc62e5fb22091888de22。PROFILE 至 buildLayer 的函数代码直接提取到组件库 src/map/heat-profile.js，改为 ESM 导出，保留算法和参数。没有复制原全局挂载、安装器、演示数据回退与按数据 min/max 自动归一化。
- 新适配：MapHeatLayer 提供固定业务 valueRange、显隐/数据更新、resize/style.load 与资源清理；MapOverlays 留在模板，负责数据文档、编辑列表和外部 Vue 卡片。原生显示近似的边界见 map-p2-validation.md，不声称物理场复现。


P2修正：来源heat-profile.js保持不变，MapHeatLayer在外围提供transparent/reference策略；只有原参考默认仍要求26停靠点。散点从单格分箱改为邻近连通与导航结束后的投影碰撞合并，属于本组件新增实现，不称为原skill已提供的算法。维护热力样例改用原499条固定点及transformDemoRecords一次映射，生产不自动回填。


## 2026-11-02 覆盖与取舍

- 已迁入：地图主题/普通建筑/投影/视角与缩放规则；散点图钉、稳定ID、聚合、固定尺寸和样式；原生热力profile和更新清理。具体来源见上文，不等于所有原规范已实现。
- 适配替代：原页面布局与React/DCLogic由现有编辑器替代；独立localStorage改为场景配置；生产空数据不填模拟数据；普通业务热力默认透明、保留reference模式。
- 未迁入且本期不阻塞：管辖范围裁切/外围样式、固定城市导航/特定地标资产、无地图散点宿主、系统主题自动跟随、专属键盘访问、聚合平滑拆合、独立PNG导出与精确逐级羽化自定义渲染。
- 待验收：真实内网地图资源、file协议地图服务兼容、完整城市负载性能。P3优先生成与交付可靠性，不为全量复制增加功能。

## 主题组件归属（2026-11-04）

现行实现位于 `D:/cyc/project/octo/test/3d-components/src/map/map-experience.js`，作为 `MapPresentation` 内部引擎；skill 不再保留该实现副本。主题默认值与建筑生长算法保持原值，组件包装层负责覆盖优先级、资源归属、样式重载与释放。编辑和保存转换仍在 skill 的 create-map-scene.ts。普通 Three 入口不导入地图模块。
