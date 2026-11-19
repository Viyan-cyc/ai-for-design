# R1 首次同步归属迁移方案（RR13-1）

G=`D:/cyc/project/octo/skills/test/ai-for-design/skills/generate-3d-scene`，C=`D:/cyc/project/octo/test/3d-components`。这是R2执行计划，本次仅静态核对，没有运行prepare/apply。

## 当前归属逐项核对

当前无`vendor/components-sync.json`、无`vendor/components.json`。下面的“符合资格”指满足工具generatedLegacy规则，不证明文件从未被人工改过；prepare后仍必须逐文件审阅差异。指纹及完整标记行另存evidence/r1-sync-ownership.json。

|G相对路径|资格证据|操作|
|---|---|---|
|`vendor/a3d-a3d-components-0.1.0.tgz`|工具按旧包文件名匹配（不要求文本标记）|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-catalog.md`|3: > 版本：0.1.0 ｜ 生成：2026-11-06（sync-components.mjs 自动生成，勿手改）|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/AssetCache.md`|60: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/BitmapText.md`|84: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/CameraControls.md`|77: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Edge3D.md`|49: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/GizmoHelper.md`|68: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/GizmoViewport.md`|49: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Graph3D.md`|59: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Grid.md`|71: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/HeatMap.md`|69: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Html.md`|69: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/InstancedEntity.md`|11: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/InstancedMesh2.md`|13: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/InstancedMeshBVH.md`|10: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/InteractiveManager.md`|69: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/MapHeatLayer.md`|18: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|prepare前按批准清单人工删除；首次无manifest不会自动清除旧MD|
|`references/component-docs/MapPresentation.md`|17: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/MapRuntime.md`|44: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/MapScatterLayer.md`|18: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|prepare前按批准清单人工删除；首次无manifest不会自动清除旧MD|
|`references/component-docs/MapSurfaceParticleScan.md`|19: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/MaterialManager.md`|34: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/MeshReflectorMaterial.md`|104: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Node3D.md`|46: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Outlines.md`|60: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Path.md`|64: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/PickController.md`|32: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/PivotControls.md`|95: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Rack.md`|60: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/ScreenLabel.md`|32: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Shape.md`|65: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Sky.md`|61: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Wall.md`|61: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|
|`references/component-docs/Wireframe.md`|77: > 由 `sync-components.mjs` 从源码 TSDoc 生成，勿手改；重跑同步脚本更新。|首次prepare显式接管；仅实际operations内文件进入归属|

目录/catalog及32份组件页均符合标记规则，未发现该集合中不合资格的人工页。人工维护的SKILL.md、references/map.md、references/map-overlays.md、references/scene-design-examples/geographic-map.md、template/docs/INTEGRATION_GUIDE.md不在此次接管范围，按清理计划人工编辑。其他references文件保持不动。

## 执行顺序（R2获准后）

1. 重查工作区、上述文件指纹和manifest状态。若已有manifest，停止使用本首次接管方案，按verifyPrior核对已有归属并重新形成计划；不得删manifest强制接管。
2. 完成已批准的C清理、导出/导航/测试适配，以及G扩展适配和人工资料修改；显式删除两份旧组件API页。首次无prior时工具不会清除未生成的旧MD，所以不能只等apply自动删。catalog保留旧文件直到prepare接管，不人工伪造生成标记。
3. 确认C保留实现检查通过、依赖node_modules可用，所有人工修改完成后再prepare。prepare会复制库及依赖到独立目录，在副本内类型检查、生成文档、构建、pack；本阶段允许的构建均归R2，本轮没有执行。
4. 用下面的命令首次prepare。work必须不存在且不位于C或G之内；失败保留日志，换新work重新prepare，不编辑sync-plan.json绕过校验。

```powershell
$sync = "D:/cyc/project/octo/skills/test/ai-for-design/skills/generate-3d-scene/scripts/sync-components.mjs"
$source = "D:/cyc/project/octo/test/3d-components"
$target = "D:/cyc/project/octo/skills/test/ai-for-design/skills/generate-3d-scene"
$work = "D:/cyc/project/octo/skills/test/ai-for-design/docs/create-3d-component/native-work/map-components-restoration/r2-sync-01"
node $sync --src $source --target $target --work $work --adopt-generated
```

5. 审阅changes.md、proposed/、package-check.json、build-docs.log和sync-plan.json.adopted。预期替换catalog及保留组件的机器页、新增vendor/components.json及归属manifest；当前库若仍0.1.1，新增0.1.1包并删除旧0.1.0包（以实际版本为准）。旧Heat/Scatter导出与页不能再生成；Runtime/Presentation/SurfaceParticleScan/ScreenLabel及无关入口必须保留。工具可能为原来未登记的其他现有组件新增说明，逐项对照C公开导出审核，不用固定文件数冒充正确。
6. adopted只允许本表中实际参与operations的旧生成文件；两份手动已删页不应出现。新生成文件不叫接管。旧MD若未出现在operations又未列为删除，不会自动受manifest管理，必须核对剩余集，发现额外陈旧页先补清理方案再重新prepare。若遇不合资格人工文件，保留并报告冲突；不得加标记、改哈希、移除归属保护或直接强写。
7. prepare后不再修改C或G输入；任何变更（包括人工补文档、版本、导出、已有manifest文件）均使计划过期，重新prepare。审查记录放G/C之外的本任务证据目录。确认差异后执行：

```powershell
node $sync --apply "$work/sync-plan.json" --confirmed
```

8. apply成功核对manifest归属与旧包消失、保留包入口和引用，再跑R2保留功能检查。同步状态仍是scene/editor未验证、publication未发布。以后更新去掉--adopt-generated；工具在已有manifest时会拒绝再次接管。

## 拒绝保护验证计划

以下在R2独立真实副本完成，不运行在共享G/C；本轮仅核对代码条件，不声称测试PASS。

|用例|预期与证据|
|---|---|
|首次不带adoptGenerated覆盖旧包/页|ownership拒绝未登记冲突；目标前后指纹相等|
|首次带adoptGenerated，但把将生成的一页替换为无标记人工内容|仍拒绝；人工页与整个目标不变|
|已有manifest仍传adoptGenerated|prepare明确拒绝；不删除manifest重试|
|prepare后分别改源文件、目标文件|apply拒绝源库变化/目标skill变化；保留并发修改|
|不带confirmed执行apply|拒绝，不写目标|
|apply中途注入失败|回滚自身已写文件，保留并发内容，锁释放|

现有tests/create-3d-component/component-sync.mjs覆盖confirmed、目标变化和失败回滚；component-sync-update.mjs覆盖源变化、人工文件冲突和更新回滚。前者硬编码历史intake样本，不能直接当本次清理的复测证据。R2使用本次清理副本建立fixture，补首次无接管/人工无标记/已有manifest再次接管三项，并记录命令及输出；不得直接运行历史样本脚本修改当前工程。

代码依据：scripts/lib/component-sync.mjs的generatedLegacy/ownership、prepareSync、verifyPlan/applySync；scripts/lib/sync-components-stage.mjs只生成stage内资料，不等于已同步目标。
