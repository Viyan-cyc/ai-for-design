---
name: generate-3d-scene
description: 输入一段文字/截图描述的 3D 场景需求，产出 Vue 3 + three.js 0.185.1 + TS 的可二次开发场景工程。核心机制「资产优先 + 降级阶梯」：检索内置 59 模型资产库与 a3d-components 组件库，未命中走 LLM 直写代码建模；全程验证回路（build 门禁 + CDP 冒烟 + 性能观测）。做 3D 场景、数字孪生可视化、监控大屏场景时使用。
version: 0.1.0
---

# generate-3d-scene

把自然语言场景需求变成 **Vue 3 + three.js 0.185.1 + TypeScript** 的可二次开发工程。

用户丢进来一段描述（或截图）→ 你走完「检索资产 → 缺口建模 → 生成工程 → 验证达标」全流程 → 交付：

1. **编辑态工程**：`?edit=1` 可点选物体、调参数、拖布局（类 Spline 编辑器）；
2. **二开包**：`strip-edit.mjs` 剥离编辑器 → 干净运行时工程 + INTEGRATION_GUIDE，二开者不需要懂 three.js 就能改数据级内容。

两种交付物同一份母版（`template/`）。

---

## 工作流（九步）

```
S1 澄清需求 → S2 检索资产 → S3 缺口建模 → S4 生成工程 → S5 build+冒烟 → S6 视觉/性能
                                                                    ↓
S9 交付 ← S8 编辑调优 ← S7 交互联调 ←──── 修复循环（S5 不过时）←─┘
```

每步的逐步指引（DoD 与停止点）见 `references/scene-workflow.md`。骨架：

| 步 | 做什么 | 关键命令 |
|---|---|---|
| S1 | 文字/截图 → 场景要素清单（物体/规模/交互/数据更新）；缺关键信息**停下来问** | — |
| S2 | 检索资产库，多查询词覆盖；结果分命中/近似/缺失三类 | `node scripts/search-assets.mjs "机柜" --top 8` |
| S3 | 按**降级阶梯**补缺（见下），每层升级记录原因；产出实体 GLB 必过门禁 | `node scripts/validate-model.mjs <model.glb> --strict` |
| S4 | 母版复制出编辑态工程，填 scene-data.json + handlers + cards | `node scripts/init.mjs <target-dir> --assets referenced` |
| S5 | build 门禁 + 结构冒烟；不过则修复重跑（fail-all 一轮改完） | `node scripts/build.mjs <target>` ；`node scripts/verify/smoke-structural.mjs <url> --edit` |
| S6 | 视觉截图（多模态档看图，非多模态档交用户人眼）+ 性能观测 | `node scripts/verify/smoke-visual.mjs <url>`；`node scripts/verify/perf-fps.mjs <url>` |
| S7 | 卡片/handler/增量更新演示数据 → 结构冒烟回归 | 同 S5 |
| S8 | 起 dev server 用编辑态自检微调（多模态看截图，非多模态看数值）→ 定稿 scene-data.json | `npm run dev` 后访问 `?edit=1` |
| S9 | strip-edit 出二开包 + 验证报告 + 执行日志 | `node scripts/strip-edit.mjs <src> --out <dir>` |

**会话开头先跑一次** `node scripts/ensure-env.mjs`（node≥22 / three 0.185.1 / 多模态档位；多模态模型加 `--multimodal`）。

---

## 降级阶梯（资产决策顺序，硬约束）

```
第1层 检索命中 → 直接用（search-assets top-k 有合适资产）
第2层 检索近似 → 参考改造（同类但细节不符：加载后 scale / 材质覆盖 / 组合多个）
第3层 组件拼装 → 组件库按需组合（读 references/component-catalog.md 选件，
                  按需读 references/component-docs/<Name>.md 学 options，
                  handler 内 import '@a3d/a3d-components/...'）
第4层 LLM 直写 → three.js 代码建模（唯一过程化建模通道，零外部依赖）
                  简模：图元/参数化几何（数百行内，参照 procedural/tree.ts）
                  精模：代码组合模型（参照 procedural/car.ts / rack.ts / worker.ts
                        ——多节点拼装 + 子节点独立材质，槽位级编辑全链路可用）
```

**每一层都比上一层重**：能跳过就不升级，升级必须在执行日志记录原因。
- 第 4 层产出的 handler 走 build.mjs 场景预算；**只有**当产出实体 GLB 文件（入库复用）时才过 `validate-model.mjs --strict` 门禁。
- **禁止生成 GLB 脚本**（简模/组合体写 handler 代码——可 review 可 diff 可版本控制；二进制不可 review）。
- mesh 必须具名（`.name`，snake_case）——槽位编辑以名称路径为 key（详见 `references/modeling-channels.md`）。

