# generate-3d-scene：实用模型元数据、资产规范与模型包更新

- 类型：Feature Spec。
- 日期：2026-10-22（Asia/Shanghai）。
- 阶段：Execute 完成并经回归验证（2026-10-22 回填，见 §11.1）。
- 目标：`skills/generate-3d-scene`。
- 前置：`generate-3d-scene-model-intake-viewer-spec.md` §17～§17.12 的单 HTML、下载清单、Agent 导入及相关修复继续有效。本文件是本轮唯一实施规格，冲突时按本文件执行。
- 本轮授权：写 Spec，不修改实现，不更新发布包。此前坐标文档修正已存在，但不代表存量模型及代码全部符合。

## 1. 最终目标与范围

设计师上传模型后，无需从零命名；页面展示可理解的检查结果与简洁元数据。模型采用统一坐标和摆放标准；性能超标提醒后可继续，相机/灯光等明确禁止项不可绕过。修复 ZIP 再上传时保留之前填写内容，仅重查变更项。最终仍只有一个 index.3d HTML 入口，用户保存文件发回对话，由 Agent 校验导入。

In：命名预填、检查元数据、规范与状态分级、向量库字段映射、包版本更新与描述迁移、清单页面设计、受影响的资产消费/导出与维护测试。
Out：新宿主桥接、默认 HTTP 服务、外部视觉平台、自动减面或贴图压缩、自动覆盖/烘焙原模型、几何相似度匹配、全面重写引擎或默认追加场景审美验收。

用户要求的坐标统一不靠逐模型运行时特殊补偿；未合规模型整改后重新提交。自动标准化副本不纳入本轮。

## 2. 已核实的现状与差距

- `designer-assets.mjs receive` 将名称统一写成“未命名模型”，未利用业务文件名。
- 当前页面检查已得到 bbox、mesh/三角形信息，但详情仍读取初始 asset 字段；检查后的详情需要统一刷新。
- `validate-model.mjs` 有旧 art/strict 阈值（如 50k/2048），上传包路径未整合其全部检查。不能直接接入旧硬阻断策略替代本规格。
- 原点检查只验证 bbox.min.y，没有验证 X/Z 中心；前向不能仅靠 bbox 判断。
- `exportPackage` 外层符合 D:/Download/file_templete 模板；raw_data 当前仅 content_hash/units/mesh_count。检索适配器未保留新的 bbox/性能元数据。
- 默认静态清单＋文件回传已存在；旧清单绑定包身份和 revision，不能直接导入新包。
- 源码 model-spec.md、generation-contract.md、SKILL.md 已修正右手/+Y/+Z/米的文字。历史 procedural/car.ts 使用 X 方向车长、车头朝 -X，需审查其对外根对象是否已经规范；不能把文档修正当作几何方向合规。

## 3. 名称和用途：自动预填，用户纠正

优先级：用户确认名称 > 库元数据 > 有意义文件名/内部业务名称 > 有证据的语义建议 > 原文件名。

- armchair_01.glb 初始显示可为“扶手椅 01”，保留原文件名；类别/标签可提取 armchair，不丢弃用于区分款式的编号。
- 有可维护、明确映射的词汇可翻译和填写保守用途，例如“单人扶手椅，可用于休息区”。不编造尺寸、材料、品牌和用途限制。
- object_xxx 等弱名称保留原文件名，描述可空并标记待确认，不再一律改为“未命名模型 XX”。
- 整包用途只提供上下文，不把椅子误判为仓库设备。
- 有宿主视觉能力时可复用已有缩略图提出建议；没有则做文件名/库元数据预填，不新增服务，不强制云识别，不将静态页面声称具有 LLM 视觉能力。
- 内部记录建议来源；用户已经填写的内容不能被刷新、重新检查或更新包自动覆盖。

## 4. 最小元数据与统计口径

### 4.1 入库格式

沿用 D:/Download/file_templete：顶层 meta 的 type/source_id/group_id 不变；data 每条仅使用 name、file_name、file_path、thumbnail_path、description、tags、search_text、raw_data。自定义模型信息放 raw_data，不另造顶层 assetId/modelUrl。

raw_data 最小建议契约（缺失值用 null/省略，不填 0 冒充）：

```json
{
  "bbox": {"min": [-0.3, 0, -0.5], "max": [0.3, 2, 0.5]},
  "triangles": 180,
  "draw_calls": 1,
  "node_count": 3,
  "texture_count": 2,
  "max_texture_size": 1024
}
```

content_hash、检查版本、规则版本、确认/告警状态保留在系统内部包记录中；无需设计师填写，也不纳入默认入库 raw_data 或 LLM 常驻上下文。现有检索对旧 raw_data.content_hash 的读取可兼容，但新记录不能依赖其存在。内部 assetId 继续用于缓存/编辑/消费；库 ID 和检索返回 URL 由适配层转换，ZIP file_path 仍是相对路径。

LLM 选型/布局默认只需资源定位、名称/描述、bbox、triangles、draw_calls；其他检查数值仅在诊断需要时返回。检索适配器保留合法 raw_data，不能过滤丢失；库元数据是候选提示，来源/版本未知时不冒充本机检查结论。下载重写 URI 后保持本地摘要与远端身份区别。

### 4.2 统计定义

- bbox：资产所选场景在资产坐标空间的包围盒，包含文件内已有节点变换，排除用户场景实例摆放及 Viewer 相机/灯光。记录 min/max，不重复存 center/width/height；尺寸可计算。单位按 glTF 米制约定，但真实尺寸未经核实时内部记为待确认，不能只改 units 字段消除疑问。
- node_count：加载后该模型自身 Object3D 数量，包含 Group/Mesh/Bone 等；排除 Viewer 添加的对象及加载器纯包装场景容器。primitive 拆出的真实子对象计入。代码与页面使用同一个统计函数，别把 mesh_count 当 node_count。
- triangles：所选场景的三角形 primitive 总量，按拓扑/索引或非索引和实例数计算，同一几何被多个节点引用按摆放数量计。不是最后一次 camera render 的可见三角形；不可见/裁剪造成的漏计需要避免。支持的拓扑、实例、蒙皮口径明确测试。
- draw_calls：标准检查渲染的 renderer.info.render.calls；单模型、固定材质渲染路径、无阴影/后处理/辅助物体，关闭对象视锥裁剪以减少视角差异。每次采样单独 reset，双视角不相加，取最大值并在内部记录采样版本。此值是基准，不承诺等于任意生产场景调用数。
- texture_count：所选场景实际材质使用的唯一图片源数量，相同源多个槽位只计一次；使用范围与检测到的全部资源分别留作内部诊断。
- max_texture_size：这些图片中 max(width,height)，需要读取真实图片尺寸，不根据文件名猜；支持的压缩格式按实际能力报告，不支持记未知/兼容性问题。

Group 不产生自身 draw call，但有内存、遍历和矩阵成本，故 node_count 与 draw_calls 均保留。不能用“3 个 Group”推出 calls=3。

### 4.3 bbox 的消费

保存本地 bbox，即使实例旋转也有效。通用布局程序将其 8 个角乘实例矩阵再构造世界 AABB；LLM 使用本地尺寸安排布局。不能直接使用旋转前的宽深检测重叠。这里只提供统一数据/调用约定，不新增完整物理碰撞系统。AABB 相交是粗筛，不宣称实际几何一定碰撞。动画模型标明默认姿态范围，不冒充全动画包围范围。

## 5. 资产坐标与规范检查

右手系、+Y 向上、+Z 为资产正面、长度米。落地资产原点为底部中心；整体摆放根节点 position/rotation=0、scale=1。

