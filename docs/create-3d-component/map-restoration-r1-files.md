# R1 逐文件清理清单（待确认）

本表仅是R2计划；未执行删除。C=`D:/cyc/project/octo/test/3d-components`，G=`D:/cyc/project/octo/skills/test/ai-for-design/skills/generate-3d-scene`。执行前重查工作区；文件有新变化则先核对，不按目录递归删除。

## C 拟删除的精确文件

|文件|处置|
|---|---|
|`docs/components/LogicalScatter/demo.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`docs/components/LogicalScatter/index.html`|删除旧业务实现或其专属展示；R0基线保留历史|
|`docs/components/LogicalScatter/provenance.md`|删除旧业务实现或其专属展示；R0基线保留历史|
|`docs/components/MapDesignExperience/demo.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`docs/components/MapDesignExperience/index.html`|删除旧业务实现或其专属展示；R0基线保留历史|
|`docs/components/MapDesignExperience/preset.json`|删除旧业务实现或其专属展示；R0基线保留历史|
|`docs/components/MapHeatLayer/demo.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`docs/components/MapHeatLayer/index.html`|删除旧业务实现或其专属展示；R0基线保留历史|
|`docs/components/MapScatterLayer/demo.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`docs/components/MapScatterLayer/index.html`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/MapDesignExperience.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/baseline-buildings.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/baseline-landmarks.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/baseline-renderer.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/baseline-shadows.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/baseline-style.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/index.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/map.d.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/map.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/outside.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/schema.d.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map-design/schema.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map/HeatDelivery.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map/HeatProfileOptions.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map/MapHeatLayer.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map/MapScatterLayer.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map/heat-delivery-schema.d.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map/heat-delivery-schema.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map/heat-profile.d.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/map/heat-profile.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/scatter/LogicalScatter.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/scatter/cluster.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/scatter/data.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/scatter/index.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/scatter/pin.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/scatter/scatter.d.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/scatter/scatter.js`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/scatter/schema.d.ts`|删除旧业务实现或其专属展示；R0基线保留历史|
|`src/scatter/schema.js`|删除旧业务实现或其专属展示；R0基线保留历史|

## G 拟删除的精确文件

|文件|处置|
|---|---|
|`extensions/map/src/scene3d/map/map-overlays.ts`|删除旧图层适配/失效API说明；引用方同步更新|
|`references/component-docs/MapHeatLayer.md`|删除旧图层适配/失效API说明；引用方同步更新|
|`references/component-docs/MapScatterLayer.md`|删除旧图层适配/失效API说明；引用方同步更新|

## 局部编辑与保留

局部编辑的精确入口及每个测试的新断言见同目录 `map-restoration-r1-plan.md` 和主Spec第10.2节。`references/map-overlays.md`改为清理期说明，不能继续宣传可用，也不伪装新实现。同步工具产生的包/目录/机器说明由prepare计划枚举，人工审查后apply；这不是授权脚本任意覆盖。

首次接管前提及顺序见`map-restoration-r1-sync.md`：本表3个G删除和其他人工编辑先完成，再prepare；两份旧API页不会在无prior的首次同步中自动删除。catalog及保留机器页交给显式`--adopt-generated`，不当人工资料编辑。prepare后不得再改输入，否则重新prepare；工具生成的manifest不得手写或删除以绕过归属保护。

保留MapRuntime、MapSurfaceParticleScan、surface-scan、MapPresentation及map-experience、ScreenLabel和所有无关组件；保留其文档及测试。新增未列文件不自动删除。现有用户工程不批量迁移。

确认范围：以上C文件和3个G文件删除，加上计划所列局部适配/文档/测试及经审核的组件同步产物；不包含设计来源、历史Spec、其他任务、未跟踪ZIP和日志。
