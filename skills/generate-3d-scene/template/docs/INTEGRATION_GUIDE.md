# INTEGRATION_GUIDE — 二次开发指南

> 本文档写给拿到母版工程做二次开发的工程师。你手里的代码 = 引擎层（scene-core，别改）+ 接入层（handlers / materials.ts / cards / scene-data.json，你的主战场）。
>
> **v3 核心原则：数据只有业务属性，视觉全部在代码。** scene-data.json 不出现材质/贴图/颜色/阴影字段；look 由 `materials.ts` 与 handler 代码决定。

## 0. 十分钟上手

```bash
npm install
npm run dev          # http://localhost:5183 — 二开态
# 访问 http://localhost:5183/?edit=1 — 编辑态（布局调参工具，交付物里可不存在）
npm run build        # vue-tsc 类型检查 + vite 打包
npm run lint         # eslint
```

场景内容**不在代码里，在 [public/scene-data.json](../public/scene-data.json)**：物体、灯光、相机、控制器、renderer、2D 卡片全部由这份数据驱动。改数据 = 改场景，刷新即见。

## 1. 目录地图

```
src/
├── scene-core/          # 【引擎层】只读参照，一般不改
│   ├── createScene.ts   #   唯一入口 createScene(canvas, data, cardComponents)
│   ├── types.ts         #   SceneData / SceneNode / TreeSceneFragment 等全部类型（v3 schema 的 TS 形态）
│   ├── materials.ts     #   【视觉层】状态视觉注册表 + applyState（二开者的主战场之二）
│   ├── primitives.ts    #   图元底座：Box/Sphere/Cylinder/Plane/Cone/Torus 工厂
│   ├── engine/          #   八引擎：scene/camera/light/controls/renderer/raycast/asset/loop
│   ├── handlers/        #   内建工厂（图元/asset）+ 业务 handler（example/ 是你的参照）
│   └── cards/           #   2D 卡片系统（CSS2D 锚点）+ ExampleCard.vue
├── edit/                # 【编辑态外壳】?edit=1 才加载；不想交付可整目录剔除
├── App.vue              # ← 页面级 UI（侧栏/大屏），你的主战场之一
└── main.ts              #   二开态入口：装配 handler + 卡片注册表
```

## 2. scene-data.json v3：key:Array 单一结构

整份数据 = **保留区（舞台配置）+ 业务区（type 分组字典）**：

```jsonc
{
  "version": "1",
  "meta": { "name": "厂区监控", "description": "…" },

  // ---- 保留区（固定 key，舞台配置）----
  "scene":    { "background": "#0f151b", "environment": { "intensity": 0.6 }, "fog": null },
  "camera":   { "type": "PerspectiveCamera", "position": [8,6,10], "lookAt": [0,1,0], "fov": 50, "near": 0.1, "far": 2000 },
  "lights":   [ { "id": "DirectionalLight_001", "type": "DirectionalLight", "position": [6,10,4], "intensity": 2, "castShadow": true } ],
  "controls": { "type": "OrbitControls", "target": [0,1,0], "minDistance": 2, "maxDistance": 80 },
  "renderer": { "toneMapping": "ACESFilmic", "exposure": 1, "shadowMap": "PCFSoft", "shadowMapEnabled": true },

  // ---- 业务区（其余任何 key 都是 type 分组；key 名 = 业务类型名）----
  "Box":   [ { "id": "ground", "position": [0,0,0], "rotation": [-1.5708,0,0], "scale": [40,40,1] } ],
  "cars":  [
    { "id": "car_01",
      "position": [10,0,3], "rotation": [0,0,0], "scale": 1,          // transform：引擎显式字段
      "card": { "type": "example", "trigger": "always", "offset": [0,1,0] },  // 内联卡片（场景作者所有）
      "params": { "assetId": "example", "status": "normal", "speed": 1.2 } }  // 业务属性（生产数据源）
  ]
}
```

### 2.1 节点字段

