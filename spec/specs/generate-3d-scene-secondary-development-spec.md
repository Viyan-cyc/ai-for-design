# generate-3d-scene：统一生成工程与二次开发 Spec

## 1. 状态与目标

- 日期：2026-10-28。
- 状态：P1–P3 已实施并完成本地定向验收（2026-10-28）。
- 用户目标：每次生成的工程结构一致；下载源码后能快速接入业务数据；懂 Three.js 的开发者能定位构建、数据、材质与交互问题。
- 修改对象：`skills/generate-3d-scene` 的母版、生成/导出脚本及生产文档；维护测试位于 skill 外。
- 实施授权：用户指令「你自己改就行」。本轮已修改实现；未生成发布 ZIP、未自动提交。

本 Spec 在工程分层、业务接入与二开文档方面优先于旧文档。模型来源、模型包检查、编辑保存、预览交付与构建重试沿用当前有效契约，不恢复历史浏览器验收流程或默认双工程交付。

## 2. 已发现的问题

1. `references/scene-engineering.md` 把 `scene-core/handlers/materials/cards` 当作业务修改区，通用引擎与场景业务边界混杂。
2. 工程说明仍要求在 `main.ts` 装配业务，甚至提到注册晚于建树后重新喂数据；实际已有 `boot-scene.ts` 与 `scene-profile.ts`，应统一为建树前注册。
3. “渲染参数永远不进数据”等说法过宽，与 `scene/camera/lights/renderer` 的合法配置冲突；业务参数、舞台配置、编辑外观必须分别说明。
4. `handle.update` 的 `params` 是整体替换。二开者若只传状态字段，可能丢失 `assetId` 等参数，不能把它描述成普通深合并接口。
5. 缺少固定的业务字段映射、外部 ID 映射、数据更新与连接释放入口。每次生成容易重新发明结构。
6. `strip-edit` 当前把编译外观放在 `scene-core/generated`；需要随业务分层迁移，并保持编辑前后外观与独立运行能力。

现有引擎、编辑器和 handler 生命周期可以继续使用。此次是边界整理与接入契约补全，不重写引擎。

## 3. 范围与固定约束

### 必须实现

- 固定目录职责、启动顺序、业务注册入口和最小数据接入 API。
- 通用运行能力留在 core，具体场景的 handler、状态外观和卡片移出 core。
- 正常源码、离线预览和按需剥离编辑器的工程使用同一套业务组织方式。
- 二开文档提供可执行的最小数据更新示例和故障定位表。
- 生成脚本、导出脚本、文档与维护测试同步，不能只移动模板目录。

### 不做

- 不做通用物联网平台、插件系统、协议 SDK 或自动生成后端。
- 默认不连接 WebSocket/MQTT、不轮询、不伪造实时数据。
- 不自动迁移历史用户工程，不改已有仓库 demo，不重写其他 skill。
- 不改变现有核心 `handle.update` 的整体替换语义。
- 不增加正常生成时的浏览器、截图、审美审核或重复验收关卡。
- 不新增默认双份源码/运行包交付；剥离编辑器仍按需执行。

保留：右手坐标系、米、+Y 向上、+Z 向前；用户模型包优先、检索库次之、几何降级；库模型直接下载注入；稳定槽位与编辑外观往返；按需渲染、画质档位和帧率设置。

## 4. 目标目录与依赖方向

```text
src/
  main.ts                     # 启动及挂载 UI，不写场景构建逻辑
  boot-scene.ts               # 资源、数据、引擎、外观与业务接入的统一装配
  scene-profile.ts            # 唯一业务 factory / 卡片 / 外观规则注册入口
  scene-core/                 # 通用引擎、内建图元/资产、组合体工具与公共类型
  scene/
    handlers/                 # 当前场景业务：货架、产线、基站等
    appearance.ts             # 当前场景默认材质与状态到外观的映射
    cards/                    # 当前场景卡片；无卡片时允许无此目录
    generated/appearance.ts   # 工具编译的编辑外观；无内容时可不生成
  data/
    types.ts                  # 当前场景 DTO、业务字段和更新类型
    adapter.ts                # 校验、ID 映射、业务字段到场景更新
    connect.ts                # 可替换的数据源入口与统一释放
  edit/                       # 编辑器，仅按需导出时剥离
  App.vue
public/
  scene-data.json
  assets/                     # 有资产时生成
  ...                         # 沿用现有 manifest / 离线资源清单
 docs/INTEGRATION_GUIDE.md
```

