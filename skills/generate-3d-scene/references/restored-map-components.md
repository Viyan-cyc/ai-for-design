# 地图组件如何选用

地图整体、散点聚合、栅格热力、建筑染色、粒子扫光是五种业务能力；HeatField 是热力与染色共享的数据场。

|需求|组件|接入方式|
|---|---|---|
|设计来源的完整地图表现|MapExperience|拥有唯一 MapLibre 地图和容器，生成器负责共享 Three 渲染接入|
|独立区域中的逻辑散点与聚合|LogicalScatter|接收 0–1 的 x/y；不能直接输入经纬度，也不会自动随地图投影|
|经纬度数值显示为方格|GridHeat|附着 MapLibre 地图，使用 HeatField；空数据不显示|
|建筑表面按地理位置染色|BuildingTint|与格子共享 HeatField；需要原生建筑渲染适配及 Three 模型接点|

## 地图与数据的关系

MapExperience 负责地图造型、外观、导航与资源。GridHeat 和 BuildingTint 共享一个 HeatField，数据为 `{ lng, lat, value }`，value 是 0–255 整数。业务接入先统一坐标，不能混用 WGS84、GCJ-02 和 BD-09。

使用 `field.setData()` 更新共享数据；通过公开接口调整参数。关闭 GridHeat 只隐藏格子，不关闭建筑染色；关闭 BuildingTint 恢复建筑原表现。无数据范围保持原建筑表现，不用最近点无限填充。销毁顺序为染色、格子、共享场，最后才是地图。

默认五档由绿到黄、橙、红。分界决定每种颜色覆盖的数值范围；显示阈值决定较低数值是否显示。格子边长改变视觉间隔，中心间距保持独立语义，不把两者当作两个自由度重复控制。

## 热力数据准备

每个格子只接收一个0–255整数值。生成演示网格时，使用组件公开的 `heatCellCenter(x, y, options)` 获取经纬度格中心；x向东、y向南，相对options.origin，不能用近似经纬度步长生成边界点。

实际多条记录落在同格时，按业务含义显式使用 `prepareHeatRecords(records, options, 'max' | 'mean')`；返回records及inputCount/cellCount/mergedCount。mean四舍五入为整数。省略策略使用error，非法记录仍报错；不要为交付成功擅自聚合业务数据。转换后调用 `field.setData(result.records)`。完整热力数据可在Node中用实际HeatField校验，无需地图服务或截图。

统一构建检查map.heat、map.logicalScatter、map.geographicScatter的数据契约；它不证明瓦片、模型或动画渲染正确。

## 渲染与资源

建筑染色不能仅靠安装包启用。原生建筑需要匹配 MapLibre 5.24.0 的构建适配；Three 模型还需要在实际绘制前提供场景及世界坐标映射。仅按建筑中心赋色、遗漏 Three 模型或改变建筑透明度都不等价。

组件包通过 `@a3d/a3d-components/map-adapter` 提供构建适配及采样依赖。新模板的 `scripts/map-renderer.mjs` 在启用地图后自动使用它，校验 MapLibre 版本并写入构建缓存，不修改 node_modules。开发服务与统一离线构建使用相同适配；版本不符时明确失败。

MapExperience 的原始地标资产由项目显式提供，组件包不包含这些模型；不得把演示程序模型称为真实地标。底图、瓦片、字体及图标仍依赖地图服务。

## 生成器的当前接口

运行 `enable-map.mjs` 后统一使用 MapExperience，map.runtime 可省略或设为 experience。生成器桥接 Three 模型、编辑和保存，不创建第二个地图。

```json
{
  "runtime": "experience",
  "styleUrl": "https://tiles.openfreemap.org/styles/liberty",
  "origin": [121.49517, 31.24194],
  "zoom": 16,
  "pitch": 45,
  "view": "3d",
  "theme": "light",
  "experience": { "parameters": {} },
  "heat": {
    "data": [],
    "options": { "origin": [121.49517, 31.24194] },
    "gridVisible": true,
    "tint": {}
  },
  "logicalScatter": { "data": [] }
}
```

用户未指定地图主题时省略 `map.theme`，沿用组件默认浅色。用户明确指定主题时填写 `light` 或 `dark`。


