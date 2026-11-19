export const engineering={
 'map-experience':`# 地图整体接入

从套件src/index.ts导入MapExperience。创建时传入空的container、MapLibre样式style和经纬度center；可传zoom、pitch、bearing、mode、theme及parameters。preset.json是参数配置，须作为parameters传入，不是整个构造参数。

通过setParameters更新外观、setTheme切主题、setMode切2d/3d、setPitch调整俯仰。getView/restoreView读取和恢复相机；flyTo定位；resize适应容器；dispose销毁自己创建的地图、模型和事件。宿主可通过map访问MapLibre实例。

地图拥有自己的渲染资源。地标资产通过assets显式注入：ORIENTAL_PEARL_GLB_V3_BASE64和HALIC_ORDINARY_BUILDINGS_V1。本包不提供这些资产，许可尚未确认；不传时不能期待出现完整地标。底图样式、瓦片、字形与图标由使用方提供。

组件使用公开TypeScript接口和来源JavaScript引擎；后者没有全面checkJs。工程版本包含地标heatmodelrender/heatmodelremove事件及相机中断修复；默认不启用染色。要用BuildingTint须按套件README完成MapLibre构建适配。
`,
 'logical-scatter':`# 散点接入

从套件src/index.ts导入LogicalScatter，调用new LogicalScatter(host, options, data)。host为有实际尺寸的HTMLElement；data使用逻辑坐标，不能直接传经纬度当作地理散点。具体字段见src/logical-scatter/model.ts的ScatterPoint和src/logical-scatter/parameters.ts的ScatterOptions。

setData更新数据，setOptions更新样式，setZoom控制0–1逻辑缩放，getOptions/getState读取状态。空数组显示空画布，不补演示数据。dispose取消动画、监听和观察器并移除自己创建的canvas，可重复调用。隐藏可由宿主控制容器可见性；没有伪造独立setVisible接口。

不依赖Three或地图；需要Canvas、ResizeObserver、Path2D及matchMedia。使用公开接口调参，不用销毁整个实例实现更新。preset.json为空配置，按源码默认值运行；不表示没有默认值。
`,
 'grid-heat':`# 栅格热力接入

从套件入口导入HeatField和GridHeat。创建一个HeatField，调用new GridHeat(map, field)。field.setData或grid.setData接收{lng,lat,value}数组，value为0–255整数；重复单元记录会报错。共享空间原点和中心间距由HeatField配置定义。

setOptions更新热力场；同一field的建筑染色会同步更新。setVisible只控制地面格子，不改变建筑染色。dispose只移除自己拥有的地图图层/数据源及监听，不销毁借用map或field；最后一个使用者结束后由创建者field.dispose。

preset.json的field作为HeatField参数，tint属于BuildingTint，不能整体传给HeatField。五档阈值、配色、格宽、不透明度和颜色平滑取自源码默认值及该preset。格宽变小留下的间隙仍是数据有效单元。空数组、无数据孔洞、数据范围外不补色；没有区域裁切功能。

普通MapLibre可显示GridHeat；只有BuildingTint需要额外渲染适配。源代码和着色无地图Demo或业务默认数据。
`,
 'building-tint':`# 建筑染色接入

从套件入口导入BuildingTint，调用new BuildingTint(map, field, options)。与GridHeat共享同一HeatField实例；options为enabled、strength、brightness，preset.json中的tint是该配置。setOptions更新染色选项，setData更新共享数据。关闭使用setOptions({enabled:false})，不改变地面栅格开关或透明度。

必须使用adapters/patch-maplibre.mjs适配后的MapLibre 5.24.0；未适配宿主会明确拒绝启动。适配仅支持Mercator、无图案fill-extrusion。Three模型由MapExperience发布heatmodelrender/heatmodelremove事件，其他宿主须传scene、sceneToMercator、renderer的同等事件。支持普通不透明MeshStandardMaterial子Mesh及父级变换，不支持蒙皮或实例化网格。

地面投影世界坐标按片段采样；保持原几何和材质实例，挂接材质shader回调并保留原光照。数据空洞、范围外及阈值以下不染色；建筑保持不透明。dispose释放自有颜色纹理、移除监听并还原材质回调，不释放借用地图、模型、材质或HeatField。field由创建者最后释放。

颜色平滑为离散单元高斯平滑，不宣称等同参考安装包的连续纹理算法。原生和Three分别在各自颜色空间处理明度，不能据此要求不同光照表面像素相同。
`
};

export const adapterGuide=`
## 构建适配

源码登记后，应用构建脚本读取maplibre-gl/dist/maplibre-gl-dev.js，将内容传给patchMapLibre，写入应用的构建缓存maplibre-heat.cjs。对JavaScript导入maplibre-gl设置构建alias到该文件；maplibre-gl/dist/maplibre-gl.css仍指向原CSS。补丁函数由本包adapters/patch-maplibre.mjs导出，Node24可读取它引用的sampling.ts。源码指纹不匹配时停止，不能继续用未适配渲染器。

不要直接修改node_modules或共享组件库内的MapLibre；缓存文件属于应用构建。这个构建输入必须随工程保留，单复制BuildingTint类不能获得完整能力。开发接纳需验证实际宿主、参数更新与释放；导出状态不代表已接纳。
`;