- 固定目录职责，不强制每个领域相同的 handler 文件数量，不生成无用途的占位组件。
- `scene-core` 不依赖 `scene`、`data` 或 `edit`。业务依赖 core 的公开 API，不访问私有引擎对象。
- `edit` 继续只通过规定的 SceneHandle API 与 core 交互，不依赖具体业务。
- `scene-profile` 显式导入与注册，不做运行时目录扫描，不注册两次。
- 区分通用与具体：组合体工具、通用 GLB factory、基础图元留在 core；仓库/工厂专有构造和状态配色进入 scene。
- 如果 `materials.ts` 同时含通用机制与业务映射，拆分职责；不能把整个模块机械搬走造成反向依赖。
- 如业务确实需要缺失的公共能力，只补最小公开接口，不暴露整个引擎内部，也不增加无意义转发层。

## 5. 初始化与生命周期

固定顺序：安装资源解析 → 读取初始场景数据和资产清单 → 建树前注册业务 → 创建场景 → 应用编译外观 → 建立数据适配器 → 按配置连接数据源 → 挂载界面。

- 运行态和编辑态共用 boot/profile，禁止维护两份业务注册或场景构建流程。
- 默认 `connect` 不建立网络连接；返回幂等释放函数。二开者只替换连接实现和字段映射。
- 数据订阅、请求、定时器与 handler 私有资源随所属生命周期释放；销毁后的异步回调不再更新场景。
- 异步模型保持现有统一 factory 和加载过期守卫，不绕过 AssetEngine 自己创建加载器。
- 状态更新原地执行；结构参数变化按既有 handler 契约返回 rebuild。不得每条状态消息重建场景、重载模型。
- 按需渲染下，数据变化须触发既有失效通知；不能靠强制持续渲染掩盖缺失通知。

## 6. 最小业务数据接入契约

### 6.1 固定入口

`data/adapter.ts` 导出 `createDataAdapter(handle)`，返回 `apply(records)` 与 `dispose()`；`data/connect.ts` 导出 `connectData(adapter)`，返回释放函数。允许必要上下文参数，但实施时需统一母版、样例和文档签名。

- `types.ts` 定义当前场景实际使用的业务字段，不用一份无限宽泛 DTO 声称适配所有领域。
- `apply` 接受批量增量更新并返回结构化结果：成功更新 ID、未变化 ID、问题列表（记录序号/业务 ID/错误码/可读原因）。
- 问题至少区分：未知 ID、重复映射、非法字段值、已销毁、应用失败。
- 无效记录不阻止独立有效记录；单条记录的字段校验失败时不应用该记录。不可声称整个批次具备数据库事务回滚。
- 不默认吞错或每帧刷日志；调用方可以用返回结果展示和定位问题。

### 6.2 ID 与字段规则

- 外部业务 ID 显式映射到稳定场景节点 ID，不按数组下标、名称模糊匹配或当前位置关联。
- 没有独立外部 ID 时允许两者相同；映射仍由 adapter 负责。
- 未知 ID 报告问题，不悄悄创建节点。增删设备属于显式场景操作，第一版不伪装成状态更新。
- 外部消息只允许更新明确列出的业务字段。默认禁止修改 `assetId`、parentId、位置、槽位、材质库与结构参数。
- 缺省字段保持原值；`undefined` 不写入；`null` 仅在 DTO 明确允许清空时接受；数字必须有限并满足业务范围。
- 本接口是增量语义，批次未出现的设备不删除。后端全量快照先由连接层显式转换，不能猜测。
- 同批同 ID 按输入顺序应用有效记录；重复同值更新计入未变化，不重建模型。

### 6.3 防止丢失 params

业务 patch 必须与节点**当前** params 合并后再调用 `handle.update`，保留未修改字段和编辑结果。示例应证明：

```text
更新前：{ assetId: 'forklift', capacity: 2, status: 'normal' }
业务消息：{ id: 'forklift_01', status: 'warning' }
更新后：{ assetId: 'forklift', capacity: 2, status: 'warning' }
```

- 第一版仅对 DTO 约定的顶层字段合并；嵌套对象若需要局部更新，必须定义规则，不能默认无限深合并。
- 不能只缓存启动数据：编辑器、撤销或其他 SceneHandle 更新之后，adapter 必须读到当前值。
- 若现有公开 API 无法高效读取节点数据，补一个只读节点数据接口（返回快照/副本），而非每条消息序列化整个场景。
- 删除节点后再收到消息应报未知 ID；不得复活已删除节点。

### 6.4 示例与默认行为

提供一个手动调用的最小例子：模拟后端两条状态消息，展示卡片与状态外观同步、结构和位置不变。放在二开文档或维护夹具，不默认运行模拟定时器。

文档讲清：接真实接口通常只改 `types.ts`、`adapter.ts` 与 `connect.ts`；新增设备形态才修改 `scene/handlers` 和 profile。场景配置不需要经业务适配器才能修改。

## 7. 数据、外观和编辑的职责

