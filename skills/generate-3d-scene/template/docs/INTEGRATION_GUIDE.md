# 场景二次开发指南

## 启动

需要 Node.js 和 npm。在项目根目录执行：

```sh
npm install
npm run dev
npm run build
npm run preview
```

内网使用组织配置的 npm 源。生成时可能使用共享依赖链接，下载的源码在另一台机器上需要重新 npm install。
`npm run build` 执行 TypeScript 检查与 Vite 构建。完整工程还支持 `npm run build:offline`，生成 `delivery/index.3d.html` 与配套资源；剥离编辑器的工程仅保留普通开发/构建入口。

## 修改位置

| 要做什么 | 改哪里 |
|---|---|
| 改摆放、相机、灯光、画质 | public/scene3d/scene-data.json 或编辑器 |
| 新增设备构造/状态行为 | src/scene3d/scene/handlers，并在 scene-profile.ts 登记 |
| 改业务默认配色 | src/scene3d/scene/appearance.ts 或对应 handler 默认材质 |
| 改设备信息卡片 | src/business/cards，通过外部 cards 参数注册 |
| 对接后端字段/ID | src/business/data/types.ts、adapter.ts |
| 订阅与请求 | src/business/data/connect.ts |
| 页面 UI | src/App.vue |
| 修改通用引擎功能 | src/scene3d/scene-core；普通业务无需修改 |

main.ts 挂载 UI；boot-scene.ts 在包外装配数据和卡片；scene3d/scene-profile.ts 只注册 3D factory。不要建树后重新注册、重喂数据。
模板中的 DTO 是最小示例（status/spin/speed），生成具体场景时应收敛到实际业务字段并实现 handler 响应。

## 接入状态数据

`bootScene()` 返回 handle、adapter、data、canvas。也可以用 `createDataAdapter(handle)` 创建独立适配器。
以下例子在含 cars 分组且已注册示例状态 handler 的工程中手动调用，将 ID 替换为自己的节点 ID：

```ts
import { createDataAdapter } from './business/data/adapter';
const adapter = createDataAdapter(handle, [
  { businessId: '设备001', nodeId: 'car_01' },
]);
const result = adapter.apply([
  { id: '设备001', status: 'alarm' },
  { id: '不存在的设备', status: 'normal' },
]);
console.log(result.updated, result.unchanged, result.issues);
```

省略映射表时业务 ID 等于节点 ID；提供映射表后只接受已登记 ID。重复业务 ID 或多个业务 ID 指向同一节点会返回 duplicate-mapping。

- 合法 status：normal/alarm/maintenance；spin 是布尔值；speed 是非负有限数。
- 省略字段和 undefined 保留旧值；当前 DTO 不接受 null。额外字段（包括 assetId/position）报 invalid-record。
- 未知 ID 返回 unknown-id，不创建节点；未出现在批次中的节点不删除。
- 同批按输入顺序处理；同值返回 unchanged；无效记录不应用，其他有效记录继续。
- apply-failed 表示引擎应用出错，不承诺事务回滚，请检查该节点。
- adapter.dispose() 或 handle.dispose() 后消息返回 disposed，不更新场景。

**handle.update 与 adapter.apply 不同**：前者 params 整块替换，并支持显式增删/结构编辑；后者只合并白名单业务字段。adapter 校验后调用 patchNodeParams，由 3D 包浅合并最新参数，不会用初始缓存覆盖后来编辑的参数。
例如只更新 status，原有 assetId、capacity 保留。getNodeData 不存在时返回 null；对返回副本的修改不会改变场景。

### 可替换的数据源入口

默认 connectData 不联网。需要订阅时可替换为如下实现，URL 按实际服务配置：

```ts
import type { DataAdapter } from './types';
export function connectData(adapter: DataAdapter): () => void {
  const socket = new WebSocket('wss://your-service.example/devices');
  let active = true;
  socket.onmessage = event => {
    if (!active) return;
    try {
      const records: unknown = JSON.parse(event.data);
      if (!Array.isArray(records)) throw new Error('需要更新数组');
      const result = adapter.apply(records);
      if (result.issues.length) console.warn('数据更新问题', result.issues);
    } catch (error) { console.warn('消息格式错误', error); }
  };
  return () => {
    if (!active) return;
    active = false;
    socket.onmessage = null;
    socket.close();
  };
}
```

