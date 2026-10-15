# SDD Feature Spec：generate-3d-scene 提速、代码质量与编辑正确性

## 状态与最终目标

- 日期：2026-10-15，Asia/Shanghai。
- Phase：Review（P3 五审 PASS，P3-RRRR1 已关闭，本批次已报告阻塞项全部关闭；P4–P6 未开始）。
- Approval：APPROVED（2026-10-14 用户指令「按此 Spec 分批实施，每次只完成一个批次」；2026-10-15 用户指令「仅实施 P3，完成后回填改动、验证结果及未验证项，不进入 P4，不自动提交」）。
- 唯一真相源：本文件。Codex outputs 中同名文档只是交付快照。
- 项目根：`D:/cyc/project/octo/gts/test/ep-coder`。
- 修改主体：`skills/generate-3d-scene/`，包括 skill 指令、references、脚手架/验证/导出脚本、母版 core 与 edit。
- 最终目标：让此 skill 后续生成的场景更快获得可用预览，交付代码清晰、参数更新有效、编辑态可正确往返，正式运行包保持编辑后的视觉结果。
- 当前任务单元：P3 生命周期/编辑批次（P3.1–P3.4）已全部实施完成；见 §5 P3 批次与 §10 Resume。
- 执行前 checkpoint：以生产函数直跑验证（p1-fixtures 32/32）+ gates 84/84 + run/edit 双态冒烟 + eslint 0 error；浏览器交互级编辑回归与 GPU 长时观测按批次边界留给 P6。

## 0. Open Questions 与已定边界

没有阻碍本轮 Spec 完成的缺失信息。以下为计划默认值，批准此 Spec 时一并批准：

1. 保留 Vue 3 + TypeScript + three.js 0.185.1、内网 npm、零浏览器 CDN、资产优先和代码建模降级路线；不引入 Blender、云模型生成、外网 embedding。
2. 保留 `?edit=1` 与纯运行包；default=standard，仍完成已授权的双工程交付。preview 是提前反馈节点，不强制等待用户回复才继续。
3. 场景生成时不修改引擎；本次 skill 维护允许修改母版引擎和编辑器，以解决其公共契约缺陷。这两种工作必须在 SKILL 中明确区分。
4. 性能预算默认 WARN；确定性正确性错误硬 FAIL。不能为了提速把空画面、参数无效或编辑丢失交给用户发现。
5. 既有仓库源码、其他 skills、外部 a3d-components 源仓及 vendor tgz 不在本次修改范围。仓库需求可用作新临时工程的回归输入，现有产物只读。
6. 不自动提交、推送或重写仓库已有的历史 Spec；本 Spec 是新优化 Feature Spec，继承历史已确认约束。

## 1. Requirements / Done Contract

### 1.1 In Scope

A. 流程：减少重复读文档、重复启动浏览器、重复门禁和手工转录；以事件/状态驱动代替固定 sleep。

B. 生成：空场景与示例场景分离；用户场景决定资产复制和组件依赖；run/edit 同一业务装配，所有 factory 在建树前注册。

C. 代码：统一有类型的 create/update/dispose 契约、独立更新订阅、资源所有权、稳定槽位路径、格式化与生成规则。

D. 编辑：选择、移动/旋转/缩放、参数、材质/贴图、槽位、复制/删除、锁定、多选、撤销/重做、保存/重载均有行为级验收。

E. 导出：编辑结果自动编译到纯 core 的代码配置，运行包无 edit 依赖、无编辑私有数据、视觉不丢失；不依靠 LLM 手工照 Markdown 转录。

F. 验证：统一 runner、共用 CDP、严格 ready/failed、失败资产可见、画布可见、分组与 ID 对齐；按变更缓存；帧耗时与资源统计正确。

G. 资产链路：manifest 的真实 modelPath、GLB/glTF 依赖闭包、状态贴图可从检索结果贯通到 init/build/runtime；必要的超时、路径和失败处理。

### 1.2 Out of Scope

- 改造此次生成的 warehouse-editor/runtime 或其压缩包。
- 新建完整仓储业务系统、实时物流连接、新增大型资产库或专门追求照片写实。
- 更换 three.js、Vue、编辑器框架，改成 WebGPU，重写全部 core。
- 默认采用全场景统一合批而牺牲节点编辑；要求逐纸箱/逐实例编辑。节点、mesh 槽位可编辑；实例级编辑若未实现须明确标注，不能冒充支持。
- 将完整库回归塞进每次场景生成；无意义的无限重跑和自动削减视觉。
- 本轮实施任何代码变更。

### 1.3 可验证完成标准

- 新场景不需要改 engine/edit；新增业务 factory 只改一个业务注册模块，run/edit 自动一致。
- default standard 同一源码版本至多一个浏览器进程；同一任务各检查通过后无改动不重复执行。
- 初始 factory 注册完成后再建树，无 unknown factory 后硬编码 refeed 补偿。
- 参数更新不仅 serialize 改变，实际几何/材质/行为也按 handler 契约改变；transform-only 不重建对象。
- 复制 A 不改 B/C 的视觉层与材质库；撤销/重做、保存/重载往返一致。
- 新程序化模型 mesh 路径唯一且稳定；异步 GLB 保持旧实例过期守卫和 SkeletonUtils.clone。
- 删除、重建、卸载正确释放独占资源；删除一个节点不释放其他节点仍引用的共享资源。
- 导出运行包与编辑保存态在同一相机下的节点矩阵、槽位/材质/显隐/阴影状态一致。
- 正确性失败退出码1、环境不可用退出码2、PASS/WARN退出码0；SKIP/INCONCLUSIVE不可宣称PASS。
- 新增/修改业务代码零 type/lint 错误、零新增严重 warning；格式化可重复且稳定。

## 1.4 Context Sources

- 用户：先优化 skill 本身；整体审查；生成代码快且好、编辑态正确；本轮先写 Spec。
- `SKILL.md`、README、references 的 workflow/engineering/modeling/verification/component/asset 文档。
- `scripts/{init,build,strip-edit,ensure-env,search-assets,build-search-index,import-assets,validate-model,fetch-polyhaven,sync-components}.mjs`。
- `scripts/verify/{gates,smoke-structural,smoke-visual,perf-fps}.mjs`。
- 母版 main/edit-main、createScene/types/materials、engine、handlers、cards、Bridge/LayoutGizmo/Selection/Save/MaterialLib、package/ESLint/集成文档。
- `template/scripts/smoke-r.mjs` 现有 S1–S52 回归设施。
- 历史 Spec：`spec/specs/2026-09-30_11-49_generate-3d-scene-skill.md`；历史废弃路线不作为新增实施依据。
- 本次仓库审查：聊天执行证据、21分48秒总耗时、首次结构PASS仍不可见的实际截图、生成侧槽位命名复现。仅作为复盘证据，不作为修改清单。

## 1.5 Codemap Used（本 Feature 的链路索引）

| 链路 | 入口 → 实现 → 产物 |
|---|---|
| 策略/流程 | SKILL → references → init/verify/export 命令 |
| 资产 | import-assets → validate-model → manifests/search-index → search-assets → init → registry/AssetEngine |
| 初始化 | init → copy template + assets/vendor/deps → build静态检查 + 可选npm build |
| 运行装配 | main / edit-main → createScene → builtin factories → buildTree → handler延迟注册与refeed |
| 数据更新 | SceneHandle.update → SceneEngine.applyFragment → updateNodeInPlace / recreateNode → 单一onNodeUpdated |
| 编辑 | edit-main → Bridge → selection/gizmo/property/material → handle.update / applyVisual → serialize |
| 历史 | Bridge.commit → 全量serialize快照 → undo/redo → remove全树 + 重建 |
| 导出 | strip-edit → 删edit、改HTML/App、删私有区 → Markdown转录清单 → 静态checkProject |
| 验证 | 3个独立CDP脚本，各起Edge/轮询/timeout → 图计数/截图/预算与FPS |

审查方式：主要热路径和跨层契约已读取；资产运维脚本完成入口、依赖、路径与失败链路审查；未声称逐行形式化证明全部 UI/ZIP/GLB 解析器。实施时新暴露的问题按本 Spec 回写，不顺手扩大成全面重写。

## 1.6 Context Bundle Snapshot

此前耗时不能全归因于 gate；包含模型生成、模板理解、实现失误及截图返工。性能优化目标首先是稳定工具耗时和重复次数。现有文档已经强调按需阅读，但 workflow 的重复验证要求与五秒预检实现存在冲突。

## 1.7 Minimum Chaos Units

分六个可单独回归的批次：P1基础诊断 → P2装配/初始化 → P3生命周期/编辑 → P4自动导出 → P5流程/统计 → P6集成验收。当前只完成所有批次的合同，不默认在任一批次实施中增加外部项目。

## 2. Research Findings

| ID / 优先级 | Skill中的事实或风险 | 证据位置 | 处理 |
|---|---|---|---|
| F01/P1 | CDP每个RPC的40秒timer成功后不清理；finally不关ws | verify三脚本rpc/finally | 共享client，清理timeout和连接 |
| F02/P1 | 结构检查只数节点/fps，空视口也PASS；泛化404豁免无对应Network监听 | smoke-structural | ready/errors/assets/canvas/ID逐项验证 |
| F03/P1 | 三verify脚本重复起浏览器，15×800ms预检不是5秒deadline | verify三脚本 | 单runner+硬deadline+兼容CLI |
| F04/P1 | 两入口硬编码相同handler列表和refeed条件；factory晚于buildTree | main、edit-main、createScene | 公共profile/注册manifest，建树前装配 |
| F05/P1 | 单一onNodeUpdated/onNodeRemoved可被后注册handler覆盖；示例以外参数无统一update契约 | SceneEngine、example、procedural | 类型化factory定义和独立订阅 |
| F06/P1 | duplicateObject用单条__visuals喂整表替换接口，可能清除其他节点视觉覆盖 | Bridge.duplicateObject、SceneEngine.applyFragment | 明确patch vs replace；复制保留其他对象 |
| F07/P1 | recreate不释放旧资源；dispose只clear；GLB/实例/纹理/共享资源所有权不完整 | SceneEngine、AssetEngine、materials | 所有权与幂等生命周期 |
| F08/P1 | strip先删除私有视觉，仅输出Markdown人工转录，不能保证编辑结果自动保真 | strip-edit、engineering | 自动编译runtime配置，失败不丢源 |
| F09/P2 | init referenced读的是Demo场景；copy模式加vendor后依赖可能不匹配 | init | 空模板、--scene、显式资产与依赖闭包 |
| F10/P2 | glTF入库保存models/id/file，init/build默认寻找models/id.gltf | import/init/build/registry | manifest resolver贯通真实路径 |
| F11/P2 | load计数模块全局，失败也结算为完成；缺成功/失败/取消状态 | registry、createScene | 每handle每epoch tracker |
| F12/P2 | FPS高分位作为流畅判据；programs当materials；代码模型静态预算报0 | perf、build | 帧耗时分布、独立指标、unknown覆盖率 |
| F13/P2 | undo全树拆建；每次材质变动/复制可伴随资源、选框重建 | Bridge、Selection/materials | 最小差量恢复，保留正确全快照语义 |
| F14/P2 | 仅改环境强度也重新生成PMREM/RoomEnvironment | EnvironmentEngine.apply | 复用renderTarget，正确dispose临时scene/RT |
| F15/P2 | 规范禁视觉params但示例接受颜色；缺唯一槽路径和factory检查 | procedural、modeling、build | 更新示例与生成合同，兼容旧字段 |
| F16/P2 | GLB完成后dispose竞态、事件/回调注销不全，缓存key只按assetId | AssetEngine、createScene、Selection | epoch/abort、context隔离、稳定unsubscribe |
| F17/P2 | 导出rewriteIndex只按第一个内联script正则替换，入口识别脆弱 | strip-edit | 固定入口文件与确定性runtime出口 |
| F18/P3 | 下载无硬timeout；入库多资产逐项落库后才全链路完成，可能留下部分写入 | fetch-polyhaven/import-assets | 有界网络、staging验证后发布与失败清理 |

F06/F08是Skill模板问题，不是仓库代码问题。仓库中重复rack_frame不直接“修仓库”；本次修的是模板生成指南/唯一槽位断言/组件适配规则，使以后生成不再出现同类问题。

## 3. Architecture & Strategy

### 3.1 选项

- A：只改SKILL措辞、减少验证。改动小，但不解决编辑丢失与脚本等待；不选。
- B：重写引擎/编辑器并换框架。风险和工期高，已有52条回归价值丢失；不选。
- C：保留现有分层，集中修公共装配/生命周期/导出契约，统一验证工具与按变更执行。选择此方案，属于建议设计，待批准。

### 3.2 公共装配与生成边界

- 新增 `template/src/scene-profile.ts`：业务factory/card/asset/appearance注册的单一入口，run/edit共用。
- main和edit-main只管理各自DOM/UI壳，调用同一bootScene。画布容器/overlay基础样式由模板提供；生成侧无需重写index.html脚本。
- createScene保持现有前三参兼容，增加第四个options；业务factories在buildTree前注册。旧registerFactory(function)适配仍可用，模板示例迁移到新契约。
- factory定义区分创建、参数更新、结构重建与释放；transform更新由引擎负责，不让每个handler重复实现。
- params按JSON业务值比较：相同值重复推送不重建；值确实改变则调用factory.update，返回rebuild才局部重建。旧function或未提供update的factory采用局部重建兜底，不能沿用“只存数据不更新模型”的静默行为。重建须保留子节点、节点外观及当前选区，释放旧实例。
- params允许业务状态和业务尺寸/层数；颜色/材质/three实现参数放profile与materials代码。保留旧视觉字段迁移适配，不静默改变旧示例外观。
- 组件为Group/InstancedMesh时，适配层提供稳定唯一路径。命名唯一性针对同父层/最终slotKey，不要求全场scene内所有mesh名字全局不同。

### 3.3 编辑及资源

- 保留现有 `update({__visuals})` 整表替换语义供历史恢复；新增明确单节点patch API供复制/局部操作，禁止混用。
- undo先以正确性为先：快照仍可保留，恢复时算node/visual/material差量；未变化对象保留身份，变更参数走factory update，结构变化才局部重建。不能先为提速换成未验证的新历史系统。
- 资源按独占/共享/资产缓存三种所有权登记，节点移除/recreate/scene dispose都走同一清理协议；共享资源最后一个owner退出才释放；资产clone不释放缓存根，但独立编辑材质有自己的释放责任。
- GLB异步完成须检查handle与节点epoch；dispose后不挂树、不回填缓存、不触发旧订阅。加载失败不能当ready成功。
- 每个订阅返回unsubscribe；scene/editor teardown能完整取消监听、frame回调、HUD、helper和loading任务。
- 单实例mesh槽位支持保留；合批mesh整体槽位编辑与逐instance编辑区别写清楚，不因instancing产生“支持所有子物体编辑”的假承诺。

### 3.4 自动导出保真

- strip先校验源快照和槽位/材质引用，再生成 `src/scene-core/generated/appearance.ts`（代码模块），包含节点/槽位视觉默认与材质库定义。
- 生成模块不import edit；业务scene-data仍纯净；locked/选区/history等编辑交互态不进runtime。
- 运行装配及异步asset onLoaded统一应用编译外观；显隐、阴影、材质、贴图、槽位变换/引用均需支持。
- TRANSCRIPTION.md保留作人类审计，改成自动转换摘要，不再要求人工转录作为成功条件。
- 陈旧节点/slot/material引用：报告具体路径；真实未支持覆盖为FAIL，不得删掉后PASS。旧项目若只需生成旧转录清单，提供显式legacy模式并声明“未完成保真导出”。
- runtime输出先在临时目录完成，校验成功再发布。失败不改源、不覆盖旧成功产物；src/out路径保护维持并补case/realpath/子目录用例。

### 3.5 验证档位与缓存

| 档位 | 自动检查 | 产出 |
|---|---|---|
| preview | 数据/注册/ID/有限数值/父链、typecheck+生成侧lint；run/edit基础ready+画布+错误检查；1张总览 | 尽早可操作预览，注明尚未release |
| standard（默认） | 复用preview结果，受影响的编辑契约检查；最终production build；已请求运行包则导出并build一次 | 原有双工程交付、精简报告 |
| release | standard+完整编辑回归、运行包保真比较、GPU性能基线 | 正式交付证据 |

- 修改颜色/相机/CSS：只失效相关visual/type/lint检查；改scene节点失效schema/graph；改factory失效factory/update/slot/lifecycle；改engine/edit/profile/导出失效相关集成回归。
- 缓存key由内容hash、scene、依赖lock/vendor、模板版本、检查版本、mode、viewport、browser/GPU指纹组成；未知影响按保守失效。不能仅mtime或上轮PASS复用。
- typecheck不重复调用：npm build自带vue-tsc时按epoch复用准确证据；剥离运行包是不同artifact，仍须构建，不冒充与源相同。
- 通过后无改动不重跑；明确代码故障修复后定向重验；环境错误至多一次有理由的重试，仍不可用记SKIP并给人工清单；无限循环禁止。
- 一个runner一个浏览器进程、run/edit隔离page/context；性能采样串行且无并行build/GPU截图干扰；库的全回归在skill维护时跑，不在每个用户场景跑。
- ready不替代截图；canvas有尺寸和viewport交集不等于有主体，另验证关键对象包围盒进入相机视锥及总览实际看图/人工。

## 4. Plan（待批准实施合同）

### 4.1 File Changes（路径均相对 skills/generate-3d-scene）

| 批次 | 新增/修改文件 | 内容 |
|---|---|---|
| P1 | 新 `scripts/lib/cdp.mjs`、`scripts/verify/scene.mjs`；改verify三CLI | 共用连接、deadline、错误捕获、单browser、阶段结果 |
| P1 | 新 `template/src/scene-core/diagnostics.ts`；改registry/createScene/types/index | 每handle loading tracker、ready/failed与诊断API |
| P2 | 新 `template/src/scene-profile.ts`、`template/src/boot-scene.ts`、`template/src/entry.ts`；改main/edit-main/index.html/App.vue | 共用业务装配、固定入口/画布壳 |
| P2 | 改init/ensure-env/build；新 `scripts/lib/asset-catalog.mjs`、`scripts/lib/scene-schema.mjs`；改registry | 空/Demo选择、--scene、资产真实路径、依赖闭包与schema |
| P3 | 改SceneEngine/types/registry；新 `template/src/scene-core/resources.ts`；改AssetEngine/materials/EnvironmentEngine/createScene | factory生命周期、事件隔离、资源所有权、异步取消、环境复用 |
| P3 | 改Bridge/LayoutGizmo/Selection/MaterialLib/PropertyPanel及edit-main | patch/replace、params响应、历史往返、清理与重绘；UI文件只改确实受契约影响处 |
| P3 | 改handlers/example与procedural示例；新增小型Rack组件适配示例 | 示范typed params/update/resources/稳定slot；不新增仓库大型业务代码 |
| P4 | 改strip-edit；新 `scripts/lib/compile-appearance.mjs`、母版core外观应用公共模块；改boot-scene | 自动外观编译、runtime保真、原子发布 |
| P5 | 新 `scripts/lib/verification-cache.mjs`、`scripts/benchmark.mjs`；改perf/build/search-assets | 检查缓存、工具时序、frame-time统计、批量检索/保留旧单查询CLI |
| P5 | 改template/package.json/lock、ESLint；新增 formatter配置及开发依赖（内网安装） | format/typecheck/check快捷入口，保留已有质量规则，不全库盲目格式重写 |
| P5 | 改import-assets/fetch-polyhaven/validate-model必要接口，sync-components仅依赖元数据输出 | manifest贯通、路径/超时/事务；不扩库或改外部组件源码 |
| P6 | 扩verify/gates、拆分/保留smoke-r兼容入口；新 `scripts/verify/contracts.mjs`、`scripts/verify/fixtures/` | 负例与行为回归、基准fixtures |
| P6 | 改SKILL/README/workflow/engineering/modeling/verification/INTEGRATION_GUIDE | 一套一致流程、维护vs生成边界、生成规则、证据和迁移 |

### 4.2 Signatures（设计合同，无实现代码）