- `public/scene-data.json`：节点关系、摆放、业务/结构参数，以及合法的 scene/camera/lights/controls/renderer 舞台设置。
- `scene/appearance.ts`：当前场景默认材质、状态视觉和注册逻辑。
- 编辑外观：沿用现有 visual override / material library，不能被业务更新无意覆盖。
- `scene/generated/appearance.ts`：导出工具产生的编译结果，不要求二开者手改；不得作为另一份手维护的默认配色表。
- 保留当前引擎已定义的状态外观与编辑覆盖优先级，并在文档明确。通过回归证明迁移前后一致，不在目录整理时暗改优先级。

## 8. 生成、构建与导出闭环

需要一并核对的入口：

| 部位 | 必须完成 |
|---|---|
| template | 目录与装配迁移，业务/核心拆分，增加最小数据接入入口 |
| 初始化/空工程裁剪脚本 | 新目录正确复制与裁剪；空工程不残留示例注册和无效 import |
| profile 与生成规则 | 新业务固定写入 scene；不再提示修改 core 或晚注册重喂数据 |
| 构建/组合体静态检查 | 扫描新业务目录；继续检查槽位、生命周期和依赖边界 |
| 离线构建 | 新目录能打包，资源仍本地化；保留 index.3d.html |
| strip-edit / 外观编译 | 编译外观新路径一致；无 edit 引用；含必要 data 与 scene 源码 |
| 集成文档 | 与真实启动和 API 一致，删除失效路径、陈旧限制和矛盾规则 |
| 维护测试 | 更新新路径和空工程夹具；新增数据接入定向覆盖 |

- 剥离包是可二开的独立源码工程，不只是 HTML，也不需要依赖源仓库相对路径。
- 默认包与剥离包都使用同一个 profile、业务 handler 与 adapter；不能复制一套专用实现。
- 仅在维护时跑涉及的构建/导出回归。正常场景生成仍沿用现有构建与最多两轮修复，不增加第二套检查入口。
- 结构检查并入现有检查器；能由编译捕获的错误不再写重复扫描规则。
- 不创建 skill 内 node_modules、日志、测试、benchmark 或演示工程。

## 9. 二开文档必备内容

1. 安装、开发、构建和预览命令，需与产物 package.json 实际脚本一致。
2. 一张目录职责表：布局数据、设备形态、默认外观、状态数据、卡片分别改哪里。
3. 从固定业务 ID 更新设备状态的可复制例子，包括成功、未知 ID 与非法值结果。
4. `handle.update` 的替换语义与 adapter 增量语义的区别。
5. 订阅接入与销毁示例；没有后端也能启动静态场景。
6. 编辑保存/离线回传与剥离后的外观来源，明确何时真正持久化。
7. 故障定位表：未注册类型、模型加载失败、槽位重复/非法、finish 后使用、批次材质实例冲突、状态不刷新、性能异常。
8. 可改区域与核心扩展边界；不再一边禁止修改 core，一边要求开发者在其中写业务。

文档示例要使用当前 API，不写不存在的接口。避免把维护测试说明塞进设计师的正常生成流程。

## 10. 验收标准与实施批次

### P1：统一分层及文档

- core 无 scene/data/edit 反向依赖。
- 空工程、内置示例工程均能生成与构建，业务建树前注册一次。
- 离线构建与按需 strip 可用，编译外观一致，裁剪无悬空 import。
- 相关 SKILL/reference/产物文档无旧路径或晚注册指导。

### P2：数据接入闭环

- 状态 patch 保留 assetId 与全部未更新 params；外部修改后更新不会回退数据。
- 同值重复更新不重建；状态更新不改位置、不重载 GLB；按需渲染能显示变化。
- 非法数字、未知 ID、重复映射、空批次和销毁后消息都有明确结果。
- 节点删除、撤销之后映射/读取行为正确，旧消息不复活节点。
- 订阅释放幂等，无销毁后写入；默认工程无后台模拟或真实网络连接。

### P3：交付整体回归

- 用新模板生成一个最小业务场景，按文档接入一次模拟状态消息。
- 完整源码实际构建、离线构建、剥离源码独立构建均通过。
- 定向验证模型加载、选中/材质编辑、保存再载入、撤销、编译外观和性能设置未退化；不跑无关全量 benchmark。
- 维护夹具可用浏览器验证必要运行行为；这些测试不成为用户生成时的必跑门禁。
- 生成产物目录结构一致；业务文件随场景变化，但接入位置与职责不变。

三个批次是实施组织，不要求每批人工批准。每次提交审核前检查整个改动闭环，不能只修一个报错就宣称完成。

## 11. 实施回填与交接

实施者在本文末尾回填，不以改写验收要求代替实现：

