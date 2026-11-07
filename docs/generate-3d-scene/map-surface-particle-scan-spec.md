# 地图建筑表面粒子扫描组件 Spec

日期：2026-11-06。层级：Feature Spec。阶段：Review。状态：P0–P7批量实施与自动验证完成；视觉验收及未覆盖风险见第11节。

## 1. 目标与来源

将设计师上海地图演示中的地面扩散、建筑立面爬升、屋顶粒子扫描提取为可复用地图能力，后续由 generate-3d-scene 按需使用。开发负责审核或重写实现；保留设计意图，不复制上海项目耦合。

来源文件：`C:/Users/Tony/Documents/xwechat_files/wxid_bby9kxsj4h0a11_f2fd/msg/file/2026-11/上海地图粒子扫光-明珠光影修正-v1.2(1).html`。
已静态读取嵌入的 `东方明珠粒子扫描-v2.1` 脚本、参数控件和初始化片段。文件名v1.2、脚本v2.1、UI版本文字不是同一个版本号，实施前记录完整文件SHA-256。
组件库：`D:/cyc/project/octo/test/3d-components`。
Skill：`D:/cyc/project/octo/gts/test/ep-coder/skills/generate-3d-scene`。

初始授权仅创建独立Spec；2026-11-06 用户在本会话明确 plan approved，并要求调用 sdd-riper-one 执行本Spec，现按第6节逐步执行。数字孪生融合任务保持独立。

## 2. 当前证据及边界

来源通过MapLibre custom 3d layer与Three.js ShaderMaterial/BufferGeometry实现粒子，使用建筑轮廓和高度采样墙面与屋顶。存在固定地图原点、固定扫描中心、上海图层ID、东方明珠专用处理、owner内部状态以及window全局依赖。
已有粒子预算与增大采样间距的控制、延迟重建逻辑；这些只是代码观察，不代表性能、生命周期或视觉验收通过。

第一版目标限定地图建筑及地面。任意GLB表面采样不在首版承诺内；东方明珠特殊模型处理仅留项目侧，是否需要通用自定义表面提供接口另行确认。扫描是展示效果，不代表实际无线传播或物理仿真。

## 3. 职责划分

| 归属 | 内容 |
|---|---|
| 3d-components | 粒子数据与绘制、扫描动画、渐变、更新、释放；地图数据/坐标/深度适配通过地图入口按需加载 |
| skill参考 | 效果适用条件、生成接线说明、参数选择原则和限制 |
| skill编辑器 | 沿用现有UI，按能力显示设置，撤销/重做/保存/即时刷新 |
| 项目 | 地点、扫描中心、半径、建筑来源及用户覆盖；特殊地标 |
| 维护侧 | 来源指纹、测试、性能记录、review证据 |

普通仓库/室内不得因该效果承担地图依赖。沿用现有MapRuntime和渲染调度；不建立第二个独立RAF循环或保存系统。具体类名、文件路径、接口签名在P1确定，不预先承诺不存在的API。

## 4. 参数候选表

以下是来源基础值与控件范围，不是已经采纳的组件默认值。所有单位需实现前核实。

| 参数 | 来源基础值 | 来源范围 | 语义/注意 |
|---|---|---|---|
| enabled | false | 开/关 | 开启才请求动画，关闭后释放动画需求 |
| size | 3.6 | 1–12 | 点大小；明确CSS像素/DPR约定 |
| spacing | 10 | 4–40 | 世界距离，地图按米解释需核查 |
| facadeDensity | 1 | 0.5–2 | 立面采样密度倍率 |
| count | 12000 | 1000–80000 | 数量上限；初始化另有72000覆盖，待确定实际基准 |
| radius | 720 | 100–1200 | 扫描半径；项目配置，不固定上海范围 |
| period | 8 | 3–24 | 扫描周期，核实秒单位 |
| width | 32 | 8–120 | 扫描带宽，核实世界单位 |
| opacity | 0.92 | 0–1 | 不透明度 |
| emission | 1.2 | 0–3 | shader亮度，不能误称物理光源强度 |
| colors | #1FC7F5 / #B2ECF5 / #FFBA47 | 三色 | 尾部/过渡/前沿；色彩空间需一致 |
| stops | 0 / 50 / 100 | 各有顺序约束 | 百分比位置；输入校验与规范化规则需明确 |
| center | 上海固定经纬度 | 待定义 | 改为显式项目输入，地理原点与扫描中心分开 |