- 校验 bbox.min.y≈0，且 X/Z 包围盒中心≈0；默认容差 0.001m，集中配置。几何中心不等于摆放原点。
- 根节点变换检查针对单个资产对外摆放根；不能要求所有内部子节点归零。多根组合资产需要定义整体使用根，不能将每个部件平移认作错误；无法确定标准根时明确要求设计师重新导出，不悄悄包装来伪装已合规。
- 对普通落地资产：position.y=楼板高度即可落地；缩小一半使用 scale=0.5，而非补偿文件中原始单位缩放。
- 几何正面无法可靠自动推断时，页面显示 +Z 正面参考视图供用户确认“这是正面”；正面朝向不对则整改，不自动将点选视角烘焙成模型修复。圆对称模型可标记“无方向性”。
- 米制真实尺度无法只靠模型数字证明；在清单显示尺寸供用户确认，疑似单位错误要提示。用户确认单位/正面不覆盖可检测的非零根变换/错误原点。
- 当前标准面向落地独立资产。吊装、壁挂或整园区场景不得自动套底部中心并宣称适合；显示安装类型待明确，本轮不扩展各类挂点标准。
- 对上述已检测到的摆放规范违规：允许预览、禁止标成标准资产并默认消费/入库，提示修正。性能超标不是此类违规。
- 禁止覆盖用户原模型，不做运行时逐模型补偿，不静默执行 apply transforms、减面、旋转或贴图重采样。

全 skill 的规范描述与对外可复用资产坐标必须一致。相机局部 -Z 观察方向、合法负坐标和内部局部变换不应机械替换。审查 procedural/component 的对外朝向；如需修改 car 等历史资产，优先在资产制作/构造阶段统一，不在每次放置时加入特殊旋转，并维护稳定编辑槽位、检查尺寸/朝向相关回归。不要批量改写用户已有场景。

## 6. 禁止项、性能目标与状态

### 6.1 明确禁止相机/灯光

扫描整个 glTF/GLB 的 cameras、node.camera、KHR_lights_punctual 的定义/节点引用，包括未被默认 scene 引用的定义。已知其他灯光扩展按运行时支持范围检查，未知必需扩展按不支持处理，不声称能识别任意私有扩展。

发现相机或灯光：允许接收并预览错误信息，禁止选择确认/注入/入库；提示数量/定义或节点路径和整改方式。Viewer 自己的照明相机不计；材质 emissive 自发光不算灯光，不应拒绝。用户“仍然使用”不能绕过此项；不默认静默删除。

### 6.2 生产目标预算

已明确要求：简单≤200、中等≤500、复杂≤1000 三角形；全部模型节点（含 Group）≤5；单张贴图边长≤1024。按模型类别/用途预选复杂度，可由用户调整，不能为了通过自动升档。未知复杂度初始用中等并显示档位，用户可更改。

本 spec 建议的补充默认值：基准 draw_calls≤5（推荐1）、texture_count≤4。属于项目建议，可集中配置，并不是行业统一上限。没有新增 estimatedTextureMiB 的入库必填项。

以上均为目标告警，不是加载硬拒绝。显示“实际/目标”、可能影响、建议优化，并要求用户明确确认超预算继续。接受的告警绑定模型内容、规则版本和相关指标；模型变更后不能自动沿用告警接受记录。超过文件/内存安全容量或实际无法加载仍阻断，不能用告警同意绕过安全限制。

默认不运行自动优化，不因性能提醒自动重试。保持系统接收资源上限与美术性能建议分离。旧 validate-model art/strict 硬阈值不能继续在新上传/消费路径中把已同意的性能告警重新阻断；审查实际所有调用点，维护独立 CLI 兼容选项并说明差异。

### 6.3 状态不要混为“可使用”

内部区分：加载状态、规范违规、性能告警、语义/方向/单位待确认、用户选择。页面派生展示“通过／待确认／性能提醒／需整改／检查未完成”。

可消费条件：加载通过、无硬违规、必要语义/坐标确认已完成、已选中、超预算时已明确同意。相机/灯光与结构损坏不能通过客户端编辑或 import-check/accept-remote 绕过；CPU/GPU/浏览器环境失败只表示未检查完成，不判定模型文件必坏。

## 7. 更新已有模型包，保留填写内容

### 7.1 用户流程

用户修复后上传新 ZIP，说“更新模型包，保留之前填写内容”。若旧清单尚未发回 Agent，则同时附旧 models.3d.json。原包可定位时不要求用户再发一次旧 ZIP；定位不到时说明需要原模型包/记录，不猜关联。

内部接口建议：
`update-package <原包目录> <新ZIP> [--review <旧清单>] --out <新版本目录>`。

新包是独立版本，保留 parentPackageId 与映射摘要。原件/旧版本不可覆盖；新包身份和清单 revision 重新绑定。确认前不替换已有场景引用；确认后仅后续明确生成/修改使用新版本。

### 7.2 匹配与迁移规则

| 比较结果 | 描述/选择 | 检查结果 |
|---|---|---|
| 路径及内容闭包完全相同 | 保留 | 检查/规则版本及缓存有效时复用 |
| 同路径但内容或依赖变化 | 保留为待确认，标记模型更新 | 重新检查，旧告警同意失效 |
| 改名但内容闭包等价且唯一 | 保留，显示重命名映射 | 同版本且等价能确定时复用，否则重新检查 |
| 匹配歧义 | 在页面选择原模型或标为新增 | 不猜、不复用 |
| 新增 | 自动预填 | 新检查 |
| 删除 | 更新摘要展示，保留旧版本记录 | 不纳入新包 |

先用精确路径+内容匹配，再处理唯一改名候选；一个旧模型不能无提示迁移到多个新模型。仅文件名相同绝不能沿用技术通过状态。

保留内部路径敏感 content_hash 用于安全校验；改名识别增加独立 content-equivalence 指纹。GLB 仅入口改名可按原内容匹配；多文件 glTF 的 URI 可用其引用资源内容摘要规范化，再连同结构计算指纹，保持引用角色/几何/材质差异。不能只是对文件大小或不带角色的哈希集合匹配，不做昂贵几何相似识别。无法确定等价时退回人工确认/重新检查。

附带的旧清单先验证原包身份/版本/唯一条目，只迁移经过校验的描述和选择意图；不要为迁移描述而将旧清单直接导入新包，也不要将其中的技术通过状态当作新包检查。旧 schema 可支持明确定义的语义读取适配，否则提示重新提供可识别版本；不降低技术校验要求。

新包每个条目记录映射来源、保留字段、是否待确认。更新摘要例如“4 项未变化，1 项更新，1 项新增”，完整列出删除和歧义。用户在同一清单页一次处理并导出，不另生成报告卡片。

## 8. 页面设计与操作提醒

维持浅色工作台，模型预览为视觉主体，清晰留白、状态文字+图标，不只依赖颜色。唯一入口 index.3d.html，资源作为配套文件，不产生 localhost/review 等额外卡片。

- 顶部三步：查看检查结果 → 确认名称与用途 → 保存清单并发回对话。
- 固定提醒：保存只下载文件，不会自动发送给 Agent。
- 摘要与筛选：全部、通过、待确认、性能提醒、需整改；支持名称/文件名搜索，大包分页或按需渲染。
- 卡片主区：大缩略图、名称、用途、是否使用、明确问题与行动建议。
- 折叠详情：文件名、尺寸/bbox、triangles、draw_calls、node_count、贴图数量/最大尺寸、实际与目标、编辑限制；检查完成实时刷新，不读过期初始对象。
- +Z 正面参考、尺寸/单位确认放在需要时的条目区，不要求输入矩阵。规范不通过项不能用“仍使用”绕过。
- 底部固定操作：所选数量、待整改/待确认数、超预算继续确认、保存清单。未选硬失败项可在明确同意有效子集后提交其余模型；全失败/空选择不能确认可用包。
- “发现模型需要修改？”折叠说明：先保存已填内容 → 修复并重新打包 → 将新 ZIP 与清单发回对话，说明更新模型包。

