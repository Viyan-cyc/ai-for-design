# 生成契约速查

普通生成以本页与最小样例为准；只在遇到具体接口疑问时查对应定义，不通读引擎、材质或编辑器实现。

## 环境与工程

- 初始化和环境检查顺序见 [主入口](../SKILL.md)「默认生成路径」；本节仅补充环境边界。
- 没有 Node：Windows 用 `powershell -ExecutionPolicy Bypass -File "<skill>/scripts/install/install.ps1"`；macOS 用 `bash "<skill>/scripts/install/install.sh"`。下载和 npm 源策略与 EP 相同。
- 依赖安装在外部环境；`SCENE3D_ENV_DIR` 可指定位置。不要在 skill/template 中执行 npm install。
- 空工程默认不登记示例业务。先创建工程，再写自定义 handler、scene-profile 和 scene-data；不要把尚未注册的自定义分组通过 init 的 --scene 提前传入。
- 自定义依赖与组件包由统一构建入口按 package.json、lockfile 和本地包内容在工程外准备；source 保留依赖清单与 vendor 包，便于独立二开。

初始化后的工程是修改依据：empty 会裁剪示例导入与卡片，不能用 template 中的 demo 同名文件覆盖。先读目标现状，只局部修改。

## 最少需要改哪些文件

1. `public/scene3d/scene-data.json`：保留舞台配置，填写业务分组数组。
2. `src/scene3d/scene-profile.ts`：工厂只在 BUSINESS_REGISTRARS 登记一次；卡片在外部 `src/business/cards/index.ts` 登记，由应用传入。
3. 新建 handler；材质默认值在代码中。内建 asset/图元足够时不新增 handler。

业务 handler 放 `src/scene3d/scene/handlers`，默认外观放 `src/scene3d/scene/appearance.ts`；数据接入放 `src/business/data/{types,adapter,connect}.ts`，默认不联网。scene3d 不依赖 business/boot/App/edit，core 不依赖场景实现或 edit；编辑器通过 SceneHandle 公开入口访问 core。Vue 卡片从外部 cards 参数传入。

通常不修改 scene-core/index.ts、handlers/index.ts、引擎、编辑器或构建脚本。业务 handler 在 scene-profile 直接导入，不需要新增 barrel 导出。

可直接拷贝 `scripts/scaffolds/block-handler.ts` 到工程的 `src/scene3d/scene/handlers/block.ts`，然后在 scene-profile 中导入并登记：