| 批次 | 状态 | 修改文件/职责 | 实际执行命令与结果 | 未完成与风险 |
|---|---|---|---|---|
| P1 | 完成 | scene/core 分层、脚手架、编译外观与文档 | 生成/组合体夹具及独立构建通过 | 不自动迁移旧工程 |
| P2 | 完成 | data/types、adapter、connect；getNodeData/onDispose | 真实 SceneEngine 适配器与浏览器接入通过 | 真实后端字段仍需项目适配 |
| P3 | 完成 | 源码/离线/剥离构建、编辑与材质回归 | 见下方证据 | 未做内网真实服务验收 |

- 写清实际 API 签名、最终目录、相对本方案的必要调整及原因。
- 证据提供最小复现、命令与结果，不粘贴大量日志，不以 mock 检索成功声称内网验收。
- 不打发布 ZIP、不改已有 demo、不自动提交，除非用户另行要求。
- 完成后交回：『统一生成工程与二次开发 Spec 已实现并回填，请整体 review_execute，重点检查目录/生成/导出闭环、业务 patch 不丢参数、生命周期与编辑态回归。』


## 12. 实施回填（2026-10-28）

### 最终结构与 API

- 当前场景业务迁移到 `template/src/scene/handlers`、`scene/cards`、`scene/appearance.ts`，通用 registry/composite/canvas-texture 保留 core。空工程裁剪示例业务，demo 保留。
- `scene/generated/appearance.ts` 经 boot 显式传入通用 appearance-runtime，core 不再反向读取场景编译文件；导出编译器和结构检查已同步。
- `createDataAdapter(handle, mappings?) -> { apply(records), dispose() }`；省略 mappings 使用同名 ID，传入后只接受映射表中的 ID。最小 DTO 为 status/spin/speed；生成具体场景时按业务收敛/扩展并同步校验、handler 或卡片响应。
- `connectData(adapter) -> () => void` 默认无网络连接。boot 返回 adapter 并注册连接释放。
- `handle.getNodeData(id) -> { type, node } | null` 返回当前节点深副本，不全场景序列化；`handle.onDispose(callback)` 返回取消订阅函数，dispose 幂等。
- 业务更新同批顺序执行；未知/重复映射、非法值、销毁后消息有结构化问题，不隐式新增/删除。
- 正常生成构建流程未新增浏览器门禁；浏览器验收仅在 skill 维护测试中执行。

### 实施时发现并修复的边界

真实编辑测试发现：业务状态更新会覆盖已编辑颜色，原先文档声称的编辑覆盖优先未完整落实。本轮显式修复为业务默认值先应用、编辑覆盖后重放、库材质订阅最后重挂；不是只改文案或放宽测试。

- 原地更新重放前后均做资源归属同步，避免临时材质克隆泄漏。
- GLB 完成加载时使用节点最新 params，再执行编辑外观重放，避免加载过程中收到的状态被初始参数覆盖。
- 结构重建后的 updated 通知在新实例创建后发出。
- 两个旧 Bridge 测试夹具缺少之前按需渲染新增的 renderLoop.invalidate，补齐夹具接口；没有放宽生产判定。

### 实际验证

以下命令均在仓库根目录执行：

| 命令 | 结果 |
|---|---|
| `node tests/generate-3d-scene/secondary-development-fixtures.mjs` | 真实引擎验证参数保留、节点身份、最新数据、输入校验、ID 映射、顺序更新、删除/恢复、释放；20 次状态/编辑材质更新只保留当前材质，替换材质恰好释放一次 |
| `node tests/generate-3d-scene/secondary-development-integration.mjs` | 新 demo 实际 TypeScript/Vite 构建、离线构建、真实 WebGL 编辑、GLB/卡片/状态/按需刷新、快照隔离、编辑撤销、颜色保留、dispose；剥离后源码独立构建与运行验证通过 |
| `node tests/generate-3d-scene/generation-fixtures.mjs` | 空工程、共享依赖、稳定布局 ID、离线构建通过 |
| `node tests/generate-3d-scene/efficiency-fixtures.mjs` | 新目录组合体脚手架、合并/释放、离线构建、类型检查缓存与错误修复回归通过 |
| `node tests/generate-3d-scene/p1-fixtures.mjs --node-only --filter="P2-RRR1\|P4"` | 注册与编译外观相关 14 项通过 |
| `node tests/generate-3d-scene/p1-fixtures.mjs --node-only --filter="P3\|P4"` | 生命周期、资源归属、编辑撤销、编译外观及多文件模型导出相关 35 项通过（实际命令中竖线不带反斜杠） |
| `node tests/generate-3d-scene/render-settings-browser.mjs C:/Users/Tony/AppData/Local/Temp/scene3d-efficiency-ZczUF7/offline/index.3d.html` | 真实 WebGL 按需休眠/唤醒、画质档位、像素比、帧率、撤销和保存通过 |
| `node tools/generate-3d-scene/pack-skill.mjs --check` | 192 个生产文件检查通过，没有生成 ZIP |
| `git diff --check -- skills/generate-3d-scene tests/generate-3d-scene` | 通过 |

