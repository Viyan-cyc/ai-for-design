# SDD Spec: generate-3d-scene Skill（Vue3 + three.js 0.185.1 + TS 3D 场景生成）

## 0. Open Questions
- [x] Q1 资产管线落位 → **已裁决（2026-09-30）**：skill 自带 `assets/`；后续再迁云端。上传方本地丢压缩包+manifest 给 skill 入库即可，上传方不接触检索库
- [x] Q2 embedding 服务 → **已裁决（2026-09-30）**：先用本地方案，不引入大模型；放 skill 下某目录。内网有 API 但后续再接
- [x] Q3 "LLM 自己建模"边界 → **已裁决（2026-09-30）**：用户倾向 Blender MCP（LLM 驱动 Blender 建模导出 GLB）；LLM 直接写 three.js 建模代码是兜底方案
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
  - **blender-mcp**（github.com/ahujasid/blender-mcp，~29.7k stars，MIT，活跃）— LLM 经 MCP 驱动 Blender：场景/物体操作、任意 Python 执行（有 safe mode）、**导出 GLB/FBX（export_scene）**、Poly Haven/Sketchfab/Poly Pizza 素材库、Hyper3D Rodin/混元3D 生成。架构=Blender 插件(socket server) + Python MCP 桥。**用户已裁决采用为建模主通道**，LLM 直写 three.js 建模代码降为兜底。风险记录：execute_blender_code 是任意代码执行面（localhost 使用、保存现场）、socket 无鉴权、大资源下载冻结 UI 主线程
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
  - 建模主通道：Blender MCP（LLM 驱动 Blender 导出 GLB）；LLM 直写 three.js 建模代码是兜底
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
  - **Blender MCP 是成熟建模通道**：~29.7k stars 活跃项目；LLM 可场景操作/Python 执行/**导出 GLB**/Poly Haven 素材/AI 生成（Rodin/混元）。作为建模主通道已裁决。风险记录：execute_blender_code 是任意代码执行面（localhost 使用、保存现场）、socket 无鉴权、大资源下载冻结 UI 主线程
  - **Blender 通道双模式（2026-09-30 向用户说明）**：① MCP 交互式（Blender+插件+运行中，LLM 写 bpy Python→截图回看→纠错→导出，适合复杂迭代建模）；② headless 脚本式（只装 Blender 即可，LLM 生成 bpy 脚本→`blender --background --python`→直出 GLB，全自动可封装）；③ 两者皆无→LLM 直写 three.js 过程化建模兜底（零外部依赖）。skill 启动时探测环境择道，永不因缺 Blender 失败
  - **用户澄清（2026-09-30）**：skill 是给很多人用的——用户只发文字/截图描述收工程，Blender 是 LLM 的工具而非用户的工具，用户零 Blender 操作；但目标机器未必装 Blender，skill 要解决自带问题
  - **Blender 分发裁决（2026-09-30）**：A/B 混合——Blender 便携版作为"增强包"独立分发（不进 skill 代码目录），skill 带 install-blender 脚本（探测本地缓存→无则从可配镜像 URL 拉便携 zip 解压→headless 通道就绪，用户全自动零操作）；镜像 URL 可配（内网投递配内网地址、外网配 blender.org）；拉取失败自动降级 LLM 直写，skill 永不因缺 Blender 失败
  - **非 multimodal LLM 能力分层（2026-09-30）**：skill 启动探测 LLM 多模态能力（或用户配置声明），分档执行——多模态档：Blender 视口截图自查 + 渲染帧视觉判断；非多模态档：① Blender 建模走数值自查（bpy 输出结构化 JSON：bbox/面数/部件数/孤立体，LLM 读数字比对参考值）；② 场景冒烟走结构化断言（WebGL canvas 像素统计/readPixels 采样、场景图 JSON 导出、CDP 布局断言，复用 generate-ux-prototype CDP 设施模式）。非多模态档结论按"诚实分级"标注"结构验证通过，未经视觉确认"。可选增强：截图先经本地脚本提特征（色彩分布/边缘密度/空白占比）变数字给 LLM 读
  - **性能规格重定（2026-09-30 用户补充，2026-09-30 二次修订）**：真实场景复杂——模型数量成百上千，性能要求 ≥40fps。推导：单模型 prop≤2k 三角（多数几百）、少量主角≤10k、场景总预算≤1M 三角；draw call 约束——**同类物体实例数 >1000 才强制 InstancedMesh**（≤1000 普通 mesh + 静态几何合并），场景 draw call 超预算由性能冒烟打回触发优化；全场景材质数上限（≤32 草案）；贴图降到单张≤1024² 图集优先。运行侧门禁：CDP 实测帧率 ≥40fps 不达标打回。**推论**：此性能档下工业级低模只能人工/专业管线产出，资产库检索复用从"优先"升为"性能刚需"；LLM 建模通道退为库未命中最后手段且必须过 validator
  - **母版工程机制确认（2026-09-30）**：LLM 每次生成 = 复制母版 + 填业务层。母版三层：① 引擎层（固定，LLM 永不修改：场景初始化/渲染循环/相机灯光/资产加载/增量更新协议/handler 注册机制）② 接入层（固定契约，LLM 只产出此处业务代码：handlers/<type>/<type>.ts、scene-data.json、cards/*.vue 可选、assets 引用清单）③ 文档（INTEGRATION_GUIDE.md 一份即可接手）。效果：引擎层跨交付物完全一致（bug 修一次全受益），二开者"数据级二开不需要懂 three.js，深度二开有完整源码"——与 generate-ux-prototype starter 模式同构，3d-templete handler 注册制思想一脉相承
  - **母版工程代码四要求（2026-09-30 用户）**：① 2D 卡片为可修改 Vue 组件，参考 3d-templete 卡片机制但用自己的想法重写；② 模板代码简洁可读、单一职责（场景/灯光/控制器/射线拾取/renderer 各自独立文件）；③ 遵循 3d-templete 的 eslint 配置；④ 双模式架构：编辑态（LLM 交流中选中调参：场景/控制器/灯光/renderer/材质/贴图，可调布局，类 Spline 可编辑）+ 二开态（二开者拿到的代码物理不含编辑态代码）。双模式隔离方案见下条
  - **双模式隔离方案（2026-09-30）**：edit → core 单向依赖。core（scene-core/：engine 各单一职责文件 + handlers/ + cards/ + scene-data.json + createScene.ts 唯一入口）不知道 edit 存在；edit/（SelectionService 射线选中复用 core 拾取、PropertyPanel 调参 UI、LayoutGizmo 布局拖拽、Bridge 唯一桥梁只调 core 公开 API sceneHandle、edit-main.ts 独立入口）整体可删除。两种交付：编辑态工程=core+edit（调参结果序列化回写 scene-data.json）；二开交付=build 剔除 edit/ + 回写后 scene-data.json（二开者代码里物理无编辑态）。机器保证：build 门禁规则——core 文件 import edit/ 即 FAIL；core 暴露有限 API（get/set 属性、serialize、updateObject 增量），edit 不得伸手进 core 内部。3d-templete editBridge/ 契约思想可参考、代码重写
  - **3d-templete 处置裁决（2026-09-30）**：代码不直接用（现有实现/assetLibrary 文本检索/lowPolyFallback 丢弃或重写）；三个架构思想吸收进新 skill：① LiveDataConfig JSON 驱动（数据进场景出，二开者改数据不改引擎）② handler 注册制（LLM 业务代码以 handler 插入，引擎母版不动——受控沙箱思想）③ 增量更新协议（物体移动/状态变色不重建场景，监控场景刚需）。新场景工程模板=重写，设计输入=3d-templete 三思想 + 业界最佳 + 新性能规格；LiveDataConfig schema 与 handler 契约作为起点重新推导
  - **模型生成规格 + 校验器双层机制（2026-09-30 修订版）**：skill 内置 model-spec.md（用户可覆盖默认值）：底面中心 y=0 向上生长 / 三角面数 prop≤2k（多数几百）、主角≤10k、场景总预算≤1M / 子节点≤64 扁平化 / 命名小写 snake_case 语义化 / 贴图单张≤1024² 图集优先 / 米制 +Y up 导出转 glTF -Z forward / **同类物体实例数 >1000 才强制 InstancedMesh，≤1000 普通 mesh+静态几何合并**、材质数上限（草案≤32）。三条建模通道（MCP/headless/LLM直写）共用同一规格：Blender 通道 bpy 脚本模板内置约束（收尾自动 apply modifiers/重命名/居中/报告面数）；导出入库前统一 validator 脚本硬门禁（GLB 解析：面数/节点树/命名/贴图尺寸/bbox 原点），不合格打回而非警告；场景级性能冒烟门禁 CDP 实测≥40fps（draw call 超预算同样打回）
  - **Blender glTF 导出保证**：原生 glTF 2.0 导出器支持 GLB（单文件自包含，默认推荐）与 glTF 分离格式；PBR 材质/层级/动画可导。硬规则：建模须 glTF 友好（修改器 apply、Principled BSDF 材质）
  - **建模↔检索闭环**：Blender 产出 GLB + manifest 元数据回注册进资产库——下次检索命中，库随使用增长
  - **generate-ux-prototype 外壳可复用模式**（非代码，模式）：init 脚手架（starter 工程）、build 门禁（结构扫描+import 白名单）、预览（file:// 或 dev server）、CDP 冒烟断言、vendor 示例沉淀
  - **内网约束传承**：npm 走内网源 mirrors.tools.huawei.com、无 CDN 依赖——新 skill 延续此纪律
  - **本地 embedding 可行性**：不引大模型的前提 = 轻量词法向量（如 TF-IDF/字符 n-gram 哈希向量 + 余弦相似度）或极小 onnx 模型；检索对象是"资产描述文本"（search_text/tags/description 拼接），语料小且领域窄，词法方案够用——精确方案 Plan 内定，先记方向
- 风险与不确定项:
  - 本地轻量 embedding 的召回质量未验证——Plan 中安排检索样例验证（给定查询，断言期望资产进 top-k）
  - Blender MCP 是外部依赖（需用户本机装 Blender+插件）——skill 必须把它设计为"可选增强通道"而非硬依赖，缺 Blender 时降级 LLM 直写
  - LLM 过程化建模质量不稳定（漂浮/比例失调）——业界方案是装配分级+截图自检，skill 内固化为硬约束
  - 模型库规模未知——向量索引方案要支持从几个到几千个资产的伸缩
  - gltf（带外部 .bin/纹理）比 glb 复杂（多文件依赖）——入库管线要处理解包后的相对路径
  - assets/ 随 skill 投递会放大 skill 目录体积（模型二进制）——未来迁云端前，投递包大小需在 Plan 中声明上限策略（如排除大模型或按需解压）

## 2.1 Next Actions
- ~~用户澄清 Q1-Q5~~（2026-09-30 全部裁决，见 §0）
- ~~Q5 组件库组织方案~~ → 已裁决 Option C，经 Plan Approved 2026-09-30 一并确认（§3 Decision 同步）
- ~~进入 Plan~~ → Plan Approved 2026-09-30
- **当前（2026-10-08）**：Spec 评审决议已全部落定（§4.8），待执行"数据结构 v3 重构"批次（见 §4.9）后继续批次 2

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

## 4. Plan (Contract)

> 通读指引：本 Plan 分六部分。**A** 说清这个 skill 是什么、怎么用（产品视角）；**B** 是 skill 目录里每个文件干什么；**C** 是三条核心流水线怎么运作（资产入库/场景生成/验证）；**D** 是母版工程的代码结构（重点：双模式怎么隔离）；**E** 是脚本签名（技术契约）；**F** 是执行清单（原子步骤，Approved 后照此逐条做）。
> 技术栈全程锁定：Vue 3 + three.js **0.185.1** + TypeScript。内网纪律：npm 内网源、零 CDN。

### 4.0 总览：这个 skill 是什么

**一句话**：用户丢进来一段文字（或一张截图）描述 3D 场景 → skill 带着 Claude 走完「检索资产 → 缺的建模 → 生成工程 → 验证达标」全流程 → 交付一个可二次开发的 Vue3+three.js 工程。

**用户拿到手的交付物**（两类，见 4.3 双模式）：
- 编辑态工程：能点选物体、调参数、拖布局，调完自动存盘
- 二开态工程：干净的运行时工程 + 集成文档，二开者不需要懂 three.js 就能改数据级内容

**skill 使用者的两种身份**（都会存在，流程对两者透明）：
- 终端用户：只发描述、收工程，全程不接触 Blender/three.js 概念
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
│   ├── modeling-channels.md          # 三条建模通道操作指引（MCP/headless/LLM直写）+ 探测逻辑
│   ├── verification.md               # 验证回路：多模态/非多模态两档断言清单 + 40fps 门禁
│   ├── scene-engineering.md          # 母版工程结构说明 + handler 契约 + 二开指南要点
│   ├── component-catalog.md          # 组件清单（脚本生成）：name+summary+importPath+props 摘要
│   └── eslint-notes.md               # eslint 继承说明（3d-templete 规则集迁移注意点）
├── scripts/
│   ├── ensure-env.mjs                # 环境探测：node 版本/three 版本/Blender 可用性/多模态声明
│   ├── install-blender.mjs           # Blender 便携版按需拉取（缓存→镜像 URL→解压→登记）
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
│       └── perf-fps.mjs              # 性能门禁：CDP 实测帧率 ≥40fps（1 分钟采样，p95 判定）
├── template/                         # 母版工程（见 4.3，结构完整可独立 build）
└── assets/
    ├── models/                       # 模型二进制（glb/gltf）
    ├── thumbnails/                   # 缩略图
    ├── manifests/                    # 每个上传包一份 manifest JSON（用户填的元数据）
    └── search-index.json             # 向量索引（build-search-index.mjs 产物，随资产更新重跑）
```

**3d-components 组件库的接入**（不复制进 skill，引用路径 + 生成清单）：
- `scripts/gen-component-catalog.mjs`（执行期一次性工具，放 skill 外或执行后清理）：读 `D:\cyc\project\octo\test\3d-components\src` + `docs/components.json` → 生成 `references/component-catalog.md`（常驻清单：名称/一句话/ importPath/关键 props 表）+ 每组件一段源码摘录路径索引
- LLM 用法：先读 catalog 判断"有没有能用的" → 有则按 importPath 读源码学用法 → import 进 handler
- 组件库物理位置不动（用户沉淀资产，保持独立演进）；skill 只依赖清单文件，清单过期重跑生成脚本

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

**validate-model 规格门禁默认值**（model-spec.md 的机器执行面，用户可覆盖）：
```
原点: 底面中心 y=0（bbox.min.y ≈ 0，容差 0.01）     面数: prop≤2k / 主角≤10k
子节点: ≤64（扁平化）                                命名: ^[a-z][a-z0-9_]*$（snake_case）
贴图: 单张≤1024×1024，≤4 张/模型                     单位: 米制（bbox 高度合理性检查）
```

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

```
第1层 检索命中 → 直接用（search-assets top-k 有合适资产）
第2层 检索近似 → 参考改造（命中同类但细节不符：加载后 scale/材质覆盖/组合多个）
第3层 组件拼装 → 用组件库按需组合（读 component-catalog，import 组件代码建模）
第4层 Blender 建模 → 环境可用（MCP 或 headless）时，LLM 写 bpy 脚本建模导出 GLB
                     （多模态：视口截图迭代纠错；非多模态：bpy 输出结构化 JSON 数值自查）
                     → 产出必过 validate-model 门禁 → 回注册资产库（建模↔检索闭环）
第5层 LLM 直写 → three.js 过程化建模代码（纯代码兜底，同样过规格门禁）
每一层都比上一层"重"，SKILL.md 规定：能跳过就不升级，升级需在执行日志记录原因
```

**Blender 环境探测**（ensure-env.mjs，按序）：
1. 本地缓存有便携版（`~/.gts3d/blender/`）→ headless 通道就绪
2. 无缓存 → 提示 install-blender.mjs（镜像 URL 可配：内网/外网）→ 拉取成功即就绪
3. 拉取失败/用户跳过 → 检测系统 Blender + MCP 插件（运行中）→ MCP 交互式通道
4. 全无 → 第 5 层 LLM 直写（skill 永不因缺 Blender 失败）

### 4.5 验证回路（每次场景生成必须走完，Done by Evidence）

```
① build 门禁        build.mjs：结构完整 + 三条铁律 + import 白名单（three@0.185.1/vue3 内网源版本）
② 结构冒烟          smoke-structural.mjs：CDP 加载页面 → 断言场景图 JSON（物体数量=预期/
                    相机存在/模型加载成功计数）+ canvas 像素统计（非空/非单色）+ 零 rejection
③ 视觉冒烟（多模态档）smoke-visual.mjs：四视口截图（全景/主视角/特写/线框）→ LLM 看图判定
                    （比例/遮挡/漂浮/配色）；非多模态档跳过，结论标注"未经视觉确认"
④ 性能门禁          perf-fps.mjs：CDP 采样 60s → p95 fps ≥40 → 不达标输出优化建议
                    （draw call 数/面数 top 物体/材质数）→ 修复后重跑
⑤ 诚实分级          验证报告注明：哪些断言机器验证 / 哪些 LLM 看图验证 / 哪些未经视觉确认
```

### 4.6 SKILL.md 九步工作流（references/scene-workflow.md 展开，此处定骨架）

```
S1 澄清需求    文字/截图 → 场景要素清单（物体/规模/交互/数据更新）→ 缺关键信息则停、问
S2 检索资产    search-assets（多查询词覆盖）→ 命中/近似/缺失 三分类
S3 缺口建模    按 4.4 阶梯补缺（每层升级记录原因）→ 产出资产全部过 validate-model
S4 生成工程    init.mjs 出编辑态工程 → 按检索/建模结果填 scene-data.json + handlers + cards
S5 build+冒烟  4.5 的 ①②（不过则修复重跑，循环至过）
S6 视觉/性能   4.5 的 ③④（性能不达标按建议优化后重跑）
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

**批次 2：资产管线**
- [ ] 2.1 manifest schema 校验器（import-assets 内嵌）+ 样例压缩包（example+rack 两个 GLB 从 3d-templete 库转入做种子资产）
- [ ] 2.2 import-assets.mjs：解压/校验/规格门禁（validate-model）/落库
- [ ] 2.3 validate-model.mjs 独立可跑（GLB 解析：面数/节点/命名/贴图/bbox）
- [ ] 2.4 build-search-index.mjs：n-gram TF-IDF 词法向量索引 + 内置检索冒烟样例
- [ ] 2.5 search-assets.mjs CLI（query → top-k JSON）+ 检索质量验证（中文查询命中种子资产）

**批次 3：构建门禁 + 双模式交付**
- [ ] 3.1 build.mjs：结构扫描 + 三条铁律（core↛edit / edit 只走 handle / strip 后零 edit 引用）+ import 白名单 + **场景预算静态估算（R1-3：calls≤400/triangles≤1M/材质≤32，读 validate-model 报告）**
- [ ] 3.2 strip-edit.mjs：剔除 edit/ → 二开包 + **剥离视觉层（materialOverride）+ 输出转录清单** + 自检
- [ ] 3.3 init.mjs：母版复制 → 目标目录 + 占位替换 + **资产库→目标工程 public/assets 复制/映射（R2-5）** + 首次 build 校验

**批次 4：验证回路**
- [ ] 4.1 smoke-structural.mjs（场景图 JSON/canvas 像素/零 rejection 断言）
- [ ] 4.2 smoke-visual.mjs（四视口截图产出）
- [ ] 4.3 perf-fps.mjs（CDP 60s 采样；**真机 GPU 环境测 p95≥40fps + calls/triangles/programs 运行时断言（R1-3）；软渲染环境只做结构验证不计 fps**）
- [ ] 4.4 ensure-env.mjs（node/three/Blender 探测 + 多模态档位声明解析——声明载体定为 SKILL.md 会话指令或环境变量 GTS3D_MULTIMODAL，二选一生效）

**批次 5：skill 大脑 + 收尾**
- [ ] 5.1 install-blender.mjs（缓存探测/镜像拉取/解压登记/失败降级）
- [ ] 5.4 gen-component-catalog.mjs 跑通 → component-catalog.md 产出（**提前到 5.2 前**，SKILL.md 依赖其产物）
- [ ] 5.2 SKILL.md（九步工作流 + 4.4 降级阶梯 + 硬约束：规格门禁/铁律/诚实分级/内网纪律/数据结构 v3 生成纪律）
- [ ] 5.3 references/ 文档（scene-workflow/asset-pipeline/model-spec/modeling-channels/verification/scene-engineering/component-catalog 生成/eslint-notes）+ **"生产数据→update 片段"翻译模式章节（MQTT/WebSocket 示例，一等公民）**
- [ ] 5.5 README.md（投放说明/资产库准备/镜像配置/**内网 npm 安装方式**）
- [ ] 5.6 端到端演练：文字描述 → 全流程 → 编辑态工程 + 二开包 + 验证报告全绿
- [ ] 5.7 用户验收（截图/演示/文档过目）→ Review

**批次 R：数据结构 v3 统一重构（2026-10-08 裁决新增，批次 2 之前执行）**
> 依据 §4.9。批次 1 已按 v2 扁平结构落地，本批次把内外统一为 key:Array v3。改动集中、越晚越贵。
- [ ] R.1 types.ts 重写：SceneData → TreeScene v3 形态（保留 key：version/meta/scene/camera/lights/controls/renderer/remove + 开放 type 分组）；节点 {id, parentId, position, rotation, scale, card?, params}；**删除 MaterialOverride 数据类型与 materialOverride 字段**
- [ ] R.2 SceneEngine 改造：objects[] 扁平存储 → 分组字典 + id→node 索引（3d-templete buildNodeIndex 模式）；upsert 幂等 / remove 先行 / params 整块替换（3d-templete updateTreeScene 语义）
- [ ] R.3 材质归代码：新建 materials.ts 状态视觉注册表（stateMaterials，3d-templete registerMaterials 模式）+ AssetEngine applyState(obj, state)（map 换贴图 / model 换实例）；删除 applyMaterialOverride 数据驱动路径（编辑器视觉层除外，见 R.6）
- [ ] R.4 卡片内联：CardConfig 顶层数组 → 节点 card sibling 字段；cards/registry 挂载逻辑随节点生命周期（删节点=卡片消失，级联删除类别消灭）；卡片 props 从本节点 params 自动注入
- [ ] R.5 图元底座：primitive 工厂一个文件吃全部几何体（3d-templete Primitive/geometry 模式），默认材质从代码取；starter scene-data.json 重写为 v3（分组：ground/cars 演示/handler 示例用 example.glb，R1-2 决议）
- [ ] R.6 编辑器视觉层：PropertyPanel 材质分区保留（调参体验不变），但值存入编辑器私有视觉层（serialize 内部字段，不进交付数据）；strip-edit 剥离 + 转录清单（哪些物体调了什么值 → LLM 转录进 materials.ts/handler 默认值）
- [ ] R.7 存量联动改造：SceneHandle.update 签名换 TreeSceneFragment；Bridge/save/undo（structuredClone 快照）适配 v3；windTurbine handler 改造为通用 example handler（R1-2）；main.ts/edit-main.ts 适配
- [ ] R.8 验证：vue-tsc 绿 / build 绿（铁律隔离保持）/ eslint 0 errors / headless 冒烟（v3 starter 渲染 + 卡片跟随 + update 片段幂等 upsert 断言 + applyState 换贴图断言）
- [ ] R.9 INTEGRATION_GUIDE 重写对齐 v3（数据层只有业务属性 / 材质在 materials.ts / 卡片内联 / 生产数据接 update）

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
- **R1-3**：**已批准——分层门禁**。数值（model-spec.md 可覆盖）：draw call ≤400、场景总三角 ≤1M、材质数 ≤32。构建期 build.mjs 静态估算（读 validate-model 报告 + 图元面数表）超限 FAIL；运行期 perf-fps.mjs 断言 renderer.info.render.calls/.triangles + programs.length 超限 FAIL；40fps 仅真机 GPU 环境生效，软渲染只做结构验证（R3-3 一并解决）。§4.5④ 口径从"优化建议"升为门禁断言。
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

- **保留 key 全集**：version / meta / scene / camera / lights / controls / renderer / remove。其余任何 key 都是 type 分组（type=key 名），未注册 handler 的分组 warn 跳过（3d-templete 语义）。
- **节点字段**：`{ id, parentId?, position?, rotation?, scale?, card?, params? }`。无 type 字段（type=分组 key）。id 全场唯一（幂等键）。
- **更新语义**（与 3d-templete updateTreeScene 一致）：remove 先行 → 每节点存在即 update / 不存在即 create → params 整块替换（不做深合并，后端语义简单可预测）→ 不 diff（有数据就走）。
- **生产数据接入**：后端/轮询/WebSocket 推同格式片段 `{"cars":[{…}], "remove":[…]}` 直接喂 `handle.update()`。翻译层（业务消息→片段）由二开者按 INTEGRATION_GUIDE 模式写，模板给 MQTT/轮询两个示例适配器。

#### 4.9.3 材质四层归位（数据无材质的执行结构）

| 层 | 内容 | 谁写 | 文件 |
|---|---|---|---|
| 资产层 | GLB（单状态资产自带材质）/ 白模+贴图集（多状态） | Blender 通道/美术 | assets/models + textures + manifest |
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

## 5. Execute Log
- Plan Approved：2026-09-30（用户指令"plan approved"）。状态 [ACTIVE]，进入 Execute。
- **Spec 评审（review_spec）2026-10-08 完成**：GO with conditions。P1 四项 / P2 七项 / P3 七项，详见 §4.8 评审记录 1。
- **评审决议全部落定（2026-10-08）**：R1-1～R1-4、R2-3/R2-4/R2-7 逐项裁决完毕（§4.8 评审决议）。评审后用户三轮深挖 scene-data 定位与材质归属，裁决**数据结构 v3**（§4.9）：key:Array 单一结构、数据无材质（四层归位）、卡片内联、资产双形态、编辑器视觉层剥离转录。新增批次 R（9 原子项）置于批次 2 之前。**下一动作：执行批次 R**。
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
- 待 Execute 后填写

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

## 8. Archive Record (Recommended at closure)
- 待任务收口后填写

## 9. Project Sync Candidates
- Stable project facts discovered:
  - 用户资产 manifest JSON 格式样例（meta+data 结构）——若落定，是 3D 资产管线的稳定契约
  - three.js 版本锁定 0.185.1——后续 3D 相关任务的版本基准
- Suggested destination:
  - 待任务收口时按用户定义落点建议
- Sync decision: Not synced
- Reason: 任务进行中
