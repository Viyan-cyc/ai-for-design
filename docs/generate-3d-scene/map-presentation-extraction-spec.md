# 地图主题与整体样式组件化 Spec

状态：实现及本轮核心功能验证完成；验证边界见第 10 节。  
日期：2026-11-04

## 1. 目标与范围

将可复用的地图主题、建筑/道路/水面/地面/绿地整体外观控制，从 generate-3d-scene 的地图扩展提取到 3d-components 的可选 `/map` 入口。生成工程通过配置和薄适配调用组件，保持现有编辑、保存与加载行为。

建筑继续由 MapLibre 绘制。本次不改为 Three ExtrudeGeometry，不增加逐栋编辑、楼层爆炸或新地图渲染引擎，不重设计现有配色。

涉及仓库：
- Skill：`D:/cyc/project/octo/gts/test/ep-coder/skills/generate-3d-scene`
- 组件库：`D:/cyc/project/octo/test/3d-components`

## 2. 实施前依据

- 组件库 `src/map/index.ts` 已导出 MapRuntime、MapScatterLayer、MapHeatLayer；`src/labels` 提供 ScreenLabel。
- Skill `extensions/map/src/scene3d/map/map-experience.js` 与 `.d.ts` 提供 MapExperience，包含主题、视图模式及建筑表现逻辑。
- 同目录 `create-map-scene.ts` 创建 MapExperience；其 `category`、`part`、`entries`、`applySurfaces` 实现分类、旧子项、显隐和颜色覆盖，并通过 `handle.surfaces` 接入编辑器。
- 当前 `map.surfaces` 存储 color、visible、locked，兼容 `building:shadow` 等子项；父项修改会清除对应旧子项覆盖。
- 当前 serialize/update 负责将地图视角、主题和外观映射到 SceneData。地图服务和原点改变仍要求重建。

实施已盘点图层、事件、定时任务和资源所有权；迁移后的路径与验证结果见第 10 节。

## 3. 职责划分

| 能力 | 所属位置 |
| --- | --- |
| 主题默认值、主题应用、主题与用户覆盖的优先级 | 组件库 /map |
| 五类地图内容的颜色、显隐及建筑投影表现 | 组件库 /map |
| 图层分类与匹配机制、现有服务的默认适配 | 组件库 /map |
| 特定服务的图层映射配置、地图地址与认证配置 | 生成工程 |
| 当前外观状态快照与全量恢复 | 组件库 /map |
| 模型树名称、右侧面板、选中、编辑锁定、撤销重做 | skill 编辑器与适配层 |
| SceneData 字段转换、保存端点、文件写入、离线回传 | skill 工程适配层 |
| Vue 卡片、业务数据、业务叠加层编排 | 现有业务适配层 |

locked 是编辑权限状态，保留在工程配置与适配层；组件库不负责判断编辑锁，也不读取文件或导入 Vue、SceneHandle、编辑器模块。

## 4. 拟定接口与状态契约

拟新增 `MapPresentation`（名称可在实施前根据代码结构调整），仅从 `/map` 导出：

```ts
const presentation = new MapPresentation(map, {
  theme: 'light',
  layerMapping, // 可选；省略使用现有服务适配
  overrides,    // 仅地图表现字段
});
presentation.listSurfaces();
presentation.setTheme('dark');
presentation.updateSurface('building', { color: '#eeeeee' });
const snapshot = presentation.getState();
presentation.applyState(snapshot);
presentation.dispose();
```

约束：
- getState 返回独立、可 JSON 序列化的快照；不暴露可直接修改的内部 state。
- updateSurface 为局部补丁；applyState 为完整替换。清除覆盖后恢复当前主题值，不能遗留上次颜色。
- 顺序为底图原始样式 → 主题 → 用户覆盖。切主题保留显式用户覆盖；未覆盖的类别随主题改变。
- 主题、颜色、显隐修改立即请求重绘，按需渲染下无需额外点击。
- 参数先校验后应用；非法状态不改变有效配置。不得声称 GPU 或网络错误下完整事务回滚。
- 建筑隐藏时投影同步隐藏；恢复时尊重原图层显隐及用户投影设置。
- 普通颜色拖动不重置相机、地图视角或重建宿主。
- 视图模式与建筑表现存在耦合时，可迁移必要表现方法，但 MapRuntime 仍拥有导航与帧调度，不创建第二套相机控制或独立循环。

## 5. 图层映射与生命周期

默认映射保持现有服务分类结果；允许调用者以可序列化规则配置明确 layer ID、source-layer 和图层类型。提供明确映射时仅采用配置规则，默认服务专用算法停用；无法匹配的图层保持原样。省略映射时使用现有 OpenMapTiles 默认算法。