---

## 硬约束

### 0. 内网纪律：零 CDN、零外网依赖

- npm 走内网源（`mirrors.tools.huawei.com`）；Draco 解码器已随模板 vendor（`public/assets/draco/`），**不要**引任何 CDN 资源。
- 组件库是 `file:./vendor/*.tgz` 本地包（发包后改版本号一行，见 README）。

### 1. 数据结构 v3 生成纪律（写 scene-data.json 前必读）

**数据只有业务属性，视觉全部在代码。**

- 结构 = 保留区（scene/camera/lights/controls/renderer）+ 业务区（其余任何 key 都是 type 分组，`key: Array`）；
- 节点字段只有：`id / parentId / position / rotation / scale / card? / params?`；
- **params 只放业务字段**（status/speed/assetId…），three.js 渲染参数**永远不进数据**；
- 材质/贴图/颜色 → `scene-core/materials.ts` 的 `stateMaterials`；阴影默认值 → handler 代码；
- 灯光/相机/renderer 配置用 **three.js 原生类型名**（`DirectionalLight`/`PerspectiveCamera`…），禁止自造名；
- 卡片内联在节点上（`card: { type, trigger: 'always'|'click', offset }`），props 自动注入节点 params。

完整契约见 `references/scene-engineering.md` 与产物工程 `docs/INTEGRATION_GUIDE.md`。

### 2. 三条铁律（build.mjs 机器保证，不靠自觉）

1. `scene-core/**` 不得 import `edit/` 下任何内容；
2. `edit/**` 只能经 SceneHandle 公开 API 触达 core（公开入口白名单：`@/scene-core` + `/types` + `/createScene` + `/handlers`；禁止深层 import `engine/**`）;
3. strip-edit 产物内 grep `edit`（import 形态）必须零命中。

### 3. 异步 GLB 一律走 `makeAssetNodeFactory`

业务 handler **不要**自己写 `GLTFLoader` 加载逻辑：注册分组工厂时用 `makeAssetNodeFactory`（过期守卫/阴影默认/视觉层重挂/加载计数徽标集中一处），业务逻辑经 `onLoaded` 回调挂载。参照 `handlers/example/example.ts`。

### 4. 蒙皮模型（SkinnedMesh）边界

- 实例化必须经引擎内建通道（`SkeletonUtils.clone` 已封装）——`clone(true)` 直克隆会断 `skeleton` 引用（顶点放大 1/scale 倍）；
- 蒙皮槽位的局部 transform 对蒙皮顶点**数学无效**（不要试图「修好」它，编辑器已禁用 Gizmo 置灰——这是 three.js 数学必然，不是 bug）；换材质/隐藏/属性查看正常可用；
- 蒙皮相关断言/探针必须用蒙皮感知读数（`getVertexPosition`/`computeBoundingBox`），禁 bind-pose 读数；
- mixamo 类厘米资产：节点 `scale` 显式归一化（引擎不隐式缩放）。

### 5. 验证回路（Done by Evidence，每次场景生成必须走完）

```
① build 门禁      结构 + 铁律 + 预算静态估算（重类超限默认 WARN，--strict 升阻断）
② 结构冒烟        场景图 JSON 对齐 / 渲染活性 / 零 rejection —— 唯一硬 FAIL（坏类）
③ 视觉冒烟        四视口截图（多模态档 LLM 看图；非多模态档交用户人眼，标注"未经视觉确认"）
④ 性能观测        calls/triangles/materials 预算 + fps 采样 —— 全 WARN 观测项
⑤ 诚实分级        验证报告注明：机器验证 / LLM 看图验证 / 未经视觉确认
```

三层口径（2026-10-13 用户裁决）：**坏**（报错/白屏/场景图不符）= 唯一硬 FAIL 进修复循环；**重**（预算超限）= WARN + 必须在验证报告回应；**卡**（fps）= WARN 观测，用户反馈卡再修（性能取舍属用户主权，不自动循环优化）。
断言清单与口径详见 `references/verification.md`。

### 6. 验证策略分工（人工验收优先）

- 模型侧常规验证 = 三绿（`vue-tsc --noEmit` / `npm run build` / `npm run lint`），秒级；
- UI 视觉/交互改动 → 交付时附**人工验证清单**（操作步骤 + 预期现象 + URL），用户浏览器目检；
- 冒烟只在三类时点跑：改数据层/引擎核心、收口 Review 前、用户要求；
- 无头环境预检 5 秒（CDP `/json/version`），不过直接转人工清单，**不修环境不硬跑**。

### 7. 生产数据接入是交付物的一部分

