# 地图效果

使用 MapExperience 地图，map.heat 同时提供栅格与建筑染色，map.geographicScatter 提供地理散点聚合，map.surfaceScan 提供表面粒子扫光。详见[地图组件](restored-map-components.md)。

连续模拟热力使用工程scripts/heat-simulation.mjs（范围与数值函数），统一构建在依赖就绪后调用组件生成数据；不要手写经纬度间隔点阵。真实数据不进入模拟流程。配置见上述地图组件文档。

新场景的模拟数据可用保存在工程中的随机种子产生不同热点与连续起伏，使五档都有可辨识区域；刷新/重建保持同一数据。随机数值分布，不随机修改组件配色，详见地图组件文档“模拟分布的多样性”。
