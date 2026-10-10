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
- ~~组件库接入机制终裁~~（2026-10-09，§3 Decision 修订：tarball + file: 依赖 + 全 md 生成链，见 §3 Decision 2026-10-09 增补）
- ~~批次 C~~（2026-10-09 全部完成，含源仓构建链存量修复，见 §4.7 批次 C 执行记录）
- ~~批次 R~~（2026-10-09 全部完成，R.1–R.9 四道门禁全绿，见 §4.7 批次 R 执行记录与 Plan-Execution Diff #16）
- ~~批次 2 / 批次 M / 批次 T~~（2026-10-09 全部完成，见 §4.7 各批次执行记录；M+T+D4 修订轮已过 REVIEW EXECUTE 三轴评审，评审记录 5 Overall Verdict: PASS，§6）
- ~~批次 3~~（2026-10-10 全部完成：3.1–3.3 落地 + gates.mjs 40/41 用例全 PASS；REVIEW EXECUTE 评审记录 6 初判 CONDITIONAL PASS → **修复轮（§7 #27）后升 PASS**）
- **当前（2026-10-10）**：批次 1 / C / R / 2 / M / T / 3 全部完成且批次 3 评审修复闭环。待办：批次 4（验证回路）、批次 5（skill 大脑+收尾）。**执行序：批次 4，批间停等确认**

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

| 门禁类别 | 项目 | art 档（默认：第三方美术资产） | strict 档（AI 生成资产，降级阶梯第 4/5 层） |
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

```
第1层 检索命中 → 直接用（search-assets top-k 有合适资产）
第2层 检索近似 → 参考改造（命中同类但细节不符：加载后 scale/材质覆盖/组合多个）
第3层 组件拼装 → 用组件库按需组合（读 component-catalog.md + 按需 component-docs/<Name>.md，
                     handler 内 import '@a3d/a3d-components/...'，源码零读取，见 §3 Decision 增补）
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

**批次 4：验证回路**
- [ ] 4.1 smoke-structural.mjs（场景图 JSON/canvas 像素/零 rejection 断言）
- [ ] 4.2 smoke-visual.mjs（四视口截图产出）
- [ ] 4.3 perf-fps.mjs（CDP 60s 采样；**真机 GPU 环境测 p95≥40fps + calls/triangles/programs 运行时断言（R1-3）；软渲染环境只做结构验证不计 fps**）
- [ ] 4.4 ensure-env.mjs（node/three/Blender 探测 + 多模态档位声明解析——声明载体定为 SKILL.md 会话指令或环境变量 GTS3D_MULTIMODAL，二选一生效）

**批次 5：skill 大脑 + 收尾**
- [ ] 5.1 install-blender.mjs（缓存探测/镜像拉取/解压登记/失败降级）
- [x] 5.4 ~~gen-component-catalog.mjs 跑通 → component-catalog.md 产出~~ → **由批次 C 接管**（sync-components.mjs，2026-10-09 终裁），提前完成- [ ] 5.2 SKILL.md（九步工作流 + 4.4 降级阶梯 + 硬约束：规格门禁/铁律/诚实分级/内网纪律/数据结构 v3 生成纪律）
- [ ] 5.3 references/ 文档（scene-workflow/asset-pipeline/model-spec/modeling-channels/verification/scene-engineering/component-catalog 生成/eslint-notes）+ **"生产数据→update 片段"翻译模式章节（MQTT/WebSocket 示例，一等公民）**
- [ ] 5.5 README.md（投放说明/资产库准备/镜像配置/**内网 npm 安装方式**）
- [ ] 5.6 端到端演练：文字描述 → 全流程 → 编辑态工程 + 二开包 + 验证报告全绿
- [ ] 5.7 用户验收（截图/演示/文档过目）→ Review

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

- **保留 key 全集**：version / meta / scene / camera / lights / controls / renderer / remove / `__visuals` / `__materialLib`（后两者为编辑器私有区，双下划线族，交付剥离，材质库契约见 §4.10）。其余任何 key 都是 type 分组（type=key 名），未注册 handler 的分组 warn 跳过（3d-templete 语义）。
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
- **批次 3 完成（2026-10-10）**：3.1–3.3 全部落地，`scripts/verify/gates.mjs` 复跑设施 32/32 PASS（含 `--with-build` 端到端：小写盘符目标目录 + `--deps copy` + 首次 `npm run build` PASS）。新产三点：① build.mjs 结构扫描 + 三条铁律 + import 白名单 + 场景预算静态估算（calls≤400/三角面≤1M/材质≤32，可 CLI 覆盖）；② strip-edit.mjs 剔除 edit 世界 + 剥离 `__visuals`/`__materialLib` + 生成 TRANSCRIPTION.md 三类表（物体视觉 override / 被引用材质库条目 / 库引用表）+ 对产物跑 `--stripped` 自检；③ init.mjs 母版复制 + 占位替换 + 资产按引用|全部注入 + 可选组件库 file: 依赖 + 首次门禁（+ `--deps copy|install` 时跑 npm run build）。**验证中发现并修复 2 处实缺陷**（均属"只在特定环境暴露"类，见 §7 #24）：Windows 下 spawn 子进程 cwd 含手打小写盘符时 Vite html-proxy 键错配致构建失败（修：spawn 前 `realpathSync.native` 规范盘符/大小写，回退盘符大写）；build.mjs 自带三角面计数器与 validate-model 分叉（漏 mode 5/6 条带扇面）→ 改为共用 validate-model 的 `reachableNodes`/`primitiveTriangles`（build.mjs 的反面副作用是 validate-model 补两个 export，语义未变）。**待办提请**：三个脚本 + validate-model 的头部注释含 `Spec §4.x`/`R1-3` 类文档指引，与"代码注释不写指向文档的指引"的既定规则相抵（§7 #24 记录在案，未擅自改动已收口批次 2 文件，待裁决）。**下一动作：批次 4（验证回路），批间停等确认**。

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