用户场景含实时数据（设备状态/告警）时，交付必须包含「生产数据 → update 片段」翻译层示例（MQTT/轮询），见 `references/scene-engineering.md` §数据接入。update 片段与 scene-data.json 同构（key:Array），语义：remove 先行 → 幂等 upsert → params 整块替换。

---

## 命令路由

| 场景 | 命令 |
|---|---|
| 会话开头环境预检 | `node scripts/ensure-env.mjs [--multimodal]` |
| 检索资产 | `node scripts/search-assets.mjs <query> [--top N]` |
| 批量检索（S2 一次出全） | `node scripts/search-assets.mjs --batch <queries.txt> [--top N]` |
| 校验模型（入库门禁） | `node scripts/validate-model.mjs <model> [--strict] [--profile main\|prop]` |
| 建工程 | `node scripts/init.mjs <target-dir> [--assets referenced\|all\|id1,id2] [--with-components] [--deps skip\|copy\|install]` |
| 构建门禁 | `node scripts/build.mjs <project-dir> [--strict]` |
| 结构冒烟 | `node scripts/verify/smoke-structural.mjs <url> [--edit] [--expect <scene-data.json>]` |
| 视觉冒烟（截图） | `node scripts/verify/smoke-visual.mjs <url> [--out <dir>]` |
| 性能观测（frame-time 分布 + resources） | `node scripts/verify/perf-fps.mjs <url> [--duration 20] [--gpu] [--strict]` |
| 场景验证（档位+缓存） | `node scripts/verify/scene.mjs <url> [--both] [--profile preview\|standard\|release] [--no-cache]` |
| 工具时序基准 | `node scripts/benchmark.mjs --project <dir> [--runs 3] [--with-export]` |
| 出二开包 | `node scripts/strip-edit.mjs <src> --out <dir> [--force]` |
| 资产入库（运维，事务性） | `node scripts/import-assets.mjs <package.zip\|dir> [--name <pkg>] [--strict]` |
| 重建索引（运维） | `node scripts/build-search-index.mjs` |
| Poly Haven 扩库（运维） | `node scripts/fetch-polyhaven.mjs [--ids <名单文件>] [--res 1k\|2k] [--resume]` |
| 组件文档重生成（运维） | `node scripts/sync-components.mjs --src <3d-components> [--docs-only]` |
| 冒烟全量/分段（开发期） | `node template/scripts/smoke-r.mjs <url> [--edit] [--only S49] [--from S45]` |

退出码约定：`0` 通过 / `1` 校验失败 / `2` 用法或环境错误（`search-assets` 的 `3` = 无结果）。脚本输出固定格式，先读 `RESULT:` / `PASS|FAIL` 行再决定下一步。

---

## references/ 路由（按需读，不全量载入）

| 文档 | 什么时候读 |
|---|---|
| `scene-workflow.md` | 进入 S1 前通读一遍（九步逐步指引 + 每步 DoD） |
| `asset-pipeline.md` | 用户要上传资产入库 / 写 manifest / 运维资产库时 |
| `model-spec.md` | 检查模型规格 / 覆盖门禁阈值时 |
| `modeling-channels.md` | 走降级阶梯第 4 层写代码建模前**必读**（简模/精模范式 + mesh 命名约定） |
| `verification.md` | 写验证报告 / 跑冒烟断言 / 回应性能 WARN 时 |
| `scene-engineering.md` | 写 handler / 接生产数据 / 理解母版架构时 |
| `component-catalog.md` | S2 检索后评估组件拼装（第 3 层）——Tier-1 组件一行一览 |
| `component-docs/<Name>.md` | 确定用某组件后读其 options（Tier-2 用法页） |
| `eslint-notes.md` | lint 报错理解 / 迁移规则疑问时 |

---

## 交给用户的话怎么说

- 建工程/装依赖时：说正在生成工程、需要几分钟，不贴命令路径；
- 验证不过自己修时：不每轮汇报，修好一起说；
- 交付时：给出编辑态 URL（`http://localhost:5183/?edit=1`）+ 人工验证清单 + 二开包路径；
- 性能 WARN：报告数值 + 回应（优化了什么 / 为什么可接受），**不替用户决定砍视觉**。

## 已知边界

- 非多模态档的视觉结论标注「未经视觉确认」，最终以用户浏览器目检为准；
- 软渲染（swiftshader）环境 fps 天然偏低，fps 只在真机 GPU（`--gpu`）下有意义；
- Poly Haven 资产 name 保留英文原名（专名不翻译），中文检索靠 tags（字典覆盖）；
- 检索为本地词法向量（n-gram TF-IDF），中文同义词弱——miss 时换查询词或补 tags 词条。