分类排除 custom、symbol 以及业务热力等叠加层。建筑、道路、水面的层名不是所有服务的通用标准。需用第二套不同命名的本地样式验证映射能力，不要求增加第二家在线服务。

组件只操作其负责的图层属性。需明确记录原始 paint/layout 值，包含表达式；主题应用和覆盖恢复不得破坏不归其管理的属性。

地图样式加载与重载后重新解析图层并恢复主题/覆盖；旧样式的显隐缓存不能污染新样式。退订所有监听并清理自身创建的图层、数据源和定时任务；不销毁调用方提供的 map。图层归属、插入顺序及 dispose 是否还原修改过的属性应在实施时确定并写入 API 文档，测试按同一契约执行。

## 6. 配置兼容与编辑保存

保持当前 SceneData 的 map.theme、map.view、map.surfaces 等公开配置形态。新增映射字段如确有需要必须可选，旧工程无需补字段。

适配层在读取配置时分离表现字段与 locked；保存时合并回原结构，不能丢弃锁定状态。保留旧子项覆盖的有效语义，兼容转换集中在一个入口；UI 仍展示五类整体条目，不重新暴露内部主体、边线等子节点。

撤销、重做和全量恢复沿用编辑器已有机制。纯表现组件不记录撤销栈，不写 SceneData 文件。保存后重载必须恢复主题、颜色、显隐、投影与锁定状态。

既有工程不会因更新 skill 自动升级。升级只能在用户明确指定的工程执行，并遵循现有文件冲突保护；源码有用户修改时报告冲突，不强制复制覆盖。

## 7. 实施步骤与交付同步

1. 盘点现有表现逻辑与调用链，建立代表性旧配置和映射夹具，记录当前行为。
2. 在组件库实现独立表现控制及类型，复用现有 MapRuntime，不携带编辑器依赖。
3. 将 skill 扩展改为配置转换与编辑接口适配；迁移完成后删除重复的表现实现，更新相应声明和引用。
4. 补齐组件文档、公开导出和组件目录；地图 Demo 使用外网底图展示主题、颜色、显隐、恢复状态，演示业务数据标注为模拟。
5. 构建组件包并检查包内导出及声明；更新 skill 随附 vendor 包和选择信息。从该实际包初始化隔离工程验证，不能仅凭组件源码测试宣称交付同步。
6. 更新地图接入与二开指南，执行下列验收并记录结果。维护测试留在维护目录，不进入日常场景生成流程。

普通三维入口不静态导入 `/map`，不因本次迁移增加地图安装要求。

## 8. 验收矩阵

| 场景 | 预期 |
| --- | --- |
| 旧配置、未设 surfaces | 外观与主题默认行为保持一致 |
| 切浅/深主题 | 无覆盖项跟随主题，有覆盖项保留 |
| 修改五类颜色与显隐 | 即时重绘，类别正确，业务叠加层不受污染 |
| 清除覆盖、全量恢复 | 回到当前主题值，旧色值不残留 |
| 建筑隐藏与投影恢复 | 不出现隐藏建筑仍投影或恢复后状态错乱 |
| 旧子项配置、父项修改 | 保持兼容语义，不重新增加模型树子项 |
| 锁定、撤销、重做 | 继续由编辑器约束，序列化不丢失 |
| 保存 → 重新加载 | 主题、外观、锁定及视角一致 |
| 样式重载、重复创建/释放 | 状态恢复，监听与资源不累积 |
| 不同图层命名的本地样式 | 明确映射生效，未知图层保持原样 |
| skill 随附实际组件包 | 新工程构建、导出和运行接口一致 |
| 普通三维工程 | 无额外地图依赖，构建与编辑正常 |

验证分层：纯逻辑与接口测试、隔离工程真实构建、浏览器功能验收。浏览器验证操作与状态，不进行截图审美评价。联网失败应明确报告，不用本地替代底图掩盖在线验收失败。

## 9. 完成标准与记录

只有迁移实现、skill 实际包同步、文档 Demo 和上述关键功能闭环均有证据时才标记完成。区分已通过、跳过和未验证项。当前组件库全量类型检查曾报告 InstancedMesh2 错误；实施时重新记录基线并区分本次引入的问题，不把构建退出 0 当作全部类型检查通过。

实施与验证记录如下。


## 10. 实施与验证记录（2026-11-04）

### 已落地

