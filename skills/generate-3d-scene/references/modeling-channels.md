# modeling-channels — 代码建模指引（LLM 直写，唯一过程化建模通道）

> 降级阶梯第 4 层的执行手册。需要自定义轮廓或精细建模时按需读；普通生成以 generation-contract.md 为准。
> 通道裁决（2026-10-12）：Blender 通道完全剔除——LLM 直写 three.js 代码是唯一过程化建模通道，零外部依赖。

## 两种形态

### 简模：图元 / 参数化几何（数百行内）

适用：树、路障、集装箱、围栏、地面标线——图元可拼的物体。

**范式**（`template/src/scene3d/scene/handlers/tree.ts`，~60 行）：
- 三层锥形树冠（ConeGeometry 递减半径叠放）+ 树干（CylinderGeometry）；
- 全部常量写在顶部（冠层数/高度比），改形态 = 改常量；
- mesh 具名（`trunk` / `foliage_1..3`）。

### 精模：代码组合模型（几百行量级）

适用：主角级物体（车/人/机柜）——需要材质分件与子节点独立编辑的场合。

**三个实证范式**（`template/src/scene3d/scene/handlers/`，全部过槽位级编辑全链路验证）：

| 范式 | 文件 | 核心手法 |
|---|---|---|
| 轿车 | `car.ts`（231 行） | 侧视 2D 轮廓（机盖斜线 + A/C 柱倾角）ExtrudeGeometry 挤出 + bevel 倒角；座舱玻璃内缩轮廓单独挤出半透明；车轮 LatheGeometry 车削胎侧弧面；灯具小幅挤出 + 自发光 |
| 工人 | `worker.ts`（159 行） | 比例基准表 H（身高 1.78m 各关节 Y 坐标）；四肢锥度圆柱（tapered，肌肉线条非等粗直筒）；安全帽 Sphere 上半 + Lathe 车削帽檐；反光条高金属低粗糙；A-pose 放松姿态微角度 |
| 机柜 | `rack.ts`（134 行） | 薄壁盒分件（侧板/顶/底/背板，非实心方块）+ 框架立柱；网孔门 = 半透明深色高粗糙（低面数伪装，真开孔 Boolean 成本高）；服务器层独立薄盒 + 自发光状态灯（绿/红可业务驱动） |

**精模通用手法**：
- **轮廓挤出**（ExtrudeGeometry）：侧视 2D 轮廓定剪影——比盒拼装的观感高一档；bevel 给边缘高光；
- **车削**（LatheGeometry）：旋转对称体（轮胎/帽檐/花盆）；
- **材质分件**：金属漆（高金属低粗糙）/ 玻璃（低粗糙半透明）/ 塑料（低金属高粗糙）/ 自发光（灯）——分件 = 槽位级可编辑；
- **比例基准表**：真实世界尺寸打头（车长 4.1m / 身高 1.78m / 机柜 2.0×0.6×0.8m），全部尺寸从基准推导；
- **姿态细节**：A-pose 微角度、膝盖前倾、前悬短后悬长——去「机械垂直/对称僵硬」感。

## 命名约定（硬约束）

- **每个 mesh 必须 `.name`**（snake_case：`helmet_dome` / `thigh_l` / `trunk`）——编辑器槽位层以**名称路径**为 key，无名 mesh 退化 `#N` 兄弟序号兜底（可用但改名即失效，树行/面板/点选三处口径一致靠它）；
- 分组 key = 业务类型名（`codecars` / `codeworkers` / `coderacks`），handler 注册同名工厂；
- 材质变量名表意（`suitMat` / `helmet` / `reflect`），不要 `mat1/mat2`。

## 写法纪律

1. **handler 内建，不产 GLB**——过程化产物走 build.mjs 场景预算；只有当模型要入库复用时才导出实体 GLB 过 `validate-model --strict`；
2. **typed definition 注册**（P3 起标准形态，参照 `scene/handlers/tree.ts`）：`create` 建树 + `update` params 响应（结构参数返回 `'rebuild'`、原地参数返回 `'updated'`）+ `dispose` 可选——旧 function 形态仍兼容但 params 变化走重建兜底；
3. 常量全部顶部集中（轮廓点表/比例表/颜色），body 一处；
4. `handlerUtils.applyTransform(group, node)` 先行（读节点 transform）；
5. `node.params` 读业务/结构字段（状态/层数），**渲染默认值写在代码**（`applyShadowDefaults` 模式）；
6. 细节按场景观察距离设计；运行时面数检查仅用于维护或用户要求的性能诊断，不新增默认步骤；
7. 普通生成统一构建成功即交付，不追加截图、人工验收清单或审美修复；实际未运行时只说明构建通过。维护或用户反馈故障时才按需验证。

## 已否决方案（防回潮）

- ~~Blender 通道~~（MCP 交互式 / headless 脚本式）：2026-10-12 用户裁决完全剔除——默认使用上传包、检索库与代码几何；不引入额外安装、分发和维护成本；
- ~~生成 GLB 的脚本~~：二进制不可 review、不可 diff、改一棵树要重跑脚本——代码是可版本控制的建模产物；
- ~~烘焙蒙皮为普通几何~~：SkinnedMesh 原生支持编辑/点选/包围盒（蒙皮感知口径），不需要烘焙降级。
