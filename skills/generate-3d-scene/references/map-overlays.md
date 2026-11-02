# 地图散点与热力

仅在需要业务点位、聚合或热力时读取。先按 map.md 启用地图；使用同一个场景，不另建地图页面、相机循环或演示控制台。

## 声明与更新

在 `map.overlays` 中声明完整数组。每层有唯一 snake_case `id`、`kind`、`name`、`visible`、`locked`、`options`、`data`。不需要的层不生成。空数组显示为空，不自动用模拟数据填充；请求失败由业务层报告，不能伪造新数据。

```json
[
  {
    "id": "devices", "kind": "scatter", "name": "设备点位",
    "options": { "tone": "blue", "clusterDistance": 28, "minClusterCount": 9 },
    "data": [{ "id": "device_1", "lng": 114.06, "lat": 22.54, "properties": { "status": "online" } }],
    "card": { "type": "device" }
  },
  {
    "id": "traffic", "kind": "heat", "name": "话务热力",
    "options": { "valueRange": [0, 100], "displayMode": "transparent" },
    "data": [{ "id": "sensor_1", "lng": 114.06, "lat": 22.54, "value": 50 }]
  }
]
```

以上坐标、数值是接口示例，不是实测数据。使用实际业务 WGS84 坐标、稳定 ID 和业务数值范围。数据源、订阅、单位说明仍在 `src/business`；不要把接口地址、认证或请求逻辑塞进组件。

```ts
const map = handle.serialize().map;
// 修改对应层的数据，保留其他层、视角和配置；map 更新使用完整配置。
map.overlays.find(layer => layer.id === 'traffic').data = records;
handle.update({ map });
```

层作为整体条目进入“模型”列表，无伪造子节点；可显隐、锁定，散点可调统一颜色。编辑动作走现有 Bridge.commit，随场景保存和撤销。热力的五级颜色、阈值等属于开发参数，不用一个颜色控件冒充五级调色板。

## 散点

组件为 `@a3d/a3d-components/map` 的 `MapScatterLayer`。一张透明 Canvas 批量绘制，复用地图 render 事件，没有每点 DOM 或私有动画循环。

- 默认普通点半径 3.4 CSS px；聚合复用原 map-scatter 的 24×29 图钉路径，宽度 24 CSS px。数量文字 16px/500，三位以上按 0.82 适配。字号、描边和尺寸不乘地图 zoom；DPR 只用于画布缓冲换算。
- 默认红色；`tone` 支持 red/green/blue/gray，精确沿用来源 skill 的深浅配色。`color` 是用户覆盖值，跨主题保留。字体默认继承页面。
- 按邻近距离连通聚合，空间网格仅用于加速查找，不把网格边界作为聚合边界。聚合距离默认 28px、最小数量 9、`maxClusterZoom` 默认 17；结合实际地图投影，在导航结束或视口尺寸变化时重算并合并重叠图钉，导航期间只投影位置。不是按 Three 相机距离聚合，也不是米制覆盖半径。
- 单点选择展示 `card.type` 对应的外部 Vue 组件，注册在 `src/business/cards`。props 包含 `card.props`、点位 `properties` 和可信的 id/lng/lat。最多挂载一张选中卡片；聚合点击不冒充某一个业务设备的详情。
- 视图结束后检查聚合图钉重叠，不承诺导航中间帧一直无重叠；zoom≥maxClusterZoom 强制单点，此时不通过强行聚合掩盖重合数据。邻近连通链可能形成较大聚合，业务可调聚合距离。没有聚合展开动画、遮挡剔除或跨反子午线的聚合合并；不承诺这些能力。减少运动模式无需另启动画。

独立使用时支持 `setData`、`setOptions`、`select`、`onSelect` 回调和 `dispose`。模板已经管理生命周期，不在 handler 中重复创建。

## 热力

组件为 `/map` 的 `MapHeatLayer`，单个 MapLibre heatmap 图层。原 v1.26.0 strong-halo 的配置和表达式算法保留；通过 displayMode 区分业务透明模式与原参考模式。

- `displayMode: 'transparent'` 为业务默认：零密度 alpha=0，低密度外缘平滑显色；缺省 blankThreshold 为 0.02。显式 `reference` 保留原全域低值底色及默认26个停靠点。透明模式另行验证，不要求仍为26点。
- 兼容：没有模式但显式保存了 blankThreshold=0 的旧配置仍为 reference；没有模式也没有阈值的配置采用新透明默认。显式正阈值保留；transparent 的显式阈值必须为有限数且大于 0.0001。模板序列化写入最终模式，不静默改变用户明确设置。
- `valueRange` 必填，作为固定业务标尺，不能随视口/更新批次重新取 min/max。范围外值截断到 0～1。图例和单位由业务指定，不自动生成面板。
- 原生实现的基准点核为 30 CSS px，参考面积下外层影响半径为 70.8px；视口面积调整模糊。不是真实米制覆盖范围，也不声称原生热力层精确等价于五层独立像素羽化或归一化物理场。
- `options` 支持 colors、opacities、thresholds、blurMultipliers、intensity、opacity、radiusScale、minZoom/maxZoom 等。`thresholds` 必须严格递增。
- 自动插到第一条行政边界/文字图层之前。其他底图应通过 `beforeId` 核对顺序，确保道路、水系在下，边界与文字在上；单张烘焙栅格底图不能拆开插层。
- `setData([])` 隐藏热力，不保留一层全屏低值颜色。没有生产模拟回填。演示数据必须在维护样例明确标记。
- 支持 `setData`、`setOptions`、显隐、style.load 恢复、resize 和 `dispose`。销毁先移除自身图层再移除 source，不移除底图。

## 生成与维护边界

生成时照常运行统一 build-offline，成功即交付，不增加截图或审美自修复。生产 skill 只携带组件包、地图适配和用法；来源一致性、浏览器功能夹具留在仓库 tests，不能拷入用户交付。

维护演示：热力使用原指定499条固定示例记录，按固定目标范围一次映射并保留非实测元数据；散点使用独立疏密数据。默认仅开启热力，散点通过原有眼睛按钮开启。这个演示默认不覆盖用户的显隐选择；生产接口不回填演示数据。

聚合外观可按用户反馈通过 options.fontSize/strokeWidth 调整；例如24px图钉配12px数字、1px描边可增加留白。原参考默认16px/500仍保留，不把示例偏好强制成所有场景的标准。模型列表隐藏态统一使用关闭的眼睛图标，不给地图条目单独降低文字透明度。

地图叠加层整批更新会先校验完整热力色带与配置，成功后才提交保存快照。无效配置直接抛错且不修改旧层；运行期创建失败会尝试恢复旧层及快照，调用方应捕获错误，不能把失败当作已保存。持续资源故障导致恢复也失败时，会报告原错误和恢复错误。