- 组件 `/map` 新增 MapPresentation、状态/映射类型和验证入口。内部 map-experience 保留来源算法；新增对样式基线、覆盖、重载和释放的管理。
- 默认算法管理原底图层与自有层；后加入的业务图层不参与默认主题遍历。自有建筑/投影置于底图表面与文字之间，不重排业务层。释放恢复属性有效值（MapLibre 可能显式序列化默认 minzoom/maxzoom），不要求 JSON 字节一致。
- 样式加载期间暂停覆盖写入，新样式加载后重新建立基线，防止旧覆盖污染新基线。重载清理旧样式缓存。释放取消监听、定时任务、idle 回调，并移除自有 canvas、图层和源。
- skill 中删除重复 map-experience.js/.d.ts；create-map-scene 只负责场景/编辑/保存适配及锁定字段。保持原 map.surfaces 结构。
- 增加 MapPresentation 文档页、在线 Demo、机器目录和 skill 使用指南；组件地图依赖仅来自可选 /map（maplibre-gl 与 @turf/turf）。
- 已更新 skill vendor/a3d-a3d-components-0.1.0.tgz，SHA-256：`8175086305e4a06656cc66bb8d3f969f135ddd74bb1fb9dc8c9f24939e457092`。生成工程实际解包此文件，未用本地源码 alias 替代。

### 证据

| 检查 | 结果 |
| --- | --- |
| 组件 tests/map-presentation.mjs | 通过：不同命名映射、覆盖/主题/清除、非法状态、快照隔离、旧子项、加载中保护、重载与释放 |
| 组件 tests/docs-map-lifecycle.mjs | 通过：过期文档请求、异步 Demo 导入、初始化取消与清理 |
| MapPresentation 与 map-demo 定向 strict tsc | 通过 |
| 组件 tests/map-presentation.browser.html | 真实在线 OpenFreeMap + WebGL，通过建筑/投影显隐、主题覆盖、全量恢复、样式重载、原属性恢复、资源释放及重复创建；无 MapLibre error |
| 文档页主题与快照控件 | 浏览器操作：记录深色快照，切浅色，再恢复，控件回到深色 |
| skill map-source-fixtures.mjs | 通过：原主题参数、建筑生长、缩放分段、普通模板无地图依赖 |
| skill map-enable-conflicts/newlines | 通过；维护夹具调整为现行 source/ 布局，没有放宽生产冲突检查 |
| skill in-place-entrypoints.mjs | 通过：普通场景初始化、项目/source 双入口构建及工程自身构建 |
| skill in-place-map-assets.mjs | 使用实际新 tgz，通过首次启用、注入、真实构建、源码修改、再次构建和冲突保护 |
| skill map-presentation-browser-fixture.mjs + map-presentation-adapter.browser.html | 实际随附包 + 真实编辑 Bridge/SaveService：五类条目、锁定拒绝、撤销/重做、主题保留覆盖、写回源码、从保存文件重建，颜色/投影/锁定/主题/视图保留；无控制台 error |

浏览器夹具仅创建隔离临时工程。维护测试不加入日常生成流程；未修改已有用户工程。地图 Demo 地址：`http://127.0.0.1:7780/#MapPresentation`。

### 限制

- 组件完整 Vite 构建生成了 JS 与类型声明，但声明插件仍报告既有 InstancedMesh2/FrustumCulling/InstancedEntity 类型错误；不能将构建退出 0 视为整库类型检查通过。新地图文件定向检查通过。
- 浏览器验证通过真实引擎、编辑命令和保存服务执行；未逐一手点全部编辑面板控件，未重测离线剪贴板回传、全部资产格式及内网服务。
- 使用本机已有依赖和新 tgz 验证，不代表全新机器离线安装验收。外网服务成功不代表内网服务已验收。
- 本轮无截图审美验收；不声明 GPU 故障、网络中断和并发外部修改具备事务回滚。

最终打包仅更新目录中的依赖说明；已逐字节核对最终 tgz 的 map.js/map.d.ts 与浏览器验收安装副本一致。

## 11. Review Verdict — review_execute（2026-11-04）

阶段：Review；层级：Feature Spec；范围：本次地图主题与整体外观组件迁移。用户已授权只读审查、定向补验和回写本 Spec；没有重新启动 Research/Plan，没有修改生产代码。此次结论综合独立执行证据与第 10 节实施记录，不将两者混称。

### Review Matrix

