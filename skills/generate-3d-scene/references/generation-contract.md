# 生成契约速查

普通生成以本页与最小样例为准；只在遇到具体接口疑问时查对应定义，不通读引擎、材质或编辑器实现。

## 环境与工程

- `node scripts/ensure-env.mjs`：每个会话检查一次；失败执行 HINT 的 setup 命令。
- 没有 Node：Windows 用 `powershell -ExecutionPolicy Bypass -File "<skill>/scripts/install/install.ps1"`；macOS 用 `bash "<skill>/scripts/install/install.sh"`。下载和 npm 源策略与 EP 相同。
- 依赖安装在外部环境；`GTS3D_ENV_DIR` 可指定位置。不要在 skill/template 中执行 npm install。
- `node scripts/init.mjs <工程> --profile empty --assets referenced --deps shared --defer-build`。
- 空工程默认不登记示例业务。先创建工程，再写自定义 handler、scene-profile 和 scene-data；不要把尚未注册的自定义分组通过 init 的 --scene 提前传入。
- 自定义依赖/组件工程使用独立依赖；不要在连接共享 node_modules 的工程执行 npm install。需要独立依赖时初始化使用 --deps copy 或 --deps install。

初始化后的工程是修改依据：empty 会裁剪示例导入与卡片，不能用 template 中的 demo 同名文件覆盖。先读目标现状，只局部修改。

## 最少需要改哪些文件

1. `public/scene-data.json`：保留舞台配置，填写业务分组数组。
2. `src/scene-profile.ts`：工厂只在 BUSINESS_REGISTRARS 登记一次；卡片按需登记。
3. 新建 handler；材质默认值在代码中。内建 asset/图元足够时不新增 handler。

通常不修改 scene-core/index.ts、handlers/index.ts、引擎、编辑器或构建脚本。业务 handler 在 scene-profile 直接导入，不需要新增 barrel 导出。

可直接拷贝 `scripts/scaffolds/block-handler.ts` 到工程的 `src/scene-core/handlers/block.ts`，然后在 scene-profile 中导入并登记：

```ts
import { registerBlockHandler } from './scene-core/handlers/block';
// BUSINESS_REGISTRARS 内：
blocks: ({ sceneEngine }) => registerBlockHandler(sceneEngine),
```

对应场景片段：

```json
{"blocks":[{"id":"block_1","position":[0,0,0],"rotation":[0,0,0],"scale":1}]}
```

## 类型、生命周期与编辑

- 类型使用 `import type`（verbatimModuleSyntax）；数组/Record 索引可能为 undefined（noUncheckedIndexedAccess），先判断或提供明确默认值。noUnusedLocals/noUnusedParameters 开启：不用的形参直接省略，或在确实不需要时用 `_` 前缀；不要用改名掩盖漏挂载等逻辑问题。
- SceneNode 的节点字段：id、parentId、position、rotation、scale、params、card。position/rotation 是三个有限数；旋转用弧度，Y 向上。scale 是正数或三个正数。
- params 承载业务/结构参数；颜色、贴图、roughness 等外观写代码，用户编辑由已有视觉层保存。
- handler create 返回 Object3D；参照样例调用 applyTransform，不在子网格重复乘节点变换。
- update 返回 `updated` 表示已原地更新；结构变化返回 `rebuild`。引擎负责几何与材质资源释放；自建计时器、帧监听等在 dispose 中解除。
- 子网格命名稳定、同父级唯一，用 snake_case；材质/局部变换编辑依赖名称路径。
- 每个需单独编排的对象保留独立节点 ID；不为了减少 draw call 擅自合并成不可单独编辑的实例。
- GLB 业务工厂使用 makeAssetNodeFactory；禁止另写加载、蒙皮克隆和异步过期处理。具体签名只查 handlers/registry.ts 的该导出。
- 帧回调 `(delta: number, elapsed: number) => void`；只使用 delta 时可省略 elapsed。onFrame 返回取消订阅函数。
- SceneHandle 从 `scene-core` 公开入口导入。update 缺失字段不变、params 整块替换、remove 先执行。编辑器不深层导入 engine。
- 普通场景不必创建业务卡片；需要时查 scene-engineering.md 的 card 小节。

## 准确接口与舞台字段

```ts
engine.registerFactory(type, definition); // 或旧式 (node) => Object3D | null
// NodeFactoryDefinition（不使用的尾部形参可以省略）：
create(node: SceneNode, ctx: FactoryContext): THREE.Object3D | null
update?(object: THREE.Object3D, next: SceneNode, previous: SceneNode,
        ctx: FactoryContext): 'updated' | 'rebuild'
dispose?(object: THREE.Object3D, ctx: FactoryContext): void
// ctx: { sceneEngine, assetEngine, renderLoop }
```