以上是 `scene-data.json` 的 `map` 字段。热力与散点空数据保持空白，不自动生成业务数据。省略 `heat.tint` 不创建染色；隐藏格子不会关闭染色。逻辑散点在左下独立画布展示，不跟随地理投影。

右侧编辑面板提供常用参数、清空数据和恢复默认；高级配置可编辑三个新字段的 JSON。参数经过公开校验后进入 Bridge 的撤销、重做和保存链。程序更新时先读取 `handle.serialize().map`，修改后调用 `handle.update({map})`；`map` 是完整替换，不是深层补丁。需要编辑历史时通过 Bridge 提交。开发服务保存写入源 JSON；离线页复制带 before/after 的修改，仍需回写源码并重新构建，不是自动磁盘保存。

`experience.parameters` 相对于当前主题覆盖；清空即恢复主题默认。可选 `experience.assets`、`experience.outside` 分别沿用 MapExperience 资产与范围外配置。更换地图服务、原点或地标资产须重新创建。需要扫光时设置 `surfaceScan: { enabled: true }`，由生成器统一接入完整建筑轮廓、模型表面和帧调度。


组件自身的 `setData`、`setOptions`、`setParameters` 不自动触发编辑器 dirty、撤销与保存。业务数据和设计参数分别管理；只保存必要配置。已有场景升级在独立副本中进行，不用新模板覆盖用户源码。

具体 API 见 [MapExperience](component-docs/MapExperience.md)、[LogicalScatter](component-docs/LogicalScatter.md)、[GridHeat](component-docs/GridHeat.md)、[BuildingTint](component-docs/BuildingTint.md)及 [HeatField](component-docs/HeatField.md)。开发同步入口见 [component-sync](component-sync.md)。


### 经纬度地图散点

需要点跟随真实地图时使用 `map.geographicScatter`，不要使用独立面板的 `map.logicalScatter`。

```json
{"geographicScatter":{"data":[{"id":"fault-1","lng":121.4988,"lat":31.2395,"label":"故障点"}],"visible":true}}
```

位置保存经纬度，绘制时随地图投影更新；点半径和聚合网格以 CSS 像素计，拖动、缩放、旋转和俯仰仍使用地图交互。聚合按投影后的屏幕网格计算，达到停止聚合等级后显示单点；平移经过网格边界时可能重新分组。这是地理适配，不等同于逻辑散点按0–1缩放分段的算法。标记是地面位置的屏幕叠加标注，不具备建筑深度遮挡。背景透明，空数组不显示也不补演示数据；点击标记可选中。

右侧编辑面板提供显示、半径、聚合网格及完整JSON。更新沿现有Bridge/SaveService链；移除配置释放图层。地图导航只重新投影，不将屏幕坐标写回业务数据。可同时配置两类散点，但普通地图示例只使用地理散点。


### 已确认热力配方的复用

项目已有交付预设时，将 `preset.field` 完整映射到 `map.heat.options`，`preset.tint` 映射到 `map.heat.tint`。显式选择示例时才将该示例的 `sampleData()` 输出映射到 `map.heat.data`，不要换成另一套测试数据。保留原点、分界、颜色虚化和亮度，不能仅复制五个色号。恢复参数按钮恢复组件默认；要恢复某次设计确认的完整配置，应导入该配置。业务空数组始终保持空。


### 设计师样式默认与扫光

MapExperience保留来源主题；HeatField内置五色、五档、分界与虚化；BuildingTint内置1.5明度。Three模型染色使用参考的显示空间光影，不叠加场景ACES漂白；setLighting可跟随地图设计参数。无数据和关闭染色仍恢复原模型PBR材质。原生建筑沿MapLibre自身立体光照。

新增SurfaceParticleScan借用宿主表面数据，默认颜色#1FC7F5/#B2ECF5/#FFBA47、3.6px、10m间距、12000预算、720m半径、8秒周期、32m带宽、.92透明度、1.2发光，与参考HTML对应；默认关闭，示例显式开启。宿主负责共享深度、完整建筑轮廓、模型矩阵和tick，不把宿主地图打进组件。生成器通过 map.surfaceScan 统一接入，不要求业务代码另写宿主。


### 热力高值区域关联散点

