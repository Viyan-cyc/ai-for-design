# INTEGRATION_GUIDE — 二次开发指南

> 本文档写给拿到母版工程做二次开发的工程师。你手里的代码 = 引擎层（scene-core，别改）+ 接入层（handlers/cards/scene-data.json，你的主战场）。

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
│   ├── types.ts         #   SceneDataJSON 等全部类型（scene-data.json 的 TS 形态）
│   ├── engine/          #   八引擎：scene/camera/light/controls/renderer/raycast/asset/loop
│   ├── handlers/        #   物体工厂（asset=GLB / primitive=图元）+ 业务 handler
│   └── cards/           #   2D 卡片系统（CSS2D 锚点）+ ExampleCard.vue
├── edit/                # 【编辑态外壳】?edit=1 才加载；不想交付可整目录剔除
├── handlers 侧业务代码   # ← 你的业务 handler 写在 scene-core/handlers/（见 §3）
├── App.vue              # ← 页面级 UI（侧栏/大屏），你的主战场之一
└── main.ts              #   二开态入口：装配 handler + 卡片注册表
```

## 2. scene-data.json：改数据不改代码

每个物体一个节点（`objects[]`），核心字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 场景内唯一，snake_case |
| `type` | `'asset'`（GLB 模型）/ `'primitive'`（图元）/ 你注册的自定义类型 |
| `assetId` / `primitive` | 按 type 二选一 |
| `parentId` | 组树（可选，父先建） |
| `position/rotation/scale` | 变换（rotation 为弧度；scale 数字=统一缩放） |
| `materialOverride` | 颜色/金属度/粗糙度/透明度/自发光覆盖 |
| `pickable` | `false` = 不参与点击拾取（纯装饰物建议关） |
| `params` | 自定义参数，透传给你的 handler |

灯光/相机/控制器/renderer 同级配置，均支持运行时改（见 §4）。2D 卡片在 `cards[]`：锚到物体、按 click/always/hover 触发、props 传给你写的 Vue 组件。

## 3. 三类常见二开任务

### 3.1 换模型

1. GLB 放入 `public/assets/models/`；
2. scene-data.json 加节点：`{ "id": "my_model", "type": "asset", "assetId": "my_model", ... }`；
3. 刷新。

规格建议（运行时 console 会告警）：单模型 ≤2k 面（道具级）、≤64 节点、贴图 ≤1024²、底面中心 y=0、节点名 snake_case。

### 3.2 写业务 handler（物体自带行为）

参照 `scene-core/handlers/example/windTurbine.ts`：注册自定义 type 的工厂 + 每帧回调，在 `handlers/index.ts` 启用。`params` 从 scene-data.json 透传进来。

```ts
sceneEngine.registerFactory('my_pump', (node) => {
  const group = new THREE.Group();
  handlerUtils.applyTransform(group, node);
  void assetEngine.getInstance(node.assetId!, `assets/models/${node.assetId}.glb`)
    .then((inst) => { group.add(inst); });
  return group;
});
```

### 3.3 写 2D 卡片（数据面板/告警标牌）

1. 仿 `scene-core/cards/ExampleCard.vue` 写纯展示组件（props 进、样式出，不管定位）；
2. `main.ts` 的 `cardComponents` 注册表登记：`{ my_card: MyCard }`；
3. scene-data.json 的 `cards[]` 加配置，`component: "my_card"`。

定位、显隐、点击互斥全部由卡片系统托管，组件不用关心。

## 4. 运行时操作场景（handle API）

`main.ts` 里拿到的 `handle` 即操作入口：

```ts
handle.update({ upsert: [node] })          // 增/全量替换
handle.update({ remove: ['id'] })          // 删（含子树）
handle.update({ patch: [{ id, position }] }) // 局部改 transform/params
handle.update({ lights: [...] })           // 整组换灯
handle.update({ camera: { fov: 60 } })     // 相机/控制器/renderer 同理
handle.pick(x, y)                          // 射线拾取
handle.frameObject(id)                     // F 聚焦
handle.onCardState(cb)                     // 卡片状态订阅
handle.setDebug(true)                      // fps/calls/tris HUD
```

性能基线：场景总面数预算 ≤1M 三角，目标 ≥40fps（`setDebug(true)` 或 perf 脚本实测）。

## 5. 双模式与编辑态

- **二开态**（`main.ts`）：交付物运行入口，不含任何编辑器代码。
- **编辑态**（`src/edit/`，`?edit=1`）：布局调参工具，产物就是 scene-data.json。物理隔离：`edit/` 只 import `scene-core`，反向禁止（build 脚本机器保证）。
- 若交付物不需要编辑器：删掉 `src/edit/` 目录 + index.html 里的分流 script 即可，其余零改动。

## 6. 常见问题

**Q: 物体没出现？** console 找 `[SceneEngine] 未注册的物体类型`（handler 没注册）或 `[registry] 资产加载失败`（路径/文件名不对）。

**Q: 模型太暗？** 检查 `scene.environment`（IBL 强度）与 `lights[].intensity`；toneMapping 默认 ACESFilmic，偏灰可换 `Neutral`。

**Q: 点击没反应？** 该物体 `pickable` 是否为 `false`；卡片 `trigger` 是否为 `click`。

**Q: 帧率低？** `setDebug(true)` 看 tris（总面数）与 calls（draw call）。优先减面数、合并同种物体（>1000 同类用 InstancedMesh，写个 handler 即可）。