集成夹具输出：`C:/Users/Tony/AppData/Local/Temp/scene3d-secondary-qsnOT3/source`。测试中刻意使用本地微型 GLB，不代表内网检索验收。导出测试的 headless 槽位扫描会输出预期的占位加载提示；实际浏览器模型加载成功，并验证外观。

### 范围与剩余限制

- 老工程没有自动迁移；新的目录/API 适用于后续生成工程。旧源码若使用新版维护构建器，需要按新目录迁移，不能只替换单个脚本。
- 后端字段、认证、协议和业务状态由具体项目接入；本轮交付的是明确接入位置和可运行示例，不宣称任意后端零配置可用。
- 未添加生产依赖、未改已有仓库 demo、未打发布包或提交 Git。


## 13. 第二轮：可替换 3D 包与外部业务（已实现）

用户于 2026-10-28 授权本轮。以下取代前文相冲突的目录、注册和装配约定；第一轮验收记录保留作为历史证据。

- `src/scene3d/` 包含 `index.ts` 公开入口、内部场景装配、scene-profile、scene-core、scene/handlers、appearance、generated。
- `src/business/data/` 保存 DTO、后端字段与 ID 映射、连接；`src/business/cards/` 保存 Vue 组件、样式和注册表。
- `src/boot-scene.ts` 是外部应用装配器，引用 business 并调用 createScene3D。包不得反向 import business、App、boot 或 edit。编辑器继续作为包外的通用应用工具维护。
- `public/scene3d/` 保存 scene-data.json、assets 和离线资源清单；整场景更新替换 src/scene3d 与 public/scene3d，不覆盖 business、App 和应用 boot。
- `createScene3D(host, {cards?, cardContext?, assetBaseUrl?, data?})` 返回 SceneHandle；包不创建后端连接。
- 安全的节点参数增量合并在 SceneHandle.patchNodeParams；adapter 只负责业务规则与 ID 映射。
- 卡片注册名称是业务自定义标识，节点 card.type 与其匹配；不固化 equipment 等示例名。
- Vue 卡片以 VNode patch 更新 props，同类型保留实例，换类型/删除/销毁时卸载；支持外部 AppContext（全局 provide、组件、插件上下文），不自动继承任意祖先组件的局部 provide。
- 同步生成、模型注入、资源定位、编辑保存、离线构建、strip、文档与维护测试；正常生成不加浏览器验收门禁。
- 验收重点：复制替换两个 scene3d 目录后业务文件字节不变；真实卡片组件状态、props 更新、应用上下文与卸载正确；完整/离线/剥离工程能运行。
- 固定节点 ID、card.type 和数据 API 是替换兼容前提；更改这些业务契约不是无损升级。不自动迁移旧项目、不发布 ZIP、不提交。


## 14. 第二轮实施与验证（2026-10-28）

### 已实现

- 两个可替换目录为 `src/scene3d/` 和 `public/scene3d/`；外部 `src/business/data`、`src/business/cards`、`boot-scene.ts` 保留。公开入口 `createScene3D` 返回 SceneHandle，不连接后端。
- 新增 `patchNodeParams(id, patch)` 合并当前参数，undefined 不覆盖旧值。业务 adapter 调用公开接口。
- 卡片通过外部 registry 和可选 AppContext 注入，同类型 props 更新保留组件状态，换类型/删除/销毁正确卸载。
- 资源清单按 base URL 缓存并绑定到各引擎，模型解析与 Draco 路径随包资源目录定位。
- 初始化、空工程裁剪、模型注入、离线打包、编辑保存、外观编译和剥离工具同步新路径。构建检查拒绝 scene3d 反向依赖包外业务。
- 固定 canvas ID 由外部应用 boot 设置，包本身不固定 DOM ID。旧维护测试改用真实画布引用，并按当前复制修改流程验证保存。

### 验证证据

- `secondary-development-integration.mjs`：替换两个 scene3d 目录后，外部业务、Vue 卡片与 boot 字节不变；反向依赖负例被构建检查拒绝。实际 TypeScript/Vite、离线构建和剥离后独立构建通过。
- 同一真实浏览器测试验证：GLB 加载、参数更新、输入状态保留、应用 provide/全局组件、组件类型切换、删除卸载、dispose 幂等；编辑撤销后参数更新与编辑材质保留；剥离后业务状态/卡片仍工作。
- 最新集成产物：`C:/Users/Tony/AppData/Local/Temp/scene3d-secondary-U1M25B/source`。
- `secondary-development-fixtures.mjs`、`generation-fixtures.mjs`、`efficiency-fixtures.mjs` 通过。
- `p1-fixtures.mjs --node-only --filter="P2-RRR1|P3|P4"`：37 项通过，覆盖注册、生命周期、编辑材质和编译导出。
- `render-settings-browser.mjs`：画质、按需休眠/唤醒、小数像素比、帧率、自定义配置、撤销与保存回归通过。
- `pack-skill.mjs --check`：195 个生产文件通过，未生成 ZIP。