| 字段 | 说明 |
| --- | --- |
| `id` | 场景内唯一，幂等键（snake_case） |
| `parentId` | 组树（可选，父先建；可跨分组组树） |
| `position/rotation/scale` | 变换（rotation 弧度；scale 数字=统一缩放或三轴数组） |
| `card` | 内联 2D 卡片 `{ type, trigger: 'always'\|'click', offset }`；删节点 = 卡片级联消失 |
| `params` | **业务属性**（生产数据源所有，整块替换）：assetId、status、speed…… |

**不存在的字段（刻意设计）**：`type`（= 所在分组 key）、材质/贴图/颜色（在 materials.ts）、castShadow/receiveShadow（默认值在代码，个体覆盖走编辑器视觉层，见 §6）。params 只放**业务字段**——后端推什么就放什么，three.js 渲染参数永远不进来。

### 2.2 内建分组（不写 handler 就能用）

| 分组 key | 说明 |
| --- | --- |
| `Box` / `Sphere` / `Cylinder` / `Plane` / `Cone` / `Torus` | 图元（分组名即图元种类），默认灰材质 |
| `asset` | 通用 GLB 加载，`params.assetId` 指定模型 |

## 3. 三类常见二开任务

### 3.1 换模型 / 加物体

1. GLB 放入 `public/assets/models/`；
2. scene-data.json 加分组或往已有分组加节点：

```json
"pumps": [ { "id": "pump_01", "position": [3, 0, 2], "params": { "assetId": "pump_model" } } ]
```

3. 写 pump 分组的 handler（§3.2；若只是静态摆放，直接用 `asset` 分组：`{ "id": "pump_01", "params": { "assetId": "pump_model" } }`，零代码）。

规格建议（`validate-model.mjs` 运行时会告警）：单模型 ≤2k 面（道具级）、≤64 节点、贴图 ≤1024²、底面中心 y=0、节点名 snake_case。

**简模/组合体走代码，不造 GLB**：找不到合适模型需要降级简模时（树/路障/集装箱这类图元可拼的物体），写 handler 组合 three.js 图元几何——参照 [handlers/procedural/tree.ts](../src/scene-core/handlers/procedural/tree.ts)（三层锥形树冠+树干，~百面）。改形态 = 改代码常量，可 review 可 diff 可版本控制；**不要写脚本生成 GLB**——二进制不可 review、改一棵树要重跑脚本。GLB 管线留给真正的美术资产（贴图/绑定/动画）。

### 3.2 写业务 handler（物体自带行为）

参照 `scene-core/handlers/example/example.ts`：注册自定义分组 key 的工厂 + 读 `node.params`（业务字段）→ 返回 Object3D。在 `main.ts` / `handlers/index.ts` 启用。

```ts
sceneEngine.registerFactory('pumps', (node) => {
  const group = new THREE.Group();
  handlerUtils.applyTransform(group, node);
  const assetId = node.params?.assetId;
  if (typeof assetId === 'string') {
    void assetEngine.getInstance(assetId, `assets/models/${assetId}.glb`)
      .then((inst) => group.add(inst));
  }
  return group;
});
```

**注册时序**：createScene 建树时按已注册工厂分发，未注册的分组 warn 跳过。入口模式（main.ts 已示范）：先 `createScene`，再 `registerXxxHandler`，然后把该分组数据重喂一次 `handle.update({ pumps: data.pumps })`（幂等 upsert 补建）。

**params 里永远不写渲染参数**：阴影/显隐等默认值在 handler 代码里（`applyShadowDefaults` 模式）；个体差异由编辑态调好后转录进代码（§6）。

### 3.3 状态视觉：materials.ts（数据无材质，视觉在代码）

物体的"正常/告警/检修"等状态视觉不在数据里，在 [scene-core/materials.ts](../src/scene-core/materials.ts) 的 `stateMaterials` 注册表：

```ts
export const stateMaterials = {
  cars: {
    normal:      { mapUrl: 'assets/textures/example.jpg', metalness: 0.6, roughness: 0.4 },
    alarm:       { mapUrl: 'assets/textures/example.jpg', emissive: '#401010', emissiveIntensity: 1.2 },
    maintenance: { color: '#d8a921', metalness: 0.2, roughness: 0.7 },
  },
};
```

