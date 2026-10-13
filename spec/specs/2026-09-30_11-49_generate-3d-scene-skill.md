# SDD Spec: generate-3d-scene Skill（Vue3 + three.js 0.185.1 + TS 3D 场景生成）

## 0. Open Questions
- [x] Q1 资产管线落位 → **已裁决（2026-09-30）**：skill 自带 `assets/`；后续再迁云端。上传方本地丢压缩包+manifest 给 skill 入库即可，上传方不接触检索库
- [x] Q2 embedding 服务 → **已裁决（2026-09-30）**：先用本地方案，不引入大模型；放 skill 下某目录。内网有 API 但后续再接
- [x] Q3 "LLM 自己建模"边界 → **已裁决（2026-09-30）**：用户倾向 Blender MCP（LLM 驱动 Blender 建模导出 GLB）；LLM 直接写 three.js 建模代码是兜底方案。**→ 已推翻（2026-10-12 用户裁决，2026-10-13 补录）：Blender 通道完全剔除，LLM 直写 three.js 代码建模（含代码组合精模）为唯一过程化建模通道；资产缺口靠 Poly Haven 精选库预填（批次 PH 已完成 56 资产）。详见 §8.1 范围变更记录**
- [x] Q4 skill 交付形态 → **已裁决（2026-09-30）**：与 generate-ux-prototype 同级（ep-coder/skills/ 下）；内网投递纪律延续（npm 内网源、零 CDN）
- [x] Q5 组件库去留 → **已裁决（2026-09-30）**：组件库代码保留（用户沉淀的资产，非废弃对象）；components.json 形式可换。处理方式（检索 vs vendor）由模型给方案、用户确认——见 §3

## 1. Requirements (Context)
- **Goal**: 参照 generate-ux-prototype 的工程化外壳模式，新建 skill `generate-3d-scene`：输入自然语言场景需求，产出 Vue3 + three.js 0.185.1 + TS 的可二次开发 3D 场景工程。核心机制是"资产优先 + 降级阶梯"：模型库/组件库检索命中即复用或参考，未命中走 LLM 过程化建模，兜底简模。全程带验证回路（build + 截图冒烟）。
- **In-Scope**:
  - skill 目录（SKILL.md + references + scripts）
  - 资产入库管线：用户上传压缩包（gltf/glb + manifest JSON），解析、校验、构建向量索引
  - manifest JSON 格式定义（meta + data[] 结构，见 §2 用户给的样例）
  - 向量检索模型/组件（embedding + 相似度匹配）
  - 检索命中→复用/参考，未命中→过程化建模→简模兜底的降级阶梯编排
  - 场景工程模板（业界最佳实践重写，不受 3d-templete 现有代码约束；用户已授权"已有代码可废弃"）
  - 验证回路：build 门禁 + Playwright/CDP 截图自检（agent 看真实渲染帧，不凭空断言）
  - 二开友好：集成文档、代码分层、契约清晰
- **Out-of-Scope**:
  - 3d-templete / 3d-components 现有代码的迁移适配（除非用户确认组件库保留）
  - 模型压缩包上传的前端 UI（管线只处理入库）
  - Spline 或闭源 SaaS 集成
- **Acceptance（初步）**:
  - 给定一句场景描述，skill 流程能产出可 build、可冒烟通过的 3D 场景工程
  - 检索：给定查询文本，能从模型库召回相关资产（向量检索，有验证样例）
  - 命中资产正确加载进场景；未命中走降级路径产出可渲染结果
  - 产物工程含二开文档，陌生人可按文档接手

## 1.1 Context Sources
- Requirement Source: 本会话用户消息（2026-09-30，四条决策：上传+manifest 格式 / 向量检索 / three 0.185.1 / 要验证）
- Design Refs:
  - `ep-coder/skills/generate-ux-prototype/`（工程化外壳参照：init/build/预览/冒烟/vendor 示例）
  - Spec 真相源 `ep-coder/spec/specs/2026-09-17_17-37_ep-coder-generate-ux-prototype.md`（D-1~D-30）
- Chat/Business Refs:
  - 用户 manifest JSON 样例（meta: type/source_id/group_id + data[]: name/file_name/file_path/thumbnail_path/description/tags/search_text/raw_data）
  - 用户决策：已有代码和模板可作废，以业界最佳为准，不为适配硬套
- Extra Context（业界参考，已调研）:
  - **threejs-architecture-effects**（github.com/lhlGitHub/threejs-architecture-effects）— agent skill 形态先例：SKILL.md 装配原则（装配顺序分级 foundations→frame→masonry→…→ornament、先定整体轮廓再分件、单一时间轴、材质与几何分离）+ verification 文档。可直接借鉴其 SKILL.md 写法与构造分级
  - **3dviz-pro-max**（github.com/viettranx/3dviz-pro-max）— 十步工作流（intent→reasoning→grounding→routing→first view→behavior→run-and-inspect→refine→honest reporting）、recipes+知识记录数据结构、**Playwright capture 截图自检回路**、"诚实分级"（proven vs guidance）。方法论核心可移植
  - **open-model-workbench**（github.com/icejyzy0430/open-model-workbench）— GLB/Draco/纹理依赖管线经验、layout-as-JSON 人机协作模式
  - **Spline** — 判定不可参考（闭源无 codegen API、不支持 Vue 导出、与"生成 three.js 源码交付"相悖）
  - **blender-mcp**（github.com/ahujasid/blender-mcp，~29.7k stars，MIT，活跃；**2026-10-12 更新：PyPI 包已改名 `mcp-for-blender`**，接入情报见 §7 Blender 通道前置探索区块）— LLM 经 MCP 驱动 Blender：场景/物体操作、任意 Python 执行（有 safe mode）、**导出 GLB/FBX（export_scene）**、Poly Haven/Sketchfab/Poly Pizza 素材库、Hyper3D Rodin/混元3D 生成。架构=Blender 插件(socket server) + Python MCP 桥。~~**用户已裁决采用为建模主通道**~~ → **通道已剔除（2026-10-12 用户裁决，见 §8.1）**，本条目转为历史归档。风险记录（历史）：execute_blender_code 是任意代码执行面（localhost 使用、保存现场）、socket 无鉴权、大资源下载冻结 UI 主线程
- Existing Assets（现状调研）:
  - 3d-templete（D:\cyc\project\octo\test\3d-templete）：LiveDataConfig JSON 驱动 + handler 注册制 + assetsLibrary（ASSET_CATALOG 2 个 glb + 文本检索 + lowPolyFallback + hunyuan 生成器）——架构思想可参考，代码按用户决策不强制保留
  - 3d-components（@a3d/a3d-components）：14+ 组件（Rack/Wall/HeatMap/Sky/BitmapText/InstancedMesh2 等），docs/components.json 机器可读目录，peerDeps three>=0.150 兼容 0.185.1——是否保留待 Q5

## 1.5 Codemap Used (Feature/Project Index)
- Codemap Mode: 按需（skill 是新建目录，无存量代码地形；generate-ux-prototype 结构已探明，见 §1.1）
- Codemap File: 暂不生成（新建任务，地形清晰后如需要再补）
- Key Index:
  - generate-ux-prototype：SKILL.md（工作流+硬约束）/ scripts（init/build/gen-tokens/install）/ references（design-language/env-config）/ vendor（code-example 001-007）
  - 3d-templete：src/3d（scene/managers/components/editBridge）+ assetsLibrary（assetCatalog/manifest）
  - 3d-components：src（core/heat/material/graph/camera/controls/interactive/loader/animation/helper/utils）+ docs/components.json

## 1.6 Context Bundle Snapshot (Lite)
- Bundle Level: `Lite`
- Key Facts:
  - 技术栈锁定：Vue3 + three.js **0.185.1** + TypeScript
  - 产物要交付二次开发（集成文档 + 分层清晰是硬要求）
  - 资产元数据格式用户已给样例（meta + data[]，含 search_text/tags/thumbnail_path 字段——天然适合向量检索喂料）
  - 检索策略用户已定：向量检索；embedding 先本地方案（skill 内目录，不用大模型），内网 API 后续再接
  - 验证是硬要求（用户明示"要有验证"）
  - 建模主通道：~~Blender MCP~~ → **已改（2026-10-12 裁决）：LLM 直写 three.js 代码建模（含代码组合精模）为唯一过程化建模通道；Blender 剔除，见 §8.1**
  - 资产库：skill 自带 assets/，支持本地压缩包+manifest 入库，后续迁云端
  - 组件库代码保留（用户沉淀资产）；组织形式（检索 vs vendor）待方案确认
  - 内网投递纪律延续（npm 内网源、零 CDN）
- Open Questions: §0 已裁决项全部关闭；Blender 分发（A/B 混合）、非 multimodal 分层、模型规格门禁、Q5 组件库 C 方案——四项已向用户提出，等最终确认后进 Plan
- Next Actions: 用户确认四项决策 → Plan

## 1.7 Minimum Chaos Unit Assessment
- Final Goal: 一个可投递的 generate-3d-scene skill，LLM 用它生成资产优先、带验证、可二开的 Vue3+three.js 场景工程
- Current Task Unit: Research 收口（§2）→ Plan（skill 目录结构 + 资产管线 + 降级阶梯 + 验证回路的完整契约）
- Why this unit is small enough: 需求已收敛到"skill 设计"单一产物；四个技术点（入库/检索/建模/验证）相互独立可在 Plan 内拆原子 checklist
- In-Scope Boundary: skill 本体 + 场景工程模板 + 验证设施；不含上传 UI、不含模型制作
- Out-of-Scope Boundary: 见 §1 Out-of-Scope
- Verification Evidence: 试点工程 build 通过 + 截图冒烟通过（渲染帧人眼/断言确认）+ 检索样例验证
- Failure / Rework Plan: Plan 评审发现管线设计缺陷→回 Research 补调研；Execute 遇逻辑冲突→回 Plan
- Model Autonomy Space: Plan 批准后，skill 文件撰写与脚本实现可在 checklist 范围内自主推进；决策点（方案分叉/风险接受）仍停等用户
- User Decision: Accepted（2026-09-30 用户确认四条决策并授权业界最佳方案优先）

## 2. Research Findings
- 事实与约束:
  - **业界先例证实 agent skill 形态可行**：threejs-architecture-effects 与 3dviz-pro-max 都是"SKILL.md + 模板工程 + 验证回路"的 skill 打包形态，方法论可移植（装配分级、reason-before-render、截图自检、诚实分级）
  - **验证回路是业界共识核心**：3dviz-pro-max 用 Playwright capture 让 agent 看真实渲染帧而非凭空断言；threejs-architecture-effects 自带 verification 文档。与用户 generate-ux-prototype 的 CDP 冒烟经验同构
  - **向量检索喂料现成**：用户 manifest 格式的 search_text/tags/description 字段即 embedding 输入；thumbnail_path 支持多模态选型（缩略图给人看/给多模态模型看）
  - **three 0.185.1 与组件库兼容**：@a3d/a3d-components peerDeps `three>=0.150.0`，0.185.1 满足
  - **Blender MCP 是成熟建模通道**：~29.7k stars 活跃项目；LLM 可场景操作/Python 执行/**导出 GLB**/Poly Haven 素材/AI 生成（Rodin/混元）。~~作为建模主通道已裁决~~。**→ 通道已剔除（2026-10-12 用户裁决，见 §8.1）——以下 Blender 相关条目全部转为历史归档，不再是执行依据**。风险记录（历史）：execute_blender_code 是任意代码执行面（localhost 使用、保存现场）、socket 无鉴权、大资源下载冻结 UI 主线程
  - **Blender 通道双模式（2026-09-30 向用户说明，已归档）**：~~① MCP 交互式；② headless 脚本式；③ 两者皆无→LLM 直写兜底~~ → **2026-10-12 裁决：三通道只留 LLM 直写**
  - **用户澄清（2026-09-30）**：skill 是给很多人用的——用户只发文字/截图描述收工程，用户零建模工具操作；目标机器零外部依赖
  - **Blender 分发裁决（2026-09-30，已随 2026-10-12 剔除裁决作废）**：~~A/B 混合——便携版增强包 + install-blender 脚本~~ → **install-blender.mjs 取消（批次 5.1 撤销），本机 `~/.gts3d/blender/` 已清理（2026-10-13）**
  - **非 multimodal LLM 能力分层（2026-09-30；Blender 引用已随通道剔除过时，保留场景冒烟部分）**：skill 启动探测 LLM 多模态能力（或用户配置声明），分档执行——多模态档：渲染帧视觉判断；非多模态档：场景冒烟走结构化断言（WebGL canvas 像素统计/readPixels 采样、场景图 JSON 导出、CDP 布局断言，复用 generate-ux-prototype CDP 设施模式）。非多模态档结论按"诚实分级"标注"结构验证通过，未经视觉确认"。可选增强：截图先经本地脚本提特征（色彩分布/边缘密度/空白占比）变数字给 LLM 读
  - **性能规格重定（2026-09-30 用户补充，2026-09-30 二次修订）**：真实场景复杂——模型数量成百上千，性能要求 ≥40fps。推导：单模型 prop≤2k 三角（多数几百）、少量主角≤10k、场景总预算≤1M 三角；draw call 约束——**同类物体实例数 >1000 才强制 InstancedMesh**（≤1000 普通 mesh + 静态几何合并），场景 draw call 超预算由性能冒烟打回触发优化；全场景材质数上限（≤32 草案）；贴图降到单张≤1024² 图集优先。运行侧门禁：CDP 实测帧率 ≥40fps 不达标打回。**推论**：此性能档下工业级低模只能人工/专业管线产出，资产库检索复用从"优先"升为"性能刚需"；LLM 建模通道退为库未命中最后手段且必须过 validator
  - **母版工程机制确认（2026-09-30）**：LLM 每次生成 = 复制母版 + 填业务层。母版三层：① 引擎层（固定，LLM 永不修改：场景初始化/渲染循环/相机灯光/资产加载/增量更新协议/handler 注册机制）② 接入层（固定契约，LLM 只产出此处业务代码：handlers/<type>/<type>.ts、scene-data.json、cards/*.vue 可选、assets 引用清单）③ 文档（INTEGRATION_GUIDE.md 一份即可接手）。效果：引擎层跨交付物完全一致（bug 修一次全受益），二开者"数据级二开不需要懂 three.js，深度二开有完整源码"——与 generate-ux-prototype starter 模式同构，3d-templete handler 注册制思想一脉相承
  - **母版工程代码四要求（2026-09-30 用户）**：① 2D 卡片为可修改 Vue 组件，参考 3d-templete 卡片机制但用自己的想法重写；② 模板代码简洁可读、单一职责（场景/灯光/控制器/射线拾取/renderer 各自独立文件）；③ 遵循 3d-templete 的 eslint 配置；④ 双模式架构：编辑态（LLM 交流中选中调参：场景/控制器/灯光/renderer/材质/贴图，可调布局，类 Spline 可编辑）+ 二开态（二开者拿到的代码物理不含编辑态代码）。双模式隔离方案见下条
  - **双模式隔离方案（2026-09-30）**：edit → core 单向依赖。core（scene-core/：engine 各单一职责文件 + handlers/ + cards/ + scene-data.json + createScene.ts 唯一入口）不知道 edit 存在；edit/（SelectionService 射线选中复用 core 拾取、PropertyPanel 调参 UI、LayoutGizmo 布局拖拽、Bridge 唯一桥梁只调 core 公开 API sceneHandle、edit-main.ts 独立入口）整体可删除。两种交付：编辑态工程=core+edit（调参结果序列化回写 scene-data.json）；二开交付=build 剔除 edit/ + 回写后 scene-data.json（二开者代码里物理无编辑态）。机器保证：build 门禁规则——core 文件 import edit/ 即 FAIL；core 暴露有限 API（get/set 属性、serialize、updateObject 增量），edit 不得伸手进 core 内部。3d-templete editBridge/ 契约思想可参考、代码重写
  - **3d-templete 处置裁决（2026-09-30）**：代码不直接用（现有实现/assetLibrary 文本检索/lowPolyFallback 丢弃或重写）；三个架构思想吸收进新 skill：① LiveDataConfig JSON 驱动（数据进场景出，二开者改数据不改引擎）② handler 注册制（LLM 业务代码以 handler 插入，引擎母版不动——受控沙箱思想）③ 增量更新协议（物体移动/状态变色不重建场景，监控场景刚需）。新场景工程模板=重写，设计输入=3d-templete 三思想 + 业界最佳 + 新性能规格；LiveDataConfig schema 与 handler 契约作为起点重新推导
  - **模型生成规格 + 校验器双层机制（2026-09-30 修订版；2026-10-13 随 Blender 剔除改写「三条建模通道」表述）**：skill 内置 model-spec.md（用户可覆盖默认值）：底面中心 y=0 向上生长 / 三角面数 prop≤2k（多数几百）、主角≤10k、场景总预算≤1M / 子节点≤64 扁平化 / 命名小写 snake_case 语义化 / 贴图单张≤1024² 图集优先 / 米制 +Y up 导出转 glTF -Z forward / **同类物体实例数 >1000 才强制 InstancedMesh，≤1000 普通 mesh+静态几何合并**、材质数上限（草案≤32）。LLM 代码建模通道（唯一通道）：handler 内建约束（mesh 必须 .name 具名，见 GUIDE §3.2 命名约定）；产出实体 GLB 入库前统一 validator 脚本硬门禁（GLB 解析：面数/节点树/命名/贴图尺寸/bbox 原点），不合格打回而非警告；场景级性能冒烟门禁 CDP 实测≥40fps（draw call 超预算同样打回）
  - **Blender glTF 导出保证（已归档，通道剔除）**：~~原生 glTF 2.0 导出器支持 GLB~~——Blender 通道剔除后此条仅历史记录
  - **建模↔检索闭环（保留，通道改写）**：LLM 代码建模产出 GLB（若经入库）+ manifest 元数据回注册进资产库——下次检索命中，库随使用增长。**代码组合模型（修复轮九 car/rack/worker.ts）当前为 handler 过程化路线（不产 GLB），GLB 回库仅在产出实体模型文件时适用**
  - **generate-ux-prototype 外壳可复用模式**（非代码，模式）：init 脚手架（starter 工程）、build 门禁（结构扫描+import 白名单）、预览（file:// 或 dev server）、CDP 冒烟断言、vendor 示例沉淀
  - **内网约束传承**：npm 走内网源 mirrors.tools.huawei.com、无 CDN 依赖——新 skill 延续此纪律
  - **本地 embedding 可行性**：不引大模型的前提 = 轻量词法向量（如 TF-IDF/字符 n-gram 哈希向量 + 余弦相似度）或极小 onnx 模型；检索对象是"资产描述文本"（search_text/tags/description 拼接），语料小且领域窄，词法方案够用——精确方案 Plan 内定，先记方向
- 风险与不确定项:
  - 本地轻量 embedding 的召回质量未验证——Plan 中安排检索样例验证（给定查询，断言期望资产进 top-k）
  - Blender MCP 是外部依赖（需用户本机装 Blender+插件）——~~skill 必须把它设计为"可选增强通道"而非硬依赖~~ → **已裁决剔除（2026-10-12），外部依赖归零**
  - LLM 过程化建模质量不稳定（漂浮/比例失调）——业界方案是装配分级+截图自检，skill 内固化为硬约束
  - 模型库规模未知——向量索引方案要支持从几个到几千个资产的伸缩
  - gltf（带外部 .bin/纹理）比 glb 复杂（多文件依赖）——入库管线要处理解包后的相对路径
  - assets/ 随 skill 投递会放大 skill 目录体积（模型二进制）——未来迁云端前，投递包大小需在 Plan 中声明上限策略（如排除大模型或按需解压）

## 2.1 Next Actions
- ~~用户澄清 Q1-Q5~~（2026-09-30 全部裁决，见 §0）
- ~~Q5 组件库组织方案~~ → 已裁决 Option C，经 Plan Approved 2026-09-30 一并确认（§3 Decision 同步）
- ~~进入 Plan~~ → Plan Approved 2026-09-30
- ~~组件库接入机制终裁~~（2026-10-09，§3 Decision 修订：tarball + file: 依赖 + 全 md 生成链，见 §3 Decision 2026-10-09 增补）
- ~~批次 C~~（2026-10-09 全部完成，含源仓构建链存量修复，见 §4.7 批次 C 执行记录）
- ~~批次 R~~（2026-10-09 全部完成，R.1–R.9 四道门禁全绿，见 §4.7 批次 R 执行记录与 Plan-Execution Diff #16）
- ~~批次 2 / 批次 M / 批次 T~~（2026-10-09 全部完成，见 §4.7 各批次执行记录；M+T+D4 修订轮已过 REVIEW EXECUTE 三轴评审，评审记录 5 Overall Verdict: PASS，§6）
- ~~批次 3~~（2026-10-10 全部完成：3.1–3.3 落地 + gates.mjs 40/41 用例全 PASS；REVIEW EXECUTE 评审记录 6 初判 CONDITIONAL PASS → **修复轮（§7 #27）后升 PASS**）
- ~~批次 MU~~（2026-10-10 全部完成，MU.1–MU.8，§7 #28；含修复批次 M 遗留缺陷）
- ~~批次 MU2~~（2026-10-10 全部完成，MU2.1–MU2.8，§7 #29；MU.8 用户验收反馈驱动。**MU + MU2 已过 REVIEW EXECUTE（评审记录 7，Overall Verdict: PASS；P3×4 挂账批次 5）**。MU2 人工走查又出三项反馈 → 立项批次 MU3）
- **批次 MU3 立项待批准**（2026-10-10，§4.15 契约已落盘，checklist 见 §4.7：浅色主题 / 浮动面板避让固定面板 / 材质分区收拢）→ **已完成**（同日，用户「全部」批内连跑；三绿 + SMOKE 38/38，见 §4.7 执行记录）
- **批次 MU4 立项待批准**（2026-10-10，§4.15.5 契约已落盘，checklist 见 §4.7：条目 ⊞ 直达素材库 / 编辑面板锚定素材库——用户 Spline 实测困惑 + 属性面板 DOM 解码驱动：Spline 三入口全开 palette、编辑球是 palette 二级子面板、条目点击无反应；裁决融合为两入口各一 + 贴靠锚定）→ **已完成**（同日，用户「全部」批内连跑；三绿 + SMOKE 39/39，见 §4.15.5 执行记录）
- **批次 M2 立项待执行**（2026-10-10，§4.13 契约已落盘，checklist 见 §4.7）→ **已完成**（2026-10-10/11 批内连跑；含 Draco 支持与槽位 key 双口径对齐两大发现，SMOKE 44/44 + gates 40/40，见 §4.7 M2 执行记录）
- **当前（2026-10-10）**：批次 1 / C / R / 2 / M / T / 3 全部完成且评审闭环。新立项批次 MU（材质库 UI 重做）+ M2（GLB 子节点多材质）。**执行序：MU → MU2 → M2 → 批次 4（验证回路）→ 批次 5（skill 大脑+收尾）。批次 MU 完成（MU.1–MU.8，§7 #28；含修复 1 处批次 M 遗留缺陷）；MU.8 用户验收反馈（面板右侧浮出 / 不重叠可并排 / 一材质一行）→ 新立项批次 MU2（材质面板布局重做，§4.14）**已完成**（§7 #29，三绿 + SMOKE 35/35）。**批次 MU + MU2 已过 REVIEW EXECUTE（评审记录 7，PASS；P3×4 挂账批次 5）。MU2 人工走查三项反馈（浅色主题 / 浮动面板叠右栏 / 材质分区收拢）→ 立项批次 MU3（§4.15）**已完成**（三绿 + SMOKE 38/38；人工视觉走查待用户）。执行序：MU → MU2 → MU3 → MU4 → M2 → 批次 4 → 批次 5。MU3 后用户 Spline 实测困惑（编辑球触发不定/面板互斥共存不定）经 DOM 解码定案 → 立项批次 MU4（§4.15.5：条目 ⊞ 直达素材库 + 编辑面板锚定素材库）**已完成**（三绿 + SMOKE 39/39；验收三轮反馈修复：index 1 错位槽 → 排队模型 → resize 钳制 + 整档错位）。**下一动作：批次 M2 批内连跑（不停等）→ 跑完对 MU3 + MU4 + M2 一起 REVIEW EXECUTE**（用户裁决 2026-10-10）。**批次 M2 已完成（2026-10-10/11：SMOKE 44/44 + gates 40/40 + 三绿；含 Draco 支持 / 槽位 key 双口径对齐 / 单 mesh 回落三大发现）→ 下一动作 REVIEW EXECUTE（MU3 + MU4 + M2 合并三轴评审）**

## 3. Innovate (Optional: Options & Decision)
- Skipped: false（Q5 组件库组织是方案级分叉，按用户要求给出方案对比）

### Option A：组件库走"检索源"（同模型库一样进向量索引）
- Pros: 与模型资产统一管线；组件多时精准定位
- Cons: 组件是**源代码**不是二进制——检索只能匹配元数据（name/description/tags），但命中后 LLM 需要读完整源码才能正确 import/使用，索引行价值低；组件数量少（14+），检索是杀鸡用牛刀

### Option B：组件库走"vendor 参考"（generate-ux-prototype 同款）
- Pros: 已验证的成功模式（vendor 示例 001-007 是该 skill 质量最高的部分）；组件源码常驻 references，LLM 直接读、直接抄、直接 import——匹配"能直接使用"的定位；无需索引构建
- Cons: 全量常驻上下文有体积开销（需按需加载路由控制）

### Option C（建议）：**分层的混合制——"目录常驻 + 源码按需"**
- Pros: 兼得 A/B 之利——组件目录（name + 一句话 summary + importPath + 关键 props）做成一份**轻量清单常驻**（LLM 每次都能"知道有什么组件"），组件**完整源码按需读**（LLM 判定要用哪个，再读对应文件抄用法）；与模型库检索（真正需要向量）分开，各自用对的方法
- Cons: 需要维护"目录清单"这份派生物（可由脚本从源码生成，避免手抄漂移）

### Decision
- Selected: **C**（经 Plan Approved 2026-09-30 一并确认）
- Why: 组件的本质是"可 import 的代码"而非"待加载的模型"——LLM 用组件的正确姿势是"知道有什么 → 读源码学用法 → import 使用"，这是 vendor 模式而非检索模式；但 14+ 组件全量塞上下文不经济，目录清单+按需读源码是业界（含 generate-ux-prototype 的 vendor 路由）验证过的平衡点。模型库则保持向量检索（二进制模型无法常驻上下文，检索是唯一入口）
- User Decision: Accepted（2026-09-30 Plan Approved 即确认；2026-10-08 评审复核时锚定）

### Decision 增补：组件库接入机制终裁（2026-10-09，用户裁决）

> 原因：skill 导出给所有用户——别人机器上没有 3d-components 文件夹，"外部路径引用"不成立。且 3d-components 是内网团队私有资产：最终形态是"看文档 → import → 不可见源码、不可改"，持续更新。

- **形态演进三段**（临时方案必须是最终方案的子集，杜绝返工）：
  1. **现在（验证期）**：`npm pack` 出标准 tgz → skill `vendor/` 携带 → 产物工程 `package.json` 写 `"@a3d/a3d-components": "file:./vendor/a3d-components-<ver>.tgz"`。import 路径（`@a3d/a3d-components/core` 等）与未来真包完全一致，发 npm 后产物工程只改版本号一行。
  2. **未来（发包后）**：产物工程改走内网 registry 版本号依赖，skill 不再携带 tgz。
  3. **已否决**：~~vendor src 进 skill~~（私有源码随 skill 扩散）、~~直接拷 dist 进产物工程~~（import 变相对路径，发包时全工程改写）、~~JSON catalog~~（见下）。
- **LLM 文档链 = 两级 md，源码零读取**（token 三级阶梯）：
  - Tier-1 常驻：`references/component-catalog.md`——每组件一行（name + 一句话 + importPath），~1.5K tokens，LLM 每次可读
  - Tier-2 按需：`references/component-docs/<Name>.md`——constructor + options 表 + 最小示例，LLM 决定用某组件时才读
  - 逃生口：`.d.ts` 随 tgz 进产物工程 node_modules（类型契约必需，vue-tsc/IDE 依赖），LLM 仅在 md 歧义时才读
- **文档单一真相源 = 组件源码 TSDoc**：summary/options/@default/@example 全部写进源码注释，`typedoc --json` 提取 → 脚本格式化为上述两级 md。手维护文档必漂移（现状 HTML→JSON 链已是二次转手实证），源码生成永不漂移。全 md 不用 JSON（消费者只有 LLM+脚本，md 人可直接审）。
- **作者协议**（写进 3d-components 源仓 CONTRIBUTING）：新组件 ① 类头部 TSDoc（summary + @example）② options 每字段 TSDoc + @default ③ barrel 导出 ④ 跑 sync-components.mjs。机器门禁：sync 脚本发现"已导出但 TSDoc 缺失"→ 非零退出。
- **组件持续更新机制**：3d-components 仓库保持开发主线；组件改完 → 源仓跑 `node <skill>/scripts/sync-components.mjs`（pack → 拷 tgz + 生成两级 md → 版本戳写 catalog）→ skill 内组件资产即新。交付工程各自钉 tgz 版本，升级显式。
- **UXAI 仓影响边界**：`docs/components.json` 现有另一消费者 UXAI `sync-catalog.mjs`——不迁移不动它；新链独立产出 md，components.json 去留后续单独定，不阻塞本任务。
- **源仓顺带修正（P1，两行）**：peerDeps `three: ">=0.150.0"` 收窄为 `">=0.183.0 <0.190.0"`（0.x minor 即破坏）；`@types/three` 对齐 `^0.185.0`。license/publishConfig 用户明确不动。
- User Decision: Accepted（2026-10-09，用户裁决"前期源码可见不必须→不做；深查 d.ts 非必经→保留逃生口；全 md；跨仓库执行授权模型读写"）

## 4. Plan (Contract)

> 通读指引：本 Plan 分六部分。**A** 说清这个 skill 是什么、怎么用（产品视角）；**B** 是 skill 目录里每个文件干什么；**C** 是三条核心流水线怎么运作（资产入库/场景生成/验证）；**D** 是母版工程的代码结构（重点：双模式怎么隔离）；**E** 是脚本签名（技术契约）；**F** 是执行清单（原子步骤，Approved 后照此逐条做）。
> 技术栈全程锁定：Vue 3 + three.js **0.185.1** + TypeScript。内网纪律：npm 内网源、零 CDN。

### 4.0 总览：这个 skill 是什么

**一句话**：用户丢进来一段文字（或一张截图）描述 3D 场景 → skill 带着 Claude 走完「检索资产 → 缺的建模 → 生成工程 → 验证达标」全流程 → 交付一个可二次开发的 Vue3+three.js 工程。

**用户拿到手的交付物**（两类，见 4.3 双模式）：
- 编辑态工程：能点选物体、调参数、拖布局，调完自动存盘
- 二开态工程：干净的运行时工程 + 集成文档，二开者不需要懂 three.js 就能改数据级内容

**skill 使用者的两种身份**（都会存在，流程对两者透明）：
- 终端用户：只发描述、收工程，全程不接触建模工具/three.js 概念
- skill 运维者：管理资产库（上传压缩包）、配置 embedding/镜像 URL

### 4.1 File Changes（skill 目录树，全部新建）

> 落位：`ep-coder/skills/generate-3d-scene/`（与 generate-ux-prototype 同级）

```
generate-3d-scene/
├── SKILL.md                          # 入口：工作流九步 + 硬约束 + 命令路由
├── README.md                         # 投放说明（安装/资产库准备/内网镜像配置）
├── references/
│   ├── scene-workflow.md             # 九步工作流逐步指引（含每步 DoD 与停止点）
│   ├── asset-pipeline.md             # 资产入库手册：压缩包格式、manifest schema、校验规则
│   ├── model-spec.md                 # 模型规格（默认值+覆盖方法）：面数/命名/原点/贴图…
│   ├── modeling-channels.md          # 代码建模指引（LLM 直写唯一通道：简模图元/精模代码组合模型，
│   │                                 #  含修复轮九范式与 handler mesh 命名约定）——Blender 三通道版已废（§8.1）
│   ├── verification.md               # 验证回路：多模态/非多模态两档断言清单 + 性能观测口径（R1-3 修订版）
│   ├── scene-engineering.md          # 母版工程结构说明 + handler 契约 + 二开指南要点
│   ├── component-catalog.md          # 组件清单（脚本生成）：name+summary+importPath+props 摘要
│   └── eslint-notes.md               # eslint 继承说明（3d-templete 规则集迁移注意点）
├── scripts/
│   ├── ensure-env.mjs                # 环境探测：node 版本/three 版本/多模态声明（Blender 探测已删，§8.1）
│   ├── import-assets.mjs             # 压缩包+manifest 入库：解压/校验/规格门禁/建索引
│   ├── build-search-index.mjs        # 向量索引构建：manifest 文本字段 → 轻量词法向量 → 索引文件
│   ├── search-assets.mjs             # 检索 CLI：query → top-k 资产（含相似度分数），LLM 直接调
│   ├── validate-model.mjs            # GLB 规格校验器（入库门禁）：面数/节点/命名/贴图/bbox 原点
│   ├── init.mjs                      # 脚手架：复制母版工程 → 目标目录 + 替换占位
│   ├── build.mjs                     # 工程构建门禁：结构扫描 + 依赖方向检查（core←edit 单向）
│   ├── strip-edit.mjs                # 二开态导出：剔除 edit/ + 清理编辑引用 + 产出交付包
│   └── verify/
│       ├── smoke-structural.mjs      # 结构化冒烟（非多模态档）：场景图 JSON/canvas 像素统计断言
│       ├── smoke-visual.mjs          # 视觉冒烟（多模态档）：渲染帧截图产出给 LLM 看图判断
│       └── perf-fps.mjs              # 性能观测（R1-3 修订版）：预算三项+fps 采样全 WARN 观测项（--strict 恢复门禁）
├── template/                         # 母版工程（见 4.3，结构完整可独立 build）
├── vendor/
│   └── a3d-components-<ver>.tgz     # 3d-components npm pack 产物（sync-components.mjs 同步，最终发包后移除）
└── assets/
    ├── models/                       # 模型二进制（glb/gltf）
    ├── thumbnails/                   # 缩略图
    ├── manifests/                    # 每个上传包一份 manifest JSON（用户填的元数据）
    └── search-index.json             # 向量索引（build-search-index.mjs 产物，随资产更新重跑）
```

**3d-components 组件库的接入**（2026-10-09 终裁，详见 §3 Decision 增补；不 vendor src、不外部路径引用）：
- `scripts/sync-components.mjs`：**在 3d-components 源仓侧执行**——`npm pack` 出 tgz → 拷入 skill `vendor/` → `typedoc --json` 提取 TSDoc → 生成 `references/component-catalog.md`（Tier-1 一行一组件）+ `references/component-docs/<Name>.md`（Tier-2 用法页）→ 版本戳写入 catalog 头部；发现已导出但 TSDoc 缺失的组件 → 非零退出（机器门禁）
- 产物工程消费：init.mjs `--with-components` 时复制 tgz 进产物工程 `vendor/` + package.json 写 `"@a3d/a3d-components": "file:./vendor/a3d-components-<ver>.tgz"`；import 路径 `@a3d/a3d-components/core` 与未来真包一致
- LLM 用法：读 Tier-1 catalog 判断"有没有能用的" → 按需读 Tier-2 用法页学 options → 在 handler 里 import（源码零读取；`.d.ts` 仅歧义时逃生口）

### 4.2 Signatures（关键契约，Plan 期只定签名不写实现）

**manifest JSON schema**（用户上传压缩包必须附带的元数据，扩展自用户样例）：
```jsonc
{
  "meta": { "type": "file", "source_id": 16, "group_id": 973, "version": "1" },
  "data": [{
    "name": "示例资源",              // 必填，显示名
    "file_name": "example.glb",     // 必填，压缩包内主文件
    "file_path": "data/example.glb",// 必填，包内相对路径（gltf 需含 bin/纹理相对路径自洽）
    "thumbnail_path": "image/e.png",// 可选，缩略图
    "description": "示例描述",       // 建议，检索喂料
    "tags": ["示例"],               // 建议，检索喂料
    "search_text": "关键词",        // 建议，检索喂料（与 tags/description 拼接做 embedding）
    "category": "equipment",       // 建议：demo/equipment/building/vegetation/vehicle/…
    "raw_data": {}                 // 可选，透传
  }]
}
```

**检索结果条目**（`search-assets.mjs` 输出给 LLM 的 JSON 行）：
```jsonc
{ "id": "example", "name": "示例资源", "score": 0.87, "format": "glb",
  "category": "equipment", "tags": ["示例"], "modelPath": "assets/models/example.glb",
  "description": "…" }
```

**向量索引方案**（本地轻量，不引大模型）：
- 词法向量：查询与资产文本（name+category+tags+description+search_text 拼接）做**字符 n-gram 哈希向量 + TF-IDF 加权**，余弦相似度排序
- 理由：语料是短描述文本、领域窄、库小起步——词法方案零依赖零下载，先满足"本地即可用"；内网 embedding API 后续接入时只换 `embed()` 实现（接口已抽象），索引格式不变
- 索引验证：import-assets 内置冒烟样例（中文查询命中期望资产 top-3），失败即入库 FAIL

**validate-model 规格门禁**（model-spec.md 的机器执行面，用户可 CLI 覆盖）——**分级门禁**（2026-10-09 裁决，批次 2 落地）：

| 门禁类别 | 项目 | art 档（默认：第三方美术资产） | strict 档（AI 生成资产，降级阶梯第 4 层） |
|---|---|---|---|
| 性能类（硬阻断） | 面数 | 道具≤5k / 主角≤50k | 道具≤2k / 主角≤10k |
| | 子节点 | ≤64 | ≤64 |
| | 贴图 | 单张≤2048，≤8 张/模型 | 单张≤1024，≤4 张/模型 |
| | 几何 | 必须含 POSITION 几何 | 同左 |
| 约定类 | 命名 | ^[a-z][a-z0-9_]*$（**默认告警**） | 同规则（**阻断**） |
| | 原点 | 底面中心 y=0（bbox.min.y≈0，容差 0.01）（**默认告警**） | 同规则（**阻断**） |
| | 高度 | 0.05~200m 合理性（**默认告警**） | 同规则（**阻断**） |

理由（用户 2026-10-09 裁决「分级门禁」）：第三方美术资产（Sketchfab/Collada 导出）系统性违反命名/原点约定，且以不透明实例加载，约定对其使用价值影响小；约定纪律真正保护的是 AI 生成资产（LLM 靠名字定位部件、靠原点摆放）。约定类偏差默认写入库 manifest（`gate.deviations`，可审计）。CLI：`--strict` 切档，逐项阈值可覆盖。

**母版工程 core API**（createScene 唯一入口返回的 sceneHandle；契约以代码现状为准，2026-10-08 评审同步）：
```ts
interface SceneHandle {
  update(patch: TreeSceneFragment): void    // 增量更新（同格式片段幂等 upsert，不重建场景）
  serialize(): SceneData                    // 当前场景 → scene-data.json 结构（含全部参数）
  pick(clientX: number, clientY: number): PickResult | null   // 射线拾取（edit 复用）
  setDebug(enabled: boolean): void          // HUD：fps/calls/triangles
  onCardState(cb: (states: CardState[]) => void): void        // 2D 卡片状态订阅
  refreshCards(): void                      // 手动触发卡片状态刷新
  frameObject(id: string): void             // F 聚焦：相机看向指定物体
  onCameraSwap(cb: (camera: Camera) => void): () => void      // 透视/正交切换重挂回调
  internals: { ... }                        // edit 外壳实现便利通道（非稳定 API，二开者禁用）
  dispose(): void
}
```
build.mjs 铁律 2 判定规则：**edit/ 下 import scene-core 只允许 `'@/scene-core'` 一个入口**；禁止直接 `import … from '@/scene-core/engine/xxx'`；engine 实例经 `handle.internals` 属性访问放行。

**场景数据 schema v3**（scene-data.json＝引擎内部存储＝编辑器序列化产物＝生产更新片段＝undo 快照，五种用途一种格式；2026-10-08 裁决，取代下方旧版 schema）：

> v3 核心原则：**数据只有业务属性，视觉全部在代码**。key:Array 分组结构（3d-templete TreeScene 骨架）内外统一，零格式转换。完整契约见 §4.9。

**场景数据 schema（旧版 v2，已被 v3 取代，保留供 Diff 追溯）**：
```jsonc
{
  "version": "1",
  "meta": { "name": "厂区监控", "description": "…" },
  "scene":  { "background": "#87CEEB", "environment": { "preset": "studio", "intensity": 1 }, "fog": null },
  "camera": { "type": "perspective", "position": [x,y,z], "lookAt": [x,y,z], "fov": 50 },
  "lights": [ { "type": "directional", "position": [...], "intensity": 2.2, "castShadow": true } ],
  "controls": { "type": "orbit", "target": [x,y,z], "minDistance": 5, "maxDistance": 200 },
  "renderer": { "toneMapping": "ACESFilmic", "exposure": 1.0, "shadowMap": "PCFSoft" },
  "objects": [ { "id": "turbine_01", "type": "asset", "assetId": "wind_turbine",
                 "position": [x,y,z], "rotation": [x,y,z], "scale": 1,
                 "materialOverride": null, "params": {} } ],
  "cards":  [ { "id": "card_t1", "attachTo": "turbine_01", "component": "TurbineCard",
                "props": { "title": "1号风机" }, "trigger": "click" } ]
}
```

### 4.3 母版工程结构（template/，双模式隔离是本 Plan 的架构核心）

```
template/
├── package.json            # vue3 + three@0.185.1 + vite + typescript + eslint（内网源）
├── eslint.config.mjs       # 从 3d-templete 迁移的规则集（继承其 rules，适配新目录结构）
├── vite.config.ts
├── index.html              # 双入口：?edit=1 走 edit-main.ts，默认走 main.ts
├── src/
│   ├── main.ts             # 二开态入口：createScene(canvas, sceneData) 一行启动
│   ├── edit-main.ts        # 编辑态入口：main 之上挂载 edit 外壳（本文件属于 edit 世界）
│   ├── scene-core/         # ★ 共用核心（二开交付物保留的全部）
│   │   ├── createScene.ts          # 唯一入口，返回 SceneHandle；不 import edit/ 任何东西
│   │   ├── engine/                 # 单一职责，每个文件一件事
│   │   │   ├── SceneEngine.ts      #   场景图管理
│   │   │   ├── CameraEngine.ts     #   相机
│   │   │   ├── LightEngine.ts      #   灯光
│   │   │   ├── ControlsEngine.ts   #   控制器（orbit）
│   │   │   ├── RendererEngine.ts   #   renderer/toneMapping/阴影
│   │   │   ├── RaycastEngine.ts    #   射线拾取（core 内部用 + edit 经 handle.pick 用）
│   │   │   ├── AssetEngine.ts      #   GLB 加载/缓存/规格预检（加载时再校验一遍规格）
│   │   │   └── RenderLoop.ts       #   渲染循环 + resize + 帧统计（perf-fps 数据源）
│   │   ├── handlers/               # 业务 handler（LLM 产出/二开者扩展的插入点）
│   │   │   ├── registry.ts         #   type→handler 注册表
│   │   │   └── example/            #   示例 handler（starter 演示用，二开者参照写新的）
│   │   ├── cards/                  # 2D 卡片 Vue 组件（纯样式+props，二开者随便改）
│   │   │   ├── registry.ts         #   卡片类型→组件注册
│   │   │   └── ExampleCard.vue
│   │   ├── types.ts                # SceneDataJSON/SceneHandle/TreeNode 等公共类型
│   │   └── scene-data.json         # 场景数据（编辑态回写目标 / 二开态改这里）
│   └── edit/                      # ★ 编辑态外壳（二开交付物中物理不存在）
│       ├── Bridge.ts               # 唯一桥梁：只调 SceneHandle 公开 API
│       ├── SelectionService.ts     # 选中高亮（复用 handle.pick）
│       ├── PropertyPanel.vue       # 调参面板（场景/相机/灯光/控制器/renderer/材质/贴图）
│       ├── LayoutGizmo.ts          # 选中物体拖拽移动/旋转/缩放
│       ├── SaveService.ts          # serialize() → 下载/回写 scene-data.json
│       └── Toolbar.vue             # 编辑工具条
└── docs/INTEGRATION_GUIDE.md      # 二开者唯一必读：4 步接入/卡片开发/handler 开发/常见任务
```

**三条铁律**（build.mjs 机器保证，不靠自觉）：
1. `scene-core/**` 内任何文件 import `edit/` 下内容 → **build FAIL**
2. `edit/**` 只能经 `createScene` 返回的 SceneHandle 触达 core，直接 import engine 内部文件 → **build FAIL**
3. `strip-edit.mjs` 导出二开包后，产物内 grep `edit`（import 语句形态）必须零命中 → 否则 FAIL

**双模式交付流程**：
```
LLM 调参期：init 出编辑态工程（core+edit 全量）→ LLM 起 dev server → 面板调参/拖布局
           → SaveService 回写 scene-data.json
交付期：strip-edit.mjs → 产出「纯 core 工程 + 定稿 scene-data.json」→ 二开包
```

### 4.4 降级阶梯（LLM 拿到场景需求后的资产决策顺序，SKILL.md 硬约束）

> **2026-10-13 修订（依据 2026-10-12 用户裁决，见 §8.1）**：删除原第 4 层「Blender 建模」，原第 5 层「LLM 直写」升为第 4 层。资产缺口前置由 Poly Haven 精选库预填（批次 PH，56 资产已入库）。

```
第1层 检索命中 → 直接用（search-assets top-k 有合适资产）
第2层 检索近似 → 参考改造（命中同类但细节不符：加载后 scale/材质覆盖/组合多个）
第3层 组件拼装 → 用组件库按需组合（读 component-catalog.md + 按需 component-docs/<Name>.md，
                     handler 内 import '@a3d/a3d-components/...'，源码零读取，见 §3 Decision 增补）
第4层 LLM 直写 → three.js 代码建模（唯一过程化建模通道，零外部依赖）
                     简模：图元/参数化几何（数百行内）；精模：代码组合模型（修复轮九 car/rack/worker.ts
                     实证——多节点拼装+子节点独立材质，槽位级编辑全链路可用）
                     → 产出实体 GLB 时过 validate-model 门禁；handler 过程化产物走 build.mjs 场景预算
每一层都比上一层"重"，SKILL.md 规定：能跳过就不升级，升级需在执行日志记录原因
```

~~**Blender 环境探测**（ensure-env.mjs，按序）~~ → **已删除（2026-10-12 裁决）**：Blender 通道剔除后 ensure-env.mjs 不再探测 Blender（缩为 node 版本/three 版本/多模态声明，见批次 4.4）。原探测链（缓存便携版→install-blender 拉取→系统 Blender+MCP→LLM 直写）随通道一并作废。

### 4.5 验证回路（每次场景生成必须走完，Done by Evidence）

```
① build 门禁        build.mjs：结构完整 + 三条铁律 + import 白名单（three@0.185.1/vue3 内网源版本）
② 结构冒烟          smoke-structural.mjs：CDP 加载页面 → 断言场景图 JSON（物体数量=预期/
                    相机存在/模型加载成功计数）+ canvas 像素统计（非空/非单色）+ 零 rejection
③ 视觉冒烟（多模态档）smoke-visual.mjs：四视口截图（全景/主视角/特写/线框）→ LLM 看图判定
                    （比例/遮挡/漂浮/配色）；非多模态档交用户浏览器人眼验收，结论标注"未经视觉确认"
④ 性能观测          perf-fps.mjs：预算三项（calls/triangles/programs，秒级直读）+ fps 采样
                    （默认 20s，p95 计算）——全部 WARN 观测项不判 FAIL；LLM 须对每条 WARN
                    在验证报告回应（优化或说明理由）；`--strict` 恢复 FAIL 判定；
                    用户反馈"卡"→ LLM 参考基线数据修复 → 复测对比
⑤ 诚实分级          验证报告注明：哪些断言机器验证 / 哪些 LLM 看图验证 / 哪些未经视觉确认
```

**R1-3 修订（2026-10-13 用户裁决，推翻原「预算+fps 双 FAIL 门禁」）**：

- **裁决动因**：① 预算数值（calls≤400/triangles≤1M/materials≤32）与 fps 同为**机器相关判断**——生成环境（A 机）超标对交付环境（B 机独显）可能毫无压力，「超标」不是机器无关的客观事实；② **性能取舍属用户主权**——优化=砍物体/换低模/合并材质，在用户没说可以牺牲视觉之前替他做取舍可能优化掉他想要的东西；「用户觉得卡再让 LLM 修」回路反而精准（真实机器/真实规模/真实交互下的真实不满）；③ 自动循环修复存在无上限空转风险（等待焦虑），fps 60s 采样×无上限循环成本不对称。
- **新分类**：**坏**（报错/白屏/无法渲染/场景图不符/加载失败）= 唯一硬 FAIL，进修复循环（秒级断言，fail-all 一次全列出——学 ux-prototype build.mjs 协议）；**重**（预算三项超限）= WARN + LLM 必须回应；**卡**（fps）= WARN 观测值，用户反馈驱动。
- **存量改造（批次 4 执行项）**：perf-fps.mjs 预算/fps 断言 FAIL→WARN（`--strict` 恢复 FAIL，validate-model 同款先例）+ `--duration` 默认 60→20；build.mjs 预算超限 errors→warnings（`--strict` 同步）。「W44 计数」（gates 用例）如断言预算 FAIL 行为需同步改口径。
- **与验证策略修订（2026-10-13）的关系**：同日两修订精神一致——机器断言降本、人眼验收升权、诚实分级。

### 4.6 SKILL.md 九步工作流（references/scene-workflow.md 展开，此处定骨架）

```
S1 澄清需求    文字/截图 → 场景要素清单（物体/规模/交互/数据更新）→ 缺关键信息则停、问
S2 检索资产    search-assets（多查询词覆盖）→ 命中/近似/缺失 三分类
S3 缺口建模    按 4.4 阶梯补缺（每层升级记录原因）→ 产出资产全部过 validate-model
S4 生成工程    init.mjs 出编辑态工程 → 按检索/建模结果填 scene-data.json + handlers + cards
S5 build+冒烟  4.5 的 ①②（不过则修复重跑，循环至过——秒级断言 fail-all，一轮改完再跑）
S6 视觉/性能   4.5 的 ③④（性能为 WARN 观测项：LLM 回应每条 WARN，用户觉得卡再修——
               不自动循环优化；fps 基线数据留验证报告供修复对比）
S7 交互联调    卡片/handler/增量更新演示数据 → 结构冒烟回归
S8 编辑调优    起 dev server → LLM 用编辑态自检微调（多模态看截图，非多模态看数值）
               → SaveService 定稿 scene-data.json（用户要求人工看效果时停、等确认）
S9 交付        strip-edit 出二开包 + INTEGRATION_GUIDE 校验 + 验证报告 + 执行日志
```

### 4.7 Implementation Checklist（原子步骤，依赖序）

> 批准后逐条执行，每条完成即更新本清单与 Execute Log。分五批，批内可连续，批间停等确认。

**批次 1：skill 骨架 + 母版工程（最重、先行）**
- [ ] 1.1 建 skill 目录树（4.1 全部目录 + 空 SKILL.md/README.md 占位）
- [ ] 1.2 template 工程 package.json + vite/ts/eslint 配置（eslint 从 3d-templete 迁移适配）
- [ ] 1.3 scene-core/engine/ 八个单一职责引擎文件（SceneEngine…RenderLoop）
- [ ] 1.4 createScene.ts + types.ts + SceneHandle API 实现
- [ ] 1.5 handlers/registry.ts + example handler；cards/registry.ts + ExampleCard.vue
- [ ] 1.6 edit/ 六个文件（Bridge/SelectionService/PropertyPanel/LayoutGizmo/SaveService/Toolbar）
- [ ] 1.7 main.ts / edit-main.ts / index.html 双入口
- [ ] 1.8 docs/INTEGRATION_GUIDE.md（二开文档）
- [ ] 1.9 template 自身 build 通过 + 手动冒烟（starter 场景可渲染）

**批次 T：场景树 Spline 化（2026-10-09 立项；2026-10-09 执行完成，四道门禁全绿，见 §7 #20）**
> 依据 §4.11 契约。现状：OutlineTree.vue 为平铺列表（无层级/搜索/显隐/锁定）；数据层 SceneNode.parentId 已支持层级（v3 契约"可跨分组组树"），__visuals.visible 已存在（批次 R.6）。锁定为新增字段。
- [x] T.1 OutlineTree.vue 树化重写：分组 key 作可折叠根节点（chevron + 名称 + 计数），组内按 parentId 嵌套缩进；跨分组父子按分区优先（父在 A 组、子在 B 组时子随父分区显示）；孤儿节点（parentId 指向不存在 id）挂根级并 warn
- [x] T.2 搜索行：id 子串匹配（不区分大小写），命中节点 + 祖先链自动展开；清空恢复全树；无结果显示空态
- [x] T.3 行内显隐按钮（eye）：走 `update({__visuals:{[id]:{visible:…}}})` 现成通道（undo 天然可恢复）；父隐藏时子按钮呈继承态（图标半透明 + tooltip）；按钮点击不冒泡为选区
- [x] T.4 行内锁定按钮（lock）：VisualOverride 扩 `locked?: boolean`；语义 = Spline 同款——视口点选跳过锁定物体、Gizmo 不吸附，树中仍可点选（看属性不受影响）
- [x] T.5 锁定过滤接线：`handle.pick(x,y,filter?)` 可选谓词（core 不感知锁定语义）+ SelectionService 传 `id => getVisual(id)?.locked !== true`（视口点选跳过）+ LayoutGizmo.syncSelection 命中锁定则 detach（transform 跳过）；过滤入口统一 `getVisual(id)?.locked`（经 handle.internals）。注：代码库无框选实现（原措辞「框选跳过」改为此）
- [x] T.6 冒烟扩展（smoke-r.mjs 增段）：树 DOM 层级断言（分组根 + 嵌套子节点）/ 搜索过滤断言 / eye 落库断言（__visuals.visible 回读）/ lock 拾取跳过断言（raycast 不命中锁定物体）+ 三绿（vue-tsc / build / eslint）

**批次 T 执行记录（Reverse Sync，2026-10-09）**：T.1–T.6 全部落地，四道门禁全绿（详见 §7 #20）。核心决策：锁定过滤走 `handle.pick(x,y,filter?)` 可选谓词（core 只当不透明谓词执行，不感知锁定语义）；smoke 断言因既有 S15–S17 占用顺延为 S18–S21。

**批次 2：资产管线**
- [x] 2.1 manifest schema 校验器（import-assets 内嵌）+ 样例压缩包（example+rack 两个 GLB 从 3d-templete 库转入做种子资产）
- [x] 2.2 import-assets.mjs：解压/校验/规格门禁（validate-model）/落库
- [x] 2.3 validate-model.mjs 独立可跑（GLB 解析：面数/节点/命名/贴图/bbox）
- [x] 2.4 build-search-index.mjs：n-gram TF-IDF 词法向量索引 + 内置检索冒烟样例
- [x] 2.5 search-assets.mjs CLI（query → top-k JSON）+ 检索质量验证（中文查询命中种子资产）

**批次 M：材质编辑器 + 材质库（2026-10-09 立项，批次 2 之后、批次 3 之前执行；2026-10-09 完成，见 §7 #19）**
> 依据 §4.10 契约（参数契约已对照实装 three@0.185.1 校正）。五项裁决见 §4.10.0。edit/ 新增 MaterialLibService.ts；core 侧 materials.ts 扩工厂（工厂不依赖 edit，铁律保持）。
- [x] M.1 types.ts：MaterialSpec 类型 + VisualOverride 扩 materialType/libraryRef（与 inline 调参字段互斥）+ RESERVED_KEYS 补 `__materialLib`
- [x] M.2 materials.ts：createMaterialFromSpec 工厂（三类型实例化 + 贴图槽 colorSpace 三分桶表 + Vector2/枚举/数组反序列化 + attenuationDistance null↔Infinity 还原）+ 类型切换参数迁移规则（共有参数保留、目标类型特有参数取默认；Standard→Physical 时 roughness/metalness 保留）
- [x] M.3 edit/MaterialLibService.ts：库 CRUD + 单例实例注册表（mat_id → 材质实例）+ 引用追踪 + 热更广播（改 spec → 热改/重建共享实例 → 引用物体即时变化）+ 种子材质 4 个（glass/carpaint/brushed_metal/velvet）+ undo 集成（serialize 快照机制现成）
- [x] M.4 PropertyPanel 材质分区改造：材质库下拉 +「另存为新材质」「断开链接」+ 类型下拉（three.js 原生类名）+ 全量参数分组折叠（基础默认展开，Physical 进阶组默认折叠）+ 贴图槽按类型显隐 + transmission>0 时 opacity 提示 + aoMap/lightMap 第二 UV 提示
- [x] M.5 template/vite.config.ts dev middleware：`POST /__gts3d/upload-texture`（binary body + 扩展名白名单 png/jpg/jpeg/webp/avif + 文件名 sanitize 防路径穿越 + 重名自动后缀）→ 写 `public/assets/textures/` → 返回相对 URL；dev-only 不进 build 产物；面板文件选择接线
- [x] M.6 冒烟扩展（smoke-r.mjs 增段或 smoke-m.mjs）：类型切换 instanceof 断言 / colorSpace 断言（map=SRGBColorSpace、normalMap=NoColorSpace）/ 共享实例 === 断言 / 改库热更两物体同变 / serialize 带回 __materialLib+libraryRef / undo 覆盖库编辑 / 上传端点→map 生效 / attenuationDistance null 往返
- [x] M.7 三绿（vue-tsc / build / eslint）+ 冒烟 PASS + INTEGRATION_GUIDE __visuals 转录章节补材质库段（libraryMaterials 转录格式样例）

**批次 3：构建门禁 + 双模式交付**
- [x] 3.1 build.mjs：结构扫描 + 三条铁律（core↛edit / edit 只走 handle / strip 后零 edit 引用）+ import 白名单 + **场景预算静态估算（R1-3：calls≤400/triangles≤1M/材质≤32，读 validate-model 报告）**
- [x] 3.2 strip-edit.mjs：剔除 edit/ → 二开包 + **剥离编辑器私有区（__visuals + __materialLib，含 libraryRef）+ 输出转录清单（物体视觉 override 表 + 材质库表 + 引用表，格式见 §4.10.6）** + 自检
- [x] 3.3 init.mjs：母版复制 → 目标目录 + 占位替换 + **资产库→目标工程 public/assets 复制/映射（R2-5）** + 首次 build 校验

**批次 3 执行记录（Reverse Sync，2026-10-10）**：3.1–3.3 全部落地。① **预算估算实现路径**：build.mjs 读 scene-data.json 分组 + 逐个 GLB 解析（复用 validate-model 的 `loadModel`/`reachableNodes`/`primitiveTriangles`），未读 manifests 报告——因报告是单模型成本，场景预算需按实例数乘算，且报告可能陈旧。R1-3 原文"读 scene-data.json 静态估算或 perf-fps 断言"已覆盖此路径，checklist 括注"读 validate-model 报告"为简化措辞，以 R1-3 裁决为准（Diff #24）。② **公开入口白名单放宽**（§4.8 R1-4 的连带修正）：铁律 2 的"edit 只能走 `@/scene-core` 单入口"按代码现状放宽为白名单 `@/scene-core` + `/types` + `/createScene` + `/handlers`——真正的铁律是**禁止深层 import 引擎内部文件**（`@/scene-core/engine/**`），类型/createScene/handlers 属公开 API 面（Diff #24）。③ **复跑设施**：新增 `scripts/verify/gates.mjs`（32 用例：正面 + 铁律/白名单/资产/预算/私有区负面 + 小写盘符端到端），`--with-build` 追加 `init --deps copy` 端到端构建。④ 验证中发现并修复 2 处实缺陷（Diff #24：Windows 小写盘符 spawn 致 Vite html-proxy 失败；build.mjs 三角面计数器与 validate-model 分叉漏 mode 5/6）。

**批次 MU：材质库 UI 重做（2026-10-10 立项；依据 §4.12，批次 4 之前执行）**
> 纯呈现层重设计：数据契约/MaterialLibService API/共享热更/转录链零改动。Spline 心智模型：材质即资产、默认零术语、换=槽重指向、调参=全使用者同步。
- [x] MU.1 `MaterialParams.vue` 抽取：参数组 + 贴图槽区从 PropertyPanel 拆出为独立组件（数据驱动渲染保留，面板与弹窗共用）
- [x] MU.2 `MaterialSection.vue` 新建：材质条目（缩略图+名称+「N 个物体」徽标+复制材质 hover 按钮）+ 点名称原地改名（回车=入库/重命名）+ 类型下拉（原生类名+中文说明）+ MaterialParams 引用；PropertyPanel 材质分区替换为本组件
- [x] MU.3 `MaterialPalette.vue` 材质素材弹层：搜索 + 双分组（我的材质库/内置材质）+ 行内删除（有引用提示转独立副本）+ ⚙ 编辑 + 点击应用 + ＋新建
- [x] MU.4 `EditMaterialModal.vue` 编辑材质球弹窗：名称输入 + CSS 近似预览球 + 「选择物体」高亮引用者 + MaterialParams
- [x] MU.5 `MaterialLibService.seeds()` 门控：仅 `__materialLib` 键不存在时注入（可删且不复活）
- [x] MU.6 editor.css：条目/徽标/弹层样式（对齐现有 Spline 玻璃风）
- [x] MU.7 冒烟扩展（smoke-r.mjs 增 MU 段）：改名入库转引用 / 复制材质脱离引用 / 弹层应用 link / 删除有引用条目后 inline 保留 / seeds 删除不复活；S9–S14 回归
- [x] MU.8 三绿 + 冒烟 PASS + 用户验收（§4.12.3 六场景手动走查）——机器部分完成（三绿 + SMOKE PASS + 四组一次性 DOM 探针覆盖六场景）；**人工走查已进行（2026-10-10）**，验收反馈：面板应右侧浮出 / 不重叠可并排 / 一材质一行 → 面板布局部分转 **批次 MU2**（§4.14）

**批次 MU 执行记录（Reverse Sync，2026-10-10，进行中）**：MU.1 完成——`edit/MaterialParams.vue` 新建（参数分组折叠 + 贴图槽区从 PropertyPanel 抽离为独立组件；数据驱动渲染保留，只读 `spec` prop 显示、`change(key, value)` 回抛，父级负责持久化）；PropertyPanel 材质参数区改为引用该组件。**行为保持型重构**：四道门禁全绿 + headless 冒烟 **SMOKE PASS 29/29**（S1–S29 全绿，S7–S17 材质断言无回归）。MU.2 完成——`edit/MaterialSection.vue` 新建（Spline 心智模型：材质条目 = CSS 近似缩略图 + 名称 + 「N 个物体」常显徽标 + hover 复制材质；点名称原地改名（回车：已引用→renameEntry / 无标题→saveAs 入库）；类型下拉（原生类名 + 中文说明）；⊞ 材质素材按钮（emit `open-palette`，MU.3 接线）；引用 MaterialParams 参数区）；PropertyPanel 材质分区整体替换为本组件（删去材质库下拉/另存为/断开链接按钮与内联 spec 逻辑约 200 行，改名与复制材质改走条目）。四道门禁全绿（vue-tsc / build（edit-main 独立 chunk 102.89 kB，隔离保持）/ eslint 0 errors）+ **一次性 CDP DOM 探针**（不入库，验完删）：inline 态渲染「无标题材质 · 1 个物体」+ 类型中文选项 + 参数区 + ⊞；link glass 后变「玻璃 · 1 个物体」+ 复制材质按钮出现。**诚实分级**：标准冒烟断言走引擎通道，未覆盖面板 DOM——MU.1/MU.2 的面板证据为三绿 + 上述一次性 DOM 探针；永久冒烟段留 MU.7。MU.3 完成——`edit/MaterialPalette.vue` 新建（材质素材弹层：搜索框 + 双分组「我的材质库」（行内 ✕ 删除 / ⚙ 编辑按钮）与「内置材质」（点应用 chips）+ ＋新建；点击条目 `link` 到选中物体并关闭弹层；删除引用中条目走**行内二次确认**（提示「N 个物体将保留外观转为独立副本」——`no-alert` 规则禁用 `window.confirm`）；内置/用户分组按 id 前缀启发判（`^mat_\d+$` = 用户新建）；`⚙`/`＋新建` 的 `edit` 事件待 MU.4 接线）；PropertyPanel 接线 ⊞ → `openPalette` + 渲染弹层。MU.4–MU.8 完成——MU.4 `edit/EditMaterialModal.vue`（编辑材质球弹窗：名称输入 → renameEntry + CSS 近似预览球 + 「选择物体 (N)」高亮引用者并关闭 + 类型下拉 + MaterialParams；PropertyPanel 接线 palette 的 `edit` 事件）；MU.5 `MaterialLibService.seeds()` 门控改「库非空即跳过」（serialize 空库不带 key → 「键不存在」等价「库为空」：首建注入、删后不复活）；MU.6 editor.css 增共享 `.ed-overlay`/`.ed-dialog`/`.ed-dialog__*` 玻璃弹层原语，两弹层组件改用（去重）；MU.7 smoke-r 增 **S30–S33** + S9–S14 回归；MU.8 三绿 + **SMOKE PASS 33/33**。**执行中发现并修复 1 处实缺陷（批次 M 遗留）**：`MaterialLibService.removeEntry` 用 `handle.update({__visuals})`（合并语义）写内联 → 旧 `libraryRef` 残留（违反 §4.10.4「引用者自动断开为 inline」声明），被 MU.7 的 S32 抓到 → 改用 `replaceVisual`（覆盖式）逐引用者写。详见 §7 #28。批次 MU 机器部分闭环，人工六场景走查待用户（**2026-10-10 已走查并反馈：面板应右侧浮出 / 不重叠可并排 / 一材质一行 → 转批次 MU2，见下**）。

**批次 MU2：材质面板布局重做（2026-10-10 立项，MU.8 用户验收反馈驱动；依据 §4.14，批次 MU 之后、批次 M2 之前执行）**
> 右侧浮出浮动面板（无遮罩、可拖拽）/ 材质素材与编辑材质球并排不重叠 / 一材质一行。数据契约 / MaterialLibService API 零改动。
- [x] MU2.1 `edit/FloatingPanel.vue` 浮动面板外壳（拖拽把手 + 标题 + 关闭 + 内容插槽；Teleport 到 `.edit-scope` 顶层）
- [x] MU2.2 `edit/FloatingDock.ts` 停靠位置计算（按开放序号默认并排错开、互不重叠，可拖拽移位）
- [x] MU2.3 `MaterialPalette.vue` 换 FloatingPanel 外壳；内置材质 chips → 一材质一行
- [x] MU2.4 `EditMaterialModal.vue` 换 FloatingPanel 外壳
- [x] MU2.5 `PropertyPanel.vue` 两面板并存状态与渲染（无遮罩，不挡场景）
- [x] MU2.6 `editor.css` 删 `.ed-overlay`/`.ed-dialog` 居中遮罩原语（浮动面板样式由 FloatingPanel scoped 承载）
- [x] MU2.7 冒烟扩展：两面板并存不重叠 / 无遮罩元素 / 材质行一行一项（S34–S35）；S9–S33 回归
- [x] MU2.8 三绿 + 冒烟 PASS + 用户验收（右侧浮出 / 并排 / 可拖拽 / 不挡场景 / 一行一项）——机器部分完成（S34/S35 + Teleport/拖拽探针）；**人工走查已进行（2026-10-10），三项反馈 → 立项批次 MU3（§4.15）**：① 整体浅色主题（参考 Spline）；② 浮动面板叠在右栏上（MU2 只避让浮动面板间，漏了与固定面板的避让）；③ 材质编辑收进「点击条目 → 编辑材质球面板」，属性面板不平铺参数区

**批次 MU3：编辑器浅色主题 + 浮动面板避让 + 材质分区收拢（2026-10-10 立项，MU2 用户验收反馈驱动；依据 §4.15，批次 M2 之前执行）**
> 三项反馈：整体浅色（参考 Spline）/ 浮动面板不得叠固定面板（左树 + 右属性栏）/ 材质分区只留条目行，点条目开编辑材质球。数据契约 / MaterialLibService API / 转录链零改动。
- [x] MU3.1 浅色设计令牌：editor.css `--ed-*` 全套改浅色（Spline 风：白底面板 / 浅灰输入 / 深灰文字；accent 保持蓝系）；同步 FloatingPanel / 卡片 / 工具条 / 树 / 面板视觉核对
- [x] MU3.2 二开态同步浅色：index.html 背景 + App.vue hint + ExampleCard 卡片 + starter scene-data 背景（用户原话「页面 template 整体风格」——编辑态与二开态一致）
- [x] MU3.3 FloatingDock 避让固定面板：默认位计算减去右栏宽度（RIGHT_RESERVE 318 / LEFT_RESERVE 274），材质素材/编辑材质球落在右栏左侧并排；窗口过窄纵向错位退让
- [x] MU3.4 MaterialSection 收拢：删平铺的类型下拉 + MaterialParams；只留条目行（缩略图 + 名称 + 徽标 + hover 复制/⊞）；点条目 → `edit-entry` 打开编辑材质球面板
- [x] MU3.5 EditMaterialModal 双模式：`matId` 有值编辑库条目（热更引用者）；`matId` 空 + `anchorId` 编辑选中物体 inline 材质（走 replaceVisual 清互斥；名称输入与「选择物体」仅库模式显示，标题变「编辑材质」）
- [x] MU3.6 冒烟扩展 S36–S38（浅色亮度断言 / 浮动×固定面板零交集 / 分区无平铺参数 + 点条目出编辑面板 + inline 调参落视觉层）；S30–S35 回归
- [x] MU3.7 三绿 + 冒烟 PASS + 用户验收（浅色观感 / 不叠面板 / 点条目编辑）——机器部分完成（SMOKE 38/38）；人工视觉走查待用户

**批次 MU3 执行记录（Reverse Sync，2026-10-10，用户「全部」批内连跑）**：MU3.1–MU3.7 全落地。① **浅色令牌**（editor.css 九个 `--ed-*` 换浅值）+ 硬编码深色清理（OutlineTree hover/计数徽标、Toolbar 下拉/hover 的 `rgba(255,255,255,*)` → `rgba(0,0,0,低α)`；FloatingPanel 内阴影 `0.4`→`0.15`）；② **二开态同步**：index.html `#0f151b`→`#eef0f3`、App.vue hint 白底灰字、ExampleCard 全套浅色（白底卡/深字/状态徽标换深色调）、starter scene-data `background` 与 PropertyPanel sceneDraft 默认值同改；③ **避让**：FloatingDock 增 `RIGHT_RESERVE=318`/`LEFT_RESERVE=274`，第 0 号面板自右栏左缘向左排、放不下时纵向错位退让；④ **收拢**：MaterialSection 删类型下拉与 MaterialParams（只留条目行，整行可点 → `edit-entry`；改名/复制带 `.stop`）；⑤ **EditMaterialModal 双模式**（`matId` 有值=库条目热更；空+`anchorId`=inline 编辑，`apply()` 走 `replaceVisual` 清互斥——与 MaterialSection.apply 同路径；标题「编辑材质」、名称输入与「选择物体」仅库模式）；PropertyPanel `editOpen`/`editMatId` 状态对（`openInlineEdit` 置空 matId）。⑥ **冒烟 S36–S38**。**S38 执行中踩两坑（均已修在断言侧，非产品缺陷）**：car_01 是 Group（examples handler 的 GLB 容器）——直接读 `.material` 是 undefined，须 `traverse` 找首个 mesh（对齐 S15/S17 既有口径）；boot 后 GLB 异步加载窗口须轮询等 mesh 就绪（对齐 S4）；另 S34/S37 的 createNew→link 让 car_01 处于 `libraryRef` 引用态，裸 `h.update({__visuals})`（合并语义）残留引用 → D4 跳过内联材质——**UI 真实路径走 `replaceVisual` 无此问题**，S38 改用 replaceVisual 模拟真实路径后 `matColor:'3366aa'` 通过（合并语义残留是第三次撞见，记方法论）。⑦ 三绿 + **SMOKE PASS 38/38**。


**批次 MU2 执行记录（Reverse Sync，2026-10-10，用户「全部」批内连跑）**：MU2.1–MU2.8 全落地。① **面板外壳** `edit/FloatingPanel.vue`——`position:fixed` + 标题栏拖拽把手（pointerdown/move/up）+ ✕ 关闭 + 内容插槽；**经 `<Teleport to=".edit-scope">` 挂顶层**（关键：右栏 `.ed-panel` 的 `backdrop-filter` 会立 fixed 的 containing block 并叠加 `overflow:hidden` 裁剪，面板若渲染在右栏内会定位/裁剪全错；Teleport 到无 filter 的 `.edit-scope` 既逃出裁剪又继承 `--ed-*` 令牌）。② **停靠** `edit/FloatingDock.ts`——`defaultDockPos(index, panelW)` 自视口右侧向左并排错开；PropertyPanel 传 palette index 0 / modal index 1（两面板同 top 不同 left，与 Spline 实测一致）。③ **材质素材**换壳 + 内置材质 chips → **一材质一行**（与我的材质库同构 `.mpal__row`）。④ **编辑材质球**换壳。⑤ **PropertyPanel** `paletteOpen`/`editMatId` 独立（两面板可同开、互不关闭）。⑥ **editor.css** 删 MU.6 引入的 `.ed-overlay`/`.ed-dialog`/`__head`/`__title`/`__close`（浮动面板样式随 FloatingPanel scoped 承载，非 editor.css——单组件所有权，记作偏差）。⑦ **冒烟 S34–S35**。⑧ 三绿 + **SMOKE PASS 35/35** + **Teleport/拖拽探针 PROBE PASS**（`.fpanel` 挂在 `.edit-scope`、不在 `.ed-panel--right` 内、无 `.ed-overlay`、拖拽位移精确 120/60）。


**批次 MU4：材质条目直达素材库 + 编辑面板锚定（2026-10-10 立项，Spline DOM 解码驱动；依据 §4.15.5，批次 M2 之前执行）**
> 条目行加 ⊞ 直达素材库（点行=编辑、点⊞=换，两入口各一）；编辑面板 dock 感知素材面板开闭（开→紧贴其左，关→右栏避让位）。数据契约零改动。
- [x] MU4.1 MaterialSection 条目行加 ⊞（hover 显隐，`.stop` 不触发点行编辑）→ emit `open-palette`；PropertyPanel 接线（复用既有 `open-palette` 事件，PropertyPanel 零新状态）
- [x] MU4.2 EditMaterialModal dock 感知 paletteOpen：palette 开 → 编辑面板默认位 = 素材面板左侧紧贴（GAP 12）；palette 关 → 右栏避让位；仅默认位计算感知（FloatingPanel pos 只在挂载取初值，天然不动已拖拽面板）
- [x] MU4.3 冒烟扩展 S39：条目 ⊞ 开素材面板 / palette 开时编辑面板紧贴不重叠 / palette 关时编辑面板退回避让位；S36–S38 回归
- [x] MU4.4 三绿 + 冒烟 PASS + 用户验收（直达素材库 / 编辑面板贴素材库）——机器部分完成（SMOKE 39/39）；人工视觉走查待用户

**批次 M2：GLB 子节点与多材质（2026-10-10 立项；依据 §4.13，批次 MU 之后、批次 4 之前执行）**
> 方案 A：GLB 保持单场景节点，内部子网格作槽位层暴露（`__visuals[id].slots`）。换材质=槽重指向（旧材质自动去留）；调参=同步所有使用者。
- [x] M2.1 AssetEngine.buildReport 增逐 mesh 清单（key/名称/面数/材质类型）；ModelSpecReport 扩 `meshes` 字段
- [x] M2.2 SceneEngine：`listSubMeshes(nodeId)` + `applyVisualOverride` 支持槽级命中（物体级默认 + slots 按 key 单独应用）；`resolveSubMesh` 拾取定位（key 对齐 buildReport 口径：从 GLB 内部根起算，容器名剥除）
- [x] M2.3 OutlineTree 资产节点展开子网格层：浅色只读展示 + 点选联动（gts3d-select-slot 事件）+ eye 单独隐藏（写 slots[key].visible）；不上 Gizmo/不可删/不可拖出
- [x] M2.4 MaterialSection 列表化：选模型=去重材质列表+「全部换成…」；选子网格=单条；视口/树点选 → 槽位聚焦滚动定位（**单 mesh GLB（≤1 槽）回落单条目分支**——单 mesh 槽位编辑等价物体级）
- [x] M2.5 MaterialLibService 槽级支持：`applySlotLink`/`getSlotVisual` + syncAll 槽位重挂共享实例（findBySlotKey 从 core 导出）
- [x] M2.6 strip-edit 转录：override 表增「①′ 槽位覆盖表」（nodeId/slot/字段/值 + getObjectByName 样例）；INTEGRATION_GUIDE 增 §6.2 槽位转录段
- [x] M2.7 冒烟扩展 S40–S44（person 多材质 GLB：子网格清单+树展开 / 单槽换材质不影其他+serialize 往返 / 单槽隐藏恢复 / 槽位调参 undo / 视口拾取定位槽位）+ 三绿 + gates 40/40
- [x] M2.8 用户验收（person 类多部件模型全流程走查）——机器部分完成；人工走查待用户

**批次 M2 执行记录（Reverse Sync，2026-10-10/11，用户裁决批内连跑）**：M2.1–M2.8 全落地。**关键产出与发现**：
① **Draco 支持（执行中发现的最大缺口）**：验收素材 person.glb 是 Draco 压缩——GLTFLoader 无 DRACOLoader 直接报错 `No DRACOLoader instance provided`。真实世界 GLB 大多 Draco 压缩，skill 不支持等于废一半资产。修：AssetEngine 配 DRACOLoader + **decoder 随模板 vendor**（`public/assets/draco/` 三文件，719KB js + 286KB wasm；本地 wasm 零 CDN——内网纪律）；eslint 加 ignore（三方压缩解码器不进 lint）。
② **槽位 key 双口径对齐（执行中最大坑）**：buildReport 的 key 从 GLB 内部根（Armature）起算不含容器，但 resolveSubMesh 沿父链收集会把工厂 Group 外壳与 gltf.scene 容器名（'Scene'）都带上（`Scene/Armature/Ch23_Shoes`）→ 与 buildReport key（`Armature/Ch23_Shoes`）不匹配 → 槽位命中失效。修三处对齐：resolveSubMesh 剥容器段；findBySlotKey 首段未命中时探一层容器；applyVisual 的 hasMaterialField 补 `slots !== undefined`（slots 增量必须走 full，否则被 switches 短路——数据对了运行时不生效）。
③ **单 mesh 回落**：MaterialSection 的槽位列表对单 mesh GLB（car_01）误伤（原单条目 inline 编辑变槽位模式）——`shownSlots.length <= 1` 回落单条目分支。
④ **验收素材 person 入库**：52k 面/144 节点超 art 档硬限——**人工放行**（gate.deviations 记录：验收素材非投递资产，场景预算由 build.mjs 运行时把关）；库 manifest 形态 entries[]（与上传 data[] 不同）；starter examples 组加 person_01 节点。
⑤ **连带更新**：gates.mjs 两断言期望更新（starter 现引用 example+person，--assets all 为 3 模型）——**断言写死资产清单是脆断言**，改为语义断言（含 example+person）；检索索引重建（中文「人物」命中 person）。
⑥ **复验**：vue-tsc 绿 / build 绿（edit-main 117.79 kB 独立 chunk 隔离保持）/ eslint 0 errors / **SMOKE PASS 44/44**（S40–S44 全 true）/ **gates 40/40 PASS**。

**批次 M2 修复轮（2026-10-11，用户验收反馈三项，F3 裁决「显式」）**：
- **F1 树点子网格无法编辑**：`OutlineTree.onSelectSlot` 只发 `gts3d-select-slot` 事件（MaterialSection 滚动定位用），**不打开编辑面板**——用户点 Ch23_Belt 没有任何可编辑入口。修：树点子网格 = 选中父节点 + 发事件 + **PropertyPanel 监听事件直接开编辑面板（槽位模式）**（与属性面板点槽位行同款行为）。
- **F2 树子网格层级（用户裁决 A）**：子网格嵌在模型节点下（depth 缩进渲染），**展开状态独立**（不与 parentId 折叠互踩——现状 hasSubMeshes 节点的 chevron 分流已对，但 GLB 有内部容器时显示容器组头）；**Armature 容器作组头**（mesh 按一级容器分组缩进，骨架链 mixamorig* 不显示——144 节点全平铺是噪音）。listSubMeshes 返回的 key 已含容器段（`Armature/Ch23_Hair`），树渲染按首段分组。
- **F3 mixamo 厘米资产缩放脱节（裁决：显式，不隐式归一化）**：诊断实证——person 链上所有 node.scale=1 但世界高 179m（`mixamorigHips.pos.y=100.9` 骨骼 cm 单位，SkinnedMesh 顶点经骨架变换放大）。**AssetEngine 不做隐式缩放**（篡改资产语义，1:1 机械模型误伤风险）；修法：① starter person_01 设 `scale: 0.0056`（编辑器所见即所得——179.275m × 0.0056 ≈ 1.004m 一人高）；② validate-model 高度警告文案已覆盖（`高=179.275m`）；③ GUIDE FAQ 记「mixamo/cm 资产需在节点 scale 归一化」。
- [x] F1 树点子网格 → 开编辑面板（槽位模式）
- [x] F2 树子网格容器组头 + 展开独立
- [x] F3 starter person scale 0.0056 + GUIDE FAQ
- [x] F4 三绿 + SMOKE（S40–S44 回归 + 树点选断言扩展）

**批次 M2 修复轮执行记录（Reverse Sync，2026-10-11）**：F1–F4 全落地，**执行中揪出两个隐藏缺陷**：
- **F1 实现中的真缺陷 ①（meshCache 缓存空清单）**：OutlineTree 的 `subMeshesOf` 在 GLB 异步加载完成前把 `listSubMeshes` 的**空结果缓存**——加载完成不发 bridge state → refresh 不清缓存 → 展开钮永不出现。修：**空结果不缓存**（下次查询自然重试，查表 O(1)）。
- **F1 实现中的真缺陷 ②（seedMaterialType 收到 Material 抛错）**：EditMaterialModal 槽位模式无 override 时取「槽位 mesh 的活材质类型」——初版把 **Material** 传给 `seedMaterialType`（其内部调 `obj.traverse`——Material 没有 traverse）→ setup 抛错 → Vue 吞错不渲染 → 面板静默不出现。**诊断 8 轮探针**（window dispatch 对照/事件 spy/MutationObserver/CDP console——假线索：孤儿 DOM/展开态破坏 listener/anchorId 竞态全被排除；决定性证据：MaterialSection 槽位聚焦成功但 .fpanel 0 个 → 渲染层崩溃）→ 修：直读 `mat.type` 白名单（Lambert/Standard/Physical，其余回退 Standard），不走 seedMaterialType。
- **F1**：PropertyPanel 监听 `gts3d-select-slot` → `openSlotEdit(slotKey)`（树点子网格=属性面板点槽位行同款行为）。
- **F2**：树子网格按容器分组（`Armature` 组头行——slotKey 首段、加粗浅色、不可点编辑不可 eye）；mesh 行再缩进一级；骨架链不显示（listSubMeshes 只含 mesh 天然不含骨架）。
- **F3**：starter person_01 `scale: 0.0056`（179.275m → ≈1m）；GUIDE FAQ「人物模型巨大」条目（mixamo cm 单位 → 0.01 级 scale 归一化；引擎不隐式缩放的理由记录）。
- **F4**：S40 扩展三断言（hasGroupHead / slotEditOpened / f3Scale）；S44 全屏扫描在 scale 0.0056 后 miss（物体视口太小）且细扫 2000 次 pick 超时 → **改引擎直测**（遍历内部 mesh 逐个 `resolveSubMesh` 与 listSubMeshes 的 key 全量比对——契约级断言比单点扫描更强）。**复验**：vue-tsc 绿 / build 绿（edit-main 118.54 kB 隔离保持）/ eslint 0 errors / **SMOKE PASS 44/44** / **gates 40/40**。

**批次 M2 修复轮二（2026-10-11，用户验收再反馈两项）**：
- **F5 树 person_01 出现 9 次（v-else-if 缺失，渲染级真 bug）**：模板三 li 链 `group(v-if) → node(v-else) → mesh(v-if)`——**node 的 v-else 只与 group 的 v-if 配对，mesh 行同时满足自己的 v-if** → kind='mesh' 的 row 渲染**两个 li**（node 模板 + mesh 模板各一）→ 每个 mesh 行前多一个 person_01 node 行。修：node 行 `v-else` → `v-else-if="row.kind === 'node'"` 三类互斥。S40 增 `personNodeRows === 1` 断言。**教训：v-for 内多类型行渲染，分支条件必须显式互斥（else-if 链），不能混用独立 v-if + v-else。**
- **F1 二次裁决（用户：「我并不是想点子节点弹出编辑材质面板，而是要显示物体面板，这时候显示的是相对于 person 的相对位置」）**：点子网格 = **选中父物体**（属性面板显示物体变换/开关/材质槽位列表——变换即模型节点数据）+ MaterialSection 槽位聚焦滚动；**不自动弹编辑面板**（编辑经槽位条目点行进入，保持「点行=编辑」单一入口）。撤 F1 初版的 PropertyPanel 事件监听开面板实现（整个 listener 删除——聚焦由 MaterialSection 自身 onSlotEvent 承担）。S40 断言同步改（noSlotPopup && personSelected）。
- **复验**：三绿 + **SMOKE PASS 44/44**（S40 含 personNodeRows=1）+ **gates 40/40**。

**批次 M2 修复轮三（F6 子网格选中态，2026-10-11 立项即执行，§4.13.6）**：
- [x] F6.1 Bridge：`selectedSlot` 状态 + `selectSlot/clearSelectedSlot`（select 任何物体时清槽位态；EditorState emit）
- [x] F6.2 SceneEngine：`getSubMeshInfo(nodeId, slotKey)`（局部 transform + mesh 世界包围盒 + 材质类型/主色）
- [x] F6.3 OutlineTree：点 mesh 行 → `bridge.selectSlot`（替代 window 事件派发——保留事件仅作 MaterialSection 聚焦滚动）
- [x] F6.4 PropertyPanel：selectedSlot 时变换区显示子网格局部变换（只读灰置 + 标题注「模型内部 · 相对 <节点>」）、包围盒换 mesh 自己的
- [x] F6.5 SelectionService：selectedSlot 时高亮包围盒只包该 mesh
- [x] F6.6 冒烟 S45：点 Ch23_Hair → 变换区数值变化（局部 position 非 0 或与 person 的不同）+ 包围盒变化 + selectedSlot 落库；S40 回归
- [x] F6.7 三绿 + SMOKE + gates

**批次 M2 修复轮三执行记录（Reverse Sync，2026-10-11）**：F6.1–F6.7 全落地。① Bridge `selectedSlot`（EditorState 新字段 emit；`selectSlot/clearSelectedSlot`；select 任何物体自动清槽位态——slotHint 与物体变换互斥）；② SceneEngine `getSubMeshInfo`（findBySlotKey 定位 → 局部 position/rotation/scale + mesh 世界 bbox + 材质类型/主色）；③ 树点 mesh 行 → `bridge.selectSlot`（window 事件保留给 MaterialSection 聚焦）；④ PropertyPanel 变换区双形态：slotInfo 时只读 9 输入框（`.pp__ro` 灰置）+ 标题「<mesh> · 模型内部（相对 <node>，只读）」+ 材质类型/主色行 + mesh 自身包围盒；v-else 物体级可编辑变换（bbox 行双分支各一份）；⑤ SelectionService 槽位高亮（`selectedSlot` 时 BoxHelper 只包该 mesh，helper key `slot:<key>`）。⑥ S45 六断言（slotSet/roCount≥9/slotHint/posMatch 对照引擎值/bboxShown/slotCleared）。**S45 两处断言侧修正**：展开守卫（S40 已展开时再点 chev 会收起——先查 mesh 行存在再点）；bbox 行初版误包在 v-else 分支内（slotInfo 分支看不到）。**复验**：vue-tsc 绿 / build 绿（edit-main 121.03 kB 隔离保持）/ eslint 0 errors / **SMOKE PASS 45/45** / **gates 40/40**。

**批次 M2 修复轮四（2026-10-11，用户实测三反馈：树 mesh 行无选中态 / 改 Hair 变红却是脸红 / 聚焦态材质区显示错）**：
- **Bug①（树 mesh 行选中态）**：高亮判定原为 `selected.includes(row.id)`（mesh 行 id=person_01 → 永不高亮）。修：mesh 行 `isSlotActive(slotKey)`（`bridge.selectedSlot.slotKey` 匹配）。
- **Bug②（改红变脸红，语义错误级）**：**根因链**——点树 Hair → focusSlot=Hair → `shownSlots` 过滤剩 1 条 → 落入「`shownSlots.length <= 1` 单条目」分支 → 点行 `openEditor`（**物体级**）→ modal 无 slotKey → 改红写物体级 inline → **全身变红**（Body 面积最大，用户看到"脸红了"）。修：新增**聚焦单槽分支**（`focusedSlot` computed；`v-if="focusedSlot"` 先于单条目分支）：显示该槽一条（data-slot + `openSlotEditor(key)` 槽位编辑 + 槽位 ⊞ + 「返回全部槽位」）；真单 mesh（无 focusSlot）才走物体级单条目。
- **Bug③（聚焦态材质区显示）**：同②——聚焦后走单条目模板显示物体级「无标题材质 · N 个物体」（语义完全错位）。修后聚焦态显示「Ch23_Hair · 材质名」单槽条目。
- **端到端探针验证**（复现用户操作全链：树点 Hair → 点材质条目 → modal 改 #ff0000 → 逐 mesh 读色）：**只有 Ch23_Hair=ff0000，其余 7 mesh 全保持 cccccc**；modal 标题「编辑材质 · Ch23_Hair」。三绿 + **SMOKE PASS 45/45** + **gates 40/40**。
- **教训**：分支条件「shownSlots.length <= 1」混淆了两个语义（真单 mesh vs 聚焦过滤后剩 1）——**过滤导致的 1 与天然的 1 必须分流**，否则聚焦态误入物体级通道。

**批次 M2 修复轮五（2026-10-11，用户实测「选中 Hair 包围盒仍框整个人 + 改红无效」——排查结论：**均为环境陈旧，代码已正确**）**：5183 端口存在**起于多轮修复前的旧 dev server**（后续代码修复都在 52xx 临时端口验证，用户浏览器连的 5183 一直跑旧代码）。证据：① 探针读视口 BoxHelper 盒 `size=[0.11,0.13,0.12]` = Hair 自己的盒（Body 是 [1.0,0.96,0.13]）——槽位高亮已正确只框 Hair；② 探针改红后 `hairColorAfter=ff0000` 且其余 mesh 保持——槽位改材质链正确。处置：kill 旧 5183 → 最新代码重启 → `SMOKE PASS 45/45`（S45 含选中态断言）复验。**教训（流程性）**：多轮迭代验证若都在临时端口跑，用户默认端口的 dev server 会成为"时间胶囊"——**每轮修复后应同步重启默认端口（5183）的 dev server**，或提示用户手动重启。

**批次 4：验证回路（2026-10-13 完成，执行记录见下）**
- [x] 4.1 smoke-structural.mjs（场景图 JSON/渲染活性/零 rejection 断言）
- [x] 4.2 smoke-visual.mjs（四视口截图产出）
- [x] 4.3 perf-fps.mjs（**R1-3 修订（§8.2）口径已落地：重（预算）/卡（fps）WARN 观测 + `--strict` 升阻断 + duration 默认 20s；软渲染不计 fps（R3-3 维持）**）
- [x] 4.4 ensure-env.mjs（node/three 探测 + 多模态档位声明解析——CLI 优先于环境变量 GTS3D_MULTIMODAL，都无→默认非多模态档）

**批次 4 执行记录（Reverse Sync，2026-10-13）**：

- **4.4 ensure-env.mjs**：node≥22 / three@0.185.1（声明+实装双查，母版未装只告警）/ 多模态档位三态解析。默认/CLI/环境变量三态 + CLI 覆盖优先级 + `--json` 输出实测全过。
- **4.1 smoke-structural.mjs**：场景图分组对齐（SCENE_KEYS 剔除 lights/camera/controls/renderer 舞台配置——SceneEngine 只收物体节点）+ GLB 徽标收敛轮询 + 渲染活性（fps>0，swiftshader 像素法不可靠同 S1 口径）+ 零 rejection（Runtime.exceptionThrown + Log.error 全监听；favicon 404 类 headless 噪声豁免——用户浏览器实测无 404 定案）。双模式（run/edit）STRUCT PASS。
- **4.2 smoke-visual.mjs**：四视口截图（全景 / frameObject 主视角 / 相机推近特写 / 全材质 wireframe 后还原）经 `Page.captureScreenshot` 落盘——CDP 合成层是 headless 下拿 WebGL 内容的唯一可靠路径；四张 31–107KB 产出，多模态看图自证有效（场景可见/无漂浮/比例正常）。看图判定归多模态 LLM，断言清单落 verification.md（批次 5）。
- **4.3 perf-fps.mjs**：首版按旧 R1-3 口径落地后，§8.2 裁决捎话改造完成——重（calls/triangles/programs 超预算）WARN 不阻塞、卡（fps p95）WARN 观测、`--strict` 恢复阻断（strict 退出码实测 1）；连动 **build.mjs 预算 errors→warnings + `--strict`**（两态实测：默认 exit 0 WARN / strict exit 1 FAIL）+ **gates 预算用例一拆二**（WARN 放行 + strict 阻断，40→41 用例）。
- **smoke-r 分段参数（验证策略修订落地）**：`--only S49`（自动级联前置闭包：DEPS 表 S10/S11/S12←S9——sharedId/smoke_m1 状态依赖）+ `--from S45`（目标段+前置随行）；52 段批量三元守卫（Python 脚本改 51 头+52 尾），skipped 段 pass 链视为 true（s17 字符串比较形态补包）。`--only S49` / `--from S52` 双模式实测 PASS。
- **S52④ 修复（挂账 P2 存量收口）**：`import('/src/scene-core/materials.ts')` vite dev 专属路径 → 直读活材质实例（`mesh.material` 的 type/color；readMaterialSpec 语义即活实例真值读取器，断言只消费 type/color 等价）。S52 五断言实测全 true。
- **强制全量冒烟复跑（挂账 P2 收口）**：双 dev server（5183/5199 陈旧进程）清理重启 → 全量跑到 S52 处 RPC 40s 超时（**修复轮七同款长链路 CDP 累积态，环境噪声非产品缺陷**——分段参数的价值场景当日实证）→ S1–S51 全量跑过全 true + S52 分段隔离复跑全 true。
- **验证证据（2026-10-13）**：STRUCT PASS×2（run/edit）+ VISUAL PASS 四截图 + PERF OK（calls=226/400、triangles=207K/1M、programs=16/32 全在预算内）+ smoke-r S1–S51 全量 + S52 分段全 true + **gates 41/41** + 三绿（vue-tsc 0 / eslint 0 / build PASS）。

**批次 PH：Poly Haven 精选资产批量入库（2026-10-12 立项，2026-10-13 Open Questions 四项已裁决，进入 Plan）**
> 目标：批量下载脚本从 Poly Haven API 拉精选模型（面数≤50000 / 贴图 2k 档 / glTF 格式，约 108 个 / 参考量 200MB），打包 seed-package.zip manifest 格式，走 import-assets.mjs 入库；入库后 gates.mjs 复验 + 检索索引重建（import-assets 自带）+ 中文 tags 自补（API 只有英文）。数据源：`.tmp-polyhaven/models.json`（521 模型全量缓存，含 polycount/categories/download_count）。
- Research 探针实证（4 模型实下载过门禁 + 管线源码核对，详见 §5 #30）：
  - **链路可行**：files API `gltf["2k"].gltf` 给主文件 + include{}（bin+textures/*.jpg 各带 size/md5），dl.polyhaven.org 直接 fetch 无鉴权；2k jpg 贴图均过 2048 门禁
  - **不能盲选**：`wine_bottles_01` 贴图 13 张 > 8 上限 → 门禁 FAIL；必须下载前预检（读 gltf json images 数）过滤
  - **init.mjs 只认单文件** `models/<id>.glb`/`<id>.gltf`——Poly Haven glTF 全是「.gltf+.bin+textures/」多文件目录形态，入库后 `--assets` 注入对 gltf 资产失效（import-assets 本身支持目录形态，落库后检索可用）
  - **gates.mjs 用例 37 写死 `models.length === 3`**——入库后必 FAIL，需改语义断言（含 example+person+rack 即可）
  - **id 不合规**：Poly Haven id 如 `ArmChair_01` 首字母大写违反 `^[a-z][a-z0-9_]*$`，manifest 必须显式小写
  - **体量实测**：抽样 8 资产 2k 档平均 2.78MB → 108 个约 300MB（略超参考量）
- Open Questions 裁决（2026-10-13 用户）：① **A——下载时合并转 GLB**（零依赖手写：gltf json + bin + 外部贴图合并单 .glb 二进制容器，贴图 data: URI 内嵌）；② **推荐策略**——download_count 降序 + 类别多样性配额（约 12 大类：furniture/seating/props/industrial/lighting/plants/nature/decorative/electronics/containers/tools/food，每类配额内取下载量 top）+ 贴图数预检（读 gltf json images 数 >8 剔除）；③ **推荐**——脚本内置英文→中文映射字典自动生成 tags，产出后用户评审；④ **中文类别映射表**——Poly Haven 类别→中文（furniture→家具/seating→座椅/lighting→灯具/plants→植物...）写入 category，英文原词拼进 search_text（与建议集不冲突：category 越集本就 warning 不阻断；检索语料与中文检索同语言直接受益；零改 import-assets）
- [x] PH.1 `scripts/fetch-polyhaven.mjs`（§4.16.6 签名：精选配额 + 下载 md5 校验 + gltf→GLB 合并 + manifest 中文三件套 + writeZip 打包；支持 --resume）
- [x] PH.2 跑 fetch-polyhaven.mjs 产出 manifest → 用户评审中文 tags/category（裁决 ③ 后半）——评审产出**方案修正**：2k 档 108 资产 565MB 超量，用户裁决 **B+C 合并**（1k 贴图档 + 定制名单 57 资产：砍容器/工具/食品整类 + 场景适配挑半 + 捞回 13 个基建向落选者），脚本随之扩 `--res 1k|2k` 与 `--ids <名单文件>` 两参数（`--ids` 模式名单即终选，预检剔除不递补）
- [x] PH.3 import-assets.mjs 入库（art 档门禁 + 索引重建 + 检索冒烟）——56 资产（57 名单 − modular_pipes 节点 106>64 预检剔除）/ 122.4MB / 1k 档；md5 失败 1 个（Barrel_01 首跑 fetch failed，--resume 续跑自愈）；四轮重入库（字典三轮补词迭代，见 PH.5）
- [x] PH.4 gates.mjs 用例 37 断言语义化（§4.16.5）+ 全量复验（2026-10-13 改毕即复验 40/40 PASS，先于入库完成——用例 37 改语义断言后与库内模型数解耦，入库前后均成立；**入库 59 模型（56 新 + example/person/rack）后复跑仍 40/40 PASS**）
- [x] PH.5 中文检索抽查（2026-10-13 完成，14/14 命中）——抽查暴露两类字典缺口并当轮修复：① 场景词 miss（pipe/barrier/cctv/generator 等词不在字典 → 补 26+ 多词 key 词条，含 'road barrier'/'power generator' 复合词）；② **id 内嵌词盲区**（modular_electric_cables 的 cable 在模型名里但不在源 tags → buildEntry 增补「id 逐词过字典进 tags」）。最终 14 词断言全命中（椅子/桌子/灯具/植物/岩石/管道/路障/监控/发电机/线缆/井盖/垃圾桶/沙发/摄像头 → 各自目标资产 top-3）

**批次 PH 执行记录（Reverse Sync，2026-10-13 完成）**：
- **Spec 修复前置**：§4.16.3 曾发生写入事故（1379 行 id 条目被文件头标题覆盖截断，name/tags/search_text 全丢），执行前按 import-assets schema + 裁决重写补齐；§4.16.1 类别归一修正为「次类别回退」（原「取第一个有效类别」会排除 45 个资产，实测其多数次类别命中 12 大类，用户裁决回退）
- **两处用户裁决（执行中）**：① 类别归一次类别回退；② name 保留英文原名（字典覆盖不了专名，中文靠 tags/search_text）；③ 体量方案 B+C 合并（1k 档 + 57 定制名单，565MB → 122.4MB）
- **fetch-polyhaven.mjs 最终形态**：配额模式（--quota）与名单模式（--ids）双入口共用 runFetch；`--res 1k|2k` 贴图档；`--resume` md5 缓存续跑；TAG_ZH 字典 ~200 词条（含复合词 key）；buildEntry = id 小写化 + 英文 name + 中文 category + 字典 tags（含 id 逐词补捞）+ 英文 search_text
- **探针数据修复**：.tmp-polyhaven/probe/ 的 CoffeeCart_01 与 wine_bottles_01 文件曾被重命名（model.bin/model_2k.gltf）致 gltf 内部 uri 断链，恢复原名后 4 探针合并验证恢复预期（3 PASS + wine_bottles 贴图 13>8 FAIL = 预检口径验证）
- **1k 档验证**：files API 1k 档全量可用，抽验贴图均为 1024px（门禁上限 2048 合规）；56 资产 2k 原始缓存（fetch/）保留于 .tmp-polyhaven，1k 缓存独立目录 .tmp-polyhaven-1k/
- **检索抽查方法论沉淀**：中文 miss 根因分两类——字典词缺口（补词即治）与**语料缺口**（词只存在于模型名，源 tags 没有；id 逐词补捞即治）。检索器 tokenize 为 CJK unigram+bigram，中文 tags 精确匹配权重最高
- **残留**：`--ids` 名单 keep-ids.txt 落 .tmp-polyhaven/（数据非代码，不入 skill 仓库）；2 个 md5 失败资产（cannon_01/vintage_grandfather_clock_01）用户裁决不追查（首版 2k 跑的失败记录，1k 定制名单未含这俩）

**批次 5：skill 大脑 + 收尾（2026-10-13 完成，含修复轮十；评审记录 11 Overall Verdict PASS）**
- ~~5.1 install-blender.mjs（缓存探测/镜像拉取/解压登记/失败降级）~~ → **整项取消（2026-10-12 用户裁决「blender完全从这个skill里剔除出去吧」，§8.1）**——Blender 通道剔除，脚本不写；本机 `~/.gts3d/blender/` 已清理（2026-10-13）
- [x] 5.4 ~~gen-component-catalog.mjs 跑通 → component-catalog.md 产出~~ → **由批次 C 接管**（sync-components.mjs，2026-10-09 终裁），提前完成
- [x] 5.2 SKILL.md（九步工作流 + 4.4 降级阶梯（四层版） + 硬约束：规格门禁/铁律/诚实分级/内网纪律/数据结构 v3 生成纪律）
- [x] 5.3 references/ 文档（scene-workflow/asset-pipeline/model-spec/modeling-channels（**LLM 直写单通道版**：简模图元+精模代码组合模型+mesh 命名约定，Blender 内容仅历史归档不写正文）/verification/scene-engineering/component-catalog 生成/eslint-notes）+ **"生产数据→update 片段"翻译模式章节（MQTT/WebSocket 示例，一等公民）**
- [x] 5.5 README.md（投放说明/资产库准备/镜像配置/**内网 npm 安装方式**）
- [x] 5.6 端到端演练：文字描述 → 全流程 → 编辑态工程 + 二开包 + 验证报告全绿
- [x] 5.7 用户验收（截图/演示/文档过目）→ Review

**批次 C：3d-components 上游改造 + 组件库接入链（2026-10-09 新增，批次 R 之前执行）**
> 依据 §3 Decision 增补。跨仓库：源仓 `D:\cyc\project\octo\test\3d-components`（用户已授权读写），skill 侧落在 generate-3d-scene。
- [x] C.1 源仓 package.json：peerDeps three 收窄 `>=0.183.0 <0.190.0` + @types/three 对齐 `^0.185.0`（license/publishConfig 用户明确不动）
- [x] C.2 源仓 TSDoc 回填：导出面组件类头部（summary + @example）+ options 接口字段（描述 + @default）；以 typedoc 提取结果为完成依据
- [x] C.3 skill `scripts/sync-components.mjs`：npm pack → tgz 入 skill vendor/ → typedoc --json → 生成 Tier-1 component-catalog.md + Tier-2 component-docs/<Name>.md → 版本戳；TSDoc 缺失门禁（非零退出）
- [x] C.4 跑通全链 + 验证：catalog 内容抽查 vs 源码语义一致；tgz 内含 dist js + .d.ts、不含 src/map；产物工程 file: 依赖安装 + import + vue-tsc 通过（最小验证工程）
- [x] C.5 源仓 CONTRIBUTING 作者协议章节（TSDoc 要求 + sync 命令 + 门禁说明）

**批次 C 执行记录（Reverse Sync，2026-10-09）**：
- **C.1 扩展为构建链修复**：peerDeps/@types 版本两行照改（three 运行时 devDep 一并对齐 ^0.185.0，lock 实装 0.185.1）。但发现 `npm run build` 的 **dts 生成链是存量坏的**（干净树复现）：ec8964d（2026-08-07）把健康单文件 tsconfig.json 拆成 Vue 脚手架式 references 时，tsconfig.app.json 丢失 target/lib/moduleResolution/strict 全部核心项 + 混入 TS 5.9.3 不认的 `"ignoreDeprecations": "6.0"`，且 `dist/*.d.ts` 全是空壳 `export {}`。修复：tsconfig.app.json 补回核心项（target ES2022/moduleResolution bundler/lib ES2022+DOM/strict，strictNullChecks+noImplicitAny 关——234 个 null 错误全在 vendored 三方代码）；dts 插件 tsconfigPath 指向 tsconfig.app.json；Edge3D `declare type`、EventDispatcher 泛型监听表修复 2 处自家源码类型错误。剩余 25 个 TS 错误全在 InstancedMesh2 vendored 代码，**typedoc 用 `--skipErrorChecking` 绕过**（不影响文档生成）。修复后 dist/es/index.d.ts 295KB 真实声明。
- **C.2 盘点结论**（typedoc 全量提取 113 顶层导出）：类/接口级文档 100% 已有（26 类、78 Options 接口全有 doc）；20/26 类有 @example；646 options 字段 584 有文档（90%）、286 带 @default。**自家代码回填**：HtmlOptions 22 字段 + PivotControlsOptions 8 字段 + PivotControls/Html 类 @example + PivotControlsLike/ControlsLike.enabled（共 30+ 字段与 2 个 @example）；**vendored 豁免**（CameraControls 系/InstancedMesh2 系/PointerCaptureTarget 等 30 个字段，camera 模块为重写版三方代码不强制补）。TSDoc 门禁首跑即拦下 PivotControls/Html 缺 @example，验证门禁有效。
- **C.3 脚本要点**：`--src` 参数定位源仓（默认相对约定，可 `A3D_SRC` 环境变量）；npm pack `--json` 输出整体 JSON 直接 parse（Windows 无前导噪音）；typedoc @example 内容是 `{kind:'code'}` 结构化片段（text 自带围栏，脚本剥外层统一重包裹）；importPath 从 barrel index.ts 正则反查（`export { X as Y }` 形态兼容）；tier-2 表格含类型/默认值/说明三列。
- **C.4 验证证据**：① tgz 白名单生效——0 个 .map、22 个 .d.ts、无 src（package.json files 加 `!dist/**/*.map`）；② 最小验证工程 `file:./vendor.tgz` 安装成功（6 包）；③ strict tsc 0 errors——core/heat/controls 三入口 import + options 类型约束 + `@ts-expect-error` 验证 PivotControls 必填 camera/renderer 校验真实生效；④ 26 个组件用法页 + catalog 抽查（Html/HeatMap/Rack）与源码语义一致；⑤ 门禁通过（26 组件全有 doc+example，vendored 6 类豁免）。验证工程 .tmp-a3d-verify 残留在 gts/test 下（rm 被安全检查拦，需用户手删，内容无价值）。
- **运行时发现（type-check 的价值实证）**：HeatMap 是纹理生成器（implements IDisposable 非 Object3D），d.ts @example 即正确用法（`map: heatMap.texture`）——验证脚本首版按 Object3D 误用被 tsc 拦下，证明"d.ts 随包走"的类型契约按预期工作。
- 源仓 git 状态：9 文件修改 + CONTRIBUTING.md 新增，未提交（用户自决提交时机）。

**批次 R：数据结构 v3 统一重构（2026-10-08 裁决新增，批次 2 之前执行）**
> 依据 §4.9。批次 1 已按 v2 扁平结构落地，本批次把内外统一为 key:Array v3。改动集中、越晚越贵。
- [x] R.1 types.ts 重写：SceneData → TreeScene v3 形态（保留 key：version/meta/scene/camera/lights/controls/renderer/remove + 开放 type 分组）；节点 {id, parentId, position, rotation, scale, card?, params}；**删除 MaterialOverride 数据类型与 materialOverride 字段**
- [x] R.2 SceneEngine 改造：objects[] 扁平存储 → 分组字典 + id→node 索引（3d-templete buildNodeIndex 模式）；upsert 幂等 / remove 先行 / params 整块替换（3d-templete updateTreeScene 语义）
- [x] R.3 材质归代码：新建 materials.ts 状态视觉注册表（stateMaterials，3d-templete registerMaterials 模式）+ AssetEngine applyState(obj, state)（map 换贴图 / model 换实例）；删除 applyMaterialOverride 数据驱动路径（编辑器视觉层除外，见 R.6）
- [x] R.4 卡片内联：CardConfig 顶层数组 → 节点 card sibling 字段；cards/registry 挂载逻辑随节点生命周期（删节点=卡片消失，级联删除类别消灭）；卡片 props 从本节点 params 自动注入
- [x] R.5 图元底座：primitive 工厂一个文件吃全部几何体（3d-templete Primitive/geometry 模式），默认材质从代码取；starter scene-data.json 重写为 v3（分组：ground/cars 演示/handler 示例用 example.glb，R1-2 决议）
- [x] R.6 编辑器视觉层：PropertyPanel 材质分区保留（调参体验不变），但值存入编辑器私有视觉层（serialize 内部字段，不进交付数据）；strip-edit 剥离 + 转录清单（哪些物体调了什么值 → LLM 转录进 materials.ts/handler 默认值）
- [x] R.7 存量联动改造：SceneHandle.update 签名换 TreeSceneFragment；Bridge/save/undo（structuredClone 快照）适配 v3；windTurbine handler 改造为通用 example handler（R1-2）；main.ts/edit-main.ts 适配
- [x] R.8 验证：vue-tsc 绿 / build 绿（铁律隔离保持）/ eslint 0 errors / headless 冒烟（v3 starter 渲染 + 卡片跟随 + update 片段幂等 upsert 断言 + applyState 换贴图断言）
- [x] R.9 INTEGRATION_GUIDE 重写对齐 v3（数据层只有业务属性 / 材质在 materials.ts / 卡片内联 / 生产数据接 update）

### 4.8 Spec Review Notes

**评审记录 1（2026-10-08，批次 1 完成后、批次 2 开工前，advisory review）**

评审方式：Spec 全文 × template 实际代码交叉验证。结论：**GO with conditions**——批次 2/3 开工前须先完成下列 P1 修正（其中 R1-3/R1-4 需用户裁决），P2 为 Spec 记录修正（可直接做），P3 为低优先级卫生项。

#### Review Matrix

| # | 检查项 | 结论 | 证据 |
|---|---|---|---|
| 1 | 目标/边界/验收清晰 | PASS | §1/§1.7 完整 |
| 2 | 决策状态一致性 | **FAIL** | Q5 三处矛盾（见 R1-1） |
| 3 | Plan 可执行性（文件/签名/checklist） | PARTIAL | 契约块与代码漂移（R1-4/R2-1/R2-2） |
| 4 | Spec-Code 真实性 | PARTIAL | starter 引用不存在资产（R1-2）、目录树偏差（R2-1） |
| 5 | 验证门禁可机器执行 | PARTIAL | 场景级性能门禁数值缺失（R1-3） |
| 6 | 内网投递纪律 | PARTIAL | lock 文件外网 URL + 模板残留物（R3-1） |

#### P1（阻塞批次 2/3，需先修正）

- **R1-1 Q5/Innovate 决策状态矛盾**：§0 Q5 标 `[x]` 已裁决，但 §3 Decision 写 `User Decision: Pending`、§2.1 仍列"等用户确认"；而 §4.1 目录树已按 Option C 写入（gen-component-catalog.mjs + component-catalog.md），Plan Approved 2026-09-30 事实上已批准 C。修正：§3 Decision 补 `Selected: C，经 Plan Approved 2026-09-30 一并确认`，§2.1 划掉该项。
- **R1-2 starter 场景引用不存在的资产**：`template/public/scene-data.json:88` 引用 `assetId: "wind_turbine"`，windTurbine handler 硬编码 `assets/models/wind_turbine.glb`；但 `template/public/` 下无 assets/ 目录，skill `assets/models/` 为空，3d-templete 实际只有 `example.glb` + `rack.glb`（无风机）。批次 1 冒烟"通过"时风机实际 404 被 console.warn 吞掉（图元渲染掩盖）。且 checklist 2.1 种子名单（example+rack）与 starter 引用（wind_turbine）不一致。**需用户裁决**：(a) starter 换用 example.glb（handler 演示价值保留需改 blades 约定）或 (b) 种子名单增加风机模型（需走建模通道产出）。
- **R1-3 场景级性能门禁无数值**：§2 定义"场景总预算≤1M 三角、材质数≤32 草案、draw call 超预算打回"，但 **draw call 预算数值本身未定义**；1M/材质数≤32 无机器执行面落点（validate-model 是单模型门禁，perf-fps 只测 fps 且 §4.5④ 将 draw call/面数/材质数列为"优化建议"而非门禁，与 §2"打回"表述冲突）。修正：定义 draw call 预算值 + 明确 1M/材质数由哪个脚本在哪一层检查（建议 build.mjs 读 scene-data.json 静态估算或 perf-fps 断言）。
- **R1-4 SceneHandle 契约块过时**：§4.2 仅列 6 方法（update/serialize/pick/setDebug/onCardState/dispose），实际已有 `refreshCards()`、`frameObject(id)`、`onCameraSwap(cb)`、`internals`（createScene.ts:23-63）。批次 3.1 build.mjs"edit 只能走 SceneHandle"白名单若按旧契约写会误判合法入口。修正：契约块同步为现状。

#### P2（Spec 记录漂移，修正不影响已交付代码）

- **R2-1 Plan 目录树与实际偏差（Reverse Sync 缺失）**：① engine/ 实为 **9** 个文件（+EnvironmentEngine.ts，Plan/checklist 均写"八个"，Diff #6 只记了编辑器 6→8 未记引擎 8→9）；② scene-data.json 实际在 `public/`（fetch 加载），非 Plan 所写 `src/scene-core/scene-data.json`——二开者按目录树找会扑空；③ edit/ 实有 11 文件（v1.1 记"八件"，第三轮新增 LightHelperService.ts 未更新清单；另有 EditApp.vue/styles/editor.css）；④ 未入树的还有：handlers/index.ts、scene-core/utils/material.ts、scene-core/index.ts、src/App.vue、src/env.d.ts。
- **R2-2 scene-data schema 样例过时**：LightConfig 实际必填 `id`（样例无）；CameraConfig 实际有 near/far/orthographic（第三轮新增未同步）；RendererConfig 实际有 shadowMapEnabled/maxPixelRatio（样例无）。
- **R2-3 trigger 'hover' 声明未实现**：types.ts:211 声明 `'click'|'always'|'hover'`，cards/registry.ts 无任何 hover/pointerover 实现，只有 always 默认可见 + click 切换。修正：v1 收窄类型为 `'click'|'always'`，hover 记入后续扩展（或补实现，需裁决）。
- **R2-4 environment.preset 假枚举**：types.ts:47 列 10 个 preset，EnvironmentEngine 实际全部走 RoomEnvironment（注释自认"当前所有 preset 统一走 RoomEnvironment"）——用户选 'sunset' 得到的仍是影棚光，欺骗性 UI。修正：v1 枚举收窄为 'studio'（或 PropertyPanel preset 选择暂时隐藏），其余值记为 HDRI 扩展待办。
- **R2-5 init.mjs 缺资产复制步骤**：resolveAssetUrl 注释说"模板按资产清单静态生成；默认走 public/assets/"，但 checklist 3.3 只写"母版复制+占位替换+首次 build"，无"skill 资产库 → 目标工程 public/assets/ 复制/映射生成"原子项。S4 填 scene-data.json 时引用资产库命中项，无此步骤则 404。修正：3.3 补子步骤。
- **R2-6 MODEL_SPEC_LIMITS 丢档**：AssetEngine.ts MODEL_SPEC_LIMITS 只有 maxTriangles=10000 单档，§2 的"prop≤2k/主角≤10k"两档未落；textureCount 仅统计无"≤4 张"门禁；材质数无字段。批次 2.3 validate-model.mjs 若照抄将丢 prop 档。修正：model-spec.md 起草时按 §2 两档+贴图数+材质数落全。
- **R2-7 serialize() lookAt 一致性风险（第三轮遗留）**：serialize 用 `...data.camera` 展开旧值，只回写 position/fov/type；OrbitControls 拖动后 controls.target 变化会经 getConfig() 回写，但 camera.lookAt 是独立存储——序列化产物中 camera.lookAt（初始值）与 controls.target（拖动后）可能不一致，重载时相机看向 lookAt、控制器绕 target 转，产生初始跳变。建议批次 2 前修复或记入已知风险。

#### P3（低优先级，投递卫生/顺序）

- **R3-1 模板投递残留**：template/ 内含 `dist/`（831K）、`node_modules/`、`.smoke-r4/`，无 .gitignore；package-lock.json resolved 全为 registry.npmjs.org（内网纪律要求 mirrors.tools.huawei.com，参照 skill generate-ux-prototype 有 install.sh --registry 模式）。批次 3.3 init.mjs 需明确排除规则；README（5.5）需写内网安装方式；建议补 .gitignore/.skillignore。
- **R3-2 checklist 顺序**：5.2 SKILL.md 依赖 5.4 component-catalog.md 产物（降级阶梯第 3 层引用），顺序倒置——5.4 提前到 5.2 前或注记。
- **R3-3 40fps 门禁测量环境未定义**：swiftshader 软渲染下 fps 天然偏低，40fps 门禁在冒烟机可能永不达标。建议：fps 门禁在交付目标环境（真机 GPU）实测；软渲染冒烟只做结构验证不计 fps。
- **R3-4 ensure-env 多模态声明格式未定义**：checklist 4.4"多模态档位声明解析"——声明载体（环境变量/配置文件/SKILL.md 指令）未定，批次 4 会撞 TBD。
- **R3-5 §1.6 过时**：Open Questions 说"四项已向用户提出，等最终确认"，实际 §2 均已记 2026-09-30 裁决/确认，且 Plan 已 Approved。
- **R3-6 manifest category 开放枚举**：`demo/equipment/building/…` 省略号开放式，校验器宽松/严格模式未定（批次 2.1 需明确：建议白名单+自定义透传）。
- **R3-7 §9 Project Sync Candidates 可补**：命名纪律（UI 与数据一律用 three.js 原生类型名，禁止自造名）、headless Edge WebGL swiftshader 参数——两条已稳定，任务收尾时同步。

#### 历史风险记录（2026-09-30 Plan 期）

- 本 Plan 已知风险：① 词法检索对中文同义词弱（如"风机"vs"风车"）——缓解：tags 规范化提示 + 内网 embedding 后续接入；② Blender 便携版镜像 URL 需用户提供内网地址——已在 S1 澄清清单；③ 母版工程体量大（批次 1 占全工作量大头）——批次间停等确认控制返工风险

#### 评审决议（2026-10-08 用户逐项裁决，全部落定）

- **R1-1**：无需用户操作。Spec 自行修正三处矛盾：§3 Decision 补 `Selected: C，经 Plan Approved 2026-09-30 一并确认`、User Decision 改 Accepted；§2.1 划掉"Q5 组件库组织方案…用户确认"项（Plan Approved 即确认）。
- **R1-2**：**已裁决——不补风机模型，starter 改用 example.glb**。windTurbine handler 改造：资产引用换 example.glb；handler 演示点通用化（params.spin 旋转整组），注释说明是自定义 handler 演示模式。checklist 2.1 种子名单维持 example+rack。（并入批次 R.5/R.7）
- **R1-3**：~~已批准——分层门禁~~ → **已修订（2026-10-13 二次裁决，见 §4.5「R1-3 修订」区块）**。原裁决：数值（model-spec.md 可覆盖）draw call ≤400、场景总三角 ≤1M、材质数 ≤32；构建期 build.mjs 静态估算超限 FAIL；运行期 perf-fps.mjs 断言超限 FAIL；40fps 仅真机 GPU 生效。**修订后：预算三项与 fps 双双降级为 WARN 观测项（FAIL 仅保留结构性失败），`--strict` 可恢复严格判定**——依据：预算数值与 fps 同为机器相关判断（A 机超标对 B 机独显无意义）+ 性能取舍属用户主权（用户觉得卡再修，LLM 修复时有基线可比）。
- **R1-4**：**已批准——契约块按代码现状重写为 10 成员**（§4.2 已更新）；internals 保留但降格声明（edit 实现便利通道，非稳定 API，二开者禁用）；build.mjs 铁律 2 判定规则：edit/ 只允许 `'@/scene-core'` 一个 import 入口，engine 内部文件经 handle.internals 属性访问放行；edit/ 文件清单同步（11 文件以实际为准）。
- **R2-3 hover 收窄**：已批准。CardConfig.trigger 收窄为 `'click' | 'always'`，hover 记入后续扩展待办。
- **R2-4 preset 收窄**：已批准。EnvironmentPreset 收窄为 `'studio'`，其余 9 值记 HDRI 扩展待办；PropertyPanel preset 选择 UI 暂时隐藏（只留 intensity）。
- **R2-7 lookAt 一致性**：批次 R 中一并修复（serialize 回写 camera.lookAt = controls.target）。
- **P2 其余（R2-1 目录树漂移 / R2-2 schema 样例过时）**：随数据结构 v3 重构自然覆盖（§4.9 契约取代旧 schema；目录树在批次 R 执行记录时同步）。

#### 评审后追加裁决：数据结构 v3（2026-10-08，三轮收敛，用户全部批准）

评审记录 1 之后用户连续三轮深挖 scene-data 定位与材质归属，最终裁决推翻 §4.2 旧版 schema，定稿**数据结构 v3**（完整契约 §4.9，新增批次 R）：

1. **scene-data.json 定位＝舞台布置 + 业务对象载体**：生产环境数据（设备状态/温度/告警）是业务属性，不描述 three.js；生产数据走 update() 同格式片段通道，翻译模式进 INTEGRATION_GUIDE 一等公民章节（MQTT/轮询示例适配器）。
2. **key:Array 单一结构（B 方案）**：scene-data.json＝引擎内部存储＝编辑器序列化＝生产更新片段＝undo 快照，五种用途一种格式零转换（否定 A 方案"两套结构+转换层"）。
3. **数据无材质（用户原则）**：材质在代码 materials.ts 状态视觉注册表；图元颜色=引擎内建默认值；环境区（背景/雾/灯光/画质）保留数据（舞台配置非物体材质）。编辑器调参产生视觉层，交付时剥离+转录进代码。
4. **按业务类型分组，消灭 model 字段**：分组名即类型，类型决定视觉；仅混装分组允许 model 字段（业务分类语义）。
5. **卡片内联节点**（sibling 字段）：顶层 cards 数组/attachTo 配对一并废除；params 归生产数据源、card 归场景作者、transform 引擎消费——三方所有权互斥，后端推数据不冲 UI 配置。
6. **资产双形态，manifest 声明即分流**：常规资产 GLB 自带材质开箱即用；多状态资产白模+贴图集+states（`map` 换贴图为主、`model` 换实例兜底）；无全局开关，常态零负担。
7. **编辑器视觉层剥离转录**：调参值不进交付数据，strip-edit 剥离+转录清单→LLM 转录进 materials.ts/handler 默认值；视觉状态是设计出来的，不是数据即兴的。
### 4.9 数据结构 v3 契约（2026-10-08 裁决定稿）

> 评审 §4.8 记录 1 引发的三轮架构收敛（scene-data 定位 → key:Array 统一 → 材质出数据），用户逐项裁决后的最终契约。**取代 §4.2 旧版 schema；批次 R 据此执行。**

#### 4.9.1 核心原则

1. **数据只有业务属性，视觉全部在代码**。数据里不出现材质/贴图/模型引用字段（分组名即业务类型，类型决定视觉）。唯一例外：环境区（背景/雾/灯光/画质）是舞台配置不是物体材质，保留在数据。
2. **key:Array 单一结构贯穿内外**：scene-data.json ＝ 引擎内部存储 ＝ 编辑器序列化产物 ＝ 生产更新片段 ＝ undo 快照，零格式转换（B 方案）。
3. **一份 GLB 自带材质开箱即用；多状态资产走白模+贴图集+manifest.states**，按资产声明自动分流，无全局开关。
4. **卡片内联在节点**（sibling 字段），与顶层 cards 数组和 attachTo 配对机制一并废除。
5. **transform 显式字段**（引擎消费），**params 归生产数据源**（后端整块替换），**card 归场景作者**——三方所有权互斥，后端推数据不会冲掉 UI 配置。

#### 4.9.2 scene-data.json v3 形态

```jsonc
{
  "version": "1",
  "meta": { "name": "厂区监控", "description": "…" },
  // ---- 环境区（保留 key：舞台配置，二开者可按部署环境改）----
  "scene":    { "background": "#87CEEB", "environment": { "intensity": 1 }, "fog": null },
  "camera":   { "type": "PerspectiveCamera", "position": [x,y,z], "lookAt": [x,y,z], "fov": 50,
                "near": 0.1, "far": 1000, "orthographic": { … } },
  "lights":   [ { "id": "dir_001", "type": "DirectionalLight", "position": [6,10,4], "intensity": 2.2, "castShadow": true } ],
  "controls": { "type": "OrbitControls", "target": [0,1,0], "minDistance": 2, "maxDistance": 80,
                "autoRotate": false, "enableDamping": true, "dampingFactor": 0.08 },
  "renderer": { "toneMapping": "ACESFilmic", "exposure": 1.0, "shadowMap": "PCFSoft", "shadowMapEnabled": true, "maxPixelRatio": 2 },
  // ---- 业务区（type 分组：key=业务类型名，value=节点数组）----
  "cars": [
    { "id": "car_01", "parentId": null,
      "position": [10, 0, 3], "rotation": [0,0,0], "scale": 1,   // transform：引擎显式字段
      "card": { "type": "info", "trigger": "click", "offset": [0,1,0] },  // 卡片内联（场景作者）
      "params": { "status": "normal", "speed": 1.2 } }            // 业务属性（生产数据源）
  ],
  "sensors": [ … ],
  // ---- 更新协议（保留 key：喂整份=建场景；喂片段=增量）----
  "remove": ["car_03"]
}
```

- **保留 key 全集**：version / meta / scene / camera / lights / controls / renderer / remove / `__visuals` / `__materialLib`（后两者为编辑器私有区，双下划线族，交付剥离，材质库契约见 §4.10）。其余任何 key 都是 type 分组（type=key 名），未注册 handler 的分组 warn 跳过（3d-templete 语义）。
- **节点字段**：`{ id, parentId?, position?, rotation?, scale?, card?, params? }`。无 type 字段（type=分组 key）。id 全场唯一（幂等键）。
- **更新语义**（与 3d-templete updateTreeScene 一致）：remove 先行 → 每节点存在即 update / 不存在即 create → params 整块替换（不做深合并，后端语义简单可预测）→ 不 diff（有数据就走）。
- **生产数据接入**：后端/轮询/WebSocket 推同格式片段 `{"cars":[{…}], "remove":[…]}` 直接喂 `handle.update()`。翻译层（业务消息→片段）由二开者按 INTEGRATION_GUIDE 模式写，模板给 MQTT/轮询两个示例适配器。

#### 4.9.3 材质四层归位（数据无材质的执行结构）

| 层 | 内容 | 谁写 | 文件 |
|---|---|---|---|
| 资产层 | GLB（单状态资产自带材质）/ 白模+贴图集（多状态） | 美术/资产库（Poly Haven 精选等） | assets/models + textures + manifest |
| 代码层 | 状态视觉注册表 + handlers + 图元底座 | LLM/二开者 | materials.ts / handlers/<type>.ts / engine 内建 |
| 数据层 | 业务分组 + params 纯业务字段 + transform + card | LLM 生成/生产更新 | scene-data.json |
| 编辑器视觉层 | 调参产生的 override（serialize 内部字段） | 编辑器 | 交付时剥离+转录 |

**materials.ts 状态视觉注册表**（3d-templete registerMaterials 模式移植）：
```ts
export const stateMaterials = {
  car: {                                    // type 名 → 状态表
    normal: { map: 'car_blue',  metalness: 0.6, roughness: 0.4 },
    alarm:  { map: 'car_alarm', emissive: '#401010' },
  },
};
// handler update 钩子：params.status 变化 → applyState(obj, 'car', status)
```

#### 4.9.4 资产双形态（manifest 声明即分流，无全局开关）

```jsonc
// 形态一：常规资产（大多数）——GLB 自带材质，开箱即用
{ "id": "rack", "file": "rack.glb", "tags": ["机柜"] }

// 形态二：多状态资产——白模 + 贴图集 + states
{ "id": "car", "file": "car.glb",              // 白模（几何+UV）
  "textures": { "blue": "car_blue.png", "alarm": "car_alarm.png" },
  "states": {
    "normal": { "map": "blue",  "metalness": 0.6 },
    "alarm":  { "map": "alarm", "emissive": "#401010" },
    "expanded": { "model": "radar_expanded" }   // 几何级变体的兜底：换实例
  } }
```
- AssetEngine 加载时按 states 有无自动分流：有则预载贴图集构建状态→材质映射；无则 GLB 原样。
- 入库校验（import-assets）：states 引用的贴图 key 必须存在于 textures、文件必须齐全、白模 UV 完好。
- S3 建模判断标准（SKILL.md 建模指引）：模型会有 >1 种视觉状态？是→白模+贴图集+states；否→正常导出。
- applyState 语义：`map` 键换贴图（材质实例克隆后换 map），`model` 键换 GLB 实例；同一机制覆盖贴图级与几何级变体，不开第三条路。

#### 4.9.5 编辑器视觉层与交付转录（双模式哲学第二次应用）

```
编辑调参 → serialize 带视觉层（引擎运行时本来就有，编辑器私有字段）
交付时   → strip-edit 剥离视觉层 + 输出转录清单（物体→调了什么值）
LLM 转录 → 调好的值写进 materials.ts / handler 默认值
验证     → 交付包视觉冒烟确认无回归（诚实分级记录）
```
代价与立场：二开者改颜色→改 materials.ts（文档指路）；生产数据出新视觉状态（如"检修黄"）→加代码条目——**视觉状态是设计出来的，不是数据即兴的**。

#### 4.9.6 已否决方案记录（防回潮）

- ~~两套结构+入口转换（A 方案）~~：转换层是永远的业务，serialize 每次保存做格式映射。
- ~~独立材质数据文件~~：第四样东西，多一层间接+派生物维护，违反统一简单目标。
- ~~数据内联 materialOverride / 顶层 materials 表~~：诱导生产数据碰视觉，后端推数据需知 PBR 参数；资产重构时生产数据全体失效。
- ~~顶层 cards 数组 + attachTo 配对~~：两个 id 体系人肉维护，级联删除 bug 类别（Diff #11 ③）由此而生。
- ~~transform 混入 params~~：每个 handler 都得自己写 transform 应用逻辑（3d-templete 实踩的坑）。
- ~~全库强制白模化~~：单状态资产被迫拆 glb+png，入库管线复杂度翻倍；多状态是例外不是常态。
- ~~多 GLB 变体为主方案~~：几何复制 N 份内存翻倍；降级为几何级变体兜底（states.model）。

### 4.10 材质编辑器与材质库契约（2026-10-09 裁决定稿，批次 M 执行依据）

> 用户需求：选中物体后可编辑材质——Lambert/Standard/Physical 三类型切换（默认 Standard），按类型编辑参数与贴图；调好的材质存入材质库供其他物体复用（参照 Spline 材质面板）。参数契约已对照**实装 three@0.185.1**（template/node_modules 的 @types .d.ts + three.core.js 构造函数源码）逐项校正，非文档/记忆转述。

#### 4.10.0 裁决记录（2026-10-09，用户"都按你推荐的来"）

1. **插入位置**：批次 2 之后、批次 3 之前（唯一硬依赖是 strip-edit 3.2 须知晓材质库；与批次 2 零依赖）
2. **库编辑语义：共享热更**——mat_id → 单例材质实例，N 物体引用共享同一实例；改库即全部引用者实时变化（Spline 同款）；「另存为新材质」「断开链接」做 fork 出口
3. **贴图上传通道：vite dev middleware**（POST 专用端点，dev-only，冒烟可自动化）
4. **种子库材质：内置 4 个**（玻璃/车漆/拉丝金属/绒布，全 Physical，各演示一组进阶参数）；未被引用不参与交付转录
5. **参数呈现：全量 + 分组折叠**——基础组默认展开，Physical 进阶组默认折叠

**清单校正结论**（用户原始清单三处结构性错误，0.185.1 实装为准）：
- normalMap/bumpMap/displacementMap/alphaMap/emissiveMap/aoMap/lightMap/envMap 是三材质**共有**（Lambert r134+ per-fragment 重写后齐备），非 Standard 特有；Lambert 也有 envMapIntensity
- Lambert 真正特有：specularMap、combine、reflectivity、refractionRatio；Standard 特有仅 roughness/metalness 族
- Physical 的 reflectivity 是 ior 的派生 getter/setter（源码 `this.ior = (1 + 0.4*reflectivity)/(1 - 0.4*reflectivity)`），**不做独立控件**；补充 dispersion（色散，r169+）
- ior 合法范围 1.0–2.333（非 2.5）；anisotropyRotation 默认 0（@types 文档标 1 是文档错误）
- transmission > 0 时 opacity 应保持 1（物理透射不走 alpha 混合），面板联动提示

#### 4.10.1 数据契约（编辑器私有区，v3 兼容）

```jsonc
// scene-data.json 编辑器私有区（与 __visuals 同族，双下划线，交付剥离）
"__materialLib": {
  "mat_001": {
    "name": "玻璃",                          // 显示名（转录时转 snake_case 键）
    "spec": {
      "type": "MeshPhysicalMaterial",        // 'MeshLambertMaterial'|'MeshStandardMaterial'|'MeshPhysicalMaterial'，缺省 Standard
      "color": "#ffffff",                     // Color → #rrggbb 字符串
      "roughness": 0.05,                      // 标量直存
      "transmission": 1, "ior": 1.5, "thickness": 0.5,
      "attenuationDistance": null,            // null = Infinity（JSON.stringify(Infinity) 产 null，序列化用 null 表示无穷，加载还原）
      "map": "assets/textures/wood.png",      // 贴图槽：相对 URL 字符串；缺省/null = 清除
      "normalScale": [1, 1],                  // Vector2 → 二元数组
      "side": "DoubleSide",                   // 枚举字符串（FrontSide|BackSide|DoubleSide）
      "iridescenceThicknessRange": [100, 400] // 二元数组
    }
  }
},
"__visuals": {
  "car_01": { "libraryRef": "mat_001", "castShadow": true }   // libraryRef 与 inline 调参字段互斥
}
```

- `libraryRef` 与 inline 字段（color/roughness/…）**互斥**：引用库 = 材质来自共享实例；断开链接 = 库 spec 拷贝为 inline 值；另存为 = inline 值打包成新库条目并引用
- undo/redo、保存、serialize 复用 __visuals 现有机制（structuredClone 快照天然覆盖 __materialLib）
- **交付侧终点**（转录产物，materials.ts）：`export const libraryMaterials = { glass: { type: 'MeshPhysicalMaterial', transmission: 1, ior: 1.5, … } }`——与 stateMaterials **并存不合并**（stateMaterials 管"业务类型→状态→视觉"换装，libraryMaterials 管"名字→材质"跨物体复用，两个问题两个表）

#### 4.10.2 参数契约（面板全量清单，0.185.1 实装校正值；格式：参数(默认值, 范围)）

**通用（三类型）**：
color(#ffffff) / opacity(1, 0–1) / transparent(false) / alphaTest(0, 0–1) / side(FrontSide) / flatShading(false) / wireframe(false) / fog(true) / vertexColors(false) / emissive(#000000) / emissiveIntensity(1)

**共有贴图槽**（+伴随参数）：
map / emissiveMap / normalMap(normalScale [1,1]、normalMapType TangentSpaceNormalMap) / bumpMap(bumpScale 1) / displacementMap(displacementScale 1、displacementBias 0) / alphaMap / aoMap(aoMapIntensity 1) / lightMap(lightMapIntensity 1) / envMap(envMapIntensity 1)

**Lambert 特有**：specularMap / combine(MultiplyOperation) / reflectivity(1) / refractionRatio(0.98)
**Standard 特有**：roughness(1, 0–1) + roughnessMap / metalness(0, 0–1) + metalnessMap
**Physical 特有**（继承 Standard 全部）：
- 清漆：clearcoat(0, 0–1) / clearcoatRoughness(0) / clearcoatNormalMap(clearcoatNormalScale [1,1]) / clearcoatMap / clearcoatRoughnessMap
- 透射：transmission(0, 0–1) / transmissionMap / thickness(0) / thicknessMap / attenuationColor(#ffffff) / attenuationDistance(Infinity) / **dispersion(0)**（色散）
- 镜面：specularIntensity(1, 0–1) / specularIntensityMap / specularColor(#ffffff) / specularColorMap
- 织物：sheen(0, 0–1) / sheenColor(#000000) / sheenColorMap / sheenRoughness(1) / sheenRoughnessMap
- 虹彩：iridescence(0, 0–1) / iridescenceIOR(1.3, 1.0–2.333) / iridescenceThicknessRange([100,400]) / iridescenceMap / iridescenceThicknessMap
- 各向异性：anisotropy(0, 0–1) / anisotropyRotation(0) / anisotropyMap
- 光学：ior(1.5, 1.0–2.333)
- 不做独立控件：reflectivity（ior 派生）

**类型切换参数迁移**：共有参数保留迁移；目标类型特有参数取默认值；Standard→Physical 时 roughness/metalness 保留（继承关系）。

#### 4.10.3 贴图色彩空间（三分桶，材质工厂机器执行）

| 桶 | 槽 |
|---|---|
| SRGBColorSpace（显式设置） | map、emissiveMap、specularMap(Lambert)、sheenColorMap、specularColorMap |
| LinearSRGBColorSpace（显式设置） | lightMap、envMap（典型 .hdr/.exr 浮点格式） |
| NoColorSpace（Texture 默认，无需设置） | 其余全部数据槽 |

aoMap/lightMap 需第二 UV：0.185 由 `texture.channel`（0=uv、1=uv1）选择，GLTF TEXCOORD_1 自动映射；图元无 uv1 时槽位带提示文案。

#### 4.10.4 运行时结构

- **core 侧**：materials.ts 扩 `createMaterialFromSpec(spec: MaterialSpec): Mesh 材质实例`（按 type 实例化 + colorSpace 三分桶赋值 + 反序列化 + Infinity 还原）——工厂不依赖 edit（铁律保持），edit 经 handle/internals 调用
- **edit/MaterialLibService.ts**（新文件）：库 CRUD + 实例注册表（mat_id → 单例）+ 引用追踪（__visuals 反查）+ 热更广播 + 种子材质
- **共享实例语义**：同 mat_id 物体 `material === 同一实例`（材质数≤32 预算正贡献）；改库热更（标量热改/贴图异步换/类型变更重建）
- **种子材质**：glass{transmission:1, ior:1.5, roughness:0.05, thickness:0.5} / carpaint{clearcoat:1, clearcoatRoughness:0.1, metalness:0.7, roughness:0.35} / brushed_metal{metalness:1, roughness:0.35, anisotropy:1} / velvet{sheen:1, sheenRoughness:0.5, roughness:1, metalness:0}
- **上传**：vite dev middleware `POST /__gts3d/upload-texture`（binary body + 扩展名白名单 + sanitize + 重名后缀）→ `public/assets/textures/` → 相对 URL；dev-only 不进 build

#### 4.10.5 面板结构（PropertyPanel 材质分区）

- 顶部：材质库下拉（未引用=「未入库」+ inline 调参；引用中=显示库名，编辑即改库）+「另存为新材质」「断开链接」
- 类型下拉：三类型，值用 three.js 原生类名（命名纪律）
- 分组折叠：基础默认展开 / Standard 参数组 / Physical 进阶组（清漆/透射/镜面/织物/虹彩/各向异性）默认折叠 / 贴图槽区按类型显隐
- transmission>0 时 opacity 旁提示「透射材质应保持 opacity=1」

#### 4.10.6 交付转录（strip-edit 扩展，批次 3.2）

- 剥离 __materialLib + __visuals（含 libraryRef）——编辑器私有区整体不进二开包
- 转录清单新增两表：①材质库表（mat_id/name/spec 摘要）②引用表（nodeId → mat_id）；未被引用的种子材质不列出
- LLM 转录产物：materials.ts 增 libraryMaterials 段 + handler 接线（`obj.material = libraryMaterials.glass`）
- INTEGRATION_GUIDE __visuals 转录章节同步补材质库段

#### 4.10.7 已知边界与陷阱

- **JSON 无穷**：attenuationDistance 默认 Infinity → 序列化 null、加载还原（冒烟断言往返）
- **@types 文档 vs 源码冲突两处**：anisotropyRotation @default 1 实为 0；displacementScale @default 0 实为 1——以源码为准
- Lambert specularMap 是 SRGB 桶（d.ts 明示 color data，与"高光图=数据图"直觉相反）

#### 4.10.8 批次 M Plan（执行期签名 + 实现设计决策，2026-10-09 执行前定稿）

> Plan 期定稿。产品决策由 §4.10.0 五项裁决锁定，本节不含产品新知，只把契约落到可执行签名 + 记录契约未覆盖的内部实现决策（D1–D9）。

**文件变更**

| 文件 | 动作 | 内容 |
|---|---|---|
| `template/src/scene-core/types.ts` | 改 | 新增 `MaterialType`/`MaterialSpec`/`MaterialLibEntry`；`RESERVED_KEYS` 补 `__materialLib`；`SceneData`/`TreeSceneFragment` 增 `__materialLib?` |
| `template/src/scene-core/materials.ts` | 改 | `VisualOverride` 扩 `materialType`/`libraryRef`（内联材质字段扩到 MaterialSpec 全集）；新增 `createMaterialFromSpec`/`applyMaterialTextures`/`migrateMaterialSpec`；`applyVisualOverride` 遇 `libraryRef` 跳过材质（只处理 visible/shadow）；内联材质双路径——同类型克隆+打补丁（保 GLB 贴图/图元默认色）/ 跨类型工厂重建 + `inheritTextures` 继承兼容贴图槽 |
| `template/src/scene-core/engine/SceneEngine.ts` | 改 | 新增 `materialLib` 存储（对称 `visuals`）：`setMaterialLibEntry`/`getMaterialLibEntry`/`getAllMaterialLib`/`removeMaterialLibEntry`；`applyFragment` 消费 `frag.__materialLib` |
| `template/src/scene-core/createScene.ts` | 改 | `serialize()` 追加 `__materialLib`（有则写，无则删） |
| `template/src/scene-core/index.ts` | 改 | 导出 `createMaterialFromSpec`/`migrateMaterialSpec` + `MaterialSpec`/`MaterialType`/`MaterialLibEntry` |
| `template/src/edit/MaterialLibService.ts` | 新 | 库 CRUD + 实例注册表 + 引用追踪 + 热更广播 + 4 种子材质 + syncAll |
| `template/src/edit/PropertyPanel.vue` | 改 | 材质分区改造（库下拉/类型/分组折叠/全量参数/贴图槽/上传接线）；`materialLib` 新 prop |
| `template/src/edit/edit-main.ts` | 改 | 装配 MaterialLibService（种子注入 + 订阅 bridge 变更 syncAll）→ EditApp |
| `template/src/edit/EditApp.vue` | 改 | 透传 `materialLib` 给 PropertyPanel |
| `template/vite.config.ts` | 改 | dev middleware `POST /__gts3d/upload-texture` |
| `template/scripts/smoke-r.mjs` | 改 | 增 S7–S13 材质断言（`--edit` 模式） |
| `template/docs/INTEGRATION_GUIDE.md` | 改 | 补 libraryMaterials 转录段（spec 样例） |

**签名（精确）**

```ts
// types.ts
type MaterialType = 'MeshLambertMaterial' | 'MeshStandardMaterial' | 'MeshPhysicalMaterial';
interface MaterialSpec {
  type: MaterialType;                       // 归一：缺省 Standard
  // 通用（三类型共有）
  color?: string; opacity?: number; transparent?: boolean; alphaTest?: number;
  side?: 'FrontSide'|'BackSide'|'DoubleSide'; flatShading?: boolean; wireframe?: boolean;
  fog?: boolean; vertexColors?: boolean; emissive?: string; emissiveIntensity?: number;
  // 共有贴图槽（URL 字符串）+ 伴随参数
  map?: string; emissiveMap?: string;
  normalMap?: string; normalScale?: [number,number]; normalMapType?: 'TangentSpaceNormalMap'|'ObjectSpaceNormalMap';
  bumpMap?: string; bumpScale?: number;
  displacementMap?: string; displacementScale?: number; displacementBias?: number;
  alphaMap?: string; aoMap?: string; aoMapIntensity?: number;
  lightMap?: string; lightMapIntensity?: number; envMap?: string; envMapIntensity?: number;
  // Lambert 特有
  specularMap?: string; combine?: string; reflectivity?: number; refractionRatio?: number;
  // Standard 特有
  roughness?: number; roughnessMap?: string; metalness?: number; metalnessMap?: string;
  // Physical 特有（继承 Standard）
  clearcoat?: number; clearcoatRoughness?: number; clearcoatNormalMap?: string; clearcoatNormalScale?: [number,number];
  clearcoatMap?: string; clearcoatRoughnessMap?: string;
  transmission?: number; transmissionMap?: string; thickness?: number; thicknessMap?: string;
  attenuationColor?: string; attenuationDistance?: number|null; dispersion?: number;
  specularIntensity?: number; specularIntensityMap?: string; specularColor?: string; specularColorMap?: string;
  sheen?: number; sheenColor?: string; sheenColorMap?: string; sheenRoughness?: number; sheenRoughnessMap?: string;
  iridescence?: number; iridescenceIOR?: number; iridescenceThicknessRange?: [number,number];
  iridescenceMap?: string; iridescenceThicknessMap?: string;
  anisotropy?: number; anisotropyRotation?: number; anisotropyMap?: string;
  ior?: number;
}
interface MaterialLibEntry { name: string; spec: MaterialSpec; }   // __materialLib[mat_id]

// materials.ts
interface VisualOverride extends Partial<Omit<MaterialSpec,'type'>> {
  materialType?: MaterialType;   // inline 类型；与 libraryRef 互斥
  libraryRef?: string;           // 引用库条目；与 inline 调参字段互斥
  castShadow?: boolean; receiveShadow?: boolean; visible?: boolean;
}
const createMaterialFromSpec: (spec: MaterialSpec) => THREE.MeshLambertMaterial|THREE.MeshStandardMaterial|THREE.MeshPhysicalMaterial;
const applyMaterialTextures: (mat: THREE.Material, spec: MaterialSpec) => Promise<void>;   // 贴图槽异步换（含 colorSpace 三分桶 + channel）
const migrateMaterialSpec: (spec: MaterialSpec, nextType: MaterialType) => MaterialSpec;   // 类型切换参数迁移

// SceneEngine.ts
setMaterialLibEntry(id: string, entry: MaterialLibEntry): void;
getMaterialLibEntry(id: string): MaterialLibEntry | null;
getAllMaterialLib(): Record<string, MaterialLibEntry>;
removeMaterialLibEntry(id: string): void;

// edit/MaterialLibService.ts
class MaterialLibService {
  constructor(handle: SceneHandle, bridge: Bridge);
  listEntries(): Array<{ id: string; name: string; spec: MaterialSpec }>;
  getEntry(id: string): MaterialLibEntry | null;
  createEntry(name: string, spec: MaterialSpec): string;   // 生成 mat_id
  updateEntry(id: string, spec: MaterialSpec, label: string): void;   // 热更
  renameEntry(id: string, name: string): void;
  removeEntry(id: string): void;
  saveAs(nodeId: string, name: string): string;   // inline → 新条目 + 引用
  link(nodeId: string, matId: string): void;      // __visuals[nodeId] = { libraryRef }
  disconnect(nodeId: string): void;               // 库 spec 拷贝为 inline
  getInstance(matId: string): THREE.Material | null;
  seeds(): void;                                  // 注入 glass/carpaint/brushed_metal/velvet
  syncAll(): void;                                // 引用物体重挂共享实例
  dispose(): void;
}
```

**实现设计决策（§4.10 契约未覆盖处；内部实现层，非产品决策）**

- **D1 `__materialLib` 真相源落 SceneEngine**（对称 `__visuals`）：库数据随 scene-data 文档流动，`handle.update({__materialLib})` 写、`serialize()` 读、`structuredClone(serialize())` 快照天然覆盖→ undo/redo 零改造。CRUD 语义由 edit 侧 `MaterialLibService` 提供（写穿 `handle.update`），符合"库 CRUD 在 edit、工厂不依赖 edit"。
- **D2 运行时实例注册表落 `MaterialLibService`**（`mat_id → THREE.Material` 单例）：契约明确"实例注册表在 edit"。
- **D3 共享实例重挂 `syncAll()`**：遍历 `__visuals[id].libraryRef` 命中的物体，`mesh.material = instances.get(ref)`；订阅 `bridge.onState` 在每次 commit/undo/redo/rebuild 后调用（幂等零成本）。覆盖 undo 全量重建后新实例的重挂。
- **D4 core `applyVisualOverride` 遇 `libraryRef` 跳过材质**：共享实例归 `MaterialLibService` 独占，core 只处理 visible/castShadow/receiveShadow，避免 core 克隆覆盖共享实例。core 不感知库语义（只看 `libraryRef` 字段是否存在），铁律不破。
- **D5 工厂切两段**：`createMaterialFromSpec` 同步建材质 + 设全部标量/枚举/Vector2/颜色（`attenuationDistance` null↔Infinity 还原）；贴图槽由 `applyMaterialTextures` 异步加载（三分桶 colorSpace + `texture.channel`）。热更标量走同步热改，贴图走异步换。
- **D6 `createMaterialFromSpec` 是唯一材质实例化入口**：`materials.ts` 内 `stateMaterials` 路径（`applyState`/`applyVisualToMaterial`）保留不动（业务状态视觉与库材质两个问题）；两表并存不合并（§4.10.1）。
- **D7 PropertyPanel 参数走数据驱动**：按类型定义参数描述符数组（key/label/range/step/group），`v-for` 渲染，避免逐参数堆模板；分区改造限于 `PropertyPanel.vue` 单文件（不新增 .vue）。
- **D8 上传 middleware 内联 vite 插件**：`vite.config.ts` 新增本地插件对象（`configureServer` 挂 `POST /__gts3d/upload-texture`），`apply:'serve'` 保证不进 build；写 `public/assets/textures/`，返回 `{ url: 'assets/textures/<name>' }`。
- **D9 种子材质注入时机**：`edit-main` boot 装配 `MaterialLibService` 后即 `seeds()`（写穿 `__materialLib`），未被引用不进交付转录（strip-edit 3.2 只转被引用条目）。

**批次 M 验收（Done Contract）**：M.1–M.7 逐条完成；四道门禁全绿（`vue-tsc` / `vite build`（edit-main 独立 chunk，隔离保持）/ `eslint` 0 errors / headless 冒烟 S7–S13 PASS）。

### 4.11 场景树契约（2026-10-09 立项待评审，批次 T 执行依据）

> 用户需求：场景树仿 Spline——子节点可展开、可搜索、节点可显示隐藏、可锁定解锁（用户提供了 Spline 场景面板 DOM 结构作参照：场景列表区 + 搜索框 + 类型过滤 + 树区，树节点带 chevron/类型图标/名称/锁定/显隐按钮）。

#### 4.11.1 数据与现状

- **已有（零改动）**：`SceneNode.parentId`（v3 契约，可跨分组组树）；`__visuals.visible`（批次 R.6，`update({__visuals})` 通道 + undo/serialize/strip-edit 全链现成）
- **新增**：`VisualOverride` 扩 `locked?: boolean`（编辑器私有区，同 visible 族——serialize 自动携带、strip-edit 剥离、undo 可恢复）

#### 4.11.2 交互契约

| 交互 | 行为 |
|---|---|
| 树结构 | 分组 key 为可折叠根（chevron + 类型名 + 计数）；组内按 parentId 嵌套（缩进 + 子节点 chevron）；跨分组父子分区优先；孤儿节点挂根级 warn |
| 展开/折叠 | chevron 点击切换；默认全展开（分组根 + 有子节点） |
| 搜索 | id 子串匹配不区分大小写；命中 + 祖先链自动展开；清空恢复；空态提示 |
| 点选 | 树内点选 = 视口同款选中（Shift 累计）；双击 = F 聚焦（现状保持） |
| 显隐（eye） | 点击切换 `__visuals.visible`；父隐藏时子呈继承态（图标半透明）；点击不改选区 |
| 锁定（lock） | 点击切换 `__visuals.locked`；锁定物体视口点选跳过、Gizmo 不吸附、树中仍可点选看属性；点击不改选区 |
| 图标 | 线性 SVG 图标（编辑器既有风格）；类型图标按分组 key 映射（复用 Spline 式 typeIcon 思路，图标集内建 |

#### 4.11.3 已否决/推迟项（防回潮）

- **拖拽重排/重父**：数据层 parentId 虽支持，但编辑器拖拽改父子涉及 transform 语义（局部/世界坐标切换）——推迟到有真实需求再议，记为 v2 候选
- **Filter by Type 类型过滤**（Spline 有）：当前分组根即类型，重复功能——不做
- **场景列表**（Spline 多场景切换）：模板单场景——不做
- **行内重命名**：id 是幂等键且生产数据引用它，重命名 = 全链 id 迁移——不做（改显示名走 params 或未来 display name 字段）

#### 4.11.4 契约边界

- OutlineTree 重写限于 `edit/OutlineTree.vue` 单文件 + `materials.ts`（VisualOverride 扩字段）+ Raycast/Selection/Gizmo 三处锁定过滤 + smoke-r.mjs 增段；core→edit 铁律、命名纪律（UI 文案用 three.js/Spline 通用语义，无自造名）不变
- 锁定过滤读 `__visuals` 走 handle.internals 现有通道（edit 已在用），core 不感知"锁定"业务语义——core 只暴露 getVisual，"locked 物体跳过拾取"是 edit 侧过滤逻辑
- Physical 各效果默认关闭、按启用计费（官方类文档）——面板不做使用限制，批次 4 性能门禁兜底
- combine(MixOperation) 时才与 reflectivity 联动——面板暴露枚举即可

### 4.12 材质库 UI 重做（2026-10-10 立项，批次 MU 执行依据）

> 用户需求：材质分区的 UI 与交互不满意——「另存为」「断开链接」「未入库」等术语是数据层视角直译，用户看不懂。参照 Spline 官方界面（用户提供材质面板 / 材质素材弹层 / 编辑材质球弹窗三组 DOM + docs.spline.design 文档核实）重做。**纯呈现层重设计：数据契约（`__materialLib`/`libraryRef`/inline 互斥）、MaterialLibService 全部 API、共享热更语义、交付转录链零改动**。

#### 4.12.0 裁决记录（2026-10-10 用户"可以的。我接受你的方案"）

1. **心智模型照搬 Spline**：材质即资产（起名即存在，无"入库"概念）；默认态零术语；换材质=槽重指向（旧材质自动去留）；调参数=同步所有使用者
2. **术语全用 Spline 中文界面原词**，零自造词（见 4.12.2）
3. **执行序修订**：批次 3 已收口（修复轮 PASS），MU 提到批次 4 之前——理由：原排序唯一顾虑（smoke-r.mjs 并行冲突）已消失；MU+M2 连做上下文连贯；批次 4 的性能断言对 UI 改动不敏感。执行序：**MU → M2 → 4 → 5**
4. **改名即入库**：点条目名称原地变输入框，回车 = `saveAs(nodeId, name)`（无标题）或 `renameEntry`（已引用）——消灭「另存为」按钮
5. **「复制材质」替代「断开链接」**：`disconnect(nodeId)` 原语义（库 spec 拷为 inline，外观不变、从此独立），换白话包装 + hover 提示「复制当前外观，此后改库不再影响此物体」
6. **内置材质可删且不复活**：`seeds()` 门控改为仅 `__materialLib` 键不存在时注入（工程首次）；用户删除后不再复活
7. **编辑材质球弹窗复用参数区**：参数组+贴图槽抽成 `MaterialParams` 子组件，面板与弹窗共用
8. **图层堆栈不采纳**：Spline 是自研图层引擎（颜色/玻璃/灯光叠层混合），我们是 three.js 原生材质三类型——命名纪律既定，不引入第二套渲染模型

#### 4.12.1 Spline 术语考据（docs.spline.design + 官方中文界面 DOM 核实）

| Spline 原词（中文界面） | 含义 | 对应我方机制 |
|---|---|---|
| 材质 / 无标题材质 | 默认材质名，不是状态 | 无 `libraryRef` 的 inline |
| 材质素材（弹层标题） | 浏览/搜索/应用材质 | `listEntries()` + `link()` |
| 我的材质库（分组） | 用户自建材质 | 非 seeds 的 `__materialLib` 条目 |
| Spline库 → 我方「内置材质」 | 官方预设 | 4 个 seeds（玻璃/车漆/拉丝金属/绒布） |
| 编辑材质球（弹窗标题） | 编辑资产本身，与选中物体解耦 | `updateEntry()` |
| N 个物体（条目徽标） | 引用计数提示 | `referencingNodes()` |
| Unlink（悬停图标） | 我方用「复制材质」，行为同 disconnect | `disconnect(nodeId)` |

**关键考据结论**：Spline 主面板无任何"在不在库"状态词；材质不需要"入库"，起名即资产；文档原文 "If the asset is adjusted, all objects using it get updated"（调资产全使用者同步）。

#### 4.12.2 UI 结构（三层）

```
① 属性面板·材质分区（编辑当前选中物体）
┌ 材质 ──────────────────── [⊞] ┐  ⊞ = 四宫格按钮，打开「材质素材」弹层
│ ⬤ 无标题材质 · 2 个物体     📄 │  📄=复制材质（hover 出现）
│   （悬停条目提示：修改将同步所有使用此材质的物体）
│ 类型 [ MeshPhysicalMaterial ▾ ]│  类型名保留原生类名（命名纪律），
│ ▾ 基础 / ▸ 清漆 / ▸ 贴图      │  选项内追加中文说明
└────────────────────────────────┘

② 材质素材弹层（应用/管理）
┌ 材质素材                    ✕ ┐
│ [＋新建] [🔍 搜索…]           │
│ 我的材质库                    │
│  ⬤ 木质台面        ✕    ⚙   │  hover 出 删除/编辑（编辑=打开③）
│ 内置材质                      │
│  ⬤ 玻璃  ⬤ 车漆  ⬤ 拉丝金属 │  点击条目 = 应用到选中物体
└────────────────────────────────┘

③ 编辑材质球弹窗（编辑资产本身，不依赖选中）
┌ 编辑材质球                ✕ ┐
│ [名称输入框        ]        │
│ ⬤ 预览 92px   [选择物体→]   │  显示谁在用；点击高亮场景中引用者
│ 类型 + MaterialParams       │  与面板共用同一参数区组件
└─────────────────────────────┘
```

#### 4.12.3 交互规则（六场景走查）

| # | 场景 | 操作 | 结果 |
|---|---|---|---|
| 1 | 新物体调材质 | 直接拖滑杆 | 无标题材质直接改，零概念负担 |
| 2 | 用内置玻璃 | ⊞ → 点玻璃 | 条目变「玻璃 · 1 个物体」 |
| 3 | 改共享材质 | 直接调参 | 「N 个物体」徽标提示在先 → 引用者同步变 |
| 4 | 只改这一个 | hover 条目 → 📄 复制材质 | 变无标题材质独立副本，随便改 |
| 5 | 调好想留着 | 点「无标题材质」→ 输名「红漆」→ 回车 | 入我的材质库，此物体开始引用 |
| 6 | 编辑未被引用的库材质 | 弹层 ⚙ | 打开编辑材质球弹窗，改完即存 |

undo 全程可回退（快照机制现成）。弹层 ✕ 删除有引用条目时提示「N 个物体将保留外观转为独立副本」（removeEntry 现语义）。

#### 4.12.4 落地范围与验收

| 文件 | 动作 | 内容 |
|---|---|---|
| `edit/MaterialSection.vue` | 新 | 材质分区整体从 PropertyPanel 拆出（2265 行减负）：条目 + 类型 + MaterialParams 引用 |
| `edit/MaterialParams.vue` | 新 | 参数组 + 贴图槽区（数据驱动渲染保留） |
| `edit/MaterialPalette.vue` | 新 | 材质素材弹层（搜索/双分组/行内删改/点击应用/新建） |
| `edit/EditMaterialModal.vue` | 新 | 编辑材质球弹窗（名称/预览/选择物体/MaterialParams） |
| `edit/PropertyPanel.vue` | 改 | 材质分区替换为 `<MaterialSection>` |
| `edit/MaterialLibService.ts` | 小改 | 仅 seeds() 门控；其余 API 零改动 |
| `edit/styles/editor.css` | 改 | 条目/徽标/弹层样式（对齐现有 Spline 玻璃风） |
| `template/scripts/smoke-r.mjs` | 改 | 增 MU 段：改名入库转引用 / 复制材质脱离引用 / 弹层应用 link / 删除有引用条目后物体 inline 保留 / seeds 删除不复活 |

**缩略图**：MU 用 CSS 近似（色块 + 金属/粗糙渐变 + 透明度）；three 离屏渲染真实预览球留批次 5 顺手评估。
**验收（Done Contract）**：四道门禁全绿（vue-tsc/build/edit-main 独立 chunk/eslint 0 errors）+ MU 冒烟段全 true + S9–S14（走服务 API，不依赖 UI 选择器）不回归 + 用户验收（六场景手动走查）。

#### 4.12.5 已否决项（防回潮）

- 「未入库」「独立材质」「共享材质」「转为独立材质」「出库」等自造/翻译术语——一律不用
- 常驻「另存为」输入框+按钮——改用点名称原地编辑
- Spline 图层堆栈（颜色/玻璃/灯光叠层）——渲染模型不同，不采纳

### 4.13 GLB 子节点与多材质（2026-10-10 立项，批次 M2 执行依据）

> 用户需求：导入 GLB/GLTF 后，模型内部子节点在左侧树和右侧面板可见可编辑——每个子节点（mesh）有自己的材质，要能分别换材质。用户提供 Spline 导入 person.glb 的完整操作链 DOM 作参照。

#### 4.13.0 裁决记录（2026-10-10 用户"可以的。我接受你的方案"）

1. **方案 A 定案：GLB 保持单场景节点，内部子网格作槽位层暴露**——子网格可单独换材质/隐藏；变换（移动/旋转/缩放/Gizmo/删除）仍作用于模型整体
2. **方案 B 否决（防回潮）**：导入时把 GLB 内部子节点提升为独立 SceneNode——树爆炸（同 GLB 实例化 N 次）、applyState 换模型失效、转录节点海量、scene-data 膨胀
3. **换材质规则照抄 Spline 语义：换 = 槽重指向，从不修改旧材质**——旧材质还有引用就留着（体现在去重列表），没引用自动从列表消失（表象即用户观察到的"多人用就新增、独占就直接替换"）
4. **调参数规则不变**：改材质本身，所有使用者同步变（与换材质是两条独立规则，条目徽标常显提醒）
5. **子网格变换（Gizmo 拖子部件）缓后**：需 per-slot transform 契约 + Gizmo 子网格模式，单独立项 M3 评审，M2 不做

#### 4.13.1 数据契约：slots 覆盖层（`__visuals` 扩展，v3 兼容）

```jsonc
"__visuals": {
  "person_01": {
    "castShadow": true,                    // 物体级（顶层 = 应用到全部，现状语义不变）
    "slots": {
      "Ch23_Pants": { "libraryRef": "mat_001" },     // 只给裤子换材质
      "Ch23_Eyelashes": { "visible": false },        // 只隐藏睫毛
      "Ch23_Hair": { "materialType": "MeshPhysicalMaterial", "transmission": 1 }
    }
  }
}
```

- **slot key = GLB 内部名称路径**（如 `Body/Door/Door_L`）；未命名节点 `#索引` 兜底；同名 GLB 重复实例化结构一致，key 稳定
- slot 值复用 `VisualOverride` 现有类型（materialType/libraryRef/visible/castShadow/receiveShadow）——不发明新概念
- 规则：slot 含 materialType 或 libraryRef → 该子网格独立；无 → 继承物体级/原装材质
- 序列化/undo/保存/strip-edit 剥离：slots 在 `__visuals` 内，全部现成机制白拿
- **兼容**：无 slots 的旧数据零影响；strip-edit 对 slots 天然覆盖（同在 `__visuals` 剥离域）；「未来 `__` 键族」门禁语义不受影响（slots 是 __visuals 的嵌套字段）

#### 4.13.2 核心层改动

| 位置 | 改动 |
|---|---|
| `AssetEngine.buildReport` | 增 `meshes: Array<{ key; name; triangles; materialType }>` 逐网格清单 |
| `SceneEngine` | 新增 `listSubMeshes(nodeId)`；`applyVisualOverride` 从 traverse 一刀切改为「物体级默认 + slots 按 key 命中单独应用」 |
| 拾取 | pick 已返回具体 hit.object（RaycastEngine 现状），新增 `resolveSubMesh(obj): { id; slotKey } | null` 沿父链收集 slot key |
| `MaterialLibService` | `assignMaterial`/`syncAll` 支持按 slot key 替换单网格材质（共享实例语义不变） |

#### 4.13.3 UI（接 MU 组件扩展）

**左树**（OutlineTree）：

```
▾ persons
   ▾ person_01            ← 场景节点（可整体选/移动/删，现状不变）
       ·  Armature        ← 内部子节点（浅色/小图标区分）
       ·  Ch23_Body       ← 点选 → 右面板只显示它的材质
       ·  Ch23_Hair       ← eye 可单独隐藏（写 slots[key].visible）
```

内部子节点只读展示 + 点选 + eye；不能删、不能拖出、不上 Gizmo（浅色样式 + tooltip 声明"模型内部节点"）。

#### 4.13.7 子网格局部变换编辑 M3（2026-10-11 立项即执行；用户验收反馈「子节点要能换位置」+「Gizmo 应在头发上而非 person 圆心」）

> 解除 §4.13.0 裁决 5 的"缓后"。skinned 网格局部 transform 与骨骼动画叠加的已知边界保留记录（动画播放时子网格偏移被骨骼覆盖，静止编辑态可用）。

- **数据层**：`VisualOverride.slots[key]` 扩 `position?: Vec3 / rotation?: Vec3 / scale?: Vec3`（局部变换覆盖层，序列化/undo/剥离全走 slots 现成机制）；`applyVisualOverride` 槽位命中时应用局部 transform（SkinnedMesh 也设 mesh.position 等——骨骼顶点随 mesh 原点平移，静止态有效）。
- **Gizmo 槽位吸附**：`LayoutGizmo.syncSelection` 检查 `bridge.selectedSlot`——有槽位时 Gizmo attach 到该 mesh（世界位置=mesh.getWorldPosition）；拖拽结束把 world delta 转局部 delta 写 `slots[key].position`（以 mesh 当前局部 position 为基线，不改父链）。G/R/S 三模式同规则（rotation/scale 直接写 mesh 局部值）。
- **属性面板**：selectedSlot 时变换区从只读变为**可编辑**（draft 读写 `slots[key]` 局部值，经 slots 通道 commit）；Gizmo 拖拽回填输入框（复用物体级 onState 回填模式）。
- **转录**：strip-edit ①′ 表 position/rotation/scale 行；GUIDE §6.2 补 `getObjectByName('Ch23_Hair').position.set(0.1, 0, 0)` 样例。
- **树/眼**：不变（树行高亮、BoxHelper 槽位框选维持 F6 现状）。
- **已知边界（记录）**：骨骼动画播放时局部偏移被骨骼矩阵覆盖（skinning 数学使然）；编辑器为静止态编辑，可接受。undo 槽级 transform 快照走 slots 现成机制零成本。
- **Checklist（批次 M3，立即执行）**：
- [x] M3.1 slots 扩局部 transform 字段 + applyVisualOverride 应用 + 类型
- [x] M3.2 Gizmo 槽位吸附（syncSelection 按 selectedSlot attach mesh；拖拽写 slots[key].position 局部 delta）
- [x] M3.3 PropertyPanel selectedSlot 时变换区可编辑（draft 双向：面板→slots、Gizmo→面板回填）
- [x] M3.4 strip-edit 转录 slots transform 行 + GUIDE §6.2 样例
- [x] M3.5 冒烟 S46：选中 Hair → Gizmo 位置=Hair 世界位置（非 person 原点）；拖 Gizmo → slots.Armature/Ch23_Hair.position 落库 + serialize 往返 + mesh 实际平移 + undo 恢复；面板输入局部值生效；S40–S45 回归
- [x] M3.6 三绿 + SMOKE + gates

> 点选子网格后属性面板须反馈**该子网格**的信息，而非仍显示模型整体。

- **数据通道**：`Bridge` 增 `selectedSlot: {nodeId, slotKey} | null`（进 EditorState emit）+ `selectSlot(nodeId, slotKey)` / `clearSelectedSlot()`（点空白/ESC/切物体时清）；`SceneEngine` 增 `getSubMeshInfo(nodeId, slotKey)`——按 findBySlotKey 定位 mesh，返回**局部 transform（position/rotation/scale，相对模型节点）、世界包围盒（该 mesh 自己的）、材质类型与主色**。
- **属性面板反馈**（selectedSlot 非空时）：
  - 变换区：显示子网格**局部变换（只读）**——子网格变换编辑属 M3（缓后），面板给数值参考 + 灰置输入；标题注「Ch23_Hair · 模型内部（相对 person_01）」
  - 包围盒 hint：该 mesh 自己的世界包围盒尺寸
  - 材质区：聚焦该槽位（现状 focusSlot 机制）
- **视口反馈**：SelectionService 的高亮包围盒在 selectedSlot 时换为**只包该 mesh**（BoxHelper 单 mesh）；Gizmo 仍不吸附（M3 缓后）。
- **入口**：树点 mesh 行 → `bridge.selectSlot`（替代现在的纯 select + window 事件）；属性面板点槽位行（聚焦编辑）不改。

**右面板**（MaterialSection 列表化）：

- 选**模型节点**：材质区 = **去重材质列表**（材质去重即 Spline 语义——3 部件 3 种材质显示 3 条）+「全部换成…」按钮（带确认「将替换 N 个材质槽」）
- 选**子网格**：材质区只显示它的 1 条，换/调照常
- **视口拾取联动**：点视口某部位 → 选中模型 + 对应材质条目高亮滚动定位（不联动则用户找不到 mesh 名，体验闭环关键）

#### 4.13.4 交付转录

TRANSCRIPTION 物体视觉 override 表增 slot 列；LLM 转录产物按 mesh 定位：`obj.getObjectByName('Ch23_Hair').material = libraryMaterials.mat_001`。材质预算（≤32）按现有去重语义算，slot 引用共享库实例不恶化预算。

#### 4.13.5 风险与边界

1. **GLB 重导出 mesh 改名 → slot key 失效**：降级 = 找不到 key 时 console warn + 忽略，不 crash；validate-model 命名规范门禁在入库侧兜底
2. **骨骼/Armature 类空节点**：树内展示但无材质槽（非 mesh），仅结构可见
3. **多 GLB 实例共享 slots**：slots 挂 `__visuals[节点id]`（每实例独立），不互相污染
4. **子网格变换（M3 缓后）**：见 4.13.0 裁决 5

### 4.14 材质面板布局重做（2026-10-10 立项，批次 MU2 执行依据）

> **来源**：MU.8 用户验收（§4.12.3 六场景走查）反馈。用户提供 Spline 官方界面 DOM 作参照：材质面板是**右侧浮出的浮动面板**（`FloatingPalette`——带拖拽把手、按 top/left 定位、**无全屏遮罩**、不挡场景操作）；材质素材与「编辑材质球」**可同时存在、并排、互不重叠**；材质列表（我的材质库 / Spline库）**一材质一行**。MU 落地的是「居中 + 全屏遮罩对话框」（`.ed-overlay`/`.ed-dialog`，MU.6 引入）——两面板一开即**叠**在一起、遮罩还挡场景。本批**重做面板布局模型**。**数据契约 / MaterialLibService API / 交付转录链零改动**（延续 MU 的纯呈现层定位）。

#### 4.14.0 需求确认（用户验收反馈，2026-10-10）
1. 材质素材 + 编辑材质球 → **右侧浮出**（浮动面板，非居中遮罩弹窗）
2. 两面板**可同时存在、并排、互不重叠**
3. 材质列表**一材质一行**（含内置材质；现为 chips 换行堆叠）

#### 4.14.1 布局模型（浮动面板层，替代 `.ed-overlay`/`.ed-dialog`）
- **独立浮动面板**：面板浮在场景之上但**不拦截场景交互**（无全屏遮罩；可边看场景边调材质）
- **可拖拽移位**：标题栏作拖拽把手，任意摆放（Spline 实测——同两个面板在两次截图里分别处于「同列上下」`479/273`+`479/414` 与「同行左右」`479/273`+`223/273`，即**用户自由拖动**）
- **默认并排错开**：面板默认**并排摆放、互不重叠**（同级错开；打开第二个面板不挤掉第一个，关一个其余重排）
- **不锁死轴向**：默认横向错开，用户可拖任意位置（位置会话内有效，不持久化）
- 关闭：标题栏 ✕（**无遮罩点击关闭**）

#### 4.14.2 面板内容（内容不变，仅外壳与列表排布变）
- 材质素材：标题「材质素材」+ [＋新建][搜索] + **两分组列表（我的材质库 / 内置材质，均一材质一行：缩略图 + 名称 + 行内操作）**
- 编辑材质球：标题「编辑材质球」+ 名称输入 + 预览球 + 选择物体 (N) + 类型 + MaterialParams（内容与 MU.4 一致）

#### 4.14.3 落地范围与验收

| 文件 | 动作 | 内容 |
|---|---|---|
| `edit/FloatingPanel.vue` | 新 | 浮动面板外壳：拖拽把手 + 标题 + 关闭 + 内容插槽（位置由停靠层给） |
| `edit/FloatingDock.ts` | 新 | 停靠槽位计算：多面板纵向错位、不重叠、开/关重排（可为独立模块或 composable） |
| `edit/MaterialPalette.vue` | 改 | 换 FloatingPanel 外壳；内置材质 chips → **一材质一行** |
| `edit/EditMaterialModal.vue` | 改 | 换 FloatingPanel 外壳 |
| `edit/PropertyPanel.vue` | 改 | 两面板并存的状态与渲染（`paletteOpen` 与 `editMatId` 可同时成立） |
| `edit/styles/editor.css` | 改 | 删 `.ed-overlay`/`.ed-dialog` 居中遮罩原语；加浮动面板 / 停靠样式 |
| `template/scripts/smoke-r.mjs` | 改 | 冒烟：两面板并存不重叠 / 无遮罩元素 / 材质行一行一项 |

**验收（Done Contract）**：四道门禁全绿（vue-tsc / build（edit-main 独立 chunk 隔离保持）/ eslint 0 errors / 冒烟 PASS）+ 用户验收（右侧浮出、两面板并排、可拖拽、不挡场景、一材质一行）。

#### 4.14.4 已否决 / 边界
- ~~全屏遮罩对话框（MU.6 的 `.ed-overlay`/`.ed-dialog` 居中方案）~~——本批作废并**清除该原语**
- 数据契约零改动（延续 MU；`MaterialParams` / `MaterialLibService` / 转录链不碰）
- 面板拖拽位置**不持久化**（会话内有效，刷新复位）——超出本批

### 4.15 编辑器浅色主题 + 浮动面板避让 + 材质分区收拢（2026-10-10 立项，批次 MU3 执行依据）

> **来源**：MU2 用户验收（2026-10-10）三项反馈。**数据契约 / MaterialLibService API / 交付转录链零改动**（延续 MU/MU2 的纯呈现层定位）。

#### 4.15.0 需求确认（用户验收反馈，2026-10-10）
1. **整体浅色主题**（用户原话「页面 template 整体风格都是浅色的，参考 spline」）——现状全套深色（`--ed-panel: rgba(23,27,32,.94)` / `index.html #0f151b` / ExampleCard 深底）；范围 = 编辑态 + 二开态（「整体」）
2. **浮动面板不得叠固定面板**——MU2 的 `defaultDockPos(0,300)` 算出 `x=vw−316`，而右栏占 `[vw−306, vw−14]` → 材质素材几乎完全压在物体/场景面板上（几何实测成立）。MU2 只做了「浮动面板之间」避让，**漏了与左树/右栏固定面板的避让**
3. **材质分区收拢**——属性面板的材质分区**只留条目行**（缩略图+名称+徽标+hover 复制+⊞）；类型下拉与全量参数区**不平铺**；**点条目行 → 打开「编辑材质球」浮动面板**（Spline 实测：属性面板 AssetItem 点击 → MaterialAssetModal；用户贴的 `.ms__entry` DOM 即该条目）

#### 4.15.1 浅色令牌（editor.css，全套替换）

| 令牌 | 深色（现值） | 浅色（新值，Spline 风） |
|---|---|---|
| `--ed-panel` | `rgba(23,27,32,0.94)` | `rgba(255,255,255,0.92)` |
| `--ed-input` | `#2a313a` | `#f0f1f3` |
| `--ed-input-hover` | `#343d48` | `#e4e6ea` |
| `--ed-border` | `rgba(255,255,255,0.09)` | `rgba(0,0,0,0.08)` |
| `--ed-text` | `#e7eaee` | `#1d1f23` |
| `--ed-dim` | `#97a1ac` | `#6b7280` |
| `--ed-accent` | `#3d7eff`（保持） | `#3d7eff` |
| `--ed-accent-soft` | `rgba(61,126,255,0.18)` | `rgba(61,126,255,0.12)` |
| `--ed-shadow` | `0 8px 28px rgba(0,0,0,0.4)` | `0 8px 28px rgba(0,0,0,0.12)` |

同步核对：FloatingPanel/工具条/树/页签/徽标/弹层 hover 语义在新令牌下成立；**逐组件过一遍硬编码色**（非 var() 的 rgba/十六进制残留）。

#### 4.15.2 浮动面板避让固定面板（FloatingDock）
- `defaultDockPos` 增**固定面板避让**：右侧预留 `RIGHT_RESERVE = 292(右栏宽)+14(margin)+12(gap) ≈ 318px`；`x = min(vw − RIGHT_RESERVE − panelW − index*(panelW+GAP), …)` 且不小于左树右缘（248+14+12）
- 窗口过窄时（左右固定面板 + 一个浮动面板放不下）：允许纵向向下错位（仍不叠右栏）——**退而求其次不遮挡，而非硬挤**
- 冒烟断言从「浮动面板两两不重叠」升级为「浮动面板 × 全部固定面板 + 浮动面板两两」零交集

#### 4.15.3 材质分区收拢（MaterialSection / EditMaterialModal）
- **MaterialSection**：删类型下拉与 `<MaterialParams>` 平铺区；只留条目行（缩略图 + 名称 + 「N 个物体」徽标 + hover 复制材质 + ⊞）；条目行**整体可点** → `emit('edit-entry')`（无库引用时编辑选中物体的 inline 材质；有引用时编辑库条目）
- **EditMaterialModal**：增「inline 材质编辑」入口语义——`matId` 为空时编辑 `__visuals[anchorId]` 的内联 spec（调参仍写视觉层）；有 `matId` 时编辑库条目（现状）。名称输入对 inline 态隐藏（无标题材质无库名）
- MaterialParams 组件本体不动（仍是参数区唯一实现，只是**从属性面板搬家到编辑面板**）

#### 4.15.4 已否决 / 边界
- ~~属性面板平铺全量材质参数（MU.2 形态）~~——本批收拢，参数区只存在于「编辑材质球」面板
- 深色主题：**不保留双主题开关**（用户明示整体浅色；二开交付物同浅色）
- 数据契约零改动：inline 互斥 / libraryRef / 转录链不碰

#### 4.15.5 材质条目直达素材库 + 编辑面板锚定（2026-10-10 立项，批次 MU4 执行依据）

> **来源**：用户在 Spline 实测的困惑（「有时弹编辑球有时不弹」「两面板有时互斥有时共存」）+ 其提供的属性面板完整 DOM 解码。**Spline 真实交互解码**：材质分区是 **AssetItem 列表**（多材质 GLB 每槽一条）；条目分两态——`untitledasset`（无标题，icons 仅 1 个 ⊞）与 `appliedasset`（已应用库材质，icons = ⊞ + Unlink）；**面板头 ⊞ / 条目 ⊞ / ＋ 三入口都开「材质素材」palette**（条目 ⊞ 带 `data-palette-id="material-<uuid>"` 锚定该材质）；**「编辑材质球」是 palette 的二级子面板**（palette 里点材质球打开，贴着 palette；palette 关则编辑球关——用户感知的"互斥"实为父子关系）；条目本体点击不开任何面板（可发现性差）。

**裁决（2026-10-10，融合 Spline 验证过的细节 + 保留 MU3 的一跳直达）**：

1. **属性面板材质条目行加 ⊞ 按钮**（对齐 Spline「想换材质直达素材库」）：点行 = 编辑当前材质（MU3 既有）；**点 ⊞ = 打开材质素材面板**（browse/换材质，一跳直达，不经编辑面板中转）。行内 ⊞ 与改名/复制同 hover 显隐。
2. **面板排队模型**（2026-10-10 用户验收二次反馈定案，取代初版「编辑面板锚定素材库」）：**哪个面板先出现就贴右属性栏左缘，后出现的往左排队一格，不重叠；关闭面板其余不重排；不定死任何面板的专属位置**。即面板 dock 槽位按「开启时刻序」动态分配（首个=槽 0 贴右栏，后开=已有最大槽 +1）。
3. **窗口自适应**（2026-10-10 用户验收三次反馈定案）：面板**必须始终在视口内**（resize 钳制：右/顶/底不出界，左留抓手；面板高于视口时保标题栏可拖）；窗口横向容不下并排时**纵向下移一整档**（同列完整错位）；矮窗两档放不下时允许部分重叠（可拖走）——**宽窗零重叠、任何窗口零出界**两级断言。
3. **不抄 Spline 的部分**（防回潮）：~~条目本体点击无反应~~（可发现性差，保留 MU3 点行=编辑）；~~三入口全开 palette~~（入口冗余，我们 ⊞=素材库、点行=编辑 两入口各一）；~~palette→编辑球父子强制~~（我们的编辑面板独立于素材面板存在，点行即可开）。

**Checklist（批次 MU4，M2 之前执行）**：
- [x] MU4.1 MaterialSection 条目行加 ⊞（hover 显隐，`.stop` 不触发点行编辑）→ emit `open-palette`；PropertyPanel 接线（复用既有 `open-palette` 事件，PropertyPanel 零新状态）
- [ ] MU4.2 EditMaterialModal dock 感知 paletteOpen：palette 开 → 编辑面板默认位 = 素材面板 rect 左侧紧贴（GAP 12）；palette 关 → 右栏左缘避让位（现 MU3.3 逻辑）；开启顺序变化时重算（palette 后开/关闭时编辑面板是否跟随，取「不动已拖拽面板」：仅默认位计算时感知）
- [ ] MU4.3 冒烟扩展：条目 ⊞ 开素材面板 / 编辑面板与素材面板并排紧贴不重叠（palette 开时）/ 素材面板关闭时编辑面板退回避让位；S36–S38 回归
- [x] MU4.4 三绿 + 冒烟 PASS + 用户验收（直达素材库 / 编辑面板贴素材库）——机器部分完成（SMOKE 39/39）；人工视觉走查待用户

**批次 MU4 执行记录（Reverse Sync，2026-10-10，用户「全部」批内连跑）**：MU4.1–MU4.4 全落地。① **条目 ⊞**（MaterialSection `.ms__browse`，hover 显隐同复制按钮，`.stop` 防触发点行编辑）→ 复用既有 `open-palette` 事件（PropertyPanel 零新状态）；② **锚定**（PropertyPanel `modalPos` 改 computed：`paletteOpen` 真 → `{x: palettePos.x − PANEL_W − 12, y: palettePos.y}` 紧贴素材面板左侧同顶；假 → `defaultDockPos(1, PANEL_W)` 避让位；FloatingPanel 的 pos 仅挂载时取初值，「不动已拖拽面板」天然满足）；③ **S39** 三段断言（⊞ 直达 / 紧贴不重叠 / 退避）。**S39 初版断言两处口径错（实装正确，诊断 rect 证实：编辑面板 right 618 vs 素材面板 left 628，间隔 10 = GAP 12 − 边框 2）**：期望值写死 left−12 未计边框；排序取反。修为容差断言（`|editRect.right − pRect.left| ≤ 14 且 ≤`）+ left 较小者 = 编辑面板。④ 三绿 + **SMOKE PASS 39/39**。
**验收反馈修复（同日，用户实测「没有素材面板时编辑面板离得很远」）**：palette 关时编辑面板用 `defaultDockPos(1, 300)` 落在 **index 1 错位槽**（为"第二个面板"预留 index 0 的位置）——横向与右栏隔了整整一个面板宽的空位。根因是 MU4.2 的"关→避让位"语义被实现成"index 1 槽位"而非"贴右栏左缘"。修法：palette 关 → `modalPos = {x: palettePos.x, y: palettePos.y}`（**与素材面板同位，即贴右栏左缘**）。复验：三绿 + **SMOKE PASS 39/39**（S39 `retreated` 断言仍过——只验"不叠右栏"，未验"贴近"，修后更近了）。
**验收反馈二次修复（同日，用户实测「材质编辑和材质素材又重叠了」+ 交互定案「哪个面板先出现就贴物体面板，后出现的往左排，不定死位置」）**：首次修复后 palette 关时编辑面板用 palette 同位——但 **palette 后开时也取 index 0** → 两者同位重叠。静态"专属位"模型被否决，改为**排队模型**：PropertyPanel 增 `paletteSlot`/`editSlot` ref + `watch([paletteOpen, editOpen])`——面板开启时取「另一面板已占的最大槽 + 1」分槽（首个=0 贴右栏），`palettePos`/`modalPos` 改 computed 按 slot 取 `defaultDockPos`；面板关闭其余不重排（FloatingPanel pos 仅挂载取初值，天然满足）。**双序探针验证**（一次性，验完删）：先编辑后素材（编辑 628 不动 / 素材 316 左排）、先素材后编辑（素材 628 不动 / 编辑 316 左排）、单开任一贴右栏——`okAlone + okJoin` 全 true。**S39 断言同步改排队语义**（排序/相邻判断不再假定"编辑在左"）。复验：三绿 + **SMOKE PASS 39/39**。§4.15.5 契约的「编辑面板 dock 感知 paletteOpen」表述由本修复**修订为「面板排队模型」**（先到贴右栏、后到左排、关闭不重排）。
**验收反馈三次修复（同日，用户实测「窗口小一点，卡片又叠在一起了」——自适应缺失）**：排队位置只在**挂载时**按当时的视口宽算，resize 后不重算（fixed 坐标失效）；且矮窗纵向两档放不下时旧 fallback 拉回顶部致叠。修两层：① **FloatingPanel 增 resize 钳制**——`onMounted`/`window.resize` 时 `clamp()`（右不出界 / 左留 60px 抓手 / 顶不出头 / 纵向优先完整可见，面板高于视口才退化保标题栏；用面板真实 offsetHeight）；② **FloatingDock 重排算法**——横向 `perRow = ⌊(右栏左缘−左树右缘)/(面板宽+GAP)⌋` 放不下时**纵向下移一整档**（ROW_H 430 + GAP，同列完整错位非 40px 小步），去掉矮窗拉回（交 clamp 兜底）。**窄窗探针验证**（900×600 开两面板 → CDP 缩到 700×500，一次性验完删）：编辑面板钳在视口内（bottom=视口高）、素材完全可见、宽窗不重叠断言保持。**断言分级原则（记方法论）**：宽窗（横向容得下两面板）必须不重叠；窄/矮窗物理放不下时允许纵向部分重叠（可拖走），但**任何窗口都必须在视口内**。复验：三绿 + **SMOKE PASS 39/39**。


### 4.16 Poly Haven 批量入库管线（2026-10-13 立项，批次 PH 执行依据）

**契约**：新增脚本 `scripts/fetch-polyhaven.mjs`（一次性数据工具，不是 skill 运行时依赖），从 Poly Haven API 拉精选资产转 GLB 入库。四项裁决（2026-10-13）：下载时合并转 GLB / 类别配额精选 / 内置映射字典自动生成中文 / 中文类别映射。

#### 4.16.1 精选策略（确定性算法）

1. **候选池**：`<CACHE>/models.json` 中 `polycount <= 50000` 的条目（430 个）
2. **类别归一（2026-10-13 修正：次类别回退）**：`categories[]` 剔除 `collection:*` 前缀项后取**第一个命中 12 大类的类别**为主类别（实测 45 个资产主类别为 rocks/appliances/vases 等非大类，但次类别多命中，如 `ceramic_vase_01 → [vases, containers, decorative]` 归 containers）；无命中归 `props`。次类别回退后分布：props 133 / furniture 75 / industrial 49 / decorative 37 / containers 31 / nature 24 / lighting 22 / tools 21 / electronics 15 / food 12 / seating 6 / plants 5（总 430）
3. **配额分配**（目标 ~108 个）：12 大类每类配额 = `round(108 × 类别候选数占比)`，向下取整后余量按各类候选 download_count top 补齐到总数 108；配额不足的类（候选 < 配额）实际候选全取，缺口由 props/furniture 等大类补
4. **类内排序**：download_count 降序，取前 N（配额数）
5. **下载期预检（三重过滤，逐资产在下载后、入库前）**：
   - 贴图数 > 8（读 gltf json 的 `images.length`）→ 剔除，类内顺位递补
   - md5 校验失败（主文件/bin/贴图任一）→ 剔除递补
   - 节点数（gltf json `nodes.length`）> 64 → 剔除递补
6. **递补终止**：配额类候选耗尽即接受少于 108（实际数如实打印），不跨类强凑

#### 4.16.2 gltf→GLB 合并（零依赖，脚本内实现）

输入：Poly Haven gltf 目录（`<id>_2k.gltf` + `<id>.bin` + `textures/*.jpg`）。步骤：
1. 解析 gltf json；断言 `extensionsRequired` 为空（Poly Haven 实测无）
2. 收集所有 `buffers[].uri`（相对 bin）与 `images[].uri`（相对 jpg）为待嵌入清单
3. 逐一读文件 → 拼 BIN 块：bin 在前，贴图按 images 顺序在后，各 4 字节对齐（padding 补 0x00）
4. 重写 json：buffers → 单 buffer（无 uri，byteLength=bin 总长）；images → `bufferView` 引用（mimeType 保留 image/jpeg）；删除所有 uri 字段
5. 产出 GLB：12B 头（magic 0x46546C67 / version 2 / total）+ JSON chunk（0x4E4F534A，4 对齐，pad 空格 0x20）+ BIN chunk（0x004E4942）
6. 产出即过 validate-model（triangles/nodeCount/textureCount/maxTextureSize 与源一致——探针已证 2k jpg 均 2048）

#### 4.16.3 manifest 生成（中文三件套）

每个资产条目（对齐 import-assets manifest schema：name/file_name/file_path 必填）：
- `id`：Poly Haven id 全小写（`ArmChair_01` → `armchair_01`；`^[a-z][a-z0-9_]*$` 硬校验）
- `name`：英文原名透传（`Arm Chair 01`）——2026-10-13 裁决：字典覆盖不了全部专名，name 保留英文，中文靠 tags/search_text 承载
- `file_name` / `file_path`：`<id>.glb` / `data/<id>.glb`
- `category`：中文类别映射（12 大类 → 家具/座椅/道具/工业/灯具/植物/自然/装饰/电子/容器/工具/食品；裁决④）
- `tags`：内置英文→中文映射字典逐词翻译 `tags[]`（armchair→扶手椅/chair→椅子/wood→木质...），未命中原词保留；产出后用户评审（裁决③）
- `description`：英文 description 透传
- `search_text`：英文原词（原名+原 tags+原类别）拼进检索语料，保证英文查询可命中；检索语料五字段 = name + category + tags + description + search_text 拼接（build-search-index 契约），中文 tags/category 与英文 search_text 同条目共存即双语检索

#### 4.16.4 打包与入库

- zip 结构：`manifest.json` + `data/<id>.glb` × N；复用 `import-assets.mjs` 导出的 `writeZip`
- 包名 `polyhaven-seed`（`import-assets.mjs <zip> --name polyhaven-seed`，默认 art 档门禁）
- 入库成功判据：import-assets 退出码 0 + 内置检索冒烟 PASS + `--json` 摘要无 FAIL
- **产出物落位**：下载缓存 `.tmp-polyhaven/fetch/`（含 gltf 原始文件，支持 --resume 断点续跑）；最终 `polyhaven-seed.zip` 落 `.tmp-polyhaven/`（数据非代码，不入 skill 仓库）

#### 4.16.5 gates.mjs 用例 37 修正

`init: --assets all 注入全部模型（example+person+rack）` 断言 `models.length === 3` → 改语义断言：`models.length >= 3 && [example.glb, person.glb, rack.glb].every(f => models.includes(f))`（同批次 2 起始资产断言语义化先例）。断言文本同步改「注入全部模型（含 example+person+rack）」。

#### 4.16.6 File Changes / Signatures

| 文件 | 动作 | 签名 |
|---|---|---|
| `scripts/fetch-polyhaven.mjs` | 新建 | `selectAssets(models, quota=108) → {id, meta}[]`；`fetchAsset(id) → {gltfJson, bin, textures:Map}`；`mergeToGlb(dir) → Buffer`；`buildEntry(id, meta, glb) → entry`；CLI：`node fetch-polyhaven.mjs [--cache <dir>] [--quota 108] [--out <zip>] [--resume]` |
| `scripts/verify/gates.mjs` | 改 | 用例 37 断言语义化（1 行） |
| `.tmp-polyhaven/models.json` | 只读 | 数据源（已存在） |
| skill `assets/` | 数据落库 | models/ +N glb、manifests/polyhaven-seed.json、search-index.json 重建 |

依赖：`node:fs/path/zlib/crypto`（md5）+ `import-assets.mjs` 的 `writeZip`。无 npm 新依赖。

#### 4.16.7 PH 批次 Plan 细节（2026-10-13，Research 补充实证后）

**Research 新增实证（批次 PH 立项后补）**：
- Spec 写入事故已修复：§4.16.3 曾被文件头标题覆盖截断（1379 行 id 条目写一半后拼入 `# SDD Spec: ...`，name/tags/search_text 全丢），本日按 import-assets schema + 裁决重写补齐
- **类别归一口径修正（用户裁决：次类别回退）**：原 §4.16.1「取第一个有效类别」实测排除 45 个资产（rocks 10/appliances 9/structures 7/table 3/office 3/wall decoration 3/instrument 3/weapons 2/shelves 2/books 1/vases 1/bed 1），其中多数次类别命中 12 大类（ceramic_vase_01→containers、classic_laptop→electronics、chinese_cabinet→furniture）。修正为「第一个命中 12 大类的类别」，无命中归 props。修正后分布：props 133/furniture 75/industrial 49/decorative 37/containers 31/nature 24/lighting 22/tools 21/electronics 15/food 12/seating 6/plants 5
- **name 语言裁决（用户）**：name 保留英文原名，中文靠 tags/search_text 承载（字典覆盖不了全部专名）
- 推演配额（quota=108，次类别回退后）：props 34/furniture 19/industrial 13/decorative 10/containers 7/nature 6/lighting 5/tools 5/electronics 3/food 3/seating 1/plants 2
- **tags 映射字典规模**：候选池 tags 词频 Top 160 覆盖核心名词（vintage 124/old 108/antique 70/metal 69/wooden 68/wood 61/chair 17/table 17/lamp 7...）。字典收录策略：高频名词全收（chair/table/lamp/vase/statue/...）+ 12 大类词 + 材质/风格/状态常见词（wood/metal/brass/vintage/old/worn/rusted/...），约 120–150 词；未命中词原样保留进 tags（英文词本身也是检索语料）
- **下载细节**：files API `https://api.polyhaven.com/files/<id>`，取 `gltf["2k"]` 档（主 gltf url+md5 / include 中 bin+textures 各带 size+md5）；dl.polyhaven.org 无鉴权直接 GET；逐资产顺序下载（礼貌限速，不并发轰击）；md5 用 node:crypto

**fetch-polyhaven.mjs 结构（对齐既有脚本风格）**：
1. `selectAssets(models, quota)`：候选池过滤 → 次类别回退归一 → 配额分配（floor+余量按 top download_count 补齐）→ 类内 download_count 降序 → 每类产出「正选 + 候补队列」（预检剔除时类内顺位递补，§4.16.1 第 5 条）
2. `fetchAsset(id)`：files API 查询 → 逐文件下载（.gltf/.bin/textures/*.jpg）落 `.tmp-polyhaven/fetch/<id>/` → 全量 md5 校验 → 返回 gltf json
3. `mergeToGlb(dir)`：§4.16.2 六步合并（读 gltf json → 断言 extensionsRequired 空 → bin 前贴图后拼 BIN 块 4 对齐 → 重写 json bufferView 引用 → 12B 头+JSON chunk+BIN chunk）
4. `buildEntry(id, meta, glb)`：中文三件套（§4.16.3：id 小写/英文 name/中文 category/字典翻译 tags/英文 description/英文 search_text）
5. CLI：`node fetch-polyhaven.mjs [--cache <dir>] [--quota 108] [--out <zip>] [--resume] [--dry-run]`；`--dry-run` 只跑 selectAssets 打印精选名单（含各类配额/候选数/剔除原因预演），不下载
6. 产出：`manifest.json`（meta: version/source/license CC0）+ zip 打包（writeZip）

**PH checklist 执行序**（§4.7 批次 PH 已有 PH.1–PH.5，本节细化）：
- PH.1 脚本 + 单元自检：--dry-run 跑通（配额分布与推演一致）+ 用探针目录 4 资产（.tmp-polyhaven/probe/）实测 mergeToGlb 产出过 validate-model（ArmChair/tea_set/CoffeeCart 应 PASS，wine_bottles 贴图 13 应 FAIL 即预检逻辑验证）
- PH.2 全量下载 108 资产 → manifest 产出 → 用户评审中文 tags/category
- PH.3 import-assets 入库（预检剔除数/入库数/体量如实打印）
- PH.4 gates 用例 37 语义化 + 全量复验
- PH.5 中文检索抽查（椅子/桌子/灯具/植物/岩石 → 对应类别 top-3）


## 5. Execute Log
- Plan Approved：2026-09-30（用户指令"plan approved"）。状态 [ACTIVE]，进入 Execute。
- **Spec 评审（review_spec）2026-10-08 完成**：GO with conditions。P1 四项 / P2 七项 / P3 七项，详见 §4.8 评审记录 1。
- **评审决议全部落定（2026-10-08）**：R1-1～R1-4、R2-3/R2-4/R2-7 逐项裁决完毕（§4.8 评审决议）。评审后用户三轮深挖 scene-data 定位与材质归属，裁决**数据结构 v3**（§4.9）：key:Array 单一结构、数据无材质（四层归位）、卡片内联、资产双形态、编辑器视觉层剥离转录。新增批次 R（9 原子项）置于批次 2 之前。**下一动作：执行批次 R**。
- **组件库接入机制终裁（2026-10-09）**：用户提出"skill 导出给所有用户，别人机器上没有 3d-components 文件夹"——原方案"外部路径引用 + 读源码"不成立。经三轮收敛（npm 私仓形态 → 验证期临时方案 → 文档格式与作者协议），裁决：tarball + file: 依赖（发 npm 后零迁移）、LLM 文档两级 md（catalog 常驻 + 用法页按需，源码零读取）、TSDoc 单一真相源脚本生成、作者协议 + TSDoc 缺失门禁。源码可见/JSON 格式被否。**新增批次 C（5 原子项）置于批次 R 之前**，checklist 5.4 由批次 C 接管。跨仓库执行授权：用户明示"读和写都同意，不必问我"。见 §3 Decision 增补、§4.7 批次 C。
- **批次 C 完成（2026-10-09）**：C.1–C.5 全部落地并验证通过（详见 §4.7 批次 C 执行记录）。附带修复源仓存量构建链断裂（tsconfig 拆分丢配置 → d.ts 空壳），d.ts 295KB 真实声明恢复。skill 新增 vendor/a3d-a3d-components-0.1.0.tgz（0 map、22 d.ts）+ scripts/sync-components.mjs + references/component-catalog.md + references/component-docs/ 26 页。源仓 9 文件改动未提交（提交时机用户自决）。**下一动作：批次 R**。
- **批次 R 完成（2026-10-09）**：R.1–R.9 全部落地并四道门禁全绿（vue-tsc / build / eslint 0 errors / headless 冒烟 SMOKE PASS——S1 v3 starter 渲染 4 物体三分组、S2 卡片 DOM、S3 update 片段幂等 upsert+remove、S4 applyState 贴图换装 map 已指 example.jpg、S5 serialize 分组字典完整含 cars）。执行中用户打断质询 scene-data.json params 出现 castShadow/receiveShadow（违反 v3 核心"数据只有业务属性"）——确认有效，全链路修正：params 净化 + 阴影默认值归 handler 代码（applyShadowDefaults）+ 编辑器开关统一走 __visuals（VisualOverride 扩 castShadow/receiveShadow/visible），见 Plan-Execution Diff #16。新增 scripts/smoke-r.mjs 冒烟设施（Node ≥22 原生 WebSocket 连 CDP，无 puppeteer 依赖）。
- **批次 R 复审修复完成（2026-10-09，同日）**：review agent 全量 24 文件 correctness 审查，1 P0 + 3 P1 + 8 P2 + 4 P3 全部定位；P0/P1/P2 与 P3 快赢项全部修复，2 项 P3 记录在案（重喂名单硬编码、贴图 promise 静默丢失）。核心教训：原地更新路径是系统性盲区（create 路径过冒烟、update 路径无人对照契约验证）。四道门禁 + 双模式冒烟全绿，S6 新增 P0 回归断言。见 Plan-Execution Diff #17。**下一动作：批次 2（资产管线），批间停等确认**。
- **批次 M 立项（2026-10-09）**：用户提出材质编辑器需求（选中物体编辑材质：Lambert/Standard/Physical 三类型切换、贴图编辑、材质库复用，参照 Spline 材质面板 + three.js 材质属性清单）。对照实装 three@0.185.1（template/node_modules @types .d.ts + three.core.js 构造源码，非记忆转述）校正清单：三处结构性错误（normalMap/bumpMap/alphaMap 等为三材质共有非 Standard 特有；aoMap/lightMap 非 Lambert 特有且 Lambert 有 envMapIntensity；Physical reflectivity 是 ior 派生 getter 不做独立控件）+ 补漏（dispersion r169+/alphaTest/fog/vertexColors/iridescenceThicknessRange）+ 修正（ior 上限 2.333 非 2.5；anisotropyRotation 默认 0；色彩空间三分桶非两分——lightMap/envMap 属 LinearSRGB）。五项裁决（用户"都按你推荐的来"）：①批次 2 后插入 ②库共享热更 ③vite dev middleware 上传 ④内置 4 种子材质 ⑤全量参数+分组折叠。契约落 §4.10（数据契约/参数契约/色彩空间/运行时/面板/交付转录/陷阱），checklist 落 §4.7 批次 M（M.1–M.7），批次 3.2 剥离范围扩 __materialLib，§4.9.2 保留 key 全集同步。**执行序：批次 2 → 批次 M → 批次 3**。
- **批次 T 立项（2026-10-09，待用户评审）**：用户提出场景树仿 Spline（子节点展开、搜索、显隐、锁定解锁，附 Spline 场景面板 DOM 作参照）。现状核实：OutlineTree.vue 平铺列表无四能力；SceneNode.parentId 数据层已支持层级；__visuals.visible 现成（R.6）；locked 需新增。契约落 §4.11（数据现状/交互契约/否决项/边界），checklist 落 §4.7 批次 T（T.1–T.6：树化/搜索/eye/lock/锁定过滤接线/冒烟）。插序建议 T → 2 → M → 3（编辑器验收节奏连续，与资产管线零耦合，规模小单会话可闭环）。**等待用户评审**。
- **批次 T 评审通过（2026-10-09）**：用户裁决「可以的，按你排的顺序来」——插序 T → 2 → M → 3 置顶执行，契约无异议。**执行刹车（同日）**：进入 Execute 前用户澄清——批次 R（scene-data v3）尚在用户侧代码 review 中，批次 T 不得抢跑；执行序：**R 收口 → T → 2 → M → 3**。批次 T checklist 零代码改动，契约/checklist 保持立项状态待 R 收口后执行。
- 编辑器交互详细设计决议：推迟到批次 1.6 执行前，对照 Spline 逐项定交互，方案过用户确认后落 Spec 再写代码（用户 2026-09-30 裁决"到达该章节后再详细设计"）
- **编辑器交互设计 v1.1 已确认（2026-09-30 用户"可以的。确认了"）**：功能=点选高亮/Gizmo 变换（G/R/S，TransformControls）/属性面板七分区/物体树（点选定位+双击聚焦）/物体增删复制（图元菜单+Del+Ctrl+D）/保存（Ctrl+S）/F 聚焦/撤销重做（快照栈 Ctrl+Z/Ctrl+Shift+Z）/Shift 多选/对齐分布（Align：选轴+菜单=对齐|居中|最小|最大，基准=最后选中；Distribute：选轴 ≥3 物体等距）/吸附开关（TransformControls 原生 snap 参数）。布局=顶工具条+左物体树 240px+右属性面板 280px，深色工具风，纯 Vue 不引 UI 库。对齐/分布最初被误裁为"不做"，用户纠正（成百上千物体下是刚需）后并入 v1；吸附原拟推迟 v2，讨论中明确"吸附=过程磁吸（便宜）/对齐=结果整理（自研几何计算）"分工后一并进 v1。维持不做（架构理由）：事件编排/动画时间线/物理/变量——属 handler 业务层，编辑器只管"长什么样"不管"做什么"。文件八件：Bridge/SelectionService/LayoutGizmo/PropertyPanel/OutlineTree/Toolbar/SaveService/AlignmentService
- 批次间停等确认（4.7 批次划分约定）
- **用户验收反馈（2026-09-30，批次 1 交付后）**：「感觉做的很粗糙」，四缺陷：① 卡片锁死左上角不跟随 3D 物体；② 属性面板要点"应用"才生效；③ 进编辑态后 3D 场景变形（无 resize）；④ 样式丑，要求参考 Spline。全部确认有效，见 Plan-Execution Diff #9
- **用户验收反馈第二轮（2026-10-08，修复复验后）**：三项：① 选中物体要显示包围盒，且移/转/缩时实时跟随；② 工具栏全铺开太丑，参考 Spline 设计；③ 面板可调参数太少，对照 `D:\cyc\project\octo\test\3d-templete` 补齐。全部实现并冒烟验证，见 Plan-Execution Diff #10
- **用户验收反馈第三轮（2026-10-08）**：五项：① 只有平移，旋转和缩放都不起作用了（回归）；② 控制器参数调了没反应（阻尼/自动环绕，且"自动环绕"应叫"自动旋转"）；③ 删除带卡片的物体，卡片没有一起删除；④ 灯光类型没有补全，且不要自起名（sun/fill 被点名）——three.js 里是什么就叫什么，不同灯光要有不同配置项，调灯要有辅助线；⑤ 相机没有透视/正交切换，没有 lookAt、position 调整。**命名纪律确立：UI 与数据一律用 three.js 原生类型名（DirectionalLight/PointLight/...），禁止自造名**。全部修复并冒烟验证，见 Plan-Execution Diff #11
- **用户验收反馈第四轮（2026-10-08）**：三项：① 关闭阻尼后惯性仍在（用户原话"我关闭了阻尼，阻尼效果还是在"）；② 希望灯光辅助线也可以控制开和关；③ 阴影没有生效。全部修复，见 Plan-Execution Diff #12
- **用户验收反馈第五轮（2026-10-08）**：两项：① 阻尼关了以后旋转和平移确实没有阻尼效果了，但缩放还有；② 阴影有点断裂，每个灯是否开启阴影也想要有个开关决定显示与否，如果开启了，阴影参数也开出来调。全部修复，见 Plan-Execution Diff #13
- **命名纪律修正（2026-10-08）**：用户质询 shadowCameraExtent 非原生参数（自造折叠语法糖，违反命名纪律），裁决方案 1 拆为原生四字段 shadowCameraLeft/Right/Top/Bottom。已全链路替换并四项冒烟 PASS，见 Plan-Execution Diff #14
- **命名纪律全量迁移 + 面板 Tab 拆分（2026-10-08）**：用户指令「1. 其他地方还有无类似的问题，有的话请修改 2. 物体自己的面板跟场景灯光这种公共的面板拆开吧」。全量审计出 4 处数据层遗留缩写（LightConfig.type 六值/CameraConfig.type 两值/ControlsConfig.type/SceneObjectNode.primitive 六值）+ 1 处布尔折叠（MaterialOverride.doubleSide），用户裁决全修 + 拆分选方案 A（Tab 双页签）。已全部实现，见 Plan-Execution Diff #15

- **批次 2 完成（2026-10-09）**：2.1–2.5 全部落地。skill 新增 scripts/{validate-model,import-assets,build-search-index,search-assets}.mjs（零依赖）；assets/ 库落种子（models/example.glb+rack.glb、manifests/seed-package.json、search-index.json）；samples/{seed-manifest.json,seed-package.zip} 样例包。**门禁分级裁决**（用户选「分级门禁」）：性能类硬阻断、约定类（命名/原点/高度）默认告警 + `--strict` 升阻断——因两个种子（Damaged Helmet 15452 面 / Sketchfab rack）系统性违反命名+原点约定，且 example 性能也超 §4.2 原默认。证据：种子默认档 PASS（约定告警）、`--strict` FAIL；导入全链跑通（校验→门禁→落库→索引→冒烟 PASS）；8 项负面测试全部按期望退出码（坏 GLB strict 门禁 / 非模型文件 exit2 / 缺失文件 / states 缺 key / 非法 id / 跨包重复 id / art 告警放行 / 合规 strict 通过）；中文查询命中种子（机柜/服务器→rack、头盔→example）。零依赖自研 ZIP 读写往返字节一致。**下一动作：批次 M（材质编辑器 + 材质库，§4.10）**。
- **批次 M 完成（2026-10-09，同日）**：M.1–M.7 全部落地，四道门禁全绿（vue-tsc / build（edit-main 独立 chunk 92.83 kB gzip 24.44，隔离保持）/ eslint 0 errors / headless 冒烟 SMOKE PASS S1–S14）。新增 `edit/MaterialLibService.ts`（库 CRUD + 共享实例热更 + 引用追踪 + 4 种子）；core 侧 materials.ts 扩 `createMaterialFromSpec`/`applyMaterialTextures`/`migrateMaterialSpec`（内联材质统一走规格工厂＝支持三类型切换）；SceneEngine 材质库存储（对称 __visuals）+ `replaceVisual`；vite dev middleware 贴图上传；PropertyPanel 材质分区改造（库下拉/类型/参数分组折叠/贴图槽/上传）；smoke-r.mjs 增 S7–S14。INTEGRATION_GUIDE §6 重写 + §6.1 libraryMaterials。执行偏差见 §7 #19（D4 内联材质重构副作用、replaceVisual/__gts3dEdit 新增、S14 补充）。**下一动作：批次 T（场景树 Spline 化，§4.11，尚未执行）或批次 3（构建门禁+双模式交付，3.2 strip-edit 消费 __materialLib 的依赖已就绪），批间停等确认**。
- **批次 T 完成（2026-10-09）**：T.1–T.6 全部落地，四道门禁全绿（vue-tsc / build / eslint 0 errors / headless 冒烟 SMOKE PASS S1–S21）。OutlineTree.vue 全量重写：分组可折叠根（chevron + 类型图标 + 计数）+ 组内 parentId 嵌套（跨分组子随父分区、孤儿挂根级 warn）+ 搜索行（id 子串命中 + 祖先链自动展开 + 空态）+ 行内 eye/lock 按钮（写 __visuals，undo 可恢复，点击不冒泡为选区，祖先隐藏呈继承态 + tooltip）；VisualOverride 扩 `locked`；锁定过滤三处接线（handle.pick 增可选谓词 → SelectionService 传入 `!locked`；LayoutGizmo 锁定则 detach）。smoke-r.mjs 增 S18–S21（树层级 / 搜索 / 显隐落库 / 锁定拾取跳过）。执行偏差见 §7 #20。**下一动作：批次 3（构建门禁 + 双模式交付，3.2 strip-edit 消费 __materialLib 依赖已就绪），批间停等确认**。
- **D4 修订轮完成（2026-10-09/10，用户质询驱动）**：初版「内联材质字段存在即经工厂重建」被用户质询否决（GLB 改金属度丢原贴图、图元丢默认色）→ 定案双路径：同类型 clone+打补丁 / 跨类型工厂重建+inheritTextures 继承兼容贴图槽；配套 seedMaterialType 类型种子 + 面板种子接线。冒烟增 S15–S17 三断言。详见 §7 #19 D4 定案。
- **REVIEW EXECUTE 完成（2026-10-10，评审记录 5 §6）**：批次 M + 批次 T + D4 修订轮三轴评审。Overall Verdict: **PASS**——14 检查项：12 PASS + 1 已修（loadMaterialSpec 丢字段，review 中发现并当场修复复验）+ 1 PARTIAL（三项已知边界：GLB 异步窗口种子回退 / 滑杆 clone GC churn / saveAs 空规格条目，均低频低损不阻塞，批次 5 顺手评估）。四道门禁全量复跑 SMOKE PASS S1–S21。**下一动作：批次 3（构建门禁 + 双模式交付），批间停等确认**。
- **REVIEW EXECUTE 完成（2026-10-10，评审记录 6 §6）**：批次 3 三轴评审。Overall Verdict: **CONDITIONAL PASS**——15 检查项：9 PASS + 1 PARTIAL + 5 FAIL（P0 strip-edit `--out`==源自毁源工程【实测复现：rmSync 先清空源再 ERR_FS_CP_EINVAL crash】/ P1×3【铁律 2 相对路径旁路、裸模块前缀未锚定放行 vue-router 类、未来 `__` 键泄漏——第 5 项主评与评审 agent 双源确认】/ S29 模板侧真缺陷【R10 落地的 applyVisibility 走 element.style 通道被 three CSS2DRenderer 每帧覆写（0.185 源码 :232），onCardState 状态机正确但 DOM 从不跟随；修复方向 anchor.visible 通道】）+ P2×6/P3×4 记录在案。**修复门：P0+P1×3+S29 修完并复验（gates 全量 + --edit SMOKE S29 true + 新负面用例落 gates）批次 3 才算 PASS**。评审方法沉淀：双通道显隐（业务态 vs 渲染器管理态）是 CSS2D 卡片系统结构性陷阱。
- **批次 3 修复轮完成（2026-10-10，用户裁决「可以的，修复吧」）**：P0 + P1×3 + S29 + P2×5 全部修复，详见 §7 #27。复验全绿：**gates 40/40（--with-build 41/41）** + vue-tsc/build（edit-main 100.63 kB 独立 chunk 隔离保持）/eslint 0 errors/**SMOKE PASS 29/29（S29 全 true）**；gates 扩容 31→40 用例（白名单边界/相对路径旁路/NaN 校验/未来键/P0 守卫/族剥离）。评审记录 6 修复门达成，Overall Verdict 升 **PASS**。P3×4 记录在案（批次 5 顺手）。**下一动作：批次 4（验证回路），批间停等确认**。
- **批次 MU + 批次 M2 立项（2026-10-10，材质 UI/交互重设计）**：用户对材质分区不满意（「另存为」「断开链接」「未入库」术语看不懂），经 Spline 官方文档（docs.spline.design materials-shading 六页）+ 三组官方界面 DOM（材质面板/材质素材弹层/编辑材质球弹窗）+ person.glb 完整操作链核实后定案：**批次 MU**（§4.12，材质库 UI 重做——Spline 心智模型：材质即资产/默认零术语/换=槽重指向/调参=全使用者同步；「复制材质」替代「断开链接」；改名即入库；内置材质可删不复活）+ **批次 M2**（§4.13，GLB 子节点与多材质——方案 A 单场景节点+slots 槽位层；方案 B 内部子节点提升为场景节点已否决）。**执行序修订：MU → M2 → 4 → 5**（原"4 在 MU 前"唯一顾虑 smoke-r.mjs 并行冲突随批次 3 收口消失；MU+M2 连做上下文连贯）。数据契约零改动（MU）/最小扩展（M2 仅 slots 嵌套层）。**下一动作：批次 MU，批间停等确认**。
- **批次 3 完成（2026-10-10）**：3.1–3.3 全部落地，`scripts/verify/gates.mjs` 复跑设施 32/32 PASS（含 `--with-build` 端到端：小写盘符目标目录 + `--deps copy` + 首次 `npm run build` PASS）。新产三点：① build.mjs 结构扫描 + 三条铁律 + import 白名单 + 场景预算静态估算（calls≤400/三角面≤1M/材质≤32，可 CLI 覆盖）；② strip-edit.mjs 剔除 edit 世界 + 剥离 `__visuals`/`__materialLib` + 生成 TRANSCRIPTION.md 三类表（物体视觉 override / 被引用材质库条目 / 库引用表）+ 对产物跑 `--stripped` 自检；③ init.mjs 母版复制 + 占位替换 + 资产按引用|全部注入 + 可选组件库 file: 依赖 + 首次门禁（+ `--deps copy|install` 时跑 npm run build）。**验证中发现并修复 2 处实缺陷**（均属"只在特定环境暴露"类，见 §7 #24）：Windows 下 spawn 子进程 cwd 含手打小写盘符时 Vite html-proxy 键错配致构建失败（修：spawn 前 `realpathSync.native` 规范盘符/大小写，回退盘符大写）；build.mjs 自带三角面计数器与 validate-model 分叉（漏 mode 5/6 条带扇面）→ 改为共用 validate-model 的 `reachableNodes`/`primitiveTriangles`（build.mjs 的反面副作用是 validate-model 补两个 export，语义未变）。**待办提请**：三个脚本 + validate-model 的头部注释含 `Spec §4.x`/`R1-3` 类文档指引，与"代码注释不写指向文档的指引"的既定规则相抵（§7 #24 记录在案，未擅自改动已收口批次 2 文件，待裁决）。**下一动作：批次 4（验证回路），批间停等确认**。
- **批次 MU 完成（2026-10-10，用户「开始批次 MU」→ 单步 MU.1–MU.3 →「全部」跑完 MU.4–MU.8）**：八项全落地（MU.1 MaterialParams 抽取 / MU.2 MaterialSection / MU.3 MaterialPalette / MU.4 EditMaterialModal / MU.5 seeds 门控 / MU.6 editor.css 共享弹层原语 / MU.7 smoke S30–S33 / MU.8 门禁）。三绿全绿（edit-main 独立 chunk 109.00 kB，隔离保持）+ **SMOKE PASS 33/33**；全程四组一次性 CDP DOM 探针（MU.2 分区 / MU.3 弹层 / MU.4 弹窗）各自 PROBE PASS（不入库、验完删除）。**执行中修复 1 处批次 M 遗留实缺陷**：`MaterialLibService.removeEntry` 合并写内联致 `libraryRef` 残留（违约 §4.10.4），改用 `replaceVisual` 覆盖式。见 §7 #28。**执行序 MU → M2 → 4 → 5，下一动作批次 M2（GLB 子节点与多材质，§4.13），批间停等确认**。
- **批次 MU2 立项（2026-10-10，MU.8 用户验收反馈驱动）**：用户对照 Spline 官方界面指出——材质面板应**右侧浮出**（浮动面板：无全屏遮罩、可拖拽、不挡场景）、材质素材与编辑材质球**并排不重叠**、材质列表**一材质一行**；MU 落地的「居中+全屏遮罩对话框」（.ed-overlay/.ed-dialog）不符。契约落 §4.14，checklist 落 §4.7 批次 MU2（MU2.1–MU2.8）。**执行序修订：MU → MU2 → M2 → 4 → 5，下一动作批次 MU2，待批准**。
- **批次 MU2 完成（2026-10-10，用户「全部」批内连跑）**：MU2.1–MU2.8 全落地（FloatingPanel 浮动外壳 + FloatingDock 停靠 + 两面板换壳 + 内置一材质一行 + editor.css 删居中遮罩原语 + 冒烟 S34–S35）。三绿 + **SMOKE PASS 35/35** + Teleport/拖拽探针 PROBE PASS。关键实现：`<Teleport to=".edit-scope">` 规避右栏 backdrop-filter 的 containing-block 陷阱。见 §7 #29。**REVIEW EXECUTE 完成（2026-10-10，评审记录 7 §6）**：批次 MU + MU2 三轴评审，Overall Verdict: **PASS**（12 检查项：10 PASS + 1 偏差已记档（样式落位 FloatingPanel scoped 而非 editor.css）+ 1 PARTIAL（浮动面板边界缺口，P3×4 挂账批次 5：dock 位置不随 resize 重算 / 拖拽无边界钳制 / 删除确认态点行仍应用 / 无选中点条目仍关面板））；四道门禁 + 冒烟全量复跑 SMOKE 35/35。**下一动作批次 M2（GLB 子节点与多材质，§4.13），批间停等确认**。
- **批次 MU3 立项（2026-10-10，MU2 用户验收三项反馈驱动）**：① 整体浅色主题（参考 Spline，现状全套深色；范围含二开态 index.html/App.vue/ExampleCard）；② 浮动面板叠在右栏固定面板上（几何实测：defaultDockPos 算出的 x 与右栏区间重叠——MU2 只避让浮动面板间，漏了固定面板）；③ 材质分区收拢（属性面板只留条目行，点条目开「编辑材质球」——Spline 的 AssetItem→MaterialAssetModal 模式；用户贴 .ms__entry DOM 确认）。契约落 §4.15（浅色令牌表 / 避让算法 / 收拢交互），checklist 落 §4.7 批次 MU3（MU3.1–MU3.7）。**执行序修订：MU → MU2 → MU3 → M2 → 4 → 5，下一动作批次 MU3，待批准**。
- **批次 MU3 完成（2026-10-10，用户「全部」批内连跑）**：MU3.1–MU3.7 全落地（浅色令牌 + 二开态同步 / FloatingDock 避让固定面板 / MaterialSection 收拢 + 点条目开编辑 / EditMaterialModal 双模式 / 冒烟 S36–S38）。三绿 + **SMOKE PASS 38/38**。S38 踩两断言坑（Group 须 traverse 取 mesh、GLB 异步窗口须轮询；合并语义残留第三次撞见——UI 真实路径 replaceVisual 无此问题）。人工视觉走查待用户。**下一动作批次 M2（GLB 子节点与多材质，§4.13），批间停等确认**。
- **批次 MU4 立项（2026-10-10，用户 Spline 实测困惑 + 属性面板完整 DOM 解码驱动）**：用户实测「点材质有时弹编辑球有时不弹」「两面板有时互斥有时共存」+「编辑面板离属性面板很远」。DOM 解码定案 Spline 真实交互：材质分区是 AssetItem 列表（多材质 GLB 每槽一条，untitledasset/appliedasset 两态）；面板头 ⊞/条目 ⊞/＋ 三入口全开 palette（条目 ⊞ 带 uuid 锚定）；编辑球是 palette 二级子面板（贴着 palette，palette 关则关——「互斥」实为父子）；条目本体点击无反应。**裁决（融合）**：① 条目行加 ⊞ 直达素材库（点行=编辑、点⊞=换，两入口各一）；② 编辑面板 dock 感知 paletteOpen（palette 开→紧贴其左，关→右栏避让位）；**不抄**：三入口冗余、条目点击无反应、palette→编辑球父子强制。契约落 §4.15.5，checklist 落 §4.7 批次 MU4（MU4.1–MU4.4）。**执行序修订：MU → MU2 → MU3 → MU4 → M2 → 4 → 5，下一动作批次 MU4，待批准**。
- **批次 MU4 完成（2026-10-10，用户「全部」批内连跑）**：MU4.1–MU4.4 全落地（条目 ⊞ 直达素材库 + 编辑面板 dock 感知 paletteOpen 紧贴/退避 + 冒烟 S39）。三绿 + **SMOKE PASS 39/39**。S39 初版断言两处口径错（边框未计/排序取反，实装正确经 rect 诊断证实）。人工视觉走查待用户。**下一动作批次 M2（GLB 子节点与多材质，§4.13），批间停等确认**。
- **批次 M2 完成（2026-10-10/11，用户裁决批内连跑）**：M2.1–M2.8 全落地（ModelSpecReport.meshes / listSubMeshes+resolveSubMesh+槽级 applyVisualOverride / OutlineTree 子网格层 / MaterialSection 列表化+槽位聚焦 / applySlotLink+syncAll 槽位重挂 / strip-edit ①′ 槽位表+GUIDE §6.2 / S40–S44 / gates 40/40）。**执行中发现并修复三大缺口**：① **Draco 支持**（person.glb Draco 压缩暴露 GLTFLoader 裸奔——真实世界 GLB 主流压缩格式；修：DRACOLoader + decoder 随模板 vendor `public/assets/draco/` 零 CDN）；② **槽位 key 双口径**（buildReport 从 GLB 内部根起算 vs resolveSubMesh 含容器名——三处对齐修复 + applyVisual 的 slots 增量必须走 full）；③ **单 mesh 回落**（槽位列表误伤单 mesh GLB 的 inline 编辑路径）。验收素材 person 入库（art 档超限人工放行，deviations 记录）。三绿 + **SMOKE PASS 44/44** + **gates 40/40**。**下一动作 REVIEW EXECUTE（MU3 + MU4 + M2 合并三轴评审，用户裁决攒评）**。
- **REVIEW EXECUTE 完成（2026-10-12，评审记录 8 §6）**：批次 MU3 + MU4 + M2 + 修复轮 1–5 + **M3（评审时发现代码已落码但未回写 spec，一并纳入）** 三轴评审。Overall Verdict: **CONDITIONAL PASS**——12 检查项：9 PASS + 2 FAIL（同一 P1：M3 undo 后 slots transform 运行时丢失——examples 工厂 GLB 异步加载后不重挂视觉层，数据层正确但活 mesh 位置未恢复；`asset` 工厂有 applyVisualIfAny 而 examples 只调 applyStatusVisual）+ 1 排除断言侧（S46 RPC 超时为长会话累积态问题，探针独立跑通）。复跑：三绿 + gates 40/40 + SMOKE 45/45（S46 未完成判定，探针分段覆盖六段 true / meshAfterUndo false = P1）。**M3 执行记录已补写（Reverse Sync 欠账清偿）**。
- **M3 P1 修复轮完成（2026-10-12 同日，用户裁决超出修法 a/b——「改彻底：不打补丁，收敛为唯一实现」，Plan Approved 批内连跑 R1–R5）**：`makeAssetNodeFactory` 唯一异步 GLB 构建器落地（registry.ts：过期守卫身份比对 + 阴影默认 + 视觉层重挂 + onLoaded 业务回调集中一处；example.ts 瘦身纯业务化 −40 行删 makeAssetNode/loadTokens；二开范式升级）；顺带治好 `asset` 工厂孤儿泄漏（原无过期守卫）。smoke RPC 超时 20s→40s + **新增 S47 回灌窗口视觉存活断言** + S46 断言侧修正（undo 后旧 mesh 引用失联，改重新 traverse + 轮询）。修复中两轮探针定位：第一轮证 undo 后 mesh 是新实例且位置 0（数据层正确）；第二轮证单次 undo 后 meshXAfterWait=0.5 即时生效（构建器重挂工作，产品链路本已正确——S46 FAIL 实为断言旧引用缺陷）。复验：三绿（edit-main 124.53 kB 隔离保持）/ **SMOKE PASS 47/47** / **gates 40/40**。**评审记录 8 升 PASS（修复闭环）**。

- **修复轮七完成 + 补丁收口（2026-10-13）**：主轮（占位盒 A 案 + scene-core 内置徽标 + S49，SMOKE 52 段全绿 + gates 40/40 + 三绿）→ 用户复测反馈「盒子看不到」→ 探针定案（首载报告缓存恒空永无盒 + 资产缓存后盒闪过价值窗口≈0）→ **用户裁决撤除占位盒，保留 N/M 徽标**（模型附议：四文件补救成本不对称）→ 补丁执行（删盒 + 顺手修两真 bug：计数器闭包串组→模块级共享、S49 快照时序）→ **用户浏览器人工验收通过**。**同步落「验证策略修订」**：模型三绿 + 人工验证清单交付，用户目检验收；冒烟只在数据层改动/收口 Review/用户要求三类时点跑；无头环境预检不过直接转人工；分段参数 `--only/--from` 批次 4 落地。详见 §7 修复轮七补丁区块。
- **批次 PH 完成（2026-10-13，并行会话）**：fetch-polyhaven.mjs 落地（配额/名单双模式 + 1k/2k 档 + --resume + TAG_ZH 字典）→ 56 资产 122.4MB 入库（polyhaven-seed，art 档全过，modular_pipes 预检剔除）→ gates 用例 37 语义化 40/40 → 中文检索 14/14。详见 §4.7 批次 PH 执行记录。
- **评审记录 9（2026-10-13，修复轮七+补丁 × 批次 PH 合并三轴评审）：Overall Verdict PASS**——11 检查项（10 PASS + 1 FIXED 注释卫生顺手修）+ 挂账 3 项（P2 补丁后全量冒烟批次 4 强制复跑 / P3 wheelchair_01 无中文 tag / P2 存量 S52④ dev 专属路径）。gates 合并基线实跑 40/40。详见 §6 评审记录 9。**下一动作：批次 4（验证回路 §4.7 四脚本 + 分段冒烟参数 --only/--from + 强制全量复跑）→ 批次 5（skill 大脑+收尾，P3 挂账清点）**。
- **Blender 通道剔除补录（2026-10-13）**：2026-10-12 用户裁决「blender完全从这个skill里剔除出去吧」当时未落 Spec（Reverse Sync 欠账，取证过程见 §8.1），本日补录——降级阶梯五层→四层、批次 5.1 install-blender.mjs 取消、批次 4.4 ensure-env 砍 Blender 探测、modeling-channels.md 缩为单通道、本机 `~/.gts3d/blender/` 已清理。**批次 4 起按无 Blender 范围执行。**
- **批次 4 完成（2026-10-13，用户「开始执行，全部」批内连跑）**：4.1–4.4 四脚本 + smoke-r 分段参数 + S52④ 修复 + 强制全量冒烟复跑 + §8.2 R1-3 修订捎话改造（perf-fps WARN/--strict、build.mjs 预算 warnings、gates 用例一拆二 40→41）全部落地。验证证据：STRUCT PASS×2 / VISUAL PASS / PERF OK / smoke-r S1–S51 全量 + S52 分段全 true（全量跑 S52 处 RPC 超时为长链路 CDP 累积态环境噪声，同修复轮七）/ gates 41/41 / 三绿。挂账 P2 两项（补丁后全量冒烟 + S52④ dev 路径）收口；P3 wheelchair_01 中文 tag 仍挂（批次 5 清点）。详见 §4.7 批次 4 执行记录。**REVIEW EXECUTE 完成（2026-10-13，评审记录 10 §6）：Overall Verdict PASS**——10 检查项（8 PASS + 2 FIXED P2 判据缺陷评审发现当场修：smoke-visual focusId 判据 userData.assetGlb 零存在恒走兜底→改 listSubMeshes、smoke-structural 404 豁免正则过宽吞掉资产缺失硬 FAIL→收窄 favicon+无 URL 文本）+ 2 处 P3 卫生顺手修（isTarget 死代码、FROM 硬编码 52）。**下一动作：批次 5（skill 大脑 + 收尾），批间停等确认。**

- **批次 5 开工（2026-10-13，新会话 Research 完成，待用户确认开工序）**：
  - **基线核查（本会话实跑）**：build PASS（calls=12/tris=98,914/材质=4 全在预算）/ gates **41/41** / vue-tsc 0 / eslint **1 error**（smoke-r.mjs:93 lines-around-comment——批次 4「isTarget 死代码删除」顺手修时留下的孤儿注释紧贴 `};`，属引入回归，基线应为 0 errors）/ ensure-env 三态 PASS（node 24.16.0 / three 声明+实装 0.185.1 / 多模态 CLI 覆盖验证）/ 检索抽查（椅子→outdoor_table_chair_set_01 / 监控摄像头→security_camera_01 / 机柜→rack / 轮椅→miss 证实 P3 挂账仍在）。
  - **P3 挂账全量清点（跨全部评审记录扫描，任务 #5）**：① wheelchair_01 中文 tag（评审记录 9/10）；② 评审记录 7 P3×4 存活三项（①defaultDockPos 不随 resize、③删除确认态点行仍应用、④无选中点条目仍关面板——②clamp 已解决）；③ 评审记录 6 P3×4（`__lib:count` 哨兵算术/TRANSCRIPTION 转义/--deps install exit 码/gates spawn 超时）；④ 评审记录 5 PARTIAL 三边界（GLB 异步窗口种子回退/滑杆 GC churn/saveAs 空规格）；⑤ 脚本头注释 Spec 指引五处（build.mjs:32/gates.mjs:186/perf-fps.mjs:2-4/fetch-polyhaven.mjs:316/init.mjs:5，skill-output-style 规则，上批裁决未擅动）；⑥ 批次 C P3×4（oneLiner 截断等，sync-components 零触发）；⑦ R3-1 残留（template 无独立 .gitignore + package-lock resolved 外网 URL）。
  - **工作区状态**：ep-coder git 干净（仅 template/public/Untitled-1.md 未跟踪——用户反馈备忘，内容均为已处理历轮反馈，处置待用户裁决）；3d-components 源仓 9 文件未提交（用户自决）。

- **批次 5 执行记录（2026-10-13，用户指出「直接执行 spec」纠偏后批内连跑）**：
  - **5.0 eslint 回归修复**：smoke-r.mjs:93 孤儿注释删除（批次 4 顺手修引入）→ eslint **0 errors** 恢复。
  - **5.2 SKILL.md 落地**（~200 行）：frontmatter（name/description/version）+ 九步工作流表（每步 DoD 指向 scene-workflow.md）+ 四层降级阶梯（Blender 剔除版，含「禁止生成 GLB 脚本」与 mesh 具名约束）+ 七条硬约束（内网零 CDN / v3 数据纪律 / 三条铁律 / makeAssetNodeFactory 唯一构建器 / 蒙皮四边界 / 验证回路三层口径 / 人工验收优先策略）+ 命令路由表（14 命令含退出码约定）+ references 路由表（按需读，不全量载入）+ 交付话术 + 已知边界。
  - **5.3 references 六文档落地**（component-catalog.md 批次 C 已生成，共七份）：① scene-workflow.md（九步逐步指引：每步 DoD + 停止点，「必须问清清单」四项、fail-all 修复循环、S9 交付六件套）；② asset-pipeline.md（库现状表 / zip+manifest schema / 分级门禁表+理由 / Poly Haven 扩库 / 检索质量维护）；③ model-spec.md（两档规格表 + 每条规格存在理由 + 场景预算 WARN 口径 + 与降级阶梯的关系）；④ modeling-channels.md（LLM 直写单通道：简模 tree 范式 + 精模 car/worker/rack 三范式手法表（轮廓挤出/车削/材质分件/比例基准表/姿态细节）+ 命名约定 + 写法纪律六条 + 已否决方案防回潮）；⑤ verification.md（三层分类表 + 工具矩阵 + 视觉判定 8 项清单 + 验证报告模板 + 环境与策略纪律六条）；⑥ scene-engineering.md（分层禁区图 / v3 数据纪律 / handler 契约 / stateMaterials / **生产数据接入（update 片段翻译，一等公民）** / 转录机制 / 常见陷阱表七条）；⑦ eslint-notes.md（flat config 结构 / 常见报错对照 / scripts 豁免说明）。
  - **5.5 README.md 落地**：skill 定位图 / 目录结构 / 环境要求（内网镜像 URL 已指向）/ 投放四步 / 资产库三线（内置 59 / 自定义入库 / Poly Haven 扩库）/ 组件库（file: 依赖形态 + sync 流程 + 作者协议）/ 内网 npm 安装两式 / 验证设施表 / 已知边界。
  - **5.4 P3 挂账收口（修五项 + 记档关闭其余）**：
    - **① wheelchair_01 中文检索**：TAG_ZH 字典补 7 词条（wheelchair/infirmary/hospital/medical/clinic/mobilityaid/folding wheelchair）+ manifest 资产 tags/search_text 更新 + 索引重建（检索冒烟 PASS）→ 「轮椅」检索 **wheelchair_01 第 1 位 score 0.3893**（修复前 miss，top 是 sofa_03）。
    - **③ `__lib:count` 哨兵算术**：build.mjs 材质计数改直白相加 `materialKeys.size + libCount`（原哨兵+补偿 -1 绕弯写法），语义等价（复验 build PASS 材质=4 不变）。
    - **③ TRANSCRIPTION 转义**：strip-edit.mjs 新增 `mdCell()` 转义器（`|`→`\|`、反引号转义），①物体视觉表/①′槽位表/③引用表三处表格单元格全部走 mdCell——单测验证 `car|01`→`car\|01` 断列修复。
    - **⑤ 脚本头注释 Spec 指引五处全清**：build.mjs:32（R1-3→自含描述）/ gates.mjs:186（R1-3 修订（§8.2）→口径描述）/ perf-fps.mjs:2-4（R1-3/§4.5/§8.2/裁决出处→自含三层分类+「口径依据见 references/verification.md」）/ fetch-polyhaven.mjs:318（§4.16.3→四件套描述）/ init.mjs:5（R2-5→去除）。grep 复验 scripts 全目录 Spec 指引 **0 残留**。
    - **⑦ R3-1 残留**：template/ 独立 `.gitignore` 新增（node_modules/dist/.smoke-*/*.local——skill 独立投放时不再依赖 ep-coder 根 gitignore 兜底）；package-lock.json **221 处 resolved URL 全量重写** registry.npmjs.org→mirrors.tools.huawei.com/npm（内网纪律对齐 ux-prototype 先例；npm ci --dry-run 干净解析复验，integrity 哈希不受 URL 影响）。
    - **记档关闭（不修，理由）**：评审记录 7 P3 ①③④（defaultDockPos resize/删除确认态点行/无选中点条目关面板——UI 微边界低频低损，面板可拖回/重开，修复收益低于改动面）；评审记录 6 P3 --deps install exit 码与 gates spawn 超时（设施级，无实际误报案例）；评审记录 5 三边界（GLB 异步窗口种子回退/滑杆 GC churn/saveAs 空规格——低频低损既有记档）；批次 C P3×4（oneLiner 截断等，26 组件零触发）。
  - **复验（P3 改动后全量）**：gates **41/41 PASS**（--quiet 模式，含 strip-edit 转录表/预算两态/铁律全量用例——哨兵算术与转义改造零回归）。

- **5.6 端到端演练完成（2026-10-13，机房监控场景，SKILL.md 九步实测）**：
  - **场景**：「3 排×4 机柜（状态灯绿/红）+ 2 监控摄像头 + 1 工人巡检 + 点机柜弹卡片 + 告警灯变红 + 5s 模拟轮询」。产物：`D:\cyc\project\octo\gts\test\e2e-demo-serverroom`（编辑态）+ `e2e-demo-serverroom-stripped`（二开包）。
  - **九步走查**：S1 要素清单（用途/数据源/交付形态三项确认）→ S2 检索四查询全命中（机柜→rack 0.59 / 监控摄像头→security_camera_01 0.32 / 工人→person 0.25；security_camera art 档 PASS 原点偏 -0.025 摆放补偿）→ S3 分层决策（rack.glb 静态无状态灯→**升第 4 层 coderacks handler**，理由记录；worker 用 person GLB 第 1 层 + scale 0.0056）→ S4 init --deps copy 9s 出工程 + security_camera 手工拷入（见发现①）→ S5 三绿 + STRUCT PASS×2（场景图 16/16 分组对齐 Box:1/asset:3/coderacks:12）→ S6 VISUAL PASS 四截图 + 多模态看图 8 项全 PASS + PERF（calls=918 WARN）→ S7 灯色链路探针 PASS（update 片段 alarm→ff3040 / normal→2dff5e 往返验证）→ S8 无需人工调优（首版即达预期）→ S9 strip-edit 出二开包 + build --strict PASS。
  - **业务代码产出**（演练产物，验证 skill 范式可复制）：scene-data v3 三分组 + RackInfoCard/CamInfoCard 卡片 + rack.ts 扩 params.status 告警灯（onNodeUpdated 单槽串接范式——**发现②：多 handler 共存时 onNodeUpdated 需串接前驱**）+ main.ts 5s 轮询 update 片段（真实后端换 fetch 即用）。
  - **验证报告**：build PASS（calls=13/400、tris=79,700/1M、材质=5/32——**静态值**；运行时 calls=918 **WARN 回应**：12 机柜×每柜约 70 mesh 分件（coderacks 精模材质分件范式）+ person/camera GLB 摊派，软渲染 headless 下统计；属重类观测不阻塞，优化路径=机柜间共享材质实例或合并静态几何，用户未反馈卡不优化）/ STRUCT PASS×2 / VISUAL PASS（多模态看图：比例/贴地/无穿模/配色全过——worker 1.8m 与机柜 2m 比例正确）/ 灯色链路 PASS / 二开包 --strict PASS。
  - **执行中发现（SKILL.md 改进输入）**：① **init --assets referenced 不认 skill 库外手工拷贝的模型**——security_camera_01 需手工 cp 到产物工程；根因是 scene-data 写引用时资产还没进产物工程，init 的 referenced 扫描发生在 scene-data 填写前。**SKILL.md S4 已有「S2 命中资产先记录」流程覆盖，但未写「手工补拷」指引——记为 S4 文档小补**。② onNodeUpdated 单槽串接（rack.ts 演示了范式）。③ headless 探针等待 __gts3d 需轮询 7s+（一次性 sleep 会拿 undefined）——**已有 smoke 脚本模式，裸探针要复用**。
  - **流程教训（用户反馈「生产交付阶段不能这么等」）**：演练中探针三轮迭代（缺 Edge 自启动→result 双重解包→缺轮询）耗约 4 分钟，用户中断指出体验差。**定案：交付阶段的交互/UI 类验证一律走人工验证清单（URL+步骤+预期），机器探针只用于数据层断言且必须一次写对（复用 smoke-structural 的完整模式而非裸写）**——这与验证策略修订（2026-10-13）一致，本次是执行侧的再实证。
  - **卡片 DOM 验证移交人工**：rack_03 补发 always 卡片后 headless DOM 计 0——未深究（卡片 CSS2D 渲染时序），按上述定案交人工验证清单第 1 项。

  30. **批次 PH 立项（2026-10-12，Poly Haven 精选资产批量入库，Research 完成）**：
      - **任务**：写批量下载脚本，从 Poly Haven API（api.polyhaven.com，files 端点 `gltf["2k"].gltf`）拉取精选资产（面数≤50000、贴图 2k 档、glTF 格式，约 108 个 / 参考 200MB），下载后打包成 seed-package.zip 的 manifest 格式（meta+data[]），走 import-assets.mjs 入库；入库后跑 gates.mjs 复验、检索索引重建（import-assets 自带）、中文 tags 自补（API 只有英文）。
      - **数据源**：`.tmp-polyhaven/models.json`（本地全量缓存，521 模型，含 polycount/categories/tags/description/download_count/dimensions/thumbnail_url）；面数≤50k 候选 430 个。
      - **Research 探针实证**（4 模型实下载 + validate-model 门禁 + 管线源码核对）：
        - ArmChair_01（5626 面/1 节点/3 贴图）**PASS**；tea_set_01（40296/10/3）**PASS**；CoffeeCart_01（27659/3/6）**PASS**；**wine_bottles_01（28848/4/13 贴图）FAIL——「贴图张数超限: 13 > 8」**→ 不能盲选，需预检过滤
        - files API 实测：`gltf["2k"].gltf` = {url, size, md5, include{}}（bin + textures/*.jpg，各带 size/md5）；dl.polyhaven.org 直接 fetch 无鉴权；2k jpg 均过 2048 门禁
        - id 违规：Poly Haven id 如 `ArmChair_01` 违反 `^[a-z][a-z0-9_]*$`，manifest 须显式小写（`armchair_01`）
        - init.mjs 资产注入只认单文件 `models/<id>.glb|gltf`——gltf 目录形态（import-assets 落库形态）注入时报 missing；import-assets 本身支持目录形态入库
        - gates.mjs 用例 37 `init: --assets all 注入全部模型（example+person+rack）` 写死 `models.length === 3`，入库后必 FAIL（同款脆断言问题 §5 批次 2 已有先例：starter 断言改语义断言）
        - 体量：抽样 8 资产 2k 档平均 2.78MB/资产 → 108 个约 300MB（略超参考量 200MB，可接受）
      - **Open Questions（待用户裁决，裁决后进 Plan）**：① gltf 形态：(A) 下载时合并转 GLB【推荐，零依赖手写 bin 合并】/(B) gltf 目录形态先入库（检索可用，init 注入留后患）/(C) 改 init.mjs 支持目录形态（超本任务边界）；② 精选策略：download_count 降序 + 类别多样性配额 + 贴图数预检，或用户指定清单；③ 中文 tags 生成：脚本内置英文→中文映射字典（类别词+常见名词）或人工审一轮；④ category 字段：Poly Haven 原类别透传（仅 warning 不阻断）或映射到建议集 [demo/equipment/building/vegetation/vehicle]
      - checklist 落 §4.7 批次 PH（PH.1–PH.4，设计细节待 Plan）。

  31. **批次 PH 完成（2026-10-13，Plan Approved 同日批内连跑 PH.1–PH.5）**：fetch-polyhaven.mjs 落地（配额/名单双模式 + --res 1k|2k + --resume + TAG_ZH ~200 词条字典）→ 首版 2k/108 资产/565MB 产出 → 用户评审裁决瘦身（B+C：1k 档 + 57 定制名单，场景定位建筑/机房/电站/地图）→ 终版 **56 资产 / 122.4MB / 1k 档入库**（polyhaven-seed 包，art 档门禁全过，modular_pipes 节点 106>64 预检剔除）。gates 用例 37 语义化后复验 **40/40**（入库前后双跑）。中文检索抽查三轮字典迭代（场景词 26+ 补词 / id 逐词补捞 / camera 词条）后 **14/14 命中**。执行中三处前置修复：Spec §4.16.3 写入事故重写、§4.16.1 类别归一次类别回退（用户裁决）、探针目录文件名恢复。详见 §4.7 批次 PH 执行记录。**下一动作：批次 4（验证回路）或批次 5（收尾），批间停等确认**。

### 批次 1：skill 骨架 + 母版工程（2026-09-30 完成，冒烟通过）
- [x] 1.1 建 skill 目录树
- [x] 1.2 template 工程 package.json + vite/ts/eslint 配置
- [x] 1.3 scene-core/engine/ 八个引擎文件
- [x] 1.4 createScene.ts + types.ts + SceneHandle API
- [x] 1.5 handlers/registry + example handler；cards/registry + ExampleCard.vue
- [x] 1.6 edit/ 八个文件（编辑器交互 v1.1 已确认后执行）
- [x] 1.7 main.ts / edit-main.ts / index.html 双入口
- [x] 1.8 docs/INTEGRATION_GUIDE.md
- [x] 1.9 template build 通过 + 手动冒烟

**批次 1 执行记录（Reverse Sync）**：
- 版本决策：`@vue/tsconfig` 从 0.9.1 降为 `^0.8.1`（0.9.1 peer 要求 TS>=5.8，与原定 ~5.7 冲突，npm install ERESOLVE）；`typescript` 从 ~5.7 升为 `~5.9.0`（@vue/tsconfig 0.8.x 的 libReplacement 选项需 TS>=5.8，TS5023）；新增 `vue-eslint-parser ^10.4.1`（eslint tsParser 无法直接解析 SFC，6 个 .vue 文件 Parsing error；eslint.config.mjs 重构：TS 块限 `**/*.ts`，Vue SFC 独立块 vueParser 外壳 + parserOptions.parser=tsParser）
- 双模式隔离验证：vite build 产物 edit-main 独立 chunk 45.47 kB（gzip 12.76），二开态主包 729.73 kB 不含编辑器代码，物理隔离达成
- 关键契约偏差：createScene 第三参为 `cardComponents`（Vue 组件注册表 Record<string, Component>），卡片由 cards/registry 内 createApp 动态挂载——二开者只传组件映射，不碰 3D 层
- 冒烟证据（headless Edge `--use-angle=swiftshader --enable-unsafe-swiftshader`，`--disable-gpu` 下 WebGL 黑屏不可用）：① console 抓取（--enable-logging=stderr）无页面 JS 错误；② 二开态截图像素直方图：36% 纯背景 #0F151B + 64% 蓝灰着色像素（地面+图元受光照渲染），渲染成功非黑屏；③ 编辑态 `?edit=1` 截图（85KB > 二开态 49KB）确认三栏壳完整：顶工具条/左物体树 5 物体/中 3D 视口真实渲染/右属性面板
- 全链路契约核实修复 8 组缺陷（详见 Plan-Execution Diff）
- **验收修复后复验（2026-09-30）**：vue-tsc 绿 / build 绿（edit-main 仍独立 chunk 47.55 kB，隔离保持）/ eslint 0 errors；二开态像素直方图 31% 背景 + 69% 着色；编辑态截图确认：视口全屏铺底不变形、悬浮工具条+左树+右属性面板 Spline 玻璃风格、图元渲染正常。四项验收缺陷修复均有证据

## 6. Review Verdict

### 评审记录 2（2026-10-09，批次 C 代码评审，mandatory three-axis）

**评审范围**：批次 C 全部产物——sync-components.mjs 脚本、源仓 9 文件改动、生成的 26 页 component-docs + catalog、tgz。评审方式：产物全量重读 × 源仓 barrel/dist 交叉验证 × 生成物逐行抽验。

#### Review Matrix

| 轴 | 检查项 | 结论 | 证据 |
|---|---|---|---|
| Axis-1 Spec 质量 | 批次 C 目标/边界/验收可验证 | PASS | §4.7 批次 C 五项均有机器可验证验收（tgz 内容/file: 安装/tsc/门禁） |
| Axis-1 | 用户四条裁决落实（无源码/无 JSON/md 生成/作者协议） | PASS | tgz 0 src 0 map；全 md；CONTRIBUTING.md 四条协议 |
| Axis-2 Spec-Code 一致 | 目录树 vs 实际产物 | PASS | vendor/ + sync-components.mjs + 两级 md 均在 §4.1 声明位置 |
| Axis-2 | Tier-1/Tier-2 token 预算符合裁决 | PASS | catalog 26 行紧凑表；用法页按需读 |
| Axis-2 | catalog importPath 准确性 | **FAIL（P1）** | findImportPath 只解析命名导出 `export { X }`，不识别 `export * from './X'` 星号重导出——PivotControls/GizmoHelper/GizmoViewport 三个组件（controls/helper barrel 均为星号形态）静默降级到根入口 `'@a3d/a3d-components'`。根入口运行时确实可达（dist 验证 export * 链生效），**功能不坏但偏离「子域入口」最优实践**（tree-shaking 面积大），且 LLM 按此 import 与 sub-barrel 文档不一致 |
| Axis-3 代码内在质量 | 生成的 md 表格渲染 | **FAIL（P1）** | `@default` 含围栏污染：typedoc 把多行 @default（如 HtmlOptions.occlude 的 "false" 竟带 ```ts 围栏）原样注入表格单元格——`````ts` 四反引号破坏 21/26 页共 189 处单元格（Html.md 15 处、PivotControls.md 22 处、BitmapText.md 30 处…）。渲染器显示破版；根因是源码 TSDoc 的 @default 写法含 code block 语法 + 脚本未剥 |
| Axis-3 | EventDispatcher 类型修复 | PARTIAL | 行为正确（tsc 过/运行时无损），但 `as Listener<CameraControlsEventType>` 断言在 3 处（ts-eslint 警告 2 处 unnecessary-assertion 与 1 处必要断言并存）——类型签名 `Listener<T>` vs 存储类型不匹配靠断言缝合，可接受（vendored 重写件），不阻塞 |
| Axis-3 | 脚本健壮性 | PARTIAL | npm pack JSON 解析有降级链 ✓；门禁豁免名单机制 ✓；但 `require_('fs')` 与顶部 import 混用（风格）；typedoc kind 硬编码数值（注释已声明跨版本稳定，可接受） |
| Axis-3 | tgz 内容 | PASS | 0 .map / 22 .d.ts / 无 src / files 白名单生效 |
| Axis-3 | 最小工程验证 | PASS | file: 安装 + 三入口 import + strict tsc 0 错 + @ts-expect-error 证明必填校验生效 |

#### Overall Verdict: **CONDITIONAL PASS（两 P1 修复后 PASS）**

- **P1-1 importPath 星号重导出失效**：修 findImportPath——解析 `export * from './<dir>'` 后递归读子 barrel（src/controls/PivotControls/index.ts 的命名导出）；重跑 sync 修正 3 组件路径为 `/controls`、`/helper`
- **P1-2 @default 围栏污染**：脚本 defaultText() 剥围栏（同 exampleText 的 kind:'code' 处理）；**另需决策**：源码 TSDoc 的 @default 该不该写多行 code block？裁决建议——@default 只写单行值（多行说明挪进字段描述），脚本同时做剥壳兜底
- P2（不阻塞）：EventDispatcher 断言风格、require_('fs') 统一、catalog「使用纪律」节提及的未来 npm 形态句子保持
- 修复后需重跑：sync 脚本 → 26 页 + catalog 重新生成 → 抽验 3 组件 importPath + 189 处围栏清零

#### 评审记录 2 修复闭环（2026-10-09，用户裁决 a 方案：脚本剥壳 + 源码规范双保险）

- **P1-1 修复**：findImportPath 重写为 parseBarrel（named + stars 双收集）+ barrelExportsClass 递归（防环 depth≤2，星号指向目录时读其 index.ts）。**二次暴露根因**：根 src/index.ts 亦有 `export * from './controls'` 星号链，而 BARRELS 数组 index 排首位 → 修复后仍命中根入口。终修：BARRELS 改子域优先、index 兜底置末（tree-shaking 最优 + 与子域文档一致）。
- **P1-2 修复**：defaultText() 剥围栏 + 取首行。**真相修正**：typedoc 把**所有** @default（含最普通的 `0.001`）都解析为 `{kind:'code'}` 围栏块——是 typedoc 固有行为而非源码写法问题，源码 TSDoc 无需改动；脚本剥壳即全治。CONTRIBUTING 仍补"@default 单行值"规范（防多行默认值被首行截断丢信息，属真实约束）。
- **复验证据（全绿）**：① 全 26 组件 importPath 逐一核过——PivotControls→`/controls`、GizmoHelper/GizmoViewport→`/helper`，其余 23 个不变且正确，doc 页首行 import 与 catalog 一致；② 四反引号 189 处 → **0 残留**（全 26 页 grep 零命中）；③ 重灾区单元格复验：Html.eps=`0.001`、PivotControls.scale=`1`、BitmapText.fontSize=`72`，表格渲染正常；④ tgz 门禁照常通过。
- **Verdict 升级：CONDITIONAL PASS → PASS**（两 P1 关闭，P2 挂账不阻塞）。批次 C 关闭。

### 评审记录 3（2026-10-09，P1 修复轮代码复检，mandatory three-axis）

**评审范围**：sync-components.mjs 修复后全文（findImportPath 重写 + defaultText 剥壳 + BARRELS 重排）。方式：脚本逐行重读 × 递归边界用例推演 × 生成物边界扫描（union 转义/列完整性/oneLiner 截断）× 性能量级评估。

#### Review Matrix

| # | 检查项 | 结论 | 证据 |
|---|---|---|---|
| 1 | P1-1 修复正确性（递归逻辑） | PASS | barrelExportsClass depth≤2 防环；星号指向目录才递归（layouts 无类目录不炸）；根链 root→controls→PivotControls 三层在 depth 边界内命中（实测 true） |
| 2 | P1-1 修复正确性（优先级） | PASS | BARRELS 子域优先 + index 置末；26 组件全表 importPath 逐一复核无回归（core 14/graph 4/heat 1/helper 2/controls 1/camera 1/interactive 1/loader 1/material 2） |
| 3 | P1-2 修复正确性 | PASS | defaultText 剥围栏 + 首行截断；189→0 残留；单行默认值不受影响（eps=0.001/scale=1/fontSize=72 复验） |
| 4 | union 类型列转义 | PASS | typeToString join `' \\|'` + 说明列 `desc.replace(/\|/g,'\\|')` 双保险；实测 Html.style → `string \| Partial<CSSStyleDeclaration>` 渲染正确 |
| 5 | catalog 表格列完整性 | PASS | 全 26 行 split('|') 列数恒 6，零破坏（oneLiner 内未转义竖线会破坏列——扫描零命中） |
| 6 | 英文 oneLiner 句点截断 | PARTIAL（P3） | `split(/[。.\n]/)[0]` 对英文句子遇小数点/缩写提前截断（HeatMap 现值止于 "generator" 附近恰好无害，但 "e.g." 类句子会截出半句）。当前 26 组件无一触发，风险挂账 |
| 7 | 递归性能（无缓存重复读盘） | PASS（P4） | 26 类 × 12 barrel ≈ 300+ 次 readFileSync，实测 26 次根递归 21ms → 全表 <2s。一次性同步工具非热路径，不值得加缓存 |
| 8 | 深层边界（depth=2 上限） | PASS | 现仓库最深链 3 层（root→域→子目录）恰在边界内；若未来出现 4 层嵌套 barrel 会静默失配 → 由 11 号兜底根入口覆盖（降级不报错，可接受） |
| 9 | defaultText 首行截断信息丢失 | PASS（已缓解） | CONTRIBUTING 已规范"@default 单行值"；脚本首行截断是表格约束下的正确取舍（多行值无法进单元格） |
| 10 | require_('fs') 与 import 混用 | P2 挂账 | createRequire 已为 pack 解析引入，`require_('fs').readdirSync` 可改顶部 import readdirSync——功能正确，风格瑕疵 |

#### Overall Verdict: **PASS**

- 修复轮两项 P1 均正确落地且无回归；新增两项边界发现（6 号英文 oneLiner 截断、7 号读盘无缓存）均为 P3/P4 级，当前零触发、不影响交付，挂账批次 5 收尾时顺手处理或不处理
- 8 号（depth 上限静默降级）与 10 号（require 混用）已知悉并接受，理由如上
- 批次 C 复检关闭。P2/P3/P4 汇总挂账清单：EventDispatcher 断言风格、require_('fs') 统一、oneLiner 英文句点截断、barrel 递归缓存

### 评审记录 4（2026-10-09，批次 2 代码评审，mandatory three-axis，同日修复闭环）

**评审范围**：批次 2 全部产物——四脚本（validate-model / import-assets / build-search-index / search-assets）+ samples/ + assets/ 种子库。评审方式：8 组探针实测（含 2 个安全探针：zip-slip 双层、检索词元来源追溯）+ 源码逐段重读 + Spec §4.2/§4.9.4 契约交叉验证。

#### Review Matrix

| # | 轴 | 检查项 | 结论 | 证据 |
|---|---|---|---|---|
| 1 | Axis-1 | 批次 2 目标/验收可验证 | PASS | 2.1–2.5 证据齐（全链 PASS + 8 负面测试按期望退出码） |
| 2 | Axis-1 | 分级门禁裁决（2026-10-09）落实 | PASS | art/strict 阈值与阻断语义正确，§4.2 已同步 |
| 3 | Axis-2 | §4.2 检索条目八字段 | PASS | id/name/score/format/category/tags/modelPath/description 齐 |
| 4 | Axis-2 | manifest schema 合并 §4.9.4 双形态 | PASS | textures/states 校验 + states.map 命中检查有效（N5 探针） |
| 5 | Axis-2 | §4.2 检索语料五字段契约 | **FAIL→已修** | `PROJECT_FIELDS` 投影丢 `search_text`——语料实为四字段，契约要求含 search_text。种子恰被 description「Damaged Helmet」覆盖故冒烟未暴露；「helmet」查询词元来源追溯时发现。修复：PROJECT_FIELDS 补 search_text。复验：74→76 词元、docs 含字段、冒烟 9/9、检索保持命中 |
| 6 | Axis-3 | zip-slip 防护 | PASS | 双层实测拦截：条目名 `../escaped.txt`（staging 越界）+ manifest file_path `../outside.glb`（isRelPath） |
| 7 | Axis-3 | ZIP/GLB 解析健壮性 | PASS | EOCD 回扫/坏 sig/截断/非模型文件（exit2）均正确抛错 |
| 8 | Axis-3 | §4.9.4 双形态入库判定「白模 UV 完好」 | **PARTIAL→已修** | validate-model 产出 uvMissing 但 import-assets 未消费。修复：textures 存在且 uvMissing → 门禁 FAIL。复验：缺 UV 多状态包 exit=1、普通资产缺 UV 放行 exit=0（阻断范围正确限定多状态资产） |
| 9 | Axis-3 | CLI 文案笔误 | **已修** | 「curl 检索仍可用」→「继续入库，检索仍可用」 |

#### Overall Verdict: **PASS（三处修复复验后）**

- P2（语料缺 search_text）：契约违约，已修 + 复验（76 词元 / 冒烟 9/9 / helmet·机柜检索保持）
- P3（uvMissing 未消费）：双形态入库判定闭环，已修 + 复验（exit 码双向验证）
- P3（curl 笔误）：已修
- 全量回归：种子重导入 + 索引重建 + 冒烟 PASS
- **评审方法沉淀**：「词元来源追溯探针」暴露了冒烟盲区——种子资产 search_text 与 description 语义重叠，只跑种子的冒烟无法证明语料字段完整；评审需构造「字段值只存在于单字段」的探针查询（如「helmet」只查 vocab 归属）

### 评审记录 5（2026-10-10，批次 M + 批次 T + D4 修订轮代码评审，mandatory three-axis）

**评审范围**：批次 M（M.1–M.7 材质编辑器+材质库）、批次 T（T.1–T.6 场景树 Spline 化）、D4 修订轮（内联材质双路径 + seedMaterialType + 面板种子接线，用户质询否决初版"字段存在即重建"后定案）+ Review 补丁（loadMaterialSpec 丢字段修复）。评审方式：Spec §4.10/§4.11/§4.10.8（签名+D1–D9）逐项对照代码 × 行为级推演（GLB 共享材质/克隆链/undo 重建路径）× 17 组深检探针 × 四道门禁全量复跑。

#### Review Matrix

| # | 轴 | 检查项 | 结论 | 证据 |
|---|---|---|---|---|
| 1 | Axis-1 | 批次 M 目标/验收（Done Contract M.1–M.7 + 四道门禁） | PASS | §4.7 批次 M 七项全 [x]；门禁证据齐（本轮复跑：build 绿 edit-main 93.22 kB 独立 chunk、eslint 0 errors、SMOKE PASS S1–S21） |
| 2 | Axis-1 | 批次 T 目标/验收（T.1–T.6 + S18–S21） | PASS | §4.7 批次 T 六项全 [x]；S18 树层级/S19 搜索/S20 显隐/S21 锁定拾取全 true（本轮复跑） |
| 3 | Axis-1 | §4.10.0 五项用户裁决落实 | PASS | ②共享热更（reconcileInstances 同型热改+syncAll 重挂）③middleware 上传（apply:'serve'）④4 种子（SEED_MATERIALS 值与 §4.10.4 逐项一致）⑤分组折叠（matGroups 基础默认展开/Physical 六组默认折叠） |
| 4 | Axis-2 | §4.10.8 签名表逐项 | PASS | MaterialSpec 64 字段、MaterialLibEntry、VisualOverride、createMaterialFromSpec/applyMaterialTextures/migrateMaterialSpec、SceneEngine 四方法、MaterialLibService 全方法签名与实装一致（types.ts / materials.ts / SceneEngine.ts / MaterialLibService.ts） |
| 5 | Axis-2 | §4.10.8 文件变更表 12 文件 | PASS | 12/12 存在且改造落地（含 index.ts 导出、createScene serialize __materialLib 有则写无则删、EditApp 透传 materialLib） |
| 6 | Axis-2 | D4 定案（双路径）行为级一致 | PASS | 同类型 clone+applyMaterialScalars/Textures（只改显式字段）；跨类型 createMaterialFromSpec+inheritTextures（base 有/目标有/spec 未显式给才拷贝）；S15/S16/S17 三断言全 true（car_01 保贴图、图元保 #9cabb8、Standard→Physical 继承 map） |
| 7 | Axis-2 | §4.11.2 交互契约七项 | PASS | 树结构/展开折叠/搜索（id 子串+祖先链+空态）/点选（Shift 累计+双击聚焦）/eye（继承态+tooltip）/lock（树中可点选）/图标映射全落地；eye/lock 均 @click.stop 不冒泡为选区 |
| 8 | Axis-2 | T.5 core 不感知锁定 | PASS | handle.pick(x,y,filter?) 可选谓词与 isPickable 合成（createScene.ts）；SelectionService 传 !locked；LayoutGizmo 锁定 detach；RaycastEngine 签名未改 |
| 9 | Axis-3 | GLB 共享材质污染 | PASS | applyInlineMaterial 同类型路径 base.clone() 后改（AssetEngine 缓存根隔离）；冒烟 S15 car_01（clone 实例）贴图保持 |
| 10 | Axis-3 | 贴图槽语义正交性 | PASS | null=清除/undefined=不动/字符串=加载三态在 applyMaterialTextures 与 inheritTextures 语义无冲突；面板 clearTexture 写 null 消费清除态 |
| 11 | Axis-3 | undo 链 __materialLib 往返 | PASS | Bridge.rebuild 缺 key 显式补 {} 保 undo 清库；快照 structuredClone(serialize()) 含 __materialLib/__visuals.locked；S12 改库撤销回滚验证 |
| 12 | Axis-3 | 面板数据流（草稿即写即应用） | PASS | 全部参数控件 @input/@change → evNum/evStr → commitMat → applyMaterial（无"应用"按钮滞留草稿）；saveAs 读 __visuals 不会捕到未应用值 |
| 13 | Axis-3 | Review 补丁：loadMaterialSpec 丢字段 | **PASS（已修）** | 初版只认 v.materialType——__visuals 只含材质字段无 materialType 时（API 层合法形态）面板丢字段且下次调参被 replaceVisual 静默抹掉。修复：任何内联材质字段存在即显示完整 spec，纯开关视觉才走 seedMaterialType |
| 14 | Axis-3 | 已知边界（记录不阻塞） | PARTIAL | ① GLB 异步加载窗口 seedMaterialType fallback Standard（GLB 实为 Physical 时首次调参触发一次跨类型重建，inheritTextures 保贴图，损失=标量参数回默认）② 滑杆每 tick clone 材质（GC churn，编辑器规模可接受）③ saveAs 在纯开关态（无内联视觉无引用）把种子 type 空规格入库（type 正确、无参数——语义无害但库条目无信息量，低频路径） |

#### Overall Verdict: **PASS**

- 三轴全 PASS；无轴 1/轴 2 FAIL，无轴 3 高风险未解项
- 13 号补丁（loadMaterialSpec）本轮已修并复验（build 绿/lint 0 errors/SMOKE PASS）；14 号三项边界记录在案，均低频/低损/有兜底，不构成阻塞——批次 5 收尾时可顺手评估 ③（saveAs 空规格条目）
- 复验证据（2026-10-10 本轮全量复跑）：vue-tsc 绿 / build 绿（edit-main 独立 chunk 93.22 kB，二开主包 750.23 kB 不含编辑器码，铁律隔离保持）/ eslint 0 errors（222 warnings 均既有基线类）/ headless Edge 冒烟 **SMOKE PASS S1–S21 全 true**
- 评审方法沉淀：D4 双路径的三条行为断言（S15/S16/S17）是本评审的行为级证据核心——"参数改了"（roughOk）与"没改的还在"（mapKept/colorKept）必须成对断言，只断前者会漏掉初版"重建丢原材质"这类回归

### 评审记录 6（2026-10-10，批次 3 代码评审（REVIEW EXECUTE），mandatory three-axis）

**评审范围**：批次 3 全部产物——build.mjs / strip-edit.mjs / init.mjs / verify/gates.mjs + validate-model.mjs 集成改动。评审方式：独立评审 agent 对抗性审查（Q1–Q10 定向 + 全量 sweep）× 主评 Axis-2 契约核对（§4.10.6/§4.8 R1-3/铁律白名单）× 行为级探针复现（P0 复现 + 未来键探针 + S29 十四级递进探针）。

#### Review Matrix

| # | 轴 | 检查项 | 结论 | 证据 |
|---|---|---|---|---|
| 1 | Axis-1 | 批次 3 目标/验收（3.1–3.3 + gates.mjs 复跑） | PASS | §4.7 三项全 [x]；gates.mjs 31/31（`--with-build` 32/32，含小写盘符端到端） |
| 2 | Axis-1 | 预算估算对齐 R1-3 裁决 | PASS | calls≤400/triangles≤1M/materials≤32 落地 + CLI 覆盖（--max-calls/--max-triangles/--max-materials）；静态估算 + 运行期 perf-fps 权威的分层与 R1-3 一致 |
| 3 | Axis-2 | §4.10.6 转录契约四条 | PASS | 剥离私有区 / 材质库表+引用表仅被引用 / 转录指引对应 LLM 产物（libraryMaterials + handler 接线）/ INTEGRATION_GUIDE §6+§6.1 材质库段在（批次 M.7 交付，本轮核对仍在） |
| 4 | Axis-2 | 铁律 2 白名单放宽的记录完整性 | PASS | ALLOWED_CORE_ENTRIES 四入口 + 禁深层 engine/**，Diff #24 偏差 2 已记档；gates 用例双向验证（深层阻断 + 公开入口放行） |
| 5 | Axis-2 | 铁律 3 检查面 vs 双下划线族契约 | **FAIL（P1-4）** | §4.9.2 保留 key 契约是"双下划线族=编辑器私有"，实装只查 `__visuals`/`__materialLib` 两键——`__futureKey` 泄漏进 --stripped 产物不拦截（主评探针 + 评审 agent 双源确认） |
| 6 | Axis-3 | strip-edit 输出安全（--out 与源同路径） | **FAIL（P0）** | `strip-edit <src> --out <src> --force`：rmSync 先清空源目录、cpSync 再 ERR_FS_CP_EINVAL crash——**源工程被毁**（实测复现：crash 后源目录剩 0 项）。--out 为源的父目录时破坏面更大 |
| 7 | Axis-3 | 铁律 2 相对路径旁路 | **FAIL（P1-2）** | 白名单只匹配 `@/scene-core*` 说明符——edit/ 用 `import { X } from '../../scene-core/engine/SceneEngine'` 相对路径绕过整条门禁（agent 谓词验证） |
| 8 | Axis-3 | import 白名单前缀未锚定 | **FAIL（P1-3）** | `startsWith('vue')` 放行 vue-router/vuetify、`startsWith('three')` 放行 three-stdlib/three-mesh-bvh（agent 逐例验证）——内网依赖纪律被弱化 |
| 9 | Axis-3 | 预算 CLI 覆盖失效模式 | **FAIL（P2-8）** | `--max-calls` 缺值/非数字 → NaN → 全部超限比较恒 false → **预算静默失效**（agent 复现 402>NaN=false） |
| 10 | Axis-3 | 材质预算算术 | PASS | `materialKeys.size + (libCount-1)` 净效果 = size+libCount（`__lib:count` 哨兵键补偿），createScene 确实实例化全部库条目；语义正确但写法绕（P3 建议） |
| 11 | Axis-3 | 预算实例乘算语义 | PASS | calls/triangles 按节点累加（N 实例各计）、materials 按 `${assetId}:${slot}` 去重——与 AssetEngine 共享实例的运行时语义一致 |
| 12 | Axis-3 | index.html 单入口改写 | PASS | 对真实模板模拟改写：合法单入口、全文件零 edit 残留；无 script 时被结构门禁兜住 |
| 13 | Axis-3 | copyFilter Windows 路径 | PASS | 反斜杠归一 + `/src/edit$` 与 `/src/edit/` 双 pattern；`src/editors/` 不误伤 |
| 14 | Axis-3 | gates.mjs 设施质量 | PARTIAL | 无跨用例耦合、小写盘符用例刻意、失败时保留夹具合理；但无 spawn 超时（挂起风险）+ fx-stripped-ok 前置未断言 |
| 15 | Axis-3 | 顺手发现：S29（R10 落地的冒烟）失败 | **FAIL（真缺陷，模板侧）** | 见下"S29 根因"——**非批次 3 产物缺陷，是 R10 裁决落地时 applyVisibility 走错通道被 three 每帧覆写**。SMOKE FAIL 29/29 复现（主评 14 级探针定位） |

#### S29 根因（评审期顺手发现，模板侧真缺陷）

- **现象**：`smoke-r.mjs --edit` S29 `blockedWhenLocked:false`；click 卡片（car_02）初始就该隐藏（display:none）但实测 `''`（可见），且点击开/关均无效——display 永远 `''`。
- **根因**：`cards/registry.ts applyVisibility` 把显隐写到 `anchor.element.style.display`，但 **three@0.185 CSS2DRenderer 每帧覆写该属性**（CSS2DRenderer.js:232 `element.style.display = visible === true ? '' : 'none'`，visible 只由视锥+layers 决定）。我们设置的 `'none'` 下一帧被冲回 `''`；`onCardState` 状态机本身翻转正确（spy 证实 false→true→false），DOM 从不跟随。S1–S28 不受影响（always 卡片恒 ''、click 卡片的断言都在 S29 才首次依赖"初始隐藏态"）。
- **修复方向**：显隐改走 three 层 `CSS2DObject.visible`（CSS2DRenderer 的 hideObject/renderObject 尊重 `object.visible === false` 分支，:204/:214）——`applyVisibility` 设 `anchor.visible = state.visible && !orphan`，element.style 交给渲染器管理。顺带解开"初始 display"问题（boot 时 mount 即生效，不再依赖 refresh 时序）。
- **冒烟技巧沉淀**：`display !== 'none'` 断言口径在 CSS2DRenderer 场景**不可靠**（每帧重写），断言应读 `anchor` 的 object.visible 或卡片元素 offsetParent/实际渲染态。

#### Overall Verdict: **CONDITIONAL PASS → PASS（修复闭环 2026-10-10，见 §7 #27）**

> 初判 CONDITIONAL PASS；P0 + P1×3 + S29 + P2 批量修复完成后复验全绿（gates 40/40 + --with-build 41/41 + 四道门禁 + SMOKE PASS 29/29 含 S29 true），升 **PASS**。修复细节与复验证据见 §7 #27。

- **P0（数据丢失级，修完才算 PASS）**：strip-edit `--out`==源 或 `--out` 为源父目录 + `--force` → 先 rmSync 清空源再 crash。修法：路径守卫（resolve 后同路径/包含关系即拒绝，报"输出目录不得是源工程或其父目录"）。
- **P1-2 铁律 2 相对路径旁路**：edit/ 的 core 引用检查扩为"解析后路径"判定——凡 import 说明符解析落在 `src/scene-core/` 内的（`@/scene-core*`、`../scene-core*`、`./scene-core*`），按白名单校验深层与否。
- **P1-3 裸模块前缀锚定**：白名单改"前缀+边界"匹配（`vue` 后必须跟 `/` 或结束、`three` 同理、`@a3d/a3d-components` 后跟 `/` 或结束、`three/examples/jsm/` 与 `three/addons/` 本身带边界）。
- **P1-4 未来 `__` 键泄漏**：铁律 3 的私有区检查从两键白名单改为 `^__` 前缀族（与 §4.9.2 契约一致）；strip-edit 剥离同理（delete 所有 `^__` 顶层键，转录只认两个已知键）。
- **P2（应修，不阻塞批次 3 PASS 但应在批次 4 前清掉）**：① `--max-*` 值 NaN 校验（非数字 → 用法错误 exit 2）② strip-edit/init 的 scene-data.json JSON.parse 守卫（栈崩溃 → 优雅报错）③ extractImports 注释/字符串/CSS @import 误报（strip 注释与字符串后再提取）④ UNC 路径 spawnCwd 前缀剥离修正 ⑤ `@/edit` 前缀误伤 `@/editors` 类模块（边界匹配）⑥ init 多 tgz 非确定性（按版本排序取最新）。
- **P3（记录在案，批次 5 顺手）**：`__lib:count` 哨兵算术改直白计数；TRANSCRIPTION 值内 `|`/反引号转义；`--deps install` 失败 exit 码语义统一；gates spawn 超时 + 前置断言。
- **S29 修复**（模板侧）：applyVisibility 改 `anchor.visible` 通道 + S29 断言口径改读 object.visible——修完跑 `--edit` 全量 SMOKE 复验（当前 S29 FAIL 是已知状态）。
- 修复完成后复验要求：gates.mjs 全量（含 --with-build）+ `smoke-r.mjs --edit` S29 全 true + 新增负面用例（相对路径旁路 / 未来键 / NaN 值 / --out 同路径拒绝）落进 gates.mjs。
- 评审方法沉淀：**双通道显隐（业务态 state.visible vs 渲染态 element.style.display）是 CSS2D 卡片系统的结构性陷阱**——凡"我设置 DOM 样式但渲染器也管理同一属性"的场景（CSS2D/CSS3D/部分 HUD），必须确认所有权；断言口径要用最终生效通道。




## 7. Plan-Execution Diff
- 批次 1 已暴露的偏差与修复（批次 2 前无需返工 Plan）：
  1. **版本三角**：@vue/tsconfig 0.9.1→^0.8.1、TS ~5.7→~5.9.0、+vue-eslint-parser——package.json 最终组合以本记录为准
  2. **createScene 装配序**：初版 TDZ（onFrame 先于 renderLoop 声明）→ 重写；registerFactory 必须先于 buildTree（写入 INTEGRATION_GUIDE FAQ）
  3. **RaycastEngine pickable 失效**：pick 谓词从空 Map 改为 `sceneEngine.isPickable(id)`（SceneEngine 增补 isPickable）
  4. **cards/registry 三缺陷**：visible 未应用 DOM（+applyVisibility）/undo 后锚点失效（+parent!==target 重挂）/Vue 组件无处挂（+createApp 挂载，deps.components）
  5. **LightEngine directional 分支缺 `light = d`**（TS2454 真 bug）
  6. **编辑器文件数 6→8**：新增 AlignmentService（对齐/分布 v1 确认后补）与 SaveService 独立拆分
  7. **es2020 lib 限制**：编辑器代码避免 `.at(-1)`（noUncheckedIndexedAccess + 显式索引）；`import type * as THREE` 值使用处改普通 import（TS1361）
  8. **冒烟环境**：headless Edge WebGL 必须 `--use-angle=swiftshader --enable-unsafe-swiftshader`，批次 4 验证脚本沿用
  9. **批次 1 验收缺陷（2026-09-30 用户实测反馈，已全部修复）**：
     - 卡片锁死左上角：CSS2DRenderer 从未 setSize，投影矩阵 `_widthHalf/_heightHalf` 为 undefined → transform=NaN 元素停 (0,0)。修复：cards/registry 初始化即 setSize + 新增 `resize(w,h)` + createScene 经 RenderLoop.onResize 同步
     - 编辑态场景变形：canvas 移入中栏后 ResizeObserver 只更新 renderer 尺寸，camera aspect 无人更新。修复：RendererEngine.applySize 返回实际尺寸 + RenderLoop 新增 onResize 注册链 + createScene 接 cameraEngine.setAspect(w/h)
     - 双开 bug（自查发现）：index.html 静态 canvas + main.ts 无条件加载，`?edit=1` 时 main/edit-main 两套 WebGL context 同时跑。修复：index.html 改单 if/else 动态 import 分流，静态 canvas 删除，main.ts 自建画布
     - 属性面板"应用"按钮：改 `bridge.commitLive(label, apply)` 实时生效入口（@input 即触发）；撤销会话合并（同标签 1s 内连续调用只压一层快照，一次连续调整=一步撤销；undo/redo/commit 打断会话）；空值/NaN 中间态不打入场景
     - 样式翻新（Spline 风格）：新增 edit/styles/editor.css 设计令牌（--ed-* 变量：面板 rgba 玻璃态/输入框/边框/accent #3d7eff/危险色/圆角/阴影），.edit-scope 作用域隔离不污染二开态；EditApp 改悬浮面板布局——视口 absolute inset:0 全屏铺底（canvas 尺寸恒等于窗口，从根源消除"面板挤占视口导致变形"），工具条左上悬浮+左树/右属性悬浮玻璃面板（backdrop-filter:blur）；四组件全部迁 .ed-* 原语（ed-btn/ed-row/ed-sec）
  10. **第二轮验收反馈修复（2026-10-08，全部实现 + 冒烟通过）**：
     - **选中包围盒**：SelectionService 用 BoxHelper（基准 #ffb020 橙 / 成员 #00a2ff 蓝，depthTest=false + renderOrder=999 保证可见）；`renderLoop.onFrame` 每帧 `helper.update()` → Gizmo 拖拽/面板调参/动画驱动时实时跟随；`helper.raycast = () => {}` 防止点中边框误命中自身
     - **Spline 工具条**：Toolbar 重写为顶部居中悬浮条——六图元下拉收纳（点击展开 primitive 菜单）、SVG 线性图标（move/rotate/scale/duplicate/delete/undo/redo）、按选中态禁用（undo/redo/copy/delete）、backdrop 点击关闭下拉；删掉原先铺开全按钮的排布
     - **属性面板八分区**（对照 3d-templete 补齐）：变换（位/旋/缩三行 + 尺寸 hint）/ 物体显示（可见 + 可拾取）/ 材质（color/metalness/roughness/透明/线框/平直着色/双面/自发光 8 参数）/ 场景（背景色/环境强度/雾）/ 相机（FOV/near/far/位置）/ 灯光（颜色/位置/spot 类型 + distance/decay/angle/penumbra/target）/ 控制器（自动环绕/阻尼）/ 渲染器（阴影开关）。types + 引擎层同步扩充参数（MaterialOverride 扩 5 字段、LightEngine 加 spot 分支与衰减参数、CameraEngine near/far、SceneEngine fog/envIntensity、RendererEngine shadowMap、controls damping/autoRotate）
     - **引擎 bug（自查发现）**：SceneEngine.applyNodePatch 从未处理 materialOverride——面板改材质静默失效。修复：`applyMaterialOverride` 抽到 `scene-core/utils/material.ts` 共享模块（避免 registry↔SceneEngine 循环依赖），applyNodePatch 增 materialOverride 分支（null 清空重建，否则浅合并热改）
     - **产品 bug 1（冒烟 v5 暴露）**：浏览器在 mouseup 后总会补发 click（即使经历拖拽）→ Gizmo 拖拽收尾/轨道旋转收尾会清空选中。修复：SelectionService 在 pointerdown 记录坐标，click 时位移 >3px 视为拖拽收尾不改选区（Spline 同款行为）
     - **产品 bug 2（冒烟 v6 暴露）**：three.js 上游 TransformControls XYZ 均匀缩放柄在物体投影正中心按下时 `d = pointEnd.length()/pointStart.length()`（TransformControls.js:633）除法爆炸（实测 scale=-1.7e14）。修复：LayoutGizmo.writeBack 加护栏——scale 非有限或 |v|>1e4 或 <1e-6 时回滚 startTransform（不进撤销栈）
     - **复验证据**：eslint 0 errors / vue-tsc --noEmit 绿 / build 绿（edit-main chunk 64.56 kB gzip 16.73，隔离保持）；headless Edge 冒烟（puppeteer-core + NODE_PATH 指向全局 npm）：修复后 v6 全程 `sel="已选 1（基准 demo_box）"`，G 平移 (-3,0.5,0)→(-2.78,0.72,-0.28)、R 旋转 rot.x 0→1.37、S 病态中心起步被护栏回滚（scale 保持 1.00）、v7 正常路径 scale→4.08/1.00/3.83，`errors: []`；视口元素截图（ed6/ed7 系列）确认包围盒拖拽中贴合跟随
     - **冒烟技巧沉淀**：物体不在视口中心时拖拽起点必脱靶——脚本先按 F（frameObject 居中）再拖；rotate 模式中心无拾取柄，从圆环偏移处起步走弧线；scale 病态用例需从中心起步、正例需从偏移处起步
  11. **第三轮验收反馈修复（2026-10-08，五项全部实现 + 冒烟通过）**：
     - **① R/S 失效回归**：根因是上轮引入面板分区后，工具条/快捷键仍直调 TransformControls.setMode，而属性面板按钮只走 bridge.setGizmoMode——两路状态源分叉。修复为单路同步：gizmo.setMode 只发 bridge → edit-main onState → gizmo.syncMode()（幂等，mode 不同才 setMode）；LayoutGizmo.syncSelection 同理加幂等（`controls.object !== obj` 才 attach，防重挂打断拖拽）
     - **② 控制器参数无响应**：双重根因——(a) PropertyPanel applyControls/applyLight 的 guard 逻辑写反：`if (![...].some((v) => !Number.isFinite(v))) return;` 语义是"全部有限就 return"，永远早退；正确写法 `![...].every((v) => Number.isFinite(v))`。经 debug 脚本在输入框注入 `[DBG applyControls] early return` 日志定位；(b) RenderLoop 调 controls.update() 未传 deltaTime，autoRotate/阻尼不生效（three.js 0.185 OrbitControls.update(deltaTime) 签名）。修复后引擎级取证：autoRotate 开启后 theta 0.668→0.526→0.343 持续变化；阻尼 0.25 可调。「自动环绕」全部改「自动旋转」
     - **③ 卡片级联删除**：双重根因——(a) Toolbar 删除走旧路径不级联：新增 Bridge.removeObjects(ids)，一次 commit 内查 serialize().cards 过滤 attachTo 命中项 + update({ remove, cards })；(b) CSS2DRenderer 只 append 从不 remove，CSS2DObject.removeFromParent() 只摘场景树不清 DOM（three.js 0.185 源码事实）→ cards/registry unmountCard 显式 `anchor.element.remove()`。取证：删 demo_box → card_demo_box 消失、card_demo_sphere 保留；Ctrl+Z 恢复两者
     - **④ 灯光补全 + 命名纪律 + 辅助线**：LightConfig 加 `rectarea`（RectAreaLight + width/height 字段），共 6 类型；LightEngine createLight/mutate/dispose 对应分支（rectarea lookAt(0,0,0)）；PropertyPanel LIGHT_TYPES 表直接用 three.js 原生名（AmbientLight/DirectionalLight/HemisphereLight/PointLight/SpotLight/RectAreaLight），按类型显隐字段（position/groundColor/distance/decay/angle/penumbra/width/height/castShadow）；新增/删除灯按钮；starter scene-data.json 改名 directional_light_001/ambient_light_001。辅助线：新建 edit/LightHelperService——onFrame 每帧 helper.update()、sync() 幂等（灯实例替换即重建 Helper、ambient 无几何跳过、`helper.raycast = () => {}` 防自拾取）、focus(id)；DirectionalLightHelper/SpotLightHelper/PointLightHelper/HemisphereLightHelper 主包导出，RectAreaLightHelper 需从 three/examples/jsm/helpers 引入
     - **⑤ 相机投影切换 + position/lookAt**：CameraEngine.setProjectionType('perspective'|'orthographic', aspect)——保位置与视线方向、按物距与 fov 反推 ortho 视锥（halfH=distance*tan(fov/2)、halfW=halfH*aspect）、ortho near=-200、切完触发 onCameraSwap；handle.onCameraSwap 回调里 controlsEngine.controls.object 重挂 + TransformControls.camera 换绑；setLookAt(target) + lookAtTarget；面板 persp/ortho 切换按钮 + position/lookAt 三轴输入（FOV 仅透视显示）。PropertyPanel 相机分区 camDraft（type/positionXYZ/lookAtXYZ/fov/near/far）
     - **连带 bug（修复过程中暴露）**：
       - undo 只恢复 objects：快照存的是 serialize() 返回的引擎内部 def 引用，后续 patch 原地改掉 → Bridge.takeSnapshot/undo/redo 全部 structuredClone 深拷贝；rebuild 从只恢复 objects 扩为全量恢复（objects + scene/lights/camera/controls/renderer/cards）
       - 相机实例切换后引用陈旧：internals.camera 与 cards deps.camera 静态捕获/解构后在切 ortho 后仍读 PerspectiveCamera → 都改 getter 活引用（不静态捕获不解构）；取证：切 ortho 后 internals.camera.type === 'OrthographicCamera' 且 Gizmo 拖拽正常（rotChanged=true）
     - **复验证据**：eslint 0 errors（21 warnings 均为既有基线）/ vue-tsc 绿 / build 绿（edit-main 74.93 kB gzip 19.17，隔离保持）；headless Edge 冒烟（smoke-final.js）：A DirectionalLightHelper 已挂场景、B 灯光强度 2.2→5 生效、C 相机 position (8→15) 与 lookAtY (1→3) 生效、D undo 两次全量恢复（灯光回 2.2、camX 回 8、lookAtY 回 1）、E 正交切换后 cameraType=OrthographicCamera 且 Gizmo 旋转生效，`errors: []`（仅 favicon 404 无害）；8 张截图留档 `C:\Users\Tony\AppData\Local\Temp\gts3d-smoke-r3\`
     - **冒烟技巧沉淀**：Vue 输入框必须用原生 value setter + input 事件注入（直接赋值不触发 v-model）；guard 早退 bug 用 debug 日志脚本定位最快；引擎级验证（theta 持续变化、camera.type 读回）比 UI 断言更可靠；dev-only `window.__gts3d = handle` 调试口是冒烟断言的关键抓手
  12. **第四轮验收反馈修复（2026-10-08，三项全部实现）**：
     - **① 关闭阻尼后惯性仍在**：根因是 OrbitControls 0.185 源码行为——`enableDamping` 关闭后 update() 走无阻尼分支，把残余 `_sphericalDelta` **全额一次性应用**（`theta += sphericalDelta.theta` 而非 `* dampingFactor`）再清零。若用户在滑行中关闭阻尼，下一帧相机猛跳一下，被感知为"阻尼没关掉"。修复：ControlsEngine.applyConfig 检测 true→false 沿时显式清空 `controls._sphericalDelta` 与 `_panOffset`（经 as unknown 断言访问内部态）。取证（verify3 A）：注入惯性 0.3 后 600ms 关闭阻尼，`theta drift after damping-off = 0.00000 rad`（关闭即冻结，PASS）
     - **② 灯光辅助线开关**：LightHelperService 增 `enabled` 总开关 + `setEnabled(bool)` + `isEnabled()` + 私有 `applyVisibility()` 唯一出口（`visible = enabled && (activeId===null || id===activeId)`）；`focus()` 与 `sync()` 新建 helper 都改走该出口，开关与选中联动不再互踩。PropertyPanel 灯光分区标题行加「辅助线」复选框（v-model helpersOn → toggleHelpers）。取证（verify3 B）：点掉复选框 DirectionalLightHelper visible=false、勾回 true，两态切换 PASS
     - **③ 阴影不生效**：根因是三层链路缺第三层——renderer.shadowMapEnabled=true（已有）+ 灯 castShadow=true（已有）+ **物体网格 castShadow/receiveShadow 从未设置**（three.js Mesh 默认双 false，工厂 registry.ts 建网格时不读这两个字段）。修复四处：types.ts SceneObjectNode 加 `castShadow?: boolean` / `receiveShadow?: boolean` + ScenePatch.patch 数组加同名字段；SceneEngine.applyNodePatch 加两分支（def 回写 + obj.traverse 热改全部子 mesh）；handlers/registry 抽 `applyShadowFlags(obj, node)` 共享工具，primitive 工厂建 mesh 后调用、asset 工厂在异步加载回调里对 instance 调用；PropertyPanel 物体分区加 castShadow/receiveShadow 复选框（objFlags 扩两字段）；starter scene-data.json：demo_box/sphere/cylinder/wind_turbine cast+receive true、ground receive true cast false。取证（verify3 C）：box.castShadow=true、ground.receiveShadow=true、light.castShadow=true、renderer.shadowMap.enabled=true 四层全真（PASS）
     - **连带排查（阴影视觉证据未取得，如实记录）**：swiftshader 软渲染环境下多重取证均无法产出阴影像素差异——shadow-on/off 截图 base64 完全相同；离屏 WebGLRenderTarget 渲染 + readRenderTargetPixels 全量对比 diff=0；同步 r.render + 同帧 gl.readPixels 亦 diff=0；纯净沙盒页（不经模板任何代码的最小 three.js 场景）readPixels 全黑。但 render calls 计数证明 shadow pass 确实在跑（开关阴影 5→8 个 draw call，+3 为深度 pass），shadow map 2048x2048 已分配、shadow camera 视锥/朝向/target 挂树全部核实正确。结论：链路代码正确（引擎级四层标志验证 PASS），阴影像素级取证在 swiftshader 下不可行——推测与软渲染器的深度纹理/shader 编译行为有关，留待真实 GPU 环境人工验收。**风险声明：若真实 GPU 下阴影仍不显示，优先排查材质 program 缓存（three.js 已知行为：shadowMap.enabled 运行时切换后已编译材质可能不重编译，需遍历场景 material.needsUpdate=true；本修复属新建物体默认带阴影，不经此路径）**
     - **复验证据**：eslint 0 errors / vue-tsc 绿 / build 绿（edit-main 75.90 kB gzip 19.39，隔离保持）；dev server 冒烟 verify3 A/B/C 三项引擎级断言全部 PASS（A 阻尼关闭即停 / B 辅助线开关两态 / C 阴影四层链路标志）；冒烟设施与 dev server 已清理
  13. **第五轮验收反馈修复（2026-10-08，两项全部实现）**：
     - **① 缩放仍有"惯性"**：源码核实 OrbitControls 0.185 缩放走 `_scale` 乘数载体，wheel 事件同步调 update() 后 `_scale` 无条件复位为 1，**与 enableDamping 完全无关**——旋转/平移的残余速度清空（Diff #12 修复）不覆盖缩放，因为缩放根本没有残余速度。用户感知的"缩放还有阻尼"实为触控板双指惯性滚动连发一串 wheel 事件（浏览器事件层行为）。修复：暴露 `zoomSpeed` 为可调参数——ControlsConfig.zoomSpeed + ControlsEngine constructor/applyConfig/getConfig 三处接线 + PropertyPanel 控制器分区「缩放速度」滑条（0.2~3，默认 1）。用户调低 zoomSpeed 即可抵消触控板惯性手感
     - **② 阴影断裂 + 每灯阴影开关 + 阴影参数可调**：
       - **断裂根因**：DirectionalLight 阴影相机默认视锥 ±5（世界单位），starter 场景 ground 40x40——物体超出 ±5 即落视锥外，阴影被裁断。修复：LightConfig 加 `shadowCameraExtent`（视锥半径），starter directional_light_001 默认 15；并暴露为面板可调
       - **参数链**：LightConfig 扩 5 字段（shadowMapSize/shadowBias/shadowCameraNear/shadowCameraFar/shadowCameraExtent）；LightEngine 抽 `applyShadowParams(light, config)` 共享工具（addLight 与 mutate 共用；mapSize 变更时 dispose 旧贴图置 null 待重建；extent 限 OrthographicCamera 分支；末尾统一 updateProjectionMatrix），mutate 各字段回写 config（serialize 带回）；PropertyPanel 灯光分区 castShadow 勾选后展开阴影参数组——mapSize 下拉（512/1024/2048/4096）+ bias 输入（directional/spot 共有），近面/远面/范围（extent）三输入（directional 专有，spot 阴影相机为透视投影无正方形视锥概念）
       - 面板逻辑：buildLightConfig 仅 castShadow=true 时打包阴影参数进配置（关掉开关即回到默认参数），guard 数组补 5 个新数值字段
     - **复验证据**：eslint 0 errors / vue-tsc 绿 / build 绿；dev server 冒烟五项全 PASS——A zoomSpeed 0.2 注入引擎读回 0.2 + serialize 回写 0.2；B castShadow off/on 两态切换；C mapSize 2048→1024（旧贴图释放 mapExists=false 待重建）+ bias→-0.002 + extent→8（camLeft=-8）+ near→1 + far→100 全部落到灯实例；serialize 完整带回 5 字段；UI 断言四控件（缩放速度/mapSize/bias/范围）全部渲染。冒烟设施与 dev server 已清理（端口 5199 释放）
  14. **命名纪律修正（2026-10-08，用户质询 shadowCameraExtent 后裁决方案 1）**：用户指出 `shadowCameraExtent` 不是 three.js 原生参数（DirectionalLightShadow 源码为 `OrthographicCamera(-5,5,5,-5,0.5,500)`，视锥是 left/right/top/bottom 四个独立字段）——违反第三轮确立的命名纪律。裁决拆为原生四字段：`shadowCameraExtent` 全链路替换为 `shadowCameraLeft/shadowCameraRight/shadowCameraTop/shadowCameraBottom`（types.ts、LightEngine applyShadowParams 四独立赋值 + mutate 四字段条件回写、PropertyPanel lightDraft/loadLight/buildLightConfig/guard/模板——「范围」单输入改为 left+right / top+bottom 两行四输入、starter scene-data.json ±15）。复验四项全 PASS：starter 初值四边界 -15/15/15/-15、mutate 热调 -8/9/12/-7 全落实例、serialize 四字段带回、UI 四输入存在且无 extent 残留；eslint/vue-tsc/build 绿，`grep shadowCameraExtent` 零命中
  15. **命名纪律全量迁移 + 面板 Tab 拆分（2026-10-08，第五轮后追加两项，用户裁决「全修 + 方案 A」）**：
     - **全量审计结论**：第三轮只改了 UI 显示层（LIGHT_TYPES label 表），数据层 type 值仍是缩写——5 处实质违规：① LightConfig.type 六值小写缩写；② CameraConfig.type `'perspective'/'orthographic'`；③ ControlsConfig.type `'orbit'`；④ SceneObjectNode.primitive 六值小写；⑤ MaterialOverride.doubleSide 布尔折叠了原生 side。豁免判定：type:'asset'/'primitive'（模板架构的工厂分发键，非 three.js 概念）、EnvironmentPreset（自创扩展点，代码已注释）、toneMapping/shadowMap 值（字符串即原生枚举名）
     - **迁移内容**（数据层→引擎→UI→starter 数据全链路）：LightConfig.type → 'DirectionalLight'/'AmbientLight'/'PointLight'/'HemisphereLight'/'SpotLight'/'RectAreaLight'；CameraConfig.type → 'PerspectiveCamera'/'OrthographicCamera'（CameraEngine constructor/get type/setProjectionType 签名同步）；ControlsConfig.type → 'OrbitControls'；primitive → 'Box'/'Sphere'/'Cylinder'/'Plane'/'Cone'/'Torus'（几何类名省 Geometry 后缀，registry 工厂 switch + Toolbar 图元菜单 key/类型断言同步）；doubleSide → `side: 'FrontSide'|'BackSide'|'DoubleSide'`（utils/material.ts 消费端字符串→THREE 常量映射，面板复选框改三值下拉）。连带：PropertyPanel LIGHT_TYPES 简化为字符串数组（type 即原生名，删除恒等映射 lightTypeLabel）；addLight 的 preset 表键同步驼峰；**灯 id 生成加 snake_case 转换**（type 驼峰后 `${type}_light_001` 会变成 `DirectionalLight_light_001` 冗余，改为驼峰转 snake 后拼 `directional_light_001`，保持数据层 id 命名约定）；starter scene-data.json 灯/相机/控制器/图元值全量迁移。§4.9 v3 schema 示例中的小写类型名同步修正（Spec 内部一致性）
     - **Tab 拆分（方案 A）**：PropertyPanel 加「物体/场景」双页签——物体页=变换/物体开关/对齐分布/材质（选中相关），场景页=场景/相机/灯光/控制器/渲染器（全局配置）。交互：选中物体自动切物体页、清空选中（ESC/点空白）自动回场景页（watch selectionCount immediate）、未选中时物体 Tab 禁用 + 物体页显示空态提示；用户手动切页不被打断（仅选中态变化才跳转）。样式：prop-panel__tabs 玻璃态页签条（复用 --ed-* 设计令牌）
     - **复验证据**：eslint 0 errors / vue-tsc 绿 / build 绿；dev server 冒烟 A-G 七项——A/B 迁移后场景装载正常（灯实例 type 读回 DirectionalLight/AmbientLight、cameraType=PerspectiveCamera、controlsCfgType=OrbitControls、boxCast=true 回归保持）；C 相机往返切换（ortho→persp→ser 全对）；D side 路径（materialOverride side='DoubleSide' → 实例 side=2 即 THREE.DoubleSide + serialize 带回）；E Tab 交互（默认场景页+灯光区可见、点物体树选中→自动切物体页+变换区可见+灯光区隐藏、ESC 清空→回场景页）；F 原生类型新增灯（PointLight 实例正确 + id snake_case）；G render calls 22>19（阴影 pass 在跑）；`pageerrors: []`。冒烟设施与 dev server 已清理（端口 5199 释放）
     - **追加修正（同日，用户两连反馈）**：① 新增灯 id 出现 `_light_light_` 双重冗余——上轮 snake 转换叠加旧 `_light_` 后缀所致（DirectionalLight→snake 后 directional_light 再拼后缀）；② 用户质询「为什么要做 snake 转换，有必要吗」——反思：id 只是标识符，snake 转换是为风格统一服务的冗余代码层，且正是冗余 bug 的来源。裁决方案 1：**删除转换，id 直接 `${type}_${序号}`**（`SpotLight_001`，id 与 type 直读对应）；starter 存量 id 同步改 `DirectionalLight_001`/`AmbientLight_001`。复验 PASS：starter 按新 id 装载、引擎实例正确、UI 新增生成 `SpotLight_001` 无冗余、零 pageerror
  16. **批次 R 执行记录（2026-10-09，R.1–R.9 全部完成，四道门禁全绿）**：
     - **R.1 types.ts**：SceneData 重写为 v3（保留 key version/meta/scene/camera/lights/controls/renderer/remove/__visuals + 开放 type 分组索引签名）；SceneNode {id, parentId?, position?, rotation?, scale?, card?, params?}；新增 TreeSceneFragment（update 片段，同构全可选）/ UpdateStats / RESERVED_KEYS（Set 常量，运行时消费）；删除 SceneDataJSON/SceneObjectNode/ScenePatch/MaterialOverride/EnvironmentPreset（environment 收窄 {intensity}|null，preset 归代码）
     - **R.2 SceneEngine**：entries Map<id,{obj,node,type}> 单一真相索引（分组字典不另存，序列化时按 type 聚合）；registerFactory 按 key 分发；applyFragment 实现 remove 先行（子树级联）→ 存在同 type 原地 update / 类型不同重建 / 缺失 create → __visuals 应用；params/card 整块替换不深合并；buildTree 按 parentId 依赖序；removeObject 迭代式子树级联返回全删 id
     - **R.3 材质归代码**：新建 materials.ts——stateMaterials 注册表（starter: cars normal/alarm/maintenance）、StateVisual（mapUrl/map/color/…/side/model）、applyState（model 键→modelSwapper 换实例，mapUrl 异步换贴图，其余参数热改）、loadTexture+texCache、PRIMITIVE_DEFAULT_COLOR、VisualOverride/applyVisualOverride（编辑器视觉层）；AssetEngine.applyState 消费 manifest.states 贴图集（registerAssetStates）；删除 utils/material.ts 数据驱动 materialOverride 路径
     - **R.4 卡片内联**：CardSpec 进节点（{type, trigger: click|always, offset}）；cards/registry 挂载 key `${nodeId}/card`，props 自动注入 {...node.params, id}；卡片随节点生命周期（引擎 removeObject 级联 + unmountCard 显式 element.remove()）；trigger 收窄为 click|always（R2-3 决议，hover 移除）
     - **R.5 图元底座**：primitives.ts 一文件产六图元几何（低段数 16/8）+ 默认材质（PRIMITIVE_DEFAULT_COLOR）；registry 按 PRIMITIVE_KINDS 循环注册 'Box'/'Sphere'/… 每种图元一个分组 key；starter scene-data.json 重写 v3——保留区（version/meta/scene/camera PerspectiveCamera [8,6,10] lookAt [0,1,0]/lights DirectionalLight_001+AmbientLight_001/controls/renderer）+ 业务区（Box:[ground 40×40]、cars:[car_01 status normal + card always、car_02 status alarm + card click]、examples:[example_01 spin]），资产用 example.glb（R1-2 决议），params 净化无任何渲染字段
     - **R.6 编辑器视觉层**：`__visuals` 保留 key；VisualOverride {color/metalness/…/side + castShadow/receiveShadow/visible}；PropertyPanel 材质分区/物体开关（显示/投影/受影）全部经 `update({__visuals:{[id]:…}})` 落库（undo 可恢复），load 从 sceneEngine.getVisual 读回；serialize 自动携带 __visuals（空则删 key）；strip-edit 剥离+转录清单归批次 3
     - **R.7 存量联动**：SceneHandle.update 签名 TreeSceneFragment；Bridge rebuild = 整份快照 remove 全部当前 id 再喂（幂等 upsert 天然去重）；removeObjects 直喂 {remove}；example handler（windTurbine 泛化）注册 'cars'+'examples' 双分组共享资产工厂（status 查 stateMaterials[type]、spin 走 onFrame）；createScene serialize 重建分组字典 + 清除陈旧 key + lookAt=controls.target（R2-7）；EnvironmentEngine 去掉 preset 参数；main.ts/edit-main.ts/Toolbar（复制+加图元改分组 key form）/OutlineTree（分组平铺）/LayoutGizmo（getNodeType→分组回写）/AlignmentService（patch 按分组聚合）/edit-main Ctrl+D（getNode+getNodeType）全部适配
     - **用户打断质询（执行中，确认有效）**：starter scene-data.json 的 params 里出现 castShadow/receiveShadow——违反 v3 核心「数据只有业务属性」，且属后端覆盖类 bug（生产 params 推送会静默抹掉渲染开关，与被否决的"transform 混入 params"同类）。修正：① params 全净化；② 阴影默认值归代码——registry/example handler 的 applyShadowDefaults（traverse 全部 mesh cast+receive=true）；③ 编辑器个体开关统一走 __visuals（VisualOverride 扩三字段，applyVisualOverride 处理 root.visible + traverse 阴影标志）。原则固化：**params 只放业务字段（后端推什么放什么）；渲染默认值在代码；个体差异在 __visuals（交付转录进代码）**
     - **连带发现与修复**：① examples/cars 分组 handler 注册晚于 buildTree 节点被 warn 跳过——入口模式定为「createScene → registerHandler → 按数据原样重喂业务分组（幂等 upsert）」，main.ts/edit-main.ts 落地；② EnvironmentEngine 还引已删的 EnvironmentPreset（TS2305）；③ SceneEngine.attachObject 漏写 type（TS2345）；④ materials.ts/EnvironmentEngine 注释与文件头同步 v3 语义
     - **R.8 验证**：vue-tsc --noEmit 绿 / npm run build 绿（edit-main chunk 80.13 kB gzip 20.58，铁律隔离 grep 零命中）/ eslint 0 errors（49 warnings 均为既有基线：no-continue/object-curly-newline/__visuals 命名约定豁免类）/ headless Edge 冒烟（scripts/smoke-r.mjs，Node 22+ 原生 WebSocket 连 CDP 端口 9223，swiftshader）**SMOKE PASS**——S1 渲染（4 物体、groups=[Box,cars,examples]、fps>0 活性断言）、S2 卡片 DOM×4、S3 幂等（r1.created=2/r2.created=0/r2.updated=2）+ remove（rm.removed=2、数量复原）、S4 applyState 贴图（car_01 material.map → localhost:5199/assets/textures/example.jpg）、S5 serialize 分组字典完整含 cars
     - **冒烟技巧沉淀**：① Node ≥22 有原生 WebSocket，CDP 冒烟无需 puppeteer；② swiftshader 下 canvas drawImage 拿不到 WebGL 前缓冲（preserveDrawingBuffer:false），像素断言不可靠——改用 renderLoop.getStats().fps 活性断言；③ `window.__gts3d` 只在 edit-main 挂（DEV 守卫），冒烟走 ?edit=1；④ handler 后注册的分组必须重喂——v3 幂等 upsert 让「注册后整组重喂」成为零成本的标准入口模式
     - **R.9 INTEGRATION_GUIDE 全量重写**：v3 语义（key:Array 单一结构/保留区+业务区/节点字段表/不存在字段清单）、内建分组表（图元六种+asset）、三大二开任务（换模型/写 handler/状态视觉 materials.ts/卡片内联）、handle API 与生产数据接入（轮询+MQTT 代码示例、remove 先行→upsert→params 整块替换语义声明）、__visuals 交付转录章节、FAQ 更新（"想改物体颜色不是改数据"）
     - **批次 R 收尾增强（同日，用户两项反馈「卡片要有内容、加低模树」）**：
       - **空卡片根因**：ExampleCard 期望 title/value props，而卡片系统注入的是 params+id——params 没有这些字段，渲染成空壳。修复：ExampleCard 重写为直接渲染业务 params（name/status/speed/id）——标题=name 回落 id、状态徽章（运行/告警/检修，配色与 materials.ts 状态语义同源）、速度行、编号行；scene-data.json cars 组补 name 业务字段（巡逻车 01/02），card offset 1.0→1.4（卡不压车顶）
       - **低模树（初版载体错误，用户质询后重构）**：用户质询「低模不是直接写代码在 tree-handler 里写就可以了吗，还要生成 glb 吗？以后自然语言找不到树模型降级简模时也是生成 glb？」——质询有效。初版写了 make-tree-model.mjs 生成 tree.glb（70 三角面），违反 Spec §4.5 降级阶梯第 5 层（LLM 直写代码）自己定的序：GLB 不可 review 不可 diff、改一棵树要重跑脚本、且「会生成 GLB 的脚本」会误导后续自然语言流程跟着造二进制。重构：删除 tree.glb 与 make-tree-model.mjs；新建 handlers/procedural/tree.ts——three.js 图元几何组合（CylinderGeometry 干 + 三层 ConeGeometry 冠，~百面，业务 params 可调 trunkColor/foliageColor/height），挂 trees 分组，handlers/index.ts + scene-core/index.ts 导出，两入口注册 + 重喂名单加 trees；scene-data.json 树节点去 assetId（纯代码物体无资产引用）。**规则固化（GUIDE §3.1）：简模/组合体降级 = 写 handler 组合图元，GLB 管线只留给美术资产（贴图/绑定/动画）**
       - **复验证据**：eslint 0 errors / build 绿 / SMOKE PASS——groups=[Box,trees,cars,examples]、trees=5 全渲染；S2 卡片内容、S3 幂等、S5 serialize 分组全部保持
       - **冒烟强化**：S2 从数 DOM 个数升级为内容断言（texts 含「巡逻车」+status 徽章文案）、S1 加 5 棵树存在性断言（防 asset 分组回归）
       - **eslint scripts/ 覆盖块**：JS 段 no-console:error 误伤 CLI 工具（冒烟/模型生成的 console 是输出接口）——加 scripts/**/*.mjs 覆盖（no-console/no-magic-numbers/line-comment-position/id-length off，魔数即二进制协议常量）；make-tree-model 两处 for 单语句 curly 修复
       - **复验证据**：eslint 0 errors / build 绿 / SMOKE PASS——S1 objCount=9、trees=5、groups=[Box,asset,cars,examples]；S2 卡片内容「巡逻车 01运行速度1.2 m/s编号car_01」等两张、titled=true；S3 幂等保持；S5 serialize 含 asset 分组
  17. **批次 R 复审修复（2026-10-09，review agent 全量 24 文件 correctness 审查后修复，commit c0a32ad）**：
     - **P0 原地更新抹字段**：updateNodeInPlace 对 card/params/parentId 用 `?? undefined/null` 兜底——违反 TreeSceneFragment 契约「字段全部可选，缺的不动」。触发链：Gizmo 拖拽/属性面板变换/对齐分布只发 {id, position, rotation, scale} → car 节点 params/card 被抹 → 保存即丢业务数据，redo 重喂时 handler 读不到 params.assetId 返回空组（车整个消失）；有 parentId 的节点被拽回场景根。修复：三字段改 `!== undefined` 判定（undefined=不动；显式值/null=替换），transform 字段同时回写 entry.node
     - **P1×3 更新通道缺口**：① 加灯 lightCounter 从 0 起步撞 starter 已有 id（DirectionalLight_001）→ replaceAll 先删后加把调过参的旧灯顶掉（阴影静默死）——改扫描已有 id 取空闲序号；② 卡片 mountCard 已挂载即 early-return，无 props 更新路径——生产推 params 卡片 UI 永远停在创建时快照（v3 核心用例失效）——已挂载分支原地重挂组件拿新 props + 同步 offset + trigger 变化重算 visible；③ applyState 只在 GLB 加载 then 里调（create-only），推 params.status 车不变色——新增 SceneEngine.onNodeUpdated 钩子（params 原地更新时触发），example handler 重放状态视觉 + spin 开关
     - **P2×8**：applyFragment 无父先建排序（跨分组组树每次 undo 都拆散挂回根）——pending map + 递归 visit 父先处理；recreateNode 换类型重建孤儿化子节点实体——重建后子实体重挂新实例；多材质 mesh 三条视觉路径全被塌缩成 material[0]（「检查了数组、写回时毁掉数组」）——map 克隆按序替换；spinners 无清理（孤儿实例每帧空转）+ 同 id 重建竞态（旧加载 then 抢注）——onNodeRemoved 清理 + 加载代际令牌；removeObject 不释放资源（tree/图元 handler 每实例 geometry/material 漏 GPU 内存）——disposeInstance 按 userData.isClone 标记跳过 GLB 共享 clone（AssetEngine.getInstance 打标）；并发同资产加载重复下载——loading map 去重；smoke 判定漏洞（默认模式必 FAIL 因 __gts3d 只在 edit-main；S4/S5 不计入 pass）——main.ts 也挂 DEV 调试口 + S4/S5 计入 + 新增 S6 P0 回归断言（transform-only 片段后 params/card 必须保留）；edit-main Ctrl+D 无 position 节点 TypeError——`?? [0,0,0]` 兜底；相机视点输入是死的（setLookAt 不动 controls.target，每帧 update 拉回）——lookAt 编辑同步 controlsEngine.setTarget
     - **P3 快赢**：tree.ts 冠层半径双重乘 node.scale（干冠比例随 scale 失真）——删重复乘法；clickToggled 卸载时不清（id 复用带脏态）——unmountCard 清理；ortho→persp 往返丢 fov/near——CameraEngine 记忆 lastPerspFov/Near。**P3 未修（记录在案）**：两入口重喂名单硬编码双份（examples/cars/trees）；applyState 贴图 promise 落到已替换材质的静默丢失；recreateNode 双发 onNodeCreated（attachObject 已发，显式再发——现在 recreateNode 已重写不再双发，此项已顺带消除）；registerAssetStates 先于首次加载静默 no-op
     - **复审方法沉淀**：后台 agent 全量读 24 文件 + 顺调用链交叉验证（含清单外 callee：CameraEngine/ControlsEngine/RenderLoop/LightEngine/RaycastEngine/RendererEngine/SelectionService/SaveService）；结论——创建/建树/undo 骨架健康，问题集中在「原地更新」路径（系统性盲区：单人写 create 路径时 update 路径无人对照契约）
     - **复验证据**：vue-tsc 绿 / build 绿 / eslint 0 errors / SMOKE PASS 双模式（主模式 + ?edit=1）——S6 新断言直验 P0：transform-only 片段喂 car_01 后 params（assetId/name/status/speed）与 card（type/trigger/offset）完整保留；S1-S5 全部保持

  18. **批次 2 执行记录（2026-10-09，2.1–2.5 全部完成）**：
      - **门禁分级（用户裁决）**：§4.2 validate-model 默认值改两档（art 默认 / strict）——性能类（面数/贴图/几何/节点）硬阻断，art 档阈值放宽（主角 50k / 道具 5k、贴图 2048·8 张）；约定类（命名/原点/高度）art 档默认告警、strict 档阻断。§4.2 表格已同步。推理：美术资产以不透明实例加载，约定纪律真正保护 AI 生成资产（降级阶梯第 4/5 层 → strict）。偏差写库 manifest（`gate.deviations`）。
      - **manifest schema 扩展**：§4.2 上传 schema 合并 §4.9.4 双形态——data[] 条目新增可选 `id`（默认由 file_name 派生，须 `^[a-z][a-z0-9_]*$`）、`textures`（key→包内相对路径）、`states`（StateVisual）；校验：states.map 必须命中 textures key、file_path/thumbnail/textures 引用文件必须齐全。白模 UV 缺失由 validate-model 的 `uvMissing` 字段支持（供双形态入库判定）。
      - **库布局（§4.1 树补充）**：新增 `assets/textures/<id>/`（多状态贴图集落点）；新增 `samples/`（样例包 + 可读 manifest 模板）。modelPath 统一 `assets/models/<id>.glb`（gltf 多文件落 `assets/models/<id>/`）。
      - **零依赖实现**：自研 ZIP 读（stored+deflate，EOCD/中央目录/本地头解析 + zip-slip 防护）与写（deflate 优先回退 stored，`zlib.crc32`）——往返字节一致；GLB 解析（JSON/BIN chunk）+ PNG/JPEG/WebP 尺寸头解析；skill 根无 node_modules（Node≥22）。
      - **报告落库**：validate-model 报告（含 limits/violations/warnings）随条目存入 `manifests/*.json`，供批次 3.1 build.mjs 读预算估算（R1-3）。
      - **索引格式**：`assets/search-index.json` = `{version,builtAt,profile:'ngram-tfidf-v1',docCount,docs[],vocab[],idf[],vectors[]}`；docs 字段 = §4.2 检索条目字段；切分 = CJK unigram+bigram / 拉丁整词，TF-IDF + L2 归一化余弦。
      - **负面测试证据**（临时夹具，已清理）：8 项全部按期望退出码——坏 GLB + `--strict`（门禁阻断）/ 非模型文件（exit2）/ 引用缺失文件 / states.map 缺 key / 非法 id / 跨包重复 id / art 档约定告警放行 / 合规包 strict 通过。

  19. **批次 M 执行记录（2026-10-09，M.1–M.7 全部完成，四道门禁全绿）**：
      - **M.1 types.ts**：新增 `MaterialType`/`MaterialSpec`（§4.10.2 参数契约 TS 形态，全字段可选 + type 必填）/`MaterialLibEntry`；`RESERVED_KEYS` 补 `__materialLib`；`SceneData`/`TreeSceneFragment` 增 `__materialLib?`；`VisualOverride` 扩至 `Partial<Omit<MaterialSpec,'type'>>` + `materialType`/`libraryRef`（内联与引用互斥）
      - **M.2 materials.ts**：`createMaterialFromSpec`（三类型实例化 + 标量/颜色/Vector2/枚举反序列化 + attenuationDistance null↔Infinity 还原）+ `applyMaterialTextures`（贴图槽异步换 + colorSpace 三分桶 + `texture.channel` 第二 UV）+ `migrateMaterialSpec`（类型切换迁移：共有保留、特有取默认、Standard→Physical 保留 roughness/metalness）+ `applyMaterialScalars`（热改用）；`applyVisualOverride` 重构（见下 D4）
      - **M.3 edit/MaterialLibService.ts**：库 CRUD（写穿 `__materialLib`，经 bridge.commit/commitLive → undo 可恢复）+ 实例注册表（mat_id→单例）+ 引用追踪（__visuals 反查）+ 热更（同类型标量热改 / 类型变更重建）+ 4 种子（glass/carpaint/brushed_metal/velvet，未被引用不转录）+ syncAll（订阅 bridge 变更重挂共享实例，幂等）+ `seedMaterialType`（面板类型种子：无内联视觉时从物体活材质取类型名）
      - **M.4 PropertyPanel 材质分区改造**：材质库下拉（未入库/引用中）+ 内联名输入「另存为」+「断开链接」+ 类型下拉（原生类名）+ 参数分组折叠（基础默认展开 / Standard 或 Lambert / Physical 进阶六组默认折叠）+ 贴图槽区按类型显隐（上传/清除）+ transmission>0 opacity 提示；参数走数据驱动（ParamD 描述符表 + v-for），改造限单文件
      - **M.5 vite dev middleware**：`POST /__gts3d/upload-texture`（binary body + x-filename 头 + 扩展名白名单 png/jpg/jpeg/webp/avif + basename sanitize 防路径穿越 + 重名 `wx` 后缀）；`apply:'serve'` 不进 build；返回 `{url:'assets/textures/<name>'}`
      - **M.6 冒烟扩展**：smoke-r.mjs 增 S7–S17——类型切换 instanceof / 色彩空间（map=srgb、normalMap=''）/ 共享实例 === / 改库热更两物体同变 / serialize 带 __materialLib+libraryRef+种子 / undo 覆盖库编辑 / 上传端点→map 生效 / attenuationDistance null↔Infinity 往返 / 同类型 patch 保贴图 / 图元默认色保留 / 跨类型重建继承贴图槽
      - **M.7 门禁 + 文档**：INTEGRATION_GUIDE §6 重写（__visuals + __materialLib 双私有区转录）+ 新增 §6.1 `libraryMaterials` 段 + §3.3 补 createMaterialFromSpec 说明
      - **执行偏差（Plan-Execution Diff）**：
        - **D4 定案（内联材质双路径，用户质询后修订）**：~~内联材质字段存在即经 `createMaterialFromSpec` 重建~~ → 初版重建会导致「GLB 改金属度丢原贴图」「图元改金属度丢默认色（白）」。用户质询否决后定案为双路径：**同类型 → 克隆现有材质 + `applyMaterialScalars`/`applyMaterialTextures` 打补丁**（只改显式字段，GLB 内嵌贴图、图元默认色全保留；GLB 实例材质与缓存根共享，必须克隆后改）；**跨类型 → 工厂重建 + `inheritTextures` 继承兼容贴图槽**（base 有、目标类型也有、spec 未显式给的槽拷贝引用，换 Physical 不丢 map/normalMap）。配套 `MaterialLibService.seedMaterialType`：面板无内联视觉时从物体活材质取类型名作种子，避免「默认显示 Standard 与实际不符 → 一动滑杆触发跨类型重建」
        - **D1/D3 落地**：`__materialLib` 真相源落 SceneEngine（对称 __visuals）；`applyFragment` 采用「提供即整表替换」语义（条目与节点无生命周期耦合，undo 快照为全集）；Bridge.rebuild 对缺 key 显式补 `{}` 保证 undo 能清空库
        - **新增 SceneEngine.replaceVisual**（不在 Plan 签名内）：覆盖式写视觉层（不合并）——库「链接/断开」需清理互斥字段（libraryRef vs inline），applyVisual 的合并语义不够
        - **新增 DEV 调试口 `__gts3dEdit`**（edit-main，DEV 守卫）：冒烟需触达 MaterialLibService（__gts3d 是 handle，不含 edit 服务）
        - **M.6 断言 11 项（原清单 7 项外补 S14–S17）**：attenuationDistance 往返 + D4 双路径三条（同类型保贴图/图元保色/跨类型继承贴图）单列
        - **面板「另存为」用内联输入框**（非 window.prompt）：eslint `no-alert: error` 禁 prompt
        - **opacity<1 且未显式给 transparent 时自动开启透明**：保持旧内联行为（透明显式值优先；§4.10.2 仍列 transparent 为独立参数）
      - **复验证据**：vue-tsc 绿 / build 绿（edit-main 独立 chunk 93.22 kB gzip 24.55，二开主包 750.23 kB 不含编辑器码，铁律隔离保持）/ eslint 0 errors（warnings 均为既有基线）/ headless Edge 冒烟 **SMOKE PASS**——S1–S6 保持；S7 lambert/physical/ior、S8 mapCs=srgb & normalCs=''、S9 sharedOk、S10 sameInstance+bothChanged、S11 hasLib+hasRef1+hasSeeds、S12 c0/c1/c2=#00ff00/#0000ff/#00ff00、S13 httpOk+hasMap、S14 serNull+instInfinity、S15 beforeMap+mapKept+roughOk、S16 colorKept(#9cabb8)+metalOk、S17 type=MeshPhysicalMaterial+mapInherited+roughOk 全 true

  20. **批次 T 执行记录（2026-10-09，T.1–T.6 全部完成，四道门禁全绿）**：
      - **契约实现**：`OutlineTree.vue` 全量重写（限单文件）——分区森林（顶层祖先所属分组，跨分组子随父分区）+ 搜索过滤（命中 + 祖先链，强制展开）+ 折叠集 + 行内 eye/lock；`VisualOverride` 扩 `locked?: boolean`（materials.ts；同步 MaterialLibService 的 `NON_MATERIAL_KEYS` 与 `keepNonMaterial`，防材质链接/断开时丢锁定态）。
      - **T.5 接线设计决策**：core 不感知「锁定」语义——`handle.pick(x, y, filter?)` 增**可选过滤谓词**（core 只当不透明谓词与 `isPickable` 合成执行，未改 RaycastEngine 签名）；SelectionService 传 `id => getVisual(id)?.locked !== true`；LayoutGizmo.syncSelection 命中锁定则 `detach()`（不挂手柄）。锁定态可从视觉层读（编辑侧），故无 core 改动语义泄漏。
      - **UI 细节**：eye 按钮祖先隐藏呈继承态（`opacity 0.35` + tooltip「父节点已隐藏」）；lock 按钮激活态 accent 着色；分组根图标映射（内建 SVG 图标集，未知名回退立方体）；长 SVG 路径提取为脚本常量（满足 max-len + 保持模板行短）。
      - **命名冲突处理**：smoke-r.mjs 既有 S15–S17（后续 materials 精化轮新增）已占编号，批次 T 断言顺延为 **S18–S21**。
      - **复验证据**：vue-tsc 绿 / build 绿（edit-main 独立 chunk 100.34 kB gzip 26.91，二开主包 750.27 kB 不含编辑器码，铁律隔离保持）/ eslint 0 errors（222 warnings 均既有基线类：no-continue / __visuals 命名 / object-curly-newline / no-use-before-define）/ headless Edge 冒烟 **SMOKE PASS**——S1–S17 保持；**S18** 树层级（groupEls=[Box,trees,cars,examples]、childDepth=1/groundDepth=0、childParent=ground、nestedOk）、**S19** 搜索（onlyTrees + groundHidden + emptyShown + 清空恢复 12）、**S20** 显隐（hidden=false + objHidden + shownAgain）、**S21** 锁定拾取（lockedFlag + pickSkipped + selLocked=false + selUnlocked=true）全 true。
      - **冒烟设施清理**：dev server（端口 5199）已关闭；S13 上传测试产物 `public/assets/textures/smoke.png` 已删（`example.jpg` 为 starter 资产，保留）。

  21. **批次 T 代码 review 修正（2026-10-09，review 后修 3 项实缺陷 + 2 项冒烟补强）**：
      - **修 1 · applyFragment parentId 环无限递归**（SceneEngine.applyFragment）：片段含 `a.parentId=b, b.parentId=a` 类脏数据时，父先建递归 `visit(a)→visit(b)→visit(a)…` 栈溢出崩引擎。对照 buildTree 已有 `created` 集合守卫，applyFragment 漏防——增 `visiting` 集合（递归父前标记，环成员跳过），且每次外层 item 前 `visiting.clear()` 保证「已建父」不误判为访问中。环内两节点仍正常建出（挂根 + warn），不再崩。
      - **修 2 · 纯开关增量重放材质（会话级克隆泄漏）**（materials.applyVisualOverride + SceneEngine.applyVisual）：`applyVisual` 原以**合并后**的整条 override 调 `applyVisualOverride`——材质已编辑物体（visuals 含 materialType/参数）此后每次 eye/lock/物体开关 update 都令 `hasMaterial=true` → `applyInlineMaterial` 再 clone 一份（旧 clone 不释放）+ 贴图异步重赋，连点 N 次 = N 个孤儿材质。修复：`applyVisualOverride` 增第三参 `scope: 'full' | 'switches'`；`applyVisual` 判增量是否含材质字段（`materialType` 或任一非 NON_MATERIAL_VISUAL_KEYS 键），纯开关走 `'switches'`（只应用 visible/阴影，不碰材质）。`NON_MATERIAL_VISUAL_KEYS` 由 materials.ts 导出（消除第二份真相源隐患，与修 3 同源）。`replaceVisual` 重建路径仍走 `'full'`（不受影响）。
      - **修 3 · PropertyPanel reserved 集漂移**（PropertyPanel.vue）：本地硬编码 `['version',…,'__visuals']` 漏 `__materialLib`（M 批次 RESERVED_KEYS 补过），当前被 `Array.isArray` 守卫掩盖（库是 Record 非数组）——改 `import { RESERVED_KEYS }` 统一真相源，删本地副本。
      - **冒烟补强**：新增 **S22** parentId 环守卫（a↔b 脏数据 → 两节点均建出 + 无异常）、**S23** 纯开关增量不重放材质（材质已编辑物体连点显隐/锁定 → `material` 实例 `===` 不变 + hiddenOk + 颜色保持）。
      - **复验证据**：vue-tsc 绿 / build 绿（edit-main 100.34 kB gzip 26.91，二开主包 750.49 kB 不含编辑器码，铁律隔离保持）/ eslint 0 errors（223 warnings 均既有基线）/ headless Edge 冒烟 **SMOKE PASS**——S1–S21 保持，**S22** noThrow+bothCreated、**S23** sameMat+hiddenOk+colorOk 全 true。
      - **review 未采纳项（记录在案，留待裁决）**：① 锁定物体仍可被 Delete 删除（Spline 惯例应挡，待裁决）；② Ctrl+D 复制不带 __visuals（副本丢材质调参/锁定）；③ 点已选中物体（无 Shift）= 取消选中（Spline 保持选中）。三项为产品语义选择，非缺陷。
      - **review 观察项（未动）**：编辑态点击锁定物体仍触发卡片 click（core 卡片监听不感知编辑态）；每次 bridge state emit 触发全量 serialize ×4（starter 9 节点无感，大场景需记账）；Spec §4.7 T.5「SelectionService（框选跳过）」措辞与实际不符（代码库无框选，实为 click-pick 过滤谓词）。
  22. **批次 T review 裁决落地（2026-10-10，#21 未采纳三项 → 用户裁决全部采纳 + 单源化重构）**：
      - **修 4 · 删除挡锁定**（Bridge.removeObjects）：过滤 `getVisual(id)?.locked === true` 的 id 不删（锁定语义=防误改，删除最破坏性；Spline 锁也挡删）；全锁定时 early return 不产生空撤销步；**选中保持**——过滤后 selection 收敛为锁定幸存者（不再 clearSelection 一刀切）。级联裁决：**父删除带走锁定子**（引擎级联本就整树删，跳过锁定子会留孤儿链，不做重挂）。
      - **修 5 · 复制单源化 + 带视觉层**（新增 Bridge.duplicateObject(anchorId)）：消除两处重复实现（Toolbar counter / edit-main Ctrl+D `Date.now()%10000`，id 方案还不一致）；副本 id 统一 `${node.id}_copy_${String(seq).padStart(3,'0')}`（Bridge.copySeq，重启编辑器后撞 id 时 applyFragment 幂等覆盖、安全）；**带 __visuals**（materialType/libraryRef/材质参数全继承，libraryRef 保留——共享实例本就是库用途）；**清 locked**（避免复制出删不掉的物体）；只复制单节点不递归子树；返回 newId。Toolbar 与 edit-main 两调用方全部改调 bridge.duplicateObject。
      - **修 6 · 点已选中保持选中**（Bridge.select）：无 Shift 点已单选物体时早退保持（原为清空选中）；取消选中走点空白/ESC——Spline 同款语义，消除 Gizmo 挂手柄时点到物体本体误丢选区。
      - **冒烟补强**：新增 **S24** 删除挡锁定（锁定物 removeObjects 后仍在+保持选中；解锁后可删+选区清空）、**S25** 复制带视觉层（副本存在/色继承 #ff8800/无锁定/材质实例色生效/偏移 +1/undo 可回收）、**S26** 已选中保持（同 id 再点不清空/切选正常/Shift toggle 正常/ESC 清空正常）。S26 初版断言笔误（toggle 两次期望写成 car_01，实为回到 tree_01）已修正。
      - **复验证据**：vue-tsc 绿 / build 绿（edit-main 100.47 kB gzip 26.92）/ eslint 0 errors（225 warnings 均既有基线）/ headless Edge 冒烟 **SMOKE PASS 26/26**——S1–S23 保持全绿，S24/S25/S26 全 true。
  23. **树行图标显隐策略（2026-10-10，用户验收反馈）**：eye/lock 按钮原 `opacity: 0.55` 常显导致视觉噪音——改 `.outline__act` 基础态 `opacity: 0`（hover 行才显，占位保留防布局跳动）；仅状态偏离默认时常显：`--off`（隐藏态）/`--on`（锁定态）保持 1，`--inherit`（父级隐藏继承态）保持 0.35 提示。纯 CSS 单行改动（OutlineTree.vue），JS `.click()` 不受 opacity 影响。复验：build 绿 + SMOKE PASS 26/26（S20/S21 交互链完好）。
  24. **批次 3 执行记录 + 验证期修复（2026-10-10，3.1–3.3 全部落地，gates.mjs 32/32 PASS）**：
      - **产出一览**：`scripts/build.mjs`（结构扫描 / 三条铁律 / import 白名单 / 场景预算静态估算）、`scripts/strip-edit.mjs`（剔除 edit 世界 + 剥离私有区 + 转录清单 + 产物自检）、`scripts/init.mjs`（母版复制 + 占位替换 + 资产注入 + 组件库 file: 依赖 + 首次门禁）、`scripts/verify/gates.mjs`（复跑设施）。
      - **偏差 1 · 预算估算实现路径**：checklist 3.1 括注"读 validate-model 报告"，实装为**读 scene-data.json 分组 + 逐个 GLB 解析乘算实例数**。理由：manifests 报告记单模型成本，而场景预算是"每个实例各算一次 draw call/三角面/材质槽"；报告还可能陈旧或缺失，构建期不应依赖导入期产物。R1-3 裁决原文（"定义 draw call 预算值 + 明确 1M/材质数由 build.mjs 读 scene-data.json 静态估算或 perf-fps 断言"）已覆盖此路径，括注为简化措辞。运行期 `perf-fps.mjs`（批次 4）仍为权威。
      - **偏差 2 · 铁律 2 公开入口白名单**（§4.8 R1-4 的落地）：§4.2 原文"仅 `@/scene-core` 一个入口"，按代码现状放宽为白名单 `@/scene-core`、`/types`、`/createScene`、`/handlers`。真正的铁律是**禁止深层 import 引擎内部**（`@/scene-core/engine/**`）；类型与装配函数属公开 API 面，卡死单入口会误判合法 edit 代码。核对 createScene.ts 实际导出面后定稿。
      - **偏差 3 · import 白名单范围**：裸模块白名单取前缀匹配——`vue`、`three`、`three/examples/jsm/`、`three/addons/`、`@a3d/a3d-components`；另校验 `package.json` 锁定版本（three=0.185.1 / vue ^3）。`@/` 前缀一律视为工程内引用，不进裸模块检查。
      - **偏差 4 · 铁律 3 双查**（`--stripped`）：不只是"无 edit 引用"，同时扫 `index.html` 不得含 `edit-main`/`?edit=1`、`scene-data.json` 不得含双下划线私有键（`__visuals`/`__materialLib`）——自检面条 = strip-edit 的产物约束面。
      - **修复 5 · Windows 小写盘符 spawn 致构建失败**（验证期发现，阻断级）：`init.mjs --deps copy|install` 时 `spawnSync(npm, …, {cwd: <手打路径>})` 把小写盘符（如 `d:\cyc\…`）原样交给子进程；Vite 的 html-proxy 键与解析出的 id 前缀因此不一致，构建报 `Could not load <abs>/index.html?html-proxy&index=0.js`。**定位过程**：① bash 自己的 `cd` 会把 cwd 规范化（实测 `node -e "process.cwd()"` 在 `cd d:/…` 后返回 `D:\…`），用户手跑 `npm run build` 不受影响——所以这是本脚本 spawn 才踩的坑，修在脚本层而非模板 vite 配置；② 变量分离实验：`realpathSync.native(abs)` PASS / 盘符大写 PASS / `process.chdir` 后不传 cwd **FAIL**（Node 的 chdir 保留传入大小写，不像 bash 做规范化）。**修法**：新增 `spawnCwd()`——win32 上 `realpathSync.native()` 取磁盘真实大小写（顺带规范化目录名大小写），失败回退盘符转大写；两处 spawn 全走它。**回归用例**：gates.mjs `--with-build` 段用小写盘符目标目录 + `--deps copy` 断言端到端 PASS。
      - **修复 6 · build.mjs 三角面计数器与 validate-model 分叉**（验证期发现）：build.mjs 自带的 `primTriangles` 只认 `mode === 4`（三角形列表），而 validate-model 的 `primitiveTriangles` 覆盖 mode 4/5/6（含条带/扇面）。同一 GLB 在"单模型门禁"与"场景预算"两处会算出不同的三角面数。修法：`validate-model.mjs` 导出 `reachableNodes`/`primitiveTriangles`，build.mjs 删除本地副本改为引用（消除双真相源，build.mjs 少 26 行）。副作用仅"多两个 export"，validate-model 的 CLI 行为不变（导入时不触发 main）。
      - **复验证据**：`node scripts/verify/gates.mjs` → **31/31 PASS**（正面 + 铁律 1/2/3 阻断 + 白名单 + 资产缺失 + 预算上下限 + 转录清单三类表逐项 + init 全部行为）；`--with-build` → **32/32 PASS**（含小写盘符端到端 `npm run build` PASS，dist/index.html 产出）。用例夹具建在系统临时目录、跑完自删（`--keep` 保留）。
      - **待裁决 · 代码注释中的文档指引**：本次新增/触及的脚本头部注释含 `Spec §4.x`、`R1-3`、`R2-5`、`D-4` 类指向 Spec 的编号引用（build.mjs 6 处 / strip-edit.mjs 2 处 / init.mjs 2 处 / validate-model.mjs 3 处），与既定规则"代码注释不写指向文档的指引（spec 决策编号等）"相抵（该规则的合法存放地是 Spec 本身）。**新写的 gates.mjs 已遵守该规则**；存量三脚本未擅自改（其中 validate-model.mjs 属已收口的批次 2 产物，跨批次改动需裁决）。建议项：批次 5 收尾时连同其余脚本一并清理，或本轮就地清理——**待用户裁决**。
  25. **第二轮 code review 修正（2026-10-10，10 项发现 → 修 9 + 1 呈报裁决）**：
      - **修 1 · boot 漏灌 __visuals（数据丢失级，最重）**（createScene）：boot 只回灌 `__materialLib` 漏 `__visuals`——重载编辑过的场景后视觉层全丢，且 serialize 见引擎 visuals 为空执行 `delete groups.__visuals`，下次保存把视觉编辑**永久剥掉**。修复：建树后逐条 `applyVisual(id, visual)` 回灌（对称材质库）。
      - **修 2 · VEC2_KEYS 漏 iridescenceThicknessRange**（materials.applyMaterialScalars）：漏键导致数组直赋 Vector2 属性 → NaN shader uniform（Vector2.copy(array) 读 undefined .x/.y）。修复：补进 VEC2_KEYS。
      - **修 3 · 贴图上传中文文件名 fetch throw**（PropertyPanel + vite middleware）：Headers 只收 Latin-1，中文 UI 下选 `木纹.png` 直接 TypeError 静默失败。修复：客户端 `encodeURIComponent` + 服务端 `decodeURIComponent` 双端。
      - **修 4 · copySeq 重启撞 id 覆盖前会话副本**（Bridge 构造器）：原注释断言「幂等覆盖安全」是错的——upsert 会把前会话副本的 transform 编辑清掉。修复：构造时扫存量 `*_copy_NNN` 取 max 续号（模式对齐 MaterialLibService.nextId）。
      - **修 5 · 材质面板 undo 后 stale**（PropertyPanel）：材质草稿只在 anchorId 变化时重载，undo/redo 不动选中 → 面板显示旧值，一动滑杆重提交把撤销冲掉。修复：材质区补 onState 回填（对齐变换区既有模式）。
      - **修 6 · 贴图异步竞态**（materials.applyMaterialTextures）：慢的旧加载完成后无条件赋值，覆盖新一轮结果。修复：WeakMap<Material, 代数> 守卫——赋值时校验代数未变，旧结果丢弃。
      - **修 7 · 冒烟上传产物污染**（smoke-r + init.mjs）：S13 每次 POST 累积 smoke-N.png 进母版并被 init 拷进每个生成工程。修复：冒烟 finally 清理 `smoke*/____*.png` + init copyFilter 排除 + 手删存量 4 个文件；S13 改用中文文件名顺带回归修 3。
      - **修 8 · spec 编号注释清理（产出卫生规则，#24 待裁决项就地落地）**：template/src + template/scripts + skill scripts 全量删除 `§x.x`/`批次 T/M/R`/`D4 定案` 类文档指引注释（语义保留、编号删除），残留 0。涉及 16 文件（materials/types/AssetEngine/createScene + edit 四件 + vite.config + build/import/init/strip/search/validate/build-search-index）。
      - **修 9 · NON_MATERIAL_KEYS 双真相源**（MaterialLibService）：本地重复声明 core 的 NON_MATERIAL_VISUAL_KEYS 六键集（漂移风险）——core index.ts 补导出，edit 侧删本地副本改 import。
      - **冒烟补强**：**S27** vec2 参数（iridescenceThicknessRange [120,480] → isVector2 且值精确非 NaN）、**S28** 视觉层回灌（写 __visuals → serialize 带 → 引擎态活 → 清除还原）。
      - **复验证据**：vue-tsc 绿 / build 绿（edit-main 100.63 kB gzip 26.98）/ eslint 0 errors（228 warnings 均既有基线）/ headless Edge 冒烟 **SMOKE PASS 28/28**——S1–S26 保持全绿，S27/S28 全 true；S13 中文文件名上传路径通过；textures 目录清理后仅 example.jpg。
      - **呈报裁决项（R10）**：编辑态点击锁定物体仍触发卡片 click（core 卡片监听不感知 locked；SelectionService 的拾取已跳过锁定但卡片 click 走另一条 pick 无过滤）。Spline 语义锁定=视口完全不可交互，建议对齐；但锁定物「树中可看属性」已是现有裁决，视口弹卡片算不算交互需用户定。
  26. **R10 裁决落地：锁定挡卡片（2026-10-10，用户裁决「对齐」）**：
      - **修**（createScene 卡片 click 过滤器）：pick 谓词从 `isPickable(id)` 改 `isPickable(id) && getVisual(id)?.locked !== true`——锁定物不触发自身卡片；ray 穿透锁定物命中他物时走互斥关闭逻辑（顺带收起已开卡片，语义更顺）。生产态 `__visuals` 已剥离，谓词恒通过零影响。与 SelectionService/LayoutGizmo 的锁定语义三处对齐（视口拾选/Gizmo 手柄/卡片触发全跳过锁定）。
      - **冒烟**：**S29** 锁定挡卡片（car_02 click 卡片：未锁点击弹开 → 锁定后同点位点击不弹+已开卡片被互斥收起 → 解锁恢复）。
      - **复验证据**（初版）：vue-tsc 绿 / build 绿（edit-main 100.63 kB gzip 26.98 不变，纯谓词追加）/ headless Edge 冒烟 SMOKE PASS 29/29。**注：S29 初版断言口径（display !== 'none'）后被批次 3 评审证伪——见 #28：R10 落地时的 SMOKE PASS 实为 applyVisibility 走错通道下的假绿（click 卡片初始漏显 + display 被渲染器每帧覆写，恰好让 S29 的三段判定全数通过）。**
  27. **批次 3 修复轮（2026-10-10，评审记录 6 的 CONDITIONAL PASS 修复门，用户裁决「可以的，修复吧」）**：
      - **P0 · strip-edit 自毁源工程**：`--out`==源 或 `--out` 为源父目录 + `--force` 时 rmSync 先清空源再 ERR_FS_CP_EINVAL crash。修：`relative(out, src)` 路径守卫（同路径或 out 是 src 祖先即拒绝，错误信息「输出目录不能是源工程或其父目录」），守卫在 rmSync 之前。
      - **P1-2 · 铁律 2 相对路径旁路**：新增 `resolveSpec(spec, fromFile, srcDir)` 导出——`@/x` 映射 src/x、相对路径以 fromFile 所在目录 resolve，归一为 `src/…` POSIX 形态；铁律 1/2/3 全部改按解析后路径判（`@/scene-core/engine/SceneEngine` 与 `../scene-core/engine/SceneEngine` 现在同罪）。ALLOWED_CORE_ENTRIES 值同步改为解析后路径四元组。铁律 3 的 `@/edit`/`@/editors` 误伤（P2-⑤）随之消除（路径级判定天然带边界）。
      - **P1-3 · 裸模块白名单未锚定**：`startsWith(p)` 改 `spec === p || spec.startsWith(p + '/')`（matchesBareWhitelist）——vue-router/vuetify/three-stdlib/three-mesh-bvh 阻断，`vue`、`vue/demi`、`three/examples/jsm/…` 放行。
      - **P1-4 · 未来 `__` 键泄漏**：铁律 3 从两键白名单改 `^__` 前缀族逐键检查（对齐 §4.9.2 双下划线族契约）；strip-edit 剥离侧同步改 `Object.keys(data).filter(k => k.startsWith('__'))` 全删（转录仍只认两个已知键）。
      - **P2 批量**：① `--max-*` 值校验（nextNum：非有限数/负数 → 用法错误 exit 2，首版闭包引用 for-循环变量 i 报 "i is not defined" 已修——改参数传递）② strip-edit scene-data JSON.parse 守卫（栈崩溃 → 优雅报错返回）③ init package.json/scene-data 双 JSON.parse 守卫 ④ spawnCwd UNC 前缀：`\\?\UNC\server\…` 先于 `\\?\` 剥离并还原 `\\` 前缀（网络盘 spawn 不再拿非法路径）⑤ init 多 tgz：`.filter().sort().at(-1)` 按文件名排序取最新（选择确定性）。
      - **S29 根因修复（模板侧，评审记录 6 顺手发现）**：`cards/registry.ts applyVisibility` 从 `element.style.display` 改 **`anchor.visible`**（CSS2DObject 三层通道）——three@0.185 CSS2DRenderer.renderObject 每帧按视锥重写 element.style.display（:232），DOM 样式通道活不过一帧；object.visible===false 走 hideObject 分支（:204）才是受控通道。修复后 click 卡片初始正确隐藏（此前初始漏显是「渲染器把业务态覆写成可见」的假象）。**连带断言口径修正**：S29 改经引擎读 anchor（`getObject(id).children.find(isCSS2DObject)`）；S2 卡片计数改引擎 anchor 数（click 卡片 visible=false 时不进 CSS2D DOM，DOM 计数会漏——domCount 保留为参考输出）。**S2 修复暴露的机制**：卡片元素进 document 的时机是 CSS2DRenderer 渲染循环（首帧 appendChild），非 mountCard——故「DOM 存在」≠「卡片挂载」，断言一律走引擎侧。
      - **P3（记录在案，批次 5 顺手）**：`__lib:count` 哨兵算术改直白计数；TRANSCRIPTION 值内 `|`/反引号转义；`--deps install` 失败 exit 码语义统一；gates spawn 超时 + fx-stripped-ok 前置断言。
      - **gates.mjs 扩容 31→40 用例 + 端到端 41**：新增 9 用例——白名单边界（vue-router/three-stdlib 阻断 + vue/three 子路径放行）、铁律 2 相对路径深层阻断 + 公开入口放行、`--max-calls` 非数字/负数拒绝、铁律 3 未来 `__` 键拦截、strip-edit `--out`==源拒绝且源完好、`--out`=源父目录拒绝且源完好、转录清单双下划线族整体剥离。
      - **复验证据（全绿）**：`gates.mjs` **40/40 PASS**（快模式）/**41/41 PASS**（`--with-build` 含小写盘符端到端 npm run build）；模板四道门禁——vue-tsc 绿 / build 绿（edit-main 独立 chunk 100.63 kB gzip 26.98，隔离保持）/ eslint 0 errors / headless Edge 冒烟 **SMOKE PASS 29/29**（S29 shownUnlocked/blockedWhenLocked/shownAgain 全 true）；冒烟产物清理（textures 仅 example.jpg）。**main 模式（非 --edit）SMOKE ERROR 为既有行为**：冒烟断言集 S9+ 依赖 `__gts3dEdit`（edit-only DEV 口），全量断言素来只在 `--edit` 下跑（批次 R 起的既定形态，非本轮回归）。

  28. **批次 MU 执行记录（2026-10-10，进行中）**：
      - **MU.1 · MaterialParams.vue 抽取**：参数分组（基础 / Standard 或 Lambert / Physical 进阶六组，折叠）+ 贴图槽区从 PropertyPanel 抽为独立组件。数据驱动渲染保留（`ParamD` 描述符表 + `v-for`）；只读 `spec` prop 显示、输入经 `change(key, value)` 回抛，父级（属性面板 / 编辑材质球弹窗）负责持久化（内联→写 `__visuals`；库引用→改库热更）。PropertyPanel 删去 MAT_DEFAULTS / 参数表 / matGroups / textureSlots / 取值辅助 / 事件包装 / 贴图上传（约 200 行），材质参数区改为 `<MaterialParams :spec="matSpec" @change="onParamChange" />`（onParamChange：写草稿 + `applyMaterial`）；材质库下拉 / 另存为 / 断开链接 / 类型下拉**保持不变**（MU.2 才替换为 MaterialSection）。
      - **样式**：参数 / 贴图相关样式（`.pp__grp*` / `.pp__tex*` / `.pp__num` / `.pp__range` / `.pp__hex` / `.pp__hint*` + `.ed-row` 内输入 flex 规则）随组件迁入其 **scoped 块**（子组件不吃父组件 scoped 规则，必须自带）；PropertyPanel 保留其余分区仍在用的原语副本（`.pp__num` / `.pp__range` / `.pp__check` / `.pp__hex` / `.pp__hint` / `.pp__matbtns`）。
      - **验证（行为保持型重构）**：vue-tsc 绿 / build 绿（edit-main 独立 chunk 100.93 kB，隔离保持）/ eslint 0 errors（227 warnings 均既有基线类）/ headless Edge 冒烟 **SMOKE PASS 29/29**（S1–S29 全绿，S7–S17 材质断言无回归）。
      - **诚实分级**：冒烟断言走引擎通道（`__gts3d`），**未直接断言面板 DOM**——MU.1 证据为三绿 + 应用正常 boot（edit-main 加载无 console 异常）+ 引擎级材质无回归；面板 DOM 结构与行为验收留 MU.8 六场景走查。
      - **MU.2 · MaterialSection.vue 新建**：Spline 心智模型的「材质」分区——材质条目（`.ms__swatch` CSS 近似缩略图（色块 + 高光渐变按 roughness/metalness 调 + 透射降透明）+ 名称 + 「N 个物体」常显徽标 + hover 出现的复制材质按钮）+ 点名称原地改名（回车：已引用→`renameEntry` / 无标题→`saveAs` 入库 + `nextTick` 自动聚焦；ESC 取消）+ 类型下拉（原生类名 + `TYPE_LABELS` 中文说明）+ ⊞ 材质素材按钮（`emit('open-palette')`，无监听者时静默——MU.3 接线）+ 引用 MaterialParams。`refresh()` 在 anchorId 变化 / `bridge.onState` 时重读引擎态（对标既有 onState 回填模式）。PropertyPanel 材质分区整体替换（删去材质库下拉/另存为/断开链接/loadMaterialSpec/applyMaterial 等约 200 行 + 对应 import 与死样式）。
      - **验证（MU.2）**：vue-tsc 绿 / build 绿（edit-main 独立 chunk 102.89 kB，隔离保持）/ eslint 0 errors（229 warnings 均既有基线类）/ headless 冒烟 **SMOKE PASS 29/29**；**一次性 CDP DOM 探针**（不入库、验完删除）：inline 态 `.ms__entry`/`.ms__badge`=「1 个物体」/`.ms__name`=「无标题材质」/类型三选项带中文/`.mp` 参数区在/⊞ 在/无复制按钮；`link('car_01','glass')` 后 `.ms__name`=「玻璃」、复制材质按钮出现 → PROBE PASS。
      - **已知边界（记录不阻塞）**：改名→`saveAs` 对「无内联视觉的默认材质物体」会入库存一个仅含 type 的空规格条目（§6 评审记录 5 PARTIAL ③ 语义；MU 不改 MaterialLibService 契约，用户先调参再改名的常规路径不受影响，MU.8 走查复核）。
      - **MU.3 · MaterialPalette.vue 新建**：材质素材弹层（fixed 覆盖层，脱离面板 overflow）——标题「材质素材」+ ✕ 关闭 + 遮罩点击关闭；工具行 [＋新建][搜索]；「我的材质库」行（缩略图 + 名称 + ✕ 删除 / ⚙ 编辑，hover 出）+「内置材质」chips（点应用）；点击条目 `link` 到选中物体并关闭弹层；删除引用中条目走**行内二次确认**（`no-alert` 禁 `window.confirm`）；内置/用户分组按 id 前缀启发判（`^mat_\d+$` = 用户新建）；`⚙`/`＋新建` 的 `edit` 事件已 emit（待 MU.4 接线）。PropertyPanel 接线 ⊞ → `paletteOpen` + 渲染 `<MaterialPalette v-if>`。
      - **验证（MU.3）**：vue-tsc 绿 / build 绿（edit-main 独立 chunk 106.32 kB，隔离保持）/ eslint 0 errors（MaterialPalette 单文件 lint 零问题）/ headless 冒烟 **SMOKE PASS 29/29**；**一次性 CDP DOM 探针**（不入库、验完删除）：弹层打开（标题「材质素材」+ 4 内置 chips + 搜索 + ＋新建）→ 搜索「玻」剩 1 → 点「玻璃」应用成功（弹层关闭 + 分区名变「玻璃」）→ ＋新建入「我的材质库」并 link 选中物体 → 引用中条目点 ✕ 出行内确认「1 个物体将保留外观转为独立副本」→ PROBE PASS。
      - **MU.4 · EditMaterialModal.vue 新建**：编辑材质球弹窗（编辑库资产本身，与选中解耦）——名称输入（change/回车 → `renameEntry`）+ CSS 近似预览球（92px）+ 「选择物体 (N)」按钮（引用者逐个累加选中 + 关闭看结果；N=0 禁用显示「无引用物体」）+ 类型下拉（原生类名 + 中文说明 + `migrateMaterialSpec`）+ MaterialParams（改参 → `updateEntry` 热更）。PropertyPanel 接线 palette 的 `edit` 事件 → `editMatId` + 渲染 `<EditMaterialModal v-if>`。
      - **MU.5 · seeds() 门控**：`MaterialLibService.seeds()` 从「仅缺的补」改为「库非空即跳过，仅空库注入」——因 `serialize()` 空库不写 `__materialLib` 键，「键不存在」在实现上等价「库为空」；效果：首建工程注入 4 种子、用户删除后（库非空）不再复活。
      - **MU.6 · editor.css 共享弹层原语**：新增 `.ed-overlay`（+ `--top` 叠层修饰）/`.ed-dialog`/`.ed-dialog__head`/`__title`/`__close`（Spline 玻璃风：`--ed-panel` + blur + `--ed-shadow`），MaterialPalette 与 EditMaterialModal 改用（各删去重复的 mask/dialog/head 样式块）。
      - **MU.7 · smoke-r 增 S30–S33**：S30 改名入库转引用（saveAs → 新条目 + link + spec 取自内联）；S31 复制材质脱离引用（disconnect → 内联且不受库热更影响）；S32 删库留外观（removeEntry → 引用者转内联 + 外观保留）；S33 种子删除不复活（removeEntry(seed) 后重调 `seeds()` 不补回）。S9–S14 回归保持。
      - **MU.8 · 门禁 + 冒烟**：vue-tsc 绿 / build 绿（edit-main 独立 chunk 109.00 kB，隔离保持）/ eslint 0 errors（228 warnings 均既有基线类）/ headless 冒烟 **SMOKE PASS 33/33**；**一次性 CDP DOM 探针**（MU.4 弹窗，不入库、验完删除）：⊞→＋新建→弹窗开（标题「编辑材质球」+ 预览球 + 名称「新材质」+「选择物体 (1)」）→改名提交入 `我的红漆`→点「选择物体」选中 car_01 并关窗 → PROBE PASS。
      - **执行中发现并修复 1 处实缺陷（批次 M 遗留，MU.7 的 S32 抓到）**：`MaterialLibService.removeEntry` 原用 `handle.update({ __visuals: {...} })` 写内联，而 `SceneEngine.applyVisual` 是**合并**语义（`{...existing, ...visual}`）→ 旧 `libraryRef` 被保留、未被清掉；D4 又「遇 libraryRef 跳过材质」→ 内联字段失效、物体挂到已释放/孤儿实例——**违反 §4.10.4 声明的「删除条目；引用者自动断开为 inline（保留外观）」**，也让 MU 删除确认文案「N 个物体将保留外观转为独立副本」名不副实。修复：改为 `this.handle.internals.sceneEngine.replaceVisual(nid, {...keepNonMaterial(cur), ...specToInline(entry.spec)})` 逐引用者**覆盖式**写入（libraryRef 不再残留）；lib 表的删除仍走 `handle.update({__materialLib})`，整体在同一 `bridge.commit` 内（undo 单步可回）。复验：S32 `aInline:true` + `colorKept:true`，SMOKE PASS 33/33。
      - **实现细节记录（不阻塞）**：CSS 近似缩略图（swatch 样式计算）与「类型名 + 中文说明」表在 MaterialSection / MaterialPalette / EditMaterialModal 内各自内联——未抽共享模块（恪守 MU 的文件清单，避免 Plan 外新增文件）；3 处若日后漂移再抽 `edit/materialDisplay.ts`。MU.5 门控实现措辞与契约「键不存在」的差异见上（serialize 空库不写 key → 等价「库为空」）。

  29. **批次 MU2 执行记录（2026-10-10，材质面板布局重做）**：
      - **背景**：MU.8 用户验收（§4.12.3 六场景走查）反馈——Spline 的材质面板是右侧浮出的浮动面板（无遮罩 / 可拖拽；材质素材与编辑材质球并排不重叠；材质列表一材质一行）；MU 落地的「居中 + 全屏遮罩对话框」（`.ed-overlay`/`.ed-dialog`）不符。经用户裁定成新批次 MU2（§4.14）。
      - **契约修订记录**：初稿 §4.14.1 写「右侧停靠纵向排列」；用户两张 Spline 实测截图（同两面板分别处于「同列上下」`479/273`+`479/414` 与「同行左右」`479/273`+`223/273`，`left`/`top` 一并给出）证明是**自由拖拽** → 契约改为「独立浮动 + 可拖拽 + 默认并排错开 + 不锁轴向」。
      - **MU2.1 FloatingPanel.vue**：`position:fixed` + 标题栏拖拽把手（pointerdown 记偏移 / window pointermove 更新 / pointerup 解绑，onBeforeUnmount 兜底）+ ✕ 关闭 + 内容插槽；**`<Teleport to=".edit-scope">`**——右栏 `.ed-panel` 的 `backdrop-filter: blur()` 按规范会对 fixed 后代立 containing block，叠 `overflow:hidden` 会把面板定位/裁剪都囚在右栏内；Teleport 到顶层（无 filter）既逃裁剪又继承 `--ed-*`。
      - **MU2.2 FloatingDock.ts**：`defaultDockPos(index, panelW)` → `x = 视口右缘 - MARGIN - panelW - index*(panelW+GAP)`、`y = 视口高*0.16`；PropertyPanel 给 palette(index 0)/modal(index 1) 传 x/y（两面板同 y 不同 x = 左右并排）。
      - **MU2.3 / MU2.4**：MaterialPalette / EditMaterialModal 换 FloatingPanel 外壳；**内置材质 chips → `.mpal__row` 一材质一行**（与我的材质库同构）；移除 `.mpal__chips`/`.mpal__chip` 样式。
      - **MU2.5**：PropertyPanel 的 `paletteOpen`/`editMatId` 保持独立——两面板可同开、互不关闭（此前 palette 是「应用即关」，仍保留 applyToObject→close，但开编辑球不再关 palette）。
      - **MU2.6**：editor.css 删 `.ed-overlay`/`.ed-dialog`/`__head`/`__title`/`__close`（MU.6 引入的居中遮罩原语作废）。**偏差**：浮动面板样式写在 `FloatingPanel.vue` 的 scoped 块（单组件所有权、自包含）而非 editor.css——与 §4.14.3 表「editor.css 加浮动面板样式」措辞略异。
      - **MU2.7 冒烟 S34/S35**：S34 两面板同开（⊞ 后 ＋新建触发编辑球）+ 无 `.ed-overlay` + 两 `.fpanel` rect 不重叠 + 拖拽把手存在；S35 一材质一行（玻璃/车漆为行、无 `.mpal__chip`、各行同 `left` 同列）。
      - **复验证据**：vue-tsc 绿 / build 绿（edit-main 独立 chunk 109.86 kB，隔离保持）/ eslint 0 errors（231 warnings 均既有基线类）/ headless 冒烟 **SMOKE PASS 35/35**；**一次性 Teleport/拖拽探针**（不入库、验完删）：`.fpanel` 的 `closest('.edit-scope')`=true、`closest('.ed-panel--right')`=false、`.ed-overlay` 计数 0、拖拽位移精确 (120, 60) → PROBE PASS。

### 评审记录 7（2026-10-10，批次 MU + 批次 MU2 代码评审（REVIEW EXECUTE），mandatory three-axis）

**评审范围**：批次 MU（MU.1–MU.8：MaterialParams/MaterialSection/MaterialPalette/EditMaterialModal + seeds 门控 + editor.css + smoke S30–S33 + removeEntry 修复）与批次 MU2（MU2.1–MU2.8：FloatingPanel/FloatingDock + 两面板换壳 + 一材质一行 + editor.css 删遮罩原语 + smoke S34–S35）。评审方式：Spec §4.12/§4.14 契约逐项对照代码 × 行为级推演（改名双触发守卫 / undo 快照时机 / 浅拷贝共享引用 / onState 回填时序）× 四道门禁 + 冒烟全量复跑。

#### Review Matrix

| # | 轴 | 检查项 | 结论 | 证据 |
|---|---|---|---|---|
| 1 | Axis-1 | 批次 MU 目标/验收（Done Contract + 六场景） | PASS | §4.7 MU 八项全 [x]；机器证据齐（本轮复跑三绿 + SMOKE 35/35）；六场景机器探针覆盖 + 用户走查已进行（反馈驱动 MU2，见 MU.8 注记） |
| 2 | Axis-1 | 批次 MU2 目标/验收（§4.14 三需求：右侧浮出/并排不重叠/一材质一行） | PASS | MU2 八项全 [x]；S34（bothOpen+noMask+不重叠+拖拽把手）/ S35（行+同列+无 chips）+ Teleport 探针（挂 .edit-scope、不在右栏、位移精确）；MU2.8 人工视觉走查待用户（诚实记录） |
| 3 | Axis-1 | §4.12 术语纪律（零自造词） | PASS | 「无标题材质/材质素材/我的材质库/内置材质/编辑材质球/复制材质/N 个物体」全部落码，无「未入库/断开链接/另存为」残留（PropertyPanel 删净，grep 零命中） |
| 4 | Axis-2 | §4.12.4 / §4.14.3 文件清单 | PASS | 9 文件全在清单内、零 Plan 外新文件；FloatingDock.ts 契约允许（「可为独立模块或 composable」） |
| 5 | Axis-2 | 数据契约零改动声明 | PASS（含已记偏差） | `__materialLib`/`libraryRef`/inline 互斥契约未动；MaterialLibService 仅 seeds() 门控（契约内）+ removeEntry 修复（P 级缺陷修复，§7 #28 已记）；strip-edit/build.mjs 零触及（grep 核实：`^__` 族剥离与材质预算计数不受 MU/MU2 影响） |
| 6 | Axis-2 | §4.14.3「editor.css 加浮动面板样式」 | **偏差（已记档）** | 实际写在 FloatingPanel.vue scoped 块（单组件所有权）——§7 #29 已记为诚实偏差，语义等价 |
| 7 | Axis-3 | removeEntry 修复正确性（undo 时机） | PASS | commit 先拍快照（旧 lib + 旧 libraryRef）再 apply（lib 表 update + 引用者 replaceVisual 覆盖式）；refs 在 lib 删除**前**采集（referencingNodes 读 visuals 不读 lib，顺序安全）；undo→rebuild→applyVisual(merge) 走快照全量重放无残留；S32 + S25（undo 复用）双向验证 |
| 8 | Axis-3 | 改名双触发（enter+blur） | PASS | commitRename 首行 `renaming.value = false` 幂等闸——enter 后 blur 再入直接 early-return |
| 9 | Axis-3 | onState 回填 vs 用户输入竞态 | PASS | MaterialSection/EditMaterialModal 的 refresh 与既有 PropertyPanel 模式一致（评审记录 5 #12 已验）；updateEntry 后 onState→refresh 回填的是刚写入的 spec（值等价，无视觉跳变）；vec2 经 vecVal 每次产新数组，无共享引用改写 |
| 10 | Axis-3 | seeds 门控语义 | PASS | 「库非空即跳过」≡ 契约「键不存在」（serialize 空库不写 key）；S33 验证删后不复活 + S11 验证首建注入（starter 无 __materialLib） |
| 11 | Axis-3 | 浮动面板交互健壮性 | PARTIAL（P3） | 拖拽/关闭/Teleport 均验证；边界缺口三项（见下 P3 清单），均低频低损不阻塞 |
| 12 | Axis-3 | 冒烟设施质量 | PASS | S30–S35 断言走引擎通道 + 面板 DOM 双轨（S34/S35 是首批面板 DOM 永久断言）；探针一次性脚本均删净（textures 目录仅 example.jpg、temp 无残留、端口释放） |

#### Overall Verdict: **PASS**

- 三轴无 FAIL；Axis-2 唯一偏差（样式落位）已记档且语义等价；无轴 3 高风险未解项。
- **P3 挂账（批次 5 顺手，不阻塞）**：① `defaultDockPos` 在 PropertyPanel setup 时一次计算——窗口先缩小再开面板，默认位可能出右缘（面板可拖回，且 v-if 重开不复位）；② FloatingPanel 拖拽无边界钳制（可拖出视口/负坐标）；③ 材质素材删除确认态下点行背景仍会触发应用并关面板（确认按钮有 `.stop`，行本体没有禁用）；④ 无选中物体时点材质条目=无操作但仍关面板。
- **开放项（非代码问题）**：MU2.8 的用户人工视觉走查（右侧浮出/并排/可拖/不挡场景/一行一项的真机观感）——机器侧已由 S34/S35 + 探针覆盖。
- 复验证据（2026-10-10 本轮全量复跑）：vue-tsc 绿 / build 绿（edit-main 独立 chunk 109.86 kB，隔离保持）/ eslint 0 errors（231 warnings 均既有基线类）/ headless 冒烟 **SMOKE PASS 35/35**。
- **评审方法沉淀**：纯 UI 批次的评审证据=「引擎通道断言（数据层无回归）+ 面板 DOM 断言（呈现层真实渲染）」双轨——只有前者会漏「组件根本没挂出来」类假绿，只有后者会漏「数据被写坏」类深伤。

### 评审记录 8（2026-10-12，批次 MU3 + MU4 + M2 + M2 修复轮 1–5 + M3 代码评审（REVIEW EXECUTE），mandatory three-axis）

**评审范围**：MU3（浅色主题+避让+收拢，§4.15）、MU4（条目直达素材库+排队模型+自适应，§4.15.5）、M2（GLB 子节点与多材质，§4.13）+ 修复轮 1–5、**M3（子网格局部变换，§4.13.7）**。评审方式：Spec 契约逐项对照代码 × 行为级推演 × 四道门禁复跑 × 三组一次性 CDP 探针（S46 逐步定位，验完删）。

**评审前状态澄清（重要）**：M3 的代码实现**实际已全部落码**（materials.ts slots transform 字段 / LayoutGizmo 槽位吸附+写回 / PropertyPanel 可编辑变换 / GUIDE §6.2 transform 注意事项 / smoke S46 断言），但 spec 的 M3.1–M3.6 checklist 全未勾、无执行记录——**上一会话实现了 M3 但未完成验证、未 Reverse Sync**。本次评审把 M3 一并纳入（代码已重读核实）。

#### Review Matrix

| # | 轴 | 检查项 | 结论 | 证据 |
|---|---|---|---|---|
| 1 | Axis-1 | MU3 目标/验收（浅色+避让+收拢三需求） | PASS | MU3.1–MU3.7 全 [x]；S36（浅色亮度断言 panelLum 255）/S37（浮动×固定零交集）/S38（分区收拢+点条目出编辑面板）全 true；editor.css 九令牌浅值、index.html #eef0f3、starter scene-data 同步核实 |
| 2 | Axis-1 | MU4 目标/验收（直达素材库+面板排队+窗口自适应） | PASS | MU4.1–MU4.4 全 [x]；S39（⊞ 直达/紧贴不重叠/退避）全 true；三次验收反馈修复（同位→排队模型→resize 钳制+纵向下移档）均落码并有双序/窄窗探针记录 |
| 3 | Axis-1 | M2 目标/验收（子网格可见可编辑、单槽换材质/隐藏、槽位转录） | PASS | M2.1–M2.8 全 [x]；S40–S44 全 true（S44 契约级断言：8 mesh resolveSubMesh 与 listSubMeshes key 全量比对）；strip-edit ①′ 槽位表 + GUIDE §6.2 落码核实 |
| 4 | Axis-1 | M2 修复轮 1–5 全闭环 | PASS | F1 树点子网格（meshCache 空不缓存+mat.type 白名单）/F2 容器组头/F3 scale 0.0056+GUIDE FAQ/F5 v-else-if 互斥/F6 子网格选中态/F 修复轮四三分支/修复轮五环境陈旧——全部落码核实（scene-data person scale 0.0056 实证） |
| 5 | Axis-1 | M3 目标/验收（§4.13.7：slots transform、Gizmo 吸附、面板双向） | **FAIL（数据层过、运行时半过）** | 探针分段验证：gizmoAttached ✓（attach Ch23_Hair SkinnedMesh）/meshMoved ✓（直写 slots 即时生效 0.5）/slotLanded ✓/serRoundTrip ✓/panelEdit ✓（面板输入 0.3 落库）/**meshAfterUndo ✗**——undo 后数据层正确恢复但 mesh 实际位置未回 0.5，见 #8 |
| 6 | Axis-2 | §4.13.1 数据契约（slots 扩展，v3 兼容） | PASS | VisualOverride.slots 嵌套 VisualOverride、position/rotation/scale 局部变换字段、NON_MATERIAL_VISUAL_KEYS 补全、RESERVED_KEYS 不受影响；strip-edit `^__` 族剥离语义不变（slots 在 __visuals 内天然覆盖） |
| 7 | Axis-2 | §4.13.2 核心层签名（buildReport.meshes/listSubMeshes/resolveSubMesh/applySlotLink） | PASS | 四签名全部按契约落码；槽位 key 双口径三处对齐（resolveSubMesh 剥容器 / findBySlotKey 探一层 / applyVisual slots 走 full）核实无误 |
| 8 | Axis-3 | **M3 undo 链运行时缺陷（P1）** | **FAIL** | 根因：`examples` 工厂（example.ts:75）GLB 异步加载完成后**只调 applyStatusVisual、不重挂编辑器视觉层**——`asset` 工厂（registry.ts:92）有 `applyVisualIfAny` 重挂而 examples 没有。undo→rebuild→remove 全部+整份快照喂回时：applyFragment 先建节点（GLB 开始异步加载）再 applyVisual（slots transform 写到**空 Group** 上）→ GLB 挂进树后 mesh position 回初始值，slots transform 运行时丢失。数据层（serialize）正确、纯运行时丢——S43 撞过的「GLB 异步窗口」坑在 transform 域再现。注：材质域不受影响（MaterialLibService.syncAll 订阅 bridge.onState 每次 commit/undo 后重挂共享实例），只有 slots transform/visible 无此补偿机制 |
| 9 | Axis-3 | S46 冒烟挂起（RPC 超时）诊断 | 排除产品嫌疑 | S46 同表达式独立探针跑通（~2s 完成，七段断言逐段输出）；长会话累积态下 Runtime.evaluate 偶发超 20s RPC 上限——断言侧问题（超时上限或分段拆分），非产品缺陷。但 S46 的 meshAfterUndo 断言即使跑完也会 FAIL（#8 真缺陷） |
| 10 | Axis-3 | M2 槽位材质链正确性 | PASS | applySlotLink merge 写入（slots 不与物体级互斥，无 replaceVisual 需要）；syncAll 槽位级重挂（findBySlotKey 定位→共享实例）；EditMaterialModal 槽位模式 mat.type 白名单（修复轮 ① 修后）；修复轮四端到端探针（改红只影响 Hair、其余 7 mesh 保持）已记录 |
| 11 | Axis-3 | 排队模型/自适应健壮性 | PASS（P3 挂账不变） | 修复轮三两层修法（FloatingPanel clamp + FloatingDock perRow 纵向下移档）落码核实；评审记录 7 的 P3×4 挂账项中 ②（拖拽边界钳制）已被修复轮三的 clamp 实际解决——挂账清单应更新 |
| 12 | Axis-3 | 环境卫生（时间胶囊复查） | PASS（已处置） | 评审中发现 5199 端口 dev server 起于 2026-10-10 13:13（早于 M2 修复轮全部），按修复轮五教训 kill 后用最新代码重启再跑冒烟——避免一次假绿 |

#### Overall Verdict: **CONDITIONAL PASS → PASS（修复闭环 2026-10-12 同日，见下方修复轮）**

- ~~**阻塞项（P1，M3 引入）**：undo 后 slots transform 运行时丢失（#8）~~ **已修复**——用户裁决超出 a/b 两案（「不打补丁，改彻底」）：收敛为 `makeAssetNodeFactory` 唯一构建器（结构性根治：消灭 example/asset 两份重复实现，过期守卫 + 视觉层重挂集中一处，顺带治好 asset 工厂孤儿泄漏），详见下方 M3 P1 修复轮记录。
- **非阻塞挂账**：① ~~S46 RPC 超时上限~~ 已修（20s→40s）；② 评审记录 7 P3 挂账 ② 已被修复轮三 clamp 解决；③ ~~M3.1–M3.6 checklist 补勾 + 执行记录补写~~ 已补（§4.13.7 全 [x] + 补写 + 修复轮记录）。
- 修复前复验证据（2026-10-12 评审轮）：vue-tsc 绿 / build 绿（edit-main 124.53 kB 隔离保持）/ eslint 0 errors / gates **40/40 PASS** / S1–S45 全 true（S46 因 #8 + 断言侧超时未完成判定）。
- 修复后复验证据（2026-10-12 修复轮）：三绿 + **SMOKE PASS 47/47**（S46 七段全 true + 新增 S47 全 true）+ **gates 40/40**。
- **评审方法沉淀**：「数据层正确 + 运行时丢失」类缺陷的判别式——探针同时读 serialize 结果与活 mesh 状态，两者分叉即异步窗口丢失；undo/redo 链必须跨过 GLB 异步加载边界验证（S43 曾在材质域撞过同型坑）。

**M3 执行记录补写（Reverse Sync，2026-10-12 评审时补录）**：M3.1–M3.6 代码实际已全部落码（上一会话实现但未回写）：① materials.ts VisualOverride 扩 position/rotation/scale + applyVisualOverride 槽位命中时 applyTransform；② LayoutGizmo slotTarget + syncSelection 按 selectedSlot attach mesh + writeBack 槽位通道（与物体级分开）；③ PropertyPanel slotInfo 态变换区可编辑（applyTransform 槽位分支写 slots[key] commitLive + slotInfo watch 回填）；④ GUIDE §6.2 已有 transform 注意事项（骨骼动画覆盖边界）；⑤ S46 断言已写（七段：gizmoAttached/meshMoved/slotLanded/serRoundTrip/panelEdit/meshAfterUndo/slotGone）；⑥ 三绿过、SMOKE 45/45 + S46 未过（#8）。

**M3 P1 修复轮（2026-10-12，用户裁决「改彻底：不打补丁，收敛为唯一实现」，Plan Approved 后执行）**：

**修复内容（结构性重构，消灭重复实现而非对齐补丁）**：
1. **registry.ts 新增 `makeAssetNodeFactory` 唯一异步 GLB 构建器**（'asset' 内建工厂与业务 handler 共用）：同步返回占位 Group（建树不等待）→ 加载完成后按序「过期守卫（`getObject(node.id) === group` 身份比对——节点删除/重建即失配，一个判断替代 example.ts 的整个 loadTokens 机制，并顺带治好 asset 工厂原有的孤儿泄漏漏洞）→ 阴影默认 → **编辑器视觉层重挂**（slots transform + 物体级 + 材质全量，一处修复 boot 回灌/undo-redo 重建/视觉清除重建三个异步窗口）→ 挂树 → `onLoaded` 业务回调」。
2. **example.ts 瘦身为纯业务**：删 `makeAssetNode`/`loadTokens`/本地 `applyShadowDefaults`（−40 行），cars/examples 各一行委托构建器 + `onLoaded` 只做状态视觉与 spinners 注册；`onNodeRemoved` 只清 spinners。二开参照范式同步升级（文件头注释改写）。
3. **handlers/index.ts** 导出 `makeAssetNodeFactory`（二开者直接复用）。
4. **smoke-r.mjs**：RPC 超时 20s→40s（长会话累积态偶发超时，S46 判定曾被挡）；**新增 S47**——boot 回灌窗口 GLB 节点视觉存活断言（car_01 写内联色 #ff7700 → remove+重喂快照异步重建 → 轮询验 mesh 材质色与 getVisual 双存活），把「异步窗口丢视觉」类缺陷永久钉死。
5. **S46 断言侧修正**：undo 后旧 `hairMesh` 引用已脱离场景（整树重建 GLB 重载）——改为重新 traverse 查找 + 轮询等构建器重挂（对齐 S47 口径）；修复轮探针证实产品链路本已正确（单次 undo 后 slotAfterUndo=0.5 且 meshXAfterWait=0.5、polls=0 即时生效）。

**验证证据（2026-10-12）**：vue-tsc 绿 / build 绿（edit-main 独立 chunk 124.53 kB，隔离保持）/ eslint 0 errors（264 warnings 均既有基线类）/ **SMOKE PASS 47/47**（S46 七段全 true + S47 全 true）/ **gates 40/40 PASS**。执行中揪出并修复 1 处 eslint error（构建器返回箭头链）+ 2 处 warning（缩进/import type）。
**教训沉淀**：两份「异步加载 GLB 并填充」实现各修了对方没修的坑（example 有过期守卫无视觉重挂 / asset 有视觉重挂无过期守卫）——重复代码的必然结局是缺陷互补而非防御互补；根治是收敛唯一实现 + 业务经回调挂自己的逻辑。「数据层正确 + 活 mesh 错」的 undo/redo 验证必须跨过 GLB 异步重载窗口轮询，旧 mesh 引用在整树重建后必然失联（S46 初版断言沿用同步世界假设）。

**批次 M2 修复轮六立项（2026-10-12，用户实测六反馈 + 截图实锤「person 巨大无比」驱动的根因重诊）**：

**用户截图实锤与两次误诊交代**：用户圈注截图（红框 person 鞋部巨大、黄框头盔极小）+ 对照蒙皮顶点探针证实——**person 实际渲染高 178 米**（蒙皮后顶点世界包围盒 `skinnedSize:[177.9,178,31.2]`；bind pose 幻影盒恰为 1m）。此前两轮误诊：①「旧 dev server 时间胶囊」——server 代码确为新，但新代码自带本 bug；②「person 1 米、比例正常」——探针读的是 **bind-pose 几何**（Three.js 对 SkinnedMesh 的 `Box3/raycast/BoxHelper` 走 bind pose，不蒙皮），GPU 渲染走骨骼蒙皮——「机器测 1m、屏幕看 178m 巨人」的分裂即此。**骨架证据**：`Ch23_Belt` 的 `bone0WorldPos.y=100.9`（mixamo cm 单位）vs `matrixWorld.scale=0.0056`（starter F3 的 node.scale）——骨骼世界矩阵未与 mesh 缩放对齐，蒙皮链把顶点放大到米域。**「点不中/无包围盒」主要是 178m 尺度 bug 的症状**（拾取射线穿过的是错误几何、相机贴巨人腿边），不是 SkinnedMesh 先天不可编辑。

**用户裁决（2026-10-12，撤销初版烘焙方案）**：「我们就正常显示骨骼模型，不需要做什么整改」——**骨骼模型原生支持，禁止烘焙成静态几何**。修复方向：
- **F-6a 缩放绑定修复**：骨骼与 mesh 在同一尺度 bind，person 回 ~1m 正常显示。具体机制（bindMatrix 错位 / clone 后骨架引用 / bind 时机）**待骨骼矩阵探针定案后修**——不再未验证说死。
- **F-6b 蒙皮感知查询（原生 API）**：尺度正确后实测 raycast 对蒙皮网格是否走蒙皮后顶点（three 0.185 未核实）；缺口用原生能力补——`SkinnedMesh.computeBoundingBox/computeBoundingSphere`（0.185 自带蒙皮采样）、`Box3.setFromObject(obj, true)`（precise 对 SkinnedMesh 走蒙皮位置）、`handle.pick` 补蒙皮感知检测。**不烘焙、不转换资产**（与 F3「引擎不隐式缩放/篡改资产语义」同源的资产原样立场）。
- **F-6c 选区高亮/包围盒换蒙皮感知口径**：SelectionService 的 BoxHelper 与 S45 断言读蒙皮后位置（本轮探针 `getVertexPosition` 已验证可采蒙皮顶点）。
- **F-6d 冒烟断言修正**：S38/S45 等涉及 person/car_01 的 bbox 类断言从 bind-pose 读数改蒙皮后读数；新增「person 蒙皮后世界包围盒高 ∈ [0.8, 1.2]m」断言钉死尺度。
- **F-6e 其余五反馈复测**：点选 person（F-6b 后应可命中）、选中 Hair 包围盒（F-6c 后框蒙皮位置）、改 Hair 材质（修复轮四已修，178m 环境下用户再验一次）、双行高亮与「只读」文案（修复轮四已修，复测）、控制台警告（「未注册的物体类型」为 boot 重喂噪音 + person 规格超限为已知 deviations——降噪或文档说明，批次 5 顺手）。

**[WAITING FOR COMMAND]** 等待用户确认修复轮六方向后出 Plan。

**修复轮六探针定案（2026-10-12，三独立探针 + 数学闭合验证，F-6a 机制落锤）**：

**根因（单一机制，非多因叠加）**：`AssetEngine.getInstance` 用 `entry.root.clone(true)` 克隆 GLB——`Object3D.clone(true)` **复制 Bone 节点副本进新树，但不重建 SkinnedMesh.skeleton 引用**：8 个 SkinnedMesh 的 `skeleton` 仍指向缓存根的**旧骨骼对象**（`bonesAllInTree:false`，旧骨骼 matrixWorld 永不随新树更新、其宿主树 scale 恒 1）。蒙皮数学（`bindMode:'attached'`）每帧执行 `boneMatrix = mesh.matrixWorld⁻¹ × bone.matrixWorld × boneInverse`：
- `boneInverse`（bind 时烘焙）与 `mesh.matrixWorld` **同时**含 group 的 0.0056——`bindMatrixInverse` 实测 `[178.57143,…,446.43,-160.76,-353.22]`，其中 `178.57143 = 1/0.0056` 精确吻合（bind 发生在 instance 已挂树、matrixWorld 已含 0.0056 之后）；
- `bone.matrixWorld` 是**旧骨骼**的（scale=1，y≈100.9 cm 域）——0.0056 与 1 的错位相乘 → 蒙皮顶点放大 1/0.0056≈178.57×。
- **「机器测 1m」真相**：bind-pose 读数（`Box3.setFromObject` coarse、raycast）走未蒙皮几何 × mesh 世界矩阵 → ~1m；GPU 蒙皮走上面断裂的链 → 178m。`Box3.setFromObject(obj,true)`（precise）实测 `[178.08,179.28,31.9]` 与截图吻合。
- **F-6b 预验**：`rayHitsOnGroup:0`（射线打不中当前巨人）但 `computeBoundingBox/getVertexPosition` 可用且蒙皮感知（`skBBoxWorld` 采样正确）；`SkeletonUtils.clone` 在 three 0.185 可用（exports: clone/retarget/retargetClip）——**正确克隆姿势就是它**（内部做 skeleton 重绑定 + bindMatrix 重建，官方给多实例 SkinnedMesh 的答案）。
- **受影响面**：仅带骨骼的 GLB（person）；静态 GLB（example/rack）clone(true) 无害。frameObject/getBbox/getSubMeshInfo/BoxHelper 全部走 bind-pose 口径（coarse setFromObject）——F-6c 改点已定位（Bridge.getBbox:307、createScene.frameObject:350、SceneEngine.getSubMeshInfo:243、SelectionService.addHelper:113、RaycastEngine.pick:35）。

**修复轮六 Plan（2026-10-12，探针定案后成稿；待 Plan Approved）**：

**设计原则**：根因在克隆层（clone(true) 断骨架引用），修复也在克隆层收敛——一处修 F-6a，下游蒙皮感知（F-6b/c）做读取口径统一，**不动资产、不烘焙、不改 scene-data**（资产原样立场）。`three/examples/jsm/` 已在 import 白名单，SkeletonUtils 无门禁障碍。

**File Changes（6 文件）**：

1. `src/scene-core/engine/AssetEngine.ts`
   - import 区新增：`import { clone as skinnedClone } from 'three/examples/jsm/utils/SkeletonUtils.js';`
   - `getInstance` 内 `entry.root.clone(true)` 改为 `skinnedClone(entry.root)`（SkeletonUtils.clone 对无骨骼树是 Object3D.clone 的超集，静态 GLB 行为不变；对 SkinnedMesh 重绑 skeleton + 重建 bindMatrix——多实例蒙皮官方姿势）
   - 保留后续 `isClone` 标记 traverse（SkeletonUtils.clone 返回普通 Object3D 树，userData 标记逻辑兼容）

2. `src/scene-core/engine/SceneEngine.ts`
   - 新增公开方法 `getSkinnedAwareBox(obj: THREE.Object3D): THREE.Box3`：traverse 收集 SkinnedMesh，对每个先 `computeBoundingBox()`（蒙皮采样）再 `applyMatrix4(mesh.matrixWorld)` 并入盒；无 SkinnedMesh 时回退 `new THREE.Box3().setFromObject(obj, true)`（precise 口径）——静态/蒙皮统一一个入口
   - `getSubMeshInfo`：目标为 SkinnedMesh 时 bbox 改 `mesh.computeBoundingBox()` 后 `applyMatrix4(mesh.matrixWorld)`（槽位盒蒙皮感知）；静态 mesh 不变

3. `src/scene-core/createScene.ts`
   - `frameObject`：`new THREE.Box3().setFromObject(obj)` → `sceneEngine.getSkinnedAwareBox(obj)`（F 键聚焦对 person 框真实 1m）

4. `src/edit/Bridge.ts`
   - `getBbox(id)`：改走 `sceneEngine.getSkinnedAwareBox(obj)`（属性面板/对齐分布共用口径）

5. `src/edit/SelectionService.ts`
   - `addHelper`：目标树含 SkinnedMesh 时，BoxHelper 挂上与每帧 `update()` 前对目标树内 SkinnedMesh 先 `computeBoundingSphere()`（探针已验证可用；BoxHelper 派生自 geometry 包围盒，蒙皮网格须先算蒙皮采样盒）——在现有 `onFrame` 的 `helper.update()` 回调前 traverse 一次，与现有结构一致

6. `scripts/smoke-r.mjs`
   - **新增 S48（person 蒙皮尺度钉死断言）**：轮询 person mesh 就绪 → `Box3.setFromObject(obj, true)` 蒙皮世界盒高度 ∈ [0.8, 1.2]（当前 178+ 为 FAIL 基线）+ raycaster 对 person 躯干（[-2.5, 1.2, 2] 垂直下探方向）命中 person_01 ≥ 1（F-6b 拾取可中）
   - **S45 修正**：`bboxShown` 断言从「含 ×」升级「数值 ∈ 合理域」——Ch23_Hair 蒙皮后世界盒三轴均 < 0.25m（防 178m 假绿）
   - **S38/S40 等现有断言核对**：跑通后逐项核对 person 相关读数，因蒙皮口径改变而变的校正到蒙皮真值（预期 S40 meshCount/树行数不受影响）
   - pass 链追加 `s48.ok === true`

**Signatures（关键签名）**：
- `skinnedClone(entry.root): THREE.Object3D`（SkeletonUtils.clone 别名，AssetEngine 内部）
- `SceneEngine.getSkinnedAwareBox(obj: THREE.Object3D): THREE.Box3`（Bridge.getBbox / frameObject 共用）
- `getSubMeshInfo` 返回结构不变（bboxMin/bboxMax 改蒙皮口径读数）

**原子 Checklist**：
- [x] F6-1 AssetEngine：clone(true) → skinnedClone；探针复跑 person 蒙皮世界盒 ~1m（root 修复最先做——下游全部依赖它）
- [x] F6-2 SceneEngine：getSkinnedAwareBox + getSubMeshInfo 蒙皮口径
- [x] F6-3 createScene.frameObject + Bridge.getBbox 接蒙皮盒
- [x] F6-4 SelectionService：BoxHelper 蒙皮感知（computeBoundingSphere 前置）
- [x] F6-5 smoke-r：S48 新增 + S45 修正 + 现有断言核对
- [x] F6-6 三绿（vue-tsc/build/eslint 0 errors）+ SMOKE 48/48 + gates 40/40
- [x] F6-7 GUIDE §6.2/FAQ 补蒙皮条目（骨骼资产多实例由 SkeletonUtils.clone 保证；包围盒/拾取为蒙皮感知口径）+ F-6e 用户复测清单（点选 person/选中 Hair 包围盒/改 Hair 材质/双行高亮复测）
- [x] F6-8 Reverse Sync：Execute Log + 验证证据 + 教训沉淀（clone(true) 对 SkinnedMesh 是隐形断链——SkeletonUtils.clone 是唯一正确姿势）回写 spec

**修复轮六执行记录（2026-10-12，Batch Override 全量执行）**：

1. **F6-1**：`AssetEngine.getInstance` 的 `entry.root.clone(true)` → `skinnedClone(entry.root)`（SkeletonUtils.clone 别名导入，注释写明断链机制）。**root 修复即时探针验证**：蒙皮世界盒 `[0.996, 0.997, 0.175]`（1 米人 ✓）、`bonesAllInTree: true`（135 骨全部进新树 ✓）。
2. **F6-2**：SceneEngine 新增 `getSkinnedAwareBox(obj)`（traverse SkinnedMesh → getVertexPosition 采样 × localToWorld 并盒；无蒙皮回退 `setFromObject(obj, true)` precise 口径）；`getSubMeshInfo` 蒙皮分支同口径采样（静态 mesh 走原 setFromObject）。
3. **F6-3**：`createScene.frameObject` 与 `Bridge.getBbox` 改调 `getSkinnedAwareBox`（F 键聚焦/属性面板/对齐分布统一口径）。
4. **F6-4**：SelectionService 新增 `refreshSkinnedBounds`（traverse computeBoundingBox+Sphere），挂 `helper.userData.target`，onFrame 里 helper.update() 前调用——选中态每帧跟随真实形状。**关键源码事实（阅读 three 0.185 源码证实）**：`Box3.expandByObject` coarse 路径**优先读 object.boundingBox**（SkinnedMesh 专属属性，非 geometry 盒），SkinnedMesh.raycast 同理先查 object.boundingSphere——所以 computeBoundingBox/Sphere 重算后，BoxHelper 与 raycast **自动**变蒙皮感知，无需替换 helper/raycast 实现。
5. **F6-5**：S48 新增（骨骼在树 + 蒙皮采样盒高∈[0.8,1.2]m + 宽<5 + 盒中心向下射线命中 + getSkinnedAwareBox 一致性五段）；S45 bbox 断言升级数值域（引擎口径三轴 ∈(0, 0.25)——防 178m bind-pose 假绿）。**执行中揪出 1 处断言时序坑**：初版从 DOM 文本抓数值，长链路下 DOM 刷新抖动致假 FAIL（独立探针显示引擎值 0.10/0.12/0.11 全过、DOM 文本同值但冒烟链路偶发旧帧）——改为引擎真值断言 + DOM 只验 `×` 存在。
6. **F6-6**：三绿 + **SMOKE PASS 48/48**（S48 一次全绿：height 0.997/pickHits 11/engineHeight 1；S45 修正后绿）+ **gates 40/40 PASS**。eslint 0 errors（266 warnings，新增 2 个均既有基线类：AssetEngine 192 行超长行为旧签名、SceneEngine 其余为既有 continue/assertion 类）。
7. **F6-7**：GUIDE 新增 §6.3「骨骼模型多实例与蒙皮感知」（SkeletonUtils.clone 机制 + 蒙皮感知口径声明）；FAQ「人物模型巨大」条目补 clone(true) 断链指引。
8. **F6-8**：本记录即 Reverse Sync。

**执行中追加的根因证据（Plan 之外，探针四/五轮）**：
- **F-6b 结论修正**：three 0.185 的 `SkinnedMesh.raycast` **天然蒙皮感知**（`_computeIntersections → checkGeometryIntersection → getVertexPosition` 逐顶点蒙皮变换）——**RaycastEngine 无需任何修改**（Plan 原预案「补蒙皮感知检测」取消，超出 Plan 的减法）。此前探针 miss 是**射线打偏**（探针点位恰在两腿空隙），从蒙皮盒中心六方向扫描 10/2/1/1/1/1 全命中。
- **SkeletonUtils.clone 内部机制**（读源码证实）：`source.clone()`（浅）+ parallelTraverse 建 source↔clone 映射 → 每个 SkinnedMesh `skeleton.clone()`（**boneInverses 按引用共享**——Math4 对象与缓存根同源）+ `bones.map(cloneLookup)` 换新骨引用 → `bind(skeleton, 源 bindMatrix)`。boneInverses 是缓存根坐标系（cm 域）的逆，与新骨 matrixWorld（含 0.0056）相乘恰好落回米域——数学自洽，蒙皮正确。
- **首帧 cull 球时序**（理论，未实测）：boundingSphere 为 null 时首次 frustum cull 计算后缓存；骨骼 matrixWorld 在挂树后渲染帧才更新，cull 可能先算出错球。选中态 F6-4 的每帧重算已覆盖编辑器场景；渲染剔除错球只影响性能不影响正确性（person 在视锥内会被错误剔除的风险极低，未观察到）。

**验证证据（2026-10-12）**：vue-tsc 绿 / build 绿（edit-main 124.78 kB，隔离保持）/ eslint 0 errors / **SMOKE PASS 48/48**（S48 五段全 true）/ **gates 40/40 PASS**。

**教训沉淀**：
1. **`Object3D.clone(true)` 对 SkinnedMesh 是隐形断链**——复制 Bone 副本但不重绑 skeleton 引用，蒙皮链指向旧骨骼（世界矩阵不含新实例缩放），顶点放大 1/scale 倍。静态 GLB 无害、骨骼 GLB 必炸——「一个 clone 调用两种资产命运」。多实例蒙皮资产唯一正确姿势是 `SkeletonUtils.clone`（官方语义：Bones are also cloned, and must be descendants；业务侧经 makeAssetNodeFactory 已天然免疫）。
2. **蒙皮资产的「探针读数」必须区分三种口径**：bind-pose 几何盒（Box3 coarse / raycast 未命中 object.boundingSphere 时）≠ 蒙皮采样盒（getVertexPosition/computeBoundingBox）≠ GPU 渲染真值。「机器测 1m、屏幕看 178m」的分裂=口径 1 vs 3；修复后三口径中 1 仍是 bind-pose（1m）、2/3 是蒙皮真值（1m）——恰好一致是因 person 的 bind pose 本身就是标准站姿。
3. **断言从 DOM 抓数值 vs 引擎真值**：长链路冒烟中 DOM 文本刷新有抖动（异步渲染节拍），数值断言走引擎 API、DOM 只验结构存在性——S45 假 FAIL 的根因即此。
4. **修 bug 时「探针打不中」≠「产品拾取坏了」**：先验证探针自己的射线几何（点位是否在目标体内/空隙），再怀疑产品——本案探针四轮有三轮在调试自己的射线打偏。

**F-6e 用户复测清单（待用户在编辑器实测）**：① 视口看 person 应为 ~1 米正常身高（不再 178m 巨人）；② 点选 person 躯干/四肢应可命中并出现选中框（框贴真实身体）；③ 树展开点 Ch23_Hair → 选中框只框头发（蒙皮位置）+ 属性面板包围盒 ~0.10×0.12×0.11；④ 改 Hair 材质（修复轮四已修）正常生效；⑤ 双行高亮与「只读」文案复测。

**Out of Scope**：person 规格超限 deviations（已知，批次 5 降噪）；「未注册的物体类型」boot 警告（批次 5）；骨骼动画播放态编辑（GUIDE 已声明静止态边界）；资产重导出/烘焙（用户明令禁止）。

**风险与回退**：
- 风险 1：SkeletonUtils.clone 与 isClone 标记/dispose 语义交互——探针确认返回普通树，标记 traverse 兼容；SkeletonUtils 内部重绑新骨骼实例，无跨实例共享 skeleton 泄漏面
- 风险 2：BoxHelper 每帧 computeBoundingSphere 的性能（135 骨 × 8 mesh）——仅选中态触发；实测超帧率预算则降频（每 3 帧一次）
- 风险 3：S48 蒙皮盒采样需 GLB 加载 + bind 完成——轮询口径对齐 S47（traverse 找 mesh + 等待）
- 回退：单 commit revert 即回现状（178m 为已知态，无数据风险）

**Blender 通道前置探索（2026-10-12 完成；⚠️ 2026-10-12 当日稍后被用户裁决剔除 Blender 通道——本区块转为历史归档，不再是批次 4.4/5.1/5.3 的执行依据，范围变更见 §8.1。经验中仍有效的部分：headless 工具链方法论、bpy 脚本模板结构（若未来重启外部建模通道可复用）、建模↔校验↔入库↔检索闭环实证）**：

- **本机环境**：探测结论零 Blender（PATH/注册表/`~/.gts3d/blender/` 缓存/常见安装路径/winget 全空）→ 按「install-blender 拉取」设计走完整链路。缓存目录 `~/.gts3d/blender/` 已建立。
- **版本终裁：4.5 LTS（4.5.9）**，根因是 Intel Mac 支持——**Blender 4.6 起停止 Intel Mac 构建**（5.2.2 目录实测 `macos-x64.dmg` HTTP 404，仅 arm64），而 skill 要求 Windows x64 / mac-intel / mac-apple 三平台全覆盖 → 4.5 LTS 是唯一三平台齐活的版本线（4.5.9 实测 `windows-x64.zip` / `macos-x64.dmg` 335MB / `macos-arm64.dmg` 308MB / `linux-x64.tar.xz` 全 200）。三平台统一版本 = bpy 脚本行为一致；放弃 5.x 新特性（headless 建模导出 GLB 用不到）；升级窗口待 Blender 6 LTS。
- **分发形态实测**：官方直链 `https://download.blender.org/release/Blender{maj.min}/blender-{ver}-{platform}-{ext}`（目录可枚举）；**清华镜像同路径结构可用**（`https://mirrors.tuna.tsinghua.edu.cn/blender/release/Blender4.5/…` 实测 200，本机下载 404MB 约 4 分钟）——内网镜像样板即此路径结构；`.sha256`/`.md5` 校验文件同目录（本机实测 sha256 与官方一致后才解压）；服务器支持 `Accept-Ranges: bytes`（断点续传可做）。Windows 便携版 zip 解压即用（`blender-4.5.9-windows-x64/blender.exe --version` 直接跑通），**自带 Draco 压缩库**（`4.5/scripts/addons_core/io_scene_gltf2/extern_draco.dll`，导出可开 Draco）。
- **headless 通道端到端实测**（`.tmp-blender-explore/gts3d_model_template.py`，演示物=木桌：桌面+四腿双材质）：`blender --background --python xx.py -- --out xx.glb --report xx.json` 一次跑通——建模（Principled BSDF 材质）→ apply transform（scale/rotation 烘进几何）→ 原点居底（bbox.min.y=0、xz 居中）→ GLB 导出（+Y up）→ JSON 数值自查报告（面数/节点/bbox/命名合规）。产出 30KB / 5 mesh / 508 面 / 高 0.740m。
- **建模↔校验↔入库↔检索闭环首跑全绿**：bpy 产出 GLB → `validate-model.mjs --strict --check-mesh-names` **PASS** → `import-assets.mjs --strict` 入库成功 → 中文检索「木桌」命中第 1 位（score 0.677）。Spec 设计的「建模产出回注册资产库，库随使用增长」闭环从纸面到实证。
- **bpy 关键坑（modeling-channels.md 必写）**：`object.name` 与 `mesh_data.name` 是两个名字，glTF 导出用 **mesh_data.name**——只改 object.name 时 GLB 里 mesh 名仍是 `Cube`/`Cylinder.001`（首跑被 `--check-mesh-names` 抓到）；修法=收尾规范里 `obj.data.name = obj.name` 同步（与 buildReport 槽位 key 口径直接相关——mesh 名即槽位显示名）。另：Blender polygon 是 n 边形，三角数按 fan 估算 `len(p.vertices)-2`。
- **blender-mcp 情报更新（接入方式变化）**：PyPI 包已从 `blender-mcp` 改名 **`mcp-for-blender`**（旧名配置仍兼容）；Claude Code 接入=`claude mcp add blender uvx mcp-for-blender`；addon 安装=`uvx mcp-for-blender install-addon`（自动拷入 Blender addons 目录）或手动 `addon.py` 经 Preferences→Add-ons 安装；要求 Blender≥3.0 + Python≥3.10 + uv；MCP server 由客户端拉起（勿手动终端跑），Blender 端 socket server 开 Blender 即起（N 面板 MCP for Blender 页签）；安全项：socket 无鉴权仅限 localhost、`execute_blender_code` 是任意代码执行面（`BLENDER_MCP_SAFE_MODE=1` 可开脚本校验）、多实例用 `--port 9877` 区分。
- **探索期残留（2026-10-12 用户裁决「按推荐来」，已清理）**：Blender 原始 zip 已删（解压目录 `~/.gts3d/blender/blender-4.5.9-windows-x64/` 留作通道就绪）；探索资产 table 已出库（模型+manifest 删 + 索引重建 + gates 40/40 复验通过）；`.tmp-blender-explore/` 仅留 `gts3d_model_template.py`（~~将来改造为 references/modeling-channels.md 素材~~——通道剔除后不再作素材，见 §8.1），产物与打包目录已删。
- **终局清理（2026-10-13，§8.1 裁决后）**：`~/.gts3d/blender/` 整目录删除（含 blender-4.5.9-windows-x64 解压目录）；`.tmp-blender-explore/gts3d_model_template.py` 一并删除（bpy 模板随通道作废）。

### 修复轮七：GLB 加载占位可视化 + 加载计数指示（2026-10-12 立项，2026-10-13 执行完成，SMOKE 52 段全绿 + gates 40/40，待用户复测）

**目标**：GLB 异步加载期间的用户感知改进——①占位可视化：加载期间显示按模型 bbox 尺寸的半透明线框盒（代替现在空 Group 完全不可见）；②加载计数指示：工具栏或角落显示 "N/M loaded"。

**Research Findings（2026-10-12）**：

1. **构建器现状**（registry.ts `makeAssetNodeFactory`）：同步返回空 `THREE.Group`（applyTransform 已应用），加载完成后按序「过期守卫 → 阴影默认 → 视觉层重挂 → 挂树 → onLoaded」。占位盒插入点=同步段（建 group 时）与异步完成段（挂 instance 时移除）。
2. **bbox 来源真相**：`AssetEngine.buildReport` 在首次加载时已算好每资产 `report.bbox {min, max, height}` 并缓存（getReport 即取）——**但占位盒在加载完成前创建，报告尚不存在**。可用事实：starter 资产规范「原点居底、xz 居中」（originTolerance 0.01），同一资产 id 多实例结构一致。占位盒尺寸需另一来源。
3. **S47 回灌断言语义**（不可破坏的硬约束）：remove+重喂快照 → 重建节点（新 group）→ GLB 异步重载 → 轮询验 mesh 材质色与 getVisual 双存活。占位盒必须：a) 挂在 group 内部（group.add(placeholder)），实例挂载时同帧移除；b) 不干扰 mesh traverse 断言——S47 轮询判据是 `c.isMesh` 计数>0 与材质色，**若占位盒用 Mesh 实现会污染计数**（mc>0 提前真 → 走到材质断言时 mesh 还是占位盒 → 材质色 undefined → 假 FAIL）。**结论：占位盒必须避开 isMesh 判据——用 LineSegments（Box3Helper 同类，`isLineSegments` 非 `isMesh`）实现**。
4. **S48/S46 同理核查**：S48 判据 `c.isSkinnedMesh`、S46 判据 `c.name === 'Ch23_Hair'` 与 meshCount 类断言（S40）——LineSegments 不命中 isMesh/isSkinnedMesh 判据，name 不冲突。**S40 meshCount 断言需逐一核对**（若按 isMesh 计数，LineSegments 安全；若有 children.length 类断言需查）。
5. **加载计数数据源**：现状无任何全局加载追踪器。AssetEngine 有 `loading` Map（assetId → promise，防重入）——但口径是「资产种类」非「节点实例」（car_01/car_02 共享一次加载）。N/M 语义定为**节点实例口径**：M=场景中异步 GLB 节点总数（'asset' 工厂 + 业务 handler 经 makeAssetNodeFactory 建的节点），N=已完成数。计数器天然挂 makeAssetNodeFactory：创建时 M+1、完成/过期/失败时 N+1（三态收敛，防计数泄漏导致指示永不消失）。
6. **指示 UI 落点**：EditApp 三栏 + Toolbar 顶部居中。生产态（main.ts）无 edit 壳——指示属 scene-core 通用能力更合理（Debug HUD 同模式：DOM 浮层挂在 canvas 容器）。备选：a) scene-core 内置轻量 DOM 徽标（默认显示，全零时隐藏）；b) edit 壳 Toolbar 增项（仅编辑态可见）。倾向 a：生产场景首屏 GLB 加载同样需要感知，且 main.ts/edit-main.ts 零改动。
7. **环境现状**：5183 端口 dev server 运行中（PID 2800，17:22:57 起，vite --port 5183 --strictPort），代码新鲜度已验证含修复轮六（skinnedClone 在位）。冒烟默认 URL 5199 需另起。改码后须重启 5183（时间胶囊教训）。
8. **场景数据实例**：car_01/car_02/example_01（assetId=example ×3）+ person_01（person）。M 初始=4，全载后 N=M 指示隐藏。

**In Scope**：registry.ts 构建器占位盒 + 计数器；指示 UI（方案待 Plan 定）；smoke S49 断言；GUIDE 如有加载行为描述的同步。

**Out of Scope**：加载进度百分比/字节级进度（GLTFLoader onProgress 不稳定）；生产态骨架屏等视觉设计深化；性能优化。

**Open Questions（阻塞 Plan 的分叉，已收敛倾向）**：
- Q1 占位盒尺寸来源：加载完成前报告不存在——a) manifest/静态尺寸表（需要数据源）；b) 固定默认尺寸（如 1×1×1）加载完成后不补偿（简单但尺寸可能不符）；c) **首载完成后缓存该资产 bbox，重建/多实例时用缓存值**（二实例起体验正确，首实例仍默认尺寸）。倾向 c+固定默认兜底。
- Q2 指示 UI 形态：倾向 scene-core 内置 DOM 徽标（Research #6 理由），等用户裁决。

**验证方式**：三绿（vue-tsc/build/eslint 0 errors）+ SMOKE 48→49 段（新增 S49：占位盒存在→加载完成后移除 + 计数器 N=M 收敛 + S47/S46/S48/S40 回归不破坏）+ gates 40/40。

**用户裁决（2026-10-12，Plan 前）**：
- Q1 定案：**A 案——报告缓存优先，无报告不显示占位盒**（"没有真值就不显示假值"）。不引入默认尺寸魔法数；首实例（报告未生成）无占位盒直接出模型；二实例/undo 重建（报告已缓存）显示真实尺寸盒。
- Q2 定案：**scene-core 内置 DOM 徽标**（同 Debug HUD 模式，canvas 容器挂载，生产态/编辑态通用，全载后自动隐藏）。

**Plan（File Changes + Signatures + Checklist，2026-10-12）**：

**关键防护设计（Research 补充核实）**：
- 占位盒实现 `THREE.LineSegments`（EdgesGeometry(BoxGeometry)）——**不命中任何 smoke 的 `isMesh` 判据**（S40 meshCount / S46 name 匹配 / S47 mc 计数+材质色 / S48 isSkinnedMesh 全安全）
- `placeholder.raycast = () => {}`（照抄 SelectionService.ts:137 BoxHelper 的既有防拾取手法——点中占位盒边框不产生拾取命中）
- `disposeInstance` 只处理 isMesh，LineSegments 的 geometry 需构建器自行在移除时 dispose（防编辑器反复增删泄漏 EdgesGeometry）
- 计数三态收敛：完成 / 过期守卫命中 / 加载失败，三者都计 N+1（防指示永不消失）
- `listSubMeshes` 走 report 不走 traverse——占位盒不影响子网格清单

**File Changes**：

1. `template/src/scene-core/handlers/registry.ts`（改）
   - `makeAssetNodeFactory` 内：同步段查 `assetEngine.getReport(assetId)`，命中（二实例/重建）→ 建 LineSegments 占位盒挂 group；未命中 → 无占位盒
   - 异步完成段：过期守卫后、挂 instance 前，移除并 dispose 占位盒
   - 计数器逻辑（创建 M+1 / 三态 N+1）内聚在构建器，经回调通知 UI
2. `template/src/scene-core/createScene.ts`（改）
   - 新增 `createLoadBadge`（同 createDebugHud 模式：DOM 徽标挂 canvas 容器，"N/M loaded" 文案，N=M 或 M=0 时隐藏）
   - 构建器计数回调 → 徽标更新（经 registerBuiltinFactories 传线）
3. `template/src/scene-core/handlers/example/example.ts`（不改，零侵入验证）——业务 handler 经 makeAssetNodeFactory 天然获得占位盒+计数，注释按需微调
4. `template/scripts/smoke-r.mjs`（改）
   - 新增 S49：① remove car_01 + 重喂快照（报告已缓存路径）→ 重建瞬间（轮询早期帧）group 内存在 LineSegments 占位盒；② 加载完成后占位盒移除且 mesh 存在；③ 计数徽标 DOM 存在且终态 N=M；④ S47/S40 断言原样回归（占位盒不破坏的证明）
   - pass 链追加 `s49.ok === true`
5. `template/src/scene-core/engine/AssetEngine.ts`（不改）——`getReport` 现成 API 直接复用

**Signatures**：
- `const createPlaceholderBox = (size: THREE.Vector3): THREE.LineSegments`（registry.ts 内部；EdgesGeometry(BoxGeometry) + 半透明 LineBasicMaterial + raycast 置空）
- `makeAssetNodeFactory(sceneEngine, assetEngine, resolveAssetUrl, onLoaded?, onLoadCount?: (loaded: number, total: number) => void)`——新增可选尾参（业务 handler 不传即无计数回调，占位盒仍生效）
- `const createLoadBadge = (canvas: HTMLCanvasElement): { update(loaded: number, total: number): void; dispose(): void }`（createScene.ts 内部）

**原子 Checklist**：
- [x] P1 registry.ts：createPlaceholderBox + makeAssetNodeFactory 占位盒挂/移除/dispose + 计数器三态收敛 + onLoadCount 尾参
- [x] P2 createScene.ts：createLoadBadge DOM 徽标 + registerBuiltinFactories 计数接线（内建 'asset' 工厂 + example handler 两路都汇入）
- [x] P3 smoke-r.mjs：S49 四段断言 + pass 链
- [x] P4 三绿（vue-tsc / build / eslint 0 errors）
- [x] P5 复验闭环：重启 dev server（时间胶囊 + 修复轮九教训：TaskStop 不级联杀 vite 子进程，须 Stop-Process 杀净再起）→ SMOKE 全绿（当前基线 S1–S48+S50+S51+S52=51 段，S49 加入后 52 段；重点 S47/S40/S46/S48/S50/S52 回归）→ gates 40/40
- [x] P6 Reverse Sync：执行记录 + 验证证据 + 教训回写 spec

**修复轮七执行记录（2026-10-13，本会话 Plan 批准后批内连跑）**：

1. **P1** registry.ts：`createPlaceholderBox`（EdgesGeometry(BoxGeometry) + 半透明 LineBasicMaterial + `raycast = () => {}` 防拾取误中，照抄 SelectionService BoxHelper 既有手法）+ `disposePlaceholderBox`（geometry/material 双释放——disposeInstance 只处理 isMesh，LineSegments 由构建器自管防反复增删泄漏）；`makeAssetNodeFactory` 签名扩尾参 `onLoadCount?`，闭包内 `pendingTotal/pendingDone` 计数器（创建时 M+1 即回调一次让徽标立刻出现，完成/过期守卫命中/加载失败三态收敛 N+1——过期路径同样 dispose 占位盒）。占位盒只在 `getReport(assetId)` 命中时创建（A 案：无真值不显示假值），position 按报告 bbox 中心偏移（盒与模型真实位置对齐，模型原点居底时盒底=地面）。
2. **P2** createScene.ts：`createLoadBadge`（DOM 徽标 `.gts3d-load-badge` 挂 canvas 容器右下角，`pointer-events:none`，N≥M 或 M=0 时 `display:none`）+ `getLoadBadgeState(assetEngine)`（WeakMap 按引擎实例隔离接线对象，业务侧凭引擎拿同一 `onCount` 汇入，多处 createScene 不串）+ dispose 时徽标移除且 onCount 置空防悬挂。example.ts `registerExampleHandler` 扩第 4 参 `onLoadCount?` 透传构建器——main.ts/edit-main.ts 两入口都接线 `getLoadBadgeState(...).onCount`，业务分组（cars/examples）与内建 'asset' 工厂统一汇入。registerBuiltinFactories 扩尾参转发。
3. **P3** smoke-r.mjs S49 六判据：badgeExists（徽标 DOM 存在）/ sawPlaceholder（重建早期窗口抓到 LineSegments，尽力断言）/ placeholderGone（抓到后消失）/ meshBack（加载完成 mesh 存在）/ noResidual（无残留 LineSegments）/ badgeHidden（终态 N=M 收敛徽标隐藏）；抓不到占位盒（加载太快）降级为不产生破坏。pass 链追加 `s49.ok === true`，S49 插入 S48 与 S50 之间（编号空缺归位）。
4. **P4** 三绿：vue-tsc 0 errors / build 绿（edit-main 125.84 kB，隔离保持）/ eslint 0 errors（302 warnings 均既有基线类）。
5. **P5** 复验：杀净 5183（PID 2800，10-12 17:22 起的时间胶囊）与 5199（PID 18108，修复轮九冒烟遗留）双残留 server（netstat 查 PID + Stop-Process）→ 5199 新起 → **SMOKE PASS 全绿 52 段**（S49 一次全过：sawPlaceholder true + placeholderGone true + badgeHidden true；S40–S52 含 S47/S48/S50/S51/S52 全回归无破坏——占位盒 LineSegments 不命中任何 isMesh 判据的防护设计实证）→ **gates 40/40 PASS** → 5199 杀净（TaskStop 后 vite 子进程存活，再 Stop-Process 补刀——教训第 N 次验证）→ 5183 重启（10:33:31，代码新鲜）。
6. **P6** 本记录即 Reverse Sync。

**验证证据（2026-10-13）**：三绿 + SMOKE PASS 52 段 + gates 40/40。S49 详情：`{"badgeExists":true,"sawPlaceholder":true,"placeholderGone":true,"meshBack":true,"noResidual":true,"badgeHidden":true,"ok":true}`。

**与并行会话的协调**：批次 PH（Poly Haven 入库）同期在另一会话推进——其改动面（scripts/fetch-polyhaven.mjs 新建 + gates 用例 37）与本轮改动面（registry.ts/createScene.ts/example.ts/main.ts/edit-main.ts/index.ts/smoke-r.mjs）零交集；本轮 gates 复验时用例 37 断言仍为旧口径（PH.4 未落），40/40 基于当前时点快照。

**F-6e 复测清单追加（修复轮七新增三项）**：⑬ 刷新页面后场景重新加载期间，右下角应出现 "N/M loaded" 徽标，全部加载完成后自动消失；⑭ 删除任一 GLB 物体后 Ctrl+Z 撤销，徽标应在重建窗口重现并收敛，模型回来；⑮ 加载失败场景徽标不应永久停留（三态收敛）。
**复测结果（2026-10-13 用户实测）**：⑬⑭ 视觉验收「正确」——但用户同时反馈「占位盒没看到，一开始没加载出来的时候也没看到」。探针定案（probe-placeholder/2）后用户裁决撤除占位盒（见下方「占位盒撤除」区块）。

### 修复轮七补丁：占位盒撤除 + 计数器串组修复 + 验证策略修订（2026-10-13，用户裁决驱动）

**复测反馈与探针定案（probe-placeholder.mjs / probe-placeholder2.mjs，三探针）**：

1. **首载永无占位盒（主根因）**：boot 建树瞬间 `getReport` 恒返回 null（资产还在网络加载，报告要 GLB 解析完才生成）——A 案「报告缓存命中才显示」在首载场景=**永无盒**。而首载恰是最需要加载反馈的场景。manifest（import-assets 落库的 `report.bbox` 真值）存在但模板运行时无人加载（registerAssetStates 无人调用、init.mjs 注入资产不拷 manifests）。
2. **undo 重建盒"闪过"**：资产已缓存时 GLB 毫秒级回归（探针 2：`meshAtFrame: 1`，即首采样帧 mesh 已回来）——盒一闪而过符合实现，视觉价值窗口≈0。
3. **补救方案评估**：让首载有盒需引入 manifest 预注册链路（AssetEngine preregisterReports + createScene fetch + init.mjs 聚合 + 母版预置四文件改动）——服务一个毫秒级视觉瞬间，成本不对称。

**用户裁决（2026-10-13）**：「要不就不要盒子了，麻烦死了」——**撤除占位盒，保留加载计数徽标**。模型认同并附议（价值窗口≈0 + 四文件维护成本 + 徽标已承担加载感知）。

**执行记录（同日）**：

1. registry.ts：删 `createPlaceholderBox`/`disposePlaceholderBox` 与构建器内全部占位盒逻辑（创建/挂载/移除/dispose），留一行撤除裁决注释；eslint warnings 302→300（删的代码自带 2 个）。
2. **顺手修复两处真 bug**：
   - **计数器串组**：原实现 `pendingTotal/pendingDone` 是每个工厂闭包独立——boot 期 cars/examples 并行加载时各计各的，徽标数字互串、先完成的工厂提前隐藏徽标。修=模块级共享 `loadTotal/loadDone`（N/M 语义=场景内异步 GLB 节点全局口径）。
   - **S49 快照时序**（重写判据时引入，被冒烟超时掩盖）：快照在 `remove` 之后拍——快照里已无 car_01，重喂后车永远回不来。修=快照先于 remove。
3. S49 判据重写为三判据：badgeExists / meshBack / badgeHidden（占位盒判据全删）。
4. 三绿复验：vue-tsc 0 / build 绿（edit-main 125.84 kB）/ eslint 0 errors。
5. **冒烟收口策略修订（本轮最大流程教训，见下方验证策略区块）**：全量冒烟连跑 3 次皆 S49 处 RPC 超时（长链路 CDP 累积态，既有教训重演），独立探针隔离复现又遇 Edge headless 环境起不来（CDP 端口无响应、`--dump-dom` 空输出——环境问题非代码问题，耗时约 20 分钟）。**最终验证=用户浏览器人工目检（⑬⑭「正确」）**。

**验证证据（2026-10-13）**：三绿 + 用户浏览器人工验收通过。全量冒烟未在本补丁后重跑（Edge 环境问题 + 策略修订后人工验收优先；本补丁只删代码，最后全量基线 52 段绿已覆盖此前的盒路径，删盒不引入新逻辑分支）——**下次冒烟环境可用时顺带全量复跑一次作回归保险**。

#### 验证策略修订（2026-10-13 用户裁决，后续批次一律遵循）

**分工：模型交付人工验证清单，用户浏览器目检验收**（F-6e 复测清单模式的正式化）：

1. **模型侧验证降级为三绿**（vue-tsc/build/eslint，纯本地秒级）+ 交付时附「人工验证清单」：每项=操作步骤 + 预期现象 + 访问方式（默认 `http://localhost:5183/?edit=1`）。用户回「通过/哪条不对」，模型只修不对的。
2. **冒烟只在三类时点跑**：① 改动涉及数据层/引擎核心（SceneEngine/序列化/Bridge）；② 收口 Review 前（一次全量回归保险）；③ 用户要求。UI 视觉/交互类改动默认走人工验收。
3. **无头浏览器环境预检**：起冒烟前 5 秒探测 CDP 可用性（spawn + `/json/version`），不可用直接转人工验证清单，不修环境不硬跑。
4. **分段冒烟参数（批次 4 落地）**：smoke-r.mjs 加 `--only S49` / `--from S45`——需要跑时不再为全量买单；失败段后续跑汇总（一次全量看全所有失败）。
5. **断言时序预检（执行 checklist 固定项）**：写/改冒烟断言先自查「此断言依赖什么时序、快照在哪一步拍、轮询判据的最早/最晚窗口」——本轮 S49 快照时序 bug 若先走此自检即可拦住。

**Plan 基线同步（2026-10-13，修复轮八/九并行会话完成后）**：
- 修复轮八（蒙皮槽位 Gizmo 禁用 + 面板联动，S50/S51）与修复轮九（组合模型槽位材质链路，S52）已由并行会话完成收口——S49 编号空缺仍归本轮使用；验证段数基线从「48/48」更新为「S1–S52 全绿 + S49 新增」。
- 代码环境：registry.ts/createScene.ts 未被并行会话改动（占位盒/徽标落点无冲突）；materials.ts（F9-1 readMaterialSpec）/SceneEngine（F9-2 #索引口径）/LayoutGizmo+PropertyPanel（F8-1~3）为新基线，与本轮改动面零交集。
- scene-data.json 17:11 版含 codecars/codeworkers/coderacks（procedural 路线，不经过 makeAssetNodeFactory）——M 计数仍=4（car_01/car_02/example_01/person_01），Plan 不变。
- 环境实况（2026-10-13 核实）：5183 与 5199 双 server 存活（5199 疑为修复轮九冒烟遗留）——P5 执行时一并清理重启；smoke-r.mjs 22:19 版 pass 链现状 s1–s48+s50+s51+s52（无 s49）。

**风险与回退**：
- 风险 1：S49 断言「重建瞬间存在占位盒」有时序敏感（GLB 加载快时占位盒一闪而过）——断言设计为轮询早期窗口抓 LineSegments 存在性，抓不到时降级为「不产生破坏」（占位盒存在性属尽力断言，核心断言是移除+计数收敛+回归不破坏）
- 风险 2：example.ts 经 factory('cars') 复用构建器——计数经 onLoadCount 回调只在 createScene 接线侧传入，业务侧签名零改动（尾参可选）
- 风险 3：徽标 DOM 与卡片层 z-index/位置冲突——放 canvas 容器右下角，pointer-events:none
- 回退：占位盒与计数器均在 makeAssetNodeFactory 单点，revert 单文件即回现状

### 修复轮八：蒙皮槽位 Gizmo 禁用 + 材质面板随选中联动（2026-10-12 立项，F-6e 复测反馈驱动）

**背景**：修复轮六 F-6e 用户实测复测反馈两条，Root Cause 均已探针定案（probe-slot-gizmo1/2.mjs，蒙皮顶点级采样）。

**反馈 #1：拖 Gizmo 轴动但头发不动（Ch23_Hair 平移无效）**

Research Findings（探针实锤）：
1. **attached bind mode（three 0.185 默认）下 SkinnedMesh 局部 transform 对蒙皮顶点数学零效果**——蒙皮公式 `boneVertex = mesh.matrixWorld⁻¹ × bone.matrixWorld × boneInverse × v` 中 mesh 自身位移被前后两项精确抵消。探针：`position.x += 0.5` 后蒙皮采样顶点逐位相同。
2. **detached 模式 / rebind 均不是干净位移**——x 拖 0.5 变成世界 Y 掉 ~0.97m 且各顶点方向不一致（cm 域骨骼矩阵污染），不可用作产品行为。
3. GUIDE §6.2 已写「骨骼动画播放时局部偏移被骨骼矩阵覆盖」，但实测证明**静止态同样无效**——文档口径需修正为「SkinnedMesh 槽位局部 transform 对蒙皮顶点无效（静止/动画皆然）」。
4. S46 断言口径盲区：S46 验证的是「Gizmo attach 到 mesh / slots 数据落地 / serialize 往返 / undo」——**全部数据层/挂载层断言，无「蒙皮顶点移动」断言**（meshMoved 判据是 mesh.position 变化非顶点）。数据层正确 + 渲染无效 = 之前所有门禁绿灯但用户体验断链的实例。
5. 静态 GLB（非蒙皮）子网格局部 transform 有效（transform 层正常作用），**只有 SkinnedMesh 受限**——禁用必须按 isSkinnedMesh 精确分流，不能一刀切禁所有槽位 transform。

**反馈 #2：材质编辑面板不随选中/条目切换关闭或更新**

Research Findings（代码审读，PropertyPanel.vue:683-727）：
1. 三个入口 `openEdit(id)` / `openInlineEdit()` / `openSlotEdit(slotKey)` 各自只设自己的 ref：`openInlineEdit` 不清 `editSlotKey`、`openSlotEdit` 不清对方——面板已开时 inline↔slot 切换，`editMatId`/`editSlotKey` 不变或不触发 watch，面板内容陈旧（用户点另一个材质球，面板还显示旧的）。
2. 选中变化（点场景其他物体）时面板不关：`editOpen` 与选中态无任何联动——inline/slot 模式的编辑目标（anchorId/slotKey）已失效，面板继续显示并继续往旧目标写值。
3. 库模式（⚙ 编辑材质球本身）与选中解耦是**设计意图**（编辑库资产，引用者热更），不关不更新锚点属正确行为——联动只作用于非库模式。

**用户裁决（2026-10-12）**：
- 反馈 #1：**A 案——蒙皮槽位禁 Gizmo + 属性面板 transform 置灰 + 提示**（诚实反映数学现实；B 案「烘进 boneInverses」违背「不烘焙」裁决已否决）。
- 反馈 #2：**非库模式随选中关闭 + 切条目自动更新；库模式保持不关**。

**Plan（File Changes + Signatures + Checklist，2026-10-12）**：

File Changes：

1. `template/src/edit/LayoutGizmo.ts`（改）
   - `syncSelection` 槽位分支：`findBySlotKey` 命中后加蒙皮判据——mesh（或其子树）含 `isSkinnedMesh` 时不 attach，`slotTarget` 置 null，落到物体级 attach 逻辑（与锁定物体同处理路径：树中仍可点选看属性，只是无手柄）。
2. `template/src/edit/PropertyPanel.vue`（改）
   - 槽位态 transform 区（slotInfo 有值的分支）：目标为蒙皮 mesh 时九宫格输入框 disabled + hint 文案「骨骼网格的局部变换对蒙皮顶点无效（three.js 数学），仅静态网格可调」。
   - 材质面板联动：`openEdit`/`openInlineEdit`/`openSlotEdit` 三入口先统一重置 `editMatId`/`editSlotKey` 再按各自模式赋值（修陈旧内容 bug）；`watch(anchorId)`（或选中变化）时若 `editOpen && !editMatId`（非库模式）自动 `closeEdit()`。
   - 蒙皮判据：`slotInfo` 需扩展或经 `getSubMeshInfo`/直接 traverse 判 `isSkinnedMesh`（Plan 执行时按现成 API 选最小口径）。
3. `template/src/edit/EditMaterialModal.vue`（不改——watch(matId/anchorId/slotKey) 已在，入口修好后联动自然成立）
4. `template/scripts/smoke-r.mjs`（改）
   - S46 修正：`gizmoAttached` 断言反转——蒙皮槽位（Ch23_Hair）选中时 `gizmo.controls.object` **不应**是 Ch23_Hair（应回物体级 person_01 或 null）；保留 slots 数据层断言（落地/往返/undo 不变——数据层仍写，只是 Gizmo 不挂）。
   - 新增 S50：① inline 材质面板开着 → 点场景另一物体 → 面板自动关闭；② 面板开着点另一条目 → 内容更新（判据：面板 spec/color 与新目标一致或面板关开状态正确）；③ 库模式面板开着 → 点场景物体 → **不**关闭。
5. `template/docs/INTEGRATION_GUIDE.md`（改）
   - §6.2 槽位局部 transform 段落口径修正：静止态**同样无效**（原「骨骼动画播放时被覆盖」改为「SkinnedMesh 的槽位局部 transform 对蒙皮顶点无效（attached 模式数学必然），编辑器已禁用其 Gizmo/输入；静态 GLB 子网格不受影响」）。
   - 编辑器行为说明：蒙皮子网格树行可点选看属性/换材质/隐藏，transform 不可调。

Signatures：
- `LayoutGizmo.syncSelection()`：槽位分支加 `const skinned = hasSkinnedMesh(mesh)`（局部 helper，traverse 判 isSkinnedMesh）
- `PropertyPanel`：`const slotIsSkinned = computed(() => …)`（slotInfo + traverse）；三入口统一重置；`watch(anchorId)` 联动关闭
- smoke S46 `gizmoAttached` 断言改为 `gizmoNotOnSkinnedSlot`；S50 三段

原子 Checklist：
- [x] F8-1 LayoutGizmo：蒙皮槽位不 attach（回物体级）
- [x] F8-2 PropertyPanel：蒙皮槽位 transform 置灰 + 提示文案
- [x] F8-3 PropertyPanel：三入口统一重置 + 非库模式随选中关闭
- [x] F8-4 smoke-r：S46 断言修正 + S50 新增（三段）+ pass 链
- [x] F8-5 GUIDE §6.2 口径修正 + 编辑器行为说明
- [x] F8-6 三绿 + SMOKE 全绿（重点 S46/S45/S47/S48 回归）+ gates 40/40
- [x] F8-7 Reverse Sync：执行记录 + 验证证据 + F-6e 复测清单追加（蒙皮槽位 Gizmo 不出现/面板置灰/材质面板联动三复测点）

**修复轮八执行记录（2026-10-12，Plan Approved 后执行）**：

1. **F8-1**：LayoutGizmo `syncSelection` 槽位分支加 `hasSkinnedMesh(mesh)`（traverse 判 isSkinnedMesh 的模块级 helper）——蒙皮槽位 `slotTarget=null` 落回物体级 attach，与锁定物体同处理路径。
2. **F8-2**：PropertyPanel 新增 `slotIsSkinned` computed（selectedSlot + traverse 按末段名判 isSkinnedMesh）；槽位态九宫格输入框 `:disabled="slotIsSkinned"` + hint「骨骼网格的局部变换对蒙皮顶点无效（three.js 数学），仅静态网格可调」。
3. **F8-3**：三入口统一重置（`openEdit` 先清 `editSlotKey`，`openInlineEdit`/`openSlotEdit` 先清 `editMatId`——原 bug：面板已开时 inline↔slot 切换 ref 不触发 watch 内容陈旧）；`watch(anchorId)` 非库模式（editMatId===null）自动 `closeEdit()`。
4. **F8-4**：S46 `gizmoAttached` 断言反转为 `gizmoNotOnSkinnedSlot`（蒙皮槽位上手柄不应在 Ch23_Hair）+ 新增 `roDisabled`（≥9 输入框 disabled）；S46 ④ 面板输入通道改引擎级 commitLive 通道（UI 通道对蒙皮已关，数据层仍开放）；S45 同步修正（`roInputs.length>=9` 改 `roDisabled` + `skinnedHint` 断言）；S50 新增三段（槽位面板随选中关 / Hair→Body 同面板切换 / 库模式契约）。
5. **F8-5**：GUIDE §6.2 修正——原「骨骼动画播放时局部偏移被骨骼矩阵覆盖（静止态编辑可接受）」为**错误口径**，实测静止态同样无效；改为「SkinnedMesh 槽位局部 transform 对蒙皮顶点无效（attached 模式数学必然，静止/动画皆然），编辑器已禁用其 Gizmo/输入；静态 GLB 子网格不受影响」。
6. **F8-6**：vue-tsc 绿 / build 绿（edit-main 125.80 kB）/ eslint **0 errors**；**SMOKE PASS 全绿**（S45 八段/S46 八段/S50 三段，含并行会话新增 S51 视觉层 undo）/ **gates 40/40 PASS**。
7. **F8-7**：本记录即 Reverse Sync。

**执行中的并行会话协调（Plan 之外）**：
- 执行中发现另一会话并行提交了「代码组合模型」改动（car.ts/rack.ts/worker.ts procedural handler + SceneEngine.listSubMeshes 双数据源 + scene-data codecars/codeworkers/coderacks 三组）且带 5 个 TS 错误。经用户裁决「修错继续」：只做窄化修复（attr undefined 守卫 ×2、车轮循环解构 as Array<[number,number]>）+ 7 个 eslint error 格式修复（块注释→多行注释、行内多空格注释上移），零逻辑改动。并行会话的 smoke 新增 S51 已自然纳入 pass 链。
- S50 断言三轮迭代修正（均断言设计错误非产品缺陷）：① 初版假设「选中即开面板」错误（面板要经条目点击）→ ② `.emod` 类名错误（正确为 `.fpanel` 外壳，modal 以标题含「编辑材质」判别）→ ③ 聚焦槽位时列表收窄（shownSlots filter）导致找不到 Body 行——加「返回全部槽位」步骤后通过。教训：写 DOM 断言先查组件模板的真实类名与条件渲染，别猜。

**验证证据（2026-10-12）**：vue-tsc 绿 / build 绿（edit-main 125.80 kB）/ eslint 0 errors / SMOKE PASS（S45 roDisabled+skinnedHint+posMatch 全 true；S46 gizmoNotOnSkinnedSlot+roDisabled 全 true 且数据层四断言保留全绿；S50 panelOpenBefore/panelClosedOnSelect/titleUpdated 全 true，titleB='编辑材质 · Ch23_Body' 证明同面板切换）/ gates 40/40。

**F-6e 复测清单追加（修复轮八新增三项，待用户实测）**：⑥ 树点 Ch23_Hair → 视口**不应出现**平移/旋转/缩放手柄（原来会出现但拖了无效）；⑦ 属性面板变换区九宫格应置灰并显示「骨骼网格…」提示；⑧ 编辑材质面板开着 → 点场景其他物体应自动关闭，点另一槽位条目（如 Body）面板内容应切换。

**风险与回退**：
- 风险 1：S50 DOM 断言链路长（面板开关是 Vue 响应式）——沿用 S45 教训：状态判据走 bridge.getState()/引擎真值，DOM 只验存在性。
- 风险 2：禁 Gizmo 后 S46 原断言（attach 到 Ch23_Hair）必须同步反转，否则冒烟红——checklist F8-4 与 F8-1 同批执行。
- 风险 3：蒙皮判据用 traverse 每帧开销——仅选中变化时执行一次（syncSelection 时机），非每帧。
- 回退：LayoutGizmo/PropertyPanel 两文件各自独立可 revert；数据层 slots 通道不动（静态网格行为零变化）。

### 修复轮九：代码组合模型槽位材质链路（2026-10-12 立项，F-6e 复测反馈 2.0 驱动）

**背景**：用户复测三条反馈（并行会话的「代码组合模型」car/rack/worker 落地后暴露的系统性缺口）。三探针定案（probe-tree-slot/tree-slot2/worker-panel）。

**反馈与根因（全部探针实锤）**：

1. **tree_01 改子节点材质没效果**——三口径死结：`listSubMeshes`（collectInstanceMeshes）报 key `#0/#2/#4/#6`（autoIndex 在 keyOf 与 name 兜底两处交错递增，key 与 name 双双错位如 key=#0/name=#1）；`resolveSubMesh` 对 4 个无名 mesh **全部报 `#0`**（无名节点序号去重逻辑错）；`findBySlotKey` 把 `#0` 解析到第一个无名字节点=树干。**视口点树叶改的其实是树干**（用户感知「没效果」）。根子=tree.ts 的 mesh 全部无名，一切 `#` 索引兜底都是脆弱口径。
2. **codeworker_01 helmet_dome 材质球默认 #ffffff/#000000**——活材质真值 `#f5c518`（黄）/roughness 0.35 实测在位，但 EditMaterialModal 无 override 分支只取 `seedMaterialType`（类型名），**不读活材质的 color/emissive/roughness 等标量** → 面板显示默认值且首次改色会把真值覆盖掉。这是「代码组合模型」的系统性缺口：GLB 资产走 buildReport 有材质概要，组合模型只有活实例可读——缺一个「读活材质完整 spec」的公共 API。
3. **helmet_dome 面板开着点 head 面板不切换**——探针：`slotNow.slotKey` 已是 `head`（引擎态切了）但面板标题仍 helmet_dome。根因=PropertyPanel 的 `watch(anchorId)` 只监听物体级选中；**槽位切换（anchorId 不变）无 watch**，`editSlotKey` ref 没有跟随 selectedSlot 更新的通道。S50 只测了「条目点击入口」（EditMaterialModal 自带 watch(props.slotKey)），漏了「树行/视口点选」入口（外部 selectSlot → PropertyPanel 的 editSlotKey 无人同步）。

**用户裁决（2026-10-12）**：走通用方案——公共 API + handler 命名约定，不逐个 handler 打补丁。

**Plan（File Changes + Signatures + Checklist，2026-10-12，待 Plan Approved）**：

**设计**：
- **公共 API `readMaterialSpec(mesh)`**（materials.ts 导出）：读单个 mesh 活材质的完整 MaterialSpec（type + color/emissive/roughness/metalness/opacity 等标量，贴图槽读有无→mapUrl 不溯源自 GLB 的内嵌贴图无 URL，跳过）。三类资产（GLB/图元/组合模型）统一口径：面板初始值=活材质真值。
- **handler 命名约定**：handler 建的 mesh **必须 `.name`**（写进 GUIDE §3.2 + tree.ts 示范补名 trunk/foliage_1/2/3）。命名后 `#` 兜底口径自然消失（组合模型全具名）。
- **`#` 索引口径修复**（防御性，命名约定之外仍需正确）：collectInstanceMeshes 的 autoIndex 改为「按 traverse 序单次分配」——keyOf 与 name 兜底共用同一计数器且每个节点只计一次；resolveSubMesh 同口径。实测四 mesh 应报 #0/#1/#2/#3 互异。
- **槽位切换联动**：PropertyPanel 加 `watch(() => props.bridge.getState().selectedSlot)`（或 onState 内比对）——非库模式面板开着且 slotKey 变了 → 更新 editSlotKey（面板内容跟随，不关闭——同物体槽位间切换语义）。
- **EditMaterialModal 无 override 分支**：槽位/inline 模式种子改 `readMaterialSpec(目标mesh)`（含全部标量），替换现 seedMaterialType 仅类型的取值。

File Changes：
1. `template/src/scene-core/materials.ts`（改）：新增 `readMaterialSpec(mesh: THREE.Mesh): MaterialSpec` 导出
2. `template/src/scene-core/engine/SceneEngine.ts`（改）：`collectInstanceMeshes` 的 `#` 索引单次分配修复；`resolveSubMesh` 的无名节点序号同口径（读现实现后对齐）
3. `template/src/scene-core/handlers/procedural/tree.ts`（改）：mesh 补名（trunk/foliage_1/foliage_2/foliage_3）
4. `template/src/edit/EditMaterialModal.vue`（改）：无 override 种子改 readMaterialSpec（slot 模式定位 mesh 同现有 targetType 查找逻辑）
5. `template/src/edit/PropertyPanel.vue`（改）：selectedSlot 变化 watch → 非库模式面板 editSlotKey 跟随
6. `template/scripts/smoke-r.mjs`（改）：S52 新增——① tree_01 槽位清单 4 条全具名（trunk/foliage_*）；② 视口 resolveSubMesh 对 4 个 tree mesh 报互异 key；③ helmet_dome 面板初值=活材质真值（readMaterialSpec 对照，经 EditMaterialModal 无 override 通道或直接 API）；④ helmet 面板开着树点 head → 面板标题切 head；pass 链追加
7. `template/docs/INTEGRATION_GUIDE.md`（改）：§3.2 handler 编写补「mesh 必须 .name」约定 + 说明（子网格材质编辑依赖名称路径 key）

Signatures：
- `readMaterialSpec(mesh: THREE.Mesh): MaterialSpec`（materials.ts；只读标量+类型，贴图槽跳过）
- `collectInstanceMeshes` 内部改造，签名不变
- PropertyPanel：`watch(() => state.value.selectedSlot, …)` 非库模式联动

原子 Checklist：
- [x] F9-1 materials.ts：readMaterialSpec 公共 API
- [x] F9-2 SceneEngine：# 索引口径修复（collectInstanceMeshes + resolveSubMesh 同源计数）
- [x] F9-3 tree.ts：mesh 补名示范
- [x] F9-4 EditMaterialModal：无 override 种子改活材质真值
- [x] F9-5 PropertyPanel：槽位切换面板跟随
- [x] F9-6 smoke S52 四段 + pass 链
- [x] F9-7 GUIDE §3.2 命名约定
- [x] F9-8 三绿 + SMOKE 全绿 + gates 40/40
- [x] F9-9 Reverse Sync + F-6e 复测清单再追加

**修复轮九执行记录（2026-10-12，Plan Approved 后执行）**：

1. **F9-1**：materials.ts 新增 `readMaterialSpec(mesh)` 导出——按 fieldsForType 白名单读活材质标量/颜色/枚举（Color→hex 字符串、side 数值→枚举名、attenuationDistance Infinity→null；贴图槽跳过——GLB 内嵌贴图无 URL）。index.ts 转出口。
2. **F9-2**：`#` 索引语义统一为「**父节点的无名子节点中的序号**」（兄弟局部序，与遍历顺序无关）：materials.ts 新增 `unnamedChildIndex` 导出（findBySlotKey 解析端同语义重写——修复前是全局 autoIndex 递增，生成/解析口径漂移）；SceneEngine 的 `collectInstanceMeshes`（keyOf 内联进 traverse 回调，key 与 name 同源不再错位）与 `resolveSubMesh`（修复前 `#${parts.length}` 沿父链恒 0——4 个树 mesh 全报 #0 的根因）三处统一。
3. **F9-3**：tree.ts mesh 补名 `trunk`/`foliage_1`/`foliage_2`/`foliage_3`。
4. **F9-4**：EditMaterialModal 无 override 分支重写——槽位模式按末段名定位 mesh、inline 模式取第一个 mesh，`readMaterialSpec` 取全量真值（替换原 seedMaterialType 仅类型的种子；该 import 一并移除）。
5. **F9-5**：PropertyPanel 新增 `watch(state.selectedSlot)`——非库模式面板开着：跨物体（nodeId≠anchor）→ 关闭；同物体槽位变化 → `editSlotKey` 跟随（面板内容更新不关闭）。
6. **F9-6**：S52 五段——① 树清单全具名；② 视口 resolveSubMesh 4 mesh 互异 key；③ foliage_1 改色只变第二层树冠（colorsBefore/After 逐位对照，且 undo 清理）；④ readMaterialSpec 直读（页面内 `import('/src/scene-core/materials.ts')`）= #f5c518；⑤ helmet_dome 面板开→树点 head→标题切换。pass 链追加。
7. **F9-7**：GUIDE §3.2 新增「mesh 必须命名（.name）」约定段（snake_case 具名；无名退化 #N 兜底可用但可读性差）。
8. **F9-8**：vue-tsc 绿 / build 绿（edit-main 125.79 kB）/ eslint 0 errors（300 warnings）；**SMOKE PASS 全绿**（S52 五段 + S40-S51 全回归）/ **gates 40/40 PASS**。
9. **F9-9**：本记录即 Reverse Sync。

**执行中的环境噪声（三次冒烟中断，均非产品问题）**：
- 第一次 S46 卡死 40s：长链路累积态（同 server 已跑 5+ 轮全量冒烟，vite HMR 模块图累积）——S46 独立探针全通（iter 9 即中）证明产品无卡死。
- 第二次 S42 页面异常：TaskStop 杀 dev server 未杀净 vite 子进程（端口仍占）+ 新 server 启动窗口期，半死页面 `__gts3d` undefined。
- 解法：`Stop-Process -Id <PID>`（netstat 查端口占持者）杀净 → 重起 server → 全量一次通过。
- 教训：**TaskStop 停 npm run dev 不级联杀 vite 子进程**——冒烟前查端口 LISTENING 进程启动时间，复跑全量冒烟前重启 server 清 HMR 累积态。

**验证证据（2026-10-12）**：三绿 + SMOKE PASS（S52 五段全 true：treeNamed/resolveDistinct/onlyFoliage1/specTrue #f5c518/panelFollows）+ gates 40/40。探针级：树改 foliage_1 精准命中（colorsAfter 仅 [1] 变 #ff00ff）、helmet 面板初值 #f5c518、面板切换 titleB=编辑材质 · head。

**F-6e 复测清单追加（修复轮九新增四项，待用户实测）**：⑨ 树展开子节点应显示 trunk/foliage_1/2/3（不再是 #1/#3/#5/#7），点 foliage_2 改色只变第二层树冠；⑩ codeworker 点 helmet_dome 编辑材质，面板应显示黄色 #f5c518（非 #ffffff），roughness 0.35；⑪ helmet_dome 面板开着点 head → 面板应切到 head；⑫ 任意物体无 override 时编辑材质面板初值=活材质真值（GLB/图元/组合模型统一）。

**风险与回退**：
- 风险 1：readMaterialSpec 对 GLB 内嵌贴图材质（person）返回无 mapUrl 的 spec——面板显示与真值有贴图差（color 等标量仍真）。可接受：贴图编辑本来走素材库上传通道。
- 风险 2：# 索引修复改变现存 scene-data 里已写入的 slots key（codecars 等若已用 # key 存了 override）——实测当前 scene-data 无 slots 残留（探针 listKeys 无命中），无迁移负担；GUIDE 已记「key 与结构绑定，重导出失效」同类语义。
- 风险 3：S52 ④ 复用 S50 的面板断言套路（.fpanel__title 含「编辑材质」），路径已验证可跑通。
- 回退：六文件各自独立可 revert；tree.ts 补名会改槽位 key（#N → 具名）——若用户已用旧 key 存数据需同步（当前无此数据）。

### 评审记录 9（2026-10-13，修复轮七（含补丁）+ 批次 PH 代码评审（REVIEW EXECUTE），mandatory three-axis）

**评审范围**：修复轮七（GLB 加载感知：徽标；占位盒已裁决撤除）+ 修复轮七补丁（撤盒 + 计数器串组修复 + S49 快照时序修复 + 验证策略修订）+ 批次 PH（fetch-polyhaven.mjs + 56 资产入库 + gates 用例 37 语义化）。两轮由并行会话同期完成，改动面经 git status/diff 核实零交集后合并评审。

**评审方式**：git diff HEAD 逐文件对照 Spec 契约 × manifest/search-index/gates 复跑 × 中文检索实测抽查（椅子/灯具/工业机柜/变电站/摄像头/岩石/轮椅七查询）× S49 代码逻辑复核（时序预检）。

#### Review Matrix

| # | 轴 | 检查项 | 结论 | 证据 |
|---|---|---|---|---|
| 1 | Axis-1 | 修复轮七目标（加载感知）最终态达成 | PASS | 用户浏览器人工验收「正确」（验证策略修订后人工验收为一级证据）；徽标三态收敛设计（完成/过期/失败都 N+1）代码核实；三绿过 |
| 2 | Axis-1 | 占位盒撤除裁决闭环完整 | PASS | 探针定案记录（probe-placeholder/2：首载 getReport 恒 null + 缓存后盒闪过）→ 用户裁决 → 撤除执行 → 复测清单⑬⑭更新 → 人工验收——决策链全程留痕 |
| 3 | Axis-1 | 批次 PH 目标（56 资产入库+检索可用） | PASS | polyhaven-seed manifest 56 entries；models/ 59 glb（含 56 PH + example/person/rack）与 manifest 逐一对账 PASS；search-index docs=59 含全部 PH 资产；中文检索七查询抽查：椅子→outdoor_table_chair_set_01 / 灯具→chandelier_03 / 工业机柜→rack+portable_generator / 变电站→modular_electric_cables+utility_box / 摄像头→security_camera_01 top-1 / 岩石→rock_09 top-1 全命中 |
| 4 | Axis-2 | 修复轮七 Plan 签名忠实度 | PASS | makeAssetNodeFactory 五参签名（onLoadCount 尾参可选）/ createLoadBadge 返回 {update,dispose} / getLoadBadgeState WeakMap 按引擎隔离——三签名与 §7 Plan 一致；registerBuiltinFactories 尾参转发、example.ts/main.ts/edit-main.ts 接线全落码（diff 逐行核实） |
| 5 | Axis-2 | Plan-Execution Diff：占位盒撤除是计划外变更 | **记录（非 FAIL）** | Plan P1 含 createPlaceholderBox，补丁轮裁决撤除——用户显式裁决（「不要盒子了」）+ 探针证据支撑，属合法范围变更；Spec 补丁区块已完整记录变更动机与执行细节 |
| 6 | Axis-2 | PH 签名忠实度（§4.16.6） | PASS | fetch-polyhaven.mjs 配额/名单双模式 + --res 1k\|2k + --resume 与裁决一致；gates 用例 37 语义断言 `>=3 && [example,person,rack].every(includes)` 落码（diff 核实）；manifest 中文三件套（中文 category/tags + 英文 name/search_text）符合四项裁决 |
| 7 | Axis-3 | 计数器模块级共享的正确性 | PASS | 闭包改模块级 loadTotal/loadDone——boot 期 cars/examples/asset 三工厂并行计数不串组、先完成的工厂不提前隐藏徽标；缺陷机理（各闭包独立计数）与修法记录完整 |
| 8 | Axis-3 | S49 快照时序修复 | PASS | 快照先于 remove 拍——撤除盒判据后 S49 三判据（badgeExists/meshBack/badgeHidden）逻辑自洽；注：补丁后全量冒烟因 Edge 环境问题未重跑，已挂账（见 Blocking 之下挂账项） |
| 9 | Axis-3 | PH 资产数据质量 | PASS（1 处 P3） | id 违规 0；中文 tag 覆盖 55/56（wheelchair_01 无中文 tag——搜「轮椅」miss，top 结果是 sofa_03/armchair_01）；类别分布合理（工业 18/道具 10/家具 10/灯具 6/装饰 4…） |
| 10 | Axis-3 | 代码卫生（评审顺手修复） | **FIXED** | registry.ts:82 `@param onLoadCount` 注释残留「占位盒仍生效」——占位盒已撤注释撒谎；评审中已修（vue-tsc 复验 0 错） |
| 11 | Axis-3 | 验证策略修订的落地风险 | PARTIAL（提示项） | 人工验收为一级证据 + 冒烟三类时点——策略合理，但「补丁后全量冒烟未跑」意味着 S1–S48/S50–S52 回归证据停留在撤盒前版本；挂账批次 4 收口时强制全量复跑一次闭环 |

#### Overall Verdict: **PASS**

- **无阻塞项**。两轮目标全部达成、签名忠实、数据质量过门禁，1 处注释卫生问题评审中已修。
- **挂账（不阻塞）**：
  1. [P2] 补丁后全量冒烟未复跑（Edge headless 环境问题 + 策略修订转人工验收）——**批次 4 收口时强制全量复跑一次**作回归保险；若环境仍不可用，评估以 gates 40/40 + 分段冒烟（--only S49）替代。
  2. [P3] wheelchair_01 无中文 tag（搜「轮椅」miss）——字典补「wheelchair→轮椅」词条或接受（56 中 1 条，用户裁决过 name 保留英文，中文覆盖靠 tags 的边界情形）。
  3. [P2 存量] S52④ `import('/src/...')` vite dev 专属路径——批次 4 验证回路评估（历史挂账并入）。
- **Plan-Execution Diff（§7 合并）**：占位盒撤除（计划内→用户裁决撤除，记录完整）；其余零偏差。
- **gates 复验（合并基线）**：2026-10-13 本评审中实跑 **40/40 PASS**（含 PH 语义化用例 37，注入清单 59 模型实证）。


### 修复轮十：槽位视觉互清 + Poly Haven GLB bufferView 缺字段（2026-10-13 立项，批次 5.7 用户验收反馈驱动）

**用户验收反馈（2026-10-13，四项）**：① 点机柜卡片 PASS；② 5s 轮询告警灯变红 PASS；③ 摄像头不可见（包围盒 0×0×0）；④ 改 rack_01 panel_top 蓝后再改 rack_02 panel_back 红 → rack_01 蓝丢失；⑤ 用户裁决「不只修这一次的 bug，要生成的页面都没这个问题」。

**缺陷④根因（template 系统性，非演练代码问题）**：编辑器 7 处写入点（EditMaterialModal:137 / OutlineTree:362,389,396 / PropertyPanel:219 / LayoutGizmo:214 / MaterialLibService:229）用**单物体数据走 `handle.update({__visuals})` 的整表替换语义**——SceneEngine.update:574-580「提供即整表替换：快照里没有的 id 清除视觉层」→ 只带 rack_02 的 update 把 rack_01 从 visuals 清掉并 recreateNode 重建 → 蓝色丢失。历史冒烟未暴露：全部是单物体编辑场景（S38 等），从未两物体先后编辑。**注意 `applyVisual(id, visual)` 本身就是合并语义（SceneEngine:372 `{...旧, ...新}`）**——单物体编辑走它即可，整表替换语义只被 undo/redo rebuild（全量快照）需要。

**修法（A 案，用户裁决「生成的页面都没这个问题」= 修 template 母版而非演练工程）**：7 处编辑器写入点全部改走 `sceneEngine.applyVisual(id, 增量)`（或物体级 replaceVisual 不变）；`update({__visuals})` 整表替换语义保留（undo/redo rebuild 依赖）。layoutGizmo/MaterialLibService 的 slots 写法同理改 applyVisual。**同时回灌 skill template/（母版修复，所有后续生成工程免疫）+ e2e 演练工程复验。**

**缺陷③根因（skill 资产管线系统性）**：56 个 Poly Haven GLB 的**贴图 bufferView 缺 `buffer:0` 字段**（几何 view 有、贴图 view 无——fetch-polyhaven.mjs mergeToGlb 手写合并器漏写）。three 0.185 GLTFParser.loadBufferView:3054 把 undefined 传 loadBuffer → `json.buffers[undefined]` → `Cannot read properties of undefined (reading 'type')` → GLB 加载失败 → 空 Group → 包围盒 0×0×0。glTF 2.0 规范 bufferView.buffer **必填**——Poly Haven 源没问题（fetch 落盘的原始 gltf 是多文件形态，bufferView 指同一 .bin），是**我们的合并器**重写 JSON 时漏了。**为何 validate-model 没拦**：自解析器按默认 buffer=0 理解直接 PASS——入库门禁没模拟消费端（three）行为。

**修法**：① mergeToGlb 补 `buffer:0`（治本）；② 存量 56 GLB 一次性修补（重写 JSON chunk 的 bufferView 补字段，bin 不动——零重下载）；③ validate-model 增「bufferView 缺 buffer 字段」硬门禁（防再漏）；④ 摄像头等全部 Poly Haven 资产在演练工程复验加载。

**用户裁决⑤（流程）**：「生产交付阶段会跑这么久的验证吗，不合理的这样子，要改吧？有需要请写spec」——已落 [[feedback-delivery-stage-speed]] 记忆 + 本 Spec 修复轮记录：交付阶段 UI/交互验证一律人工清单；机器探针只测数据层且复用 smoke 完整模式一次写对。

- [x] F10.1 template 七处编辑器写入点改 applyVisual（EditMaterialModal/OutlineTree×3/PropertyPanel/LayoutGizmo/MaterialLibService）
- [x] F10.2 fetch-polyhaven.mjs mergeToGlb 补 buffer:0
- [x] F10.3 存量 56 GLB 修补脚本 + 执行
- [x] F10.4 validate-model.mjs 增 bufferView.buffer 必填门禁
- [x] F10.5 同步 e2e 演练工程（template 改动回灌 + 资产修补）+ 复验（摄像头可见 + 双物体槽位编辑互不干扰）
- [x] F10.6 gates 复跑 + 三绿（template 与 skill 脚本两侧）

**修复轮十执行记录（Reverse Sync，2026-10-13）**：

- **F10.1 七处改 applyVisual + applyVisual 逐槽合并**：执行中发现原 `applyVisual` 的浅 merge（`{...旧, ...新}`）会**整块替换 slots map**——单物体编辑第二个槽位时第一个槽位丢失（单元验证：`{slots:{a:蓝}}` merge `{slots:{b:红}}` 后 a 丢失）。修：`applyVisual` 补 slots 逐槽合并（`merged.slots[key] = {...旧槽, ...增量}`，槽内字段浅覆盖）。7 处写入点简化为传单槽增量（原来各自手工读 cur 拼 slots 的样板代码全部删除——applyVisual 语义兜底后不需要）。**改动面：template/ 7 个 edit 文件 + SceneEngine.ts**；演练工程同步回灌 7 文件。`update({__visuals})` 整表替换语义保留（undo/redo rebuild 全量快照依赖）。
- **F10.2 mergeToGlb 实为两个 bug**：① 贴图 bufferView 缺 `buffer:0`（原注释以为只有这一个）；② **贴图 view 索引多加了 `binViews.length`**——bin 是数据块不占 view 索引，images 引用整体 +1 偏移，末位贴图越界（security_camera 实测：images 引用 9-12 但只有 0-11）。两个都修（`buffer: 0` 前置默认 + 索引去掉 binViews.length）。**为何 ① 先修完还是加载失败**：② 的越界让 GLTFParser 走到 loadBuffer(undefined) 以外的新错误路径（'reading extensions'）——第一轮修补只补字段后 Node 复测才暴露 ②。
- **F10.3 存量修补走「缓存重合并」而非二进制 patch**：首次内联 patch 脚本写出两个容器头 bug（total 长度写成 12 + BIN 魔数 bash 转义坏），二次修头后仍因索引偏移 ② 未修而失败——**最终定案：从 .tmp-polyhaven-1k/fetch 缓存用修好的 mergeToGlb 全量重合并 57 资产**，直接覆盖 skill 库 + 演练工程两处。验证：**59/59 通过 three GLTFLoader Node 解析**（person 的 Draco 报 DRACOLoader missing 属预期——浏览器路径有 decoder；Node parse 实测 security_camera 39ms 成功 2 meshes）。
- **F10.4 消费端一致性硬门禁**：validate-model.mjs inspectModel 增两条 violations：① bufferView[i] 缺 buffer 字段；② images[i].bufferView 索引越界。单元验证：构造缺字段+越界 JSON 两条全拦。**动因：56 资产入库时全部 PASS（自解析器默认 buffer=0 理解），直到真实场景引用才炸——门禁只验规格不验「three 能否加载」**。后续增强候选（未立项）：import-assets 内嵌 GLTFLoader 全量 parse 作为最终门禁。
- **F10.5 复验**：演练工程三绿（vue-tsc 0 / eslint 0 errors / build 10.43s PASS）。数据层探针（复用 smoke 完整模式）：**槽位互扰 PASS**（rack_01 panel_top 蓝 → rack_02 panel_back 红 → rack_01 再改 panel_back 绿，rack_01 panel_top 蓝全程保持 + 视觉层双物体俱在）；**摄像头 headless 探针挂起**（Network 域：GLB 200 到达但 loadingFinished 不触发，徽标 0/3——swiftshader headless 响应流偶发挂起，非文件问题：Node 解析同字节成功 + HTTP 字节一致已证）。**转人工验证（用户裁决纪律）**。
- **F10.6 template 三绿**：vue-tsc 0 / eslint 0 errors（309 warnings 基线）/ build PASS。
- **用户复验通过（2026-10-13）**：「都可以了」——摄像头可见可点、工人正常、槽位互扰修复确认、原功能（卡片/轮询告警）无回归。
- **教训沉淀**：① 编辑器写入通道要区分「单物体增量」与「整表快照」两个语义——混用即互清（7 处同款写法说明是范式级错误，不是笔误）；② **入库门禁必须模拟消费端行为**（自解析通过 ≠ three 能加载）——56 资产全数漏检的根因；③ 合并器类脚本的索引算错（+1 偏移）比缺字段更隐蔽——第一轮修补只看「缺什么补什么」没验「引用指哪」，多耗一轮；④ 二进制 patch 脚本易引入容器头新 bug（两次返工），**有干净源数据时优先重生成而非 patch**。



**评审范围**：批次 4 验证回路（4.1 smoke-structural / 4.2 smoke-visual / 4.3 perf-fps / 4.4 ensure-env 四新脚本 + smoke-r 分段参数 + S52④ 修复 + 强制全量冒烟复跑 + §8.2 R1-3 存量改造三连：perf-fps WARN 化、build.mjs 预算 warnings 化、gates 用例一拆二）。

**评审方式**：git diff/status 改动面核实（4 新建 + 3 修改，无越界文件）× diff 逐行对照 §8.2/验证策略修订契约 × 全部验证设施实跑复验 × 新脚本逐个 Axis-3 正确性审查（判据真实性/死代码/硬编码/豁免过宽四类检查）。

#### Review Matrix

| # | 轴 | 检查项 | 结论 | 证据 |
|---|---|---|---|---|
| 1 | Axis-1 | 批次 4 目标达成（验证回路四脚本可用） | PASS | ensure-env 三态+CLI 优先级+JSON 全实测；smoke-structural 双模式 STRUCT PASS×2；smoke-visual 四截图 31–107KB 产出且多模态看图自证有效（场景可见/无漂浮/比例正常）；perf-fps 预算+fps 观测跑通 |
| 2 | Axis-1 | 挂账三项收口 | PASS | P2 全量冒烟（S1–S51 全量跑过 + S52 分段隔离全 true；S52 处 RPC 超时=长链路 CDP 累积态环境噪声，同修复轮七定案）；P2 S52④ dev 路径（import('/src/...') → 直读 mesh.material 活实例，S52 五断言全 true）；P3 wheelchair_01 仍挂（批次 5，非本批次范围） |
| 3 | Axis-1 | 验证策略修订落地（分段参数） | PASS | `--only S49`/`--from S52` 双模式实测 PASS；DEPS 前置闭包级联（S10/S11/S12←S9 sharedId 状态依赖）防分段假失败 |
| 4 | Axis-2 | §8.2 R1-3 修订契约忠实度（三连改造） | PASS | perf-fps：重/卡 WARN 不改退出码 + --strict 升 1（实测 exit 1）+ duration 默认 20；build.mjs：预算 errors→warnings + --strict（两态实测 exit 0/1）；gates：预算用例一拆二（WARN 放行 + strict 阻断）40→41 用例 41/41 PASS——三层分类（坏=唯一硬 FAIL 归 smoke-structural）与 §8.2 逐条对齐 |
| 5 | Axis-2 | Plan-Execution Diff | PASS | 4.1 首版「canvas 像素统计」实装为「fps>0 渲染活性」——swiftshader 下像素法不可靠（S1 既定口径，执行记录已记档）；其余零偏差 |
| 6 | Axis-3 | smoke-visual focusId 判据真实性 | **FIXED（P2，评审发现）** | 首版判据 `c.userData?.assetGlb` 在代码库零存在（grep 证实）——恒 false 每次走 ids[0] 兜底，被兜底掩盖。修：改 `listSubMeshes(id).length > 0`（GLB/组合模型才有子网格清单）；复跑 VISUAL PASS 四截图 |
| 7 | Axis-3 | smoke-structural 404 豁免口径 | **FIXED（P2，评审发现）** | 首版豁免 `/favicon\|Failed to load resource.*404/` 过宽——任何资源 404 都被吞，资产缺失类硬 FAIL（§8.2 坏类）漏检。修：豁免收窄为 favicon + 无 URL 的通用 404 Log 文本（真机浏览器实测无 404 定案，headless 特有噪声；带路径的资源 404 仍会以 Network 形态暴露）；复跑双模式 STRUCT PASS |
| 8 | Axis-3 | smoke-r 分段守卫质量 | FIXED（P3×2，评审顺手修） | ① isTarget 死代码（定义后零调用，skipped 守卫已覆盖其职责）删除；② FROM 闭包硬编码 `i <= 52` 上限（未来加段漏级联）→ 从 DEPS 动态取上界。复跑 --only S49 / --from S52 双 PASS |
| 9 | Axis-3 | ensure-env 非法值行为 | PASS | GTS3D_MULTIMODAL=abc → 视同未声明走默认非多模态档（fail-safe 方向正确：宁缺勿误判多模态） |
| 10 | Axis-3 | 评审流程自身教训 | 记录 | 404 定位时对 CDP 探针空转重试 4 次（环境间歇性问题），用户两次打断——沉淀「卡点升级规则」：探针 2 次不中停手转用户浏览器目检 + 人工可验点主动给「URL+步骤+预期」清单（用户浏览器 10 秒判定：真机无 404） |

#### Overall Verdict: **PASS**

- **无阻塞项**。四脚本+分段参数+挂账收口+§8.2 三连改造全部落地并验证；评审发现 2 处 P2 判据缺陷 + 2 处 P3 卫生问题，均当场修复复验。
- **复验终态（2026-10-13）**：STRUCT PASS×2（run/edit）+ VISUAL PASS（判据修正后复跑）+ PERF OK + smoke-r --only S49 / --from S52 双 PASS + **gates 41/41** + 三绿（vue-tsc 0 / eslint 0 / build PASS）。
- **挂账（不阻塞）**：P3 wheelchair_01 无中文 tag——批次 5 清点（评审记录 9 遗留）。
- **Plan-Execution Diff**：4.1 像素法→fps 活性（既定口径换算，已记档）；其余零偏差。

### 评审记录 11（2026-10-13，批次 5 全部（5.0/5.2/5.3/5.5/5.4/5.6）+ 修复轮十，REVIEW EXECUTE，mandatory three-axis）

**评审范围**：skill 大脑交付（SKILL.md + references 七文档 + README）+ P3 挂账收口（五修五记档）+ 端到端演练（机房监控场景九步全流程）+ 修复轮十（槽位视觉互清 + Poly Haven GLB bufferView/索引双 bug）。

**评审方式**：git 改动面核实（9 新文档 + template/.gitignore + 18 修改 + 56 GLB 重合并，无越界文件）× Spec 契约逐项对照 × 全量回归实跑（gates 41/41 / ensure-env 三 PASS / 检索抽查 / validate-model 新门禁单测）× SKILL.md 路由完整性（引用脚本存在性逐一核验）× 用户人工验收（摄像头/工人/槽位互扰/功能回归四项全过）。

#### Review Matrix

| # | 轴 | 检查项 | 结论 | 证据 |
|---|---|---|---|---|
| 1 | Axis-1 | 批次 5.2/5.3/5.5 交付完整（SKILL.md 九步+硬约束+命令路由 / references 七文档 / README 投放说明） | PASS | SKILL.md 14 处文档引用全部存在；命令路由 10 脚本全有效（smoke-r 带 template/ 前缀）；frontmatter/降级阶梯四层/硬约束七条/人工验收策略全落地 |
| 2 | Axis-1 | P3 挂账收口（五修五记档） | PASS | wheelchair 中文检索第 1 位 0.3893（本轮复抽查确认）；哨兵算术/TRANSCRIPTION 转义/注释卫生五处/lock 内网化 221 处均落地；记档关闭项理由在案 |
| 3 | Axis-1 | 5.6 端到端演练目标（SKILL.md 可用性实测） | PASS | 九步全流程走完产出双工程；S3 分层决策记录；验证报告含 WARN 回应；发现三项改进输入（手工补拷指引/onNodeUpdated 串接/探针复用模式）已记档 |
| 4 | Axis-1 | 修复轮十（用户验收反馈四项） | PASS | 槽位互扰数据层探针 PASS + 用户复验「都可以了」；摄像头/工人可见可交互；56 资产 59/59 过 three 解析 |
| 5 | Axis-2 | 修复轮十修法忠实度（用户裁决「生成的页面都没这个问题」= 修母版） | PASS | 改动落 template/ 母版（7 edit 文件 + SceneEngine）与 skill 脚本（fetch-polyhaven/validate-model），演练工程只是回灌验证载体——后续 init 产出全部免疫 |
| 6 | Axis-2 | applyVisual 语义变更正确性 | PASS | 逐槽合并单元验证 + 探针双场景（跨物体编辑 + 同物体第二槽位）全保持；`update({__visuals})` 整表替换语义保留（undo rebuild 依赖）——两语义分工在代码注释与 Spec 双记录 |
| 7 | Axis-2 | mergeToGlb 修复完整性（两 bug） | PASS | buffer:0 前置 + 索引去 binViews.length；从 fetch 缓存全量重合并（非二进制 patch——patch 两轮返工后定案重生成）；59/59 Node 解析通过 |
| 8 | Axis-3 | validate-model 新门禁有效性 | PASS | 单元验证：缺 buffer 字段 + 索引越界两条 violations 全拦；armchair 重合并产物 PASS（约定告警属既有基线） |
| 9 | Axis-3 | 回归完整性 | PASS | gates **41/41**；ensure-env 三 PASS；template 三绿（vue-tsc 0/eslint 0 errors/build PASS）；演练工程三绿；检索抽查（机柜/轮椅/监控摄像头）全第 1 位命中 |
| 10 | Axis-3 | 残留风险 | 记录 | ① e2e-demo-serverroom 与 shots-visual 在 gts/test 下（演练产物非 skill 资产，处置待用户）；② import-assets 内嵌 GLTFLoader 全量 parse 门禁为增强候选未立项；③ 56 GLB 重合并后 gates --with-build 端到端用例本轮未跑（涉及 npm install 数分钟；预算资产注入用例已覆盖路径） |

#### Overall Verdict: **PASS**

- **无阻塞项**。批次 5 全部交付物落地并验证；修复轮十两 bug 均为系统性根因修复（母版+管线），用户人工验收通过。
- **复验终态（2026-10-13）**：gates 41/41 / ensure-env 三 PASS / template+演练工程三绿 / 59 GLB 全过 three 解析 / 检索抽查三项第 1 位 / 用户四项人工复验全过。
- **Plan-Execution Diff**：5.4 P3 清点为执行期展开产物（批次 5 原仅列「P3 挂账清点」一句，实际展开七类 18 项——执行记录已补全）；其余零偏差。
- **评审方法沉淀**：**「入库门禁必须模拟消费端行为」**——自解析通过 ≠ three 能加载（56 资产全数漏检的根因）；合并器索引错误比缺字段更隐蔽（第一轮修补只看「缺什么补什么」没验「引用指哪」）；有干净源数据时优先重生成而非二进制 patch。

## 8. Archive Record (Recommended at closure)

### 8.2 范围变更记录：R1-3 性能门禁降级为 WARN 观测（裁决 2026-10-13，即时落盘）

**用户裁决（2026-10-13，本会话，参考 generate-ux-prototype 验证策略对比后）**：
> 「是不是应该放宽检测标准啊」「卡就卡一点不行吗，然后用户自己觉得卡再让 llm 修复呢」

**对比研究结论（generate-ux-prototype 实读）**：其唯一硬门禁 build.mjs 是**秒级**真实编译检查（fail-all 一次全列出错误），视觉验收交**用户人眼**（预览 HTML 双击即看），**无性能门禁**（2D 无此风险）——「循环至过」无等待焦虑靠的是每轮秒级成本结构，不是标准松。CDP 冒烟设施只在开发期跑不随 skill 交付。

**裁决内容**（三层分类取代原「预算+fps 双 FAIL」）：
1. **坏**（报错/白屏/无法渲染/场景图不符/加载失败）= 唯一硬 FAIL——机器无关客观标准（用户定义），进修复循环，秒级断言 fail-all；
2. **重**（calls/triangles/materials 超预算）= WARN + LLM 必须在验证报告回应（优化或说明理由），不阻塞交付——预算数值机器相关（A 机超标对 B 机独显无意义）+ 需求相关（60 块岩石=合法 3M 三角形）；
3. **卡**（fps）= WARN 观测值（默认 20s 采样），用户反馈「卡」→ LLM 参考基线修复 → 复测对比——性能取舍属用户主权，不自动循环优化。

**关键论证（用户驳倒模型第一版方案）**：模型初版建议「静态预算保留 FAIL、仅 fps 降级」，用户指出「draw call 800/三角形 3M 在独显上正常渲染，明显坏是报错白屏无法渲染」——识破「预算超标」与「帧率不足」同为机器相关判断，非机器无关客观事实。模型认同并全盘降级。

**存量改造（批次 4 执行项，本会话不动代码）**：
- perf-fps.mjs（2026-10-13 14:50 已按旧 FAIL 口径落地）：预算/fps 断言 FAIL→WARN + `--strict` 恢复严格判定（validate-model 同款先例）+ `--duration` 默认 60→20；
- build.mjs：预算超限 errors→warnings（`--strict` 同步恢复）；
- gates.mjs 相关用例口径同步核查。
- ⚠️ **并行会话协调**：批次 4 正在另一会话执行（当前进度 smoke-r 分段参数），其 4.3 按旧口径已写完——本修订落盘后需用户在批次 4 会话捎话，按 §4.5「R1-3 修订」区块改造后再收口 Review。

**回写位置**：§4.5 验证回路（重写④+新增修订区块）、§4.6 S5/S6、§4.1 目录树（perf-fps/verification.md 描述）、§4.7 批次 4.3 条目、R1-3 决议（标注修订指向本区块）。

- 待任务收口后填写

### 8.1 范围变更记录：Blender 通道完全剔除（裁决 2026-10-12，补录 2026-10-13）

**用户裁决原文**（2026-10-12 08:40，会话 13b562c6）：
> 「我不要blender了，就直接代码几何体就行」「blender完全从这个skill里剔除出去吧」

**裁决动因**：与 Poly Haven 批量入库（批次 PH）同批权衡——56 资产精选库预填后，库未命中的缺口走「LLM 直写 three.js 代码建模」（简模图元 + 精模代码组合模型，修复轮九 car/rack/worker 已实证精模路线：多节点拼装+子节点独立材质+槽位级编辑全链路可用），Blender 外部依赖（安装/分发/镜像/维护）成本不再成立。

**Reverse Sync 欠账经过（流程教训）**：当时模型回复「Blender 剔除——收到，落 Spec」，但经会话记录核查，该会话对 Spec 的实际写入为 **0 次**——承诺蒸发。后续并行分工（A=PH 入库 / B=占位盒 / C=代码建模）各自推进，PH 立项（§5 #30）只带了「Poly Haven 下载」一条决议，Blender 剔除被漏网，Spec 中 Blender 相关区块（§0 Q3 / §1.1 / §2 / §4.1 / §4.4 / §4.5 / §4.9.3 / 批次 4.4 / 批次 5.1 / 批次 5.3 / §7 探索区块）持续以旧范围挂着。2026-10-13 由用户指出、经 Untitled-1.md 底稿 + 会话 jsonl 双重取证后本日补录。**教训：裁决出口必须当场落 Spec（IMMEDIATE PERSISTENCE），并行分工前先收口范围变更。**

**变更清单（本日已全部回写）**：
1. §0 Q3：裁决推翻标注（Blender 剔除，LLM 直写为唯一过程化建模通道）
2. §1.1 / §2 / §2 风险项：Blender 相关条目全部转历史归档
3. §4.1 目录树：删 install-blender.mjs；modeling-channels.md 缩为代码建模单通道指引；ensure-env.mjs 描述去 Blender
4. §4.4 降级阶梯：五层→四层（删第 4 层 Blender，原第 5 层 LLM 直写升为第 4 层，含简模/精模双形态说明）；Blender 环境探测链删除
5. §4.5 / 批次 4.4：ensure-env.mjs 缩为 node/three + 多模态声明探测
6. 批次 5.1：install-blender.mjs 整项取消
7. 批次 5.2 / 5.3：SKILL.md 与 references 按四层阶梯 + 单通道指引执行
8. §4.9.3 资产层：产出方改「美术/资产库（Poly Haven 精选等）」
9. validate-model strict 档表述：「降级阶梯第 4/5 层」→「第 4 层」
10. §7 Blender 前置探索区块：标注历史归档，不再是执行依据
11. 本机清理：`~/.gts3d/blender/` 整目录 + `.tmp-blender-explore/gts3d_model_template.py` 删除（2026-10-13）

**对执行序的影响**：批次 4（验证回路）按无 Blender 范围执行（4.4 缩减）；批次 5 不含 install-blender.mjs（5.1 撤销），modeling-channels.md 工作量相应缩减。

## 9. Project Sync Candidates
- Stable project facts discovered:
  - 用户资产 manifest JSON 格式样例（meta+data 结构）——若落定，是 3D 资产管线的稳定契约
  - three.js 版本锁定 0.185.1——后续 3D 相关任务的版本基准
- Suggested destination:
  - 待任务收口时按用户定义落点建议
- Sync decision: Not synced
- Reason: 任务进行中
