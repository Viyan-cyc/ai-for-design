# P2 散点与热力整合记录

日期：2026-10-31。范围为 P2；未实施真实内网接入等 P3 闭环，不发布 skill ZIP、不提交。没有截图、审美评分或视觉自修复。

## 代码落点

- `D:/cyc/project/octo/test/3d-components/src/map/MapScatterLayer.ts`：稳定世界网格聚合，原 SVG 图钉、CSS 像素尺寸/字体、深浅语义色，一张 Canvas，随地图 render 绘制，单点/聚合选择回调，释放监听与画布。
- 同目录 `MapHeatLayer.ts`、`heat-profile.js`、类型文件：原 v1.26.0 profile 函数逐段提取为 ESM；去除全局变量和原安装器，新增有生命周期的数据/参数接口。固定 valueRange；空数据隐藏；样式重载恢复；只清理自身层和 source。
- skill `extensions/map/.../map-overlays.ts`：地图数据配置、整体列表、单张业务 Vue 卡片、更新/保存/释放适配；`create-map-scene.ts` 接同一 SceneHandle。
- skill 文档：按需 map-overlays.md，map.md、SKILL.md、模板二开指南；生产组件 tgz 与用法页同步。普通入口不导出 map。
- 维护样例仍为 `outputs/map-integration-p1`，同一场景包含地图、GLB、散点和热力。点位为固定明确标注的演示数据，无运营商实测含义。生产 API 无模拟回填。

## 实际验证

1. 组件 labels/map 两入口 strict TypeScript：通过；消费端 vue-tsc + Vite build 通过。
2. `node tests/generate-3d-scene/map-overlays.mjs`：通过。原热力表达式逐项一致、26 停靠点、70.8px 基准影响半径、面积倍率；固定数值标尺；稳定聚合、重复 ID/尺寸校验；Canvas CSS 尺寸/DPR；空数据、更新、显隐、样式重载、销毁。这里使用 mock 地图/Canvas，不冒充浏览器。
3. `component-boundaries.mjs`：通过。根入口无地图、labels/map 依赖隔离，36 组标签尺寸及 clone/copy/所有权回归。
4. `map-source-fixtures.mjs`：通过。原主题/建筑参数与100次同区间缩放无重复重设。
5. `run-headless-functional.mjs http://127.0.0.1:9998/map-overlays-test.html`：24 项通过。真实 Chrome WebGL、GLB、混合层无 GL 错误；列表、显隐撤销重做、锁定、主动重绘、更新、主题保留、DPR .75/1.25/2、清空、保存重建、卸载，以及外部 Vue 卡片的挂载/保留/清理。使用本地空底图 style 夹具，未访问真实内网；允许浏览器软件 WebGL，不证明硬件 FPS。
6. `build-offline.mjs outputs/map-integration-p1`：通过。装配 checked=2/skipped=1（异步 GLB 仍由浏览器测试实际加载），类型/资源/离线 bundle 通过，根目录 index.3d.html + preview + source；维护测试不混入交付。

## 修复过程与边界

- 首次消费端构建暴露 profile 的声明文件引用未被打包；改为独立 TypeScript options 定义，生产包重新生成、安装，消费端构建通过。
- 组件升级时运行中的 Vite 保留旧预构建，导致新导出缺失；停止并 `npm run dev -- --force` 后最终24项通过。enable-map HINT、二开指南同步此步骤。
- 热力为原生 MapLibre 单层显示近似，保留原表达式与面积模糊语义；不是五个独立物理羽化场、米制覆盖或物理热量计算。
- 散点目前使用稳定整数 zoom 分箱，移动时只投影；没有聚合展开动画、遮挡剔除和跨反子午线合并。卡片只挂一张，不把聚合误当某一成员。
- 原库 InstancedMesh2 类型诊断仍存在。sync-components 的 Vite 成功不表示全库类型无错；本次仅新增入口严格类型与消费端通过。
- 本轮未进行 file:// 宿主手动打开、真实外网地图截图、真实内网业务链路或性能基准；这些不冒充已验收。

浏览器维护夹具来自 tests/generate-3d-scene/map-overlays-browser.ts，复制到外部维护工作区运行。正常生成流程仍只执行统一构建，不增加浏览器门禁。

## 后续修正

本文件前文记录首次P2实现。用户反馈后的透明默认、499条原数据、邻近聚合与46项浏览器功能结果，以 spec/specs/generate-3d-scene-map-capabilities-spec.md 第19节为准；首次单格聚合及全域默认不再是当前默认行为。