- `openBrowserSession(options: BrowserSessionOptions): Promise<BrowserSession>`；session提供rpc/evaluate/newPage/close；预检deadline=5000ms；每rpc成功/失败/取消清timer。
- `verifyScene(options: VerifyOptions): Promise<VerificationReport>`；options含project/url/profile/mode/viewport/changeSet/cache；结果逐check的PASS/WARN/FAIL/SKIP、duration/hash/source。
- `validateSceneData(data: unknown, registry: RegistryManifest): SchemaResult`；检查ID/Vec3/scale/parent/factory/asset，不以预算unknown冒充0。
- `createScene(canvas, data, cardComponents?, options?: SceneOptions): Promise<SceneHandle>`；兼容旧三参调用。
- `NodeFactoryDefinition<TParams>`：`create(node, context): Object3D`；`update?(object, next, previous, context): 'updated' | 'rebuild'`；`dispose?(object, context): void`；context提供资源和加载tracker，不让handler覆写全局事件。
- `registerFactory(type, factory: LegacyFactory | NodeFactoryDefinition): void`；旧function兼容适配；模板新业务使用definition。
- `SceneHandle.whenReady(options?: { timeoutMs?: number; signal?: AbortSignal }): Promise<SceneDiagnostics>`；等待当前epoch终态；failed拒绝，cancelled与removed独立结算。
- `SceneHandle.getDiagnostics(): SceneDiagnostics`；含epoch、pending/succeeded/failed/cancelled、failedAssets、factory/schema/slot错误、firstFrame状态。
- `SceneHandle.patchVisual(nodeId: string, patch: VisualOverride): void`；局部merge，不替换其他节点；原update({__visuals})保留整表语义。
- `subscribeNodeEvent(event, callback): () => void`；订阅不会相互覆盖，释放时不留下旧callback。
- `ResourceScope.acquire(resource, ownership): void` / `release(): void`；资源去重、引用计数、独占与cache分层。
- `compileAppearance(snapshot, registry): AppearanceCompilation`；输出代码模块、覆盖清单、unsupported/errors；只生成可审计代码，不生成GLB。
- `resolveAsset(id, catalog): AssetDescriptor`；统一modelPath/dependencies/textures/states；路径在资产根内。
- `initProject(target, opts)`扩 `scene/profile/assets/deps`；CLI加 `--scene <file>`、`--profile empty|demo`（新默认empty）、`--validate preview|standard`；旧参数不移除。
- `stripEdit(src,out,opts)`扩自动appearance与发布策略；旧返回字段保留，新exportedVisuals/errors/verified字段补充。
- `benchmark(options): BenchmarkReport`；保存stage wall time、LLM不可测区、tool wait、重复检查、ready/render/verify/build/export耗时。

具体private helper允许实施时细化；公开签名或语义更改须回写本 Spec并说明兼容性，不直接扩大到新的系统。

### 4.3 Implementation Checklist

- [x] P1.1 建共用CDP client，兼容原CLI和Windows Edge发现机制。（2026-10-14 完成）
- [x] P1.2 建每handle diagnostics/loading epoch；安装启动前错误监听。（2026-10-14 完成）
- [x] P1.3 在旧模板跑正例、空画布/缺资源/启动异常负例，证明不再假PASS。（2026-10-14 完成，见 §5 Execute Log）
- [x] P2.1 共用profile+boot，建树前注册；新business group无需改两入口。（2026-10-14 完成，见 §5 P2 批次）
- [ ] P2.2 空场景生成、--scene资产闭包、vendor选择/lock/依赖同步一次。（实现部分完成；Review 确认 glTF build/runtime 与 copy 依赖同步未完成）
- [ ] P2.3 schema校验接入初始化/verify；旧demo兼容与glTF多文件fixture。（实现部分完成；缺 factory/asset 等校验仍漏检，glTF fixture 未贯通实际加载）
- [x] P3.1 factory update/events与示例迁移；transform保身份、结构参数有限重建。（2026-10-15 完成，见 §5 P3 批次）
- [x] P3.2 资源和异步生命周期统一，缓存/GLB蒙皮/材质克隆不回归。（2026-10-15 完成，见 §5 P3 批次）
- [x] P3.3 修复制视觉覆盖和编辑patch；历史差量恢复；保存重载、slot唯一性。（2026-10-15 完成，见 §5 P3 批次）
- [x] P3.4 renderer环境复用、订阅清理、选择helper非必要重建优化。（2026-10-15 完成，见 §5 P3 批次）
- [ ] P4.1 appearance自动编译+runtime应用；异步asset也保真。
- [ ] P4.2 原子strip与入口固定；unsupported失败不毁源/旧包。
- [ ] P5.1 preview/standard/release策略和hash缓存，移除重复三绿及固定sleep。
- [ ] P5.2 正确frame-time和resources指标，批量检索/基准记录。
- [ ] P5.3 formatter与typed生成示例；资产运维必要修复与文档一致。
- [ ] P6.1 跑已有41类脚本用例与S1–S52（保留等价行为，不靠减少用例变绿）。
- [ ] P6.2 跑下述新增负例、编辑合同、导出保真、稳定性和速度对照。
- [ ] P6.3 更新Spec Validation/Review/Diff，交付skill修改说明与兼容迁移文档。

### 4.4 Validation Matrix

| ID | 行为与期望 | 检查层 |
|---|---|---|
| V01 | RPC成功后立即释放timeout；末次请求结束后空闲进程退出≤1秒，无悬挂ws | 单元/子进程 |
| V02 | CDP不可用5秒内结束预检（允许小量调度误差），fetch亦受deadline约束 | 负例 |
| V03 | 空画布、视口外canvas、遮挡输入、无关键主体、启动异常不能PASS | 浏览器 |
| V04 | GLB404/解码失败ready=failed；删除中的异步加载=cancelled；两handle计数隔离 | 模型加载 |
| V05 | 模型dispose后迟到Promise不回填缓存/场景；无unhandled rejection | 异步生命周期 |
| V06 | 新factory注册一次在run/edit均有节点，无refeed列表改动 | 集成 |
| V07 | params层数/尺寸/带货/状态更新改变真实对象，重复upsert幂等；transform不重建 | handler |
| V08 | ID重复、parent环/缺父、NaN/非法scale、缺factory/asset输出明确失败路径 | schema |
| V09 | 复制已改色A后B的颜色/slot/libraryRef不变；副本与A独立可编辑 | editor |
| V10 | root及slot的move/rotate/scale，commitLive、undo/redo、保存重载一致 | editor |
| V11 | delete/级联/锁定/多选与撤销恢复正确；选区无陈旧引用 | editor |
| V12 | 改单个GLB实例材质不改另一实例，蒙皮clone尺寸正常 | editor/asset |
| V13 | 最终slotKey唯一，组件适配稳定；重名负例阻断新代码模型 | 模型合同 |
| V14 | 100次增删/重建/撤销后owned资源释放，shared剩余owner不dispose；memory不持续无界增长 | 单元计数+GPU观测 |
| V15 | 编辑服务dispose后listeners/frames/helpers不触发；GPU资源按所有权释放一次 | lifecycle |
| V16 | 环境只改intensity不生成新PMREM，切关闭/重开与卸载无RT泄漏 | renderer |
| V17 | 保存后run/edit在相同相机下节点/slot/材质/贴图/显隐/阴影结果等价 | round-trip |
| V18 | strip无edit import/链接/私有数据；generated appearance可审计；runtime可构建 | export |
| V19 | unsupported/陈旧覆盖明确列出，失败源和旧输出完好；同目录/父目录/嵌套输出保护 | export负例 |
| V20 | glTF外部bin/texture及states贴图都能init→build→run，内网无CDN | asset集成 |
| V21 | 多vendor按明确版本/manifest选择，不靠文件名字典序假定最新；copy模式依赖完整 | init |
| V22 | 同hash检查命中缓存；改scene/handler/edit/lock/vendor相应失效；未知影响全相关失效 | cache |
| V23 | p95 frame time与低分位FPS从已知样本正确计算；program/material独立 | perf单元 |
| V24 | production构建+lint通过；generated代码formatter二次执行无diff；非法import负例仍阻断 | code |
| V25 | 默认standard一个browser，run/edit独立page；固定版本没有重复已通过检查 | runner |
| V26 | zip/manifest/path/glTF引用非法时不越界；HTTP timeout与入库失败无部分成功假象 | pipeline |

模板三种基准fixture：asset-heavy（多实例GLB+失败/蒙皮）、procedural-heavy（Rack/多材质/InstancedMesh）、mixed-edit（层级+cards+material library）。历史Demo与新空模板均纳入。仓库提示可另外做新临时工程，不改原仓库。

### 4.5 Speed / Quality Acceptance

- 先记录未修改skill的工具基线，不能拿21分48秒直接当纯工具基线。
- 同机、同Node/浏览器/viewport、相同fixture/依赖，cold/warm分开各至少3次；不并行跑GPU采样。
- 基准需分开记录首次依赖准备、已缓存依赖初始化、浏览器ready、定向检查、最终编译与导出；npm copy的优势只有在lock/vendor一致时才可采用。速度未达目标但正确性通过，报告实际差距并定位剩余热点，不擅自扩范围重写。
- 硬验收：PASS后40秒尾等待消失；default standard至多一个browser；已通过无变更不重复；资产不含未引用Demo；组件deps无需人工补安装；编辑正确性V01–V26满足相关合同。
- 工具目标：warm标准链路median降低至少25%，同时记录p95及stage breakdown；这是待验证目标，不是已实现承诺。未达到则按记录定位，不以砍必需验证“完成”目标。
- 端到端LLM生成耗时只做实测报告，首个可用预览、总交付、返工次数分开；不能在没有可比LLM样本时声称固定提速比例。
- 质量不可交换：编辑/导出错误未解不能因为更快宣告完成；预算WARN本身不触发无限视觉优化。

### 4.6 Compatibility / Risks / Rollback

- 旧createScene三参、registerFactory(function)、verify三CLI、数据分组结构保留适配。新增contract用于母版新生成项目；已有已生成项目不自动升级。
- 整表__visuals语义不改变；通过新patch入口解决误用，避免撤销恢复回归。
- 工具路径/源输出守卫覆盖Windows case/realpath；不使用git clean或覆盖用户非生成目录。
- GPU不可用不伪造性能；环境SKIP不伪造完整验收。功能单元尽量Node测，视觉/交互仍需browser或明确人工证据。
- 自动appearance支持范围先列全，超范围硬失败；不可把Runtime私有配置塞回业务JSON作为捷径。
- 存量测试若发现真正缺陷，先回写Spec再修；不得批量放宽断言。
- 各批次可独立回退，只回退本批次新增/修改；保留用户现有改动和原资产库。生成临时工程均隔离。

### 4.7 Spec Review Notes

| 检查 | 结论 | 依据 |
|---|---|---|
| 修改对象与边界 | PASS | 只skill/templates/scripts，既有仓库只读 |
| 速度与质量合同 | PASS | 可计时工具指标+V01–V26行为合同 |
| 编辑/运行保真 | PASS（设计层） | patch/full语义、lifecycle、自动appearance |
| 可执行性 | PASS（设计层） | 分批文件/签名/checklist |
| 兼容与风险 | PARTIAL | 新资源登记与export转换需实现后验证，已列回归 |

Readiness Verdict：GO（建议），不等于实施授权。不能把历史Plan Approved当作本轮优化Plan Approved。

## 5. Execute Log / Validation

### P3 四审修复轮（2026-10-15，P3-RRRR1 全修，待重审）

**改动文件**（在 P3 三审修复轮基础上）：

| 文件 | 修复项 | 内容 |
|---|---|---|
| `template/src/scene-core/resources.ts` | RRRR1 | ① `collectObjectResources` 增加节点边界参数 `isBoundary?: (obj) => boolean`：收集时**不深入**独立业务子节点子树（traverse 前序 + 跳过集合 + 父链过滤实现"跳过子树"语义）——子节点资源归各自登记，不记给父；未提供 isBoundary（独立 ResourceScope 测试）保持全树收集旧行为。② `syncObjectResources` 返回**受影响的后代业务子节点根**（父级编辑 traverse 全树可能递归替换子树内材质——子节点资源集也变了），由调用方逐个对账归属各自登记。③ `acquireObjectResources` 透传 isBoundary |
| `template/src/scene-core/engine/SceneEngine.ts` | RRRR1 | 新增公共 `syncResourcesFor(id, obj)`：以 `entries.get(o.name)?.obj === o` 判定业务节点边界 → 本节点对账（跳过子树）+ 受影响后代子节点逐个对账。三个动态入口（applyVisual 材质路径/replaceVisual/definition.update 原地）与 createNode 登记全部改走带边界的路径 |
| `template/src/scene-core/handlers/registry.ts` | RRRR1 | 异步挂载点对账改走 `sceneEngine.syncResourcesFor`（公共入口，带边界与受影响子节点同步） |
| `scripts/verify/p1-fixtures.mjs` | 回归 | +1 项四审场景精确计数用例；42 项既有全保留 |

**验证证据**（全部 2026-10-15 实跑）：

| 验证 | 命令/方式 | 结果 |
|---|---|---|
| 既有门禁 | `node scripts/verify/gates.mjs --quiet` | **84/84 PASS** |
| 全量回归 | `node scripts/verify/p1-fixtures.mjs --node-only` | **43/43 PASS**（42 全保留含 R1–R4/RR1/RR2/RRR1 全部反例 + 1 项 RRRR1 新增） |
| 类型/构建 | template 内 `npm run build` | PASS |
| run/edit 双态冒烟 | dev server + `scene.mjs --both` | SCENE PASS（首跑 mounted 超时=vite 冷启动预编译，预热后通过，与历轮偶发口径一致非回归；STRUCT PASS 同批确认） |
| 结构冒烟 | `smoke-structural.mjs` | STRUCT PASS |
| Lint | 改动 3 文件 eslint | **0 error** / 27 warning（既有类） |

**四审复现项对账**：

| Spec §6 复现 | 修复后行为 | 证据 |
|---|---|---|
| applyVisual('p',{color}) 后子 c 的新材质仅登记为父 p 所有；父 params 重建时子材质 dispose=1、退出登记（childStillUsesMaterial=true 但 materialTrackedAfter=false） | 边界收集：子树不归父登记；父编辑递归改子材质时受影响子节点各自对账——父重建后子的当前材质 dispose=0、仍在登记、子实例与材质引用均保留 | P3-RRRR1 用例（父编辑→父重建→子存活段） |
| remove/recreate/dispose 不得释放存活子节点仍持有的资源 | 删除子时其材质恰好 1 次；随后删除父/整体销毁零重复 | 同用例（删除/销毁段：remove c=1，remove p + dispose 无新增） |
| 不能只跳过后代导致漏登记 | syncObjectResources 返回受影响后代根，SceneEngine 逐个对账——子被父编辑改的材质归属子的登记 | 同用例（父编辑后 isTracked(childMat)=true） |

**既有回归保留确认**：RRR1 连续编辑/替换精确计数（旧材质立即释放不积累）、RR1 共享材质 refcount/父子整体销毁、RR2 缺 params 身份、R1–R4 全部反例——43/43 中全部通过。

**修复中实证发现**：three 的 `traverse` 无 skip 语义——边界跳过用「跳过集合 + 每节点沿父链检查」实现（前序遍历保证边界根先于其子节点访问）；recreateNode 的 createNode 时子实体尚未重挂（挂在 createNode 之后），但 createNode 的边界收集同样生效（无害且防未来时序变化）。

**未验证项（如实记录）**：

1. 与前三轮口径一致：GLB 状态视觉/异步挂载的浏览器实跑（代码路径覆盖 + 双态冒烟零回归）、GPU 长时观测未跑。
2. 深层嵌套（孙节点）的父编辑传播对账——syncResourcesFor 的受影响子节点对账会递归发现孙边界（isBoundary 对任意层级生效），但回归用例只覆盖两层；深层场景属 P6 编辑回归。

**Spec 偏差**：无。按四审要求「按引擎节点边界收集、区分工厂内部 mesh 与独立业务子节点、父编辑递归影响子时同步子自己的归属、remove/recreate/dispose 不释放存活子资源、补父编辑→父重建→子存活→删除/销毁精确计数」执行。

---

### P3 三审修复轮（2026-10-15，P3-RRR1 全修，待重审）

**改动文件**（在 P3 二审修复轮基础上）：

| 文件 | 修复项 | 内容 |
|---|---|---|
| `template/src/scene-core/resources.ts` | RRR1 | ① 新增 `syncObjectResources(scope, nodeId, obj)` 资源集对账：把节点登记同步成对象**当前**实际资源集——新资源 acquire、被替换旧独占资源经 `releaseExcept` 解除（无人引用即释放，不用重复 acquire 留住废弃资源）；共享资源 refcount 守护。② `ResourceScope.releaseExcept(nodeId, keep)`（keep 集合外的该 owner 登记解除，层级/refcount 结算同 release）。③ 收集口径重构：geometry 按 mesh 级 isClone 跳过（clone 不产新 geometry）；材质按**材质级 `isCloneResource` 标记**区分缓存共享（不登记）与节点私有（含被替换进 clone mesh 的新材质——登记）；`acquireObjectResources` 复用同一收集器 |
| `template/src/scene-core/engine/AssetEngine.ts` | RRR1 | ① `getInstance` 克隆时对 clone mesh 的每个材质打 `isCloneResource` 标记（材质级，与 mesh 级 isClone 互补——此后 applyState/applyVisualOverride 克隆替换的新材质可被资源域识别为节点私有）；② `applyState` 的材质克隆清除 `isCloneResource`（Material.clone 深拷 userData 会带上缓存标记） |
| `template/src/scene-core/materials.ts` | RRR1 | `applyVisualOverride` 的 `applyInlineMaterial` 与 `applyState` 两处材质克隆经 `claimPrivateMaterial` 清除 `isCloneResource`（同上——新克隆是节点私有资源） |
| `template/src/scene-core/engine/SceneEngine.ts` | RRR1 | 动态资源入口接对账：`applyVisual`（材质路径 full scope 后——开关路径不触发不改资源集，跳过省遍历）、`replaceVisual`（libraryRef↔inline 切换）、definition.update 原地路径（工厂可替换材质/几何）；rebuild/recreate 已由 createNode 全量登记覆盖 |
| `template/src/scene-core/handlers/registry.ts` | RRR1 | `makeAssetNodeFactory` 异步挂载点：`applyVisualIfAny` + `onLoaded`（applyState 等业务回调可克隆替换 clone mesh 材质）完成后 `syncObjectResources` 对账 |
| `scripts/verify/p1-fixtures.mjs` | 回归 | +2 项真实生产入口精确计数用例（见下）；40 项既有全保留 |

**验证证据**（全部 2026-10-15 实跑）：

| 验证 | 命令/方式 | 结果 |
|---|---|---|
| 既有门禁 | `node scripts/verify/gates.mjs --quiet` | **84/84 PASS** |
| 全量回归 | `node scripts/verify/p1-fixtures.mjs --node-only` | **42/42 PASS**（40 全保留含 R1–R4/RR1/RR2 全部反例 + 2 项 RRR1 新增） |
| 类型/构建 | template 内 `npm run build` | PASS |
| run/edit 双态冒烟 | dev server + `scene.mjs --both` | SCENE PASS |
| 结构冒烟 | `smoke-structural.mjs` | STRUCT PASS（13 节点全分组对齐——demo 场景 cars/examples 状态视觉路径零回归） |
| Lint | 改动 5 文件 eslint | **0 error** / 59 warning（既有类） |

**三审复现项对账**：

| Spec §6 复现 | 修复后行为 | 证据 |
|---|---|---|
| applyVisual('a',{color}) 后 isTracked(newMaterial)=false；remove+dispose 后新材质 dispose 事件=0（泄漏） | applyVisual 材质路径后 syncObjectResources——新材质登记、被替换旧材质立即 dispose=1；删除后当前材质恰好 1 次；整体销毁无重复 | P3-RRR1 continuous edits 用例 |
| 只在本反例末尾补 acquire 会积累被替换旧材质 | releaseExcept 解除 keep 集合外登记——连续两轮编辑，前一轮材质 dispose=1 不积累 | 同用例（edited1 在 edited2 出现后立即释放） |
| 覆盖工厂 update 与异步挂载这类动态资源入口 | definition.update 原地路径 + makeAssetNodeFactory 异步挂载点（onLoaded 后）均接对账 | 代码路径 + continuous/replaceVisual 用例 |
| 共享/缓存保持所有者边界 | 材质级 isCloneResource 标记：缓存共享不登记不释放（AssetEngine.dispose 负责）；claimPrivateMaterial 保证克隆为私有 | RR1 既有共享材质用例继续 PASS |

**新增回归明细**：

