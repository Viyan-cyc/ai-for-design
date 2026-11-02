# 地理地图与三维模型（P1）

仅真实地理地图需求读取本文件。普通仓库、工厂、机房和示意园区沿用普通三维流程，不安装地图依赖。

## 启用

1. `node scripts/init.mjs <交付目录> --deps copy --defer-build`，使用返回的 WORKSPACE_PATH 编辑。
2. `node scripts/enable-map.mjs <交付目录>`。在工作区运行 `npm install`（内网用已有 npm 源）。Three 固定 0.185.1，MapLibre 5.24.0，Turf 7.2.0。
3. 在 `public/scene3d/scene-data.json` 增加 map。原 scene/camera/lights/controls/renderer 保留，模型仍用现有 asset 或业务分组。

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
- 保留地图版权信息。建筑、道路、水面、地面和绿地作为整体条目出现在“模型”列表，可保存整体颜色与显隐；不支持逐栋变换或 Three PBR 材质。分类按 OpenMapTiles 图层语义适配，其他服务需核实图层命名。

## 编辑与性能边界

地图统一拥有相机、导航和帧调度；Three 模型作为共享画布和深度缓冲的自定义图层。沿用模型拾取、材质、变换、GLB 加载、Vue 卡片及保存导入。底部统一“俯视／鸟瞰、浅色／深色”入口，修改进入编辑器撤销/保存；serialize 同时记录当前地图视角。

地图模式隐藏普通相机/Orbit/背景设置。像素比作用于整个画布；阴影和曝光仅作用于 Three 模型，不改底图投影。标准深度缓冲共用，关闭 logarithmicDepthBuffer。帧率上限限制业务动画请求重绘，地图导航与瓦片更新独立驱动；实时 calls/triangles 仅统计 Three 模型，不宣称是整幅地图成本。

## 构建与二开

继续执行 `node scripts/build-offline.mjs <交付目录>`，成功交付根目录 index.3d.html + preview/ + source/。不新增浏览器审美验收。地图适配位于 source/src/scene3d/map，业务数据和 Vue 卡片仍在 source/src/business。

普通场景不复制此扩展。地图服务配置属于 scene-data 的 map，SDK 不内置内网地址和认证。需要散点聚合、热力和点位详情时，按需读 [map-overlays.md](map-overlays.md)，通过 map.overlays 接到同一场景。

## 整体外观编辑

`map.surfaces` 可保存 building、road、water、ground、greenery 的 `{ color: "#rrggbb", visible: true }` 覆盖。未设置的颜色跟随主题；设置后跨主题保留。隐藏建筑时同时隐藏建筑投影。编辑器通过可选 `SceneHandle.surfaces` 接口操作，不为地图创建伪 Object3D，也不影响用户 GLB 的变换和材质。

普通三维也有相同视角与深浅入口：俯视／鸟瞰保持现有相机投影；深浅切换背景和雾色，保留灯光与模型材质。地图俯视对应 pitch=0，仍是地图相机投影，不称为正交二维。

缩放只在跨越 zoom=15 时重设建筑材质/阴影，其余帧仅更新必要的投影透明度与节流阴影。不为提高帧率擅自减少业务模型或改变地图服务。

底图在模型列表展示建筑、道路、水面、地面、绿地五类；按需声明的业务叠加层另以整体条目显示。无子项不显示箭头，保留对齐空位，点击行进入属性；颜色、显隐和建筑投影在右侧编辑。内部 `类别:部分` 覆盖仅为兼容已保存数据，不暴露为模型子项。修改父项颜色会清除对应旧子项颜色覆盖，确保整类调整有效。

地图整体条目复用普通模型行样式及眼睛/锁操作。map.surfaces 中 locked 保存锁定状态，锁定时禁止颜色、显隐、投影修改，仍允许查看和解锁；撤销与全量恢复可还原锁定状态。

地图地标标签默认使用屏幕像素尺寸（建议宽 140–200px，上限 240px），不要把文字贴图分辨率当成世界米制宽度。Sprite 标签需按投影换算尺寸，兼容地图共享相机；不能直接设数百米宽。默认只放必要标签，详细信息点击后展示。

固定屏幕尺寸的信息标签使用 `createScreenLabel`（从 `@a3d/a3d-components/labels` 导入；初始化使用 `--with-components`，地图启用时自动准备组件包），传 text 或 texture、widthPx、heightPx，再设置 position 并添加至场景节点。默认 180×48 CSS 像素，底部中点为锚点；普通透视、正交及地图共享相机共用。不要在生成 handler 中重复实现尺寸换算。实体标牌仍按世界尺寸建模。


运行边界：`@a3d/a3d-components/map` 提供 MapRuntime（生命周期、坐标、相机同步、重绘）；扩展中的 create-map-scene 保留编辑/保存适配，map-experience 保留地图主题算法。不要在生成 handler 中再建 MapLibre 宿主。普通场景使用标签时初始化加 `--with-components`，仅从 `/labels` 导入，无需启用地图。
