# R2a 统一地图组件入口验证

## 改动

- C（D:/cyc/project/octo/test/3d-components）新增 src/map/MapScene.ts，公开 MapScene.create 与外观、画布、坐标、帧调度接口。MapRuntime/MapPresentation 源文件保留为内部实现，不再从 /map 导出构造类。MapSceneOptions 统一宿主参数与 appearance；2d 初建相机 pitch=0，外观状态保留目标 pitch。applyState 只更新外观，视角导航使用 map；文档明确这个边界。
- 创建前验证外观，创建外观失败释放已建地图；销毁顺序为外观后地图，finally 保证地图释放，重复 dispose 幂等。外部 Three 及附加效果由其拥有者先释放。
- 扫光的宿主类型改为 MapScene，算法未重写。旧两套组件文档的四个文件删除，增加 MapScene 页面与 Demo，导航/快速开始/扫光示例更新；内部算法回归页面改为显式导入内部实现，不再伪装公共用法。
- G（R/skills/generate-3d-scene）create-map-scene.ts 只调用 MapScene.create，内部 experience 变量指向同一实例，不重复构造外观。保存字段保持原有 map schema，overlays 拒绝边界保持。SKILL、map.md、map-overlays.md、geographic-map、INTEGRATION_GUIDE 同步改为单一入口。
- sync-components.mjs 使用已有 manifest 流程，未使用 adopt。r2a-sync-01 prepare、审核、apply 完成；真正变化为 catalog、MapScene新增、两个旧API页删除、扫光API、vendor索引/包/manifest；其余生成API文件原始字节不变。仍为本地0.1.1候选包，未发布版本。

## 验证结果

证据根目录：docs/create-3d-component/native-work/map-components-restoration/r2a-evidence（R下）。同步准备证据在旁边 r2a-sync-01。

- `npx tsc -p tsconfig.app.json --noEmit` 通过；不要用根 tsconfig 的空 files/noEmit 代替实际源码类型检查。
- 新 MapScene 与导出文件 ESLint 零警告；扫光文件原有格式警告尚存，不声称全库 lint 通过。最初执行 eslint --fix 扩大了扫光格式差异，已基于本轮启动时干净的 HEAD 仅恢复该文件格式，再应用本批四处类型/说明替换，不还原其他文件或任务改动。
- map-scene.mjs 验证实际 facade（只模拟内部资源边界）：前置验证、2d倾角、快照委托、回调绑定、初始化失败、清理顺序与幂等。docs-map-lifecycle/map-presentation/surface-scan/rounded-building-handoff 全通过，见 node-checks.json。
- 同步副本构建、TypeDoc、打包及归档内容核对通过，见 r2a-sync-01/build-docs.log、package-check.json。初次本地 build 的声明插件报告 TS1294 但进程exit0，未计通过；已改为显式字段初始化并通过实际 app 类型检查与后续构建。
- 独立真实副本 r2a-browser/source 安装准备归档后 vue-tsc 与 Vite build 通过；保留混合动态导入/大chunk警告。复制初次误排除依赖包内 dist，导致缺Vue编译器；在副本 npm ci 后解决，不影响正式工程。
- 17933 浏览器五组：集成、非法overlays更新、空overlays生命周期、基础导航、统一地图+扫光均 ALL PASS，对应日志保存。
- 集成涵盖共享WebGL、屏幕标签、拾取、坐标往返、编辑序列化、主题/二维视角、DPR、阴影、五类表面、调色保持视角、锁定、撤销重做、销毁重建及初始化失败清理。
- 扫光旧fixture仍只保证生命周期：其输出曾警告ground-only，不能作为建筑扫光证明。新增维护测试 map-unified-scan-browser.ts 使用完整显式建筑数据，检查实际几何kind含建筑粒子、GL无错误、暂停空闲、主题切换、独立销毁保留建筑、地图重复释放。此项不是完整设计师扫光视觉还原验收。
- bindings.json 核对32项受管文件摘要、测试扩展与当前G一致、实际安装76项dist与准备构建一致，测试tgz与同步正式tgz一致。references.json 检查当前文档/代码中旧创建教程与旧API链接不存在；不删除历史Spec/审查记录中的名称。
- 使用实际页面检查：17932/#MapScene 在线底图加载，导航仅一个主地图入口，右侧面板可用；切深色画面立即变化，恢复快照返回浅色。截图与交互在会话工具输出中；未冒称用户签收新设计。

## 执行偏差

误调用旧C/scripts/sync-catalog.mjs，生成本地components.json后开始对旁仓UXAI执行bun install。发现后立即中止（exit1），发生过依赖下载/缓存活动；之后两次 git status --short 均为空，未发现Git文件改动。不声称未触及环境，不清理未知缓存。后续改用gen-component-docs.mjs与批准同步工具。不得将此误调用复用于流程说明。

## 打开与复跑

- 展示页：http://127.0.0.1:17932/#MapScene 。运行C下 `node node_modules/vite/bin/vite.js docs --host 127.0.0.1 --port 17932 --strictPort`。
- 独立测试工程：R/docs/create-3d-component/native-work/map-components-restoration/r2a-browser/source；服务端口17933。
- 从R运行 `node tests/generate-3d-scene/run-headless-functional.mjs http://127.0.0.1:17933/map-integration-browser.html`，其他四页为 map-invalid-update-repro、map-overlays-browser、map-p3-performance、map-unified-scan-browser.html。
- 浏览器测试底图为本地合成语义数据；在线真实城市页面只检查展示/主题交互，不是完整城市性能及三份来源视觉验收。

## 状态

实现与自检完成，待独立Review；不自行宣布R2a独立GO。R2历史GO不改，R3未开始。未提交、推送、发布；不自动改既有用户生成工程。纯展示资料不混入本验证记录。
