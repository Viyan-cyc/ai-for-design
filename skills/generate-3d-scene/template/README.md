# 场景二次开发

在工程根目录安装依赖并执行 `npm run dev`。`npm run build` 生成部署文件。

| 想修改什么 | 对应入口 |
| --- | --- |
| 初始布局、模型位置、相机和光照 | `public/data/scene.json` |
| 模型与图片 | `public/models/`、`public/images/`。有模型 ID 映射时查看 `public/data/model-manifest.json` |
| 调整页面布局或 3D 视口 | `src/business/App.vue` 中的 `sceneHost` |
| 接入已有产品页面 | `src/3d/index.ts` 导出的 `createScene3D` 和 `SceneHandle` |
| 对接接口数据和业务交互 | `src/business/data/`、`src/business/App.vue` |
| 编写和注册 Vue 卡片 | `src/business/cards/` |
| 新增 3D 对象类型 | `src/3d/components/objects/` 和 `src/3d/scene-profile.ts` |

## 按 ID 更新场景

普通场景和地图都挂在 Vue 页面声明的视口容器中。页面挂载后传入容器，卸载时调用 `handle.dispose()`。

`handle.update()` 接收按类型分组的增量数据。已存在的 ID 更新原实例，新 ID 使用该类型的工厂创建。删除时传 `remove: [id]`。省略对象时它会继续保留。节点的 `params` 整块替换，局部业务字段可使用 `handle.patchNodeParams(id, fields)`。

使用 `handle.onObjectClick(callback)` 订阅点击，回调收到被点击的节点 ID，点击空白时收到 `null`。用该 ID 驱动产品的列表、详情或业务查询。组件卸载时调用返回的取消订阅函数，场景离开页面时调用 `handle.dispose()`。

## 挂载 2D 卡片

在节点数据里用 `card.type` 指定卡片类型，并在 `src/business/cards/index.ts` 注册 Vue 组件。独立页面使用 `CardHost.vue` 把组件 Teleport 到 3D 提供的挂载点。嵌入产品页面时，创建场景传 `externalCardHost: true`，在产品的 Vue 组件树里挂载 `CardHost`，也可用 `handle.onCardState()` 实现自己的宿主。