为保留填写内容，需区分“确认使用清单”和“仅保存草稿”：
- 正常主操作保存确认清单，受可消费条件约束。
- 存在需整改/未完成检查时仍允许“保存已填内容（草稿）”，下载文件带明确 draft 标记，不含可消费授权。Agent 导入只能存草稿/用于 update-package 迁移，不能确认、注入或入库。
- 草稿不需要等待全部加载完成，保存事件不能触发检查重试；下载仍提示发回对话。
- 两类文件可沿用 models.3d.json，并在协议区分 purpose；页面和 CLI 不靠文件名判断授权。

用户包更新能力与对应说明同时发布，不先展示无法执行的承诺。批量操作不能覆盖手工编辑或隐藏失败项。页面新字段/筛选不再产生额外长期上下文日志。

## 9. 实现地图与顺序

| 单元 | 修改位置/建议模块 | 工作 |
|---|---|---|
| A 统一契约 | 新增小型 model-policy/metadata 模块；viewer/intake-contract.js | 元数据口径、硬违规/告警、purpose/acknowledgement、规则版本；schema 明确升版，旧文件安全拒绝或只迁移语义 |
| B 接收/校验 | lib/designer-assets.mjs、validate-model.mjs、runtime-compatibility.mjs | 默认命名、全文件相机灯光检测、坐标/预算检查、内部身份；旧阈值调用链梳理 |
| C 浏览器测量 | lib/viewer/intake.js、checker.js、intake-page.mjs | 同一统计/规则来源、节点与调用区分、图片尺寸、bbox、详情刷新、方向尺寸确认；维护后端与正常页不得各自一套不一致规则 |
| D 文件回传与消费 | intake-contract.js、intake-page.mjs、designer-assets.mjs CLI、selected/inject/export/accept-remote | 整批校验原子提交；草稿永不确认；性能同意与硬禁止分离；客户端不能填个 approved=true 绕过可静态复验规则 |
| E 更新模型包 | 新 lib/package-update.mjs 或同等独立模块；designer-assets.mjs CLI | 新版本接收、指纹匹配、旧清单语义迁移、选择恢复、变化摘要、有效缓存复制与新身份重绑定 |
| F 向量库 | exportPackage、asset-service.mjs、search-assets.mjs | 外层模板不变，白名单 raw_data；检索保留元数据、旧字段兼容；本地检查与远端提示区分 |
| G 清单 UI | intake-page.mjs、viewer/intake.js | 三步提示、状态筛选/搜索、响应式卡片、固定保存区、问题行动建议、更新映射与草稿流程 |
| H 统一规范 | SKILL.md、README、references/model-spec.md、designer-assets.md、generation-contract.md、必要 procedural/component | 坐标/预算/入库/更新说明一致；审查历史对外朝向，避免影响相机和用户旧项目 |

先做 A/B 的可测试契约，再 C/D/E 的文件闭环，之后 F/G/H 整合。新模块只承担明确职责，不引入通用工作流框架。新增流程通过后再打包；不改用户已有业务场景。实现中必要的新范围/偏差写回本规格，不沿用旧 spec 的矛盾门禁。

## 10. 验收矩阵

1. 名称：armchair_01、同类多个编号、中文名、object_xxx；自动预填不覆盖用户名称，不虚构识别。
2. 计数：3 个空 Group calls=0；Group+3 个单材质立方体节点数/三角形/calls 分别正确；多材质、实例、共享几何、蒙皮的口径一致，不把两次视角累加。
3. 空间：底部中心原点、偏心、悬空、错误根缩放/旋转、内部正常局部变换；+Z 参考与真实尺度待确认；90° 旋转后的世界 bbox 宽深正确。
4. 禁止内容：默认/非默认场景、未引用 cameras/lights 定义均识别；自发光允许；上传及库模型、CLI/页面各入口不能绕过。
5. 性能：200/500/1000、节点5、纹理1024 的边界；超标提醒且显式同意可继续，无同意不得确认；已同意不被旧硬门禁再次拦截；安全容量超限仍拒绝。
6. 草稿：有整改/失败/加载未完成时可保存姓名用途；导入草稿不能确认/inject/export；新包更新能迁移草稿，技术状态不复用。
7. 包更新：不变、同路径修改、只改贴图/bin、改名、重命名依赖 URI、重复相同内容、歧义、新增/删除；原包完整保留，缓存只在内容和版本证明有效时复用。
8. 版本与事务：旧 revision、错包、重复 ID、伪造通过、相同 submissionId 异内容拒绝；重复导入幂等；失败不修改旧状态和其引用文件。
9. 页面真实浏览器操作：填表、筛选分页后内容不丢、实际下载到磁盘、CLI 导入、用途与选择落盘；新包页面正确显示继承内容和变化项；单入口无服务器。
10. 向量模板：导出 ZIP 与 file_templete 外层一致，扩展字段仅 raw_data；检索模拟响应到下载/检查/import-check/accept-remote/inject 完整闭环，缺失元数据不冒充0或合规。
11. 相关回归：现有 intake-session/intake-review/designer-assets-review；只在改动相关资产构造或编辑逻辑时跑对应场景回归，不重跑无关全套。
12. 交付：源码/ZIP 一致、解压包可执行；macOS、Octo 卡片与下载、大包性能分别记录实际证据，未测不得宣称通过。维护测试不变成每次用户生成门禁。

页面视觉在本功能维护验收时查看桌面与窄屏、长名称/错误、多模型列表；不将这项变成后续场景的默认审美自动迭代。

## 11. 交接与当前状态

本轮仅完成规格，没有实现上述新增功能，现有发布包仍是 MR-R1～R8 修复版本；坐标文档的先前修改尚不代表发布包已更新。

交给实现 LLM：按本规格执行，保留此前原子导入/版本/缓存/预览生命周期修复；先将未明确的协议字段和变更计划写回，再实施。完成后回填修改文件、实际命令与结果、UI 验证、发布包摘要、未验证边界。不要为了通过测试降低禁止灯光相机要求，也不要把性能警告改回硬拒绝。

实现后复核口令：“模型元数据、规范检查、包更新与清单 UI 已完成，spec 和发布包已回填，请整体 review_execute，重点复核文件闭环及相关回归。”

### 11.1 实施结果回填（2026-10-22）

阶段：Execute 完成；保留 MR-R1～R8 全部文件闭环修复；未引入默认服务或宿主桥接；性能警告保持告警（显式同意后放行），未改成硬拒绝；相机/灯光与坐标规范违规保持硬违规（可预览、禁确认/入库）。协议字段变更：models.3d.json schemaVersion 升到 2，新增 purpose（confirm|draft）、rulesVersion、entries[].confirmFront/confirmScale/tier/acknowledgement；旧 schemaVersion 1 文件按无效清单拒绝，需重新生成页面。

#### 修改文件（源码 D:\cyc\project\octo\gts\test\ep-coder\skills\generate-3d-scene）