### 交付边界

本轮不自动迁移已有工程、不更新仓库 demo、不提交 Git、不发包。复制替换仍要求节点 ID、card.type 和 API 兼容；不等同于任意两个场景无损互换。内网服务未作真实验收，维护测试使用本地资产与测试服务。

- 模型注入专项：在 skill 目录执行 `node ../../tests/generate-3d-scene/designer-assets-fixtures.mjs` 通过。覆盖上传包依赖、预览、确认、导出、注入离线工程、断网 file:// 运行/编辑/贴图/复制保存/导入，以及测试服务检索下载；产物 `C:/Users/Tony/AppData/Local/Temp/designer-assets-VwcAic`。测试服务结果不代表内网验收。
- 最终 `git diff --check` 通过。


## 15. review_execute 整体复核（2026-10-28）

### 范围与结论

用户要求整体检查重构后的遗漏、前后矛盾和优化点。本轮只审查、执行维护探针并回填 Spec，没有修改生产代码、测试代码或发布包。此前“已实现/回归通过”记录为当时证据，不等于以下边界也已通过。

**Overall Verdict：FAIL，暂不关闭本轮重构。** 目录分离方向成立，常规生成/导出与既有回归通过；存在资源路径接线遗漏、启动失败清理、卡片互斥状态和外部依赖边界问题。无需再次推翻目录结构，集中修复下列问题。

| Review Matrix 轴 | 结论 | 证据 |
|---|---|---|
| Spec/计划一致性 | FAIL | assetBaseUrl 契约未完整传入内建 asset 工厂；外部业务使用 Pinia 与全 src 裸导入白名单冲突 |
| 实现/验证一致性 | PARTIAL | 原有参数与资源测试、37 项相关回归通过；新增失败路径与卡片交互探针复现遗漏 |
| 正确性/可维护性/性能 | FAIL | 初始化异常未释放资源；卡片刷新恢复已关闭项；逐条参数更新触发全量卡片扫描 |

### SD-R1 [P1] 内建模型工厂忽略当前实例资源基址

- 位置：`template/src/scene3d/scene-core/createScene.ts:236`。
- 资产清单已通过 bindAssetManifest 绑定 engine，但此处调用 `makeAssetUrlResolver()` 没传 assetEngine，落回全局 cached 和固定 scene3d/ 基址。
- 浏览器探针传 `/custom/`，捕获实际交给 getInstance 的地址为 `scene3d/assets/models/a.glb`，预期 `/custom/assets/models/a.glb`。自定义部署位置不能按公开接口工作；并发多个基址还可能取到其他实例缓存。
- 修复：内建注册使用 `makeAssetUrlResolver(assetEngine)`，覆盖自定义目录与并发两个清单的定向测试。

### SD-R2 [P2] 启动阶段抛错没有完整回收

- 位置：`template/src/scene3d/create-scene.ts:35-44`，内部 `scene-core/createScene.ts` 初始化过程。
- createScene 在 renderer、控制器、加载徽标、CSS2D、RenderLoop 已创建后才执行 profile/建树。抛错发生在返回 handle 之前，外层 catch 的 handle 仍 undefined，移除 canvas 不能释放渲染器和监听器。
- 浏览器让 profile 抛 `broken handler`：RendererEngine.dispose 调用数为 0，容器额外残留 2 个元素。公共 wrapper 删除 canvas 也无法回收这些内部资源。
- 修复：内部初始化用分阶段 cleanup 栈/try-catch；资源创建成功立即登记释放，失败反序回收；成功再交由 handle.dispose。增加 profile/建树失败后清理与重建测试。

### SD-R3 [P2] 数据刷新重新打开已关闭的点击卡片

- 位置：`template/src/scene3d/scene-core/cards/registry.ts:254-255`，与 `:217` 联动。
- 点 A 再点 B，只把 A 的 visible 设 false，没有从 clickToggled 删除 A。下一次 refresh 按集合重算，A/B 同时打开。
- 浏览器复现：点击后 `[A:false,B:true]`，refresh 后 `[A:true,B:true]`。后端参数更新会触发同一 refresh，所以生产数据到达就可能让旧卡片弹回。
- 修复：互斥关闭同步移除 toggle 标记；覆盖点击切换后数据刷新和第二次点击行为。

### SD-R4 [P2] 外部业务依赖仍被引擎白名单拦截

