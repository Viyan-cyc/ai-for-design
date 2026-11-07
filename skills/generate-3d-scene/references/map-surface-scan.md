# 地图表面粒子扫描

仅在用户要求地图建筑扫描时启用。先运行 enable-map.mjs，然后在 scene-data.json 的 map 中添加 surfaceScan。普通场景不导入 /map。

```json
{"surfaceScan":{"enabled":false,"center":[0,0],"radius":500,"count":12000,"spacing":10,"buildingLayerIds":["building-3d"]}}
```

buildingLayerIds 必须来自实际样式的可见建筑拉伸图层，禁止照抄示例ID。优先传 buildings: [{id,rings,bottom,top}]，rings是本地米制坐标外环及洞，X东/Z南，原点沿用map.origin；MultiPolygon拆成稳定独立ID。地理中心可经localToMercator逆矩阵转换；center不随视口移动。禁止捏造缺失建筑高度。查询适配读取render_height/height、render_min_height/min_height，缺失或非法跳过并报告；不能恢复截断瓦片轮廓。不要同时提供同一建筑的显式数据与图层查询。

参数：enabled/paused；center；radius、spacing、width（米）；period（秒）；count（1000–80000上限）；facadeDensity（0.5–2）；size（CSS像素，地图DPR只乘一次，发光会扩展包络）；opacity、emission；colors三项#RRGGBB；stops严格递增百分比；heightScale（0–1，须与地图建筑高度动画一致）。默认关闭、预算12000，循环展示、暂停保留时间。颜色为shader直接sRGB值，不是物理光源。

编辑器「画质与性能」内仅对配置了surfaceScan的地图展示控件，沿用Bridge.commit撤销/重做与既有保存系统；不会添加独立保存方式。缺少surfaceScan的旧工程不变。地图状态栏显示实际粒子数量、请求/实际间距和数据警告。

生命周期：先释放scan再释放runtime；参数廉价更新不重建几何，几何参数延迟120ms合并。关闭释放主动动画请求并重绘；暂停保留画面；样式重载重新安装扫描图层。共享GL绘制前后resetState，不清深度。无独立RAF。

限制：仅Mercator平面，无地形/球面/GLB；查询数据可能截断、建筑动画必须显式同步heightScale；用户视觉验收尚需检查遮挡、缩放/倾斜、DPR和动画一致性。性能不能由粒子预算单独推导。公开入口仅 @a3d/a3d-components/map。