| 单元 | 文件 | 变更 |
|---|---|---|
| A 契约 | scripts/lib/model-policy.mjs（新） | RULES_VERSION 2.0.0；placementPolicy（容差 0.001）；budgetPolicy（200/500/1000、节点5、贴图1024、calls5推荐1、贴图数4）；scanForbiddenContent（cameras/node.camera/KHR_lights_punctual 定义与节点引用，含未引用定义，emissive 不算）；checkPlacement（min.y、X/Z 中心、根 TRS/matrix）；checkBudget；validAcknowledgement（绑定 contentHash+rulesVersion+tier+accepted keys）；suggestName（文件名→中文建议，弱名称 pending）；RAW_DATA_FIELDS 白名单 |
| A 契约 | scripts/lib/viewer/intake-contract.js | schemaVersion 2；purpose/rulesVersion/acknowledgement/confirmFront/confirmScale/tier 校验；草稿不携带确认授权；硬违规条目禁 selected；draft 选择不再要求检查通过 |
| A 契约 | scripts/lib/viewer/measure.js（新） | meshTriangles（indexed/STRIP/FAN 拓扑、InstancedMesh×count）；countNodes（含 Group）；countTextures（按 Source 唯一、真实图片尺寸、未知尺寸计数）；measureModel 统一入口 |
| B 接收 | scripts/lib/designer-assets.mjs | receive：suggestName 预填、namePending/nameSource、弱名称保留原文件名；inspectEntry：全文件相机/灯光扫描落 forbidden、rootTransforms（单根）、rulesVersion；applyCheckResult：落 nodeCount/drawCalls/textureCount/maxTextureSize、按 bbox 重算 placementViolations、按 tier 算 budgetWarnings、清 budgetAck；confirm：硬违规拒绝确认；selected：硬违规+无有效同意拒绝消费；exportPackage：raw_data 白名单（bbox/triangles/draw_calls/node_count/texture_count/max_texture_size，缺失 null） |
| C 测量 | scripts/lib/viewer/intake.js | checkInPage 用 measureModel + draw_calls（frustumCulled=false、每视角 info.reset、双视角取 max）；check 后实时刷新 placement/budget/详情；openViewer/frontReferenceImage（+Z 参考视图）；deriveState 五级状态；筛选/搜索/确认行/预算同意/草稿按钮/映射展示；remote 模式 purpose=draft |
| C 测量 | scripts/lib/viewer/checker.js | 同一 measureModel/draw_calls 口径（受控后端） |
| C 测量 | scripts/lib/asset-preview.mjs | 透传新测量字段 |
| D 回传 | scripts/lib/intake-page.mjs | schemaVersion 2；assetPayload 传 policy 字段+mapping；data 含 rulesVersion/parentPackageId/updateSummary；runtime 嵌入 measure.js；importReview：draft 分支（存 pkg.draft、无确认）、服务端按存储测量重验 acknowledgement、front/scale/tier 落盘、新测量落盘；快照含 forbidden/placement/budget/rulesVersion；页面 HTML：三步提示、筛选/搜索栏、草稿按钮、+Z 正面 dialog、更新说明折叠区、badge 样式 |
| E 更新 | scripts/lib/package-update.mjs（新） | updatePackage（receive 内部 staging→映射→原子 rename；原包不动）；matchAssets（路径+contentHash 精确→同路径变更为 updated→改名等价唯一（路径无关指纹：闭包摘要+glTF 结构）→歧义→新增→删除）；名称/描述/选择作为意图迁移；技术状态仅在 unchanged/renamed 且 checker/rule 版本一致时复用；updateSummary+parentPackageId；--review 旧清单先验身份 |
| E 更新 | scripts/designer-assets.mjs（CLI） | update-package 命令；summary 输出新字段 |
| F 向量库 | scripts/lib/asset-service.mjs | searchRemote 透传 sanitizeLibraryMetadata（白名单、未知/畸形丢弃、缺失 null）；download 落 libraryMetadata（库元数据=候选提示，非本机检查结论） |
| G UI | （含在 intake.js/intake-page.mjs） | 见 C/D 行 |
| H 文档 | SKILL.md、README.md、references/model-spec.md、references/designer-assets.md | 设计师上传包标准（硬违规/预算/状态分级/统计口径/草稿/更新流程/raw_data 白名单）；CLI art/strict 档定位为维护路径，不得在上传/消费路径重新阻断已同意告警；car.ts 朝向说明 |
| H 资产 | template/src/scene-core/handlers/procedural/car.ts | 构造阶段加 car_body Group 绕 Y +90°（车头 -X→+Z，数学已验证），不在摆放时补偿；demo 场景无需改动 |
| 测试 | scripts/verify/model-standards-fixtures.mjs（新）、standards-ui-fixtures.mjs（新） | 验收矩阵 #1–#8 纯逻辑 + #9 真实浏览器 |
| 测试 | scripts/verify/intake-session-fixtures.mjs、intake-review-fixtures.mjs、designer-assets-fixtures.mjs、designer-assets-review-fixtures.mjs | 几何居中（新标准下原偏心 fixture 属需整改，属预期行为变化）；schemaVersion 2 + purpose；断言改为五级状态文案；草稿/确认流程补 front/scale 勾选 |

#### 实际测试命令与结果（2026-10-22，Windows 11 + Node v24.16.0 + three 0.185.1）

| 命令 | 结果 |
|---|---|
| node scripts/verify/model-standards-fixtures.mjs | PASS（命名预填/统计口径/空间检查/90° bbox/禁止内容扫描+confirm阻断/预算边界+同意绑定/草稿协议/包更新/向量模板 raw_data） |
| node scripts/verify/standards-ui-fixtures.mjs | PASS（真实浏览器：筛选/搜索、+Z 正面 dialog 出图、front/scale 确认、确认清单实际下载→CLI 导入落盘、草稿保存→draft-applied 无确认、update-package CLI→页面继承名称+映射标注+摘要 banner） |
| node scripts/verify/intake-session-fixtures.mjs | PASS（12 项，含真实浏览器下载/导入/幂等/拒绝矩阵；断言已更新为五级状态） |
| node scripts/verify/intake-review-fixtures.mjs | PASS（7 项：契约/事务/提交失败保留/资源路径/下载恢复/超时取消/库模型全链路） |
| node scripts/verify/designer-assets-review-fixtures.mjs | PASS（4 项） |
| node scripts/verify/designer-assets-fixtures.mjs | PASS（含 file:// 编辑/保存/导入、检索/下载闭环） |
| node scripts/pack-skill.mjs …dist\generate-3d-scene.zip | 168 文件，1,491,273 字节，SHA-256 e3bd877a1f77056b483d43c8d44844bdf99f175bb0b27e6501c371f92eb03ab5 |
| 解压包验证 | receive 解压到临时目录：168 文件与源码逐字节一致（mismatch=[]）；无 node_modules/verify；从解压副本执行 CLI 正常、update-package 在帮助中；从解压副本 receive→preview→真实浏览器检查→保存→import-review 全链路 PASS（命名预填"机柜 03"、导入"发布机柜"） |

car.ts 朝向：+90° 旋转数学经手工验证（-X 车头→+Z）；模板 typecheck 未在本机执行（template 无本地 node_modules，依赖外部共享环境），car.ts 仅增加一层 Group 包装与 rotation.y 赋值，无类型面变更；demo 场景 codecars 节点无需修改。此项视觉朝向待下次场景生成时人工目检确认。

#### 剩余问题与未验证项