- 数据侧只推业务字段：`params.status`；handler 读到后查表 `stateMaterials[type][status]` 调 `applyState(instance, status, visual)`；
- 视觉规格键：`mapUrl`（换贴图）/ `color / metalness / roughness / emissive / opacity / wireframe / flatShading / side`（材质参数）/ `model`（几何级变体，换 GLB 实例）；
- **换颜色/加状态 = 改这一个文件**，数据与 handler 都不动；
- 多状态资产的贴图集/变体走 AssetEngine `registerAssetStates`（manifest.states），`applyState` 的 `map`/`model` 键消费。
- **材质工厂（编辑器与库共用）**：`materials.ts` 导出 `createMaterialFromSpec(spec)`（按 three.js 原生类型名实例化 Lambert/Standard/Physical，含贴图色彩空间三分桶）；编辑器的"材质库"（`__materialLib`）与内联调参都经它落到运行时。跨物体复用同名的材质走 §6.1 的 `libraryMaterials`。

### 3.4 写 2D 卡片（数据面板/告警标牌）

1. 仿 `scene-core/cards/ExampleCard.vue` 写纯展示组件（props 进、样式出，不管定位）；
2. `main.ts` 的 `cardComponents` 注册表登记：`{ my_card: MyCard }`；
3. scene-data.json 在**节点上**内联：`"card": { "type": "my_card", "trigger": "click" }`。

定位、显隐、点击互斥全部由卡片系统托管；**卡片 props 自动注入节点 params + id**（生产数据直达卡片），组件不用关心来源。删节点 = 卡片级联消失，无孤儿卡片。

## 4. 运行时操作场景（handle API）与生产数据接入

`main.ts` 里拿到的 `handle` 即操作入口。更新片段与 scene-data.json **同构**（key:Array），零格式转换：

```ts
handle.update({ cars: [node] })            // 增/改（幂等 upsert：存在即原地更新）
handle.update({ remove: ['car_03'] })      // 删（先于分组处理；含子树与卡片级联）
handle.update({ lights: [...] })           // 整组换灯
handle.update({ camera: { fov: 60 } })     // 相机/控制器/renderer/scene 同理
handle.update({ scene: { background: '#111' } })
handle.pick(x, y)                          // 射线拾取
handle.frameObject(id)                     // F 聚焦
handle.onCardState(cb)                     // 卡片状态订阅
handle.setDebug(true)                      // fps/calls/tris HUD
```

**生产数据接入**（v3 的主卖点）：后端把业务对象序列化成同格式节点数组，直接喂 `handle.update()`：

```ts
// 轮询示例：HTTP 拉取车列表 → v3 片段
const res = await fetch('/api/cars');
const cars = await res.json();   // [{ id, position, params: { status, speed } }, ...]
handle.update({ cars });

// MQTT / WebSocket 示例：状态消息 → 单节点片段
socket.on('car/status', (msg) => {
  handle.update({ cars: [{ id: msg.id, position: msg.pos, params: { status: msg.status } }] });
});
```

语义可预测：**remove 先行 → 存在即 update / 不存在即 create → params 整块替换（不深合并）→ 不 diff**。后端推整份也行推增量也行，同一段代码。

性能基线：场景总面数预算 ≤1M 三角，目标 ≥40fps（`setDebug(true)` 实测）。

## 5. 双模式与编辑态

- **二开态**（`main.ts`）：交付物运行入口，不含任何编辑器代码。
- **编辑态**（`src/edit/`，`?edit=1`）：布局调参工具，产物就是 scene-data.json。物理隔离：`edit/` 只 import `scene-core`，反向禁止（build 铁律，机器保证）。
- 若交付物不需要编辑器：删掉 `src/edit/` 目录 + index.html 里的分流 script 即可，其余零改动。

## 6. 编辑器视觉层与交付转录（__visuals + __materialLib）

编辑态里调的**材质参数/显隐/阴影开关**存进数据文档的 `__visuals` 字段（编辑器私有视觉层），**调好的可复用材质**存进 `__materialLib`（编辑器私有材质库）。两者都用于撤销/重做与"所见即所得"，都是**编辑器调参产物**，交付时由 strip-edit 处理：

