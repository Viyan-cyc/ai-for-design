# 地图整合 P0/P1 实施与验证记录

日期：2026-10-29。

## 已实现

- 撤除未接受的 bright-sandbox 预设、建筑 handler 和维护样例源码；保留旧用户输出与独立目录整理成果。
- 可选 extensions/map；原 map-experience-v297 的通用主题/建筑/圆角/投影/标签代码直接迁入，地标和地域专用分支移除。来源见 map-source-mapping.md。
- Three 0.185.1，MapLibre 5.24.0，Turf 7.2.0；普通 template 不增加地图依赖。
- 一张画布、共享 WebGL 深度、地图拥有相机/调度，Three 负责可编辑模型；米制坐标转换、GLB、拾取、变换、保存恢复、主题撤销接通。
- 可选启用脚本、地图配置校验、二开指南和发布文件白名单同步更新。只检查打包目录，没有生成 ZIP。

## 实际执行

1. init outputs/map-integration-p1 --deps copy --defer-build；enable-map；工作区 npm 安装精确地图依赖。
2. `node tests/generate-3d-scene/map-source-fixtures.mjs`：PASS。通用 light/dark 参数、建筑生长与源实现一致；无固定地域全局；map schema；普通 template 无地图依赖。
3. `node tests/generate-3d-scene/render-settings-fixtures.mjs`：PASS。档位、输入校验、休眠唤醒、合并失效请求、30FPS、动画时间、无限制、可见性与卸载。
4. `node tests/generate-3d-scene/secondary-boundaries.mjs`：PASS。失败清理、资源路径、卡片、批量更新、失败启动。
5. 浏览器打开开发工作区维护页 map-check.html（测试源码 tests/generate-3d-scene/map-integration-browser.ts；复制到工作区根 map-check.ts 并通过 Vite 引入）：18 项 ALL PASS。
   - 真实 WebGL 首帧、共享上下文 gl.getError=0、真实 GLB 加载；屏幕投影/拾取一致、米制往返。
   - 模型编辑序列化、主题与二维状态、DPR 0.75/1.25/1、阴影开/关/开无 GL 错误。
   - 地图/投影画布释放、重建恢复位置和主题/视图、重建 GL 无错误。
6. 浏览器实际操作编辑器：点深色后“有未保存修改”；撤销后“无修改”；树选择模型后拖动 X 轴，从 0 改为 40.001271694580566。点击保存，显示“已写入 public/scene3d/scene-data.json”。读取源码确认 position 已保存，map.center 与 origin 均为 [121.4905,31.2356]，地图未被同时拖动。
7. `node skills/generate-3d-scene/scripts/build-offline.mjs outputs/map-integration-p1`：最终 RESULT OK；类型检查、静态检查、Node 装配及资源构建通过。构建本身明确异步 GLB 未执行；真实 GLB 证据来自第5项。
8. `node tools/generate-3d-scene/pack-skill.mjs --check`：204 文件，未写 ZIP。`git diff --check` 通过。

启动时发现原 React mapRef 残留导致异常，已改为 MapLibre 容器引用并补初始化失败清理；上述功能验证在修复后完成。浏览器日志保留旧时间戳异常，不能视为新一轮错误。

## 样例与限制

- 交付：outputs/map-integration-p1/index.3d.html；preview/ 与 source/ 配套。
- 开发工作区：C:/Users/Tony/.scene3d/workspaces/596d67a6392302992506ebd2。
- 开发预览：http://127.0.0.1:9998/ 。样例仅两个图元与一个测试 GLB，用于混合与编辑验证，不是设计成果或内网检索结果。
- 外网 OpenFreeMap 真实地图服务已加载。部分原地图 sprite 名称缺失有 warning，不伪造图标或隐藏版权。
- 浏览器工具明确禁止 file:// 导航，因此没有验证双击最终 HTML；没有用其他浏览器/底层协议绕过。此项需用户确认。
- 内网已确认可访问地图，但真实服务 URL/数据字段/跨域/字体与 sprite 仍需接入验收；不以外网样例替代。
- 只支持局部 Mercator、无地形贴合。底图建筑不可逐栋编辑。地图和 Three 的阴影不同，性能统计仅含 Three。
- 散点/交通热力属于 P2；更完整的自然语言路由和内网闭环属于 P3。未改其他 skill，不提交、不发包，不做审美评价。


## 2026-10-29 编辑与性能补充

- 最终 `build-offline.mjs outputs/map-integration-p1` 成功，源代码与预览同步更新。
- 真实 GPU 集成页 25 项 ALL PASS：增加整体条目选择、颜色/显隐序列化、撤销/重做、重建恢复；原 GLB、坐标拾取、DPR、共享深度及销毁回归继续通过。
- 实际编辑 UI 中选择建筑，取消“显示”，模型列表出现“已隐藏”、保存激活；撤销后恢复显示、保存回到无修改。
- zoom 回归：100 次同阈值区间事件，材质及阴影重设均为 0；两次跨 zoom=15，重设各 2 次。此为调用次数验证，不是特定设备 FPS 基准。
- 普通三维与地图共享视口入口。普通深浅仅调背景和雾，保留模型材质/灯光；地图沿用原主题，单独覆盖的颜色跨主题保留。
- 无审美验收、无内网实际服务验证、未验证 file:// 双击；延续上列限制。

### 列表与实时调色修复
- 五类整体条目统一为模型树行样式，替换文本符号为 SVG 图标，统一选中、悬停与隐藏状态。
- 颜色监听 input，使用 commitLive；整体调色只更新 paint/visibility 并 triggerRepaint，不重设主题和相机。
- 离线构建通过；GPU 集成 27 项通过，新增无额外点击主动绘制、调色保留视角。

### 地图条目展开
- 实际图层按主体、边线、立体建筑、投影等语义聚合为子项；父项有子项才显示箭头。子项颜色优先于父项，父项隐藏控制全部子项，投影仅显隐。
- GPU 集成 30 项 ALL PASS，新增实际道路子项、独立修改保存和撤销。

### 交互简化（替代上一节展开方案）
左侧仅保留五类整体条目，箭头仅选中并进入右侧属性，不展开子项。投影开关放右侧建筑属性。旧子项数据继续兼容；整体改色清除旧子项颜色覆盖，防止整体修改不生效。