1. `P3-RRR1 continuous material edits`：真 SceneEngine——初始材质被改色替换后立即 dispose=1；连续第二轮编辑前一轮 dispose=1；纯开关（visible）不克隆材质；删除节点当前材质恰好 1 次；engine.dispose 后无重复（全程 initial=1/edited1=1/edited2=1）。
2. `P3-RRR1 replaceVisual swap and whole-dispose`：材质库切换入口（replaceVisual 整条替换）——新材质登记、旧材质立即释放；整体销毁全程恰好 2 次 dispose（替换旧 1 + 销毁当前 1）。

**修复中实证发现**：Material.clone 深拷 userData——缓存材质的 isCloneResource 标记会被 applyState/applyInlineMaterial 的克隆继承，导致私有新材质被误判缓存共享（不登记、泄漏复发）。三处克隆点（materials×2 + AssetEngine.applyState×1）统一清除标记后闭环。

**未验证项（如实记录）**：

1. 与前轮口径一致：example 浏览器运行时链路（GLB 状态视觉 applyState 的异步材质克隆已由挂载点对账代码路径覆盖 + demo 场景双态冒烟零回归）、GPU 长时观测未跑。
2. 材质库共享实例（MaterialLibService 的 libraryRef 材质）在真实编辑器的 link/dislink 往返——MaterialLibService 持有自己的实例表并 dispose（铁律 2 之外的既有语义，其实例未入 ResourceScope——由该服务自管理，与本轮节点域登记边界一致，未改动）；真编辑器链路 P6 回归。

**Spec 偏差**：无。按三审要求「资源域随材质/几何新增、替换、移除同步，覆盖 applyVisual/replaceVisual/工厂 update/异步挂载入口，不用重复 acquire 留住废弃资源，共享/缓存保持所有者边界」执行。

---

### P3 二审修复轮（2026-10-15，P3-RR1/RR2 全修，待重审）

**改动文件**（在 P3 首审修复轮基础上）：

| 文件 | 修复项 | 内容 |
|---|---|---|
| `template/src/scene-core/resources.ts` | RR1 重构 | 所有权登记改**实际资源粒度**：`OwnedResource = BufferGeometry \| Material \| Texture`，Object3D 根不再登记、删除树遍历释放路径（`disposeResource` 整体删除）——树遍历会绕过共享登记（两节点共用材质时任一根释放都整树 dispose 它，RR1 复现）。新增 `acquireObjectResources`（逐 mesh geometry/每个 material 登记，isClone 跳过保留）。`releaseAll` 遍历 Map 去重条目（同资源单 entry 恰好一次 dispose）；cache 层跳过（节点域不越权释放缓存根，AssetEngine.dispose 负责） |
| `template/src/scene-core/engine/SceneEngine.ts` | RR1/RR2 | ① `createNode` 改 `acquireObjectResources`（实际资源逐个 exclusive 登记）；② card 清除哨兵：`updateNodeInPlace` 合成 next 时 `incoming.card === null` 归一为 undefined（Bridge 快照恢复的显式清除语义） |
| `template/src/edit/Bridge.ts` | RR2 | `rebuild` 字段级差量：只在**引擎当前有值而快照缺省**时显式恢复默认（parentId→null/position,rotation→[0,0,0]/scale→1/params→{}/card→null 哨兵）；**两侧均缺省**的字段不带（undefined）——不再把缺省 params 强转 {} 触发 paramsEqual 判变、未变 legacy 节点被重建 |
| `scripts/verify/p1-fixtures.mjs` | 回归 | +2 项 RR1 真实引擎精确 dispose 计数 + 1 项 RR2 真 Bridge 身份回归；既有「recreate 释放」用例改实际资源粒度断言（Object3D 根不得登记） |

**验证证据**（全部 2026-10-15 实跑）：

| 验证 | 命令/方式 | 结果 |
|---|---|---|
| 既有门禁 | `node scripts/verify/gates.mjs --quiet` | **84/84 PASS** |
| 全量回归 | `node scripts/verify/p1-fixtures.mjs --node-only` | **40/40 PASS**（37 全保留 + 3 项新增；R1–R4 原始反例与真实 handler 用例全部继续通过） |
| 类型/构建 | template 内 `npm run build` | PASS |
| run/edit 双态冒烟 | dev server + `scene.mjs --both` | SCENE PASS |
| 结构冒烟 | `smoke-structural.mjs` | STRUCT PASS |
| Lint | 改动 3 文件 eslint | **0 error** / 46 warning（既有类） |

**二审复现项逐条对账**：

| Spec §6 复现 | 修复后行为 | 证据 |
|---|---|---|
| RR1：两节点共用 material（shared 登记两 owner），删第一个后 refCount=1 但 material 已 dispose；删第二个总 dispose=3 | 实际资源粒度：Object3D 根不登记不树遍历；删 a 后 matDisposes=0、refCount=1；删 b 后恰好 1 次 | P3-RR1 shared material 用例 |
| RR1：父子整体 engine.dispose 后子 geometry dispose 2 次 | releaseAll 遍历去重 Map 条目（子资源单 entry）——恰好 1 次 | P3-RR1 parent-child whole dispose 用例 |
| RR1：releaseAll 的父子重叠与共享资源旁路 | 树遍历释放路径物理删除；cache 层 releaseAll 跳过 | resources.ts 重构 + 两用例 |
| RR2：恢复完全相同 {id:'a'} 快照，缺省 params 被强转 {}，legacy 工厂重建（identityPreserved=false） | 两侧均缺省不带字段——undo 后 getObject('a') === objA、creates 不变、params 保持 undefined | P3-RR2 real Bridge 用例（含 redo/undo 往返稳定） |
| RR2：首次撤销无关操作也重建所有省略 params 的 legacy 节点 | 同上——无关节点零重建 | 同用例（只动 b，undo 后 a 的 creates 计数不变） |

**R4 已修复语义保留验证**：P3-R4 real Bridge 用例继续通过——引擎有值而快照缺省的字段（position=[9,0,0]/params={v:2}）undo 后仍显式恢复默认（字段级差量不清除该路径）。

**未验证项（如实记录）**：

1. 与首审修复轮口径一致：example 浏览器运行时链路、GPU 长时观测未跑（Node 生产函数级已覆盖全部 RR 合同）。
2. `card: null` 哨兵在**真实编辑器操作**中的触发路径（快照恢复撤销"首次添加卡片"）由引擎单路径 + Bridge 字段级差量代码审查覆盖；真 Bridge 测试未含 card 往返（卡片系统依赖 Vue 组件表，Node 门面不装配）——P6 编辑回归补。

**Spec 偏差**：无。RR1 按二审要求「实际资源粒度统一引用/所有权、remove/recreate/dispose 同一语义、cache 不越权」执行；RR2 按要求「区分未变节点与确需清除新增字段的节点、保留 R4 清理语义」执行。

---

### P3 首审修复轮（2026-10-15，P3-R1～R4 全修，待重审）

**改动文件**（在 P3 首轮基础上）：

| 文件 | 修复项 | 内容 |
|---|---|---|
| `template/src/scene-core/engine/SceneEngine.ts` | R1/R2/R3 | ① `updateNodeInPlace` 重构：进入即拍 previous 深快照（params/card 结构化拷贝，后续索引写入不污染）；next 按「缺的不动」合成完整节点（`stripUndefined` 合并——undefined 不覆盖原值）；definition.update 收到真实前后值；`entry.node = next` 整体换新（片段不丢字段）。② rebuild 两条路径（definition 返回 rebuild / legacy 兜底 / applyFragment 类型变化）全部喂**合成完整节点**——transform/card/父链不因片段只带 params 而丢失。③ `recreateNode`：子节点实体先 `removeFromParent` 脱离旧树再释放旧实例（dispose 遍历不再命中存活子节点）。④ `removeObject`：先整体摘树（全部 removeFromParent + 清 entries）再统一 ResourceScope.release（级联时父的整树遍历不再命中未摘下的子——双 dispose 消除）。⑤ 模块级 `disposeInstance` 删除——ResourceScope.disposeResource 成唯一释放路径（isClone 守卫语义等价保留） |
| `template/src/scene-core/handlers/example/example.ts` | R1 | definition.update 签名补 `previous`；assetId 结构参数比较改用 previous.params（旧实现从已覆盖的 getNode 取值恒等——永不触发 rebuild） |
| `template/src/edit/Bridge.ts` | R4 | `rebuild`（undo/redo 快照恢复）重写：快照是完整状态——节点缺 position/rotation/scale/card/params/parentId 的**显式恢复默认**（parentId→null、position/rotation→[0,0,0]、scale→1、params→{}、card→null），不再按片段「缺的不动」合并（撤销"首次添加 transform/params"不再残留）；完整节点喂回仍走 updateNodeInPlace（未变对象保实例身份）；`__visuals`/`__materialLib` 整表语义保留（快照缺 key 显式补空表） |
| `scripts/verify/p1-fixtures.mjs` | 回归 | 真实 handler 行为回归（见下）——替换/新增 6 项真生产模块用例 |

**验证证据**（全部 2026-10-15 实跑）：

| 验证 | 命令/方式 | 结果 |
|---|---|---|
| 既有门禁 | `node scripts/verify/gates.mjs --quiet` | **84/84 PASS** |
| P1/P2/P3 全回归 | `node scripts/verify/p1-fixtures.mjs --node-only` | **37/37 PASS**（首轮 20 既有 + P3 首轮用例全保留 + 6 项真实 handler 新用例；首轮假工厂 rebuild 用例删除，由真 tree 用例替代） |
| 类型/构建 | template 内 `npm run build` | PASS（0 错误） |
| run/edit 双态冒烟 | dev server + `scene.mjs --both` | SCENE PASS |
| 结构冒烟 | `smoke-structural.mjs` | STRUCT PASS（13 节点全分组对齐） |
| Lint | 改动 3 文件 eslint | **0 error** / 31 warning（既有类） |

**Review 复现项逐条对账**（全部真实生产模块直跑）：

| Spec §6 复现 | 修复后行为 | 证据 |
|---|---|---|
| R1：真 registerTreeHandler height 1→3，数据 3 但 geometry 仍 0.9 | previous 快照正确 → definition.update 判定变化 → rebuild，树干 geometry.parameters.height ×3（0.9→2.7） | P3-R1 real tree 用例 |
| R1：example assetId 从已更新 getNode 取旧值恒等 | assetId 比较 previous.params（修改前真值） | example.ts 代码路径 + tree 同构用例覆盖 |
| R2：节点带 position=[8,2,3]/scale=2/card，只发 params 重建后全丢 | next 合成完整节点——legacy/definition/类型变化三路径 transform/card/父链全保留（数据层 + 实例层双断言） | P3-R2 用例（legacy + 真 tree + 类型变化） |
| R3：父重建时存活子节点收到 dispose 事件 | 子实体先脱离旧树再释放——geoDisposes=0 | P3-R3 parent rebuild 用例 |
| R3：级联删除子 geometry dispose 2 次 | 先整体摘树再统一 release——恰好 1 次 | P3-R3 用例（级联 + 50 轮增删/rebuild 精确计数） |
| R4：undo 恢复 {id:'a'} 快照，新增的 position=[9,0,0]/params={v:2} 残留 | 快照缺省字段显式恢复默认——undo 后 position=[0,0,0]、params={}；redo 恢复；父链 undo 挂回原父 | P3-R4 real Bridge 用例（真 Bridge + 真 SceneEngine，handle 门面只接 Bridge 消费面） |

**修复中实证发现**：

1. removeObject 级联的双 dispose 不止 recreate 路径——级联删除时父 release 的整树遍历同样命中尚未摘下的子 mesh（父 release 在 removeFromParent 之前）；修复为「先整体摘树再统一释放」两阶段，P3-R3 用例的精确 dispose 计数（级联=1、50 轮增删=50、rebuild=+1）同时守护两条路径。
2. 测试断言形态：数据层 scale 保留原值形态（number 2 不转 [2,2,2]）——「缺的不动」合成对原值零改写；首轮测试断言写死数组形态属断言错误，非实现 bug（已修）。

**未验证项（如实记录）**：

1. 真 registerExampleHandler 的浏览器运行时行为（GLB 异步加载 + status/spin 更新链路）未在 Node 直跑——example 依赖 AssetEngine 网络加载；其 definition.update 的 previous 语义修复由 tree/rack 同构路径 + example.ts 代码审查覆盖；run/edit 双态冒烟（demo 场景含 examples/cars 分组）PASS 证明装配与加载无回归。
2. 浏览器内 undo/redo 快捷键链路（edit-main 键盘绑定 → bridge.undo）未逐键人工操作——真 Bridge.undo/redo 逻辑已 Node 直跑全覆盖（快照恢复/身份保留/父链往返/serialize 一致性）；键盘事件接线零改动。
3. GPU memory 长时观测（V14 完整形态）与 P3 首轮口径一致，属 P5/P6。

**Spec 偏差**：无。四项均按 §6 修复要求执行（完整 next/previous 语义、片段未提交字段保留、统一资源所有权释放、快照差量恢复 + 显式默认）；真实 handler/SceneEngine/Bridge 行为回归全部落地，无复制实现或恒返回值假工厂参与核心验收。

---

### P3 批次（2026-10-15 完成执行，待用户 review）

**改动文件**（均相对 `skills/generate-3d-scene/`）：

| 文件 | 状态 | 内容 |
|---|---|---|
| `template/src/scene-core/types.ts` | 修改 | P3.1 契约：`NodeFactoryDefinition`（create/update?/dispose?，update 返回 'updated'/'rebuild'）、`LegacyFactory`、`FactoryContext`、`paramsEqual`（JSON 业务值比较：键序无关/深比较/NaN 不等）；`UpdateStats` 扩 `rebuilt` 数组 |
| `template/src/scene-core/resources.ts` | 新增 | P3.2 资源所有权：`ResourceScope`（exclusive/shared/cache 三层；acquire 去重、release 按 refcount 结算、releaseAll 兜底）+ `getResourceScope`（每 SceneEngine WeakMap 隔离）；disposeResource 沿用 isClone 跳过守卫（GLB clone 不误释放缓存根资源） |
| `template/src/scene-core/engine/SceneEngine.ts` | 修改 | ① factory 登记改 `FactoryEntry`（definition/legacy 双形态；`registerFactoryContext` 显式 setter）；② `createNode` 工厂产物按 exclusive 登记 + definition.create 分发；③ `updateNodeInPlace` params 契约：同值幂等（不重放不重建）、definition.update → 'updated' 保实例 / 'rebuild' 局部重建（保 id/父链/子节点重挂/视觉层）、legacy 无 update → 局部重建兜底（消除"只存数据不更新模型"静默行为）；transform 永远引擎处理；④ `recreateNode`/`removeObject`：definition.dispose 先跑 → ResourceScope.release → disposeInstance（F07 recreate 泄漏关闭）；⑤ `patchVisual(nodeId, patch)` 公开 API（单节点 merge，整表 `__visuals` 语义不变）；⑥ `findDuplicateSlotKeys(nodeId)`（V13 同父层 slot 唯一性校验）；⑦ dispose 回收 `__handlerTeardowns`（handler 订阅/帧回调句柄）+ 资源域 releaseAll |
| `template/src/scene-core/engine/AssetEngine.ts` | 修改 | P3.2：`disposed` 标记——dispose 后新 getInstance 拒绝；加载完成时若已 dispose，结果遍历释放并丢弃（不回填已清空缓存，V05 迟到 Promise 守卫） |
| `template/src/scene-core/engine/EnvironmentEngine.ts` | 修改 | P3.4（F14/V16）：intensity-only 变化复用 currentEnv（不重新 fromScene）；关闭才释放；重开重建；RoomEnvironment 临时 scene 用后 dispose；`pmremFactory` 测试缝（生产恒真 PMREMGenerator） |
| `template/src/scene-core/handlers/example/example.ts` | 修改 | P3.1 迁移：typed definition（cars/examples 双分组；update：assetId 变化 rebuild、status/spin 原地重放）；单槽 `onNodeUpdated`/`onNodeRemoved` 赋值改 `subscribeNodeEvent` 多订阅（不覆写 P1 diagnostics 接线）；dispose 清 spinners；退订句柄挂 `__handlerTeardowns`；onFrame 参数签名改返回退订函数 |
| `template/src/scene-core/handlers/procedural/tree.ts` | 修改 | P3.1 迁移：typed definition（height 结构参数 rebuild；trunkColor/foliageColor 原地重放保实例） |
| `template/src/scene-core/handlers/procedural/rack.ts` | 修改 | P3.1 迁移：typed definition + 新结构参数 `rows`（1–12 仓段，rebuild）；bodyColor 原地重放（shell 材质共享实例单点改色）；slot 命名同父层唯一（server_N 系列） |
| `template/src/scene-core/createScene.ts` | 修改 | `registerFactoryContext` 在 profile 注册前调用（definition 工厂拿完整 context） |
| `template/src/scene-core/index.ts` | 修改 | 导出 `getResourceScope`/`ResourceScope`/`ResourceOwnership` |
| `template/src/scene-profile.ts` | 修改 | onFrame 注入改透传退订函数（`renderLoop.onFrame` 原样返回） |
| `template/src/edit/Bridge.ts` | 修改 | P3.3：① `duplicateObject` 副本视觉层走 `patchVisual`（不再 `update({__visuals})` 整表替换——F06 修复：复制不清其他节点视觉层）；② `rebuild`（undo/redo 恢复）改差量：remove 差量（快照外 id）+ upsert 差量（未变节点 paramsEqual 短路保实例身份；不再全树拆除重建，V10/V14）；`__visuals`/`__materialLib` 整表替换语义保留（undo 正确性锚点） |
| `template/src/edit/SelectionService.ts` | 修改 | P3.4：`syncHighlights` 幂等复用（同 key/target/color 不重建 BoxHelper；差量清理/新增——undo 恢复后选区不变时零分配） |
| `scripts/verify/p1-fixtures.mjs` | 修改 | +12 项 P3 行为回归（生产函数直跑：真 SceneEngine/ResourceScope/EnvironmentEngine/AssetEngine + TS 转译真 definition） |

**验证证据**（全部 2026-10-15 实跑）：

| 验证 | 命令/方式 | 结果 |
|---|---|---|
| 类型/构建 | template 内 `npm run build`（vue-tsc + vite） | PASS（0 错误；既有大 chunk warning 保留，boot-scene 816 kB 两态共享） |
| 既有门禁 | `node scripts/verify/gates.mjs --quiet` | **84/84 PASS**（零回归） |
| 既有 P1/P2 回归 | `node scripts/verify/p1-fixtures.mjs --node-only` | **20/20 全保留 PASS** |
| **P3 新增行为回归** | 同上（新 12 项） | **12/12 PASS**（合计 32/32） |
| run/edit 双态冒烟 | 模板 dev server + `scene.mjs --both` | SCENE PASS（双态 ready succeeded=4、零页面错误、主体进视锥、渲染活性） |
| 结构冒烟 | `smoke-structural.mjs` | STRUCT PASS（13 节点全分组对齐、零 rejection） |
| Lint | 改动 12 文件 eslint | **0 error** / 55 warning（均为既有类：函数长度/naming-convention `__visuals`/no-continue，与 P1/P2 历轮口径一致） |

**P3 行为回归用例明细**（p1-fixtures 直跑生产模块）：

| 用例 | 覆盖合同 |
|---|---|
| paramsEqual 键序无关/深比较/NaN | §4.2 params 按业务值比较 |
| typed factory 同值幂等 + 值变化走 update 保实例 | V07 |
| update 返回 rebuild → 局部重建保 id/children | V07（结构参数有限重建） |
| transform-only 保实例身份（creates=1） | V07（transform 不重建） |
| legacy function params 变化 → 重建兜底（非静默） | §1.3（不再"只存数据"） |
| recreate 释放 exclusive 旧实例 | V14（F07） |
| shared 资源单 owner 退出不释放/最后才释放 | V14（共享资源所有权） |
| 复制 A 不清 B/A 视觉层（patchVisual 语义） | V09（F06） |
| EnvironmentEngine intensity-only 复用纹理 | V16（F14） |
| AssetEngine disposed 拒绝迟到回填/新加载 | V05 |
| findDuplicateSlotKeys 同父层重名检出/跨父层合法 | V13 |
| undo 差量恢复未变节点保实例身份 | V10/V14（F13） |

**实现过程中的实证发现（均已修正）**：

1. 首版 `updateNodeInPlace` 的 'rebuild' 返回路径只 push stats 没调 `recreateNode`（definition.update 返回 rebuild 时不重建）——P3 用例「update returns rebuild」首跑 FAIL 暴露，修复为返回前显式 `recreateNode` + emit updated。
2. ESM 模块命名空间只读，`THREE.PMREMGenerator` 不可 monkey-patch——环境测试改 `pmremFactory` 注入缝（生产默认真 PMREMGenerator，行为不变）。
3. example.ts 的 onFrame 注入原先 `void renderLoop.onFrame(...)` 丢弃退订函数——P3.4 订阅清理要求句柄可达，签名改为透传 `() => void`（scene-profile 同步修正）。

