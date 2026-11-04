# MapPresentation

`import { MapPresentation } from '@a3d/a3d-components/map'`

在已加载样式的 MapLibre map 上管理主题和建筑、道路、水面、地面、绿地外观。依赖 maplibre-gl 与 @turf/turf，仅地图工程使用。

```ts
const presentation = new MapPresentation(map, {theme: 'light'});
presentation.updateSurface('water', {color: '#b6d9ec'});
const snapshot = presentation.getState();
presentation.setTheme('dark');
presentation.applyState(snapshot);
presentation.dispose();
```

- 构造参数：theme（light/dark）、overrides（分类 color/visible 映射）、view（2d/3d）、pitch（0–80）、可选 layerMapping。
- 默认适配 OpenMapTiles；layerMapping 明确映射其他图层，按 category、layerIds、sourceLayers、types 匹配，仅应用颜色与显隐。
- getState 返回独立 JSON；applyState 完整替换，overrides:{} 恢复当前主题；updateSurface 局部补丁即时重绘，不改变镜头。
- listSurfaces 返回父类别及带 parentId 的子项。编辑器展示父类别，building:shadow 用作投影开关。
- 保留已有子项覆盖语义；父类别修改清除对应子项字段，投影显隐独立。
- dispose 退订、释放自有资源并恢复底图属性；先释放表现再释放地图。样式重载重建基线后恢复当前状态。
- 每个 map 使用一个表现实例；默认算法保留 sh-shadow / sh-building / sh-rounded 前缀。
- locked、撤销、编辑保存由宿主适配；生成工程使用现有 create-map-scene，无需再创建实例。