- macOS Safari/Chrome、Octo 卡片注册/下载交互、真实内网检索/上传、大包性能：未实测，维持既有边界声明。
- validate-model.mjs 的 art/strict CLI 保持原样（独立维护路径）；import-assets.mjs 入库门禁继续使用 strict 档——该路径面向 AI 生成资产入库，与设计师上传包（designer-assets）路径分离，未接入已同意告警放行；若未来要把上传包直接喂 import-assets，需先按 §6.2 梳理。
- checkBudget 在 model-policy 与 viewer/intake.js 页面侧各有一份实现（页面版因需即时展示、字段名 camelCase；后端版 snake_case）——口径一致由两侧 fixtures 共同锁定；后续如再调阈值需同步两处并同步 RULES_VERSION。
- 多根组合资产（rootTransforms=null）当前只做 bbox 级检查、不判根变换违规，页面显示待确认；spec §5“无法确定标准根时要求重新导出”的强提示尚未做专门 UI 文案。
- 吊装/壁挂类 assetType 仅保留字段与待明确提示，未扩展挂点标准（符合 Out 范围）。
- 动画模型 bbox 为默认姿态范围，未标全动画范围（spec §4.3 要求标注——字段位已留，文案待后续）。
- 页面窄屏/长名称/多模型大列表的视觉验收：本轮测试浏览器为 1200px 宽桌面视口，未做窄屏与分页实测（spec §10 页面视觉项）。
- 真实设计师生成的大包（数百模型）性能未测。

#### 边界遵守确认

- 未新增默认 HTTP 服务、宿主桥接、外部视觉平台；index.3d.html 唯一入口，file:// 直开。
- 性能超标=告警+显式同意（绑定内容/规则版本/指标，内容变更失效），未改硬拒绝；安全容量超限/无法加载仍阻断。
- 相机/灯光（含未引用定义、emissive 除外）与坐标规范违规=硬违规：可预览、禁确认/入库/注入，无"仍使用"绕过路径（服务端 confirm/selected/import-review 三层拦截）。
- 未自动减面/压缩/烘焙/apply transforms；未覆盖用户原模型；update-package 输出新目录，原包与旧版本完整保留。

### 11.2 整体 review_execute（2026-10-22）

**结论：未通过。本节覆盖 11.1 的完成声明；发布包与源码一致，但文件闭环及规范检查仍有下列缺口。此次仅回填审查，不修改实现。**

#### MS-R1 · P1：首次文件导入没有按新测量执行规范与预算检查

位置：`scripts/lib/intake-page.mjs:350–390`、`scripts/lib/viewer/intake.js:439–446`、`scripts/lib/designer-assets.mjs:245–251`。

`importReview` 在应用 result 前读取旧 placementViolations/budgetWarnings，首次扫描这些字段为空；应用新 bbox/计数后没有像 applyCheckResult 那样重新计算。confirmFront/confirmScale 也仅可选落盘，不是确认前置条件。独立复现：导入 bbox=[10,20,30]→[11,21,31]、triangles=99999、没有方向/尺寸确认的有效清单，结果 applied，selected 返回 1，存储的规范/预算字段仍 undefined。页面自身只检查 bbox，未传递/验证整体 rootTransforms，因此根 scale/rotation 不合规但 bbox 居中的模型也会漏检。这不依赖用户故意改清单才能触发根变换缺口。

修复：统一新结果/有效缓存的策略评估，在提交确认、消费、远端检查后选用等入口执行同一规范；明确区别 upload 人工方向/尺寸确认与 remote-check 技术报告。多根无法确定标准根不能直接算合规。新增“实际页面→首次 import→selected/inject/export”回归，不能只测 applyCheckResult。

#### MS-R2 · P1：页面生成的超预算同意与服务端契约不一致

位置：`scripts/lib/viewer/intake.js:367`、`scripts/lib/intake-page.mjs:354–360`、`scripts/lib/model-policy.mjs:validAcknowledgement`。

页面 acknowledgement 只有 accepted/tier，服务端要求 contentHash/rulesVersion。对已测得 600 面的模型提交页面同形同意，实际报“超预算同意无效或与实际测量不符”；首次导入则因 MS-R1 跳过保存同意。现有新测试手工往 package.json 写完整 ack，再证明 selected 成功，未覆盖真实页面闭环。当前同意只匹配指标键，没有绑定具体测量值；UI 也没有 spec 要求的复杂度档位选择。

修复：统一生成、验证、持久化的同意结构，绑定内容/规则/档位/测量；页面支持调整档位但不自动升档。以真实下载清单覆盖首次检查、缓存、改变档位、更新内容后旧同意失效。

#### MS-R3 · P1：可预览的硬违规模型阻断草稿及部分确认

位置：`scripts/lib/viewer/intake-contract.js:36–41`。

result.ok 被当作规范确认，而不是加载成功；即便 purpose=draft 或 selected=false，含相机/灯光或已存坐标违规仍被拒绝。真实浏览器复现：带未引用 camera 定义、几何可加载的模型，点击“保存草稿”显示“保存草稿失败：含相机/灯光的模型不能确认成功”。同一批中排除该模型也不能保存其他合规条目。

修复：允许记录成功加载及违规事实，硬拦截仅针对违规条目的使用授权；草稿、排除项不得被结果校验误拦。覆盖相机、灯光、坐标违规，以及好坏混包部分确认。

#### MS-R4 · P1：草稿与用户选择没有贯穿更新/重新打开页面

位置：`scripts/lib/viewer/intake.js:368`、`scripts/lib/intake-page.mjs:62–74,348`、`scripts/lib/package-update.mjs:100–123`。

浏览器草稿强制全部 selected=false；导入草稿又只保存名称/用途，未保留选用意图。pkg.draft 没有被 updatePackage 或页面生成读取。独立复现：导入 edited name/edited description/edited package 后，以相同模型更新包，输出恢复为原名称 z、空用途、original 包说明。即使使用 --review 迁移，页面 payload 未输出 inheritedSelection，用户排除项仍会默认选中。

修复：将草稿选用意图与“已授权使用”分离存储；未显式传 review 时读取已导入草稿；页面重开、包更新、--review 三条路径一致保留文字和选择。保留修复前旧版本且不把草稿当确认。旧清单导入/更新应明确处理 revision 与当前草稿冲突，不能静默覆盖新编辑。

#### MS-R5 · P1：包映射按遍历顺序抢占旧模型，歧义没有确认闭环

位置：`scripts/lib/package-update.mjs:61–88`、`scripts/lib/viewer/intake.js:264`。

独立复现：旧包只有 z.glb，新包保留 z.glb 并新增相同内容 a.glb；实际 a.glb 被认作 renamed(z.glb)，原 z.glb 被认作 added。旧文字/选择因此迁移到错误条目。原因是逐条同时做路径匹配与内容匹配，没有全包先锁定精确路径。歧义仅写 mapping.choice 和“请确认”文案，没有候选选择/确认交互，mappingPending 也未参与 deriveState/导入授权。

修复：全包分阶段匹配，先精确路径/同路径更新，再做剩余项唯一内容匹配；增加歧义明确解决或保持待确认流程。多文件 glTF 的等价指纹目前包含原始 JSON 字节，URI 随依赖改名仍会使等价匹配失败；应按 spec 规范化引用角色后计算，新增依赖改名回归。

#### MS-R6 · P2：未变化模型的缓存没有真正迁移

位置：`scripts/lib/package-update.mjs:101,126–135`。

只复制 thumbnail 相对路径，没有复制对应 PNG；也未先验证源缓存，checkerVersionRef 取旧记录而不是当前检查器版本。独立复现：旧缓存 hit，相同包 update 后缓存 miss、对应缩略图不存在，导致未改模型重复检查。方向/尺寸确认也未迁移，增加重复人工确认。

修复：仅在当前版本、内容、有效缓存均匹配时迁移完整缓存及允许复用的确认状态；失效则明确重查，不能显示已复用。不要通过禁用缓存检查掩盖问题。