**未验证项（如实记录）**：

1. **浏览器内编辑交互链路**（点选/Gizmo 拖拽/Ctrl+D 复制/undo 快捷键/材质面板往返）未逐项人工操作——生产函数级已验证各契约核心（patchVisual/差量恢复/helper 复用/definition update）；run/edit 双态 + 结构冒烟 PASS 证明装配与建树零回归。浏览器交互级验收属 P6（V09–V12 完整编辑回归）。
2. **100 次增删/重建/撤销的 GPU memory 观测**（V14 后半）未跑——Node 级资源登记/释放对账已过；GPU 侧无界增长需真机长时间采样，与 P5/P6 一并。
3. **蒙皮模型（person GLB）编辑往返**（V12 蒙皮 clone 尺寸）未单独复测——AssetEngine 的 skinnedClone 路径零改动（本轮只加 disposed 守卫）；蒙皮感知包围盒（getSkinnedAwareBox/refreshSkinnedBounds）零改动，结构冒烟 13 节点含 person 实例渲染正常。
4. car/worker 两个 procedural handler 未迁移 typed definition（保持旧 function——params 变化走重建兜底，行为等价旧版且不回归）；迁移示范由 tree/rack/example 三个覆盖，属可选项非合同要求（§4.1 P3 行「示范typed params/update」已满足）。
5. `smoke-visual`/`perf-fps` 未重跑（P3 无视觉输出/GPU 预算改动；渲染管线只加复用优化，triangles/fps 冒烟在 scene.mjs 已覆盖活性判定）。

**Spec 偏差**：

- §4.2 `NodeFactoryDefinition<TParams>` 泛型参数实施时简化为非泛型（`TParams extends Record<string, unknown>` 无运行时作用且 example.ts 内联类型自持——params 的 typed 约束在 handler 文件内以局部 interface 表达，tree.ts/rack.ts 同）；公开签名 `create/update/dispose` 三段契约与返回语义与 Spec 一致。
- §3.2「组件为 Group/InstancedMesh 时适配层提供稳定唯一路径」的**生成侧断言**以 `findDuplicateSlotKeys` API 形态提供（引擎能力）；将其接入 build.mjs 生成合同（重名负例阻断新代码模型）属 P5/P6 的 build 合同批次（§4.1 P5 行 build.mjs 修改）。
- 其余按 §4.1 P3 文件清单与 §4.2 签名合同执行；PropertyPanel/LayoutGizmo/OutlineTree/EditMaterialModal 未改（其 applyVisual 调用本就是单节点 merge 语义，与新 patchVisual 契约一致，无需迁移）。

---

### P2 四审修复轮（2026-10-14，P2-RRR2 注释词法，待重审）

**改动文件**（在 P2 三审修复轮基础上）：

| 文件 | 修复项 | 内容 |
|---|---|---|
| `scripts/lib/scene-schema.mjs` | RRR2 重构 | 手写词法扫描器（extractTopLevelKeys 状态机 + 外层配平扫描，共 ~170 行）**整体删除**，替换为 **TypeScript AST 提取**（按四审建议采用成熟词法器）：惰性加载模板 `node_modules/typescript`（vue-tsc 构建链既有硬依赖，零新增依赖；`createRequire` 以本模块为锚定位 skill 模板，与运行 cwd 无关），`ts.createSourceFile` → 定位 `BUSINESS_REGISTRARS` 的 VariableStatement → `ObjectLiteralExpression` 顶层 `PropertyAssignment` 的 name 提取。注释/字符串/嵌套由成熟词法器天然正确；声明缺失、顶层成员非 key:value、key 形态不支持均明确抛错（不静默返回残缺集合） |
| `scripts/verify/gates.mjs` | 用例 | +3 项四审复现用例（行注释含 `}` 后续 key 保留 / 块注释含 `{` 前缀 / 函数体内行注释含 `}`） |

**验证证据**（全部 2026-10-14 实跑）：

| 验证 | 命令/方式 | 结果 |
|---|---|---|
| 既有门禁 | `node scripts/verify/gates.mjs --quiet` | **84/84 PASS**（81 项全保留 + 3 项四审注释用例） |
| P1/P2 生产函数回归 | `node scripts/verify/p1-fixtures.mjs --node-only` | **20/20 PASS** |
| **四审复现①** | `trees: f, // }` 后有 `crates: g` | 提取 `[trees, crates]`（旧手写扫描器被注释内 `}` 截断，只返回 trees——静默遗漏） |
| **四审复现②** | `/* { */ trees: f` | 提取 `[trees]`（旧实现抛「花括号未闭合」——合法对象被拒） |
| **四审复现③** | 函数体内 `// }` 后续顶层 crates | 提取 `[crates]`（旧实现值扫描截断） |
| 既有形态回归 | 单行多 key/嵌套对象/注释假 key/字符串假 key/引号 key/尾逗号/空对象/缺失/文档注释提及 | 13/13 全过（AST 版与三审手写版全部既有行为一致） |
| TS 加载锚定 | 从仓库外 cwd（`D:/cyc/project/octo/gts/test`）跑 build.mjs | PASS——getTs 以 `import.meta.dirname` 定位 skill 模板 typescript，与运行 cwd 无关 |
| 类型/lint/构建 | template 内 vue-tsc / eslint scene-profile / npm run build | 0 错误 / 0 error 0 warning / PASS（本轮无模板改动，确认无回归） |
| run/edit 回归 | 模板 dev server + scene.mjs --both | SCENE PASS |

**Review 复现项逐条对账**：

| Spec §6 复现 | 修复后行为 | 证据 |
|---|---|---|
| `trees: f, // }` 后 `crates: g` 只返回 trees | AST 词法器识别注释，crates 不丢 | 四审复现① |
| `/* { */ trees: f` 抛「花括号未闭合」 | 块注释被词法器跳过，正常提取 | 四审复现② |
| 函数体中 `// }` 导致后续顶层 crates 丢失 | 值扫描走 AST 节点边界，注释无效 | 四审复现③ |

**未验证项（如实记录）**：

1. AST 提取对**语法错误源码**的行为：ts.createSourceFile 非严格模式不抛语法错（产残缺 AST）——但定位不到合规 ObjectLiteralExpression 时走「缺登记表」抛错路径；顶层成员形态异常（SpreadElement/MethodSignature 等）有显式抛错分支。极端畸形源码（半截对象但语法可解析）理论上仍可能产残缺集合——登记表是模板自有文件（非用户输入），风险受控。
2. typescript 模块体积加载开销（~70ms 首次）：gates 全量 84 项耗时无感（AST 版比手写版慢的部分被门禁整体吸收）；build.mjs 每次 checkProject 调一次提取，实测无影响。
3. 未重跑浏览器负例矩阵/GPU/组件安装（与历轮口径一致；本轮无模板与运行时改动——scene-schema 只被 build/init/gates 消费）。

**Spec 偏差**：无。按 §6 四审「优先成熟 TypeScript AST/词法器」要求执行；scene-schema 从「零依赖可测」调整为依赖模板 node_modules 的 typescript（既有硬依赖，init --deps 前提已保证存在，加载失败明确抛错）——该文件头注释的「零依赖」描述已随实现更新。

---

### P2 三审修复轮（2026-10-14，P2-RRR1/RRR2 全修，待重审）

**改动文件**（在 P2 二审修复轮基础上）：

| 文件 | 修复项 | 内容 |
|---|---|---|
| `template/src/scene-profile.ts` | RRR1 | registerBusinessFactories 在全部 registrar 执行**后**逐项 `ctx.sceneEngine.hasFactory(type)` 后置校验：空实现（执行了但没注册任何工厂）与注册错名（注册了别的 type）都在装配期抛错，错误信息精确列出违规分组名；保留同函数去重调用（一实现多 type）与「不可调用实现」前置检查 |
| `scripts/lib/scene-schema.mjs` | RRR2 | 行首正则 key 提取**删除**，替换为 `extractTopLevelKeys` 状态机：只在登记对象本体深度 0 且「期待 key」位置（起始/逗号后）识别 key——单行多 key 全提取；值内嵌套对象/函数体的 key（`const defaults = { ghost: 1 }` 的 ghost）不上浮；字符串里的假 key、行注释/块注释里的 key 不提取；引号 key（含空格分组名）支持；括号/引号不配平与非法形态明确抛错 |
| `scripts/verify/gates.mjs` | 用例 | +6 项 RRR2 提取器形态用例（单行多 key / 嵌套对象 / 注释 / 字符串假 key / 引号 key / 尾逗号） |
| `scripts/verify/p1-fixtures.mjs` | 用例 + 加载器 | +2 项 RRR1 生产运行时用例（真 scene-profile TS 转译直跑 + 真 SceneEngine：登记表全量注册正例；空实现/注册错名抛错 + 复原正例）；registerHooks 扩展目录导入（`./scene-core` → index.ts）、`@/` 别名解析、`.vue` SFC stub（Node 不解析 SFC，注册链路只关心模块图） |

**验证证据**（全部 2026-10-14 实跑）：

| 验证 | 命令/方式 | 结果 |
|---|---|---|
| 既有门禁 | `node scripts/verify/gates.mjs --quiet` | **81/81 PASS**（75 项全保留 + 6 项 RRR2 形态用例） |
| P1/P2 生产函数回归 | `node scripts/verify/p1-fixtures.mjs --node-only` | **20/20 PASS**（18 项全保留 + 2 项 RRR1 运行时用例） |
| **RRR1 正例** | p1-fixtures：真 registerBusinessFactories（TS 转译生产模块）+ 真 SceneEngine | 6 分组 hasFactory 全命中 |
| **RRR1 负例①** | 同上注入 `robots: () => {}` 空实现 | 抛错 `…未登记工厂（空实现或注册错名）：robots`（review 复现：旧实现不抛） |
| **RRR1 负例②** | 同上注入 `wrongname` 注册别的 type | 抛错精确列 wrongname |
| **RRR1 复原** | 负例注入后 delete 恢复真实表 | 全量注册正常（注入不留污染） |
| **RRR2 用例①** | 单行 `{ trees: f, crates: g }` | 提取 `[trees, crates]`（review 复现：旧行正则只提 trees） |
| **RRR2 用例②** | 值内 `const defaults = { ghost: 1 }` | 只提取 `[crates]`，ghost 不上浮（review 复现：旧行正则把 ghost 当工厂） |
| **RRR2 用例③④** | 行注释/块注释/字符串假 key | 全部不提取 |
| **RRR2 用例⑤⑥** | 引号 key `'my type'` / 尾逗号 | 正确提取/容错 |
| RRR2 真实 profile | gates 断言 | 6 分组全量提取不变 |
| 类型/lint/构建 | template 内 vue-tsc / eslint scene-profile / npm run build | 0 错误 / **0 error 0 warning** / PASS |
| run/edit 回归 | 模板 dev server + scene.mjs --both | SCENE PASS（后置校验零行为回归——真实登记表注册后全部命中） |
| RR2/RR3 保留项 | gates 75 项含 RR2 空表正例与 RR3 URI 用例 | 全部继续 PASS |

**Review 复现项逐条对账**：

| Spec §6 复现 | 修复后行为 | 证据 |
|---|---|---|
| `robots: () => {}` 空实现 checkProject.ok=true | 运行时装配期抛错（后置 hasFactory 校验），错误列 robots | RRR1 负例① |
| 单行 `{ trees: registerTreeHandler, crates: registerCrates }` 仅提取 trees | 两个顶层 key 全提取 | RRR2 用例① |
| 函数体 `const defaults = { ghost: 1 }` 的 ghost 被误当工厂 | 深度感知提取，ghost 不上浮 | RRR2 用例② |

**未验证项（如实记录）**：

1. RRR1 的后置校验在**浏览器运行时**（真实 dev/prod 页面装配路径）未单独跑——生产函数级（TS 转译直跑 registerBusinessFactories + 真 SceneEngine）已验证抛错路径；run/edit 浏览器回归 PASS 证明正例装配不受影响。负例在浏览器中的表现（页面白屏 + console error）属预期装配失败行为，未逐帧观测。
2. extractTopLevelKeys 对**极端形态**（正则字面量含 `{`、模板串内插值嵌套）未穷举——登记表的值形态约定为函数引用/箭头函数，超范围形态会走「非法字符/未闭合」抛错路径而非静默错提，风险受控。
3. 未重跑 GPU/组件安装/完整浏览器负例矩阵（与历轮口径一致）。

**Spec 偏差**：无。RRR1/RRR2 按 §6 三审验收要求执行；后置校验只读 sceneEngine.hasFactory（P1.2 已有公开方法），未新增引擎 API。

---

### P2 二审修复轮（2026-10-14，P2-RR1–RR3 全修，待重审）

**改动文件**（在 P2 修复轮基础上）：

| 文件 | 修复项 | 内容 |
|---|---|---|
| `template/src/scene-profile.ts` | 重构（RR1） | BUSINESS_FACTORY_TYPES 名称数组**删除**（两份信息的问题根源）；改为 `BUSINESS_REGISTRARS: Record<type, (ctx) => void>` 登记表（type → 注册实现，唯一来源）；`registerBusinessFactories` **遍历登记表**逐项注册（同一实现去重只调一次——一实现可登记多 type），缺实现/不可调用装配期抛错；BUSINESS_FACTORY_TYPES 保留为从登记表派生的只读导出（兼容消费方） |
| `scripts/lib/scene-schema.mjs` | 重构（RR1/RR2） | extractBusinessFactoryTypes 改从 `BUSINESS_REGISTRARS` 对象字面量提取 key（与运行时注册遍历同一结构）：花括号配平扫描（值可能含解构参数箭头函数 `({ x }) => …`，内部 {} 使正则懒匹配截断——实证发现）；允许**空对象**（纯内建工程合法，P2-RR2）；仅对象缺失/未闭合/形态坏抛错；注释里的同名提及不再误匹配（锚定 `const` 声明） |
| `scripts/build.mjs` | 修改（RR3） | checkGltfClosure 的 URI 解析按规则处理：百分号编码**解码后**再定位磁盘文件（`data%20mesh.bin` → `data mesh.bin`，与浏览器 fetch/GLTFLoader 行为一致）；非 file: 协议 URI 报不支持；解码后仍做目录边界检查（`..%2F` 越界 FAIL）；孤立的非法编码序列按原样处理（fetch 也不解码它） |

**验证证据**（全部 2026-10-14 实跑）：

| 验证 | 命令/方式 | 结果 |
|---|---|---|
| 既有门禁 | `node scripts/verify/gates.mjs --quiet` | **75/75 PASS**（新增 8 项 RR1/RR2/RR3 正负例） |
| P1 零回归 | `node scripts/verify/p1-fixtures.mjs --node-only` | **18/18 PASS** |
| 类型/构建/lint | template 内 vue-tsc / npm run build / eslint scene-profile | 0 错误 / PASS / **0 error 0 warning** |
| **RR1 负例①** | 实跑：init demo 工程 → 删 `trees: …registerTreeHandler…` 登记条目（scene-data 仍用 trees）→ build | `[build/FAIL]` 报 `unknown-factory trees`（review 复现的旧缺口：此处曾 PASS） |
| **RR1 负例②** | scene-data 加 robots 分组（登记表无）→ build | `[build/FAIL]` 报 `unknown-factory robots` |
| **RR1 正例** | 登记表加 `crates` 条目+注册实现+scene-data 加 crates → build | `[build/PASS]`（真实新增 factory 全链路） |
| **RR1 提取器** | gates 断言：真实 profile 提取 = 6 分组全量 | `["examples","cars","trees","codecars","codeworkers","coderacks"]` |
| **RR2 正例** | 实跑：init 空工程 → 登记表清空为 `{}`（场景纯 Box/内建）→ build | `[build/PASS]`（review 复现的旧缺口：此处曾抛「为空数组不能为空」） |
| **RR2 三态** | 提取器对空对象/缺失/注释提及 | 空对象 → `[]`（合法）；缺失/注释提及/未闭合 → 抛错 |
| **RR3 build 侧** | fixture：glTF 声明 `data%20mesh.bin` + `%E8%B4%B4%20%E5%9B%BE.png`（磁盘文件 `data mesh.bin` + `贴 图.png`）→ init → build | init ok（目录闭包复制）+ `[build/PASS]`（review 复现的旧缺口：此处曾报「文件不存在」） |
| **RR3 THREE 对照** | 同 fixture 工程起 dev server → scene.mjs | run SCENE PASS：ready succeeded=1、tris=26（glTF mesh 真实渲染）、零页面错误——build 与 THREE 加载结论一致 |
| **RR3 边界负例** | URI 改 `..%2F..%2Fescape.bin` → build | `[build/FAIL]`（解码后越界仍被边界检查拦截） |
| run/edit 回归 | 模板 dev server + scene.mjs --both | SCENE PASS（注册循环重构零行为回归） |

**Review 复现项逐条对账**：

| Spec §6 复现 | 修复后行为 | 证据 |
|---|---|---|
| 删 registerTreeHandler 调用保留 trees 名称，build.ok=true | 登记表条目即注册来源，删条目 = trees 无工厂 → unknown-factory 硬 FAIL | RR1 负例① |
| 只加 robots 名称不注册，build.ok=true | robots 不在登记表 → unknown-factory 硬 FAIL | RR1 负例② |
| BUSINESS_FACTORY_TYPES=[] 抛错，纯内建工程被拒 | 空登记表合法（提取器返回空表），纯 Box 工程 build PASS | RR2 正例 |
| data%20mesh.bin 对应 data mesh.bin，THREE 加载成功但 build 报缺文件 | URI 解码后定位，build PASS，与 THREE 加载结论一致 | RR3 双侧对照 |
| 目录边界（..%2F 越界） | 解码后边界检查保留，越界 FAIL | RR3 边界负例 |

**修复中实证发现**：

1. 正则懒匹配 `\{([\s\S]*?)[\r\n]?\}` 在登记表值含解构参数箭头函数（`({ sceneEngine }) => …`）时在参数闭括号处截断——提取只拿到前 3 个分组。改花括号配平扫描（字符串感知）后全量提取。
2. 文档注释里提及 `BUSINESS_REGISTRARS` 字样会被非锚定正则误匹配（取到 JSDoc/import 的花括号体）——提取器锚定 `const` 声明语句。
3. 一个注册实现登记多个 type 时，注册循环必须去重调用（registerExampleHandler 内部建 spinners 闭包表与 onFrame 回调，重复调用会双份挂载）。

**未验证项（如实记录）**：

1. RR3 的 THREE 对照在 dev server（vite）下验证；production 静态服务器下同一 fixture 未重跑（上轮已证 prod 下 vite preview 同样回落 200，结论不受影响；本轮改动只影响 build 静态校验的路径解码，不改变运行时加载行为）。
2. 未重跑组件安装（R2 上轮已实跑 installed+lock 实证，本轮无相关改动；review 也确认 R2 代码审查通过）。
3. 未重跑完整浏览器编辑态交互/GPU perf（与历轮口径一致，属 P3/P5）。

**Spec 偏差**：无。RR1–RR3 按 §6 二审验收要求执行；BUSINESS_REGISTRARS 结构是 §3.2「公共 profile/注册 manifest」的实现细化（type → 注册函数映射），§4.2 的 registerFactory 公开签名未变。

---

### P2 Review 修复轮（2026-10-14，P2-R1–R4 全修，待重审）

**改动文件**（在 P2 首轮基础上）：