需要让事件点只出现在热力高值区时，使用 `map.geographicScatter.heatLinked: true`，`data`仍提供经纬度事件候选。组合层按同一HeatField有效单元、最高档和虚化后第5色归属筛选显示；热力更新后重算，空热力隐藏关联点。当前用于已确认五色热力预设；“红区”指最高档第5色，修改色板后跟随第5色，不按屏幕截图猜色。栅格显示开关不清除共享场。未启用时散点独立显示。业务事件数据不能用热力值凭空推断；演示生成的关联点必须标注模拟数据。

默认样式由组件提供，不复制配色、虚化、亮度和聚合参数到场景配置；仅按用户明确要求覆盖。初始坏热力或散点会显示局部错误并保留请求配置，修正完整map配置后可重试；建筑染色初始化失败不影响有效栅格。非法更新继续拒绝，不会自动去重或改业务数值。

### 连续模拟热力
连续模拟热力使用统一构建入口：在工程 `source/scripts/heat-simulation.mjs` 导出下列配置，然后正常执行 `build-offline.mjs <工程目录>`。构建在完整依赖就绪后自动调用该工程组件包的 `generateHeatRecords`，无需提前安装依赖或手写经纬度网格。

```js
export default {
  kind: 'simulated',
  bounds: [west, south, east, north], // 替换为业务范围的实际数值
  alertCount: 12, // 可选；省略时不改现有散点，0清空模拟告警
  valueAt(lng, lat) { return sampleSimulation(lng, lat); } // 在文件中定义下述模拟分布函数
};
```

场景先配置 `map.heat: { data: [], options: { origin: [lng, lat] } }`，其他开关按需求设置。生成器只决定范围和强度函数，不生成格子坐标、不复制组件算法；14米等默认值由实际组件读取。`heat.options`同时用于生成及渲染，只在用户要求时覆盖样式。

每单元一条记录，数值按组件契约限制为0–255整数，最多100000条；超限缩小范围，不自动放大格距。告警选自有效最高档热力单元，直接保留其经纬度。生成失败不发布新预览。

首次构建前定好模拟范围、数值函数和场景描述。统一构建会自动在 `meta.description` 末尾追加模拟数据说明，描述里只写场景内容。需要试算时运行 `node scripts/check-data.mjs <WORKSPACE_PATH>`。命令复用工程静态校验和正式热力生成逻辑，用正式装配检查校验试算后的地图组件配置，并输出单元总数、逐档单元数、最高档有效告警候选数及预计生成数，无需类型检查或打包。它可能准备工程依赖，场景数据和预览文件保持原样。

真实业务数据直接提供 `map.heat.data`，不创建模拟文件，缺测保持缺测。已有模拟工程改为真实数据时移除该文件；独立开发者构建可直接使用已交付的JSON，重新模拟生成使用skill统一入口。

### 模拟分布的多样性
没有指定模拟分布时，新场景可以随机选择多个热点的位置、强度、影响范围及背景起伏，不固定复用两个热点。随机的是业务数值分布，组件的五色、分界、格距和虚化仍沿用默认值。

生成时选择一个种子并保存在工程模拟脚本中；热点参数由该种子确定，valueAt对同一经纬度应返回稳定数值。刷新、重建、追加效果不自动换种子；用户要求换一组模拟数据时才更换。不要在每次valueAt调用中直接Math.random，否则遍历顺序和重复构建会改变结果。

分布保持空间连续，可采用多个宽缓热点及低频起伏；不要逐格随机染成杂乱棋盘。五档应有可辨识的区域，尤其为黄色和橙色保留足够的中间值区域，避免大部分数值堆在最低和最高档。用实际HeatField的分档与虚化结果检查分布；需要改善时调整模拟数值函数，不修改颜色分界或样式参数，也不追求机械的五等份。模拟告警仍只从最高档有效单元选择。

这些规则仅用于新建模拟数据。真实数据、用户指定分布和已有场景的数据保持优先，不为了展示五色篡改真实测量或自动重排已有热点。

建筑染色连续采样：默认colorBlur=2.63时，BuildingTint在共享颜色场相邻单元之间连续插值，避免将格中心颜色直接拉成立面条纹；colorBlur=0保留分格。原生建筑与Three模型使用同一采样逻辑，缺测单元不补色。不要通过覆盖配色、亮度或格距来修正条纹。既有HeatField预滤波算法保持不变；此说明不代表与设计参考完整逐像素一致。