这只是接入示例，不会默认执行。实际协议的字段转换和状态枚举需在 adapter 中显式定义。不要把任意接口字段展开写进节点。
boot 注册释放函数，handle.dispose() 自动调用；额外请求用 AbortController，订阅/定时器都在同一释放函数取消。

## 状态、外观与编辑

业务 handler 用 create/update/dispose。状态变化原地修改，几何/资产结构变化返回 rebuild；不得每条消息重新加载 GLB。
GLB 使用公共 makeAssetNodeFactory；动画使用 onFrame 的 delta 和退订函数。按需渲染依靠引擎更新通知，不要为数据刷新开启永久渲染。

scene-data.json 包括业务/布局以及合法舞台设置；设备材质默认值在业务代码中。编辑外观在 __visuals、共享材质在 __materialLib。
引擎在节点更新/重建后重放编辑视觉层；GLB 异步加载也走统一重放。编写业务 handler 应沿用该流程，不绕过或清空视觉覆盖。
仅按需 strip-edit 导出时，外观编译至 src/scene3d/scene/generated/appearance.ts，去除编辑器；TRANSCRIPTION.md 是自动转换摘要。编译文件不要手改，改编辑源后重新导出。

开发模式保存写入 public/scene3d/scene-data.json。离线页面的变更必须回传 Agent 写回并构建后才持久化；退出编辑只保留当前内存结果。

## 定位问题

| 现象 | 检查位置与处理 |
|---|---|
| 某类设备没有出现 | scene-profile 的分组与 JSON 分组是否一致，注册是否发生在建树前 |
| 模型加载失败 | 资产清单、本地资源路径和诊断信息；通用 GLB factory |
| Duplicate/Invalid slot | 对应 handler；槽位唯一且稳定，不含 /；允许大小写、数字、下划线和连字符，首位字母或下划线 |
| Composite already finished | finish 放到所有槽位创建完成后 |
| Batch must use same material instance | batchSlot 一次声明，循环 add；不能循环 new 材质进入同一批 |
| 数据变化但画面没变 | 查看 apply 返回问题、DTO 映射和 handler.update 是否实现该字段 |
| 状态更新丢模型参数 | 用 adapter 或先读取当前 params 合并；handle.update 本身不深合并 |
| 编辑后外观丢失 | 保存是否真正写回，编译外观是否从 boot 应用，handler 是否绕过统一视觉层 |
| 卡顿 | 编辑器画质与性能、统计；检查实例数、绘制次数、纹理和持续帧订阅 |

维护测试不随源码交付，也不作为每次生成的浏览器验收步骤。

通过 skill 的 `scripts/build-offline.mjs <工程目录>` 生成时，还会执行 Node 同步装配检查：真实工厂使用当前场景数据创建节点，捕获重复槽位、提前 finish 等代码错误。它不运行浏览器、动画或模型异步加载；`ASSEMBLY: partial` / `UNCHECKED` 表示未覆盖部分，`RUNTIME: not-run` 表示渲染与交互未测。工程自己的 `npm run build:offline` 仅编译打包，不包含 skill 的装配检查。画面与交互体验由使用者确认。


## 外置卡片与可替换包

后端代码、Vue 卡片和样式放 src/business。整个场景包是 src/scene3d + public/scene3d；替换它们不会覆盖 src/business、App.vue 或外部 boot-scene.ts。
不要把旧包文件混入新包：备份后整体替换。只有节点 ID、card.type 和 API 仍兼容时才能直接替换；新增或改名需同步业务映射。只升级引擎时替换兼容的 scene-core，不覆盖场景布局。