| 文件 | 修复项 | 内容 |
|---|---|---|
| `template/src/scene-core/asset-manifest.ts` | 新增（R1） | 运行时资产映射：loadAssetManifest（fetch public/assets/asset-manifest.json，失败回退 legacy）+ makeAssetUrlResolver（命中映射用真实路径，未命中回退 `assets/models/<id>.glb` 猜测——旧工程兼容）+ resetAssetManifestCache |
| `template/public/assets/asset-manifest.json` | 新增（R1） | 母版资产映射（example/person → models/*.glb）——母版自身也走映射，不再猜路径 |
| `template/src/boot-scene.ts` | 修改（R1） | 建树前 loadAssetManifest（映射先于一切工厂装配） |
| `template/src/scene-core/createScene.ts` | 修改（R1） | registerBuiltinFactories 传 makeAssetUrlResolver()（内建 asset 工厂走映射） |
| `template/src/scene-core/handlers/example/example.ts` | 修改（R1） | 硬编码 `assets/models/<id>.glb` 删除，改用共享 resolver |
| `template/src/scene-core/index.ts` | 修改（R1） | 导出 loadAssetManifest/makeAssetUrlResolver/resetAssetManifestCache 及类型 |
| `template/src/scene-profile.ts` | 修改（R3） | 新增 `BUSINESS_FACTORY_TYPES` 登记表（业务分组唯一来源：注册与校验共用）；profile 源码即校验输入，不维护第二份镜像 |
| `scripts/lib/scene-schema.mjs` | 修改（R3/R4） | ① extractBusinessFactoryTypes（从 scene-profile.ts 源码正则提取登记表，形态异常抛错不静默放行）+ factoryRegistryFromProfile（内建图元+asset+业务分组）；删除 TEMPLATE_FACTORY_TYPES 硬编码镜像；② zero-scale 规则扩展向量形态（任一轴 0 = 退化矩阵，`[1,0,1]` 不再漏过）；③ 新增 missing-asset-id 规则（内建 asset 分组节点缺 params.assetId → 只建空 Group 无失败记录，硬失败） |
| `scripts/init.mjs` | 修改（R1/R2/R3） | ① 资产注入后落 `public/assets/asset-manifest.json`（id → {model: 真实相对路径, format, textures}；母版残留且被引用的资产也进映射）；② schema 校验的工厂表改从模板 scene-profile.ts 提取（单一来源）；③ `--deps copy` + `--with-components`：拷 node_modules 后**真跑 npm install 装所选 tgz 并同步 lock**，验证 installed + lock 根依赖，失败/缺失升级为 errors（不再假绿）；`--deps install` + components 也验证落盘；④ 新增 assetsRoot 测试缝（gates 假资产库 e2e 用，生产恒 SKILL_ROOT） |
| `scripts/build.mjs` | 修改（R1/R3） | ① 资产文件解析改走 asset-manifest.json（manifest 优先，旧工程回退 legacy 猜测）；② 新增 glTF 闭包校验：.gltf 声明的外部 buffers[].uri / images[].uri（非 data:）逐个验存在 + 路径不出工程根，缺失 = errors 硬失败；③ schema 校验传工厂表（从工程自身 src/scene-profile.ts 提取；旧工程无该文件则只做通用结构校验）——unknown-factory 从预算告警升级硬失败 |
| `scripts/verify/gates.mjs` | 修改 | 59→67 用例：schema 负例补向量零分量/内建 asset 缺 assetId；生产入口 build 负例 ×3（robots 未注册分组/asset 缺 assetId/[1,0,1] 退化缩放均硬 FAIL）；glTF e2e（假资产库 init --scene → asset-manifest.json 落盘断言 → build PASS → 抽掉 data.bin → build 闭包校验 FAIL） |
| `scripts/verify/p1-fixtures.mjs` | 修改（R1） | 新增运行时负例：真 AssetEngine + 不可达 URL（glTF bin 404 等价）→ whenReady 拒绝 + failedAssets 记录 nodeId@assetId（生产函数链路） |
| `template/public/__p1_probe_b2_v2.html` | 删除 | P1 遗留探针页残留在母版 public/（esbuild 依赖扫描报错阻断 e2e dev server），实证发现后删除 |

**验证证据**（全部 2026-10-14 实跑）：

| 验证 | 命令/方式 | 结果 |
|---|---|---|
| 既有门禁 | `node scripts/verify/gates.mjs --quiet` | **67/67 PASS**（含 R1–R4 新增 8 项生产入口正负例） |
| P1 零回归 | `node scripts/verify/p1-fixtures.mjs --node-only` | **18/18 PASS**（含新 P2-R1 运行时负例） |
| 类型检查 | template 内 `npx vue-tsc --noEmit` | 0 错误 |
| 生产构建 | template 内 `npm run build` | PASS（既有大 chunk warning 保留） |
| Lint | 改动文件 eslint | 0 error（4 warning 均为既有函数长度类） |
| **R1 init→build 静态链路** | gates glTF e2e（假库 .gltf+.bin+tex.png） | init 落 manifest（model=models/multifile_gltf/model.gltf）→ build PASS → 抽 data.bin → build FAIL 报「glTF 外部依赖缺失：…data.bin」 |
| **R1 运行时正例（THREE 真实消费）** | 手动 e2e：init --scene（假库三方可消费 fixture：合法 1×1 PNG + 真 bin）→ npm run build → vite preview → scene.mjs | run SCENE PASS：ready succeeded=1（glTF 多文件资产经 manifest resolver 真实加载）、data.bin/tex.png 被浏览器 THREE 消费、零页面错误、主体可见。**假 PNG 头时 THREE 报「Couldn't load texture tex.png」被 errors 检查捕获**——贴图闭包真实贯通 |
| **R1 运行时负例** | p1-fixtures 新用例（真 AssetEngine + ECONNREFUSED URL） | whenReady 拒绝（`场景加载失败: multifile_gltf@mf_01（fetch failed）`）+ failedAssets=[{nodeId:mf_01, assetId:multifile_gltf}] |
| **R2 组件安装** | `initProject(out,{withComponents:true,deps:'copy'})` 实跑 | ok=true；**installed=true**（node_modules/@a3d/a3d-components 落盘）；**lockRootDep=file:./vendor/a3d-a3d-components-0.1.0.tgz**（lock 根依赖同步）；npm run build PASS |
| **R2 组件真实解析** | 安装后工程内 `require.resolve('@a3d/a3d-components')` | resolve 到 dist/cjs/index.cjs；@a3d/a3d-components@0.1.0；exports 12 个子路径（./core/heat/material/utils/graph/controls/camera/interactive/helper/animation/docs） |
| **R2 组件真实构建消费** | main.ts 加 `import '@a3d/a3d-components/heat'` 后 npm run build | PASS——组件代码进构建产物（不再空场景假绿） |
| **R3 生产入口** | gates 3 用例（robots 分组注入 scene-data 后跑 build） | `[build/FAIL]` + 「场景 schema 违规 [unknown-factory]」——旧实现此处 ok=true 仅预算告警 |
| **R4 生产入口** | gates 2 用例（asset 分组缺 assetId / Box[0].scale=[1,0,1] 后跑 build） | 均硬 FAIL（missing-asset-id / zero-scale）——旧实现 ok=true |
| run/edit 回归 | 模板 dev server + scene.mjs --both | SCENE PASS（双态 ready succeeded=4、零错误） |

**Review 复现项逐条对账**：

| Spec §6 复现 | 修复后行为 | 证据 |
|---|---|---|
| glTF 多文件 build 误报缺文件（build.mjs 只猜 models/id.gltf） | build 走 asset-manifest.json 真实路径，目录资产命中 | gates glTF e2e build PASS |
| 运行时请求错地址（runtimePath=assets/models/test.glb） | resolver 命中映射请求 assets/models/test/model.gltf；THREE 真实加载成功 | 运行时正例 ready succeeded=1 |
| glTF 声明缺失 bin 仍被 resolver 判 ok | init 侧：resolveAsset 展开目录闭包复制全文件；build 侧：外部 URI 逐个验存在，缺失硬 FAIL | gates e2e 抽 bin → build FAIL；asset-catalog 闭包展开用例 |
| copy 模式组件未安装、lock 缺失但 ok=true | npm install 真装 + installed/lockRootDep 双验证，缺失升级 errors | R2 实跑 installed=true + lock 同步 |
| 未注册 robots 分组 build ok=true 仅预算告警 | 工厂表从工程 scene-profile.ts 提取（单一来源），unknown-factory 硬 FAIL | gates R3 用例 |
| schema 漏检 scale:[1,0,1] | 向量任一轴 0 → zero-scale 硬失败 | gates R4 用例 |
| schema 漏检 asset:[{id}] 缺 assetId | missing-asset-id 硬失败 | gates R4 用例 |

**修复中实证发现**：

1. **vite dev 对 public 缺失文件回落 index.html 200**（P1 B5 已知行为的延伸）：删 data.bin 后 dev server 下 GLTFLoader 拿 HTML bytes 当 bin 解析**不抛错**（componentType 按偏移读乱值产出乱 mesh）→ ready 假 succeeded=1。这是 dev server 环境行为，production/真静态服务器下是 404 → 抛错 → failed。因此运行时负例的权威验证用「真 AssetEngine + 不可达 URL」生产函数直跑（p1-fixtures 新用例），不以 dev server 假成功为修复目标。
2. **prod 包无 `window.__gts3d`**（import.meta.env.DEV 才挂）——scene.mjs 的 mounted 检查对 production preview 天然 FAIL，不是回归；生产包验证用资源 404 网络观测（netMisses 捕获 data.bin 404）。
3. 母版 public/ 残留 `__p1_probe_b2_v2.html`（P1 探针页）被 vite 依赖扫描当入口分析，esbuild 语法报错阻断 dev server——删除（P1 工件本不该进母版 public）。
4. mock assetEngine 上 installDiagnostics 会拿到独立 tracker 而 makeAssetNodeFactory 查的是 assetEngine 实例上的 tracker——复现时必须用真 AssetEngine 才走生产接线（写进 p1-fixtures 用例注释语义）。

**未验证项（如实记录）**：

1. **edit 态对 glTF 多文件资产的完整编辑交互**（槽位选择/材质编辑往返）未跑——本轮验证到 run 态 ready/加载/渲染层；编辑器对 glTF 目录资产的深度交互属 P3 编辑批次回归范围。
2. R2 的 `--deps install` 模式（走内网 registry）未实跑（本轮环境用 copy 模式验证安装与 lock 同步逻辑，install 路径共享同一验证代码）。
3. 组件在**浏览器运行时**的渲染正确性未验证（构建消费 + 模块解析已证，运行时视觉属生成侧使用场景）。
4. 未重跑完整 GPU/perf 回归（swiftshader 下非真机 GPU 数据无对照价值，与 P1/P2 轮口径一致）。

**Spec 偏差**：无。R1–R4 按 §6 验收要求执行；asset-manifest.json 形态（id→{model,format,textures}）属 §4.2 resolveAsset 契约的实现细化，公开语义「统一 modelPath/dependencies/textures/states」保持。

---

### P2 批次（2026-10-14 完成执行，待用户 review）

**改动文件**（均相对 `skills/generate-3d-scene/`）：

| 文件 | 状态 | 内容 |
|---|---|---|
| `template/src/scene-profile.ts` | 新增 | 业务装配单一入口：registerBusinessFactories（context 对象签名）+ cardComponents 注册表；run/edit 共用 |
| `template/src/boot-scene.ts` | 新增 | 共用业务装配：fetch scene-data + canvas 创建 + createScene（profile 注入）；两态只差 DOM 壳 |
| `template/src/entry.ts` | 新增 | index.html 固定入口：?edit=1 静态分支 import edit-main/main（入口识别不再靠内联 script 正则） |
| `template/src/main.ts` | 修改 | 收敛为 bootScene(document.body) + App 挂载 + __gts3d 调试口；删除重复 handler 注册与 refeed |
| `template/src/edit/edit-main.ts` | 修改 | 收敛为 bootScene(viewport) + Bridge/Selection/Gizmo/Save 装配；删除重复注册与 refeed（-40 行） |
| `template/src/scene-core/createScene.ts` | 修改 | 新第四参 SceneOptions{profile}（旧三参兼容）；装配序调整：renderLoop 提前到建树前创建（不 start），profile 在内建工厂后、buildTree 前调用；whenReady 参数改名 readyOptions 消 no-shadow |
| `template/src/scene-core/index.ts` | 修改 | 导出 SceneOptions 类型 |
| `template/index.html` | 修改 | 内联分流 script → `<script type="module" src="/src/entry.ts">` |
| `template/scenes/empty.json` | 新增 | 空起步场景（舞台配置齐备，零业务节点） |
| `template/scenes/demo.json` | 新增 | Demo 场景快照（--profile demo 数据源；母版 public/scene-data.json 仍为 demo 供母版自身冒烟） |
| `scripts/lib/asset-catalog.mjs` | 新增 | manifests 真相源解析：buildAssetCatalog（扫 assets/manifests）+ resolveAsset（真实 modelPath + glTF 目录闭包 + 状态贴图 + 越界守卫）+ referencedAssetIds |
| `scripts/lib/scene-schema.mjs` | 新增 | validateSceneData：duplicate-id/parent-cycle/missing-parent/bad-vec3(NaN/Infinity)/zero-scale/bad-scale/unknown-factory 逐条带 path；registryFromFactories + TEMPLATE_FACTORY_TYPES 镜像 |
| `scripts/init.mjs` | 重写 | ① --scene > --profile empty(默认)/demo 三态场景选择；② 资产注入改走 asset-catalog（真实 modelPath + glTF 整目录 + 贴图集，files 须 assets/ 前缀）；③ pruneUnreferencedModels：母版 demo 模型按最终场景闭包清理（F09 空工程零 Demo 残留）；④ vendor 多 tgz 须 --components-version 显式选择（V21，缺省/歧义报错列可选）；⑤ --validate preview/standard/off（默认 preview，schema 违规进 errors） |
| `scripts/build.mjs` | 修改 | checkProject 接入 schema 校验（重复 ID 等结构错误硬 FAIL，工厂表不传——unknown factory 运行时注册静态不可知，仍由预算估算器告警）；required 文件表加 entry.ts/boot-scene.ts/scene-profile.ts；--stripped 检查 entry.ts 残留 edit 分支 |
| `scripts/strip-edit.mjs` | 修改 | 入口改写从 index.html 内联正则 → src/entry.ts 固定文件整文件替换（ENTRY_RUNTIME 确定性内容；重复 strip 幂等；非预期形态报错拒绝改写） |
| `scripts/verify/gates.mjs` | 修改 | 43→59 用例：init 合同更新（empty 默认零分组+F09 零 Demo 模型、demo 闭包、--assets all=59 全集）；schema 9 负例+2 正例+路径定位断言；build schema 拦截负例；glTF 多文件 fixture（假库 .gltf+.bin+.png 目录闭包展开）；strip-edit 固定入口单态化断言 |

**验证证据**（全部 2026-10-14 实跑）：

- vue-tsc --noEmit：零错误
- npm run build（含 vue-tsc + vite build）：PASS——entry 静态分支产出 index/main/edit-main/boot-scene 四 chunk，boot-scene（three+core，810 kB）两态共享一份（旧形态两入口各引一份 core 代码路径）；大 chunk warning 与 P1 相同（既有，保留）
- gates.mjs：**59/59 PASS**（原 43 用例全部保留语义更新 + 新增 16 项 P2 合同）
- p1-fixtures --node-only：**17/17 PASS**（P1 零回归）
- scene.mjs --both（dev server 5199）：run/edit 双态 SCENE PASS——ready `succeeded=4`（profile 建树前注册生效：4 个 GLB 节点首建即命中工厂）、零页面错误、主体进视锥、渲染活性
- smoke-structural 旧 CLI：STRUCT PASS——13 节点全分组对齐（trees×5/cars×2/examples×2/codecars/codeworkers/coderacks/Box），**无 refeed**（两入口的硬编码 refeed 列表已物理删除）
- smoke-r S1：SMOKE PASS（母版 demo 场景自身冒烟不受影响）
- ESLint 改动文件：0 error（edit-main 函数长度/createScene 既有函数长度等 warning，与 P1 保留口径一致）
- init 三态实跑：empty（groups=[] + models 目录清空 + gate PASS）/ demo（example+person 闭包注入）/ --scene（引用闭包注入）全部 ok=true
- vendor 多 tgz 实跑（临时 0.1.0+0.2.0 双 tgz 后删）：无版本 FAIL 列可选、--components-version 0.2.0 唯一匹配 PASS、歧义 "0" 匹配 2 个 FAIL
- glTF 多文件 fixture：resolveAsset 展开 model.gltf+data.bin+tex.png 全闭包

**关键行为变化（用户可见）**：

1. `init` 默认产出**空工程**（舞台配置齐备、零业务节点、零 Demo 模型）；要旧行为显式 `--profile demo` 或 `--scene <file>`
2. 新增业务分组只改 `src/scene-profile.ts` 一个文件（run/edit 自动一致）；两入口不再有重复注册表
3. `--with-components` 多 tgz 时必须显式 `--components-version`（不再字典序取最新）
4. `strip-edit` 产物入口是 `src/entry.ts` 单 import（index.html 保持引用 entry.ts 不变）

**实现过程中的实证发现（均已修正）**：

- vite 对 `import(变量)` 形态不打包入口代码（92→4 modules，运行时 404）——entry 分支必须静态字面量 import
- esbuild build target（es2020）不支持 top-level await——entry 用 `void import()` 链式
- build.mjs 的 --stripped 检查正则会命中 entry.ts **注释里的** "?edit=1 → edit-main" 字样——strip 产物改为整文件替换（确定性内容），检查只认代码
- manifest 的 modelPath 基准是 **skill 根**（"assets/models/x.glb"），不是 assets/ 目录——asset-catalog 以 skill 根为 root，files 相对 skill 根，init 拷贝 dest=public/<rel> 自然对齐

**未解决问题**：

1. `--validate standard` 与 `preview` 当前同级严格（schema 校验同一套）；standard 档的差异（完整编辑契约检查）属 P5 profile 调度范畴，本轮 preview 档已是完整 schema 硬校验，不冒充 standard。
2. pruneUnreferencedModels 只清 `models/`，不清 `textures/`（materials.ts 状态贴图常驻 + 用户贴图上传区，无 manifest 闭包依据可判引用）；空工程的 textures/example.jpg 残留无害（不被引用不加载），若后续要收紧需贴图引用分析，属 P4/P5。
3. `TEMPLATE_FACTORY_TYPES`（scene-schema.mjs）是母版工厂表的构建期镜像，母版 profile 加新业务分组时需同步——由 gates「unknown-factory 正例」守护（demo 场景全分组必须命中工厂表，漏同步即 FAIL）。

**Spec 偏差**：

- §4.1 P2 行「改 main/edit-main/index.html/App.vue」：App.vue 未改（P2 装配收敛不触及 App.vue 内容，其「打开编辑态」链接仍由 strip-edit 的 rewriteApp 处理，行为不变）。
- §4.2 `initProject(target, opts)` 扩展签名按合同执行；`--profile` 新默认 empty 按合同执行。
- ensure-env.mjs 未改（重读 F09/F10 处理行，ensure-env 无场景相关检查职责；P2 范围内的环境预检逻辑无变化）。
- 其余按 §4.1 P2 文件清单与 §4.2 签名合同执行，无未记录偏差。

---

### P1 Review 修复轮（2026-10-14，R1–R7 全修 + 负例固件落地，待重审）

**改动文件**（在 P1 首轮基础上）：

| 文件 | 修复项 | 内容 |
|---|---|---|
| `scripts/lib/cdp.mjs` | R1/R5 + 新发现 | pending entry 对象上取方法调用（旧解构丢 this）；close 三路保底 kill（closed 短路/close 事件/1s 兜底）+幂等；握手与探测共享同一 deadline（fail 统一杀进程再抛）；onEvents 失败统一清理。**修复中再发现两 bug**：① Edge 命令行直启 URL 时首个文档的 module script 不执行（boot 静默不跑）→ 统一 about:blank 起页 + navigateTo（域名导航后重订阅，防事件绑定旧 context 漏收）；② profile 固定目录复用残留态 → 默认时间戳化。新增 `positionalArg`（flag 值不再被误当 URL）与 `collectNetwork404s`（资源 404 兜底） |
| `template/src/scene-core/diagnostics.ts` | R2/R3 | begin 返回唯一 token，settle 按 token 对账（旧 attempt 迟到/重复 settle 静默丢弃，不误删新 pending 不重复计数）；`cancelNode(nodeId)` 定向取消（不再全局 bumpEpoch 误伤无关节点）；failedAssets 改当前态（同节点同资产后继成功移出，whenReady 看现在还有谁坏） |
| `template/src/scene-core/engine/SceneEngine.ts` | R3 | 新增 `subscribeNodeEvent(event, cb)` 多订阅（返回退订函数）；旧单槽字段保留兼容（直接赋值仍有效）；4 处触发点统一走 `emitNodeEvent`（单槽+多订阅都通知）。修掉 example.ts 覆写 onNodeRemoved 导致 diagnostics 接线失效的通路 |
| `template/src/scene-core/handlers/registry.ts` | R2 | makeAssetNodeFactory 走 token 对账（begin→token，三处 settle 传 token） |
| `template/src/scene-core/createScene.ts` | R3 | diagnostics 接线改 subscribeNodeEvent('removed')（bumpEpoch + cancelNode 定向） |
| `scripts/verify/scene.mjs` | R4/R6/R7 + 固化 | about:blank+navigate 双订阅（cdp.mjs 内置）；errors 检查合并 CDP 监听 + diag.pageErrors 双窗口 + 1.2s 错误沉淀窗；Network.responseReceived 404 兜底；favicon 豁免逻辑修正（不吞普通错误）；视锥改平面提取盒-视锥相交（大地面不误 FAIL，相机能力预检防探针页炸 runner）；分组对齐改 ID 集合精确比对（数量相同 ID 错误即 FAIL，缺失/多余逐个列出） |
| `scripts/verify/{smoke-structural,smoke-visual,perf-fps}.mjs` | 参数 bug | positionalArg 统一 URL 解析（`--out <dir>` 单独传时 dir 不再被当 URL） |
| `scripts/verify/p1-fixtures.mjs` | 新增 | 定向回归固件：N1–N4 Node 单测（token 对账/定向取消/当前态失败清单/拒绝路径）+ B1–B5 浏览器负例（启动错误仍 mounted→errors FAIL、同数量错 ID→groups FAIL、大场景视锥 PASS、display:none canvas→FAIL、404 资产→ready FAIL）。N 系用 Node ≥22.6 `--experimental-strip-types` 直跑 diagnostics.ts 源码 |

**验证证据**（全部 2026-10-14 实跑）：

- p1-fixtures：**9/9 PASS**（N1–N4 + B1–B5，覆盖 Spec §6 全部修复验收要求的复现固化）
- scene.mjs 正例：run PASS / edit PASS（exit 0）
- 旧三 CLI 兼容：STRUCT PASS / VISUAL PASS（四截图产出）/ PERF OK（exit 0）
- gates：43/43 PASS
- vue-tsc --noEmit：零错误

**Review 复现项逐条对账**：

| Spec §6 复现 | 修复后行为 | 证据 |
|---|---|---|
| 旧 attempt 取消后 pending=0（应 1） | N1：旧 settle 后新 attempt 仍 pending=1 | N1 PASS |
| 无关 epoch 变动后活节点 404 变 cancelled（应 failed=1） | N2：cancelNode 精确定向，无关节点 404 正常 failed | N2 PASS |
| 新 epoch 重试成功仍 failed=1（应当前 0） | N3：failedAssets 当前态，重试成功即清 | N3 PASS |
| 有 pending 时两关闭路径都抛错 | N4：entry.reject 方法调用不抛 | N4 PASS |
| 主动 close killCount=0 | cdp.mjs close 三路保底 kill（代码路径 + 手测会话收尾无悬挂） | N4 + 全部 CLI 收尾正常 |
| 严格错误收集 actual 0/expected 1 | B1：延迟抛错被 1.2s 沉淀窗 + 双窗口捕获 | B1 PASS |
| 握手 deadline 10ms 却 80ms 后仍 pending | R5：握手与探测共享 deadline，超时统一 fail | 代码路径（复现依赖竞态注入，未单独固化） |
| 视锥角点算法 false 而 Frustum.intersectsBox=true | B3：平面提取盒-视锥相交，大场景 13 对象 PASS | B3 PASS |

**未解决问题**：

1. R5 握手超时的竞态注入复现未单独固化（握手失败依赖 Edge 启动异常，固件成本高于价值）；代码路径已保证统一清理，后续批次若出现真实案例再固化。
2. B5 的 assets 检查在 vite dev server 下抓不到 404（dev server 对不存在 .glb 回落 index.html 200）——404 的权威暴露是 ready 的 failedAssets（whenReady 拒绝），判定已改 OR；production build 下 Network 404 兜底仍有效。
3. 附带合同缺口（verifyScene 导出、同进程 run/edit 双 page、旧徽标降级不当严格 PASS）：旧模板降级路径已在 scene.mjs 标注「非严格 ready」；verifyScene 独立导出与双 page 复用属 P5 统一 runner 范畴（§4.1 P5 行），本轮不扩。

**Spec 偏差**：cdp.mjs 的 about:blank+navigate 模式与 profile 时间戳化超出 R1–R7 字面范围——属修复过程中实证发现的必要修正（直启 URL 页面不执行 module script 是环境级 bug，影响全部 verify CLI），已在此记录。createScene.ts 第四参 options（§4.2）未在本轮实施（P2 范畴）。

---

### P1 批次（2026-10-14 完成执行，待用户 review）

**改动文件**（均相对 `skills/generate-3d-scene/`）：

| 文件 | 状态 | 内容 |
|---|---|---|
| `scripts/lib/cdp.mjs` | 新增 | 共用 CDP 会话层：F01（RPC timer 成功/失败/超时三路径清理；close 先关 ws 再杀进程）+ F03（预检 5s 硬 deadline 替代 15×800ms 轮询；单 browser session）+ Edge 双路径发现 + 页面错误收集器（favicon/404 豁免语义原样迁移） |
| `scripts/verify/scene.mjs` | 新增 | 统一验证 runner（F02）：mounted/ready/分组对齐/相机/画布可见（尺寸+视口交集）/关键主体进视锥（bbox 8 角点投 NDC）/渲染活性/零页面错误 八项逐 check 输出；whenReady 优先、旧模板徽标降级；`--json` 输出 |
| `scripts/verify/smoke-structural.mjs` | 修改 | 迁移到 cdp.mjs（spawn/轮询/ws/rpc 全删，改 openBrowserSession/collectPageErrors）；CLI 参数与退出码不变 |
| `scripts/verify/smoke-visual.mjs` | 修改 | 同上迁移；CLI 不变 |
| `scripts/verify/perf-fps.mjs` | 修改 | 同上迁移；CLI 不变 |
| `template/src/scene-core/diagnostics.ts` | 新增 | F11：每 AssetEngine（=每 handle）LoadTracker——begin/settle(succeeded/failed/cancelled)/bumpEpoch/snapshot；迟到 epoch 结算为 cancelled；failedAssets 带 nodeId/assetId/error；页面错误 sink（error+unhandledrejection） |
| `template/src/scene-core/handlers/registry.ts` | 修改 | makeAssetNodeFactory 模块级 loadTotal/loadDone 全局计数器删除，改查 getDiagnosticsTracker(assetEngine)（未安装退回旧回调语义）；onLoadCount 签名不变 |
| `template/src/scene-core/createScene.ts` | 修改 | 装配期安装 diagnostics（页面错误监听先于一切装配）；onNodeRemoved 链式挂 bumpEpoch；徽标读数从 tracker.counts() 派生；SceneHandle 新增 whenReady/getDiagnostics；首帧标记；dispose 时 detach 页面错误监听 |
| `template/src/scene-core/index.ts` | 修改 | 导出 SceneDiagnostics/LoadOutcome 类型 |

**验证证据**：

- vue-tsc --noEmit：零错误（模板全量）。
- gates.mjs：43/43 PASS（含既有 41 用例零回归）。
- 新 runner 正例：run 模式 SCENE PASS（exit 0）——ready 走 whenReady（epoch=0 succeeded=4 cancelled=0）；edit 模式 SCENE PASS（exit 0）。
- 负例 1（GLB 404，临时改 cars[0].assetId=nonexistent_404 后还原）：`ready` FAIL 精确报 `nonexistent_404@car_01`，exit 1。旧实现此处徽标收敛假 PASS。
- 负例 2（视口外 canvas，探针页假挂载）：`canvas 在视口外` + `场景为空` + 分组不对齐三 check FAIL，exit 1。
- 负例 3（启动异常探针页）：mounted FAIL（7000ms 未挂载），exit 1。
- 旧 CLI 兼容：smoke-structural STRUCT PASS（exit 0）、perf-fps PERF OK（exit 0）。
- smoke-visual：模型侧首跑报未挂载（exit 1），用户手动复测 PASS——判定偶发（CDP 时序），已记录为观察项，未作为未解问题阻塞。
- 用户人工复测（2026-10-14）：浏览器目检 run/edit 正常、五条命令全过、"都很正常"。

**未解决问题**：

1. smoke-visual 偶发未挂载（模型侧 1 次，用户复测正常）：疑似 CDP 连接后首轮 evaluate 时序，后续批次若复现再定位，暂不阻塞。
2. scene.mjs 的 ready 检查在旧已生成项目（无 whenReady API）降级为徽标判定，无法感知 failedAssets——已知边界，Spec §4.6 兼容性声明覆盖（已有项目不自动升级）。

**Spec 偏差**：无。P1.1–P1.3 按 §4.1/§4.2 合同执行；registry 计数器实现从"注入回调"细化为"factory 内查 tracker"（private helper 细化，公开签名 makeAssetNodeFactory/onLoadCount 未变，§4.2 允许）。

---

- 2026-10-14 用户授权分批实施（每批一个单元，完成后暂停 review）。P1 开工。
- 此前仅静态读取与审查，生成此Spec；没有修改skill实现、模板、资产或仓库产物。
- 当前没有新的实现测试PASS记录；之前仓库验证不是本次skill优化验收证据。
- 执行批准后各批次记录source hash、改动、测试、耗时及未解风险。

## 6. Review Verdict

### P3 第五次 Review（2026-10-15，Codex，最新裁决）

结论：P3-RRRR1 通过并关闭，P3 已报告的阻塞项全部关闭，本批次 Review PASS。

- 原始真实引擎反例：父编辑→父重建，子节点实例和材质引用保持，liveChildMaterialDisposeEvents=0，materialTrackedAfter=true。
- 额外三层父子孙回归：祖先编辑后重建，孙节点保身份、材质仍登记、存活时 dispose=0；分别走级联删除与直接 engine.dispose，最终总 dispose=1。两条路径均通过。
- gates --quiet：84/84 PASS；p1-fixtures --node-only：43/43 PASS，包含既有共享资源、动态材质替换、撤销实例身份等回归。
- 实现检查：业务节点边界用于资源收集；父级编辑后对受影响后代按其自身 id 对账，避免资源记给父节点。
- 本轮未重复浏览器/GPU 长时验证，未修改实现、未暂存或提交。P6 完整编辑验收及性能验证仍按 Spec 执行；本结论不代表 P4–P6 完成。

已回填规范 Spec。下一步可交实施 LLM：P3 已通过，请按同一 Spec 仅实施 P4，回填改动、验证与未验证项，不进入 P5、不自动提交。

P4 完成后发送：P4 已完成，Spec 已回填，请 review P4。



### P3 第四次 Review（2026-10-15，Codex，最新裁决）

结论：上轮单节点动态材质泄漏已修复，但动态登记的父子节点所有权边界错误，P3 暂不通过。只剩下述资源归属问题。

#### P3-RRRR1（P1，续 RRR1）：同步父节点资源时将业务子节点资源记给父节点

位置：template/src/scene-core/resources.ts 的 collectObjectResources / syncObjectResources；SceneEngine.ts:499 的 applyVisual 后对账。

collectObjectResources 无条件 traverse 全部后代，syncObjectResources 把集合都归给传入的 nodeId。真实 SceneEngine 创建父 p/子 c，执行 applyVisual('p',{color:'#ff0000'}) 后，子 c 的新材质仅被登记为父 p 所有。再更新 p.params 触发父重建：c 实例保留且仍使用该材质，但材质收到一次 dispose、退出登记。实测 childIdentityPreserved=true、childStillUsesMaterial=true、liveChildMaterialDisposeEvents=1、materialTrackedAfter=false。这使之前已修复的“父重建不释放存活子资源”在编辑后再次失效。

修复要求：按引擎节点边界收集资源，区分工厂内部 mesh 和独立注册的业务子节点；父节点视觉操作若递归修改子节点材质，必须同步受影响子节点自己的资源归属，不能只跳过后代导致漏登记。remove/recreate/dispose 始终不得释放存活子节点仍持有的资源。新增真引擎“父子建树→父材质编辑→父重建→子继续存活→删除/整体销毁”的计数回归（父重建时子当前资源 dispose=0；最终恰好1），保留共享材质和连续编辑计数回归。

#### 验证

- 上轮原反例已通过：editedMaterialTracked=true，remove+dispose 后释放恰好1。
- gates --quiet：84/84 PASS；p1-fixtures --node-only：42/42 PASS。
- 父子编辑后重建组合反例已复现，证据 P3-fourth-review-repro.json；旧反例结果 P3-fourth-original-repro.json。
- 未修改实现、未暂存/提交；未重复浏览器/GPU；其余已关闭项不重开。

#### 给实施 LLM

只修 Spec §6 最新 P3-RRRR1：动态资源登记必须遵守业务节点边界；父级递归编辑影响子节点时，将新资源登记给实际子节点，不能把整棵树资源都记给父节点。补父子编辑→父重建→子存活→删除/销毁的精确计数回归，保持已有连续编辑和共享资源回归通过。回填 Spec，不进入 P4、不自动提交。

修复后发送：P3-RRRR1 父子资源归属已修复，Spec 已回填，请定向复核及相关回归。



### P3 第三次 Review（2026-10-15，Codex，最新裁决）

结论：RR2 关闭；RR1 上轮共享/整体销毁反例已修复，但编辑材质替换后的资源未登记，P3 暂不通过。

#### P3-RRR1（P1，续 RR1）：资源登记只覆盖创建时，编辑后的新材质泄漏

位置：template/src/scene-core/engine/SceneEngine.ts:573（唯一 acquireObjectResources 调用），applyVisual / replaceVisual；template/src/scene-core/materials.ts 的材质 clone/替换路径。

改成实际资源登记后，createNode 只记录初始 geometry/material；applyVisualOverride 会 clone/替换 mesh.material，但没有更新资源域。真实 SceneEngine 创建 Mesh 后执行 applyVisual('a',{color:'#ff0000'})，新材质与原材质不同，isTracked(newMaterial)=false；随后 removeObject('a') 和 engine.dispose() 均完成，新材质 dispose 事件仍为 0。此前根遍历能看到当前材质，现在静态登记丢失这部分资源，编辑后删除/反复编辑会泄漏。这是 RR1 资源所有权修复的相关回归，不是扩大范围。

修复要求：把资源新增/替换/移除纳入统一所有权生命周期。至少覆盖 applyVisual/replaceVisual、整表视觉恢复、工厂 update 与异步挂载这类会改变实际资源集合的入口；不应只在本反例末尾补 acquire（那仍会积累被替换旧材质）。共享/缓存保持正确所有者边界，不能直接 dispose 其他节点仍使用的资源。补真实生产入口的连续材质编辑、删除、整体销毁计数，断言旧独占资源及时释放、当前资源被登记且最终恰好释放一次。原共享材质与父子销毁回归必须保持通过。

#### 已关闭与验证

- RR2：真实 Bridge 恢复缺 params 的未变节点，identityPreserved=true，params 仍缺省。
- RR1 原反例：删第一个共享 owner 后 dispose=0/refCount=1；删最后一个总 dispose=1；父子 engine.dispose 子 geometry 恰好 dispose=1。
- gates --quiet：84/84 PASS；p1-fixtures --node-only：40/40 PASS。
- 新反例：materialReplaced=true，editedMaterialTracked=false，remove+dispose 后 editedMaterialDisposeEvents=0。证据 P3-third-review-repro.json；上轮反例结果 P3-third-review-original-repro.json。
- 本轮未修改实现、未暂存/提交；未重复浏览器/GPU。R1/R2/RR2 保持关闭。

#### 发给实施 LLM

按 Spec §6 最新第三次 Review，仅修 P3-RRR1：资源域必须随运行中的材质/几何新增、替换和移除同步，覆盖真实编辑材质入口及相关动态资源路径，不能只登记创建时资源，也不能用重复 acquire 留住废弃资源。补连续编辑与删除/整体销毁的精确释放计数，保持已有共享资源与撤销回归通过。回填 Spec，不进入 P4、不自动提交。

修复后发送：P3-RRR1 动态资源登记已修复，Spec 已回填，请定向复核及相关回归。



### P3 第二次 Review（2026-10-15，Codex，最新裁决）

结论：R1/R2 关闭；R3/R4 的原始反例已修复，但相关合同仍有两个缺口，P3 暂不通过。

#### P3-RR1（P1，续 R3）：共享资源与整体销毁仍绕过所有权

位置：scene-core/engine/SceneEngine.ts:572、908；scene-core/resources.ts:92–94 及 disposeResource。
生产引擎仍登记整个 Object3D 为 exclusive，release 时遍历材质/geometry，而非按实际资源的 owner 结算。真实 SceneEngine 中两个节点共用 material，且显式按 shared 登记两个 owner：删除第一个节点后 refCount=1，但 material 已收到 1 次 dispose，存活节点仍使用它；删除第二个后总 dispose=3（期望最后一个退出时总计 1 次）。另外父子节点整体 engine.dispose 后，子 geometry 收到 2 次 dispose（期望 1）。本轮“先摘子节点”只修 remove/recreate，未修 releaseAll 的父子重叠与共享资源旁路。
修复要求：实际资源粒度统一引用/所有权，禁止根树遍历绕过共享登记；remove/recreate/dispose 均须同一语义，cache 所有权不能由节点域越权释放。新增上述真实引擎精确 dispose 计数回归。

#### P3-RR2（P2，续 R4）：快照补默认值导致未变节点重建

位置：edit/Bridge.ts:253–268，尤其 params: node.params ?? {}。
真实 Bridge.rebuild 恢复完全相同的 {id:'a'} 快照时，将原 undefined params 强制变为 {}；引擎据此判定 params 改变，legacy 工厂走重建。实测 identityPreserved=false。首次撤销无关操作也会重建所有省略 params 的 legacy 节点，违反“未变节点保身份”的合同，增加资源重分配及异步模型重载。现有身份测试在节点已经有 params 后执行，未覆盖缺省情况。
修复要求：区分未变节点和确需清除新增字段的节点。不要将两侧均缺省的字段转成更新；保留 R4 已修复的撤销清理语义。补真 Bridge undo/redo 对缺 params 的未变 legacy 节点的身份、create 次数及恢复状态断言。

#### 已验证

- 上轮四个原始反例均修复：树 height 1→3 得到 geometry.height=2.7；params-only 重建保留 position/scale/card；父重建存活子 geometry dispose=0；Bridge 恢复缺省状态后位置归零、params 清空。
- gates --quiet：84/84 PASS；p1-fixtures --node-only：37/37 PASS。
- 本轮额外生产模块复现：共享材质提前释放/重复释放、engine.dispose 子资源重复释放、未变缺 params 节点身份丢失，详见 P3-rereview-repro.json。
- 未修改实现、未暂存/提交；未重复浏览器/GPU。R1/R2 保持关闭，下轮只审剩余两项及相关回归。

#### 发给实施 LLM

按 Spec §6 最新 P3 定向复核，仅修 P3-RR1/P3-RR2。RR1 要落实实际资源所有权，统一 remove/recreate/dispose，补真实引擎共享材质和父子整体销毁计数；RR2 要在清除新增字段的同时保持缺省 params 的未变节点身份，补真实 Bridge undo/redo 回归。保持 R1/R2 及原始反例通过，回填 Spec，不进入 P4、不自动提交。

修复后发送：P3-RR1/P3-RR2 已修复，Spec 已回填，请定向复核剩余两项及相关回归。



### P3 首次 Review（2026-10-15，Codex，最新裁决）

结论：FAIL。四项可复现缺陷，均在 P3 生命周期与编辑合同内。未修改实现或暂存区。

#### P3-R1（P1）：更新前旧参数被覆盖，真实结构参数不生效

位置：template/src/scene-core/engine/SceneEngine.ts:808–819；handlers/example/example.ts:79。
previous 与 entry.node 是同一对象；调用 definition.update 前先写 entry.node.params，导致 previous.params 已等于 next.params。真 registerTreeHandler 的 height 从 1 更新为 3：数据为 3，但实例不变、树干 geometry.height 仍是 0.9（应为 2.7）。example 的 assetId 还从已更新的 getNode 取旧值，比较也永远相等。
修复：在修改索引前保留正确旧节点快照；给 update 正确的完整 next/previous；example 使用 previous 比较资产。补真实 tree/rack/example 的结构参数正负例，不能只用恒返回 rebuild 的假工厂。

#### P3-R2（P1）：局部重建把片段当完整节点，丢失未提交字段

位置：template/src/scene-core/engine/SceneEngine.ts:819、827。
recreateNode 只收到 incoming 和 parentId，没有合并原完整 node。已有 position=[8,2,3]、scale=2、card 的 legacy 节点，只发 params 更新后，物体回到原点，节点 position/scale/card 全消失。typed update 返回 rebuild 同一路径有同样问题。
修复：按片段“缺的不动”语义先合成完整 next node，再调用 update/create；补 legacy 和 definition 两条路径，断言 transform/card/父链/视觉与子节点均保留。

#### P3-R3（P1）：父节点资源释放遍历到仍存活子节点，且重复 dispose

位置：template/src/scene-core/engine/SceneEngine.ts:615–632；resources.ts 的 Object3D 遍历释放。
childObjs 仅收集但未从旧父节点脱离，就执行 ResourceScope.release 和 disposeInstance；二者均遍历整树。真实父节点 params 重建后，子节点仍为同一实例、仍在引擎内，但其 geometry 收到两次 dispose 事件。登记根 Object3D 的所有权不能代表整棵动态子树的资源所有权，也不能保护跨节点共享材质；共享引用计数的独立单测未验证这条生产路径。
修复：按实际资源及所有者统一释放，消除两套释放路径；存活子节点资源不得随父释放；缓存/共享资源须遵守引用生命周期。补真实引擎父子重建、共享材质、多次增删的精确 dispose 计数，不能仅断言旧根不再 tracked。

#### P3-R4（P1）：undo 的全量快照被按 patch 合并，无法撤销新增字段

位置：template/src/edit/Bridge.ts:250–257。
真实 Bridge.rebuild 恢复仅含 {id:'a'} 的旧快照时，当前新增的 position=[9,0,0]、params={v:2} 都保留。update 的“缺的不动”适合片段，不等价快照替换。现有 undo 测试没有调用 Bridge，只模拟 remove/upsert 且只检查不变节点身份，因而漏检。
修复：实现真正快照差量恢复，对旧快照缺失的字段显式清除/恢复默认，同时保留未变节点身份；补真实 Bridge 的 undo/redo、首次添加 transform/params/card、父链变化和序列化一致性测试。

#### 验证

- gates.mjs --quiet：84/84 PASS。
- p1-fixtures.mjs --node-only：32/32 PASS。
- 独立真实生产模块复现：上面四项均复现，原始结果见 P3-review-repro.json；脚本 work/p3-review.mjs。
- 未重复浏览器/GPU 验证。现有 Node 绿灯不能替代编辑快照和资源生命周期行为验证。

#### 给实施 LLM

按同一 Spec §6 最新 P3 Review，只修复 P3-R1～R4。使用完整 next/previous 节点语义、保留片段未提交字段、统一实际资源所有权释放、正确实现快照差量恢复。补真实 handlers、SceneEngine、Bridge 的行为回归，禁止以复制实现或恒返回值的假工厂代替核心验收。回填改动、验证及未验证项；不进入 P4，不自动提交。

修复后发送：P3-R1～R4 已修复，Spec 已回填，请定向复核及相关回归。



### P2 第五次 Review（2026-10-14，Codex，最新裁决）

**结论：P2-RRR2 通过并关闭；P2 已报告的阻塞项全部关闭，本批次 Review PASS。** 本轮仅复核注释解析及相关回归，没有扩大到 P3。

- 实现审查：手写括号扫描已替换为 TypeScript AST，按对象顶层 PropertyAssignment 提取 key；注释不再影响对象边界，嵌套 key 不会上浮。
- 独立复现：上一轮三个原始注释反例（行注释含右括号、块注释含左括号、函数体注释后仍有顶层 crates）及单行/嵌套两项对照，5/5 PASS。
- 本轮实跑：gates.mjs --quiet 为 84/84 PASS；p1-fixtures.mjs --node-only 为 20/20 PASS，包含真实注册结果检查及此前相关回归。
- 验证边界：未重复浏览器/GPU/组件安装，未修改 skill 实现、未暂存或提交。AST 需要模板既有 TypeScript 依赖；不将本次定向通过表述为任意畸形 TypeScript 源码的严格语法校验。§5 已记录的语法恢复边界保留，不新增为本轮阻塞项。
- 下一步：按用户分批节奏交给实施 LLM 做 P3，完成后回填同一 Spec 并单独 review；本轮不执行 P3。


### P2 第四次 Review（2026-10-14，Codex，最新裁决）

**结论：RRR1 已关闭；RRR2 仍有一个缺口，P2 暂不通过。** 后置 hasFactory 校验已落地，本轮真 SceneEngine + 生产注册函数正负例通过。原单行多 key、嵌套对象反例已修复；保留空业务表、URI 已关闭结论。

剩余 **P2-RRR2 / P2**：scripts/lib/scene-schema.mjs:330 外层对象配平与 :272 值内括号扫描未识别注释。顶层循环虽跳过注释，但源码在到达它之前可能已被截断：
- `trees: f, // }` 后还有 `crates: g`：生产提取器只返回 trees，静默遗漏 crates。
- `/* { */ trees: f`：合法对象抛「花括号未闭合」。
- 函数体中的 `// }` 同样导致后续顶层 crates 丢失。