- 位置：`scripts/build.mjs:319-335`。
- 文档承诺外部卡片可使用 Pinia/组件库/国际化，但 whitelist 扫所有 src，只有 vue/three/a3d。临时工程声明 pinia 依赖并在 `src/business/cards/store.ts` 导入，checkProject 仍报白名单违规。
- 修复：明确生成时引擎依赖限制与二开业务依赖的边界。外部业务允许工程声明的依赖，或提供项目级可配置规则；保留 scene3d 的受控依赖和反向依赖检查。不应要求业务方修改 skill 校验器，也不能只删除文档承诺。

### SD-R5 [P2] 批量数据更新造成平方级卡片扫描

- 位置：`template/src/business/data/adapter.ts:37-89` → `scene-core/createScene.ts:442` → 卡片全量 refresh。
- adapter 每条记录独立 patch，每次 patch 又遍历全部节点、同步全部卡片。同批 M 条、N 个带卡片节点，扫描约 O(M×N)。
- 浏览器探针：200 个轻量 Group/空 Vue 卡片，200 次参数更新，计数 120200 次 getNode，当前设备约 107ms；这是探针环境耗时，不是生产帧率承诺。实际卡片更复杂时风险更高。
- 修复：同批合并更新，或增量同步受影响卡片/合并刷新；保留重复 ID 顺序语义、同类型实例状态和单条错误隔离。没有必要引入复杂状态框架。

### SD-R6 [P3] 格式化与 lint 忽略目录未同步迁移

- 位置：`template/.prettierignore:9-13` 及后续旧 scene-core 路径；`template/eslint.config.mjs:326`。
- 仍忽略 public/assets 和 src/scene-core/generated；实际目录已移到 public/scene3d/assets 与 src/scene3d/scene/generated。内置 npm lint/format 会扫到原本排除的 Draco 厂商源码和生成代码，旧引擎豁免也失效。
- 修复：同步真实路径，验证厂商/生成文件仍被排除；不要借机全库格式化。少量 main.ts/createScene.ts 注释仍称卡片在 scene-profile 注册，顺便更新为外部 registry。

### 本轮验证与证据边界

- `node tests/generate-3d-scene/secondary-development-fixtures.mjs` 通过。
- `node tests/generate-3d-scene/p1-fixtures.mjs --node-only --filter="P2-RRR1|P3|P4"`：37 passed / 0 failed；headless GLB 占位提示属测试预期。
- `node tools/generate-3d-scene/pack-skill.mjs --check`：195 文件通过，未打 ZIP。
- 临时浏览器探针：`C:/Users/Tony/AppData/Local/Temp/scene3d-review-probe.mjs`；结果 `C:/Users/Tony/AppData/Local/Temp/scene3d-review-0owGPI/result.json`。真实浏览器使用当前源码；资产测试替换 getInstance 以捕获请求 URL，不声称这一步验证了真实下载。
- 外部 Pinia 静态检查复现工程：`C:/Users/Tony/AppData/Local/Temp/scene3d-review-import-k0onGd`。
- 未重复所有历史测试；未调用内网真实服务；未做审美验收。

### Plan-Execution Diff / 下一步

整体目录及公开 API 按计划落地，但验证只覆盖默认基址、正常启动和单卡片更新，未覆盖上述外部接入与失败路径；上轮完结判断过早。下一批集中修复 SD-R1～SD-R6，按每项触发条件补定向回归，再跑现有相关测试。不新增正常生成时的浏览器门禁，不重做目录、不扩展业务范围。


## 16. SD-R1～SD-R6 集中修复（完成）

用户已授权修复。沿用第 15 节范围，补齐资源绑定、初始化清理、卡片互斥与工具路径；应用层放行 package.json 声明的运行依赖，引擎和编辑器继续使用受控白名单。新增同步 batchUpdates，adapter 在批内仍逐条处理/隔离错误，卡片最后刷新一次；该接口不回滚、不用于跨 await 的异步事务。维护回归置于 tests，不增加默认生成门禁。


### 修复结果与复核

| 项目 | 结果 | 实现/验证 |
|---|---|---|
| SD-R1 | PASS | 内建 asset 工厂传入 assetEngine；浏览器捕获两个实例分别使用 /custom/ 与 /other/ 的模型 URL |
| SD-R2 | PASS | 资源创建后立即登记 cleanup，失败/正常销毁统一逆序释放；profile 抛错和建树第二节点抛错均释放 renderer，后者还验证已创建 geometry 释放，DOM 零残留；点击监听与 HUD 一并释放 |
| SD-R3 | PASS | 互斥关闭同时清除 clickToggled，A→B→refresh 后仍只显示 B；点击变化唤醒按需渲染 |
| SD-R4 | PASS | 应用目录允许已声明 dependencies/optionalDependencies/peerDependencies；受控 scene3d/edit 不放宽。测试 Pinia/作用域包子路径成功，未声明、近似包名和 core 越界导入失败 |
| SD-R5 | PASS | 新增同步 batchUpdates，默认 adapter 逐条校验/应用，最后刷新卡片。200 条更新 getNode 从 120200 降为 1000，通知一次；重复 ID 顺序、坏记录隔离、嵌套及异常后的刷新均验证 |
| SD-R6 | PASS | lint/format 忽略目录迁移，保留厂商、生成文件和迁移前存量示例豁免；更新 main/build/createScene 注释与接入文档 |

