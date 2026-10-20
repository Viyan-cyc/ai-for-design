# scene-engineering — 母版工程结构与二开要点

> LLM 视角的工程结构说明。二开者的完整文档是产物工程里的 `docs/INTEGRATION_GUIDE.md`（268 行，含十分钟上手）；本文档讲**你生成场景时**要动哪里、什么不能动。

## 分层与禁区

```
src/
├── scene-core/          ★ 引擎层——你的主战场是 handlers/materials/cards 三个子目录
│   ├── createScene.ts     唯一入口（禁改）
│   ├── engine/            八引擎单一职责（禁改）
│   ├── handlers/          ← 写业务 handler（example/ 是参照，procedural/ 是建模范式）
│   ├── materials.ts     ← 状态视觉注册表（常改）
│   ├── cards/             ← 2D 卡片纯展示组件（常改）
│   └── types.ts           v3 全部类型（只读）
├── edit/                ★ 编辑态外壳（仅按需 strip-edit 导出时剔除）
└── main.ts              ← 装配 handler + 卡片注册表（常改）
```

**三条铁律**（build.mjs 机器保证）：core 不 import edit；edit 只经 SceneHandle 公开 API（白名单 `@/scene-core` + `/types` + `/createScene` + `/handlers`）；strip 后零 edit 引用。

**你（LLM）的改动面**：`scene-data.json` + `handlers/` + `materials.ts` + `cards/` + `main.ts`。引擎与 edit 一行不碰——bug 修一次全受益的前提是它是稳定的。

## 数据结构 v3（写 scene-data.json 的纪律）

**数据只有业务属性，视觉全部在代码。**

```jsonc
{
  "version": "1",
  "meta": { "name": "…" },
  // 保留区（原生类型名，禁止自造名）
  "scene":    { "background": "#0f151b", "environment": { "intensity": 0.6 } },
  "camera":   { "type": "PerspectiveCamera", "position": [8,6,10], "lookAt": [0,1,0], "fov": 50 },
  "lights":   [ { "id": "DirectionalLight_001", "type": "DirectionalLight", "position": [6,10,4], "intensity": 2, "castShadow": true } ],
  "controls": { "type": "OrbitControls", "target": [0,1,0] },
  "renderer": { "toneMapping": "ACESFilmic", "shadowMap": "PCFSoft" },
  // 业务区（其余任何 key = type 分组）
  "cars": [ { "id": "car_01", "position": [10,0,3], "card": { "type": "example", "trigger": "always" },
              "params": { "assetId": "example", "status": "normal", "speed": 1.2 } } ]
}
```

**节点只有**：`id / parentId / position / rotation / scale / card? / params?`。
**不存在的字段（刻意）**：`type`（=分组 key）、材质/贴图/颜色、castShadow/receiveShadow。渲染参数永远不进数据。

### 内建分组（零代码）

| key | 说明 |
|---|---|
| `Box/Sphere/Cylinder/Plane/Cone/Torus` | 图元（默认灰材质，颜色改 materials.ts） |
| `asset` | 通用 GLB：`params.assetId` 指定模型 |

其余 key 都需要注册 handler（未注册分组 warn 跳过——**注册晚于建树要重喂该分组**：`handle.update({ pumps: data.pumps })`，幂等 upsert 零成本）。

## handler 契约（业务行为）

**typed definition（推荐，P3 起新业务一律用这个）**：

```ts
// 参照 handlers/procedural/tree.ts / rack.ts
const definition: NodeFactoryDefinition = {
  create(node) {                       // 建树（含视觉默认值）
    const group = new THREE.Group();
    handlerUtils.applyTransform(group, node);
    // …业务：读 node.params、组合几何/挂 GLB
    return group;
  },
  update(obj, next, previous) {        // params 响应（可选；不提供则 params 变化走局部重建兜底）
    if (structuralChanged(next, previous)) return 'rebuild';  // 结构参数 → 局部重建
    applyInPlace(obj, next);           // 原地参数（颜色/状态）→ 保实例保视觉层
    return 'updated';
  },
  dispose(obj) { /* 释放 handler 私有资源（可选） */ },
};
sceneEngine.registerFactory('pumps', definition);
```