这仍属于上轮要求的注释用例，不是新增范围。声明定位、外层截取与值扫描需要一致的词法处理；建议成熟 TypeScript AST/词法器，避免逐轮修补手写扫描器，不能静默返回残缺 key 集合。

本轮实跑 **gates 81/81 PASS、p1-fixtures Node 20/20 PASS**；新增5项生产提取器对照：原单行及嵌套2项通过，注释含括号3项失败。未修改 skill 实现或暂存区，未重复浏览器/GPU/安装。证据：outputs/P2-fourth-review.md、P2-fourth-review-repro.json；脚本 work/p2-fourth-review.mjs（均在本聊天目录）。

下一步只修 RRR2 注释词法处理，补外层/函数体中行、块注释含括号的回归，回填后定向复核；P3 不开始。

### P2 第三次 Review（2026-10-14，Codex，最新裁决）

**结论：仍 FAIL，剩余范围收敛到 RR1 的两处。** RR2 已验证空 BUSINESS_REGISTRARS 可提取七类内建工厂；RR3 原 `data%20mesh.bin` 夹具经真实 THREE HTTP 加载成功（children=1），当前 checkProject 也 PASS，原反例关闭。未改变这两项的验收标准。

| ID / 严重性 | 位置 | 复现与修复要求 |
|---|---|---|
| P2-RRR1 / P2 | template/src/scene-profile.ts:63–68 | 只检查 register 是 function，不确认注册结果。添加 `robots: () => {}` 时生产 checkProject.ok=true；执行当前 registerBusinessFactories（TS 转译，周边 handler/engine 隔离 stub）不抛错，注册表仍无 robots。原「已声明却未注册」负例仍未覆盖。全部 registrar 执行后逐项用实际 sceneEngine.hasFactory(type) 校验，防止空实现/注册错名；保留同函数去重及一函数多类型支持。 |
| P2-RRR2 / P2 | scripts/lib/scene-schema.mjs:226 | key 提取只是对整个对象文本按行正则匹配，不识别顶层属性。合法单行 `{ trees: registerTreeHandler, crates: registerCrates }` 仅提取 trees；crates 函数内部 `const defaults = { ghost: 1 }` 换行后 ghost 被误当工厂。前者错拒真实 factory，后者放行假 factory。改为语法层级正确的提取/共享声明，不能继续用行首正则冒充对象解析；补单行多 key、嵌套对象、注释用例，未知不支持形态明确失败。 |