1. 从 scene-data.json 剥离 `__visuals` 与 `__materialLib`（数据层回归纯净：只有业务属性）；
2. 生成转录清单——LLM/工程师把调参折叠进代码：
   - `__visuals` 里的材质参数 → `materials.ts`（加进 `stateMaterials` 或调 `PRIMITIVE_DEFAULT_COLOR`）；
   - `__visuals` 里的显隐/阴影开关 → handler 默认值代码；
   - `__materialLib` 里**被引用的**材质 → `materials.ts` 新增 `libraryMaterials` 段（未被引用的种子材质不转录）；
   - `__visuals[obj].libraryRef` 引用关系 → handler 里接线（`obj.material = libraryMaterials.<name>`）；
3. 转录后两个私有区为空，数据与代码各归其位。

> **内联材质是「补丁」不是「整替」**：`__visuals[obj]` 里的材质字段只覆盖你**显式调过**的参数，其余继承物体原材质——同类型调参在运行时是「克隆原材质 + 打补丁」，GLB 内嵌贴图、图元默认色都保留；只有**换类型**（Lambert↔Standard↔Physical）才重建，且兼容贴图槽（map/normalMap…）会带过去。转录时同理：把显式字段写进代码（handler 里 `material.xxx = …`），未动的字段继续吃物体原材质。

### 6.1 材质库转录（libraryMaterials）

编辑器的"材质库"给物体复用同一材质（同 mat_id 物体共享一个材质实例，改库即全部引用者实时变化）。交付转录格式：

```ts
// materials.ts —— 与 stateMaterials 并存不合并
// stateMaterials 管"业务类型→状态→视觉"换装；libraryMaterials 管"名字→材质"跨物体复用（两个问题两个表）
export const libraryMaterials = {
  glass: { type: 'MeshPhysicalMaterial', transmission: 1, ior: 1.5, roughness: 0.05, thickness: 0.5 },
  carpaint: { type: 'MeshPhysicalMaterial', clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0.7, roughness: 0.35 },
  // …（mat_id.name 转 snake_case 作键）
} as const;
```

转录清单里的"引用表"（nodeId → mat_id）指导 handler 接线：

```ts
// handler 里（示例）
const mat = libraryMaterials.glass;
createMaterialFromSpec 免——直接复用：
obj.traverse((o) => { if (o.isMesh) o.material = mat; });
```

> `libraryMaterials.<name>` 只是一个 `MaterialSpec` 字面量；运行时用 `createMaterialFromSpec(spec)` 实例化（见 `@/scene-core` 导出），或直接在 handler 里构造。共享实例语义由业务方决定（想复用一个实例就复用一个实例）。

生产侧若确需运行时改视觉，走 `handle.update({ __visuals: { ... } })` 是**合法但 discouraged** 的通道（undo 依赖它）；正规通道仍是改 materials.ts。

## 7. 常见问题

**Q: 物体没出现？** console 找 `[SceneEngine] 未注册的物体类型`（分组 handler 没注册——注册后记得重喂该分组）或 `[registry] 资产加载失败`（路径/文件名不对）。

**Q: 模型太暗？** 检查 `scene.environment`（IBL 强度）与 `lights[].intensity`；toneMapping 默认 ACESFilmic，偏灰可换 `Neutral`。

**Q: 点击没反应？** 卡片 `trigger` 是否为 `click`（常显卡用 `always`）；物体是否在引擎里（物体树可见）。

**Q: 帧率低？** `setDebug(true)` 看 tris（总面数）与 calls（draw call）。优先减面数、合并同种物体（>1000 同类用 InstancedMesh，写个 handler 即可）。

**Q: 想改某个物体的颜色？** 不是改数据——`params` 不收视觉字段。单个状态视觉进 `materials.ts`；多个物体复用同一材质 → 编辑器材质库（转 `libraryMaterials`，见 §6.1）；编辑器临时调的进 `__visuals`（交付时转录，见 §6）。