用户输入间距与因预算实际采用间距要可区分，不能显示已应用原值却静默使用另一密度。数量上限不要求堆满粒子。

## 5. 数据与运行要求

- 显式输入建筑轮廓、底部/顶部高度或受支持数据提供者，不读取任意owner私有属性；可用数据不完整时说明限制。
- 明确Polygon/MultiPolygon、洞、瓦片截断、重复要素、高度缺失、负值/非数值的策略。世界采样相位稳定，地图移动不随意抖动；真实表现需验证。
- 普通地图建筑仍由MapLibre绘制，不为扫描强制替换为Three.js建筑。
- 使用现有地图坐标和深度机制，验证共享WebGL状态恢复、DPR、缩放、倾斜、建筑高度动画。
- 开启、关闭、暂停/恢复、参数变更、样式重载、数据更新、移除重建及dispose均有明确行为；取消延迟任务和监听。
- 颜色/时间等廉价更新不无故重建几何；密度/范围变化按需要重建，避免拖动控件大量同步计算。
- 错误清楚报告；缺少建筑数据不能虚构精细建筑。预算不足允许降低密度，具体策略与提示需确认。
- 保存实际项目参数，保留已有用户调整。效果关闭后静态画面应立即刷新。

## 6. 分步任务与用户门禁

状态使用未开始/进行中/待确认/待用户验收/待review/待修复/完成/决定不做。初始要求逐步确认；用户后续明确“全部执行”，现已覆盖逐步等待。保留页面入口、验证证据与最终用户视觉验收。

| ID | 工作 | 验证/产物 | 状态 |
|---|---|---|---|
| P0 | 固定来源、确认实际启动值、梳理外部依赖与上海耦合 | 指纹与参数来源表；不运行未知远程脚本 | 完成 |
| P1 | 对照组件库定义接口及边界 | 精确文件/API/生命周期/数据格式、参数单位、失败策略；用户确认 | 完成 |
| P2 | 独立粒子绘制和动画核心 | 隔离数据功能测试，数量预算与更新/释放；实际Demo | 完成 |
| P3 | 地图建筑数据和共享渲染接入 | 地图移动/缩放/倾斜/遮挡/样式重载/缺数据测试 | 完成 |
| P4 | 文档Demo与性能记录 | 使用可配置在线地图；固定设备/视口/范围记录，不承诺所有设备帧率 | 待用户验收 |
| P5 | skill可选能力接入 | 普通场景无新增地图负担；示例生成/构建/交付 | 完成 |
| P6 | 现有编辑器参数和保存 | 即时生效、撤销、关闭、保存重开、旧工程兼容 | 完成 |
| P7 | 包与源码一致性、回归及交付说明 | 真实随附包构建；公开入口说明；未覆盖风险清单 | 完成 |

P2/P3实现是否能独立验证由P1确认；若不能则调整任务依赖并记录，不伪造可用Demo。用户评价视觉效果，LLM检查代码和功能，不自行截图审美验收。

## 7. 初始待确认项（第10节已给出批量实施决策）

Q1 默认关闭还是特定模板启用；Q2 采用12000、72000还是分档预算；Q3 首版是否包含特殊GLB表面；Q4 范围是固定地理区域还是跟随视口；Q5 扫描触发方式与暂停语义；Q6 缺高度数据的策略；Q7 是否开放全部控件及基础/高级分组；Q8 超预算是否允许自动加大间距及如何提示。

原则已确认：组件实现归3d-components；生成规则归skill；保持我们的UI和字段；不直接照搬代码；独立任务不阻塞数字孪生融合。

## 8. 当前验证及恢复锚点

实现和验证状态以第11节为准。恢复时读取第10节契约、第11节验证/剩余风险和对应源文件；不再从P0重启。数字孪生融合Spec保持独立，本任务没有修改其进度。

## 9. P0 Execute Log / Validation（2026-11-06）

### Checkpoint 与计划
- Goal：提取地图地面、建筑立面和屋顶粒子扫描为可复用能力。
- Approval：用户已明确批准执行此Spec；沿用第6节逐步门禁。
- 当前单元：P0；In：来源指纹、启动配置、依赖及耦合静态核验；Out：效果代码、远程脚本执行、运行时视觉/性能验收。
- File Changes：仅本Spec；Signatures：不适用（静态调研单元）。
- Done Contract：完整来源SHA-256、启动覆盖链、参数表、依赖清单和剩余风险均有可定位证据。
- [x] 计算完整HTML SHA-256。
- [x] 对照基础默认值、固定预设、state初始化与参数规范化。
- [x] 检查采样、更新、render、释放和项目耦合。
- [x] 回写验证、Review与恢复锚点。
- Innovate：跳过，P0为事实核验，不涉及方案选择。