update 仅在 params 改变时调用；transform 更新由引擎完成。返回 updated 前必须已真正应用变化；缺省 update 时 params 变化会重建。dispose 解除工厂自己的监听/闭包，不重复释放已交给引擎的网格资源。

| 配置 | 合法常用字段 |
|---|---|
| scene | background: hex/null；environment: {intensity}/null；fog: {type:'linear',color,near,far}/null |
| camera | type: PerspectiveCamera/OrthographicCamera；position、lookAt；near、far；透视 fov；正交 orthographic:{left,right,top,bottom} |
| lights[] | id、type、intensity；color、position；DirectionalLight/SpotLight 的 target |
| 光源类型 | DirectionalLight、AmbientLight、PointLight、HemisphereLight、SpotLight、RectAreaLight |
| 光源特有项 | Point/Spot: distance、decay；Spot: angle（弧度）、penumbra；Hemisphere: groundColor；RectArea: width、height |
| 阴影 | castShadow、shadowMapSize、shadowBias；Directional: shadowCameraNear/Far/Left/Right/Top/Bottom（均为平铺字段） |
| controls | type: OrbitControls、target、minDistance/maxDistance、minPolarAngle/maxPolarAngle、enablePan、autoRotate/autoRotateSpeed、enableDamping/dampingFactor、zoomSpeed |
| renderer | toneMapping: NoToneMapping/Linear/Reinhard/Cineon/ACESFilmic/AgX/Neutral；exposure；shadowMap: Basic/PCF/PCFSoft/VSM；shadowMapEnabled；maxPixelRatio |

保留模板的有效默认值，只修改场景确实需要的字段。纯几何需求不要求评估组件目录；确定需要某个现成组件时才查对应条目。正常生成不读 build.mjs/init.mjs 源码来猜接口。

## 组合体与贴图复用

`three/examples/jsm/**` 与 `three/addons/**` 可导入。组合体优先使用现成的 `procedural/composite.ts`，不用另写 attach/合批管理：

- `createComposite().mesh(name, geometry, material, transform?)`：自动挂载，保留独立材质/变换槽位。
- 推荐 `const frame = builder.batchSlot(name, material)`，再调用 `frame.add(geometry, transform?)`；材质只绑定一次。完成后 `return builder.finish()`。空槽位不生成网格。旧 batch(name, geometry, material, transform?) 保留兼容，同名必须传同一材质实例。每次传新建 geometry，工具接管所有权；不要复用/再次 dispose 输入几何。
- mesh/batch 的 name 使用稳定 snake_case；batch 内零件作为整体编辑。先确定用户需要的编辑粒度，不能把需要单独改材质的零件合并。
- `labelTexture(text, options?)` 自动适配文字；`canvasTexture(width,height,paint)` 用于标线/网格。输出赋给普通材质 map，无外网字体或图片依赖；挂载后由引擎管理资源。
- 完整可编译范式：复制 `scripts/scaffolds/composite-handler.ts` 到工程 handlers/composite-example.ts，登记 registerAssemblyHandler，数据分组为 assemblies。不使用标签时无需创建标签材质。

## 资产与布局

- 默认必须先执行主要对象的批量检索，再编写未匹配对象的几何 handler。仅用户明确要求纯几何/不用模型库时跳过；低多边形、工业风格和速度要求不能作为跳过理由。已确认上传包覆盖的对象不重复查库，地面/墙体/标线等基础结构可直接几何。
- 将缺少的对象类别写入 UTF-8 文件，执行 `node scripts/search-assets.mjs --batch <查询文件> --brief --json`；同类实例仅查一次。依据候选名称/用途选型，不仅看分数；匹配则下载检查注入，无合适候选或请求失败才降级。未调用不得说未命中，请求失败不得说库里没有。不循环改词穷搜。
- 用户包及库模型按 designer-assets.md 接收、确认、下载、注入；无包时直接检索，纯几何跳过。PowerShell 查询文件使用 UTF-8。
- 默认检索来自内网，不再读取 skill 内置模型。文件及依赖物化到工程，运行时离线。未配置检索时如实提示并按需求几何降级。
- 具体尺寸和编辑限制读取模型包 list/package.json，单位未确认时不得宣称为真实米制。向量分数不是匹配正确率。
- `layout-nodes.mjs <patterns.json> <groups.json>` 展开阵列、堆叠或沿直线排列；将结果分组合并进 scene-data，保留舞台配置。例如：

```json
[{"type":"blocks","idPrefix":"rack","counts":[8,1,12],"spacing":[6,0,4],"origin":[-21,0,-22],"node":{"scale":1}}]
```

counts/spacing/origin 顺序均为 X/Y/Z；输出独立节点与稳定 ID，默认不替换已有场景。`node.parentId` 存在时坐标相对父节点。层间间距、通道宽度应来自实际组件尺寸；贴花高度相对承载面设置，不使用全场通用固定高度。

### 多起点、父节点和有限变体