本次集成测试发现批次封装初版会在销毁后直接抛错，已修复：adapter 保持既有逐条 disposed 问题返回约定，销毁后不再开启批次。修正后重新执行完整集成测试通过，没有放宽断言。

### 实际执行

- `node tests/generate-3d-scene/secondary-boundaries.mjs`：新增真实浏览器定向回归通过；测试替换资产加载方法以捕获 URL，不冒充真实下载。性能数字仅为此设备轻量夹具结果，结构指标为 1000 次读取/一次卡片通知。
- `node tests/generate-3d-scene/secondary-configuration.mjs`：业务依赖边界及真实 ESLint/Prettier 忽略规则通过。
- `node tests/generate-3d-scene/secondary-development-fixtures.mjs`：适配器和材质资源归属测试通过。
- `node tests/generate-3d-scene/secondary-development-integration.mjs`：真实源码/离线/剥离构建，WebGL/GLB、外置 Vue 状态与上下文、编辑/撤销/保存、销毁后数据更新通过。产物 `C:/Users/Tony/AppData/Local/Temp/scene3d-secondary-niVvwJ/source`。
- `node tests/generate-3d-scene/p1-fixtures.mjs --node-only --filter="P2-RRR1|P3|P4"`：37 passed / 0 failed。
- `node tools/generate-3d-scene/pack-skill.mjs --check`：195 文件通过，未打 ZIP。
- `git diff --check`（限定本任务文件）：通过。

本轮六项评审问题已关闭。测试仅用于维护，默认生成流程未增加浏览器门禁。未修改已有 demo、未提交、未发布；工作区其他 skill 的既有/并行改动未触碰。batchUpdates 是新增公开能力，旧自定义 adapter 不要求立即迁移；新默认 adapter 需配套本版 SceneHandle。


## 17. SD-R1～SD-R6 修复后 review_execute（2026-10-28）

**Overall Verdict：PASS。本轮六项修复范围内未发现新的阻塞问题。** 本次只复核与回填，没有修改实现或增加生成门禁。

| Review Matrix 轴 | 结论 | 依据 |
|---|---|---|
| Spec/计划一致性 | PASS | 当前引擎绑定资源基址；初始化 cleanup；点击互斥集合与显隐同步；外部声明依赖与受控目录区分；同步批次；迁移后的工具忽略路径均落实 |
| 实现/验证一致性 | PASS | 重跑三组定向夹具；正常构建/离线/编辑/剥离集成沿用上轮通过证据，核心变更文件与当时产物逐字节一致 |
| 正确性/性能/维护性 | PASS（本轮范围） | 两实例目录隔离；两种启动失败资源释放；卡片刷新不复开；批量顺序/错误隔离/异常刷新；声明依赖正反例与忽略规则通过 |

### 本次实际执行

- `secondary-boundaries.mjs` 通过：注册失败和建树失败 renderer 各释放一次，建树前已创建 geometry 释放一次，附加 DOM 为 0；两个模型 URL 分别使用 custom/other 基址；A→B→refresh 仍仅 B 显示；200 条更新读取 1000 次、通知 1 次；重复 ID 顺序、单条错误及嵌套异常刷新通过。结果 `C:/Users/Tony/AppData/Local/Temp/scene3d-review-wpRq9C/result.json`。
- `secondary-configuration.mjs` 通过：应用声明依赖及作用域子路径放行；未声明、近似名称与受控目录导入拒绝；ESLint/Prettier 真实忽略规则通过。
- `secondary-development-fixtures.mjs` 通过：参数保留、编辑后当前数据、映射与输入校验、顺序更新、删除恢复、销毁及 20 次材质资源归属回归。
- `pack-skill.mjs --check`：195 文件通过，未生成 ZIP；限定本任务文件的 `git diff --check` 通过。
- 核对当前 createScene.ts、cards/registry.ts、business/data/adapter.ts、create-scene.ts、asset-manifest.ts 与上轮集成工程 `scene3d-secondary-niVvwJ/source/src`，五个文件逐字节一致，因此本次不重复全套构建、浏览器集成和 37 项历史回归；这些结果仍引用第 16 节，不冒充本轮重跑。

### Plan-Execution Diff 与边界

本轮无新增实现偏差，SD-R1～SD-R6 维持关闭。batchUpdates 明确只支持同步批次、不回滚已执行更新；外部依赖仍由接入项目安装；新增 API 需配套当前 SceneHandle。未作真实内网服务验收，也不将本轮范围内 PASS 解释为全仓库不存在缺陷。
