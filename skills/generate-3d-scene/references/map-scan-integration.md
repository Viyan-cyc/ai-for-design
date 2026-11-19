# 生成器声明式接入

场景只需在 map 中添加 `surfaceScan: { enabled: true }`。省略时不创建；移除时销毁。配置会随场景保存和恢复。不要为普通生成任务另写 attach、建筑查询、RAF 或定时器。

生成器统一提供完整建筑轮廓、当前显示高度与生长比例、业务模型网格以及 RenderLoop。组件默认样式直接沿用；用户请求播放才设置 enabled，其他参数只在明确要求时覆盖。

以下是自定义宿主的接口说明，普通生成任务无需实现：

# 地图粒子扫光接入

从 `@a3d/a3d-components/map` 导入 `SurfaceParticleScan` 或 `attachSurfaceParticleScan`。
前者接收完整高度建筑轮廓和模型几何；后者提供地图事件、完整GeoJSON轮廓读取、异步更新和采样去重。

宿主提供 map、scene、origin、invalidate、onFrame、getMeshes、acceptsLayer、completeLayer、growth、visible。getMeshes返回借用geometry与完整高度的局部matrix，须撤销当前模型生长缩放；growth只控制普通建筑；meshGrowth控制getMeshes满高矩阵中的模型，省略时沿用growth以兼容旧调用。buildingHeight(feature)返回普通建筑生长前的实际显示高度（米），省略时使用源render_height/height。不能默认源高度就是显示高度，也不能默认模型与普通建筑共用生长曲线。不要修改原材质或把效果加入业务建筑染色集合。

扫描中心为相对origin的东向X/南向Z米制坐标，须按场景经纬度转换，组件不绑定东方明珠或上海。options使用组件参考默认，演示可显式enabled=true。绑定返回component、refresh、dispose；播放和调参调用component公开方法，销毁绑定不销毁宿主地图、模型或渲染器。

地图散点使用GeographicScatter，数据为{id,lng,lat,label?}。LogicalScatter仅用于0–1逻辑平面，两者不能互换坐标。热力关联筛选由场景组合层负责，独立散点不拥有热力场。

扫光面板JSON导入导出仅管理扫光参数；不能将其等同于编辑器保存或撤销。需要持久化时由宿主保存getOptions并在重建时传入。

## 按需渲染接线

扫光组件已有 play/pause/restart/seek；初始播放状态与 enabled 显示开关不同。用户要求播放时显式开启 enabled，不重写默认样式。

公共适配层的 onFrame 会传入动画需求函数；必须传递给当前场景 RenderLoop，不能丢弃第二个参数或写死 continuous=true/false：

```ts
onFrame: (callback, demand) => handle.internals.renderLoop.onFrame(callback, demand),
invalidate: () => handle.internals.renderLoop.invalidate(),
```

播放且可见时由场景统一提供帧；暂停/结束/隐藏后释放扫光的持续需求，其他动画仍正常运行。组件的 play/restart/setOptions 会 invalidate 唤醒场景。RenderLoop 在后台停止计时，回到前台继续；不要自行 setInterval 或 requestAnimationFrame，也不要为扫光固定整场景30帧。没有需求函数的历史宿主仍兼容，但应升级到此接法。

MapExperience 的 acceptsLayer 包含圆角主/备用层、各自的 retained 层及原始建筑回退层；completeLayer 仅标记两个圆角 GeoJSON 层。适配器排除隐藏、透明和缩放范围外的层。有 filter 时由地图查询确定参与要素，再按稳定 id 或 __roundKey 匹配完整 GeoJSON 轮廓；没有可靠标识时保留查询几何。矢量回退几何可能被瓦片裁切，不宣称完整。生成器已经统一提供这套接线。

## 高度与坐标接入

MapExperience 的建筑渲染由随包 map-adapter 在每次绘制时应用同一生长比例；原始、圆角及交接保留图层不再将相机缩放写入逐瓦片高度缓存。保留生成器的渲染适配器接入，不在场景中复制高度表达式。

MapExperience.getBuildingState()返回当前普通建筑heightScale、growth和visible；读取实时状态，不复制其阈值或曲线。buildingHeight由源高度乘heightScale得到，growth单独传递，不能重复乘生长比例。独立模型的meshGrowth取模型实际使用的生长比例；getMeshes矩阵已经包含完整当前变换时传meshGrowth=1，禁止再次缩放。模型坐标需转到同一origin的局部米制坐标，父级变换必须包含在矩阵内。

```ts
buildingHeight: f => Number(f.properties?.render_height ?? f.properties?.height ?? 6) * experience.getBuildingState().heightScale,
growth: () => experience.getBuildingState().growth,
meshGrowth: () => modelGrowth(), // 模型宿主自己的实际变换
```

此适配的轮廓建筑以地面为基底，仅支持统一的竖向生长；非零基底、逐建筑不同生长或任意形变需提供对应表面适配，不能宣称本接口已自动覆盖。改变高度映射后调用binding.refresh()；只改变growth无须重采样。业务模型与标签所需相机状态也必须保持实时同步，替换桥接文件不能遗漏已有注册与清理。


地图移动后的表面更新由 attachSurfaceParticleScan 分片采样，保留上一份几何直到新结果完成；显示集合已改变时暂时隐藏过期扫描，防止幽灵建筑。直接调用时可 await scan.setDataAsync(data)：true表示已提交，false表示被较新数据、参数更新、取消回调或销毁淘汰；原 setData 同步接口保留。不要对每帧重新提交表面数据。

地图建筑查询按地图自身的地表边界排除天空区域，覆盖可查询的地表视口；按数值要素ID分批执行，并在批次间让出主线程。含地平线的高倾角视图使用同一路径，不限制相机倾角；矢量要素几何仍可能被瓦片裁切。没有数值ID的外部来源仍完整查询，但该分组不保证获得同等加速。相机或相关数据改变时取消旧查询，旧查询不得覆盖新显示集合，当前显示集合改变时隐藏过期结果。此路径面向建筑集合，不提供鼠标命中深度排序；单个底层查询仍是同步调用，分批不承诺所有硬件的固定毫秒上限。