```ts
import { registerBlockHandler } from './scene/handlers/block';
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
- 子网格命名稳定、同父级唯一并符合下方「组合体命名与结束顺序」字符约束。新代码推荐 snake_case，不为风格统一重命名既有槽位；材质/局部变换编辑依赖名称路径。
- 每个需单独编排的对象保留独立节点 ID；不为了减少 draw call 擅自合并成不可单独编辑的实例。
- GLB 业务工厂使用 makeAssetNodeFactory；禁止另写加载、蒙皮克隆和异步过期处理。具体签名只查 handlers/registry.ts 的该导出。
- RenderLoop 的 onFrame/onAfterFrame 回调为 `(delta: number, elapsed: number, simulationDelta: number) => void`；允许只接收前一或两个参数。delta 为活动帧间实际秒数，elapsed 累计活动时间，按需休眠、停止及后台停留不计入。simulationDelta 为 `Math.min(delta, 0.1)`。动画使用 delta，不能用限幅步长推进需要保持真实速度的动画；物理积分需要自行子步计算。onFrame 返回取消订阅函数。业务工厂的动画适配器仍只传 delta。
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
| renderer | toneMapping: NoToneMapping/Linear/Reinhard/Cineon/ACESFilmic/AgX/Neutral；exposure；shadowMap: Basic/PCF/PCFSoft/VSM；shadowMapEnabled；pixelRatio（实际倍率）；shadowMapSize；maxFps（0 不限）；renderMode（demand/continuous）；antialias；logarithmicDepthBuffer |

模板舞台是小场景起点：按实际业务范围设置相机、控制距离、光源位置及阴影覆盖，不能直接沿用固定范围。其他有效默认值可保留。纯几何需求不要求评估组件目录；确定需要某个现成组件时才查对应条目。正常生成不读 build.mjs/init.mjs 源码来猜接口。

## 组合体与贴图复用

`three/examples/jsm/**` 与 `three/addons/**` 可导入。组合体优先使用现成的 `procedural/composite.ts`，不用另写 attach/合批管理：

- `createComposite().mesh(name, geometry, material, transform?)`：自动挂载，保留独立材质/变换槽位。
- 推荐 `const frame = builder.batchSlot(name, material)`，再调用 `frame.add(geometry, transform?)`；材质只绑定一次。完成后 `return builder.finish()`。空槽位不生成网格。旧 batch(name, geometry, material, transform?) 保留兼容，同名必须传同一材质实例（参数相同的两次 new 或 clone 也不是同一实例）。不同材质必须使用不同批次名，不要靠删除校验、比较颜色或自动改名规避。每次传新建 geometry，工具接管所有权；不要复用/再次 dispose 输入几何。
- mesh/batch 的 name 使用稳定名称（snake_case 或 camelCase 均可）；batch 内零件作为整体编辑。先确定用户需要的编辑粒度，不能把需要单独改材质的零件合并。
- `labelTexture(text, options?)` 自动适配文字；`canvasTexture(width,height,paint)` 用于标线/网格。输出赋给普通材质 map，无外网字体或图片依赖；挂载后由引擎管理资源。
- 完整可编译范式：复制 `scripts/scaffolds/composite-handler.ts` 到工程 handlers/composite-example.ts，登记 registerAssemblyHandler，数据分组为 assemblies。不使用标签时无需创建标签材质。

## 资产与布局

- 选材顺序、批量检索与降级条件统一见 [主入口](../SKILL.md)「选材与复用」；资产命令和结果状态见 [designer-assets.md](designer-assets.md)。运行时加载失败不等于自动生成替代模型。
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

可复制 `scripts/scaffolds/layout-recipe.json` 到工程 `src/layout-recipe.json`，运行 `node scripts/generate-layout.mjs`，输出 public/layout-groups.generated.json。生成器与输入随源码交付；默认输出独立分组文件，并拒绝覆盖输入配方和 public/scene3d/scene-data.json；不要将自定义输出指向编辑器保存文件。首次生成时合并分组，后续重新生成先明确要替换的节点范围，保留人工编辑。

## 构建与排障入口

统一构建命令、覆盖边界和修复额度以 [主入口](../SKILL.md)「默认生成路径」「验证失败与重试上限」为准。修改后的构建触发条件与定向诊断见 [scene-workflow.md](scene-workflow.md)。TypeScript incremental 缓存在工程 .cache，不删除缓存、不只检查单文件或用正则模拟类型检查。

PowerShell 文本读写显式使用 UTF-8，优先宿主编辑工具；不因终端乱码改写整个源文件。

## 按需求选择已有实现

| 需求 | 优先路径与边界 |
|---|---|
| 普通 GLB 展示 | 内建 asset 分组 + params.assetId，无需自定义 handler |
| 简单图元 | 内建 Box/Sphere 等；自定义外观用 block-handler 样例 |
| 机柜/车辆/人物 | procedural/rack、car、worker 按需复用；样例的历史 bodyColor 参数仅兼容旧数据，新代码通过外观层编辑颜色 |
| 仓储货架整体展示 | 组件 Rack；框架/层板是 InstancedMesh，不承诺单根立柱独立编排，先确认编辑粒度 |
| 二维热力覆盖 | 组件 HeatMap 输出 CanvasTexture；不是三维体积温度场 |
| 墙体 | 按需查组件 Wall；组件需 --with-components |
| 独立零件材质编辑 | composite-handler，稳定槽位；不同业务对象使用独立节点 |

只读命中项对应文档，不遍历所有实现。组件存在不等于符合需求；编辑粒度或离线资源不符时直接用几何组合。

布局合并可复制 scripts/scaffolds/compose-scene.mjs 到工程 scripts。舞台与不规则节点存 scenes/stage.json，配方存 src/layout-recipe.json；脚本输出独立候选 scenes/scene.generated.json，检查节点范围后再用于首次 scene-data，不自动覆盖编辑存档。

编辑保存与旧存档兼容规则见 [scene-workflow.md](scene-workflow.md)「编辑结果回写」。

## 统一坐标约定

场景和资产使用右手坐标系、+Y 向上、+Z 为资产正面、长度单位米。标准落地资产以底部中心为原点，根节点 position/rotation 为零、scale 为一；不要通过逐模型隐式补偿宣称已标准化。相机局部 -Z 观察方向保持引擎原生约定。未确认的历史资产不能仅标记为米制或已符合正面/原点标准。


### 组合体命名与结束顺序
同一 builder 内 mesh/batchSlot 名称唯一，格式为字母或下划线开头，后接大小写字母、数字、下划线或连字符；保持大小写与原名，不自动改名。斜线保留给槽位路径。循环中的独立零件用稳定业务索引或 neg_z/pos_z 等方向名，建议不用随布局变化的坐标作为标识；连字符合法，小数点不允许。整体编辑的重复零件在循环外创建一次 batchSlot，循环内 add。所有槽位（包括文字）添加完成后最后调用一次 finish，再 applyTransform 和 return。
组合体源码检查能发现直接字面量名称、明确数组循环中的固定名称、直接 finish 后调用，以及可证明的同批次不同 new 材质实例；不覆盖别名、跨函数、条件路径和所有动态表达式。同步装配与源码检查的覆盖不同，统一构建边界见主入口。不要自动重命名 slot 或合并本应独立编辑的零件来隐藏错误。

### 渲染性能配置（run/edit 共用）

- 新场景默认流畅：pixelRatio=1、shadowMapEnabled=false、shadowMap=PCF、shadowMapSize=512；maxFps=60、renderMode=demand、antialias=false、logarithmicDepthBuffer=false。
- 画质档位只改 pixelRatio/阴影开关/算法/全部灯光阴影分辨率。均衡为 1.25/开启/PCF/512；精细为 1.5/开启/PCF/1024。独立的限帧、渲染模式、初始化参数不随档位变。手动偏离档位显示自定义；保存实际 renderer 与 lights 配置。
- 不在业务代码中另建渲染循环、重设 devicePixelRatio、强制 MSAA/对数深度或默认 4096 阴影。renderer.pixelRatio 是实际倍率，不能再乘设备倍率；允许 0.5～2 小数。阴影分辨率提供 256/512/1024/2048/4096。灯光可单独覆盖，选择档位或全局分辨率会重新应用全部灯光。
- 动画通过 renderLoop.onFrame 注册，delta 单位秒，退订后可休眠；只观察帧的辅助逻辑用 onFrame(cb, false) 或 onAfterFrame，不能让静态场景保持绘制。直接修改场景或自定义异步资源完成后调用 renderLoop.invalidate()。标准 handle.update、编辑、控制器、模型/贴图完成、resize 已接线。按需模式有活跃动画时仍连续绘制。
- maxFps 支持 0～240 整数，0 表示不额外限帧；动画按经过时间推进。后台暂停并重置统计窗口。统计每 500ms 刷新，FPS 统计最近 1 秒实际场景帧，阴影等多通道不能重复算帧；空闲显示空闲而非低性能警告。
- antialias 与 logarithmicDepthBuffer 是初始化参数。高级设置保存期望值并展示当前生效值/待生效状态；回写工程后重新打开更新后的场景才生效，不自动刷新丢失编辑。不把 CPU 提交耗时或帧间隔标成 GPU 耗时。

## 可选地理地图

`map` 为保留配置区，启用与数据契约见 [map.md](map.md)。真实地理需求才复制扩展。模型仍按米编排，地图底图不属于可编辑资产。地图联网资源是普通离线模型约束的明确例外；构建不验证内网地图可用性。