#### MS-R7 · P2：节点统计把 GLTFLoader 包装 Group 算入模型

位置：`scripts/lib/viewer/measure.js:25–29`、`scripts/lib/viewer/intake.js:110,144`。

countNodes 从 model.scene 本身开始 traverse，而该 Group 是 loader 创建的场景容器。真实页面中仅 1 个 glTF Mesh 节点显示 2 / 5，造成节点预算误报及入库元数据错误。新增单测的 fake traverse 没有访问自身，所以掩盖了问题。

修复：明确并排除 loader 场景容器，保留所有实际 Group/Mesh/Bone；用真实 GLTFLoader 树验证 1 节点、5 节点边界、多个根和 primitive 拆分，不只用 mock。

#### MS-R8 · P2：入库字段违背当前精简契约

位置：`scripts/lib/designer-assets.mjs:276–282`、`scripts/lib/model-policy.mjs:RAW_DATA_FIELDS`。

新导出仍默认写 raw_data.content_hash、units、mesh_count，其中 content_hash 明确违反 §4.1“保留内部，不纳入默认入库 raw_data”。这是新增实现主动延续旧字段，并非仅旧记录兼容。请按当前 spec 保留六项常用字段；历史字段可读不等于新包必须写出。对应测试也应按新契约断言，不能证明沿用旧白名单就算通过。

#### 本轮实际验证与范围

- PASS：`node scripts/verify/model-standards-fixtures.mjs`。
- PASS：`node scripts/verify/standards-ui-fixtures.mjs`（真实浏览器）。
- PASS：`node scripts/verify/intake-review-fixtures.mjs`（包含实际文件下载/导入、事务、超时/重试、远端注入闭环）。
- PASS：`node scripts/verify/designer-assets-review-fixtures.mjs`。
- 独立失败路径复现脚本：`C:/Users/Tony/AppData/Local/Temp/standards-review-probe.mjs`；最近产物 `C:/Users/Tony/AppData/Local/Temp/standards-review-U74JKC`。该脚本使用临时模型包，不修改 skill 实现；涵盖 MS-R1/R2/R3/R4/R5/R6/R7 所列输出。相机草稿与节点计数通过真实浏览器验证，其余通过真实文件 API 验证。
- 发布包：`dist/generate-3d-scene.zip`，168 文件，1,491,273 字节，SHA-256 `e3bd877a1f77056b483d43c8d44844bdf99f175bb0b27e6501c371f92eb03ab5`；逐文件与当前 skill 源码比对 mismatch=0。打包同步通过，但上述实现问题也同步进入发布包。
- 未跑全部测试；未验证内网服务、macOS、Octo 宿主、模板完整 typecheck 和数百模型性能。不把这些环境项当已通过。
- 额外未完成项：§11.1 自报的动画 bbox 范围标识、窄屏/长名称/大列表验收仍不能算完成；页面目前全量建卡，分页/按需策略没有对应证据。修复时补齐 spec 验收或明确缩减范围，不再以“后续待测”声称整个 spec 完成。

#### 修复交接与复核方式

请按 MS-R1～MS-R8 整体修复，优先统一策略评估、清单契约和包更新状态流，不只改报错文案或调整测试预期。补足上述真实跨模块失败路径，再跑本节四组相关回归，重打发布包并回填实际证据。保持单 index.3d 入口、无默认服务、无自动优化/审美重试；不要另造新协议绕过既有文件闭环。

修复后需要复核。提交消息：**“MS-R1～MS-R8 已修复，spec 与发布包已回填，请定向 review_execute，重点检查首次导入策略、超预算同意、违规草稿、包更新与元数据闭环。”**

### 11.3 MS-R1～MS-R8 修复与页面改版（2026-10-22）

**本轮实现已完成，相关回归与发布包验证通过。** 本节为 §11.2 的修复回填；历史审查记录保留。未修改用户仓库场景源码，未增加生成场景的浏览器/截图/审美门禁。

#### 修复落点

| 审查项 | 最终实现与验证 |
|---|---|
| MS-R1 首次导入策略 | 抽取纯模块 `scripts/lib/viewer/model-policy.js`，页面、文件契约、Node 检查与消费共用。首次导入以新 result 计算 bbox/根变换/预算；方向和实际尺寸须确认；多根无法确定标准根要求重新导出。proposedAsset 只接收测量字段，不允许 result 覆盖源文件规范事实。confirm/selected 同样复核。 |
| MS-R2 超预算同意 | 共享生成/验证，绑定 contentHash、rulesVersion、tier、完整指标值。页面可调复杂度，变更会撤销旧同意。首次扫描、缓存扫描均能将真实下载清单导入；测量改变后旧同意被拒。库模型的技术报告可记录明确的预算同意，不授予语义选型权限。 |
| MS-R3 违规草稿 | 加载成功与规范通过分离。相机/灯光/根变换违规可保存草稿；排除违规条目后可确认有效子集。真正的使用仍受硬违规拦截。 |
| MS-R4 草稿保留 | 草稿保存文字、选用意图、档位和已勾选信息，导入推进 revision 且不授予使用权限。页面重开与未传 --review 的包更新读取已导入草稿；过期 review 不静默覆盖新编辑。已确认子集重开保留选择及部分使用勾选。 |
| MS-R5 更新映射 | 全包先匹配路径，再处理唯一等价重命名。多文件 glTF 用资源摘要规范化 URI，保留完整 JSON 结构；同内容一对多不自动抢占。页面提供候选旧模型/作为新模型和更新确认；同一旧模型不能被确认给多个新模型。映射在再次打开/保存后仍保留。无历史选择记录时默认选用，显式取消则继承取消。 |
| MS-R6 缓存 | 比对当前 checker/rules 和有效源缓存，复制缩略图及测量/可复用确认。旧版本或失效缓存重新检查；内容变化不沿用预算同意。 |
| MS-R7 节点数 | 遍历时排除传入的 GLTFLoader 场景容器，实际 Group/Mesh/Bone 仍计入。真实浏览器单 Mesh 模型测得 1 节点。CHECKER_VERSION 升为 1.1.0；RULES_VERSION 为 2.1.0。 |
| MS-R8 库字段 | 新导出仅 bbox、triangles、draw_calls、node_count、texture_count、max_texture_size 六项 raw_data。内部 hash/检查状态不默认写出；旧库元数据读取兼容。真实导出 ZIP 验证字段集合。 |

#### HTML 页面

- 仍为唯一 `index.3d.html` 入口和现有 data companion，不新增 serve、默认 HTTP 服务或宿主接口。
- 重新设计浅色卡片、三步操作引导、整包说明区、状态色、检查进度、可展开测量、更新明细和固定保存栏。默认强调设计师可执行动作，技术数据放在详情。
- 名称/用途、档位、正面/尺寸、预算同意和映射确认都在页面内完成；保存栏解释未能确认的原因，草稿可在检查尚未结束时保存。
- 每页 12 项，筛选/搜索基于全部状态，搜索包括编辑后的名称/用途/文件名。分页不丢失填写，空结果有明确提示。
- 390px 窄屏和桌面完成真实浏览器检查；无横向溢出。已检查页面截图。动画资产尺寸明确显示“默认姿态，非动画运动范围”。
- 样式示例：`dist/model-intake-preview-final/index.3d.html`，配套 `index.3d.data.js`；示例内是本次创建的机柜、配电柜、木箱几何测试模型。示例位于 skill 外，未加入 skill 发布包，也不是内网实物资产。

#### 实际回归证据