- **params 契约**（引擎保证）：同值重推幂等零开销；值变化走 `update`；transform 永远引擎处理；
- **结构参数 vs 原地参数**：几何随它变的（层数/尺寸）返回 `'rebuild'`；只改材质/状态的原地重放；
- 旧 `registerFactory('pumps', (node) => obj)` function 形态仍兼容（params 变化 → 局部重建兜底，不再是静默只存数据）。

**通用规则**：
- **异步 GLB 一律 `makeAssetNodeFactory`**（`handlers/registry.ts` 导出）——过期守卫/阴影默认/视觉层重挂/加载计数徽标集中一处；业务逻辑挂 `onLoaded` 回调。**禁止自己写 GLTFLoader**；
- mesh 必须具名 snake_case（槽位编辑的 key；同父层唯一）；
- 渲染默认值写在代码（`applyShadowDefaults` 模式）；个体差异由编辑态调参后转录（见下）；
- 多状态资产：`AssetEngine.registerAssetStates`（manifest.states）+ `applyState`；
- 订阅（帧回调/节点事件）用 `subscribeNodeEvent` / `onFrame` 返回的退订函数，存入 teardown 清单——不覆写全局回调。

## 状态视觉：materials.ts

```ts
export const stateMaterials = {
  cars: {
    normal:      { mapUrl: '…', metalness: 0.6, roughness: 0.4 },
    alarm:       { emissive: '#401010', emissiveIntensity: 1.2 },
    maintenance: { color: '#d8a921' },
  },
};
```

数据只推 `params.status`；handler 查表调 `applyState`。换颜色/加状态 = 改这一个文件，数据与 handler 都不动。跨物体复用材质走 `libraryMaterials`（同文件）。

## 生产数据接入（update 片段，一等公民）

**场景含实时数据时，翻译层示例是交付物的一部分**：

```ts
// 轮询：HTTP 拉车列表 → v3 片段
const res = await fetch('/api/cars');
const cars = await res.json();   // [{ id, position, params: { status, speed } }, ...]
handle.update({ cars });

// MQTT / WebSocket：状态消息 → 单节点片段
socket.on('car/status', (msg) => {
  handle.update({ cars: [{ id: msg.id, position: msg.pos, params: { status: msg.status } }] });
});
```

**update 语义**（与 scene-data.json 同构，key:Array，零格式转换）：
- `remove` 先行（`handle.update({ remove: ['car_03'] })`，含子树与卡片级联）；
- 存在即原地 update / 不存在即 create（幂等 upsert）；
- **params 整块替换**（不深合并）——后端推整份也行推增量也行，同一段代码。

## 编辑器视觉层与交付转录

编辑态调的材质/显隐/阴影存 `__visuals`，复用材质存 `__materialLib`（都是编辑器私有，undo 依赖）。默认离线预览保留编辑器和外观。仅用户要求二开源码包时运行 strip-edit.mjs：自动编译到 generated/appearance.ts，再剥离私有区。TRANSCRIPTION.md 是自动转换摘要，无需 LLM 人工转录。

蒙皮边界（编辑与转录都适用）：SkinnedMesh 槽位局部 transform 对蒙皮顶点无效（数学必然）——换材质/隐藏正常，位置调整不做；实例化必须走引擎内建（`SkeletonUtils.clone`）。

## 常见陷阱（历轮实证）

| 陷阱 | 规避 |
|---|---|
| 蒙皮实例 `clone(true)` 断 skeleton | 只走 `makeAssetNodeFactory` / `AssetEngine.getInstance` |
| cm 单位资产放大百倍 | 节点 scale 显式归一化（0.0056~0.01），引擎不隐式缩放 |
| 注册晚于建树分组丢失 | 注册后重喂该分组（幂等） |
| params 混入渲染参数 | v3 纪律：业务字段 only |
| 旧 dev server 时间胶囊 | 每轮修改后重启默认端口（5183） |
| 卡片锁死左上角 | 卡片系统已托管 resize；自定义入口注意 CSS2D 容器 |
| handler mesh 无名 | 槽位 key 退化 `#N`，改名即断 |
