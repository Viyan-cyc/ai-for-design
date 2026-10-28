# 工程边界与二次开发

## 固定目录

| 位置 | 职责/所有者 |
|---|---|
| src/main.ts、App.vue | 应用页面启动、UI |
| src/boot-scene.ts | 外部装配：创建场景、传入业务卡片、连接数据；run/edit 共用 |
| src/business/data/{types,adapter,connect}.ts | 后端字段、业务 ID 映射、连接与释放 |
| src/business/cards/ | 业务 Vue 卡片、样式及 index.ts 注册表 |
| src/scene3d/index.ts | 3D 包公开入口 createScene3D |
| src/scene3d/scene-profile.ts | 3D factory 唯一注册入口，建树前执行 |
| src/scene3d/scene/handlers/ | 当前场景模型构建与行为 |
| src/scene3d/scene/appearance.ts | 当前场景默认状态外观 |
| src/scene3d/scene/generated/appearance.ts | 工具编译的编辑外观，不手改 |
| src/scene3d/scene-core/ | 通用引擎、图元、GLB、组合体与 CSS2D 挂载机制 |
| src/edit/ | 通用编辑工具；仅通过 core 公开接口调用 |
| public/scene3d/ | scene-data.json、assets/、offline-resources.json |

scene3d 不 import business、App、boot、edit。业务只能从 src/scene3d 公开入口接入；编辑工具沿用受控的 core API。生成时不修改核心引擎或编辑器。
新场景允许改变 handler 文件数量，目录职责与入口一致。没有卡片不生成无用组件，注册表为空即可。

## 创建与更新

外部 `bootScene` 调用 `createScene3D(host, { cards, cardContext?, assetBaseUrl?, data? })`，拿到 SceneHandle 后再创建业务 adapter、connect；包不主动联网取业务数据。
assetBaseUrl 是包含 scene-data.json 与 assets 的目录，默认 Vite base 下的 scene3d/。离线预览使用已打包资源。材质代码中额外资源 URL 应在 public/scene3d 范围内，并加入离线资源清单。

后端适配器校验字段、映射 ID，然后调用 `handle.patchNodeParams(id, patch)`。该方法浅合并最新 params，undefined 保留旧值，未知节点报错；不隐式新增/删除。
`handle.update` 仍是原有结构级接口（params 整块替换）。节点 ID 与外部业务映射、card.type 保持稳定，才能复制替换包而不改外部代码。
默认不启用 WebSocket/MQTT/模拟计时器；按用户需求在 business/data 实现，连接释放注册到 handle.onDispose。

## Vue 卡片

具体组件只放 business/cards，不放进 3D 包。index.ts 导出的 cards 是名称 → Vue Component；名称由业务自定义，节点 card.type 与其匹配。
节点 params 和 id 作为 props 传入。CSS2D 跟随、显隐、卸载由 core 托管；同类型更新 patch VNode，保留本地输入和展开状态。换组件类型才重建，删除/销毁会卸载。
需要宿主组件库/Pinia/国际化时传入 Vue AppContext；从宿主 setup 中 getCurrentInstance().appContext 获取。应用级 provide 和全局组件可继承，组件局部 provide 不会自动跨树传播。

## 构建行为与外观

Handler 使用 create/update/dispose。结构变化返回 rebuild，状态变化原地修改，禁止每条消息重载 GLB。异步资产用 makeAssetNodeFactory，保留生命周期守卫与资源归属。
组合体槽位唯一且稳定，finish 最后调用；重复构件 batchSlot 一次声明、循环 add，共用材质实例。帧订阅使用 delta 并释放；静态场景不常驻动画订阅。

场景 JSON 包含布局/业务/结构参数以及合法 scene/camera/lights/controls/renderer 舞台配置。默认模型外观在 scene 中，编辑覆盖在 __visuals/__materialLib。状态先应用，编辑覆盖重放，库材质再挂载。
按需 strip 将外观编译到 scene/generated/appearance.ts 并剥离编辑器，保留外部 business。默认仍交付可编辑 index.3d.html，不增加浏览器或审美门禁。

## 复制替换

同一接口版本下替换 src/scene3d 与 public/scene3d；保留 business、boot、App 和应用配置。先备份目标场景目录，再整体替换，避免旧文件残留。
只升级通用引擎时仅替换兼容的 scene-core。不要把全新布局当作引擎更新覆盖用户编辑结果。更改节点 ID、card.type、业务字段需要显式同步业务，不能承诺无损替换。
完整使用示例见产物 docs/INTEGRATION_GUIDE.md。


批量数据使用 `handle.batchUpdates(() => { /* 同步调用 patchNodeParams/update */ })`。更新按顺序立即生效，卡片在最外层批次结束时同步一次；异常也会同步已成功的更新，不回滚，不跨 await。默认 business/data/adapter 已使用此机制并保留单条错误隔离。
外部应用/业务代码可导入 package.json 的 dependencies、optionalDependencies 或 peerDependencies 中声明的运行依赖（包括作用域包子路径）；仍须在项目环境安装依赖。scene3d 与 edit 继续遵守受控依赖白名单，业务不得要求修改 skill 校验器。