### 来源指纹与 Context Sources
- 文件：第1节来源HTML。
- SHA-256：`D6519CFD3910C562AE1D537164A6AE71B86D600D9E3BCBB8F2D065A72B180EEA`，PowerShell Get-FileHash SHA256读取完整文件。
- 特征索引（来源HTML行号）：97固定预设；98内存会话存储；1695扫描脚本起点；1698–1699坐标；1700默认值；1701范围；1708起readSettings；1756起createLayer；1830起sync；1846起rebuild；1873起surfaceSamples；1942起render；1956附近onRemove；2170–2177外部库；2511起state；3215起addPearlScanLayer。
- Codemap Used：本节窄范围源码索引；P0不生成全项目codemap。Context Bundle：Lite，本节及第1–8节已覆盖当前单元。

### 实际启动参数来源表
启动链：空Map会话存储 → 固定预设覆盖 → count版本迁移 → readSettings规范化 → state。该HTML会话存储是内存Map，不是持久localStorage；固定预设覆盖保存值。

| 字段 | 脚本默认 | 本HTML启动值 | 依据 |
|---|---|---|---|
| enabled | false | true | 97固定预设 |
| size | 3.6 | 3.1 | 97固定预设 |
| spacing | 10 | 4 | 97固定预设 |
| facadeDensity | 1 | 1.3 | 97固定预设 |
| count | 12000 | 72000 | 97预设，2515–2516版本兜底 |
| radius | 720 | 790 | 97固定预设 |
| period / width | 8 / 32 | 8 / 32 | 预设同默认 |
| opacity / emission | .92 / 1.2 | .92 / 1.2 | 预设未覆盖，readSettings默认 |
| stops | 0 / 50 / 100 | 0 / 50 / 100 | 预设同默认 |
| colors | #1FC7F5 / #B2ECF5 / #FFBA47 | 同默认 | 97固定预设 |

以上是来源事实，不是新组件默认值决议。间距/半径经Mercator米制转换；period通过performance.now差值除1000累计，为秒。size乘min(devicePixelRatio,2)并乘发光包络，不能把最终光晕直径直接等同CSS点大小。立面间距为spacing/facadeDensity。

### Research Findings：依赖与上海耦合
- 外部依赖：MapLibre GL 5.24.0（unpkg）、Turf 7.2.0（jsdelivr）、Three.js 0.180.0及addons（importmap）；本轮均未联网加载或执行。
- 全局依赖：window.THREE、maplibregl、turf、window.PEARL_SCAN_V1、document.hidden、devicePixelRatio。
- 固定原点[121.49517,31.24194]与扫描中心[121.49608578904618,31.240222597883093]不同；active另限制3D、zoom>=15、视窗中心距上海扫描中心约3500米以内。
- owner依赖：state、vecSource、_roundedReady、_roundedBuildingFeatures、isOrientalPearlFeature、_orientalPearlLayer.model/ready、ordinaryBuildingGrowthScale、buildingGrowthScale。
- 图层/来源耦合：sh-pearl-particle-scan-v1、sh-rounded-buildings-3d、sh-buildings-3d、sh-rounded-main；插入位置依赖baseMapLabelAnchor与enforce3DLayerOrder。
- 普通建筑优先取完整圆角建筑轮廓，否则queryRenderedFeatures可能拿到瓦片截断数据。支持Polygon/MultiPolygon；墙面遍历所有环，屋顶用Turf包含测试处理洞。高度取render_height或height，缺省6，负值钳制0，非有限值跳过；未读取底部高度。
- 特征去重依赖id、裁剪包围盒和高度；点去重量化到0.5米，不等同可靠跨瓦片要素合并。洞壁法线与不同环方向仍需专项验证。
- 东方明珠遍历私有模型网格三角形采样，按aKind单独增长；首版通用地图能力不直接纳入该私有模型分支。
- 预算通过共享间距每次乘1.25重试，最多24次；保留effectiveSpacing与counts。非scan-capacity异常直接return，存在静默失败风险，重写时需明确报告。
- 更新：颜色/时间类只写uniform；间距/count/radius/density改变重建，已有几何延迟120ms；监听moveend、sourcedata、visibilitychange。
- 动画由MapLibre render与triggerRepaint驱动，无独立RAF；隐藏/非active清lastTime，保留elapsed，单帧累计最多0.08秒。
- 释放：取消refreshTimer，解绑监听并dispose几何/材质/renderer；owner侧加载重试timer及样式重载生命周期需P1/P3单独设计。
- 共享深度使用gl_DepthRange与片元平面深度；renderer仅见绘制前resetState，绘制后GL状态、DPR变化、原生建筑遮挡未实测，不能据静态代码判定通过。

