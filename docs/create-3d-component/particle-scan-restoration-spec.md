# 上海地图粒子扫光还原 — Feature Spec

## 1. 目标与授权
2026-11-12；用户明确授权按sdd-riper-one在独立副本跑完整流程，先看效果、确认后导出。本轮Research→Plan→Execute，既有执行批准与本轮明确指令共同作为授权；导出/入库/同步/发布仍锁定至相应确认。原HTML与生产库只读，不提交推送。

## 2. 来源与范围
来源：用户提供的“上海地图粒子扫光-明珠光影修正-v1.2(1).html”。来源为已有设计代码，本任务是忠实还原及组件化，不冒称从零原创。
源文件包含约19MB地图宿主、明珠GLB、普通建筑及其他地标资产、MapLibre/Turf/Three网络依赖。扫光独立脚本为东方明珠粒子扫描-v2.1，约21KB。地图、建筑、材质与光影保留在example；component只承载采样、shader、播放和状态接口。
默认设计覆盖：粒子size3.1 CSS px，spacing4m，facadeDensity1.3，count72000预算，radius790m，period8s，width32m；三色#1FC7F5/#B2ECF5/#FFBA47，位置0/50/100%。波前地面距离+0.55倍高度，指数主带及0.28回波，显式使用MapLibre depth range。初始化默认与设计覆盖分开。

## 3. 文件计划
独立工程：本目录native-work/particle-scan-restoration（根index.3d.html、component/、example/）。example/reference.html为只读来源快照；example/host保存独立地图宿主，例内地标资产不进入组件。component/src提供源算法迁移及宿主接口；component/design.md、engineering.md、preset.json记录来源/差异。example中的构建/适配/检查脚本及证据仅本地。
当前原生入库契约仅自动支持普通Three Mesh，不支持该MapLibre自定义层；不得伪装为native-host即可直接入库。先完成效果与清晰边界，再按确认推进独立库适配；需要扩展交付契约时明确计划，不旁路检查。

## 4. 本批验收
1. 原始与组件化页面均实际打开，检查依赖及网络失败，保留实际截图。
2. 原始算法关键参数/采样/shader可逐项追溯；组件演示不加载第二份原始扫光来冒充迁移。
3. 右侧调参，开关、暂停/继续/重播、默认恢复；参数更改可见。原地图样式与地标不因扫光改变。
4. 原文件哈希前后不变；不导出ZIP、不入库生产、不发布。页面在线瓦片依赖如实说明。

## 5. 后续门禁
效果确认→导出独立组件包→开发审查与独立库接纳→独立generator同步与真实场景验证。每阶段更新本Spec并提供review prompt。本轮只完成可看效果阶段；RN45-1长类型文档截断仍为既有维护问题，不隐瞒为本任务已解决。

## 6. 本批实施与验证（2026-11-12）
状态：Review / 等待独立审查与用户效果确认；导出、入库、同步、发布未执行。

已完成：从源脚本抽取createScanApi至component/src/index.ts，注入Three、Mercator转换及点面判断依赖；保留来源采样与shader，新增暂停、继续、重播、单次/循环、中心修改。地图和地标资产保留在example，未混进组件源码。右侧新增实时面板、默认恢复和导出锁定说明。默认恢复同时恢复中心及循环状态。

实现偏差：原HTML嵌入support.js含字面量<x-dc>，HTTP重新解析时可能误把脚本字符串作为模板。仅独立host-template.html对该脚本字符串作等义转义；原文件和reference.html未修改。对照测试通过网络响应拦截，对原版施加相同解析兼容修正，不修改其扫光算法。首次file协议对照和未等待瓦片截图出现缺建筑/缺瓦片，不能作为最终一致性证据；最终验证统一HTTP并等待areTilesLoaded后再截图。

最终证据位于native-work/particle-scan-restoration/example：verify.mjs、validation.json、reference.png、restored.png。2026-11-12执行verify.mjs通过：两版真实浏览器渲染、画布尺寸、无pageerror、vertex/fragment shader逐字相同；实际粒子均为ground19577/buildings38440/pearl1366/total59383。还原页面测试粒子大小更新至uniform、暂停后时间不推进、继续状态、关闭状态、恢复来源大小3.1。固定中心、zoom16.5/pitch45/bearing0及扫描3秒截图已人工查看，地图建筑及可见光带分布对应；不同控制面板为预期差异。这不等于全视角像素一致或用户视觉签字。

源文件SHA256复算仍为d6519cfd3910c562ae1d537164a6ae71b86d600d9e3bcbb8f2d065a72b180eea。组件TypeScript基础编译检查0诊断；尚未声明通过目标库strict原生接纳。构建仅生成index.3d.html，没有生成交付ZIP。

预览：http://127.0.0.1:17931/index.3d.html 。地图瓦片和基础库依赖网络；不是完全离线包。example/build.mjs依赖本仓维护工具的esbuild，不是最终消费者构建契约。

| 审查轴 | 本轮自检 | 边界 |
| --- | --- | --- |
| 需求覆盖 | 预览阶段已实现，完整流程未结束 | 效果确认、导出及后续独立接入待执行 |
| 计划一致性 | 独立副本实施、原文件及生产库未修改 | HTTP兼容修正已记录 |
| 实现质量 | 已列浏览器与源码检查通过 | 完整生命周期压力、各参数组合、所有遮挡视角尚未覆盖 |

待确认：动态扫光前沿、色彩/密度/拖尾、贴墙爬升与明珠表现是否符合原设计观感。用户确认前保持导出锁定。下一执行单元须核定MapLibre宿主契约与目标库版本适配方案，不能宣称当前源码直接符合现有自动入库契约。

恢复锚点：先读本节与example/validation.json，打开预览并查独立review；若有问题在本独立目录修复，不覆盖共享实现。不自动提交、推送或发布。
