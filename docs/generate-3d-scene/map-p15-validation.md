# P1.5 组件归位记录（2026-10-30）

## 实现边界

- `D:/cyc/project/octo/test/3d-components/src/labels`：ScreenLabel / createScreenLabel，文字或外部贴图、CSS 像素尺寸、锚点、深度测试；独立使用可幂等 dispose，外部贴图不越权释放。引擎接管时继续用 ResourceScope 统一释放。
- `src/map`：MapRuntime，拥有 MapLibre 容器与生命周期、局部米制基变换、共享深度 custom layer、相机矩阵同步、DPR 与业务重绘合并。Three 绘制由回调连接，实际渲染状态重置继续由渲染器执行。
- 地图入口不从根入口 re-export。`/labels` 仅运行依赖 three；`/map` 依赖 three 与 maplibre-gl。GSAP/CSG/BVH/maplibre-gl 改为 optional peer，对应能力的使用方自行安装。Three 开发环境与生成工程固定 0.185.1。
- skill 扩展保留 MapExperience 的来源样式算法及 create-map-scene 的 SceneHandle/Bridge、拾取拖动、显隐锁定和序列化适配。未将编辑器迁入库。
- 删除模板 screen-label 实现与旧导出，生成代码直接从 `/labels` 导入；普通场景使用标签需 `--with-components`。地图 enable-map 自动复制 vendor 包并声明组件依赖；仍需在独立工作区 npm install。
- 同步生产 tgz、TSDoc 两级目录与 docs/components.json。同步脚本支持可选 map 文档入口、模块节点及 static create 的 options；没有 skill ZIP 或 git 提交。

## 实际验证

1. 组件源仓 `npm install --ignore-scripts --no-audit --no-fund`；`node <skill>/scripts/sync-components.mjs --src .`：产出 ESM/CJS/d.ts 和生产 tgz，28 项组件文档。新两入口单独严格检查通过：
   `npx tsc --noEmit --skipLibCheck --target es2022 --module esnext --moduleResolution bundler --strict --erasableSyntaxOnly src/labels/index.ts src/map/index.ts`
2. `node tests/generate-3d-scene/component-boundaries.mjs D:/cyc/project/octo/test/3d-components`：36 组透视/正交、远近、CSS 尺寸、DPR、父缩放的投影计算通过；资源所有权、幂等释放、参数校验通过；递归检查实际 ESM 导入图，labels 只引入 Three，map 不从根入口加载。
3. `node tests/generate-3d-scene/map-source-fixtures.mjs`：来源深浅主题、建筑增长参数、普通工程可选依赖、100 次同阈值缩放无重设通过。
4. 更新维护工程的地图适配与组件包，`http://127.0.0.1:9998/map-integration-test.html` 实际浏览器 WebGL 38 项 ALL PASS：实际 GLB、投影拾取、zoom 15/17 标签均保持 180 CSS px、DPR .75/1.25/1、阴影切换、调色主动重绘、外观/位置/主题保存恢复、锁定、撤销重做、销毁重建及无 GL 错误；增加初始化失败清理、独立宿主重复释放。测试代码在 tests，不在 skill。
5. `node skills/generate-3d-scene/scripts/build-offline.mjs outputs/map-integration-p1`：类型/静态/资源/离线构建通过。GLB 异步加载证据来自第4项，不来自 Node 装配。
6. 新建普通维护示例 `init.mjs outputs/p15-ordinary-regression --profile demo --defer-build --json`，再 `build-offline.mjs outputs/p15-ordinary-regression`：9 节点装配和交付构建通过；交付包无地图库/服务标识，普通模板不含 map/turf 依赖。
7. tgz 白名单检查：含 labels/map 的 JS 和类型，不含 src、node_modules、source map。维护示例位于 skill 外；旧深圳业务工程未修改。

## 限制与后续

- 全库 vite:dts 仍报告原有 `src/core/InstancedMesh2` 的 TypedArray、泛型 this/unknown 类型问题，构建脚本虽返回 0，也不能称全库类型检查通过。本次未改这些实现；两新增入口严格检查与消费工程类型检查通过。全库类型债另行处理。
- 第2项为数学测试，第4项为实际 WebGL/功能测试；没有做审美验收。物理鼠标拖动未在本轮重复，拖动锁接线保持原模板实现；位置更新/拾取/保存已回归。
- 未替用户做内网真实服务验收；file:// 宿主仍沿用 P1 待用户确认。普通场景这轮完成装配与构建隔离检查，未声称另做实际 GPU 性能测量。
- P2 散点/热力、P3 完整生成及内网验收没有提前实施。
- 升级旧工程需同时更新组件包与匹配地图适配，标签旧导入改为 `/labels`，保留 business/场景 handler；不要批量覆盖用户项目。