pattern 支持 placements:[{key,origin,parentId?}]。key 为稳定标识，每个起点的节点 ID 为 idPrefix_key_x_y_z；origin 与 pattern.origin 相加，有 parentId 时坐标相对父节点，父节点须由场景提供。

variants:[{params,...}] 按 variantAxis:'x'|'y'|'z'|'index' 循环分配；默认 index，遍历顺序为 X 外层/Y 中层/Z 内层。变体 params 与基础 params 按一级键合并，嵌套对象整体替换；placement.parentId 最后生效。按区段分布可写多个 pattern，不引入条件表达式语言。业务变体用 variant/kind 等语义字段，颜色在 handler 中映射。

复杂布局可保留工程内简短 JS 生成器，导入 `scripts/layout.mjs` 的 expandLayout；不要临时写几百行位置展开逻辑。共享尺寸可以放 `src/layout-recipe.json`，handler 构建时 import，生成器读取同一文件；不运行时 fetch public 文件，不重复抄常量。

可复制 `scripts/scaffolds/layout-recipe.json` 到工程 `src/layout-recipe.json`，运行 `node scripts/generate-layout.mjs`，输出 public/layout-groups.generated.json。生成器与输入随源码交付；默认输出独立分组文件，并拒绝覆盖输入配方和 public/scene-data.json；不要将自定义输出指向编辑器保存文件。首次生成时合并分组，后续重新生成先明确要替换的节点范围，保留人工编辑。

## 一次统一构建

完成全部源码和资源后运行 `node scripts/build-offline.mjs <工程>`。静态、类型、资源、打包顺序执行；失败停止后续阶段，不另加一次 typecheck。

RESULT: OK 后交付 index.3d.html 链接并停止。TIMING 是脚本统计，不是新的门禁；不因性能 WARN、未截图或主观美观重跑。失败最多两轮集中修复。

TypeScript 已显式启用 incremental，缓存位于各工程 .cache；不删除缓存，不只检查单文件，不用正则模拟类型检查。GLSL/几何/材质等运行源码变化必须重新构建预览，不能交付旧包；纯说明文档改动无需构建。成功后不主动开启复核循环，但已明确发现的实际功能错误应修复并重建。

调试器排障：`node scripts/ensure-env.mjs --diagnose` 仅输出是否检测到调试注入，不打印完整环境变量。若出现 Waiting for the debugger to disconnect，关闭宿主终端的自动附加后比较同一命令耗时；不要全局清空 NODE_OPTIONS。需要测编译器本身时在工程运行 `node node_modules/vue-tsc/bin/vue-tsc.js -b --extendedDiagnostics`，只用于诊断，不加入正常生成步骤。

PowerShell 文本读写显式指定 UTF-8，优先宿主编辑工具；不因终端乱码改写整个源文件。调试器反复打印等待信息时检查宿主调试注入，不静默修改全局 NODE_OPTIONS。

## 按需求选择已有实现

| 需求 | 优先路径与边界 |
|---|---|
| 普通 GLB 展示 | 内建 asset 分组 + params.assetId，无需自定义 handler |
| 简单图元 | 内建 Box/Sphere 等；自定义外观用 block-handler 样例 |
| 机柜/车辆/人物 | procedural/rack、car、worker 按需复用；样例的历史 bodyColor 参数仅兼容旧数据，新代码通过外观层编辑颜色 |
| 仓储货架整体展示 | 组件 Rack；框架/层板是 InstancedMesh，不承诺单根立柱独立编排，先确认编辑粒度 |
| 二维热力覆盖 | 组件 HeatMap 输出 CanvasTexture；不是三维体积温度场 |
| 墙体 | 按需查组件 Wall；组件需 --with-components 和独立依赖 |
| 独立零件材质编辑 | composite-handler，稳定槽位；不同业务对象使用独立节点 |

只读命中项对应文档，不遍历所有实现。组件存在不等于符合需求；编辑粒度或离线资源不符时直接用几何组合。

布局合并可复制 scripts/scaffolds/compose-scene.mjs 到工程 scripts。舞台与不规则节点存 scenes/stage.json，配方存 src/layout-recipe.json；脚本输出独立候选 scenes/scene.generated.json，检查节点范围后再用于首次 scene-data，不自动覆盖编辑存档。

保存文件只保证导入保存时使用的同一预览；源码变化重新构建后可能因 sourceId 不同而拒绝旧存档。资产检索未命中时可几何降级，运行时加载失败不等于自动生成替代模型。

## 统一坐标约定

场景和资产使用右手坐标系、+Y 向上、+Z 为资产正面、长度单位米。标准落地资产以底部中心为原点，根节点 position/rotation 为零、scale 为一；不要通过逐模型隐式补偿宣称已标准化。相机局部 -Z 观察方向保持引擎原生约定。未确认的历史资产不能仅标记为米制或已符合正面/原点标准。