### Review Matrix
| 轴 | 结论 | 证据与限制 |
|---|---|---|
| Spec质量与P0完成度 | PASS | 指纹、启动覆盖链、依赖及耦合均已定位；Q1–Q8属于P1产品契约决策 |
| 计划执行一致性 | PASS | 仅静态读源与更新Spec，未运行HTML或修改效果代码 |
| 内在质量与风险 | PARTIAL | 已识别截断数据、底高、静默失败、GL状态和持久保存差异；运行时待P2–P7验证 |

Overall Verdict：P0静态核验交付，待用户确认；不代表整体功能完成。Plan-Execution Diff：无P0范围偏差；实际启动配置纠正了仅看基础默认值的误读。

### Reverse Sync / Resume
- 2026-11-06：记录用户执行授权，P0从未开始更新为待确认。
- 下一步：P1只读核对3d-components、MapRuntime和现有编辑器，给出精确路径/API/生命周期、Q1–Q8建议与Done Contract后按既定门禁确认。
- 恢复时读取本节和第6–7节；当前仅P0交付，不自动恢复数字孪生融合任务。
- 项目规则检查：ep-coder根及已检查祖先/docs路径未发现AGENTS.md；未静默创建项目规则。Project Sync Candidate：暂不提升，当前发现属于Feature Spec来源事实。
- 人工核对：比对来源97、1700、2511–2524行确认基础值与启动值区别；查看本节依赖/风险是否符合预期。
- 另一LLM Review提示：只审查P0，对照上述完整来源SHA-256和指定行段，复核启动优先级、单位、依赖、生命周期及未验证声明；列出确定错误，不运行远程脚本，不推进P1或改用户工程。

## 10. 批量执行 Plan / Checkpoint
用户决策（2026-11-06）：全部执行，覆盖逐步等待门禁；Approval=Plan Approved + Batch Override。阶段=Execute，P0完成，P1接口核对完成。仅授权此Feature涉及组件库与skill的修改，不提交已有工作区内容。

Q1–Q8实施决策：默认关闭；默认12000预算（可调1000–80000）；不做特殊GLB；固定地理中心；循环/暂停保留时间；缺高度跳过并报告；基础与高级参数全部开放；超预算增大间距且报告requested/effective。这些是本次实施选择，不宣称为来源默认。