| 命令/验证 | 结果 |
|---|---|
| `node scripts/verify/model-standards-fixtures.mjs` | PASS；正面/尺寸授权、规范化原点、预算值绑定、六字段契约同步到当前要求，不再手工写 ack 冒充真实文件闭环。 |
| `node scripts/verify/standards-ui-fixtures.mjs` | PASS；实际浏览器下载、导入、草稿和更新流程。 |
| `node scripts/verify/standards-closure-fixtures.mjs`（新增） | PASS；首次违规导入拒绝且原包不变；相机/灯光/根变换草稿；草稿恢复/更新；旧 review；路径抢占；依赖改名；歧义确认及再次保存；缓存复制/旧版本失效；真实 600 面模型明确同意→下载→导入→消费→导出；测量变更拒绝旧同意；单节点统计；窄屏/分页/编辑后搜索。 |
| `node scripts/verify/intake-review-fixtures.mjs` | PASS；身份/幂等/事务/嵌套依赖/真实下载/缓存修复/显式重试/取消超时/remote-check→accept-remote→inject。 |
| `node scripts/verify/designer-assets-review-fixtures.mjs` | PASS；依赖 ID、幂等注入、失败项排除、scene 范围、远端同入口不同依赖。 |
| `node scripts/verify/intake-session-fixtures.mjs` | PASS；静态入口、交互预览、编辑保存恢复、导入、子集注入和拒绝矩阵。 |
| `node scripts/verify/designer-assets-fixtures.mjs` | PASS；上传包离线构建、file:// 编辑/贴图/保存导入、检索下载和贴图兼容相关回归。 |
| `git diff --check` | PASS；仅仓库既有换行提示，无空白错误。 |

最新独立闭环 fixture：`C:/Users/Tony/AppData/Local/Temp/standards-closure-6PCyOT`。测试按行为改变更新旧 fixture（例如维护 confirm 明确传方向/尺寸确认，筛选后不再保留不可见 DOM 卡片）；新增跨模块用例复现并防止 §11.2 的原始失败，未通过放宽规则掩盖失败。

#### 发布包文件闭环

- 已更新 `dist/generate-3d-scene.zip`：**169 文件，1,494,986 字节**。
- SHA-256：`5e0ed98a010e58d1e793dd616c53951ca05dc65ded049a024f13813f079034c7`。
- ZIP 内 169 文件逐字节对比当前 skill 源码，**mismatches=[]**；无 node_modules、verify 维护测试、页面样例或测试模型。
- 从 ZIP 解压副本运行 receive→静态 preview→真实浏览器填写/下载→importReview→selected，结果 **applied / 3 selected**。最终解压副本 `C:/Users/Tony/AppData/Local/Temp/standards-release-vi6qicxu/generate-3d-scene`；最终运行产物见本轮工具记录。
- 旧检查缓存因节点计数修正需要重新检查一次；不会自动修改或标准化设计师原模型。

#### 尚未实测的环境边界

内网真实检索/入库服务、Octo 卡片宿主行为、macOS/Safari 和数百模型的大包性能仍未实测，不以 Windows 浏览器回归代替。页面分页控制 DOM 数量，但静态数据 companion 仍嵌入整个模型包，不能据此承诺无限大包或跨设备性能。此次截图是维护验证，不加入普通场景生成门禁。

### 11.4 清单使用反馈修正（2026-10-23）

- 用户要求位置误差放宽为 0.1 米：共享 placementPolicy 已改为 0.1，规则版本 2.2.0；旋转/缩放要求保持不变。0.099/0.1 通过、0.101 不通过的边界验证 PASS。
- 修复高 DPI 查看模型偏右下：交互 Viewer 在 setSize 时同步 CSS 尺寸，避免 DPR=2 的绘图缓冲尺寸充当显示尺寸后被弹窗裁切。静态清单与受控 Viewer 两条路径同步修复。
- 多根提示改为“模型包含多个顶层对象。请在建模软件中把所有部件放进同一个父级组，再导出 GLB（不用合并网格）”。
- intake-session-fixtures 增加 DPR=2 下 canvas 显示宽高与弹窗内容宽高一致断言；本轮相关会话回归 PASS。
- 已重新生成本地页面样例；按用户前述要求未重打发布 ZIP。复杂度/草稿/载入等交互本轮仅解释，不擅自删除。


### 11.5 模型清单三步向导（2026-10-23，已实现）

本节替代此前页面上的独立“保存草稿 / 保存清单 / 载入已有清单 / 重试失败项”操作方案；内部 confirm/draft 文件协议、身份和版本校验保持不变。

- 同一 `index.3d.html` 内三步切换：检查模型 → 核对信息 → 下载并发回。前后切换保留编辑，逐步显示当前任务；第一步隐藏编辑控件，第二步显示名称、用途、选用及规范确认，第三步显示完整使用/排除范围与交接说明。
- 单一下载入口：所选可用模型完成确认后显示“确认使用并下载清单”，产生 confirm 并明确授权当前子集（排除项对应 allowPartial）；否则显示“下载清单，保留填写内容”，产生 draft，不授予使用权限。全部失败也允许下载并保留文字。正在加载期间可切换步骤、编辑，待本轮检查结束后下载，不自动重试。
- 去掉复杂度下拉框，沿用内部档位及绑定测量的预算同意，不通过调整档位绕过提醒。去掉全局重试，只在可重新加载的失败项旁提供“重新检查”，一次仅检查该资产；硬规范违规不提供重试按钮。
- 去掉页面文件导入。用户将清单交回 Agent，由现有 import-review / update-package 校验后重新 preview；新页面恢复可匹配模型的信息。页面明确提示：下载不等于自动回传；修复后提交完整新 ZIP + 清单；旧 HTML 不自动更新；刷新不能修复模型或保留未导出修改。
- 不修改 Octo，不新增 question/后端/本机服务，不制作发布包。仅刷新本地 `dist/model-intake-preview-final/index.3d.html` 和配套数据。

实现：`scripts/lib/intake-page.mjs`、`scripts/lib/viewer/intake.js`；同步 README、references/designer-assets.md 和四组受影响的维护测试。远程流程测试通过库函数注入本地 mock 配置，避免已移除的 CLI --config 与内置内网连接混用；不改变生产配置。

验证：
1. `standards-ui-fixtures.mjs`：三步显隐、旧操作删除、真实下载、confirm/draft 导入、整包更新继承、全部失败保存与重新生成页面恢复，全部通过。
2. `intake-session-fixtures.mjs`：预览、高 DPI、下载与确切子集、回退保留编辑、导入/注入、幂等、错包/旧版本/内容变更拒绝，全部通过。
3. `standards-closure-fixtures.mjs`：硬规范、预算同意、映射/缓存、导入/消费/导出、分页和移动端，全部通过。
4. `intake-review-fixtures.mjs`：检查中编辑、单项显式重试、超时取消、remote-check 下载/导入/使用，全部通过。远程使用本地 mock，不作为内网服务验收证据。
5. 本地 demo 三步桌面截图及 390px 三步无横向溢出检查通过。浏览器套件并行运行时曾出现会话超时和测量未返回，随后串行执行通过；并行失败原因未单独定位。

限制：浏览器下载由用户回传，不承诺自动写回 Agent 或跨浏览器保存。未进行真实 Octo 宿主和 macOS 验收；本次未引入平台专属接口。


### 11.6 详情文案与正面标记（2026-10-23）