实跑：**gates 75/75 PASS、p1-fixtures Node 18/18 PASS**；额外生产 helper/checkProject 反例及当前 registerBusinessFactories 转译隔离执行确认上述问题。运行时函数未手写复制；隔离 stub 不代表已跑完整浏览器。真实 THREE 对照仅针对 RR3。未重复 GPU、联网安装或整套浏览器。

证据：本聊天 outputs/P2-third-review.md、P2-third-review-repro.json；夹具脚本 work/p2-third-review.mjs、work/p2-uri-review.mjs。未修改 skill 实现或暂存区。下一步只修 P2-RRR1/RRR2，保留已通过 RR2/RR3，再定向重审；P3 不开始。

### P2 二次 Review（2026-10-14，Codex，最新裁决）

**Overall Verdict：P2 REVIEW FAIL（有进展，仍有3项需修复）。** 本轮仅审查和写验证夹具，未修改 skill 实现/暂存区。

原问题对账：R1 已补 asset-manifest 的 init/build/boot 主链路及外部依赖存在校验；R2 已增加 copy+components 真安装与 lock 验证（本轮审查代码，未再次执行联网安装）；R4 的向量零轴与内建 asset 缺 ID 已有生产入口负例。R3 虽对不在名称数组的分组硬失败，但尚未满足实际注册单一来源。

| ID / 严重性 | 位置 | 复现与影响 | 修复要求 |
|---|---|---|---|
| P2-RR1 / P2 | template/src/scene-profile.ts:25；scripts/lib/scene-schema.mjs 的 extractBusinessFactoryTypes | BUSINESS_FACTORY_TYPES 仅供正则校验读取，registerBusinessFactories 仍逐个硬编码调用 handler，根本没有遍历此数组。夹具删除 registerTreeHandler 调用但保留 trees 名称，build.ok=true；只加 robots 名称而不注册，也 build.ok=true。引擎仍会跳过缺工厂节点，R3 未闭环，注释声称「注册循环遍历它」不符合代码。 | 从同一声明生成实际注册与校验信息，或建树前对实际 registry 硬校验；补「已声明却未注册」与新增真实 factory 两侧用例。 |
| P2-RR2 / P2 | scripts/lib/scene-schema.mjs:196 | BUSINESS_FACTORY_TYPES=[] 直接抛错。合法的空场景或只使用 Box/asset 等内建工厂的工程，不需要任何业务 handler，却无法通过 build。 | 允许空业务表，保留内建工厂；数组缺失/语法不支持与合法空数组分别处理。补纯内建图元工程的 init/build 正例。 |
| P2-RR3 / P2 | scripts/build.mjs:387（checkGltfClosure 内 resolve(base, uri)） | URI `data%20mesh.bin` 对应实际 `data mesh.bin`，THREE GLTFLoader 真实 HTTP 加载成功（scene.children=1），checkProject 却报外部依赖不存在。新校验把 URI 当作原始文件路径，误拒合法多文件 glTF。 | 按 URL/URI 规则解析相对引用、解码路径并做目录边界检查；补含空格/非 ASCII 文件名的实际加载与构建一致性测试，不仅普通文件名。 |

本轮实跑：**gates 67/67 PASS；p1-fixtures --node-only 18/18 PASS**。新增独立夹具调用生产 checkProject/factoryRegistryFromProfile 复现 RR1/RR2；真实 THREE GLTFLoader 对照验证 RR3。没有重复整套浏览器/GPU/组件安装验证，不能把执行者的手动验证当成本轮重跑证据。

证据：本聊天 `outputs/P2-rereview.md`、`outputs/P2-rereview-repro.json`；复现脚本 `work/p2-rereview.mjs`、`work/p2-uri-review.mjs`。修复这3项后定向复核，不要求无改动重复整套测试。P3 暂不开始。

### P2 代码 Review（2026-10-14，Codex，最新裁决）

**Overall Verdict：P2 REVIEW FAIL。** 共用 boot/profile、建树前注册、固定 entry 与 empty/demo 选择已落地，但 P2.2/P2.3 不能标为完成。本轮未修改 skill 实现；在独立 work 夹具中调用实际生产函数并回填本 Spec。

| 编号 / 严重性 | 位置 | 复现、影响与修复方向 |
|---|---|---|
| P2-R1 / P1 | scripts/build.mjs:359–362；template/src/scene-core/createScene.ts:221；handlers/registry.ts:145 | catalog 接受 `assets/models/test/model.gltf`，但 build 仍只找 `models/test.glb|gltf`，实际 checkProject 报资产缺文件；runtime 仍默认请求 `assets/models/test.glb`。新增 resolver 只用于复制，未形成 init→build→run 合同 V20。生成项目应携带同一份资产映射，供 build 和内建/业务 loader 共用。现有 glTF fixture 只调用 resolveAsset，不是端到端加载；此外 glTF 声明 missing.bin 时 resolver 仍返回 ok=true，需验证实际外部 URI 闭包。 |
| P2-R2 / P1 | scripts/init.mjs:271–294 | 实跑 `initProject(out,{withComponents:true,deps:'copy'})`：ok=true、npm build=true，但 package.json 新增 `@a3d/a3d-components` 后 lock 根依赖无该包，node_modules 也无该包。空场景不引用组件所以构建假绿，首次使用组件即解析失败。同步 package/lock/install 状态一次，再验证所选组件可解析；不能仅复制母版 node_modules。V21 未完成。 |
| P2-R3 / P2 | scripts/build.mjs:337–342；scripts/lib/scene-schema.mjs:67 | build 调用 schema 不传注册表，未注册 robots 分组实际 checkProject.ok=true，仅被当作静态预算未知；SceneEngine 对未注册类型是 warn+跳过，不会修复它。应从业务 profile 暴露可验证注册信息，或在运行时建树前对实际 registry 做硬校验，保持新增业务分组只登记一次，不能靠另一份硬编码镜像。当前 init 使用模板镜像与 build 不检查的口径不一致。 |
| P2-R4 / P2 | scripts/lib/scene-schema.mjs:101–114 | `scale:[1,0,1]` 与内建 `asset:[{id:'missing-id'}]` 都返回 ok=true；前者零轴退化未与 scalar zero 同等处理，后者缺 params.assetId 会构造空 Group 且无失败加载记录。补向量零分量规则及内建 asset 必填规则，并通过生产 init/build 入口验证，不只测 helper 的已有负例。 |

**本轮验证**：gates 实跑 **59/59 PASS**；在独立临时工程调用 checkProject/validateSceneData/resolveAsset 得到上述反例；真实 `--with-components --deps copy` 跑完 vue-tsc+Vite 构建，确认缺依赖仍成功。未重复完整浏览器、GPU 或 P1 回归。证据：本聊天 `outputs/P2-review-repro.json`、`outputs/P2-review.md`，可复现脚本在 work/p2-review.mjs 与 work/p2-copy-review.mjs。

**验收要求**：修复后补可被 THREE 消费的多文件 glTF，覆盖 init→build→run/edit 与缺 bin/texture；copy 模式实际 import 所选组件并校验 lock；未知 factory、缺 assetId、退化 scale 经实际入口 FAIL。仅重复现有59项不能证明这些问题已解决。P3 不开始。

### P1 Codex 接手修复与验证（2026-10-14，当前状态）

用户授权：「你来改代码吧，然后回填spec可以吗」。沿用已批准 P1 范围完成修复；未修改既有仓库工程、未进入 P2、未提交或改变暂存区。下方历史 FAIL 记录保留，不能当作本轮最新实现状态。

**本轮完成**：

- RR1：`diagnostics.ts` 新增生产公共函数 `waitForReady`，`SceneHandle.whenReady` 直接委托。以当前 `failedAssets` 判失败，累计 failed 仅用于诊断；begin 淘汰同节点旧 attempt，remove 清除该节点失败；旧回调不污染新 attempt；timeout/abort/成功/失败均清理监听与 timer。页面异常仍硬失败。
- RR2：`scene-checks.mjs` 抽出真实视锥/AABB 检测：仅当正支撑顶点在某平面外侧才剔除。真实 THREE 相机验证巨大相交盒、完全视野外盒与背后盒。检查所有节点的可见可渲染子对象、祖先 visibility、材质透明与 camera layers；取消前 20 个节点限制。
- RR3/RR4：`cdp.mjs` 的 collector 随连接创建，早于 enable/navigation；普通 console.error、exception/rejection、网络失败均保留。RPC 成功、协议错误、send 抛错、timeout、关闭统一清 pending/timer；自动导航失败也关闭 socket/browser。HTTP probe 使用剩余 deadline，握手同一 deadline。公开 `createCdpConnection` 供生产实现级回归，测试不再复制 pending 算法。
- RR5：业务 `onLoaded` 完成后才计 succeeded；业务回调与 URL 解析的同步异常均计 failed，避免假成功或 pending 不结束。
- 剩余契约：导出 `verifyScene`/`verifyPage`；`session.newPage` 在同一 browser 内建隔离 target，`--both` 串行检查 run/edit 并关闭各 page。按**每组 ID**精确比对，重复 ID 失败。canvas 检查祖先透明/隐藏、视口交集及采样点输入遮挡。旧模板无 ready API => check SKIP、overall INCONCLUSIVE，兼容退出码 0，但不宣称严格 PASS。
- 渲染：`RenderLoop.onAfterFrame` 在成功 render/record 后回调，firstFrame 不再提前置位；runner 要求新的成功帧（elapsed 前进且 calls>0），停止循环留下的旧 fps 不能假 PASS。
- 提效：删除 runner 固定 1.2s 错误沉淀等待；按条件收敛，一次 browser 跑 run/edit；fixture 支持 `--filter=正则` 定向验证。没有把结构、ready、错误检查改成人工可选。

**验证证据**（命令以仓库根为 cwd，注明例外）：

| 验证 | 命令/范围 | 结果 |
|---|---|---|
| 生产函数回归 | `node skills/generate-3d-scene/scripts/verify/p1-fixtures.mjs --node-only` | **17/17 PASS**；含 ready 重试/替换/删除、token 隔离、timeout/abort、回调失败、首帧、生产 CDP 清理/握手超时、视锥正负例、分组、降级 |
| 浏览器主批次 | 同上去掉 `--node-only`，加 `--url http://localhost:5199/` | 17 Node + run/edit、即时启动异常/404、透明/隐藏/遮挡三组 browser 均 PASS；最后一组最初因测试假定 Vite 必返回404而失败，记录为 **20 PASS / 1 FAIL**，未伪装全绿 |
| 失败用例定向复测 | `node skills/generate-3d-scene/scripts/verify/p1-fixtures.mjs --url http://localhost:5199/ --filter=real.offscreen` | 修正测试断言后 **1/1 PASS**：视野外/隐藏主体 FAIL、停止渲染 FAIL、错组 FAIL、缺失 GLB 的 ready FAIL 与 failedAssets 可见。Vite 的 HTML fallback 可能 HTTP200；独立临时 HTTP server 验证真正404。未修改 template/public/scene-data.json |
| 既有门禁 | `node skills/generate-3d-scene/scripts/verify/gates.mjs --quiet` | **43/43 PASS** |
| 类型及生产构建 | template 内 `npm run build` | **PASS**（含 vue-tsc）；保留原有大 chunk/静态动态 import 混用 warning |
| Core lint | template 内 eslint：diagnostics/createScene/registry/RenderLoop/SceneEngine | **0 error / 14 warning**，不宣称零 warning |
| Script lint | skill 根用 template ESLint config 检查 cdp/scene/scene-checks/p1-fixtures | **0 error / 14 warning**；主要为函数长度/复杂度、测试空函数、continue 和条件表达式 |
| 旧 CLI 兼容 | smoke-structural（`--edit` 在 URL 前）、smoke-visual（绝对 `--out`）、perf-fps（swiftshader，非真机GPU） | 三者 exit 0；墙钟约 **12.012s / 32.774s / 24.530s**，包含启动/原脚本等待/收尾，**不是优化前后对照基准** |
| 图像抽查 | smoke-visual 总览 PNG | 已查看，模板主体可见、非空白；原 demo 的构图/模型与地面关系没有调整，截图产出 PASS 不等于视觉品质或仓库需求验收 |
| 工作区检查 | `git diff --check` | PASS；保留已有 staged/unstaged 工作与旧 probe 文件，未自动提交 |

证据保存在本聊天 `work/p1-node.log`、`p1-final-fixtures.log`（保留一次失败）、`p1-targeted.log`、`p1-build.log`、`p1-core-lint.log`、`p1-script-lint-final.log`、`p1-compat.json`，以及 `work/p1-shots/`。可交付摘要与证据快照见本聊天 outputs。

**当前判断**：P1 已知二审问题已修复，定向自动验证通过，交回本批次 review。这里不是独立第三方审查，也不是全部优化项目完成。P2–P6 保持未开始。

**分期与风险**：

- `verifyScene` 本批实际提供 uncached preview/basic checks；project/url/mode/viewport 与逐 check status/duration/hash/source 已落地。hash 是输入 scene-data 的证据标识，**不是有效缓存键**。standard/release 调度、内容缓存和完整 changeSet 失效仍按原 P5，传尚不支持的 profile/cache 会明确拒绝，不能静默假装已完成。这不改变最终 default=standard 的目标。
- 两 page 隔离 JS/DOM，使用同一 browser profile；没有承诺每个 page 的 cookie/storage 隔离。闭页会关闭对应 target，不让旧场景后台继续渲染。
- bbox、材质/可见性和 canvas 采样不能证明无遮挡像素或美术达标，仍需总览看图/用户视觉反馈。没有重复循环“调美术直到满意”。
- 只验证了原 CLI 的非 GPU 路径；未重跑完整编辑历史/导出保真/GPU 性能，分别属于后续批次。没有足够前后对照证据宣称提升25%或给出生成总耗时收益。
- 允许保留的 style/complexity warning 如上；未以关闭 ESLint 规则换通过。