File Changes（组件库根 D:/cyc/project/octo/test/3d-components）：
- src/map/surface-scan.ts：纯数据采样与参数验证；sampleScanSurfaces(buildings, options): ScanSamples；normalizeScanOptions(options): ScanOptions。
- src/map/MapSurfaceParticleScan.ts：constructor(runtime: MapRuntime, options: MapSurfaceScanOptions)；setOptions(patch)、setData(buildings)、getStats()、dispose()。复用runtime.requestFrame；自有custom layer共享深度；不创建RAF。
- src/map/index.ts：仅地图入口导出；docs/components/MapSurfaceParticleScan/*：可配置在线地图Demo；tests/surface-scan.mjs：孔洞、底高、预算、非法输入、稳定性验证。
File Changes（skill根 D:/cyc/project/octo/gts/test/ep-coder/skills/generate-3d-scene）：
- extensions/map/src/scene3d/map/create-map-scene.ts：可选surfaceScan配置、创建/更新/保存/释放。
- template/src/edit/RenderSettings.vue：只在地图且配置能力存在时展示，通过Bridge.commit和handle.update接入历史。
- references/map-surface-scan.md与references/map.md：接线、数据契约、限制。
- vendor组件随附包：按现有sync-components脚本构建同步。

数据契约：显式本地米制建筑轮廓（X东/Z南，原点为runtime.origin），Polygon/MultiPolygon转换为rings数组，外环加洞；bottom/top米制；稳定ID，重复ID拒绝。支持显式地图layerIds查询适配，但瓦片截断仅可报告，不能重建未提供的完整轮廓；优先完整显式数据。参数center为本地米制偏移，与地图origin分开。普通建筑仍由MapLibre绘制；高度动画由公开heightScale传入，不读owner私有状态。

Checklist：P2纯采样/着色器→P3运行时与地图数据→P4Demo→P5配置→P6控件/历史→P7构建、包同步、回归、三轴Review。验证：纯数据自动测试、TypeScript/生产构建、随附包入口检查；浏览器可执行项据环境记录，视觉由用户验收。失败返回对应实现修复，无法证实的项保留未验证，不假称完成。

执行偏差/修复计划：全库tsc存在原有InstancedMesh2及MapPresentation参数属性错误，新增地图模块独立tsc已通过。生产Vite构建成功，sync文档门禁发现MapPresentation缺@example，补最小示例。MapRuntime原有样式重载不恢复a3d-models，为满足P3增加style.load重新安装及释放解绑。上述为必要依赖修复；不处理无关InstancedMesh2错误。P2采样测试通过（孔洞、底高、预算、确定性、非法值），10次示例平均1.41ms仅CPU采样，不是渲染FPS。

## 11. Final Validation / Review / Handoff（2026-11-06）

### 实际交付
- P1：第10节契约与Q1–Q8实施选择已落盘，用户“全部执行”允许批量推进。
- P2：surface-scan.ts纯采样及MapSurfaceParticleScan.ts着色/生命周期；仅/map导出。
- P3：显式完整数据及地图建筑layerIds查询适配；共享标准深度、绘制前后resetState；MapRuntime补style.load恢复宿主层。
- P4：docs/components/MapSurfaceParticleScan在线可配置Demo、docs/index.html入口、components.json；实际视觉仍待用户验收。
- P5：create-map-scene.ts的可选map.surfaceScan及references/map-surface-scan.md；普通入口没有增加maplibre或扫描导入。
- P6：RenderSettings.vue能力条件展示、Bridge.commit历史、既有保存协议；不会自行把离线页面保存误称写回源码。
- P7：同步脚本完整通过，最终tgz已验证ESM/CJS/declarations/components.json逐字节等于源仓dist及目录。未git add/commit，保留原有工作区修改。

### 验证证据
- node tests/surface-scan.mjs：PASS，孔洞、非零底高、预算、确定性、非法输入、回调选项隔离。
- node tests/map-presentation.mjs：PASS，外观回归。
- node tests/docs-map-lifecycle.mjs：PASS，取消、监听/计时器、重复释放、异步切页；新增宿主style.load恢复断言。
- 独立tsc MapSurfaceParticleScan.ts及其依赖：PASS。
- 全库tsc：未通过；现有InstancedMesh2泛型/TypedArray及MapPresentation参数属性与erasableSyntaxOnly不兼容。未扩大范围修改这些逻辑。生产构建会报告这些诊断，但成功生成包；不等同全库类型检查通过。
- sync-components.mjs：最终PASS，32个公开组件用法页；MapPresentation只补缺失@example以满足原有文档门禁。
- 最终随附包的空场景地图工程：静态/装配、vue-tsc、Vite离线构建PASS。真实消费最终tgz，不依赖源仓alias。
- 真实Chromium 149 / Windows / 1000×700测试：零pageerror与console error；950粒子，150m半径，10m实际间距，单次重建8ms。通过原生fill-extrusion测试数据、shader编译、廉价颜色更新不换geometry、暂停/关闭后主动帧停止、缩放/65度倾斜/旋转、DPR2、样式重载、重复释放及DOM清理。持久测试入口tests/surface-scan.browser.html（通过Vite根服务访问，window.scanTestResult可读）。
- CPU：Intel Core i7-1165G7 @2.80GHz；Node24.16.0。纯采样2357粒子、100m半径、5m间距，10次均值初次1.41ms、并发构建时复测4.52ms。只报告样例CPU时间；未测真实设备长期FPS或80k压力上限。
- 在线OpenFreeMap加载成功；该测试位置有效建筑数据缺失时清楚报告仅地面扫描，不伪造建筑。完整建筑扫描由本地确定性GeoJSON原生拉伸夹具验证。
- 真实编辑器：500→420半径即时更新；撤销500；重做420；关闭；保存payload包含enabled true→false和radius500→420。逐项before核对后写回测试工程源码、使用最终包重建并重新打开：420和关闭状态保留，零pageerror。
- 输出证据：C:/Users/Tony/Documents/Codex/2026-11-06/d-cyc-project-octo-gts-test/outputs/particle-scan-validation.json。
- 构建日志：同目录work/scan-sync-final.log、scan-project-reopen-build.log；浏览器日志browser-scan.log、editor-check.log、editor-reopen.log。

### Review Matrix / Overall Verdict
| 轴 | 结论 | 依据 |
|---|---|---|
| Spec质量与需求完成 | PASS（工程）/PARTIAL（验收） | P0–P7实现和自动检查；P4视觉由用户判定，复杂瓦片与设备性能尚未覆盖 |
| Spec与实现一致性 | PASS | 显式数据、地图隔离、原有调度/编辑/保存、预算反馈、生命周期均有源码及测试证据 |
| 内在质量 | PASS（当前测试范围） | 输入校验、预算、孔洞/底高、延迟任务、GL状态、重载和释放验证；全库原有类型债务仍列明 |

Overall Verdict：工程实施已完成，可进入用户视觉验收；不得宣布所有视觉/性能场景均通过。无已知本次新增阻断缺陷。

Plan-Execution Diff：新增MapRuntime样式重载修复、对应测试桩与断言、MapPresentation文档示例；在线数据不足通过明确降级展示，未虚构高度。P2/P3运行时联合在真实浏览器夹具验证，纯数据仍独立测试。没有独立RAF或新保存系统。未覆盖：真实复杂洞/瓦片拼接视觉、多样式高度表达式、动画高度与原生建筑逐像素一致性、多设备压力。

### 用户验收与恢复
- Demo：http://127.0.0.1:7788/docs/index.html#MapSurfaceParticleScan（本会话Vite服务）；服务停止后在组件库运行 `npx vite --host 127.0.0.1 --port 7788`。
- 调整开关、暂停、预算/间距、像素比，拖动缩放倾斜并重载样式；核对状态栏actual spacing、资源缺失提示、建筑遮挡及立面/屋顶视觉。无有效建筑时提供完整buildings或实际图层ID，不把地面效果当建筑验收。
- 另一LLM Review提示：读取本Spec第10–11节，对照surface-scan.ts、MapSurfaceParticleScan.ts、MapRuntime.ts、create-map-scene.ts、RenderSettings.vue；执行上述测试与浏览器fixture；重点审查预算/孔洞/底高、样式重载/释放、shader深度、原有保存及scope隔离。区分已证实缺陷与未验证风险，不把候选GLB能力作为遗漏。
- Project Sync Candidate：MapRuntime需在style.load恢复自有custom层；暂留Feature Spec和API文档，未新建项目治理文档。Archive：未执行，等待视觉验收后按需归档。

## 12. 用户视觉修正：四个地图Demo使用设计师颜色
2026-11-06用户明确要求截图中MapSurfaceParticleScan、MapRuntime、MapScatterLayer、MapHeatLayer视觉颜色使用设计师调好的颜色。授权：直接修正，沿用批量执行；阶段Execute。范围为四个文档Demo，生产用户颜色覆盖不变。
来源：map-experience.js/themeValues(light)与P0 SHARE_FIXED_PRESET一致：地面#EFF2F6、道路#EAEDF1、水#CEE3FD、绿地#86EA61、建筑#FFFFFF；散点已迁移来源默认红#E12128；heat-profile.js v1.26.0默认五色#8DD25B/#8DD25B/#FCD72E/#F69E39/#E62D33及opacity1；粒子#1FC7F5/#B2ECF5/#FFBA47保持不变。
Plan：docs/shared/map-demo.ts所有模式初始化MapPresentation浅色；仅presentation模式绑定其专用控件；runtime演示块改白色无光照材质，避免法线彩色干扰；scatter恢复默认红；heat用reference与opacity1，控件初值同步。docs/components/MapSurfaceParticleScan/demo.ts同样初始化/释放MapPresentation。验证现有生命周期回归、Vite编译与四页浏览器加载/交互；不重新发布组件包，因为仅文档Demo改变。

第12节Validation/Review：四个Demo均经真实Chromium加载与关闭/开启操作，pageerror均为空；scatter控件值#e12128、heat opacity控件1。docs-map-lifecycle及map-presentation回归通过。Review三轴：用户颜色要求/实现来源一致性/交互与生命周期均PASS（配置与功能层）；视觉由用户确认。实际修改仅两个Demo TS文件及本Spec，无组件运行时代码、生产包或用户工程颜色覆盖变更。证据：outputs/designer-colors-validation.json。恢复点：刷新四页检查设计师配色；不再使用底图原始主题作为这些Demo默认外观。

## 13. 建筑二次出现修复
用户澄清：建筑出现后消失再出现。Research发现refreshRoundedBuildings在异步setData后立即切换可见层，且初始化多次重复提交。Execute计划：源数据/瓦片就绪前保留旧层；相同数据不重复setData；空查询不替换已有数据；释放或样式重载清除等待监听。验证延迟源提交测试及地图回归，再同步随附包。

第13节验证：rounded-building-handoff.mjs通过，明确覆盖worker未完成/完成但瓦片未就绪均不切层，就绪后切层、重复数据与空查询不重复提交。map-presentation及docs-map-lifecycle回归通过。用户所述建筑替换空窗已修复，实际视觉仍请刷新页面复核；并非已证明消除所有网络瓦片加载现象。

## 14. 录屏复核：隐藏图层不等于可绘制就绪
用户录屏7.23秒；采样帧0.50秒原生建筑、0.95秒无建筑、1.40秒白模；5.02秒再次无建筑。真实追踪在4689ms切换visibility，圆角要素4998ms才出现，确认第13节isSourceLoaded对隐藏图层判断不足（隐藏层无需请求可见瓦片）。修正：新建筑层先visible但opacity0预热，旧层继续显示；实际render之后等待源瓦片加载，再无透明度过渡切换。初始主题切换也需避免暴露未准备好的样式。第13节“已修复”结论撤回，以本节验证为准。

用户纠正：录屏首次消失来自手动刷新，随后变白是正常应用设计师颜色；唯一故障为白模稳定后约5秒整批消失。撤销首次加载隐藏地图方案及map-ready.ts，不以遮挡初始化过程掩盖问题。仅保留圆角层透明预热、实际帧/瓦片就绪后切换，验证范围聚焦第二次消失。

修正后验证：真实在线地图持续10秒、扫描开启，逐render检查两建筑层的visibility、opacity和已渲染要素数；建筑首次出现后空窗次数0（gaps=[]），共20条状态变更事件。rounded-building-handoff延迟测试通过，随附包同步成功。未把用户刷新和正常变色计为故障；仍由用户在原页面复核主观闪烁。

## 15. 用户要求首屏直接为设计师版本
用户明确希望首次显示直接为设计师配色，避免原生建筑→消失→白模。现在授权首屏就绪门禁（区别于第14节此前未经用户要求的遮挡提议）。Plan：四个Demo加载期间保持加载提示，应用MapPresentation并等待实际render和瓦片准备完成后显示地图；不使用固定延时，不在普通颜色更新时隐藏地图。取消/重试清理监听，错误在控件区保留。既有updateSurface只写paint，无重建操作，本次不更改生产颜色覆盖。

第15节验证：四个Demo真实Chromium加载后canvas均visible，开关操作无pageerror；map-presentation、docs-map-lifecycle回归通过，diff whitespace检查通过。仅修改文档首屏展示，不改用户工程或组件包。证据outputs/first-map-validation.json；视觉复核仍以用户刷新观察为准。

## 16. 新生成场景首屏接入
用户明确仅关心新生成场景。Plan/授权：将首屏就绪门禁接入extensions/map/create-map-scene.ts，独立受控地图容器初始化为hidden、加载提示位于外部；主题/覆盖完成后等待render与瓦片就绪再显示；30秒未完整就绪展示已配置主题并提示资源不完整；释放/初始化失败清理DOM、监听、计时器。仅新建验证工程，不迁移旧工程。

第16节Review/Validation：用当前skill init+enable-map从零创建fresh-map，消费当前vendor，静态/装配/vue-tsc/生产离线构建全部通过。真实Chromium打开新产物，12秒检查仅出现hidden→visible一次（约0.67秒→6.90秒，取决于网络），之后未重新隐藏，pageerror为空。首屏等待期间完成主题、图层与瓦片准备；仅证明本次流程，不承诺任何网络/设备永不闪烁。用户旧工程未修改。三轴Review：范围与要求PASS、模板实现一致性PASS、本次构建/浏览器PASS。