- 折叠标题改为“模型详情”，入口文件改为“模型文件”；指标改为“三角面 / 节点数 / 绘制次数（当前 / 建议上限）”。移除未提供精确编辑能力的固定“编辑范围”行和单场景提示；多场景文件仍说明仅载入哪个场景，避免遗漏内容无提示。
- 交互查看窗口增加指向资产坐标 +Z 的蓝色箭头、随投影定位的“正面方向 +Z”文字和“正面视角”相机按钮。辅助标记不写入模型、不参加资产测量；关闭时释放辅助资源。明确这是约定方向，不是自动识别结论。
- 原正面参考入口复用同一个交互查看窗口，移除独立截图弹窗与重复加载截图代码。
- standards-ui-fixtures、intake-session-fixtures 通过；检查交互预览截图，沿用浅色背景并加粗箭杆，文字避开箭头尖端。刷新本地 demo，不发包。


### 11.7 合并为两步（2026-10-23，替代 §11.5 的三步交互）

- 第一步“核对模型”同时展示检查结果、名称/用途编辑、选用、方向/尺寸确认，不再重复查看同一批卡片。第二步“下载并发回”保留明确的使用范围及 confirm/draft 下载语义。
- 删除“有问题也可以继续”泛化提示，按检查中、需整改、未完成、性能提醒、待确认、未选择、已就绪显示操作说明。
- 加载失败项按钮改名“重新加载”，仍只对用户点击的单个失败资产重试；不向成功项或规范违规项提供无效重试。
- 更新相关维护测试中的步数与跳转，standards-ui-fixtures 验证两步显隐、下载/导入、包更新、全失败清单保留通过。仅刷新本地预览，不发包。


### 11.8 查看模型集中核对（2026-10-23，已实现）

- 主列表仅保留查看模型入口，移除独立正面入口与方向/尺寸复选框；显示文件名和方向/尺寸核对状态。
- 查看窗口采用模型视图与信息卡布局，窄屏上下排列。信息卡显示宽×深×高（米）、贴地及底部中心偏移、折叠模型详情；“方向与尺寸正确”一次设置两项原有确认字段，可撤销。远程检查与硬违规资产不显示该确认按钮。
- 预览增加 Y=0 地面网格与 (0,0,0) 原点十字、文字，保留 +Z 正面箭头。原点被遮挡时标记仍可辨认；镜头取景同时考虑模型和原点，不修改模型位置/缩放/朝向。辅助资源仅在预览场景中存在，关闭释放，不参与资产统计与导出。
- 沿用内容变更失效与缓存确认机制，不重复确认未变化模型。确认仍需下载清单并发回，未添加宿主或后端依赖。
- 四组相关维护测试已通过：standards-ui-fixtures、intake-session-fixtures、intake-review-fixtures、standards-closure-fixtures。覆盖真实查看窗口确认、下载导入、缓存与更新、硬违规、预算、快速开关与高 DPI。桌面与 390px 查看窗口截图已检查，无横向溢出。刷新本地 demo，不制作发布包。


### 11.9 页面更新模型与完整 ZIP 交付（2026-10-26，已实现）

本节替代此前新页面的选择子集、排除/删除、未完成草稿下载、仅回传 JSON 方案；旧 JSON 后端导入保留兼容。

- 默认全部模型使用，移除“在本包中使用”，不新增删除/暂不使用操作。全部模型必须加载成功、符合硬规范、完成必要确认；预算超标需明确接受。
- 列表与查看窗口支持“更新模型”：一个 GLB，或单个 GLTF/GLB 及依赖构成的 ZIP。一次更新自动检查一次；可多次更新。初始版本始终保留，另保留上次成功加载版本；失败明确阻止下载，不默默回退。恢复由用户选择，名称/用途保留，方向/尺寸与性能确认重新核对。
- 性能预算在查看窗口指定：严格 200、标准 500、精细 1000 三角面。调整不影响其他指标上限，清除旧性能同意；不再建议单纯拆分模型来降低总面数。
- 下载按钮保持可点击；检查中、失败、违规、未确认、未接受预算或空包时弹出逐模型原因和“去处理”。不提供未完成下载。编辑或模型更新后离开页面有提醒。
- 成功交付 models.3d.zip，内含 models/ 下全部最新模型闭包与 models.3d.json；不含旧版本、无关输入、HTML 和运行时。每模型独立子目录防止覆盖。ZIP 使用标准 stored 写入；读取支持 stored/deflate，校验路径、重复名、CRC、容量、目录边界，拒绝加密/链接/分卷/ZIP64。单文件 256 MiB、解压整包 512 MiB、最多 10000 文件。
- 新内部协议 kind=model-delivery/schemaVersion=1：绑定原包身份、revision、完整 sourceAssetId 集合、交付路径、内容摘要、检查及确认。`import-delivery <原包> <ZIP> --out <新目录>` 重新解析全部模型和依赖，核对闭包/版本/规则/预算证据，复用现有全量验证，在独立目录原子发布；失败不修改原包，不留下可用的半成品。同一 ZIP 到同一目标幂等，字节篡改不能冒充重复提交。
- 库模型 remote-check 保留技术 JSON → import-check 路径，不引入人工业务确认。更新缓存记录补齐实例/蒙皮标记，避免缓存交付改变编辑能力描述。

代码：新增 viewer/delivery.js、lib/delivery-import.mjs、verify/delivery-workflow-fixtures.mjs；修改 intake 页面/控制器、designer-assets CLI 与缓存字段、预算建议、SKILL/README/操作说明。旧 standards-ui-fixtures 与 intake-session-fixtures 专测已移除的 JSON/草稿/子集页面，被新完整包闭环测试替代；intake-review 与 standards-closure 保留相关后端、超时、远程及历史协议回归，移除废弃页面段。

验证：
- delivery-workflow-fixtures：真实浏览器连续更新、失败阻断/恢复初始及上次版本、GLTF ZIP 依赖闭包、600 面预算确认与切换失效、完整 ZIP 下载/导入/注入、缓存再交付、原包不变、幂等与篡改拒绝、stored/deflate 读取、缺失依赖与不安全路径拒绝，通过。
- intake-review-fixtures：旧文件协议身份/版本/事务、精确依赖、超时取消与单项重试、库模型技术结果回传，通过。
- standards-closure-fixtures 和 model-standards-fixtures：硬规范、旧草稿兼容、包更新映射、缓存与测量、预算证据、向量模板，通过。
- 查看窗口桌面及 390px 窄屏截图检查，无横向溢出；未完成 macOS 与真实 Octo 宿主验收。没有新增后台服务，未发发布包。


### 11.10 查看模型面板整理（2026-10-26）

- 列表移除更新/恢复入口，统一在查看模型中处理；失败模型也可进入面板更新。
- 右侧提供尺寸、明确的待处理事项、紧凑的 200/500/1000 三档预算，详情与坐标说明折叠；确认操作固定于面板底部。
- 方向尺寸确认、性能接受分别只解决对应事项；更新失败与硬性规范问题继续阻止交付。名称与更新关系未确认时明确提示回清单处理。
- 更新/恢复完成重新打开模型；点击弹窗外部关闭，保留本页编辑。画布内拖动到外部不会误关闭。
- 已验证：完整交付相关回归（更新/恢复/预算/下载/导入/注入）、桌面及窄屏预览、背景关闭。未生成发布包。


### 11.11 逐项核对面板（2026-10-26）
- 查看模型内直接编辑名称、用途，同步外部清单；仅保存于当前页面，仍需下载发回。
- 尺寸和正面方向独立确认，不受摆放/结构违规隐藏；更新模型后两项重新核对。
- 摆放位置、模型结构、性能预算按行呈现，问题项展开说明，正常项收起；顶部仅显示待处理数量。
- 底部提供更新模型、版本恢复和完成核对。完成核对仅关闭面板，不替代逐项确认或绕过下载限制。