### P1 二次代码 Review（2026-10-14，Codex，历史裁决）

Overall Verdict：**P1 REVIEW FAIL（修复轮未验收）**，P2–P6继续未开始。本轮实跑p1-fixtures --node-only为4/4 PASS；追加生产函数/表达式定向复现后仍发现如下问题。没有修改实现，也未重复完整浏览器/GPU回归。

已确认进展：RPC错误解构、token对账、定向取消、诊断订阅覆写、错误豁免开关已改善。以下不能用“9/9全部通过”替代验收：

| ID | 优先级 | 当前剩余问题与证据 |
|---|---|---|
| RR1 | P1 | createScene.ts:448仍用累计d.failed>0拒绝whenReady。实际重试成功failedAssets=[]但whenReady拒绝；cancelNode也不删除已失败节点记录，删除/换资产仍残留 |
| RR2 | P1 | scene.mjs:236的dPos>=0 OR dNeg<=0对正常AABB恒真。真实表达式对完全视野外bbox仍ok=true，three.Frustum.intersectsBox=false |
| RR3 | P1 | openBrowserSession({url})自动navigate之后才collectPageErrors/Network；导航首批异常/404仍丢失。mock在navigate响应前发事件，两数组均0而应各1 |
| RR4 | P2 | cdp.mjs:324–326自动navigate失败不走onEvents的清理catch；mock导航发送异常open拒绝但killCount=0；send异常也不立即清pending/timer |
| RR5 | P2 | registry.ts先settle成功再onLoaded，后者抛错时failed结算被幂等机制丢弃；实际factory显示succeeded=1、failedAssets=[] |

尚未完整解决：每组ID对齐（目前全场集合相等可跨组错位）；旧模板strict=false仍被record/finish输出PASS；canvas透明/隐藏主体/输入遮挡；verifyScene导出与单browser双page提出延至P5但未获明确变更确认。

测试不足：N3未调用whenReady；N4复制拒绝循环而非调用cdp.mjs；B1延迟错误不覆盖首批事件；B3只打开默认模板，不覆盖原大bbox反例和视锥外负例。修复后的测试应直接覆盖生产入口和相关状态迁移，不要求扩大为全量GPU验证。

三轴：需求完成PARTIAL；Spec-code忠实度PARTIAL；内在质量FAIL。下一步修RR1–RR5与上述剩余验收，定向复测后再review。详细报告本聊天outputs/P1-rereview.md；复现输出P1-rereview-repro.json、P1-rereview-cdp-repro.json。

### P1 代码 Review（2026-10-14，Codex）

| 三轴 | Verdict | 证据 |
|---|---|---|
| 需求与完成度 | PARTIAL | 正常路径通过，断链、并发加载、取消、错误与可见性缺负例 |
| Spec-code忠实度 | FAIL | ID对齐只有计数；启动前监听与单browser/API合同未完整实现，未记录偏差 |
| 代码内在质量 | FAIL | 下述R1–R4有清理失败/false-ready/漏错误风险，轻量复现已确认 |

Overall Verdict：P1 REVIEW FAIL。实施未验收，不进入P2。原§5中的正例和人工验证是执行者证据，本review并未重跑完整浏览器/GPU/构建，只做针对性复现与静态核查。

| ID | 优先级 | 修复项 / 源码位置 |
|---|---|---|
| R1 | P1 | cdp.mjs:142/215将pending.values对象数组解构，有pending时close/断链抛.for is not iterable，主动close未kill进程 |
| R2 | P1 | diagnostics.ts:123–136按nodeId::assetId覆盖请求，旧attempt取消会删新pending；须唯一token与幂等settle |
| R3 | P1 | createScene.ts:179–182与diagnostics.ts:129–147全局epoch取消无关活节点；旧失败跨epoch永远阻塞ready；示例覆写onNodeRemoved使接线失效 |
| R4 | P1 | 业务URL先加载后监听；runner忽略diag.pageErrors；泛化404无Network兜底；favicon404Exempt=false反而不收普通错误 |
| R5 | P2 | cdp.mjs:114–134握手无deadline，spawn/握手/onEvents失败无统一清理 |
| R6 | P2 | scene.mjs:179–217角点进NDC不等于视锥相交，大地面误FAIL；不验visible/CSS/输入遮挡 |
| R7 | P2 | scene.mjs:46–52/147–161只数length，数量相同ID错误仍PASS |

附加合同缺口：verifyScene导出、新page/同进程run/edit尚未实现；旧徽标降级不能当严格ready PASS。应补齐或明确列为待批准偏差，不能称“无偏差”。

复现：旧attempt取消后pending=0（应1）；无关epoch变动后活节点404变cancelled且failed=0（应1）；新epoch重试成功仍failed=1（应当前0）；有pending时两关闭路径都抛错，主动close killCount=0；严格错误收集actual0/expected1；握手deadline10ms却80ms后仍pending；视锥角点算法false而three.Frustum.intersectsBox=true。

修复验收：将上述复现固化成轻量回归，补启动错误但仍mounted、同数量错ID、可见大bbox、隐藏canvas等负例；修后定向复测，不要求无意义重跑全套GPU。审核报告交付快照在本聊天outputs/P1-review.md，复现结果P1-review-repro.json。Review未修改任何skill实现。

## 7. Plan-Execution Diff / Reverse Sync

- 2026-10-15 P3 四审修复轮完成：RRRR1 父子资源归属边界——collectObjectResources 增 isBoundary 节点边界（不深入业务子节点子树）；syncObjectResources 返回受影响后代根供逐个对账（父编辑递归改子材质时归属子的登记）；SceneEngine.syncResourcesFor 公共入口统一三动态入口 + createNode + 异步挂载。父编辑→父重建→子存活→删除/销毁精确计数用例（父重建子材质 dispose=0、删除子恰好 1、销毁零重复）。gates 84/84、p1-fixtures 43/43、双态+结构冒烟 PASS、build/lint 0 error。详见 §5「P3 四审修复轮」。P4–P6 未开始。
- 2026-10-15 P3 三审修复轮完成：RRR1 动态资源登记同步——syncObjectResources 资源集对账接入 applyVisual（材质路径）/replaceVisual/definition.update 原地/makeAssetNodeFactory 异步挂载四入口；releaseExcept 解除被替换登记（不积累废弃资源）；材质级 isCloneResource 标记区分缓存共享与节点私有（含 Material.clone 深拷 userData 陷阱——三处克隆点统一 claimPrivateMaterial 清除）。连续编辑/替换/删除/整体销毁精确计数 2 项真实入口回归全过。gates 84/84、p1-fixtures 42/42、双态+结构冒烟 PASS、build/lint 0 error。详见 §5「P3 三审修复轮」。P4–P6 未开始。
- 2026-10-15 P3 二审修复轮完成：RR1 资源所有权改实际资源粒度（geometry/material/texture 逐个登记；Object3D 根不登记、树遍历释放路径删除；releaseAll Map 去重恰好一次、cache 不越权）；RR2 Bridge.rebuild 字段级差量（两侧均缺省不带字段——缺省 params 未变节点保身份；引擎有值快照缺省才显式清默认；card:null 哨兵引擎归一）。真实引擎共享材质/父子整体 dispose 计数、真 Bridge 缺 params 身份回归全过。gates 84/84、p1-fixtures 40/40、双态+结构冒烟 PASS、build/lint 0 error。详见 §5「P3 二审修复轮」。P4–P6 未开始。
- 2026-10-15 P3 首审修复轮完成：R1 previous 深快照（definition.update 真实前后值；example assetId 用 previous 比较）；R2 rebuild 三路径喂合成完整节点（transform/card/父链不丢）；R3 先脱离后释放 + 先摘树后统一 release（双 dispose 消除，disposeInstance 删除统一到 ResourceScope）；R4 Bridge.rebuild 快照完整语义（缺省字段显式恢复默认）。真实 handler/SceneEngine/Bridge 行为回归 6 项新增（真 tree/rack 高度与仓段结构参数、真 Bridge undo/redo、精确 dispose 计数）。gates 84/84、p1-fixtures 37/37、run/edit 双态 + 结构冒烟 PASS、build/lint 0 error。详见 §5「P3 首审修复轮」。P4–P6 未开始。
- 2026-10-15 P3 完成：typed factory 契约落地（NodeFactoryDefinition create/update/dispose + paramsEqual 幂等 + transform 引擎处理 + legacy 重建兜底）；ResourceScope 三层资源所有权（recreate/remove/dispose 统一对账，F07 关闭）；duplicateObject 改 patchVisual（F06 关闭）+ undo 差量恢复（未变节点保实例，F13 缓解）；EnvironmentEngine intensity 复用（F14/V16 关闭）+ SelectionService helper 幂等复用；example/tree/rack 三 handler 迁移示范。验证 gates 84/84、p1-fixtures 32/32（20 既有 + 12 P3 新增）、run/edit 双态 + 结构冒烟 PASS、eslint 0 error。详见 §5 P3 批次。P4–P6 未开始。
- 2026-10-14 P2 四审修复轮完成：RRR2 手写词法扫描器（~170 行）整体删除，改 TypeScript AST 提取（模板既有 typescript 硬依赖，createRequire 锚定 skill 模板、cwd 无关）——四审三个注释含括号复现（`// }` 截断/`/* { */` 误拒/函数体内注释截断）全过，13 形态回归全保留。gates 84/84、p1-fixtures 20/20。scene-schema 依赖声明更新（零依赖 → 依赖模板 node_modules typescript，已记录）。详见 §5「P2 四审修复轮」。P3–P6 未开始。
- 2026-10-14 P2 四审（review）：RRR1 关闭；RRR2 剩注释词法缺口——外层配平与值扫描不识别注释内括号，三处静默丢 key/误拒。建议成熟 TypeScript AST。详见 §6。未修改实现。
- 2026-10-14 P2 三审修复轮完成：RRR1 全部 registrar 执行后逐项 sceneEngine.hasFactory(type) 后置校验（空实现/注册错名装配期抛错，错误精确列名；保留同函数去重）；RRR2 行正则替换为深度感知顶层 key 状态机（单行多 key 全提取、嵌套对象/注释/字符串假 key 不上浮、非法形态明确抛错）。生产正负例：p1-fixtures 真 scene-profile+真 SceneEngine 直跑（20/20）、gates 提取器形态用例（81/81）。RR2/RR3 已通过项全保留。详见 §5「P2 三审修复轮」。P3–P6 未开始。
- 2026-10-14 P2 三审（review）：RR2/RR3 关闭；RR1 剩两处——空实现 registrar 逃过校验、提取器行正则非语法级（单行多 key 漏提/嵌套对象假 key 上浮）。详见 §6。未修改实现。
- 2026-10-14 P2 二审修复轮完成：RR1 BUSINESS_REGISTRARS 登记表成唯一来源（注册遍历它、校验器提取它、BUSINESS_FACTORY_TYPES 数组删除改为派生导出），删注册/只声明/新增真实 factory 三侧正负例全过；RR2 空登记表合法（纯内建工程 PASS），缺失/形态坏仍抛错；RR3 glTF URI 百分号解码 + 目录边界保留（含空格/非 ASCII 文件名 build 与 THREE 加载结论一致，..%2F 越界 FAIL）。gates 75/75、p1-fixtures 18/18、scene-profile eslint 0/0。详见 §5「P2 二审修复轮」。P3–P6 未开始。
- 2026-10-14 P2 review（二审）：R1/R2/R4 主链路确认，R3 未闭环（名称数组与注册实现仍是两份）+ 空表误拒 + URI 编码误拒。详见 §6 P2 二次 Review。未修改实现。
- 2026-10-14 P2 修复轮完成：R1 资产映射三端贯通（asset-manifest.json 落盘→build 解析+glTF 闭包校验→运行时 resolver，THREE 真实消费正例+404 负例）；R2 copy 模式真装组件+lock 同步+构建消费实证；R3 工厂表单源（scene-profile 源码提取）+build unknown-factory 硬失败；R4 向量零缩放+missing-asset-id 硬失败。gates 67/67、p1-fixtures 18/18。附带删除母版 public 残留探针页。详见 §5 P2 Review 修复轮。P3–P6 未开始。
- 2026-10-14 P2 review：59项通过但新增定向反例失败，P2.2/P2.3 退回未验收。共用装配已完成；asset-catalog 未被 build/runtime 消费、copy 模式未同步新依赖、schema 仍有确定性漏检。详见 §6 P2-R1–R4。未修改实现、未改变暂存区。
- 2026-10-14 P2 完成：共用 profile/boot/entry 三件套落地（两入口重复注册与 refeed 物理删除，V06 达成）；init 三态场景 + asset-catalog 闭包 + F09 Demo 清理 + V21 vendor 显式版本；scene-schema 硬校验接入 init 与 build（V08）。验证 gates 59/59、p1-fixtures 17/17、run/edit 双态 PASS。App.vue 未改（无必要，已在 §5 记录）。P3–P6 未开始。
- 2026-10-14 Codex 接手：修复 RR1–RR5 与剩余 P1 合同，新增 scene-checks 生产公共检测与 RenderLoop 成功帧钩子，重写 fixtures 调用真实模块。验证详情见 §6 最新条目；阶段回到 Review，P2 未开始。原“API/双page 延至P5”的执行者判断已撤回，二者本批补齐。
- 2026-10-14 P1二审：保留执行者的修复进展，但“R1–R7全修/负例覆盖完整”未被生产入口验证支持。最新裁决仍FAIL；API/双page分期需要明确记录批准，不能自动改变原P1合同。
- 2026-10-14 P1 Review：由执行者“无偏差/已完成”修正为“实现已写，review未通过”；R1–R7及公共API/严格降级口径缺口待修，P2–P6保持未开始。
- 用户澄清：对象由仓库生成物纠正为skill；已写入scope。
- 设计偏差：由“减少检查”升级为“公共契约修复+定向验证”，因为编辑正确性存在底层风险；不扩成更换框架。
- 新审查发现F06/F08/F10/F14/F16/F17/F18补入合同；既有原始仓库仍只读。

## 8. Archive

未归档：这是待实施的活跃Feature Spec，保留历史Spec，不替换长期记忆。

## 9. Project Sync Candidates

候选：scene-profile单入口、handler生命周期、visual patch/full区分、生成与skill维护验证分工、导出保真合同。

未写AGENTS/CLAUDE等默认提示词文件。本项目未发现AGENTS入口；不因本轮写Spec而自动安装sdd规则。实施通过后再按项目既有文档落点建议同步。

## 10. Resume / Handoff

下一步：P3 已经第五次 Review 通过。按用户分批节奏实施 P4，完成后回填本 Spec 并单独 review；本轮不执行 P4。

P3 四审修复轮改动（在三审修复轮基础上）：`scene-core/resources.ts`（collectObjectResources 增 isBoundary 节点边界参数——不深入业务子节点子树；syncObjectResources 返回受影响后代根；acquireObjectResources 透传）、`engine/SceneEngine.ts`（公共 syncResourcesFor：边界判定 + 本节点对账 + 受影响子节点逐个对账；三动态入口与 createNode 全部带边界）、`handlers/registry.ts`（异步挂载走 syncResourcesFor）、`scripts/verify/p1-fixtures.mjs`（现 43 用例：+RRRR1 父编辑→父重建→子存活→删除/销毁精确计数）。

P3 三审修复轮改动（在二审修复轮基础上）：`scene-core/resources.ts`（syncObjectResources 资源集对账 + releaseExcept + 材质级 isCloneResource 区分收集口径）、`engine/AssetEngine.ts`（clone 材质打 isCloneResource；applyState 克隆清除标记）、`scene-core/materials.ts`（claimPrivateMaterial：applyInlineMaterial/applyState 克隆清缓存标记——Material.clone 深拷 userData 陷阱）、`engine/SceneEngine.ts`（applyVisual 材质路径/replaceVisual/definition.update 原地三入口接对账）、`handlers/registry.ts`（异步挂载点 onLoaded 后对账）、`scripts/verify/p1-fixtures.mjs`（+RRR1 连续编辑/替换/删除/整体销毁精确计数 2 项）。

P3 二审修复轮改动（在首审修复轮基础上）：`scene-core/resources.ts` 重构为实际资源粒度（OwnedResource=geometry/material/texture；Object3D 不登记；树遍历释放路径删除；acquireObjectResources 逐 mesh 登记；releaseAll Map 去重恰好一次 + cache 跳过不越权）、`engine/SceneEngine.ts`（createNode 走 acquireObjectResources；card:null 哨兵归一 undefined）、`edit/Bridge.ts`（rebuild 字段级差量：引擎当前有值而快照缺省才显式清默认，两侧均缺省不带字段）、`scripts/verify/p1-fixtures.mjs`（+RR1 真引擎共享材质精确 dispose 计数、+RR1 父子整体销毁计数、+RR2 缺 params 未变节点身份；recreate 用例改实际资源断言）。

P3 首审修复轮改动（在首轮基础上）：`engine/SceneEngine.ts`（updateNodeInPlace previous 深快照 + next 合成完整节点；rebuild 三路径喂完整节点；recreateNode 子实体先脱离后释放；removeObject 先摘树后统一 release；disposeInstance 删除）、`handlers/example/example.ts`（update 签名补 previous，assetId 用 previous 比较）、`edit/Bridge.ts`（rebuild 快照完整语义——缺省字段显式恢复默认 parentId→null/position,rotation→[0,0,0]/scale→1/params→{}/card→null）、`scripts/verify/p1-fixtures.mjs`（真实 handler 行为回归 6 项：真 tree height 结构参数、真 rack rows 结构 vs bodyColor 原地、legacy+definition+类型变化三路径字段保留、父重建存活子资源零 dispose、级联/50 轮增删精确 dispose 计数、真 Bridge undo/redo 快照恢复）。

P3 改动文件清单（交接勿遗漏）：`template/src/scene-core/resources.ts`（新增）；改 `scene-core/types.ts`（NodeFactoryDefinition/paramsEqual/UpdateStats.rebuilt）、`engine/SceneEngine.ts`（definition 分发/params 契约/资源结算/patchVisual/findDuplicateSlotKeys）、`engine/AssetEngine.ts`（disposed 守卫）、`engine/EnvironmentEngine.ts`（intensity 复用 + pmremFactory 测试缝）、`handlers/example/example.ts`（typed definition + 多订阅）、`handlers/procedural/{tree,rack}.ts`（typed definition，rack 新 rows 参数）、`createScene.ts`、`index.ts`、`scene-profile.ts`（onFrame 透传退订）、`edit/Bridge.ts`（patchVisual 复制 + 差量 undo + 快照完整恢复）、`edit/SelectionService.ts`（helper 复用）；`scripts/verify/p1-fixtures.mjs`（P3 用例 17 项）。行为变化：① 业务工厂推荐 definition 形态（旧 function 兼容但 params 变化重建而非静默）；② params 同值重推不再触发任何重放/重建（幂等）；③ 复制操作不再清其他节点视觉层；④ undo/redo 不再全树拆除（未变节点保实例）且快照缺省字段显式恢复默认；⑤ 环境强度调整不再重新生成 PMREM；⑥ rack 分组支持 params.rows（1–12）。注意：P1/P2 的未暂存文件与 P3 改动均未暂存，不要在交接时遗漏。

P2 新增文件清单（交接勿遗漏）：`template/src/{scene-profile,boot-scene,entry}.ts`、`template/src/scene-core/asset-manifest.ts`、`template/scenes/{empty,demo}.json`、`template/public/assets/asset-manifest.json`、`scripts/lib/{asset-catalog,scene-schema}.mjs`。行为变化：init 默认 empty（旧 demo 需显式 --profile demo）；--with-components 多 tgz 需 --components-version；--deps copy+components 真装依赖并同步 lock（较慢）；业务分组登记处为 `BUSINESS_REGISTRARS` 映射（scene-profile.ts，空实现/注册错名在装配期抛错）。已删除：`template/public/__p1_probe_b2_v2.html`（P1 探针残留）。注意 P1 的 scene-checks.mjs、p1-fixtures.mjs 与上述 P2 新文件均未暂存，不要在交接时遗漏。后续按 P3→P6 完成，最后用同场景前后对照证明速度收益与兼容性。

恢复时先读取状态、scope、§4当前批次、Validation、Diff；不重复全量加载历史Spec。不要把outputs中的仓库工程当作优化目标。
