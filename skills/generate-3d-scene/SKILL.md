---
name: generate-3d-scene
description: 根据文字或截图需求生成可二次开发的 Vue 3 + Three.js 3D 场景，优先匹配模型，未命中复用组件或几何拼装。交付可离线打开的 index.3d.html 与配套资源，支持材质、贴图、拖拽布局及保存导入。
version: 0.1.0
---

# generate-3d-scene

目标是快速交付清晰、丰富、可编辑的场景。默认输出 index.3d.html 与配套文件和源码；不默认另出二开包或启动服务。

## 默认生成路径

1. 读 `references/generation-contract.md`，再按需要选一个样例。普通生成不通读引擎、编辑器、材质系统或构建脚本。
2. 会话首次运行 `node scripts/ensure-env.mjs`；缺环境按 HINT 安装。无 Node 时按速查中的 install 脚本处理。依赖位于外部环境，不在 skill/template 安装。
3. 理解主要对象、布局、尺度、编辑粒度，批量检索资产。用户明确要求纯几何时跳过检索。未命中及时降级，不循环穷搜。
4. `node scripts/init.mjs <工程目录> --profile empty --assets referenced --deps shared --defer-build`。已选定模型可用 ID 列表替换 referenced。需组件时加 --with-components，由 init 准备独立依赖。
5. 读取生成工程现状，局部修改业务 handler、scene-profile 的注册项和 scene-data。设计相机、光照、材质与布局；不要从 demo 模板覆盖现有文件。
6. `node scripts/build-offline.mjs <工程目录>`。一次执行静态契约、类型检查、资源检查和离线打包。成功直接交付并停止。

不追加 typecheck、普通 build、lint、浏览器、截图、性能采样、验证报告或审美修复。真实错误按下文处理；未经运行不能声称已验证渲染或交互。

## 选材与复用

资产精确匹配 → 合适的近似模型 → 匹配的现成组件 → 复用 procedural 或自定义几何。

- 一次批量检索主要对象：`node scripts/search-assets.mjs --batch <UTF-8查询文件> --brief --json`；选定后 `node scripts/asset-info.mjs <id> [id...]` 读取精确元信息。
- 普通 GLB 用内建 asset 分组。自定义加载行为使用 makeAssetNodeFactory，不另写异步加载/克隆/过期处理。
- 组件按用途和编辑粒度选择，见速查的复用表；不要求每次遍历组件目录。
- 独立编排对象保留独立节点；稳定 snake_case 子网格名决定编辑槽位。不要为了合批牺牲用户要求的编辑粒度。
- 代码建模直接写 handler，不生成 GLB 脚本。模型入库校验属于另行请求的维护任务。

## 数据与修改边界

- scene-data 的舞台区：scene/camera/lights/controls/renderer；业务区：type 分组数组。
- 节点字段：id、parentId、position、rotation、scale、params、card。params 放业务/结构参数；材质颜色、贴图等默认外观写在 handler，编辑覆盖由视觉层保存。
- scene-profile 直接导入业务 handler 并登记一次。通常不改 scene-core/index.ts、handlers/index.ts、核心引擎、编辑器或构建脚本。
- 空工程已删除示例业务/卡片并裁剪导出。生成工程是修改依据，不能用 template 的 demo 文件整份覆盖。
- core 不依赖 edit；edit 经 SceneHandle 公开入口访问 core。蒙皮模型沿用内建加载和编辑限制，不自行烘焙或克隆。
- 运行资源离线，不使用 CDN 或 fetch 本地文件。动态资源登记 public/offline-resources.json；已有资源由构建收集。
- 用户要求实时状态接入时，按需提供生产数据到 update 片段的映射示例；纯展示不额外实现 MQTT/轮询。

## 验证失败与重试上限

- 同一批交付首次验证失败时，汇总本轮全部已发现的错误，集中修复后重跑；最多进行 2 轮修复重跑，即首次验证加 2 次重跑，最多 3 轮验证。
- 一轮指执行本次交付既定的必要检查；每次针对失败集中修改代码、配置或环境后重新验证，计一轮修复重跑。一轮内不同检查各执行至多一次，不分别计轮；前置检查失败时，不强行执行依赖它的后续检查。本规则不新增浏览器、运行或其他验收要求。
- 每轮修复重跑必须有针对错误的修复。同一错误再次出现，且没有新的诊断依据或可行修复方案时，提前停止；有新依据和方案的，也只能在剩余额度内继续。脚本自身异常或环境失败时，按已有 HINT 处理，遵守原有编辑边界；无法解决则报告阻塞，不反复执行同一失败操作。
- 达到上限仍失败，明确报告“未通过”，说明剩余错误、相关日志及源码位置；不得声称完成、绕过检查或降低验收标准。仅提供已有源码或预览时，标明其验证状态。
- 额度按同一批交付累计，不因切换错误、检查项、内部步骤或对话轮次重置。仅用户提出新的修改任务或明确要求继续时开始新的验证批次；澄清需求或询问进度不重置额度。


## 交付与保存

成功给出 offline/index.3d.html 的可点击绝对路径，说明双击打开、进入编辑、保存 scene.3d.json、导入同一预览恢复；移动时携带同目录配套文件。

保存不修改源码或原 HTML；重新构建后旧存档可能不兼容。不承诺构建通过等于绝不白屏，也不把未经目检的效果称为视觉验收通过。

## 按需阅读

| 需求 | 入口 |
|---|---|
| 普通生成、接口和样例 | references/generation-contract.md |
| 默认流程的补充说明 | references/scene-workflow.md |
| 自定义轮廓与精细建模 | references/modeling-channels.md |
| 已选中组件 | references/component-catalog.md → 对应 component-docs 文件 |
| 生产数据接入或架构排障 | references/scene-engineering.md |
| 资产导入、检索库维护 | references/asset-pipeline.md |
| 模型入库规格 | references/model-spec.md |
| 源码仓库维护/用户明确要求诊断 | references/verification.md（所需维护脚本不在精简发布包内） |

用户要求服务联调时使用工程 npm run dev；要求不含编辑器的源码时使用 scripts/strip-edit.mjs；部署按目标环境构建。上述均非默认生成步骤。

维护发布使用 `node scripts/pack-skill.mjs <skill目录外的zip路径>`。依赖树、构建产物、缓存及维护测试不入包。不要为让场景通过而修改 skill 的校验脚本。
