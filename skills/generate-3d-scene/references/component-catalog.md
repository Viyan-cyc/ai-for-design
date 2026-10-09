# 3D 组件目录（a3d-components）

> 版本：0.1.0 ｜ 生成：2026-10-09（sync-components.mjs 自动生成，勿手改）

从场景需求出发查本表选组件；确定用哪个后，读 `component-docs/<Name>.md` 学 options，再 import 使用。

| 组件 | 一句话 | import | 用法页 |
|---|---|---|---|
| **CameraControls** | Orbit-style camera controller with smooth transitions | `'@a3d/a3d-components/camera'` | [CameraControls.md](component-docs/CameraControls.md) |
| **PivotControls** | PivotControls —— 统一变换操控 Gizmo（平移 / 旋转 / 缩放一体） | `'@a3d/a3d-components/controls'` | [PivotControls.md](component-docs/PivotControls.md) |
| **BitmapText** | BitmapText — SDF-based dynamic text component for Three | `'@a3d/a3d-components/core'` | [BitmapText.md](component-docs/BitmapText.md) |
| **Grid** | Grid —— 无限参考网格组件 | `'@a3d/a3d-components/core'` | [Grid.md](component-docs/Grid.md) |
| **Html** | Html — Overlay HTML element positioned in 3D space | `'@a3d/a3d-components/core'` | [Html.md](component-docs/Html.md) |
| **InstancedEntity** | Represents an individual instance in an `InstancedMesh2` | `'@a3d/a3d-components/core'` | [InstancedEntity.md](component-docs/InstancedEntity.md) |
| **InstancedMesh2** | Enhanced `InstancedMesh` with per-instance frustum culling, BVH-accelerated raycasting, | `'@a3d/a3d-components/core'` | [InstancedMesh2.md](component-docs/InstancedMesh2.md) |
| **InstancedMeshBVH** | Manages BVH (Bounding Volume Hierarchy) for `InstancedMesh2` | `'@a3d/a3d-components/core'` | [InstancedMeshBVH.md](component-docs/InstancedMeshBVH.md) |
| **Outlines** | Outlines — 描边组件 | `'@a3d/a3d-components/core'` | [Outlines.md](component-docs/Outlines.md) |
| **Path** | Path — 路径绘制组件 | `'@a3d/a3d-components/core'` | [Path.md](component-docs/Path.md) |
| **Rack** | Rack —— 货架组件 | `'@a3d/a3d-components/core'` | [Rack.md](component-docs/Rack.md) |
| **Shape** | Shape — 异形面绘制组件 | `'@a3d/a3d-components/core'` | [Shape.md](component-docs/Shape.md) |
| **Sky** | Sky —— 天空穹顶组件 | `'@a3d/a3d-components/core'` | [Sky.md](component-docs/Sky.md) |
| **Wall** | Wall — 墙体绘制组件 | `'@a3d/a3d-components/core'` | [Wall.md](component-docs/Wall.md) |
| **Wireframe** | Wireframe — 线框化组件 | `'@a3d/a3d-components/core'` | [Wireframe.md](component-docs/Wireframe.md) |
| **Graph3D** | Graph3D —— 3D 图可视化主组件 | `'@a3d/a3d-components/graph'` | [Graph3D.md](component-docs/Graph3D.md) |
| **Edge3D** | Edge3D —— 图边的 3D 视觉载体 | `'@a3d/a3d-components/graph'` | [Edge3D.md](component-docs/Edge3D.md) |
| **Node3D** | Node3D —— 图节点的 3D 视觉载体 | `'@a3d/a3d-components/graph'` | [Node3D.md](component-docs/Node3D.md) |
| **PickController** | PickController —— 图交互拾取与事件分发控制器 | `'@a3d/a3d-components/graph'` | [PickController.md](component-docs/PickController.md) |
| **HeatMap** | HeatMap — a **canvas-based heatmap texture generator** | `'@a3d/a3d-components/heat'` | [HeatMap.md](component-docs/HeatMap.md) |
| **GizmoHelper** | GizmoHelper —— 视口导航 Gizmo（Viewport Gizmo）容器 | `'@a3d/a3d-components/helper'` | [GizmoHelper.md](component-docs/GizmoHelper.md) |
| **GizmoViewport** | GizmoViewport —— 三轴视口指示器（GizmoHelper 的默认内容），仿 **ThreeOrbitControlsGizmo** | `'@a3d/a3d-components/helper'` | [GizmoViewport.md](component-docs/GizmoViewport.md) |
| **InteractiveManager** | Centralized raycaster-based interaction system | `'@a3d/a3d-components/interactive'` | [InteractiveManager.md](component-docs/InteractiveManager.md) |
| **AssetCache** | AssetCache —— 模型与贴图的按需加载 / 内存缓存组件 | `'@a3d/a3d-components/loader'` | [AssetCache.md](component-docs/AssetCache.md) |
| **MaterialManager** | Interface for components that support resource cleanup | `'@a3d/a3d-components/material'` | [MaterialManager.md](component-docs/MaterialManager.md) |
| **MeshReflectorMaterial** | MeshReflectorMaterial — a **planar reflection material** for Three | `'@a3d/a3d-components/material'` | [MeshReflectorMaterial.md](component-docs/MeshReflectorMaterial.md) |

## 使用纪律

- 产物工程通过 `vendor/a3d-*.tgz`（file: 依赖）安装本库；未来发 npm 后改 registry 版本号。
- options 全表见各组件用法页；类型细节可查产物工程 `node_modules/@a3d/a3d-components/dist/es/*.d.ts`（逃生口，默认不读）。
- 组件持续更新由源仓维护；升级 = 源仓重跑 sync 脚本 + 交付工程换 tgz 版本。