| 轴 | 关键检查 | 判定 | 证据与边界 |
| --- | --- | --- | --- |
| 需求完成度 | 表现组件化、五类整体条目、主题覆盖、编辑锁定、撤销重做、保存重载、实际包交付 | PASS | 独立阅读 MapPresentation/create-map-scene；此前审查独立运行 map-presentation、docs-map-lifecycle、map-source-fixtures、map-enable-conflicts/newlines、in-place-map-assets 均通过。本次新增实际 tgz 浏览器适配闭环 ALL PASS。默认建筑表现、完整样式重载及 Demo 控件依据第 10 节此前实施记录，未全部重跑。 |
| Spec 与实现一致性 | 可选 /map 出口、组件与编辑器职责、配置兼容、随附包和文档 | PASS | 独立确认主入口未导出 MapPresentation、普通模板无地图依赖，Skill 删除重复表现实现；tgz 的 map.js/map.d.ts 与组件 dist 哈希一致。本次 tgz SHA-256 与第 10 节完全一致。未独立重建组件源码进行可重复构建对比。 |
| 代码质量与风险 | 校验、状态隔离、覆盖恢复、生命周期、冲突保护及测试可信度 | PASS（有验证边界） | 已执行逻辑与生命周期测试、实际包连续构建、真实浏览器编辑保存闭环，未发现本次迁移的确定高风险缺陷。FakeMap/替代主题提供者测试不能单独证明默认 MapLibre 行为；该部分结合此前在线浏览器实施记录，不扩大为全面验证。 |

### 本次定向补验证据

- 用当前 map-presentation-browser-fixture.mjs 新建隔离工程，使用本机已有依赖并重新解包当前 Skill tgz，没有使用组件源码 alias。
- 隔离工程：C:/Users/Tony/AppData/Local/Temp/map-presentation-browser-C2GJgH/project/source。
- 通过真实 Vite 与新建 headless Edge/CDP 会话运行 acceptance.html；使用夹具既有 OpenFreeMap 公共服务，未访问内网，未做截图审美评价。
- 输出：五类父条目、锁定拒绝、真实 Bridge undo/redo、主题保留覆盖、全量快照恢复、真实 SaveService 写回、保存文件匹配、从保存文件重建后的颜色/锁定/投影/主题/视图，全部 PASS，最终 ALL PASS。
- 日志：C:/Users/Tony/AppData/Local/Temp/map-presentation-browser-C2GJgH/browser-result.txt。该临时路径为证据位置，不是生产交付或永久归档。
- 本轮创建的 Vite 和浏览器会话已关闭。没有逐项独立断言控制台零错误，不沿用实施记录中的“无控制台 error”作为本次断言。
- 当前 tgz SHA-256：8175086305e4a06656cc66bb8d3f969f135ddd74bb1fb9dc8c9f24939e457092，与第 10 节记录一致。

### Overall Verdict

**PASS — 本次地图主题与整体外观组件化通过收尾 Review，任务结束。**

Blocking Issues：无。此判定允许引用已明确标记的此前实施验证记录；不意味着所有验收项都在本次重新独立执行。关键编辑/保存闭环已补验，不再将此前“未独立运行浏览器”保留为完成阻断项。

边界：未重跑全部浏览器面板操作、默认样式重载与 Demo 控件；这些沿用第 10 节实施记录。未重跑整库类型检查及从源码重建包；既有 InstancedMesh2/FrustumCulling/InstancedEntity 错误保持既有问题分类，本次不宣称整库类型检查通过。内网服务、全新机器安装、离线剪贴板回传、GPU/网络故障事务性不属于本次通过结论。没有因此自动追加任务。

## 12. Plan-Execution Diff

| 原计划/要求 | 实际执行与差异 | 评审结论 |
| --- | --- | --- |
| 地图表现抽取到 /map；Skill 保留编辑保存 | 使用 MapPresentation 包装迁移后的内部 MapExperience；薄适配保留 locked 与 SceneData 转换 | 与需求一致；保留内部算法不属于重复业务实现 |
| 实际随附包验证 | 独立实际包构建已通过，本次补验同摘要 tgz 的浏览器编辑保存闭环 | 达成；本机依赖复用不等于新机器安装 |
| 三层验证 | 逻辑测试与构建独立执行；关键浏览器闭环本次补验；默认地图、Demo 等其余浏览器证据引用此前实施记录 | 证据来源已分层；无未授权实现偏差 |
| 完成标准与限制 | 不将整库既有类型错误隐藏为全量通过，不把有限测试扩大为整个系统验收 | 边界保留，不扩展任务 |

Reverse Sync：本节收尾 Review 取代此前审查中“关键浏览器闭环待独立验证”的状态；第 10 节保持为实施记录。恢复锚点：Review 完成、Overall Verdict PASS、无阻断项；无需自动进入 Research/Plan、修复或新任务。未暂存、未提交。