```ts
import { createScene3D } from './scene3d';
import DeviceCard from './business/cards/DeviceCard.vue';
const scene = await createScene3D(container, {
  cards: { deviceInfo: DeviceCard },
  assetBaseUrl: './scene3d/',
});
scene.patchNodeParams('rack_01', { status: 'alarm' });
// 卸载页面
scene.dispose();
```

deviceInfo 是自定义名称，节点配置 `card: { type: 'deviceInfo', trigger: 'click' }` 使用它。id 和 params 自动作为 props；组件自己定义样式、按钮和输入框。修改同类型 props 不重建组件，删除模型、切换组件类型或销毁场景时会卸载组件。

需要继承现有 Vue 应用的全局组件、provide、Pinia/国际化插件时，在宿主组件中传入应用上下文：

```vue
<script setup lang="ts">
import { ref, getCurrentInstance, onMounted, onBeforeUnmount } from 'vue';
import { createScene3D, type SceneHandle } from './scene3d';
import DeviceCard from './business/cards/DeviceCard.vue';
const host = ref<HTMLElement>();
const cardContext = getCurrentInstance()!.appContext;
let scene: SceneHandle | undefined;
let active = true;
onMounted(async () => {
  const loaded = await createScene3D(host.value!, {
    cards: { deviceInfo: DeviceCard }, cardContext,
  });
  if (!active) { loaded.dispose(); return; }
  scene = loaded;
});
onBeforeUnmount(() => { active = false; scene?.dispose(); });
</script>
<template><div ref="host" style="position:relative;width:100%;height:100%" /></template>
```

上层容器必须有实际高度。上下文必须来自已经安装业务插件的 Vue 应用；组件局部 provide 不会自动跨树继承，可通过业务卡片 wrapper 或 props 显式传入。
3D 包保留 CSS2D 挂载机制，不保存具体卡片 Vue 文件。AppContext 和 cards 是运行时参数，不写入场景 JSON 或编辑保存数据。

`patchNodeParams` 是通用浅合并接口，不负责后端枚举、范围或 ID 转换；这些校验在 business/data/adapter。默认无真实后端连接。为自定义场景新增字段时同步 handler 或卡片的响应。


批量数据使用 `handle.batchUpdates(() => { /* 同步调用 patchNodeParams/update */ })`。更新按顺序立即生效，卡片在最外层批次结束时同步一次；异常也会同步已成功的更新，不回滚，不跨 await。默认 business/data/adapter 已使用此机制并保留单条错误隔离。
外部应用/业务代码可导入 package.json 的 dependencies、optionalDependencies 或 peerDependencies 中声明的运行依赖（包括作用域包子路径）；仍须在项目环境安装依赖。scene3d 与 edit 继续遵守受控依赖白名单，业务不得要求修改 skill 校验器。

## 交付目录

打开 delivery/index.3d.html 预览，preview/ 是其必需运行资源。source/ 是完整源码快照，包含 src、public、依赖清单、配置、构建脚本及必要 vendor 包；进入 source 后安装依赖即可开发。不要只复制 src/public 当作独立工程。工作区的 node_modules、缓存和中间产物不进入交付。修改 source 后以它作为新工作工程；不要再用旧工作区重建覆盖修改。

### 开发工作区与交付目录

CLI `node scripts/init.mjs <用户项目目录>` 的参数是最终交付目录，不是开发目录。脚本在用户主目录 `.scene3d/workspaces/` 创建独立工程，输出 WORKSPACE_PATH 和 DELIVERY_PATH。所有源码编辑、模型注入、临时查询文件及其他工程脚本使用 WORKSPACE_PATH，不在用户项目目录初始化源码或安装依赖。统一 build-offline 支持传 WORKSPACE_PATH 或原交付路径；成功返回最终 HTML_PATH。用户项目根目录仅有 index.3d.html、preview/、source/，不再有 delivery/、offline/、node_modules。交付时链接 HTML_PATH。同机后续修改继续使用原工作区；跨电脑使用 source 作为完整工程。旧工程不会自动移动或删除；旧工程无交付配置时仍保留 delivery 输出兼容。
